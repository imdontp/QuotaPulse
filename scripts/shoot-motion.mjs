/**
 * Capture the Live page with motion actually running, and measure what it costs.
 *
 * Why this exists. Every other capture of this app sets `reducedMotion: 'reduce'`:
 * `shoot.mjs` does it so a shot cannot catch mid-animation and jitter between runs, and
 * `check-ui.mjs` does it for the same reason. That is correct for a regression, and it has
 * the side effect that the moving version of a motion-driven design is never once looked
 * at. The check-ui fixture also emits 8,000 tokens/hour against a 250,000 threshold, so the
 * backdrop renders at 3% intensity -- effectively idle.
 *
 * So: real motion, a throughput that makes the field do something, several timestamps so
 * the drift is visible, and both themes because additive compositing on a white background
 * is the case most likely to blow out. The real database is captured too, since the calm
 * state is what this design spends most of its life in.
 *
 * Usage:  node scripts/shoot-motion.mjs [outDir]
 */
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = resolve(fileURLToPath(new URL('..', import.meta.url)));
const OUT = resolve(process.argv[2] ?? join(REPO, 'screens', 'motion'));
const PORT = Number(process.env.SHOOT_MOTION_PORT ?? 7802);
const BASE = `http://127.0.0.1:${PORT}`;
const LIVE = process.env.LOCALAPPDATA
  ? join(process.env.LOCALAPPDATA, 'QuotaPulse')
  : join(process.env.HOME ?? '', '.local', 'share', 'QuotaPulse');

/** Timestamps, so the drift is something you can see rather than something I assert. */
const FRAMES = [
  { at: 0, label: 't0' },
  { at: 900, label: 't900' },
  { at: 2200, label: 't2200' },
];

function seed(theme, lang) {
  return (page) =>
    page.addInitScript(
      ([t, l]) => {
        try {
          localStorage.setItem('quotapulse-theme', t);
          localStorage.setItem('quotapulse-prefs', JSON.stringify({ lang: l, currency: 'USD', rate: 1 }));
        } catch {
          /* the shot just renders with defaults */
        }
      },
      [theme, lang],
    );
}

async function settle(page) {
  await page.waitForSelector('.pulse-stage', { timeout: 30_000 });
  await page
    .waitForFunction(() => !document.body.innerText.includes('loading'), { timeout: 15_000 })
    .catch(() => {});
  await page.waitForTimeout(600);
}

/**
 * How many times the aurora actually painted in a window.
 *
 * Deliberately NOT a frame-rate number. Sampling rAF measures the browser's vsync, which
 * reports a healthy 60fps whether or not a single pixel was drawn -- the first version of
 * this script did exactly that and cheerfully reported no saving from pausing the loop
 * when it had not checked anything. The canvas increments `data-frames` per real paint, so
 * this counts the work itself.
 */
const PAINTS = (el, ms) =>
  new Promise((done) => {
    const from = Number(el.dataset.frames ?? 0);
    setTimeout(() => done(Number(el.dataset.frames ?? 0) - from), ms);
  });

