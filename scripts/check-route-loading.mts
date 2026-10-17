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

async function newPage(lang = 'en', width = 1672, theme = 'dark') {
  const page = await browser!.newPage({ viewport: { width, height: 992 }, timezoneId: 'Asia/Bangkok', reducedMotion: 'reduce' });
  page.setDefaultTimeout(10_000);
  page.on('pageerror', error => faults.push(error.message));
  await page.addInitScript(({ lang, theme }) => {
    const target = window as unknown as { __QUOTAPULSE_TOKEN__: string; __readyCalls: number; qpDashboard: { ready(): void } };
    target.__QUOTAPULSE_TOKEN__ = 'route-loading-test';
    target.__readyCalls = 0;
    target.qpDashboard = { ready() { target.__readyCalls++; } };
    if (!localStorage.getItem('quotapulse-prefs')) localStorage.setItem('quotapulse-prefs', JSON.stringify({ lang, currency: 'USD', rate: 1, hiddenSubscriptions: [] }));
    localStorage.setItem('quotapulse-settings-migrated', '1');
    if (!localStorage.getItem('quotapulse-theme')) localStorage.setItem('quotapulse-theme', theme);
  }, { lang, theme });
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


const numbered = (prefix: string, count = 4) => Array.from({ length: count }, (_, index) => `${prefix}-${index}`);
const regionInventory: Record<string, string[]> = {
  live: [...numbered('live-metric'), 'live-sessions', 'live-flow', 'live-feed', 'live-advisories', 'live-matrix'],
  projects: [...numbered('project-card'), 'project-details', 'project-top'],
  providers: [...numbered('providers-card'), 'providers-inspector', 'providers-comparison', 'providers-health'],
  models: [...numbered('models-summary'), 'models-comparison', 'models-providers', ...numbered('models-detail')],
  cost: [...numbered('cost-summary'), 'cost-providers', 'cost-trend', 'cost-models', 'cost-projects', 'cost-sessions', 'cost-insights'],
  history: [...numbered('history-summary'), 'history-timeline', 'history-records', 'history-detail'],
  alerts: [...numbered('alert-summary'), 'alert-chart', 'alert-risks', 'alert-rules', 'alert-forecast', 'alert-guidance', 'alert-events'],
  settings: numbered('settings-section', 6),
};
async function pendingGeometry(page: Page, destination: string, hash = `#${destination}`) {
  const pending = page.locator(`[data-route-pending="${destination}"]`);
  await pending.waitFor();
  const diagnostics = hash.includes('section=diagnostics');
  const expected = diagnostics ? ['settings-adapters', 'settings-coverage'] : regionInventory[destination];
  const regions = await pending.locator('[data-initial-region]').evaluateAll(elements => elements.map(element => {
    const rect = element.getBoundingClientRect();
    return { id: element.getAttribute('data-initial-region'), x: rect.x, y: rect.y, width: rect.width, height: rect.height };
  }));
  assert.deepEqual(regions.map(region => region.id).sort(), [...expected].sort(), `${hash}: reserved region inventory`);
  for (const region of regions) {
    assert.ok(region.width > 0 && region.height > 0, `${hash}/${region.id}: region must occupy space`);
    assert.ok(region.x >= -0.5 && region.x + region.width <= page.viewportSize()!.width + 0.5, `${hash}/${region.id}: horizontal region overflow`);
  }
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${hash}: document overflow`);
  assert.equal(await pending.locator('table,canvas,svg,strong,input,select').count(), 0, `${hash}: unavailable module must not invent values, chart points or form controls`);
  const inspector = regions.find(region => region.id === 'providers-inspector');
  if (inspector) assert.equal(inspector.height >= 200, hash.includes('owner=') || hash.includes('source='), `${hash}: inspector query geometry`);
  return regions;
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
    const heldRegions = destination === 'overview' ? undefined : await pendingGeometry(page, destination);
    const heldGeometry = await chromeGeometry(page);
    await page.screenshot({ path: resolve(output, `${destination}-${lang}-pending.png`), animations: 'disabled' });
    hold.release();
    await pending.waitFor({ state: 'detached' });
    await shell.waitFor();
    const loadedGeometry = await chromeGeometry(page);
    assert.deepEqual(loadedGeometry, heldGeometry, `${destination}/${lang}: header/navigation frame changes at module handoff`);
    if (destination === 'history') {
      await page.locator('.qp-history-timeline > h2').waitFor();
      assert.equal(await page.locator('.qp-history-timeline > h2').evaluate(element => getComputedStyle(element).fontSize), '15px');
      assert.equal(await page.locator('.qp-history-view-actions button').first().evaluate(element => getComputedStyle(element).fontSize), '13px');
    }
    records.push({ kind: 'cold-module', destination, lang, width, heldGeometry, loadedGeometry, heldRegions });
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

  // Each rejection is the same intercepted import just observed in its loading state.
  // Compare real reserved boxes without masks/tolerance changes, then recover via reload.
  const moduleCases = [
    ...pages.filter(destination => destination !== 'overview').map(destination => ({ destination, hash: `#${destination}`, name: destination })),
    { destination: 'providers', hash: '#providers?owner=source%3A1&source=1', name: 'providers-inspector' },
    { destination: 'settings', hash: '#settings?section=diagnostics&source=1', name: 'settings-diagnostics' },
  ];
  for (const { destination, hash, name } of moduleCases) for (const lang of ['en', 'th'] as const)
    for (const theme of ['dark', 'light'] as const) for (const width of [390, 900, 1280, 1672]) {
    const page = await newPage(lang, width, theme);
    const local = lang === 'en' ? en : th;
    let rejectImport!: () => void;
    let intercepted!: () => void;
    const requested = new Promise<void>(resolve => { intercepted = resolve; });
    const rejected = new Promise<void>(resolve => { rejectImport = resolve; });
    let fail = true;
    const prefix = routePrefix(destination);
    await page.route('**/assets/*.js', async route => {
      if (targetModule(route.request().url(), prefix) && fail) {
        intercepted(); await rejected;
        await route.fulfill({ status: 503, contentType: 'text/javascript', body: '' });
      } else await route.continue();
    });
    await page.goto(`http://127.0.0.1:7816/${hash}`, { waitUntil: 'domcontentloaded' });
    await Promise.race([requested, new Promise<never>((_, reject) => { const timer = setTimeout(() => reject(new Error(`Module not intercepted: ${name}`)), 10_000); timer.unref(); })]);
    const loading = page.locator('[data-route-load-state=loading]');
    await loading.waitFor();
    await page.evaluate(async () => { await document.fonts.ready; });
    await page.waitForFunction(() => (window as unknown as { __readyCalls: number }).__readyCalls > 0);
    const shell = page.getByTestId(`production-${destination}`);
    assert.equal(await shell.getAttribute('lang'), lang);
    assert.equal(await shell.getAttribute('data-theme'), theme);
    assert.equal(await loading.locator('[role=status]').textContent(), local['app.loading']);
    assert.equal(await loading.getAttribute('aria-busy'), 'true');
    assert.deepEqual(await loading.locator('[data-initial-state]').evaluateAll(elements => [...new Set(elements.map(element => element.getAttribute('data-initial-state')))]), ['loading']);
    const loadingRegions = await pendingGeometry(page, destination, hash);
    const loadingChrome = await chromeGeometry(page);
    const artifact = `${name}-${lang}-${theme}-${width}`;
    await page.screenshot({ path: resolve(output, `${artifact}-loading.png`), animations: 'disabled' });
    rejectImport();
    const error = page.locator('[data-route-load-state=error]');
    await error.waitFor();
    assert.equal(await error.locator('[role=status]').textContent(), local['app.couldNotLoad']);
    assert.equal(await error.getAttribute('aria-busy'), 'false');
    assert.deepEqual(await error.locator('[data-initial-state]').evaluateAll(elements => [...new Set(elements.map(element => element.getAttribute('data-initial-state')))]), ['error']);
    const errorRegions = await pendingGeometry(page, destination, hash);
    assert.deepEqual(errorRegions, loadingRegions, `${artifact}: loading/error reserved boxes changed`);
    assert.deepEqual(await chromeGeometry(page), loadingChrome, `${artifact}: rejection changed chrome`);
    await page.screenshot({ path: resolve(output, `${artifact}-error.png`), animations: 'disabled' });
    await page.getByRole('button', { name: local['redesign.theme'], exact: true }).click();
    const recoveredTheme = theme === 'dark' ? 'light' : 'dark';
    fail = false;
    const retry = error.getByRole('button', { name: local['app.retry'], exact: true });
    await retry.focus(); assert.equal(await retry.evaluate(element => element === document.activeElement), true);
    await Promise.all([page.waitForNavigation({ waitUntil: 'domcontentloaded' }), page.keyboard.press('Enter')]);
    await page.getByTestId(`production-${destination}`).waitFor();
    await page.locator('[data-route-load-state]').waitFor({ state: 'detached' });
    const recoveredHash = new URL(page.url()).hash;
    assert.equal(recoveredHash.split('?')[0], hash.split('?')[0], `${artifact}: recovered page`);
    assert.deepEqual([...new URLSearchParams(recoveredHash.split('?')[1] ?? '')].sort(),
      [...new URLSearchParams(hash.split('?')[1] ?? '')].sort(), `${artifact}: recovered query values`);
    assert.equal(await page.getByTestId(`production-${destination}`).getAttribute('data-theme'), recoveredTheme);
    assert.equal(await page.getByTestId(`production-${destination}`).getAttribute('lang'), lang);
    records.push({ kind: 'chunk-rejection-reload', destination, name, lang, theme, width, recoveredHash,
      keyboard: true, retainedTheme: recoveredTheme, loadingRegions, errorRegions, chrome: loadingChrome });
    console.log(`Module recovery ${name}/${lang}/${theme}/${width} passed.`);
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
