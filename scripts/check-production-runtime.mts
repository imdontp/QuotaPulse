/** Production assets + authenticated HTTP, synthetic SQLite only; no installed tray. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { openDb } from '../packages/daemon/src/db/index.js';
import { buildServer } from '../packages/daemon/src/api/server.js';
import { Scheduler } from '../packages/daemon/src/ingest/scheduler.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const output = resolve(root, process.env.QP_RUNTIME_OUTPUT ?? 'screens/production-runtime');
const webRoot = resolve(root, process.env.QP_RUNTIME_WEB_ROOT ?? 'packages/web/dist');
mkdirSync(output, { recursive: true });
const db = openDb(':memory:');
const now = Date.now();
db.exec(`INSERT INTO source(id,harness,profile,root_path,display_name,detected_at)
  VALUES (1,'codex','synthetic','/synthetic/private-root','Runtime fixture',0);
  INSERT INTO session(id,source_id,native_session_id,project,last_seen_at)
  VALUES (1,1,'runtime-synthetic','Runtime project',${now});`);
const insert = db.prepare(`INSERT INTO usage_event(source_id,session_id,dedup_key,ts,model,provider,input_tokens,output_tokens,total_tokens,call_count,cost_usd,cost_source)
  VALUES (1,1,?,?,'gpt-test','openrouter',40,60,100,1,0.02,'computed')`);
db.transaction(() => { for (let i = 0; i < 5000; i++) insert.run(`runtime-${i}`, now - i * 100); })();
const scheduler = new Scheduler(db, [], { pollMs: 1000000, detectMs: 1000000 });
const daemon = buildServer(db, scheduler, { token: 'synthetic-runtime-test', port: 7802, webRoot });
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
try {
  await daemon.listen({ host: '127.0.0.1', port: 7802 });
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, timezoneId: 'Asia/Bangkok', reducedMotion: 'reduce' });
  await context.addInitScript(() => {
    localStorage.setItem('quotapulse-prefs', JSON.stringify({ lang: 'en', currency: 'USD', rate: 1, hiddenSubscriptions: [] }));
    localStorage.setItem('quotapulse-theme', 'dark');
  });
  const page = await context.newPage();
  const errors: string[] = [];
  const external: string[] = [];
  const writes: string[] = [];
  const responses: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => {
    if (!['GET', 'HEAD'].includes(request.method())) writes.push(`${request.method()} ${new URL(request.url()).pathname}`);
  });
  page.on('response', response => { if (response.status() >= 400) responses.push(`${response.status()} ${new URL(response.url()).pathname}`); });
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.origin !== 'http://127.0.0.1:7802') { external.push(url.origin + url.pathname); return route.abort(); }
    return route.continue();
  });
  const measurements = [];
  for (const [destination, ready] of [
    ['overview', '.qp-metrics strong'], ['live', '.qp-live-chart'],
    ['projects', '.qp-project-cards'], ['providers', '.qp-provider-grid'],
    ['models', '.qp-model-summary'], ['cost', '.qp-cost-summary'],
    ['history', '[data-testid="history-total-tokens"]'], ['alerts', '.qp-alert-summary'],
    ['settings', 'main input'],
  ]) {
    const started = performance.now();
    await page.goto(`http://127.0.0.1:7802/#${destination}`);
    const screen = page.getByTestId(`production-${destination}`);
    await screen.locator(ready).first().waitFor();
    await page.evaluate(() => document.fonts.ready);
    const readyMs = performance.now() - started;
    assert.equal(await screen.locator('main h1').count(), 1);
    if (destination === 'history') {
      const total = screen.getByTestId('history-total-tokens');
      assert.equal(await total.innerText(), '500.0k');
      assert.equal(await total.getAttribute('title'), '500,000');
      assert.equal(await total.getAttribute('aria-label'), '500000');
    }
    measurements.push({ destination, readyMs, browser: await page.evaluate(() => ({
      navigation: performance.getEntriesByType('navigation').map(entry => entry.toJSON()),
      paint: performance.getEntriesByType('paint').map(entry => entry.toJSON()),
      resources: performance.getEntriesByType('resource').filter(entry => !entry.name.includes('/api/events/stream')).map(entry => {
        const resource = entry as PerformanceResourceTiming;
        const url = new URL(resource.name);
        return { path: url.pathname, durationMs: resource.duration, transferBytes: resource.transferSize, decodedBytes: resource.decodedBodySize };
      }),
    })) });
  }
  // The API requires its token even when the built UI is being served locally.
  const unauthorized = await fetch('http://127.0.0.1:7802/api/history-summary?from=0&to=' + now);
  assert.equal(unauthorized.status, 401);
  const summaryTimings = [];
  for (let i = 0; i < 10; i++) {
    const started = performance.now();
    const response = await fetch(`http://127.0.0.1:7802/api/history-summary?from=${now - 3600000}&to=${now + 1}`, { headers: { 'X-QuotaPulse-Token': 'synthetic-runtime-test' } });
    assert.equal(response.status, 200);
    const summary = await response.json();
    assert.equal(summary.totals.records, 5000);
    assert.equal(summary.totals.tokens, 500000);
    assert.equal(JSON.stringify(summary).includes('/synthetic/private-root'), false);
    summaryTimings.push(performance.now() - started);
  }
  assert.deepEqual(errors, []);
  assert.deepEqual(responses, []);
  assert.deepEqual(external, [], 'production UI attempted external network access');
  assert.deepEqual(writes, [], 'viewing pages issued a write request');
  const assets = ['index.html', ...readdirSync(resolve(webRoot, 'assets')).filter(name => /\.(js|css|woff2)$/.test(name)).map(name => `assets/${name}`)].map(path => {
    const bytes = readFileSync(resolve(webRoot, path));
    return { path, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') };
  });
  writeFileSync(resolve(output, 'verification.json'), JSON.stringify({
    status: 'passed', browser: browser.version(), fixture: { database: 'in-memory synthetic', records: 5000, tokens: 500000 },
    build: 'production web assets served by authenticated daemon; no Vite proxy', webRoot,
    limitations: ['single local machine and one browser run', 'first document cold; later routes share browser cache', 'route ready is selector readiness, not every asynchronous detail panel', 'no comparison against prior version; no CPU improvement claim', 'not packaged Electron or installed tray verification'],
    externalRequests: external, writeRequests: writes, errors, httpErrors: responses,
    historySummaryHttpMs: summaryTimings, routes: measurements, assets,
  }, null, 2));
  console.log('Production runtime passed: nine routes, 5,000 records, authenticated summary, no external or write requests.');
} finally {
  await browser?.close();
  await daemon.close();
  db.close();
}