async function capture(browser, name, { theme, lang = 'en', width = 1440, height = 900 }) {
  const ctx = await browser.newContext({
    viewport: { width, height },
    colorScheme: theme,
    deviceScaleFactor: 2,
    // The whole point of this script.
    reducedMotion: 'no-preference',
  });
  const page = await ctx.newPage();
  await seed(theme, lang)(page);
  await page.goto(`${BASE}/#live`, { waitUntil: 'domcontentloaded' });
  await settle(page);

  const stage = page.getByTestId('pulse-hero');
  const intensity = await stage.getAttribute('data-pulse');

  let elapsed = 0;
  for (const frame of FRAMES) {
    await page.waitForTimeout(Math.max(0, frame.at - elapsed));
    elapsed = frame.at;
    await page.screenshot({ path: join(OUT, `${name}-${frame.label}.png`) });
  }

  const WINDOW = 2000;
  const onScreen = await page.evaluate(
    ([sel, ms]) =>
      new Promise((done) => {
        const el = document.querySelector(sel);
        const from = Number(el?.dataset.frames ?? 0);
        setTimeout(() => done(Number(el?.dataset.frames ?? 0) - from), ms);
      }),
    ['[data-aurora="true"]', WINDOW],
  );

  // Scroll the hero off the top, which is where it spends most of a session.
  //
  // The app's shell owns its own scroll container, so `window.scrollTo` is a no-op here --
  // the first version of this script used it, moved nothing, and reported the loop as
  // still running when it had never left the viewport. Find the real scroller, move it,
  // and refuse to measure unless it actually moved.
  const scrolled = await page.evaluate(() => {
    let el = document.querySelector('.pulse-stage')?.parentElement ?? null;
    let scroller = null;
    while (el) {
      if (el.scrollHeight > el.clientHeight + 50) {
        scroller = el;
        break;
      }
      el = el.parentElement;
    }
    if (!scroller) scroller = document.scrollingElement;
    if (!scroller) return 0;
    const before = scroller.scrollTop;
    scroller.scrollTop = before + 1600;
    return scroller.scrollTop - before;
  });

  if (scrolled < 100) {
    throw new Error(
      `could not scroll the hero out of view (moved ${scrolled}px); the paint measurement would be meaningless`,
    );
  }
  await page.waitForTimeout(500);
  const away = await page.evaluate(
    ([sel, ms]) =>
      new Promise((done) => {
        const el = document.querySelector(sel);
        const from = Number(el?.dataset.frames ?? 0);
        setTimeout(() => done(Number(el?.dataset.frames ?? 0) - from), ms);
      }),
    ['[data-aurora="true"]', WINDOW],
  );

  const perSec = (n) => Math.round(n / (WINDOW / 1000));
  console.log(`  ${name}  intensity=${intensity}   (scrolled ${scrolled}px)`);
  console.log(`     hero on screen    : ${onScreen} paints (${perSec(onScreen)}/s)`);
  console.log(`     hero scrolled away: ${away} paints (${perSec(away)}/s)`);
  console.log(`     saving            : ${onScreen > 0 ? Math.round((1 - away / onScreen) * 100) : 0}%`);
  await ctx.close();
  return { intensity: Number(intensity), onScreen, away, scrolled };
}

function startDaemon(dataDir) {
  const tsx = join(REPO, 'node_modules', 'tsx', 'dist', 'cli.mjs');
  const child = spawn(
    process.execPath,
    [tsx, join('packages', 'daemon', 'src', 'index.ts')],
    {
      cwd: REPO,
      env: { ...process.env, QUOTAPULSE_PORT: String(PORT), QUOTAPULSE_DATA_DIR: dataDir },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
  return new Promise((res, rej) => {
    const timer = setTimeout(() => rej(new Error('daemon did not become ready in 90s')), 90_000);
    const watch = (buf) => {
      if (String(buf).includes('ready ->')) {
        clearTimeout(timer);
        res(child);
      }
    };
    child.stdout.on('data', watch);
    child.stderr.on('data', watch);
    child.on('exit', (code) => {
      clearTimeout(timer);
      rej(new Error(`daemon exited early with code ${code}`));
    });
  });
}

async function assertPortFree() {
  const reachable = await fetch(BASE, { signal: AbortSignal.timeout(1200) }).then(() => true, () => false);
  if (reachable) throw new Error(`port ${PORT} is already serving. Stop it, or set SHOOT_MOTION_PORT.`);
}

const dataDir = mkdtempSync(join(tmpdir(), 'quotapulse-motion-'));
mkdirSync(OUT, { recursive: true });

let daemon;
let browser;
try {
  const db = join(LIVE, 'usage.db');
  if (!existsSync(db)) throw new Error(`no database at ${db}`);
  for (const file of ['usage.db', 'usage.db-wal', 'usage.db-shm', 'models.dev.json']) {
    if (existsSync(join(LIVE, file))) copyFileSync(join(LIVE, file), join(dataDir, file));
  }
  console.log(`copied database from ${LIVE} (the real, calm state)`);

  await assertPortFree();
  daemon = await startDaemon(dataDir);
  browser = await chromium.launch({ channel: 'chrome' });
  console.log(`\nwriting to ${OUT}\n`);

  await capture(browser, 'real-dark', { theme: 'dark' });
  await capture(browser, 'real-light', { theme: 'light' });
  await capture(browser, 'real-th-dark', { theme: 'dark', lang: 'th' });
  /*
   * The pause can only be demonstrated where the hero can actually leave the screen. On a
   * 1440px viewport the hero is ~550px tall and the whole page scrolls 512px, so it is
   * never fully off screen and a 0% saving is the honest answer rather than a failure. A
   * phone viewport stacks the page to several thousand pixels, which is the real-world
   * shape where scrolling past the hero happens.
   */
  await capture(browser, 'real-narrow-390', { theme: 'dark', width: 390, height: 844 });
  console.log('\ndone');
} finally {
  await browser?.close();
  daemon?.kill();
  try {
    rmSync(dataDir, { recursive: true, force: true });
  } catch {
    /* the daemon may still hold the sqlite file for a moment; it is in tmp either way */
  }
}
