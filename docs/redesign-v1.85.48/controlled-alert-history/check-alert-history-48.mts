/** Controlled browser races against the owned fixture; not backend/source acceptance. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import type { Overview, QuotaHistoryResponse } from '../packages/web/src/api';
import { en } from '../packages/web/src/i18n/en';

const root = fileURLToPath(new URL('..', import.meta.url));
const output = resolve(root, 'screens/alert-history-48');
mkdirSync(output, { recursive: true });
const origin = 'http://127.0.0.1:7804', token = 'stable-capture-test';
const sha = (bytes: Buffer | string) => createHash('sha256').update(bytes).digest('hex');
const baselineResponse = await fetch(`${origin}/api/overview`, { headers: { 'x-quotapulse-token': token } });
assert.equal(baselineResponse.status, 200);
const baseline = await baselineResponse.json() as Overview;
const initialReading = baseline.limits.find(reading => reading.window_kind === 'monthly' && reading.forecast?.status === 'ready');
assert.ok(initialReading, 'Owned fixture must supply a ready monthly reading');
const owner = initialReading.subscription_key ?? initialReading.account_key ?? `source:${initialReading.source_id}`;
const windowKind = initialReading.window_kind;
const now = baseline.now;
const initialOverview = structuredClone(baseline);
initialOverview.limits = [structuredClone(initialReading)];
const nextOverview = structuredClone(initialOverview);
const nextReading = nextOverview.limits[0];
nextReading.last_seen_at = now - 10_000;
nextReading.observed_at = nextReading.last_seen_at;
nextReading.source_fetched_at = nextReading.last_seen_at;
nextReading.used_percent = 73;
nextReading.ageSeconds = 10;
nextReading.valueAgeSeconds = 10;
const fromAt = now - 2 * 86_400_000;
const rate = (73 - 46) / ((nextReading.last_seen_at - fromAt) / 3_600_000);
const projectedFullAt = nextReading.last_seen_at + (100 - 73) / rate * 3_600_000;
nextReading.forecast = { status: 'ready', samples: 300, fromAt, toAt: nextReading.last_seen_at, percentPerHour: rate, projectedFullAt };
nextReading.burn = { percentPerHour: rate, projectedFullAt, fromPercent: 46, fromAt, samples: 300 };
assert.ok(nextReading.resets_at != null && projectedFullAt < nextReading.resets_at);
let phase: 'initial' | 'new' | 'stale' | 'expired' = 'initial';
const overviewFor = () => {
  const overview = structuredClone(phase === 'initial' ? initialOverview : nextOverview);
  if (phase === 'stale') overview.now = now + 2 * 3_600_000;
  if (phase === 'expired') overview.now = nextReading.resets_at! + 1;
  return overview;
};
writeFileSync(resolve(output, 'controlled-overviews.json'), JSON.stringify({ initial: initialOverview, next: nextOverview, classification: 'Controlled frontend responses derived from actual owned fixture. No database writes.' }, null, 2));

function gate() {
  let mark!: () => void, release!: () => void;
  const started = new Promise<void>(resolve => { mark = resolve; });
  const paused = new Promise<void>(resolve => { release = resolve; });
  return { mark, release, started, paused };
}
const oldGate = gate(), nextGate = gate(), staleGate = gate();
async function waitForGate(signal: ReturnType<typeof gate>, label: string) {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try { await Promise.race([signal.started, new Promise<never>((_, reject) => { timeout = setTimeout(() => reject(new Error(`${label} not requested in15s`)), 15_000); })]); }
  finally { clearTimeout(timeout); }
}
let actualOldHistory: QuotaHistoryResponse | undefined;
let controlledNewHistory: QuotaHistoryResponse | undefined;
let historyCalls = 0;
let staleHeld = false;
const requests: Array<{ method: string; path: string; phase: string }> = [];
const forbidden: string[] = [], browserErrors: string[] = [];
const checks: string[] = [];
const screenshots: Record<string, string> = {};
let failure: string | null = null;
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
let browserVersion: string | undefined;
let samples: unknown = [];
try {
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  browserVersion = browser.version();
  const page = await browser.newPage({ viewport: { width: 1672, height: 941 }, reducedMotion: 'reduce', timezoneId: 'Asia/Bangkok' });
  page.on('pageerror', error => browserErrors.push(error.message));
  await page.addInitScript(token => {
    (window as unknown as { __QUOTAPULSE_TOKEN__: string }).__QUOTAPULSE_TOKEN__ = token;
    localStorage.setItem('quotapulse-prefs', JSON.stringify({ lang: 'en', currency: 'USD', rate: 1, hiddenSubscriptions: [] }));
    localStorage.setItem('quotapulse-theme', 'dark');
  }, token);
  await page.clock.setFixedTime(now);
  await page.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url());
    if (url.origin !== origin || request.method() !== 'GET') { forbidden.push(`${request.method()} ${request.url()}`); await route.abort(); return; }
    if (url.pathname.startsWith('/api/')) requests.push({ method: request.method(), path: `${url.pathname}${url.search}`, phase });
    if (url.pathname === '/api/overview') { await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(overviewFor()) }); return; }
    if (url.pathname === '/api/quota-history' && url.searchParams.get('subscription_key') === owner && url.searchParams.get('window_kind') === windowKind) {
      historyCalls++;
      if (historyCalls === 1) {
        const response = await route.fetch();
        assert.equal(response.status(), 200);
        actualOldHistory = await response.json() as QuotaHistoryResponse;
        assert.equal(actualOldHistory.reader?.sourceId, initialReading.source_id);
        assert.equal(actualOldHistory.reader?.origin, initialReading.origin);
        assert.equal(actualOldHistory.reader?.lastSeenAt, initialReading.last_seen_at, 'Actual old response matches initial fixture fingerprint');
        assert.equal(actualOldHistory.reader?.resetAt, initialReading.resets_at);
        assert.equal(actualOldHistory.reader?.forecast.status, 'ready');
        controlledNewHistory = structuredClone(actualOldHistory);
        controlledNewHistory.reader = { ...actualOldHistory.reader!, observedAt: nextReading.observed_at, lastSeenAt: nextReading.last_seen_at, sourceFetchedAt: nextReading.source_fetched_at, ageSeconds: 10, freshness: 'live', forecast: nextReading.forecast! };
        controlledNewHistory.segments = [{ resetAt: nextReading.resets_at, samples: Array.from({ length: 300 }, (_, index) => { const observedAt = Math.round(fromAt + (nextReading.last_seen_at - fromAt) * index / 299); return { observedAt, lastSeenAt: observedAt, usedPercent: 46 + 27 * index / 299, resetAt: nextReading.resets_at }; }) }];
        writeFileSync(resolve(output, 'actual-old-history.json'), JSON.stringify(actualOldHistory, null, 2));
        writeFileSync(resolve(output, 'controlled-new-history.json'), JSON.stringify(controlledNewHistory, null, 2));
        oldGate.mark(); await oldGate.paused; await route.fulfill({ response }); return;
      }
      assert.ok(controlledNewHistory);
      if (historyCalls === 2) { nextGate.mark(); await nextGate.paused; }
      if (phase === 'stale' && !staleHeld) { staleHeld = true; staleGate.mark(); await staleGate.paused; }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(controlledNewHistory) }); return;
    }
    await route.continue();
  });
  const routeQuery = new URLSearchParams({ owner, window: windowKind });
  await page.goto(`${origin}/?controlled-alert-history=48#alerts?${routeQuery}`, { waitUntil: 'domcontentloaded' });
  await page.getByTestId('production-alerts').waitFor();
  await waitForGate(oldGate, 'actual old selected history');
  await page.evaluate(() => {
    (window as unknown as { __alertForecastSamples: string[] }).__alertForecastSamples = [document.querySelector('[data-testid=alert-forecast-days]')?.textContent ?? 'absent'];
    new MutationObserver(() => { (window as unknown as { __alertForecastSamples: string[] }).__alertForecastSamples.push(document.querySelector('[data-testid=alert-forecast-days]')?.textContent ?? 'absent'); }).observe(document.querySelector('.qp-alert-forecast')!, { childList: true, characterData: true, subtree: true });
  });
  phase = 'new';
  await page.evaluate(() => dispatchEvent(new Event('online')));
  await page.locator('[data-guidance=quota] p').getByText('73%', { exact: false }).waitFor();
  oldGate.release();
  await waitForGate(nextGate, 'newest queued same-owner history');
  assert.equal(await page.getByTestId('alert-forecast-days').count(), 0, 'Obsolete ready response must not publish while newest history is held');
  assert.equal(await page.locator('.qp-alert-chart').getAttribute('data-history-key'), null);
  samples = await page.evaluate(() => (window as unknown as { __alertForecastSamples: string[] }).__alertForecastSamples);
  assert.ok((samples as string[]).every(value => value === 'absent'), 'No obsolete forecast flash was observed');
  checks.push('Delayed actual old selected-A history discarded after same-owner overview fingerprint changes; no published forecast before newest queued history response');
  nextGate.release();
  await page.waitForFunction(() => document.querySelector('[data-testid=alert-forecast-days]')?.textContent === '2');
  await page.locator('.qp-alert-forecast-warning').waitFor();
  const rows = page.locator('.qp-alert-risk li[data-owner]').first();
  await rows.locator('.qp-alert-risk-spark svg').waitFor();
  assert.equal(await rows.locator('.qp-alert-risk-spark circle').count(), 256);
  assert.ok((await rows.locator('.qp-alert-risk-spark svg').getAttribute('aria-label') ?? '').includes('256 / 300'));
  checks.push('Newest coherent controlled forecast publishes2days; actual last256 of300 observed samples disclosed in row provenance');
  await page.screenshot({ path: resolve(output, 'fresh-new-history-controlled.png') });
  screenshots['fresh-new-history-controlled.png'] = sha(readFileSync(resolve(output, 'fresh-new-history-controlled.png')));
  phase = 'stale';
  await page.clock.setFixedTime(now + 2 * 3_600_000);
  await page.evaluate(() => dispatchEvent(new Event('online')));
  await waitForGate(staleGate, 'stale refresh retaining ready cache');
  await page.waitForFunction(() => document.querySelector('[data-testid=alert-forecast-days]')?.textContent === 'Unknown');
  assert.equal(await page.locator('.qp-alert-forecast-warning').count(), 0);
  assert.ok(await page.locator('.qp-alert-chart .qp-quota-point').count() > 0);
  await page.locator('.qp-alert-risk li[data-level=stale] .qp-alert-risk-spark[data-freshness=stale]').waitFor();
  assert.equal(await rows.locator('.qp-alert-risk-spark circle').count(), 256);
  assert.equal(await rows.locator('.qp-alert-risk-spark small').textContent(), en['redesign.providerStale']);
  const staleLabel = await rows.locator('.qp-alert-risk-spark svg').getAttribute('aria-label') ?? '';
  assert.ok(staleLabel.includes('stale') && staleLabel.includes(String(nextReading.source_id)) && staleLabel.includes(nextReading.origin));
  checks.push('Stale current reading invalidates a matching cached-ready forecast before replacement response: Unknown days/no warning, historical chart and row samples retained with stale provenance');
  await page.screenshot({ path: resolve(output, 'stale-cached-ready-controlled.png') });
  screenshots['stale-cached-ready-controlled.png'] = sha(readFileSync(resolve(output, 'stale-cached-ready-controlled.png')));
  staleGate.release();
  await page.waitForTimeout(100);
  phase = 'expired';
  await page.clock.setFixedTime(nextReading.resets_at! + 1);
  await page.evaluate(() => dispatchEvent(new Event('online')));
  await page.waitForFunction(text => document.querySelector('[data-guidance=reset] p')?.textContent === text, en['redesign.alertGuidanceResetUnknown']);
  assert.equal(await page.getByTestId('alert-forecast-days').textContent(), en['redesign.unknownValue']);
  assert.equal(await page.locator('.qp-alert-forecast-warning').count(), 0);
  assert.ok(await page.locator('.qp-alert-chart .qp-quota-point').count() > 0);
  assert.equal(await rows.locator('.qp-alert-risk-spark circle').count(), 256);
  assert.equal(await rows.locator('.qp-alert-risk-spark small').textContent(), en['redesign.providerStale']);
  checks.push('Current clock past reset (expired and stale) cannot revive cached-ready forecast; historic chart/row data remain available');
  await page.screenshot({ path: resolve(output, 'expired-cached-ready-controlled.png') });
  screenshots['expired-cached-ready-controlled.png'] = sha(readFileSync(resolve(output, 'expired-cached-ready-controlled.png')));
  // A separate page/context avoids leaking race handlers or advanced clocks.
  await page.close();
  const unknownOverview = structuredClone(nextOverview);
  const unknownReading = unknownOverview.limits[0];
  unknownReading.used_percent = null;
  unknownReading.forecast = { status: 'insufficient', samples: 1, fromAt, toAt: fromAt, percentPerHour: null, projectedFullAt: null };
  unknownReading.burn = null;
  const unknownHistory = structuredClone(controlledNewHistory!);
  unknownHistory.reader!.forecast = unknownReading.forecast;
  unknownHistory.segments = [{ resetAt: unknownReading.resets_at, samples: Array.from({ length: 257 }, (_, index) => { const observedAt = Math.round(fromAt + (unknownReading.last_seen_at - fromAt) * index / 256); return { observedAt, lastSeenAt: observedAt, usedPercent: index === 0 ? 50 : null, resetAt: unknownReading.resets_at }; }) }];
  writeFileSync(resolve(output, 'controlled-unknown-suffix-history.json'), JSON.stringify(unknownHistory, null, 2));
  const unknownPage = await browser.newPage({ viewport: { width: 1672, height: 941 }, reducedMotion: 'reduce', timezoneId: 'Asia/Bangkok' });
  unknownPage.on('pageerror', error => browserErrors.push(error.message));
  await unknownPage.addInitScript(token => {
    (window as unknown as { __QUOTAPULSE_TOKEN__: string }).__QUOTAPULSE_TOKEN__ = token;
    localStorage.setItem('quotapulse-prefs', JSON.stringify({ lang: 'en', currency: 'USD', rate: 1, hiddenSubscriptions: [] }));
    localStorage.setItem('quotapulse-theme', 'dark');
  }, token);
  await unknownPage.clock.setFixedTime(now);
  await unknownPage.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url());
    if (url.origin !== origin || request.method() !== 'GET') { forbidden.push(`${request.method()} ${request.url()}`); await route.abort(); return; }
    if (url.pathname.startsWith('/api/')) requests.push({ method: request.method(), path: `${url.pathname}${url.search}`, phase: 'unknown-suffix' });
    if (url.pathname === '/api/overview') { await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(unknownOverview) }); return; }
    if (url.pathname === '/api/quota-history') { await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(unknownHistory) }); return; }
    await route.continue();
  });
  await unknownPage.goto(`${origin}/?controlled-alert-history=48-unknown-suffix#alerts?${routeQuery}`, { waitUntil: 'domcontentloaded' });
  const unknownRow = unknownPage.locator('.qp-alert-risk li[data-owner]').first();
  const unknownSpark = unknownRow.locator('.qp-alert-risk-spark');
  await unknownSpark.locator('[role=img]').waitFor();
  assert.equal(await unknownSpark.locator('[role=img]').textContent(), en['redesign.unknownValue']);
  const unknownLabel = await unknownSpark.locator('[role=img]').getAttribute('aria-label') ?? '';
  assert.ok(unknownLabel.includes('256 / 257'));
  assert.ok(unknownLabel.includes(new Date(unknownHistory.segments[0].samples[1].observedAt).toISOString()));
  assert.ok(unknownLabel.includes(new Date(unknownReading.last_seen_at).toISOString()));
  assert.ok(unknownLabel.includes(String(unknownReading.source_id)) && unknownLabel.includes(unknownReading.origin));
  assert.equal(await unknownSpark.locator('circle,line,svg').count(), 0, 'Unknown suffix must not invent zero points or lines');
  assert.ok(!(await unknownSpark.textContent())?.includes(en['redesign.alertNoHistory']));
  assert.equal(await unknownRow.locator('.qp-alert-risk-value strong').textContent(), en['redesign.unknownValue']);
  assert.equal(await unknownPage.locator('.qp-alert-chart .qp-quota-point').count(), 1, 'Full historical chart retains its older known50 observation');
  assert.equal(await unknownPage.locator('.qp-alert-chart .qp-quota-point').getAttribute('data-value'), '50');
  checks.push('Unknown-only last256 suffix of257actual controlled samples remains Unknown with sample/time/source disclosure; no invented row zero points or empty-history caption; full chart retains older known50 sample');
  await unknownPage.screenshot({ path: resolve(output, 'unknown-suffix-controlled.png') });
  screenshots['unknown-suffix-controlled.png'] = sha(readFileSync(resolve(output, 'unknown-suffix-controlled.png')));
  assert.deepEqual(browserErrors, []); assert.deepEqual(forbidden, []);
} catch (error) { failure = error instanceof Error ? error.stack ?? error.message : String(error); }
finally {
  oldGate.release(); nextGate.release(); staleGate.release();
  await browser?.close();
  const report = { classification: 'Controlled frontend response/concurrency probes derived from authenticated owned fixture; not backend accuracy, live account data, canonical captures, or source likeness acceptance.', command: 'node --import tsx tmp/check-alert-history-48.mts', origin, getOnly: true, browserVersion, nodeVersion: process.version, clock: now, theme: 'dark', language: 'en', viewport: { width: 1672, height: 941 }, builtIndexSha256: sha(readFileSync(resolve(root, 'packages/web/dist/index.html'))), scriptSha256: sha(readFileSync(fileURLToPath(import.meta.url))), owner, windowKind, historyCalls, requests, checks, samplesBeforeNewestResponse: samples, browserErrors, forbidden, screenshots, failure, passed: failure === null && checks.length === 5 && !browserErrors.length && !forbidden.length };
  writeFileSync(resolve(output, 'verification.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  if (!report.passed) process.exitCode = 1;
}
