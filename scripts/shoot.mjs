/**
 * Screenshot the dashboard into `screens/` so UI work can actually be looked at.
 *
 * Why Playwright and not `chrome --screenshot`: the page opens an SSE stream that never
 * closes (EventSource in packages/web/src/api.ts against text/event-stream in
 * packages/daemon/src/api/server.ts). Chrome's `--virtual-time-budget` only advances
 * virtual time while the page is idle, so against a healthy daemon the budget never
 * fires and headless kills the renderer with "Abnormal renderer termination". Waiting on
 * a real selector is the fix. For the same reason, NEVER use waitUntil 'networkidle'
 * here: it will hang forever.
 *
 * This spawns its own daemon on a spare port with a throwaway data directory rather than
 * reusing whatever is already running. A second daemon on the real database holds it open
 * and makes the two diverge, which has already happened once during the rebrand.
 *
 * Usage:  node scripts/shoot.mjs [outDir]
 */
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = resolve(fileURLToPath(new URL('..', import.meta.url)));
const OUT = resolve(process.argv[2] ?? join(REPO, 'screens'));
const PORT = 7799;
const BASE = `http://127.0.0.1:${PORT}`;

const SECTIONS = ['live', 'limits', 'trend', 'cost', 'sessions', 'projects', 'models', 'health'];

/** Start the daemon on a scratch database and resolve once it says it is listening. */
function startDaemon(dataDir) {
  /*
   * Run tsx's entry with this same node binary rather than going through the `npx` shim.
   * Node 22 refuses to spawn a .cmd without `shell: true` (spawn EINVAL), and turning the
   * shell on to work around that would put the argv through cmd.exe quoting for no gain.
   */
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
      process.stdout.write(line.replace(/^/gm, '    '));
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

/**
 * Seeded before first paint, because index.html reads both keys in a blocking script to
 * avoid a light flash and to set <html lang> before Chrome picks a line-break dictionary.
 */
function seed(theme, lang) {
  return (page) =>
    page.addInitScript(
      ([t, l]) => {
        try {
          localStorage.setItem('quotapulse-theme', t);
          localStorage.setItem('quotapulse-prefs', JSON.stringify({ lang: l, currency: 'USD', rate: 1 }));
        } catch {
          /* nothing to do: the shot just renders with defaults */
        }
      },
      [theme, lang],
    );
}

/** Wait for the shell to be painted and the first fetch to have resolved. */
async function settle(page) {
  await page.waitForSelector('[role="tab"][aria-selected="true"]', { timeout: 30_000 });
  // The loading placeholder clears once /api/overview lands. Sections that render empty
  // never show it at all, so a timeout here is not a failure.
  await page
    .waitForFunction(() => !document.body.innerText.includes('loading'), { timeout: 15_000 })
    .catch(() => {});
  await page.waitForTimeout(700); // let the spring counters and the pill settle
}

async function shoot(browser, name, { width, height, theme = 'dark', lang = 'en', hash = 'live', full = true }) {
  const ctx = await browser.newContext({
    viewport: { width, height },
    colorScheme: theme,
    deviceScaleFactor: 2,
    reducedMotion: 'reduce', // otherwise the shot catches mid-animation and jitters run to run
  });
  const page = await ctx.newPage();
  await seed(theme, lang)(page);
  await page.goto(`${BASE}/#${hash}`, { waitUntil: 'domcontentloaded' });
  await settle(page);
  await page.screenshot({ path: join(OUT, `${name}.png`), fullPage: full });
  console.log(`  ${name}.png`);
  await ctx.close();
}

async function shootLogo(browser) {
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    colorScheme: 'dark',
    deviceScaleFactor: 8, // the mark is 22px; magnify so the bars are actually inspectable
  });
  const page = await ctx.newPage();
  await seed('dark', 'en')(page);
  await page.goto(`${BASE}/#live`, { waitUntil: 'domcontentloaded' });
  await settle(page);
  const mark = page.locator('svg[aria-label="QuotaPulse"]').first();
  await mark.screenshot({ path: join(OUT, 'logo-mark.png') });
  console.log('  logo-mark.png');
  await ctx.close();
}

const dataDir = mkdtempSync(join(tmpdir(), 'quotapulse-shots-'));
mkdirSync(OUT, { recursive: true });
console.log(`daemon on ${BASE}, scratch state in ${dataDir}`);

let daemon;
let browser;
try {
  daemon = await startDaemon(dataDir);
  browser = await chromium.launch({ channel: 'chrome' });
  console.log(`\nwriting to ${OUT}`);

  await shoot(browser, 'wide-dark', { width: 1440, height: 900, theme: 'dark' });
  await shoot(browser, 'wide-light', { width: 1440, height: 900, theme: 'light' });
  await shoot(browser, 'tray-popup', { width: 460, height: 620, theme: 'dark' });
  await shoot(browser, 'breakpoint-899', { width: 899, height: 800, theme: 'dark' });
  await shoot(browser, 'breakpoint-901', { width: 901, height: 800, theme: 'dark' });
  await shoot(browser, 'wide-thai', { width: 1440, height: 900, theme: 'dark', lang: 'th' });

  for (const s of SECTIONS) {
    await shoot(browser, `section-${s}`, { width: 1440, height: 900, theme: 'dark', hash: s });
  }

  await shootLogo(browser);
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
