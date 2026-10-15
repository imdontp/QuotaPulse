/** Isolated production module lifecycle checks; no user database or live readers. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, type Page } from 'playwright';
import { openDb } from '../packages/daemon/src/db/index.js';
import { buildServer } from '../packages/daemon/src/api/server.js';
import { Scheduler } from '../packages/daemon/src/ingest/scheduler.js';
import { en } from '../packages/web/src/i18n/en.js';
import { th } from '../packages/web/src/i18n/th.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const output = resolve(root, 'screens/route-loading');
mkdirSync(output, { recursive: true });
rmSync(resolve(output, 'verification.json'), { force: true });
const now = Date.parse('2025-05-17T13:42:00.000Z');
const nativeDate = globalThis.Date;
globalThis.Date = new Proxy(nativeDate, {
  construct(target, args) { return Reflect.construct(target, args.length ? args : [now]); },
  get(target, property, receiver) { return property === 'now' ? () => now : Reflect.get(target, property, receiver); },
});
const db = openDb(':memory:');
db.prepare('INSERT INTO source(id,harness,profile,root_path,display_name,detected_at) VALUES (1,?,?,?,?,?)')
  .run('codex', 'isolated', '/synthetic/nonexistent', 'Isolated lifecycle fixture', now);
db.prepare('INSERT INTO session(id,source_id,native_session_id,project,last_seen_at) VALUES (1,1,?,?,?)').run('route-fixture', 'Fixture', now - 1);
db.prepare("INSERT INTO usage_event(source_id,session_id,dedup_key,ts,model,provider,input_tokens,output_tokens,total_tokens,call_count,cost_source) VALUES (1,1,'route-fixture',?,'fixture-model','openai',10,5,15,1,'unknown')").run(now - 1);
const scheduler = new Scheduler(db, [], { pollMs: 1_000_000, detectMs: 1_000_000 });
const server = buildServer(db, scheduler, { token: 'route-loading-test', port: 7816, webRoot: resolve(root, 'packages/web/dist') });
const rendererArgs = ['--disable-gpu', '--force-color-profile=srgb'];
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
const records: unknown[] = [];
const faults: string[] = [];
const pages = ['overview', 'live', 'projects', 'models', 'history', 'alerts', 'providers', 'cost', 'settings'];
const routePrefix = (page: string) => page === 'overview' ? 'production' : page === 'history' || page === 'settings' ? 'utility-pages' : page;
const targetModule = (url: string, prefix: string) => new RegExp(`/${prefix}-[^/]+\\.js$`).test(new URL(url).pathname);

async function newPage(lang = 'en', width = 1672) {
  const page = await browser!.newPage({ viewport: { width, height: 992 }, timezoneId: 'Asia/Bangkok', reducedMotion: 'reduce' });
  page.setDefaultTimeout(10_000);
  page.on('pageerror', error => faults.push(error.message));
  await page.addInitScript(({ lang }) => {
    const target = window as unknown as { __QUOTAPULSE_TOKEN__: string; __readyCalls: number; qpDashboard: { ready(): void } };
    target.__QUOTAPULSE_TOKEN__ = 'route-loading-test';
    target.__readyCalls = 0;
    target.qpDashboard = { ready() { target.__readyCalls++; } };
    if (!localStorage.getItem('quotapulse-prefs')) localStorage.setItem('quotapulse-prefs', JSON.stringify({ lang, currency: 'USD', rate: 1, hiddenSubscriptions: [] }));
    localStorage.setItem('quotapulse-settings-migrated', '1');
    if (!localStorage.getItem('quotapulse-theme')) localStorage.setItem('quotapulse-theme', 'dark');
  }, { lang });
  await page.clock.setFixedTime(now);
  return page;
}

async function holdModule(page: Page, prefix: string) {
  let release!: () => void;
  let intercepted!: () => void;
  const held = new Promise<void>(resolve => { intercepted = resolve; });
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/assets/*.js', async route => {
    if (targetModule(route.request().url(), prefix)) { intercepted(); await gate; }
    await route.continue();
  });
  return { release, held: () => Promise.race([held, new Promise<never>((_, reject) => { const timer = setTimeout(() => reject(new Error(`Module not intercepted: ${prefix}`)), 10_000); timer.unref(); })]) };
}

async function chromeGeometry(page: Page) {
  return page.locator('.qp-topbar,.qp-sidebar nav').evaluateAll(elements => elements.map(element => {
    const rect = element.getBoundingClientRect();
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
  }));
}

try {
  await server.listen({ host: '127.0.0.1', port: 7816 });
  browser = await chromium.launch({ channel: 'chrome', headless: true, args: rendererArgs });
  for (const lang of ['en', 'th'] as const) for (const destination of pages) {
    const width = destination === 'settings' ? 390 : 1672;
    const page = await newPage(lang, width);
    const hold = await holdModule(page, routePrefix(destination));
    await page.goto(`http://127.0.0.1:7816/#${destination}`, { waitUntil: 'domcontentloaded' });
    await hold.held();
    const pending = page.locator('[data-route-load-state=loading]');
    await pending.waitFor();
    const shell = page.getByTestId(`production-${destination}`);
    if (await shell.getAttribute('data-theme') !== 'dark') console.log('Unexpected initial theme', {
      destination, lang, faults, storage: await page.evaluate(() => ({ prefs: localStorage.getItem('quotapulse-prefs'), theme: localStorage.getItem('quotapulse-theme'), bridge: typeof window.qpDashboard })),
    });
    assert.equal(await shell.getAttribute('lang'), lang);
    assert.equal(await shell.getAttribute('data-theme'), 'dark');
    assert.equal(await pending.locator('[role=status]').textContent(), (lang === 'en' ? en : th)['app.loading']);
    assert.equal(await shell.locator('.qp-topbar').count(), 1);
    assert.equal(await shell.locator('.qp-sidebar').count(), 1);
    assert.equal(await shell.locator('[data-stat=namedProjects]').textContent(), (lang === 'en' ? en : th)['redesign.unknownValue']);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.waitForFunction(() => (window as unknown as { __readyCalls: number }).__readyCalls > 0);
    await page.evaluate(async () => { await document.fonts.ready; });
    const heldGeometry = await chromeGeometry(page);
    await page.screenshot({ path: resolve(output, `${destination}-${lang}-pending.png`), animations: 'disabled' });
    hold.release();
    await pending.waitFor({ state: 'detached' });
    await shell.waitFor();
    const loadedGeometry = await chromeGeometry(page);
    assert.deepEqual(loadedGeometry, heldGeometry, `${destination}/${lang}: header/navigation frame changes at module handoff`);
    if (destination === 'history') {
      await page.locator('.qp-history-timeline h2').waitFor();
      assert.equal(await page.locator('.qp-history-timeline h2').evaluate(element => getComputedStyle(element).fontSize), '15px');
      assert.equal(await page.locator('.qp-history-view-actions button').first().evaluate(element => getComputedStyle(element).fontSize), '13px');
    }
    records.push({ kind: 'cold-module', destination, lang, width, heldGeometry, loadedGeometry });
    await page.close();
  }

  // Keep one provider across A -> held B -> A -> B, including preference changes in B.
  {
    const page = await newPage();
    let settingsRequests = 0;
    page.on('request', request => { if (new URL(request.url()).pathname === '/api/settings') settingsRequests++; });
    const hold = await holdModule(page, 'models');
    await page.goto('http://127.0.0.1:7816/#overview', { waitUntil: 'domcontentloaded' });
    await page.locator('.qp-pulse-art').waitFor();
    const initialSettingsRequests = settingsRequests;
    await page.locator('.qp-sidebar a[href="#models"]').click();
    await hold.held();
    await page.locator('[data-route-load-state=loading]').waitFor();
    await page.getByRole('button', { name: en['redesign.language'], exact: true }).click();
    await page.getByRole('button', { name: th['redesign.theme'], exact: true }).click();
    await page.locator('.qp-sidebar a[href="#overview"]').click();
    await page.getByTestId('production-overview').locator('.qp-pulse-art').waitFor();
    await page.locator('.qp-sidebar a[href="#models"]').click();
    const pending = page.locator('[data-route-load-state=loading]');
    await pending.waitFor();
    assert.equal(await page.getByTestId('production-models').getAttribute('lang'), 'th');
    assert.equal(await page.getByTestId('production-models').getAttribute('data-theme'), 'light');
    hold.release(); await pending.waitFor({ state: 'detached' });
    const shell = page.getByTestId('production-models');
    assert.equal(await shell.getAttribute('lang'), 'th');
    assert.equal(await shell.getAttribute('data-theme'), 'light');
    assert.equal(settingsRequests, initialSettingsRequests, 'Route navigation must not remount the preferences provider');
    const prefs = await page.evaluate(() => JSON.parse(localStorage.getItem('quotapulse-prefs')!));
    assert.equal(prefs.lang, 'th'); assert.equal(prefs.currency, 'THB'); assert.equal(prefs.rate, 36);
    records.push({ kind: 'A-B-A-B-preferences', settingsRequests, prefs });
    await page.close();
  }

  for (const lang of ['en', 'th'] as const) {
    const page = await newPage(lang, 390);
    let fail = true;
    await page.route('**/assets/*.js', route => targetModule(route.request().url(), 'models') && fail
      ? route.fulfill({ status: 503, contentType: 'text/javascript', body: '' }) : route.continue());
    await page.goto('http://127.0.0.1:7816/#models', { waitUntil: 'domcontentloaded' });
    const error = page.locator('[data-route-load-state=error]');
    await error.waitFor();
    assert.equal(await error.locator('[role=status]').textContent(), (lang === 'en' ? en : th)['app.couldNotLoad']);
    assert.equal(await error.getAttribute('aria-busy'), 'false');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.screenshot({ path: resolve(output, `models-${lang}-chunk-error.png`), animations: 'disabled' });
    await page.getByRole('button', { name: (lang === 'en' ? en : th)['redesign.theme'], exact: true }).click();
    fail = false;
    const retry = error.getByRole('button', { name: (lang === 'en' ? en : th)['app.retry'], exact: true });
    await retry.focus(); assert.equal(await retry.evaluate(element => element === document.activeElement), true);
    await Promise.all([page.waitForNavigation({ waitUntil: 'domcontentloaded' }), page.keyboard.press('Enter')]);
    await page.getByTestId('production-models').waitFor();
    await page.locator('[data-route-load-state]').waitFor({ state: 'detached' });
    assert.equal(new URL(page.url()).hash, '#models');
    assert.equal(await page.getByTestId('production-models').getAttribute('data-theme'), 'light');
    records.push({ kind: 'chunk-rejection-reload', lang, width: 390, recoveredHash: '#models', keyboard: true, retainedTheme: 'light' });
    await page.close();
  }
  for (const mode of ['legacy', 'popup']) {
    const page = await newPage('th', mode === 'popup' ? 420 : 1280);
    await page.goto(`http://127.0.0.1:7816/?mode=${mode}#live`, { waitUntil: 'domcontentloaded' });
    await page.locator(mode === 'popup' ? '.pet-popup' : '.dashboard-content').waitFor();
    assert.equal(await page.locator('.qp-redesign,[data-route-load-state]').count(), 0);
    await page.screenshot({ path: resolve(output, `${mode}-th.png`), animations: 'disabled' });
    records.push({ kind: 'preserved-entry-mode', mode, lang: 'th' });
    await page.close();
  }
  assert.deepEqual(faults, [], 'Unexpected uncaught browser errors');
  writeFileSync(resolve(output, 'verification.json'), JSON.stringify({
    productionIndexSha256: createHash('sha256').update(readFileSync(resolve(root, 'packages/web/dist/index.html'))).digest('hex'),
    browser: browser.version(), rendererArgs, fixture: 'isolated in-memory API; no live readers', records,
  }, null, 2));
  console.log(`Route loading passed: ${records.length} lifecycle cases.`);
} finally {
  await browser?.close(); await server.close(); db.close(); globalThis.Date = nativeDate;
}
