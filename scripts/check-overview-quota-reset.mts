/** Compiled Overview with an isolated synthetic quota reader and controlled history response. */
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
const messages = language === 'th' ? th : en;
const db = openDb(':memory:'), now = Date.now(), resetAt = now + 3_600_000;
db.exec(`INSERT INTO source(id,harness,profile,root_path,display_name,detected_at,account_key,account_provider,account_display_name,account_state,account_last_success_at)
  VALUES (1,'codex','fixture','/synthetic/nonexistent','Fixture reader',0,'fixture:owner','openai','Fixture owner','active',${now});`);
const sample = db.prepare(`INSERT INTO limit_sample(source_id,window_kind,used_percent,resets_at,observed_at,last_seen_at,source_fetched_at,origin)
  VALUES (1,'5h',?,?,?,?,?,'fixture-reader')`);
for (const [index, value] of [60, 70, 80].entries()) { const at = now - 30_000 + index * 10_000; sample.run(value, resetAt, at, at, at); }
const scheduler = new Scheduler(db, []);
const daemon = buildServer(db, scheduler, { token: 'overview-reset', port: 0, webRoot: resolve('packages/web/dist') });
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
  let holdHistory = false, failHistory = false, blockedRequests = 0, staleResponse: unknown = null;
  const waitForBlocked = async () => {
    const deadline = Date.now() + 10_000;
    while (!blockedRequests && Date.now() < deadline) await page.waitForTimeout(25);
    assert.ok(blockedRequests > 0, 'New history request must reach the held route');
  };
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url());
    if (url.origin !== base || !['GET', 'HEAD'].includes(request.method())) { forbidden.push(`${request.method()} ${url.origin}${url.pathname}`); return route.abort(); }
    if (holdHistory && url.pathname === '/api/quota-history') {
      blockedRequests++; const fail = failHistory; await gate;
      if (fail) return route.fulfill({ status: 503, json: { error: 'synthetic history failure' } });
    }
    if (staleResponse && url.pathname === '/api/quota-history') return route.fulfill({ status: 200, json: staleResponse });
    return route.continue();
  });
  await page.addInitScript(({ language, theme }) => {
    (window as any).__QUOTAPULSE_TOKEN__ = 'overview-reset';
    localStorage.setItem('quotapulse-prefs', JSON.stringify({ lang: language, currency: 'USD', rate: 1, hiddenSubscriptions: [] }));
    localStorage.setItem('quotapulse-theme', theme);
  }, { language, theme });
  try {
    await page.goto(`${base}/#overview`);
    const screen = page.getByTestId('production-overview'), history = screen.getByTestId('quota-history');
    await history.locator('summary').first().click();
    await history.locator('.qp-quota-point').nth(2).waitFor();
    assert.deepEqual(await history.locator('.qp-quota-point').evaluateAll(nodes => nodes.map(node => Number(node.getAttribute('data-value')))), [60, 70, 80]);
    const originalResponse = await daemon.inject({ method: 'GET', url: '/api/quota-history?subscription_key=fixture%3Aowner&window_kind=5h', headers: { 'x-quotapulse-token': 'overview-reset' } });
    assert.equal(originalResponse.statusCode, 200);
    const originalHistory = originalResponse.json();
    const newReset = resetAt + 5 * 3_600_000;
    holdHistory = true;
    const at = Date.now() - 1;
    sample.run(97, newReset, at, at, at);
    scheduler.emit('data', { newEvents: 0, newLimits: 1, durationMs: 0, trigger: 'synthetic-reset', results: [] });
    await page.waitForFunction(() => document.querySelector('.qp-pulse-label strong')?.textContent?.includes('97'), null, { timeout: 20_000 });
    await page.waitForFunction(() => document.querySelector('[data-testid=pulse-runway]')?.getAttribute('data-reset-at') !== null);
    await waitForBlocked();
    const displayed = await history.locator('.qp-quota-point').evaluateAll(nodes => nodes.map(node => Number(node.getAttribute('data-value'))));
    console.log(JSON.stringify({ language, theme, width, blockedRequests, selectedValue: 97, newReset, displayed }));
    assert.deepEqual(displayed, [], 'Previous reset history must not be presented as current during a reset switch');
    await history.getByText(messages['redesign.historyLoading'], { exact: true }).waitFor();
    release(); holdHistory = false;
    await page.waitForFunction(() => [...document.querySelectorAll('[data-testid=quota-history] .qp-quota-point')].some(node => node.getAttribute('data-value') === '97'));
    assert.deepEqual(await history.locator('.qp-quota-point').evaluateAll(nodes => nodes.map(node => Number(node.getAttribute('data-value')))), [60, 70, 80, 97]);
    assert.equal(await history.locator('.qp-alert-segments > g[data-reset]').count(), 2, 'Matching new response keeps the actual prior reset period');

    // Reset jitter within the shared tolerance remains the same period.
    resetGate(); blockedRequests = 0; holdHistory = true;
    const jitterAt = Date.now() - 1;
    sample.run(98, newReset + 1_000, jitterAt, jitterAt, jitterAt);
    scheduler.emit('data', { newEvents: 0, newLimits: 1, durationMs: 0, trigger: 'synthetic-reset-jitter', results: [] });
    await page.waitForFunction(() => document.querySelector('.qp-pulse-label strong')?.textContent?.includes('98'), null, { timeout: 20_000 });
    await waitForBlocked();
    assert.deepEqual(await history.locator('.qp-quota-point').evaluateAll(nodes => nodes.map(node => Number(node.getAttribute('data-value')))), [60, 70, 80, 97], 'Same-period history stays visible during reset jitter');
    release(); holdHistory = false;
    await page.waitForFunction(() => [...document.querySelectorAll('[data-testid=quota-history] .qp-quota-point')].some(node => node.getAttribute('data-value') === '98'));

    // A failed request after a distinct reset cannot resurrect older history.
    resetGate(); blockedRequests = 0; holdHistory = true; failHistory = true;
    const thirdAt = Date.now() - 1;
    sample.run(99, newReset + 5 * 3_600_000, thirdAt, thirdAt, thirdAt);
    scheduler.emit('data', { newEvents: 0, newLimits: 1, durationMs: 0, trigger: 'synthetic-reset-error', results: [] });
    await page.waitForFunction(() => document.querySelector('.qp-pulse-label strong')?.textContent?.includes('99'), null, { timeout: 20_000 });
    await waitForBlocked();
    assert.equal(await history.locator('.qp-quota-point').count(), 0);
    const failed = page.waitForResponse(response => new URL(response.url()).pathname === '/api/quota-history' && response.status() === 503);
    release(); holdHistory = false; failHistory = false; await failed;
    await history.getByText(messages['redesign.historyUnavailable'], { exact: true }).waitFor();
    assert.equal(await history.locator('.qp-quota-point').count(), 0);
    scheduler.emit('data', { newEvents: 0, newLimits: 0, durationMs: 0, trigger: 'synthetic-retry', results: [] });
    await page.waitForFunction(() => [...document.querySelectorAll('[data-testid=quota-history] .qp-quota-point')].some(node => node.getAttribute('data-value') === '99'), null, { timeout: 20_000 });
    assert.deepEqual(await history.locator('.qp-quota-point').evaluateAll(nodes => nodes.map(node => Number(node.getAttribute('data-value')))), [60, 70, 80, 97, 98, 99]);

    // An actual old API payload delivered late is not accepted as current.
    staleResponse = originalHistory;
    const staleReply = page.waitForResponse(response => new URL(response.url()).pathname === '/api/quota-history' && response.status() === 200);
    scheduler.emit('data', { newEvents: 0, newLimits: 0, durationMs: 0, trigger: 'synthetic-old-response', results: [] });
    await staleReply;
    await history.getByText(messages['redesign.historyUnavailable'], { exact: true }).waitFor();
    assert.equal(await history.locator('.qp-quota-point').count(), 0, 'A successful but mismatched response must not show the old reset');
    staleResponse = null;
    scheduler.emit('data', { newEvents: 0, newLimits: 0, durationMs: 0, trigger: 'synthetic-current-response', results: [] });
    await page.waitForFunction(() => [...document.querySelectorAll('[data-testid=quota-history] .qp-quota-point')].some(node => node.getAttribute('data-value') === '99'), null, { timeout: 20_000 });
    assert.deepEqual(errors, []); assert.deepEqual(forbidden, []);
    console.log('Overview quota reset: mismatch withheld, jitter retained, failures and old responses disclosed, refresh recovered all actual periods.');
  } finally { release(); await context.close(); }
} finally { release(); await browser.close(); await daemon.close(); db.close(); }
