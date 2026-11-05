/** Exercise an actual quota reader switch while its history request is delayed. */
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import { openDb } from '../packages/daemon/src/db/index.js';
import { Scheduler } from '../packages/daemon/src/ingest/scheduler.js';
import { buildServer } from '../packages/daemon/src/api/server.js';
import { en } from '../packages/web/src/i18n/en.js';
import { th } from '../packages/web/src/i18n/th.js';

const language = process.env.CHECK_LANG === 'th' ? 'th' : 'en';
const theme = process.env.CHECK_THEME === 'light' ? 'light' : 'dark';
const width = process.env.CHECK_WIDTH === '390' ? 390 : 1440;
const messages = language === 'en' ? en : th;
const db = openDb(':memory:'), now = Date.now(), resetAt = now + 4 * 3_600_000;
db.exec(`INSERT INTO source(id,harness,profile,root_path,display_name,detected_at,account_key,account_provider,account_display_name,account_state,account_last_success_at)
VALUES (1,'codex','first','/synthetic/first','First reader',0,'fixture:owner','openai','Fixture owner','active',${now}),
(2,'codex','second','/synthetic/second','Second reader',0,'fixture:owner','openai','Fixture owner','active',${now});`);
const sample = db.prepare(`INSERT INTO limit_sample(source_id,window_kind,used_percent,resets_at,observed_at,last_seen_at,source_fetched_at,origin)
VALUES (?,'5h',?,?,?,?,?,'fixture-reader')`);
for (const [index, value] of [60, 70, 80].entries()) { const at = now - 30_000 + index * 10_000; sample.run(1, value, resetAt, at, at, at); }
for (const [index, value] of [91, 94, 97].entries()) { const at = now - 300_000 + index * 10_000; sample.run(2, value, resetAt, at, at, at); }
const scheduler = new Scheduler(db, []);
const daemon = buildServer(db, scheduler, { token: 'reader-swap', port: 0, webRoot: resolve('packages/web/dist') });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
let release!: () => void, gate: Promise<void>;
const resetGate = () => { gate = new Promise<void>(resolveGate => { release = resolveGate; }); };
resetGate();
try {
  await daemon.listen({ host: '127.0.0.1', port: 0 });
  const address = daemon.server.address(); assert.ok(address && typeof address !== 'string');
  const base = `http://127.0.0.1:${address.port}`;
  const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  const errors: string[] = [], forbidden: string[] = [];
  let holdHistory = false, failHistory = false, blockedRequests = 0;
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url());
    if (url.origin !== base || !['GET', 'HEAD'].includes(request.method())) { forbidden.push(`${request.method()} ${url.origin}${url.pathname}`); return route.abort(); }
    if (holdHistory && url.pathname === '/api/quota-history') {
      blockedRequests++; const fail = failHistory; await gate;
      if (fail) return route.fulfill({ status: 503, json: { error: 'synthetic history failure' } });
    }
    return route.continue();
  });
  await page.addInitScript(({ language, theme }) => {
    (window as any).__QUOTAPULSE_TOKEN__ = 'reader-swap';
    localStorage.setItem('quotapulse-prefs', JSON.stringify({ lang: language, currency: 'USD', rate: 1, hiddenSubscriptions: [] }));
    localStorage.setItem('quotapulse-theme', theme);
  }, { language, theme });
  try {
    await page.goto(`${base}/#alerts?owner=fixture%3Aowner&window=5h`);
    const screen = page.getByTestId('production-alerts');
    const chart = screen.locator('.qp-alert-chart');
    await chart.locator('.qp-quota-point').nth(2).waitFor();
    assert.deepEqual(await chart.locator('.qp-quota-point').evaluateAll(nodes => nodes.map(node => Number(node.getAttribute('data-value')))), [60, 70, 80]);
    await screen.locator('.qp-alert-risk-value strong').getByText('80%', { exact: true }).waitFor();
    const before = await daemon.inject({ method: 'GET', url: '/api/quota-history?subscription_key=fixture%3Aowner&window_kind=5h', headers: { 'x-quotapulse-token': 'reader-swap' } });
    assert.equal(before.json().reader.sourceId, 1);
    holdHistory = true;
    const at = Date.now() - 10;
    sample.run(2, 97, resetAt, at, at, at);
    const after = await daemon.inject({ method: 'GET', url: '/api/quota-history?subscription_key=fixture%3Aowner&window_kind=5h', headers: { 'x-quotapulse-token': 'reader-swap' } });
    assert.equal(after.json().reader.sourceId, 2);
    scheduler.emit('data', { newEvents: 0, newLimits: 1, durationMs: 0, trigger: 'synthetic-reader-switch', results: [] });
    await screen.locator('.qp-alert-risk-value strong').getByText('97%', { exact: true }).waitFor({ timeout: 20000 });
    await page.waitForFunction(() => !!document.querySelector('.qp-alert-risk-value strong'));
    const oldValues = await chart.locator('.qp-quota-point').evaluateAll(nodes => nodes.map(node => Number(node.getAttribute('data-value'))));
    const oldSpark = await screen.locator('.qp-alert-risk-spark svg').count();
    console.log(JSON.stringify({ language, theme, width, blockedRequests, oldValues, oldSpark, newReading: '97%' }));
    assert.ok(blockedRequests > 0, 'new history request must be held');
    assert.deepEqual(oldValues, [], 'old reader history must not appear under the new selected reading');
    assert.equal(oldSpark, 0, 'risk row must not retain the old reader sparkline');
    await chart.getByText(messages['redesign.alertReaderChanged'], { exact: true }).waitFor();
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    release(); holdHistory = false;
    await page.waitForFunction(() => [...document.querySelectorAll('.qp-alert-chart .qp-quota-point')].some(node => node.getAttribute('data-value') === '97'));
    assert.deepEqual(await chart.locator('.qp-quota-point').evaluateAll(nodes => nodes.map(node => Number(node.getAttribute('data-value')))), [91, 94, 97, 97]);

    // Change back to the first reader, reject its history request, then retry it.
    resetGate(); blockedRequests = 0; holdHistory = true; failHistory = true;
    const secondAt = Date.now() - 1;
    sample.run(1, 99, resetAt, secondAt, secondAt, secondAt);
    scheduler.emit('data', { newEvents: 0, newLimits: 1, durationMs: 0, trigger: 'synthetic-reader-switch-back', results: [] });
    await screen.locator('.qp-alert-risk-value strong').getByText('99%', { exact: true }).waitFor({ timeout: 20000 });
    await chart.getByText(messages['redesign.alertReaderChanged'], { exact: true }).waitFor();
    assert.equal(await chart.locator('.qp-quota-point').count(), 0);
    assert.equal(await screen.locator('.qp-alert-risk-spark svg').count(), 0);
    assert.ok(blockedRequests > 0);
    const failedResponse = page.waitForResponse(response => new URL(response.url()).pathname === '/api/quota-history' && response.status() === 503);
    release(); holdHistory = false; failHistory = false;
    await failedResponse;
    const unavailable = chart.locator('[data-initial-region=alert-history-chart][data-initial-state=error]');
    await unavailable.getByText(messages['app.couldNotLoad'], { exact: true }).waitFor();
    await unavailable.getByRole('button', { name: messages['app.retry'], exact: true }).waitFor();
    await unavailable.getByRole('button', { name: messages['app.retry'], exact: true }).click();
    await page.waitForFunction(() => [...document.querySelectorAll('.qp-alert-chart .qp-quota-point')].some(node => node.getAttribute('data-value') === '99'));
    assert.deepEqual(await chart.locator('.qp-quota-point').evaluateAll(nodes => nodes.map(node => Number(node.getAttribute('data-value')))), [60, 70, 80, 99]);
    assert.deepEqual(errors, []); assert.deepEqual(forbidden, []);
    console.log('Alert reader swap: stale graph withheld; failure and retry restored the selected reader');
  } finally { release(); await context.close(); }
} finally { release(); await browser.close(); await daemon.close(); db.close(); }
