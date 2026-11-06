/** Compiled History against an isolated synthetic database, not user data. */
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { openDb } from '../packages/daemon/src/db/index.js';
import { buildServer } from '../packages/daemon/src/api/server.js';
import { Scheduler } from '../packages/daemon/src/ingest/scheduler.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const day = 86_400_000, from = Date.UTC(2025, 0, 1), token = 'history-marker-fixture';
const db = openDb(':memory:');
db.exec(`INSERT INTO source(id,harness,profile,root_path,display_name,detected_at)
  VALUES (1,'codex','fixture','/synthetic/nonexistent','Synthetic fixture',0);
  INSERT INTO session(id,source_id,native_session_id,project,last_seen_at)
  VALUES (1,1,'synthetic-session','Fixture',${from + day});`);
const insert = db.prepare(`INSERT INTO usage_event(source_id,session_id,dedup_key,ts,model,provider,
  input_tokens,cached_input_tokens,output_tokens,total_tokens,call_count,cost_source)
  VALUES (1,1,?,?,'fixture-model','fixture-provider',?,0,?,?,1,'unknown')`);
insert.run('recorded-zero', from + day + 1_000, 0, 0, 0);
insert.run('recorded-positive', from + 3 * day + 1_000, 7, 3, 10);
const scheduler = new Scheduler(db, [], { pollMs: 1_000_000, detectMs: 1_000_000 });
const daemon = buildServer(db, scheduler, { token, port: 0, webRoot: resolve(root, 'packages/web/dist') });
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
const cases: unknown[] = [];
try {
  const base = await daemon.listen({ host: '127.0.0.1', port: 0 });
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  for (const lang of ['en', 'th']) for (const theme of ['dark', 'light']) for (const width of [390, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 1000 }, reducedMotion: 'reduce', timezoneId: 'Asia/Bangkok' });
    const page = await context.newPage();
    const errors: string[] = [], forbidden: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => {
      const request = route.request(), url = new URL(request.url());
      if (url.origin !== base || (url.pathname.startsWith('/api/') && request.method() !== 'GET')) {
        forbidden.push(`${request.method()} ${url.origin}${url.pathname}`); return route.abort();
      }
      return route.continue();
    });
    await page.addInitScript(({ token, lang, theme }) => {
      (window as unknown as { __QUOTAPULSE_TOKEN__: string }).__QUOTAPULSE_TOKEN__ = token;
      localStorage.setItem('quotapulse-prefs', JSON.stringify({ lang, currency: 'USD', rate: 1, hiddenSubscriptions: [] }));
      localStorage.setItem('quotapulse-theme', theme);
    }, { token, lang, theme });
    for (const count of [36, 37]) {
      const to = from + count * day;
      const response = await daemon.inject({ method: 'GET', url: `/api/history-summary?from=${from}&to=${to}&timeline=observed`, headers: { 'x-quotapulse-token': token } });
      assert.equal(response.statusCode, 200);
      const summary = response.json();
      assert.equal(summary.bucketMs, day);
      assert.equal(summary.timeline.length, 2);
      assert.deepEqual(summary.timeline.map((row: { records: number; inputTokens: number; outputTokens: number }) => [row.records, row.inputTokens, row.outputTokens]), [[1, 0, 0], [1, 7, 3]]);
      await page.goto(`${base}/#history?range=custom&from=${from}&to=${to}`, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(({ from, to }) => {
        const value = document.querySelector('[data-testid=history-timeline]')?.getAttribute('data-scope');
        if (!value) return false;
        const scope = JSON.parse(value); return scope.from === from && scope.to === to;
      }, { from, to });
      const svg = page.locator('[data-testid=history-timeline] > svg');
      assert.equal(await svg.getAttribute('data-sampled'), String(count <= 36));
      const points = await svg.locator(':scope > g[data-bucket-at]').evaluateAll(nodes => nodes.map(node => ({
        at: Number((node as HTMLElement).dataset.bucketAt), records: Number((node as HTMLElement).dataset.records),
        input: Number((node as HTMLElement).dataset.input), output: Number((node as HTMLElement).dataset.output),
        radii: [...node.querySelectorAll('circle')].map(circle => Number.parseFloat(getComputedStyle(circle).r)),
      })));
      assert.equal(points.length, count);
      for (const [index, point] of points.entries()) {
        const api = summary.timeline.find((row: { at: number }) => row.at === from + index * day);
        assert.deepEqual([point.at, point.records, point.input, point.output], [from + index * day, api?.records ?? 0, api?.inputTokens ?? 0, api?.outputTokens ?? 0]);
        const radius = theme === 'dark' && count <= 36 && api?.records > 0 ? 3 : 2;
        assert.deepEqual(point.radii, [radius, radius]);
      }
      assert.deepEqual([points[1]!.records, points[1]!.input, points[1]!.output], [1, 0, 0], 'Recorded zero must remain distinct from an empty interval');
      assert.equal(points[0]!.records, 0);
      await svg.focus(); await page.keyboard.press('Home'); await page.keyboard.press('ArrowRight');
      const tooltip = page.locator('.qp-history-tooltip'); await tooltip.waitFor();
      assert.equal(Number(await tooltip.getAttribute('data-bucket-at')), from + day);
      assert.deepEqual(await tooltip.locator('dd').evaluateAll(nodes => nodes.map(node => Number((node as HTMLElement).dataset.value))), [0, 0]);
      assert.deepEqual(errors, []); assert.deepEqual(forbidden, []);
      cases.push({ lang, theme, width, buckets: count, recordedZero: true, empty: true, keyboard: true });
    }
    await context.close();
  }
  const output = resolve(root, 'screens/history-marker-boundaries'); mkdirSync(output, { recursive: true });
  writeFileSync(resolve(output, 'verification.json'), JSON.stringify({ status: 'passed', fixture: 'isolated in-memory synthetic usage', cases }, null, 2) + '\n');
  console.log(`History marker boundaries passed: ${cases.length} compiled-browser cases.`);
} finally { await browser?.close(); await daemon.close(); db.close(); }
