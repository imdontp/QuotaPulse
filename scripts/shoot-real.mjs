/**
 * Screenshot the Live page from the REAL database, as a copy.
 *
 * Why this exists. Every shot so far came from `shoot.mjs` (a scratch database, which
 * renders the "no data yet" case) or from the crisis fixture in `check-ui.mjs` (88% used,
 * a quota feed dead, pricing incomplete). Neither is what a user with a healthy install
 * actually looks at, and a healthy install is the overwhelming majority of the time. A
 * design can look excellent during a crisis and be dead weight the rest of the time.
 *
 * The database is COPIED, never opened in place. A daemon pointed at the live file would
 * hold a write lock and could add samples to it, which is the one thing a screenshot must
 * not do to someone's data. Copying also means this script is safe to run mid-session.
 *
 * Usage:  node scripts/shoot-real.mjs [outDir]
 */
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = resolve(fileURLToPath(new URL('..', import.meta.url)));
const OUT = resolve(process.argv[2] ?? join(REPO, 'screens', 'real'));
const PORT = Number(process.env.SHOOT_REAL_PORT ?? 7801);
const BASE = `http://127.0.0.1:${PORT}`;
const LIVE = process.env.LOCALAPPDATA
  ? join(process.env.LOCALAPPDATA, 'QuotaPulse')
  : join(process.env.HOME ?? '', '.local', 'share', 'QuotaPulse');

/**
 * Refuse to start if something already owns the port.
 *
 * A leftover daemon from an interrupted run is a genuinely confusing failure: this script
 * starts its own on the copied database, so a stale process keeps serving the OLD scratch
 * directory, the shot succeeds, and the images are quietly of the wrong state.
 */
async function assertPortFree() {
  const reachable = await fetch(BASE, { signal: AbortSignal.timeout(1200) }).then(() => true, () => false);
  if (reachable) {
    throw new Error(
      `port ${PORT} is already serving. Stop that process, or set SHOOT_REAL_PORT to a free port.`,
    );
  }
}

/**
 * Seeded before first paint: index.html reads both keys in a blocking script to avoid a
 * light flash, so setting them after load would capture the wrong theme.
 */
function seed(theme, lang) {
  return (page) =>
    page.addInitScript(
      ([t, l]) => {
        try {
          localStorage.setItem('quotapulse-theme', t);
          localStorage.setItem('quotapulse-prefs', JSON.stringify({ lang: l, currency: 'USD', rate: 1 }));
          localStorage.setItem('quotapulse-progress', JSON.stringify({ version: 1, days: [], unlocked: [] }));
        } catch {
          /* the shot just renders with defaults */
        }
      },
      [theme, lang],
    );
}

/**
 * Wait for the Live hero and the first fetch.
 *
 * Deliberately not keyed on chrome. Both obvious candidates live in the sidebar, which is
 * `hidden md:flex`: at 390px the desktop brand mark resolves to a hidden node and the wait
 * never satisfies, which is exactly how this script failed at 390px while passing at 1440.
 * `.pulse-stage` is the hero container itself, present in both its empty and populated
 * forms, so it is the one thing guaranteed at every width -- and it is the thing being
 * photographed.
 */
async function settle(page) {
  await page.waitForSelector('.pulse-stage', { timeout: 30_000 });
  // The loading placeholder clears once /api/overview lands. A section that renders empty
  // never shows it at all, so a timeout here is not a failure.
  await page
    .waitForFunction(() => !document.body.innerText.includes('loading'), { timeout: 15_000 })
    .catch(() => {});
  await page.waitForTimeout(700);
}

async function shoot(browser, name, { width, height, theme, lang, motion = 'reduce' }) {
  const ctx = await browser.newContext({
    viewport: { width, height },
    colorScheme: theme,
    deviceScaleFactor: 2,
    // Deliberately the same as the regression harness: this script is for judging the
    // composition, not the animation. `shoot-motion.mjs` covers the motion.
    reducedMotion: motion,
  });
  const page = await ctx.newPage();
  const problems = [];
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
  page.on('response', (r) => {
    if (r.status() >= 400) problems.push(`http ${r.status()} ${r.url()}`);
  });
  await seed(theme, lang)(page);
  await page.goto(`${BASE}/#live`, { waitUntil: 'domcontentloaded' });
  try {
    await settle(page);
  } catch (err) {
    // Dump the state rather than leaving a bare timeout to guess at: "resolved to hidden"
    // says nothing about *why* it is hidden, and the first version of this script failed
    // that way twice for reasons this output would have shown immediately.
    const text = (await page.textContent('body').catch(() => '')) ?? '';
    const mark = page.locator('svg[aria-label="QuotaPulse"]');
    console.error(`\n  ${name} failed to settle.`);
    console.error(`  url        ${page.url()}`);
    console.error(`  viewport   ${JSON.stringify(page.viewportSize())}`);
    console.error(`  mark count ${await mark.count().catch(() => -1)}`);
    console.error(`  body text  ${JSON.stringify(text.replace(/\s+/g, ' ').slice(0, 300))}`);
    if (problems.length) console.error(`  problems   ${[...new Set(problems)].slice(0, 8).join(' | ')}`);
    await page.screenshot({ path: join(OUT, `${name}-FAILED.png`) }).catch(() => {});
    throw err;
  }
  await page.screenshot({ path: join(OUT, `${name}.png`), fullPage: true });
  console.log(`  ${name}.png`);
  await ctx.close();
}

/** Start the daemon on the copied database and resolve once it says it is listening. */
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
      const line = String(buf);
      if (line.includes('ready ->')) {
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

const dataDir = mkdtempSync(join(tmpdir(), 'quotapulse-real-'));
mkdirSync(OUT, { recursive: true });

let daemon;
let browser;
try {
  const db = join(LIVE, 'usage.db');
  if (!existsSync(db)) throw new Error(`no database at ${db}`);
  // The WAL holds recent writes that are not yet in the main file, so copying only
  // usage.db would capture a database a few minutes out of date.
  for (const file of ['usage.db', 'usage.db-wal', 'usage.db-shm']) {
    if (existsSync(join(LIVE, file))) copyFileSync(join(LIVE, file), join(dataDir, file));
  }
  // The price catalog is what makes "Value" a number rather than a dash.
  if (existsSync(join(LIVE, 'models.dev.json'))) {
    copyFileSync(join(LIVE, 'models.dev.json'), join(dataDir, 'models.dev.json'));
  }
  console.log(`copied database from ${LIVE} into ${dataDir}`);

  await assertPortFree();
  daemon = await startDaemon(dataDir);
  browser = await chromium.launch({ channel: 'chrome' });
  console.log(`\nwriting to ${OUT}`);

  await shoot(browser, 'real-dark-1440', { width: 1440, height: 900, theme: 'dark', lang: 'en' });
  await shoot(browser, 'real-light-1440', { width: 1440, height: 900, theme: 'light', lang: 'en' });
  await shoot(browser, 'real-dark-390', { width: 390, height: 844, theme: 'dark', lang: 'en' });
  await shoot(browser, 'real-th-dark-1440', { width: 1440, height: 900, theme: 'dark', lang: 'th' });
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
