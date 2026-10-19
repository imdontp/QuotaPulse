/** Actual fixed-scope SSE refresh, retained snapshots, superseded reads and selection. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { openDb } from '../packages/daemon/src/db/index.js';
import { buildServer } from '../packages/daemon/src/api/server.js';
import { Scheduler } from '../packages/daemon/src/ingest/scheduler.js';
import { en } from '../packages/web/src/i18n/en.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const output = resolve(root, 'screens/model-detail-refresh');
mkdirSync(output, { recursive: true });
rmSync(resolve(output, 'verification.json'), { force: true });
const db = openDb(':memory:');
const now = Date.now();
db.prepare('INSERT INTO source(id,harness,profile,root_path,display_name,detected_at) VALUES (1,?,?,?,?,?)').run('claude-code', 'synthetic', '/synthetic/nonexistent', 'Synthetic only', now);
db.prepare('INSERT INTO session(id,source_id,native_session_id,project,last_seen_at) VALUES (1,1,?,?,?)').run('synthetic-session', 'Synthetic only', now);
const add = db.prepare("INSERT INTO usage_event(source_id,session_id,dedup_key,ts,model,provider,total_tokens,input_tokens,output_tokens,call_count,cost_source,effort) VALUES (1,1,?,?,'synthetic-model','anthropic',3,2,1,1,'unknown',?)");
for (let i = 0; i < 21; i++) add.run('category-' + i, now - 60_000 + i, 'effort-' + String(i).padStart(2, '0'));
db.prepare("INSERT INTO usage_event(source_id,session_id,dedup_key,ts,model,provider,total_tokens,input_tokens,output_tokens,call_count,cost_source,effort) VALUES (1,1,'other',?,'other-model','anthropic',1,1,0,1,'unknown','other-effort')").run(now - 60_000);
const scheduler = new Scheduler(db, [], { pollMs: 1_000_000, detectMs: 1_000_000 });
const server = buildServer(db, scheduler, { token: 'model-refresh-test', port: 7816, webRoot: resolve(root, 'packages/web/dist') });
const rendererArgs = ['--disable-gpu', '--force-color-profile=srgb'];
const faults: string[] = [], forbidden: string[] = [];
const requests: string[] = [];
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
let releaseHeld: (() => void) | undefined;
try {
  await server.listen({ host: '127.0.0.1', port: 7816 });
  browser = await chromium.launch({ channel: 'chrome', headless: true, args: rendererArgs });
  const page = await browser.newPage({ viewport: { width: 1672, height: 941 }, reducedMotion: 'reduce', timezoneId: 'Asia/Bangkok' });
  page.setDefaultTimeout(20_000);
  page.on('pageerror', error => faults.push(error.message));
  page.on('request', request => { if (new URL(request.url()).pathname === '/api/model-detail') requests.push(request.url()); });
  await page.route('**/*', route => {
    const request = route.request(), url = new URL(request.url());
    if (url.origin !== 'http://127.0.0.1:7816' || url.pathname.startsWith('/api/') && request.method() !== 'GET') { forbidden.push(request.method() + ' ' + url.pathname); return route.abort(); }
    return route.continue();
  });
  let mode: 'pass' | 'hold' | 'fail' = 'pass';
  let heldAccepted!: () => void;
  const intercepted = new Promise<void>(resolve => { heldAccepted = resolve; });
  const held = new Promise<void>(resolve => { releaseHeld = resolve; });
  let heldDelivered!: () => void;
  const delivered = new Promise<void>(resolve => { heldDelivered = resolve; });
  let heldCategories = 0;
  await page.route('**/api/model-detail?*', async route => {
    const primary = new URL(route.request().url()).searchParams.get('model') === 'synthetic-model';
    const current = primary ? mode : 'pass';
    if (current === 'hold') {
      mode = 'pass';
      const response = await route.fetch();
      const body = await response.body();
      heldCategories = JSON.parse(body.toString()).efforts.length;
      heldAccepted(); await held;
      await route.fulfill({ response, body });
      heldDelivered();
    } else if (current === 'fail') {
      mode = 'pass';
      await route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"synthetic temporary detail failure"}' });
    } else await route.continue();
  });
  await page.addInitScript(() => {
    (window as any).__QUOTAPULSE_TOKEN__ = 'model-refresh-test';
    localStorage.setItem('quotapulse-prefs', JSON.stringify({ lang: 'en', currency: 'USD', rate: 1, hiddenSubscriptions: [] }));
    localStorage.setItem('quotapulse-theme', 'dark');
  });
  await page.clock.setFixedTime(now);
  await page.goto(`http://127.0.0.1:7816/#models?range=custom&from=${now - 120_000}&to=${now + 1}&source=1&model=synthetic-model&selected_provider=anthropic`);
  const nav = page.getByTestId('effort-pagination');
  const status = nav.getByRole('status');
  await status.filter({ hasText: /of 21 categories/ }).waitFor();
  const initial = await status.innerText();
  mode = 'hold'; add.run('category-21', now - 30_000, 'effort-21');
  scheduler.emit('data', { newEvents: 1, newLimits: 0, trigger: 'synthetic-held-read' });
  await Promise.race([intercepted, new Promise<never>((_, reject) => { const timeout = setTimeout(() => reject(new Error('Same fixed-scope detail was not requested')), 20_000); timeout.unref(); })]);
  assert.equal(heldCategories, 22);
  assert.equal(await status.innerText(), initial, 'Last accepted details stay visible while same-key request is held');
  add.run('category-22', now - 30_000, 'effort-22');
  scheduler.emit('data', { newEvents: 1, newLimits: 0, trigger: 'synthetic-newer-read' });
  await status.filter({ hasText: /of 23 categories/ }).waitFor();
  const oldResponse = page.waitForResponse(async response => {
    if (new URL(response.url()).pathname !== '/api/model-detail') return false;
    try { return (await response.json()).efforts?.length === 22; } catch { return false; }
  });
  releaseHeld!();
  await delivered;
  assert.equal(await (await oldResponse).finished(), null, 'Held old response was fully delivered');
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  assert.match(await status.innerText(), /of 23 categories/, 'Late old22 result cannot replace accepted23 result');
  await page.screenshot({ path: resolve(output, 'latest-wins.png'), animations: 'disabled' });
  mode = 'fail'; add.run('category-23', now - 30_000, 'effort-23');
  scheduler.emit('data', { newEvents: 1, newLimits: 0, trigger: 'synthetic-detail-failure' });
  const retry = page.locator('.qp-model-detail').getByRole('button', { name: en['app.retry'], exact: true });
  await retry.waitFor();
  assert.match(await status.innerText(), /of 23 categories/, 'Last accepted details retained on actual503');
  await page.screenshot({ path: resolve(output, 'retained-error.png'), animations: 'disabled' });
  await retry.focus(); await page.keyboard.press('Enter');
  await status.filter({ hasText: /of 24 categories/ }).waitFor();
  await nav.getByRole('button', { name: en['history.next'], exact: true }).click();
  await status.filter({ hasText: /21.*24 of 24 categories/ }).waitFor();
  await page.locator('.qp-model-table-wrap').getByRole('button', { name: 'other-model', exact: true }).click();
  await page.locator('.qp-model-efforts>li').filter({ hasText: 'other-effort' }).waitFor();
  assert.equal(await nav.count(), 0);
  await page.locator('.qp-model-table-wrap').getByRole('button', { name: 'synthetic-model', exact: true }).click();
  await status.filter({ hasText: /1.*20 of 24 categories/ }).waitFor();
  assert.equal(await nav.getByRole('button', { name: en['history.previous'], exact: true }).isDisabled(), true);
  assert.equal(await page.locator('.qp-model-efforts>li').count(), 20);
  await page.screenshot({ path: resolve(output, 'selection-return.png'), animations: 'disabled' });
  assert.deepEqual(faults, []); assert.deepEqual(forbidden, []);
  writeFileSync(resolve(output, 'verification.json'), JSON.stringify({ productionIndexSha256: createHash('sha256').update(readFileSync(resolve(root, 'packages/web/dist/index.html'))).digest('hex'), browser: browser.version(), rendererArgs, fixture: 'Synthetic in-memory DB and real API/SSE. Held response is a real earlier22-category API response. Only503 intentionally injected.', sameFixedScopeRefresh: true, retainedWhileHeld: true, late22CannotOverwrite23: true, retainedAfter503: true, keyboardRetryAccepts24: true, selectionABAReturnsFirstPage: true, detailRequests: requests, faults, forbidden }, null, 2));
  console.log('Model detail fixed-scope SSE, held-response race, retained503/keyboard retry and selection A-B-A passed.');
} finally { releaseHeld?.(); await browser?.close(); await server.close(); db.close(); }
