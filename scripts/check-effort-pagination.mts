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
const phase = process.env.QUOTAPULSE_EFFORT85_PHASE ?? 'final';
const webRoot = resolve(root, phase === 'before' ? 'tmp/source85-dist84' : 'packages/web/dist');
const output = resolve(root, phase === 'before' ? 'tmp/effort85-browser-before' : 'screens/effort-pagination');
mkdirSync(output, { recursive: true });
rmSync(resolve(output, 'verification.json'), { force: true });
const db = openDb(':memory:');
const now = Date.now();
const firstAt = now - 60_000;
db.prepare('INSERT INTO source(id,harness,profile,root_path,display_name,detected_at) VALUES (1,?,?,?,?,?)').run('claude-code', 'synthetic', '/synthetic/nonexistent', 'Synthetic category fixture', now);
db.prepare('INSERT INTO session(id,source_id,native_session_id,project,last_seen_at) VALUES (1,1,?,?,?)').run('synthetic-session', 'Synthetic only', now);
const insert = db.prepare("INSERT INTO usage_event(source_id,session_id,dedup_key,ts,model,provider,input_tokens,output_tokens,total_tokens,call_count,cost_source,effort) VALUES (1,1,?,?,'synthetic-model','anthropic',2,1,3,1,'unknown',?)");
const seed = () => db.transaction(() => {
  db.prepare('DELETE FROM usage_event').run();
  for (let i = 0; i < 20_000; i++) insert.run('synthetic-' + i, firstAt + i, i === 0 ? null : i === 1 ? '' : 'custom-effort-' + String(i - 2).padStart(5, '0'));
})();
seed();
const scheduler = new Scheduler(db, [], { pollMs: 1_000_000, detectMs: 1_000_000 });
const daemon = buildServer(db, scheduler, { token: 'effort-browser-test', port: 7816, webRoot });
const records: unknown[] = [];
const errors: string[] = [], forbidden: string[] = [];
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
const query = (from = firstAt - 60_000) => `range=custom&from=${from}&to=${now + 1}&source=1`;
const rowsFor = (page: Page, route: string) => page.locator(route === 'history' ? '.qp-history-summary article:last-child ul>li' : '.qp-model-efforts>li');
async function newPage(lang: 'en' | 'th', width: number) {
  const page = await browser!.newPage({ viewport: { width, height: 941 }, reducedMotion: 'reduce', timezoneId: 'Asia/Bangkok' });
  page.setDefaultTimeout(30_000);
  page.on('pageerror', e => errors.push(e.message));
  await page.route('**/*', r => {
    const q = r.request(), u = new URL(q.url());
    if (u.origin !== 'http://127.0.0.1:7816' || u.pathname.startsWith('/api/') && q.method() !== 'GET') { forbidden.push(q.method() + ' ' + u.pathname); return r.abort(); }
    return r.continue();
  });
  await page.addInitScript(({ lang }) => {
    (window as any).__QUOTAPULSE_TOKEN__ = 'effort-browser-test';
    localStorage.setItem('quotapulse-prefs', JSON.stringify({ lang, currency: lang === 'th' ? 'THB' : 'USD', rate: lang === 'th' ? 36 : 1, hiddenSubscriptions: [] }));
    localStorage.setItem('quotapulse-theme', 'dark');
  }, { lang });
  await page.clock.setFixedTime(now);
  return page;
}
try {
  await daemon.listen({ host: '127.0.0.1', port: 7816 });
  browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--disable-gpu', '--force-color-profile=srgb'] });
  for (const route of ['models', 'history']) for (const lang of phase === 'before' ? ['en'] as const : ['en', 'th'] as const) for (const width of phase === 'before' ? [1672] : [1672, 390]) {
    seed();
    const page = await newPage(lang, width);
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Performance.enable');
    const startMetrics = await cdp.send('Performance.getMetrics');
    const started = performance.now();
    await page.goto(`http://127.0.0.1:7816/#${route}?${query()}`);
    const rows = rowsFor(page, route);
    await rows.first().waitFor();
    await page.waitForFunction(({ route, count }) => document.querySelectorAll(route === 'history' ? '.qp-history-summary article:last-child ul>li' : '.qp-model-efforts>li').length === count, { route, count: phase === 'before' ? 20_000 : 20 });
    await page.evaluate(() => document.fonts.ready);
    if (route === 'history') await page.keyboard.press('Escape');
    const readyMs = performance.now() - started;
    const endMetrics = await cdp.send('Performance.getMetrics');
    const metrics = (names: string[]) => Object.fromEntries(names.map(name => [name, (endMetrics.metrics.find((m: any) => m.name === name)?.value ?? 0) - (startMetrics.metrics.find((m: any) => m.name === name)?.value ?? 0)]));
    const initial = await rows.allTextContents();
    const domElements = await page.locator('*').count();
    await page.screenshot({ path: resolve(output, `${route}-${lang}-${width}-initial.png`), animations: 'disabled' });
    const record: any = { route, lang, width, readyMs, initialEffortRows: initial.length, domElements, cpuSeconds: metrics(['TaskDuration', 'ScriptDuration', 'LayoutDuration']), initialFirst: initial.slice(0, 3) };
    if (phase !== 'before') {
      const local = lang === 'en' ? en : th;
      const nav = page.getByTestId('effort-pagination');
      await nav.waitFor();
      const next = nav.getByRole('button', { name: local['history.next'], exact: true });
      const previous = nav.getByRole('button', { name: local['history.previous'], exact: true });
      assert.equal(await previous.isDisabled(), true);
      await next.focus();
      await page.keyboard.press('Enter');
      await rows.first().filter({ hasText: 'custom-effort-00018' }).waitFor();
      assert.equal(await rows.count(), 20);
      assert.equal(await previous.isEnabled(), true);
      if (route === 'models') assert.ok(await page.locator('.qp-model-effort-share>span').evaluateAll(elements => elements.every(e => Math.abs(parseFloat((e as HTMLElement).style.width) - 0.005) < .000001)), 'Shares use all20000 categories');
      const pageTwo = await rows.allTextContents();
      const refreshPath = route === 'history' ? '/api/history-summary' : '/api/models';
      const sameScopeResponse = page.waitForResponse(r => new URL(r.url()).pathname === refreshPath);
      scheduler.emit('data', { newEvents: 0, newLimits: 0, trigger: 'synthetic-same-scope' });
      await (await sameScopeResponse).finished();
      await page.waitForTimeout(200);
      assert.deepEqual(await rows.allTextContents(), pageTwo, 'Same-scope polling retains page');
      await next.focus(); await page.keyboard.press('Enter');
      await rows.first().filter({ hasText: 'custom-effort-00038' }).waitFor();
      db.prepare("DELETE FROM usage_event WHERE CAST(substr(dedup_key,11) AS INTEGER)>=21").run();
      assert.equal((db.prepare('SELECT COUNT(*) AS n FROM usage_event').get() as any).n, 21);
      const shrinkResponse = page.waitForResponse(r => new URL(r.url()).pathname === refreshPath);
      scheduler.emit('data', { newEvents: 0, newLimits: 0, trigger: 'synthetic-shrink' });
      const acceptedResponse = await shrinkResponse; const acceptedBody = await acceptedResponse.json();
      await page.waitForTimeout(200);
      writeFileSync(resolve(output, `${route}-${lang}-${width}-shrink-observed.json`), JSON.stringify({ apiTotals: acceptedBody.totals, apiScope: acceptedBody.scope, visibleEffortRows: await rows.allTextContents(), modelEffortText: await page.locator('.qp-model-efforts').textContent().catch(() => null) }, null, 2));
      // Actual same-scope SSE refresh must accept the new count and clamp page2.
      await page.waitForFunction(({ route }) => document.querySelectorAll(route === 'history' ? '.qp-history-summary article:last-child ul>li' : '.qp-model-efforts>li').length === 1, { route }, { timeout: 20_000 });
      assert.match(await rows.first().innerText(), /custom-effort-00018/);
      assert.equal(await next.isDisabled(), true);
      await previous.focus(); await page.keyboard.press('Enter');
      await page.waitForFunction(({ route }) => document.querySelectorAll(route === 'history' ? '.qp-history-summary article:last-child ul>li' : '.qp-model-efforts>li').length === 20, { route });
      assert.deepEqual(await rows.allTextContents(), initial);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'Document fits viewport');
      const bounds = await nav.boundingBox(); assert.ok(bounds && bounds.x >= -.5 && bounds.x + bounds.width <= width + .5, 'Category controls fit viewport');
      await page.screenshot({ path: resolve(output, `${route}-${lang}-${width}-after-shrink.png`), animations: 'disabled' });
      record.keyboardNextPrevious = true; record.sameScopeSseRetainsPage = true; record.shrinkClampsToLast = true; record.finalBoundaryDisabled = true; record.controlFits = true;
    }
    records.push(record); await page.close();
    console.log(`Effort ${phase} ${route}/${lang}/${width} passed.`);
  }
  assert.deepEqual(errors, []); assert.deepEqual(forbidden, []);
  writeFileSync(resolve(output, 'verification.json'), JSON.stringify({ phase, indexSha256: createHash('sha256').update(readFileSync(resolve(webRoot, 'index.html'))).digest('hex'), fixture: 'Synthetic memoryDB, actual APIs; no user database/live readers; measured timings are observations, not budgets', records, errors, forbidden }, null, 2));
} finally { await browser?.close(); await daemon.close(); db.close(); }
