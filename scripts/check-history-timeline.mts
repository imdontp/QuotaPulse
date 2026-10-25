/** Real compiled renderer + HTTP + in-memory SQLite; no customer profiles. */
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { openDb } from '../packages/daemon/src/db/index.js';
import { buildServer } from '../packages/daemon/src/api/server.js';
import { Scheduler } from '../packages/daemon/src/ingest/scheduler.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const output = resolve(root, 'screens/history-timeline');
mkdirSync(output, { recursive: true });
const hour = 3_600_000, first = Date.now() - 3 * hour;
const db = openDb(':memory:');
db.exec(`INSERT INTO source(id,harness,profile,root_path,display_name,detected_at) VALUES
  (1,'codex','test','/synthetic/nonexistent','Recent fixture',0),
  (2,'hermes','test','/synthetic/nonexistent','Old fixture',0);
  INSERT INTO session(id,source_id,native_session_id,project) VALUES
  (1,1,'recent-session','Recent project'),(2,2,'old-session','Old project');`);
const insert = db.prepare(`INSERT INTO usage_event(source_id,session_id,dedup_key,ts,model,provider,input_tokens,output_tokens,total_tokens,call_count)
  VALUES (?,?,?,?, 'gpt-test','openrouter',6,4,10,1)`);
insert.run(1,1,'first',first); insert.run(1,1,'second',first + 2 * hour); insert.run(2,2,'old',0);
const app = buildServer(db, new Scheduler(db, []), { token: 'history-timeline-test', port: 7826, webRoot: resolve(root, 'packages/web/dist') });
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
const results: object[] = [], errors: string[] = [];
try {
  await app.listen({ host: '127.0.0.1', port: 7826 });
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  for (const lang of ['en', 'th']) for (const theme of ['dark', 'light']) for (const width of [390, 1672]) {
    const context = await browser.newContext({ viewport: { width, height: 941 }, timezoneId: 'Asia/Bangkok', reducedMotion: 'reduce' });
    const page = await context.newPage(), name = `${lang}-${theme}-${width}`;
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => new URL(route.request().url()).origin === 'http://127.0.0.1:7826' ? route.continue() : route.abort());
    await page.addInitScript(({ lang, theme }) => {
      (window as any).__QUOTAPULSE_TOKEN__ = 'history-timeline-test';
      localStorage.setItem('quotapulse-prefs', JSON.stringify({ lang, currency: 'USD', rate: 1, hiddenSubscriptions: [] }));
      localStorage.setItem('quotapulse-theme', theme);
    }, { lang, theme });
    const url = 'http://127.0.0.1:7826/#history?range=all&source=1&session_id=1';
    const ready = page.waitForResponse(response => new URL(response.url()).pathname === '/api/history-summary' && response.ok());
    await page.goto(url);
    const summaryResponse = await ready;
    assert.equal(new URL(summaryResponse.url()).searchParams.get('timeline'), 'observed');
    const summary = await summaryResponse.json();
    const chart = page.getByTestId('history-timeline');
    await page.locator(`[data-axis-at="${first}"]`).waitFor();
    await page.evaluate(() => document.fonts.ready);
    assert.equal(summary.scope.from, 0);
    assert.equal(summary.timelineRange.from, first);
    assert.equal(summary.totals.records, 2);
    assert.equal(summary.bucketMs, hour);
    assert.equal(JSON.parse((await chart.getAttribute('data-scope'))!).from, 0);
    assert.equal(JSON.parse((await chart.getAttribute('data-timeline-range'))!).from, first);
    const buckets = await chart.locator('g[data-bucket-at]').evaluateAll(nodes => nodes.map(node => ({
      at: Number(node.getAttribute('data-bucket-at')), input: Number(node.getAttribute('data-input')), output: Number(node.getAttribute('data-output')),
    })));
    assert.ok(buckets.length >= 3 && buckets.length <= 4);
    assert.equal(buckets[0].at, first);
    assert.equal(buckets.reduce((sum, point) => sum + point.input + point.output, 0), 20);
    assert.equal(await chart.locator('svg[role=group]>polygon').count(), 2, 'multiple buckets retain both series areas');
    const plot = chart.locator('svg[role=group]');
    await plot.scrollIntoViewIfNeeded();
    // Complete the programmatic scroll/ResizeObserver work before testing focus;
    // scrolling intentionally dismisses chart tooltips in the real UI.
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    await plot.focus(); await page.keyboard.press('Home');
    assert.equal(await chart.locator('[role=status]').getAttribute('data-bucket-at'), String(first));
    assert.deepEqual(await chart.locator('[role=status] dd').evaluateAll(nodes => nodes.map(node => Number(node.getAttribute('data-value')))), [6,4]);
    await page.keyboard.press('End');
    assert.equal(await chart.locator('[role=status]').getAttribute('data-bucket-at'), String(buckets.at(-1)!.at));
    await page.keyboard.press('Escape'); assert.equal(await chart.locator('[role=status]').count(), 0);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.locator('h1').click(); await page.screenshot({ path: resolve(output, name + '.png'), animations: 'disabled' });
    const singleFrom = first + 2 * hour - 100, singleTo = first + 2 * hour + 1000;
    await page.goto(`http://127.0.0.1:7826/#history?range=custom&from=${singleFrom}&to=${singleTo}&source=1&session_id=1`);
    await chart.locator('[data-testid=history-total-tokens][aria-label="10"]').waitFor();
    assert.equal(await chart.locator('g[data-bucket-at]').count(), 1);
    assert.equal(await chart.locator('svg[role=group]>polygon').count(), 0, 'a single bucket must not paint a declining triangle across unobserved time');
    assert.equal(await chart.locator('g[data-bucket-at]>circle').count(), 2, 'both observed series points remain visible');
    await plot.scrollIntoViewIfNeeded();
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    await plot.focus(); await page.keyboard.press('Home');
    assert.equal(await chart.locator('[role=status]').getAttribute('data-bucket-at'), String(singleFrom));
    assert.deepEqual(await chart.locator('[role=status] dd').evaluateAll(nodes => nodes.map(node => Number(node.getAttribute('data-value')))), [6,4]);
    await page.keyboard.press('Escape');
    await page.screenshot({ path: resolve(output, name + '-single.png'), animations: 'disabled' });
    const empty = page.waitForResponse(response => new URL(response.url()).pathname === '/api/history-summary' && new URL(response.url()).searchParams.get('project') === 'missing' && response.ok());
    await page.goto(url + '&project=missing');
    const emptyData = await (await empty).json();
    await chart.locator('[data-testid=history-total-tokens][aria-label="0"]').waitFor();
    assert.deepEqual(emptyData.timelineRange, { from: emptyData.scope.to, to: emptyData.scope.to });
    assert.equal(await chart.locator('[data-axis-at]').count(), 0);
    assert.equal(await chart.locator('g[data-bucket-at]').count(), 0);
    assert.equal(await chart.locator('svg[role=group]>polygon').count(), 0);
    assert.equal(await chart.locator('svg[role=group]').getAttribute('tabindex'), '-1');
    results.push({ name, scope: summary.scope, timelineRange: summary.timelineRange, buckets, tokens: 20, keyboard: true, singleBucket: true, singleBucketKeyboard: true, empty: true });
    await context.close();
  }
  assert.deepEqual(errors, []);
  writeFileSync(resolve(output, 'verification.json'), JSON.stringify({ productionIndexSha256: createHash('sha256').update(readFileSync(resolve(root, 'packages/web/dist/index.html'))).digest('hex'), cases: results, errors }, null, 2));
  console.log(`PASS ${results.length} compiled History extent/keyboard/empty cases`);
} finally { await browser?.close(); await app.close(); db.close(); }
