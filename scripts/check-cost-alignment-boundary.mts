/** Actual compiled Cost chart with isolated synthetic data at density boundaries. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import { installBrowserFixedDate } from './browser-fixed-date.mjs';
import { openDb } from '../packages/daemon/src/db/index.js';
import { buildServer } from '../packages/daemon/src/api/server.js';
import { Scheduler } from '../packages/daemon/src/ingest/scheduler.js';

const now = Date.parse('2025-05-17T13:42:00Z'), hour = 3_600_000, base = 'http://127.0.0.1:7839';
const root = resolve('.'), webRoot = resolve(root, 'packages/web/dist'), output = resolve(root, 'screens/cost-alignment-boundary');
mkdirSync(output, { recursive: true });
const db = openDb(':memory:');
db.exec("INSERT INTO source(id,harness,profile,root_path,display_name,detected_at) VALUES(1,'codex','fixture','/synthetic','Fixture',0); INSERT INTO session(id,source_id,native_session_id,project) VALUES(1,1,'synthetic','Fixture')");
db.prepare("INSERT INTO usage_event(source_id,session_id,dedup_key,ts,model,provider,total_tokens,call_count,cost_usd,cost_source) VALUES(1,1,'sample',?,'test-model','openai',100,1,1,'computed')").run(now - 30 * 60_000);
const app = buildServer(db, new Scheduler(db, []), { token: 'synthetic-alignment', port: 7839, webRoot });
const cases: object[] = [], errors: string[] = [], forbidden: string[] = [];
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
try {
  await app.listen({ host: '127.0.0.1', port: 7839 });
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  for (const lang of ['en', 'th'] as const) for (const theme of ['dark', 'light']) for (const width of [390, 1672]) {
    const context = await browser.newContext({ viewport: { width, height: 941 }, timezoneId: 'Asia/Bangkok', reducedMotion: 'reduce' });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => { const request = route.request(), url = new URL(request.url()); if (url.origin !== base || url.pathname.startsWith('/api/') && request.method() !== 'GET') { forbidden.push(`${request.method()} ${url.pathname}`); return route.abort(); } return route.continue(); });
    await page.addInitScript(({ lang, theme }) => { (window as any).__QUOTAPULSE_TOKEN__ = 'synthetic-alignment'; localStorage.setItem('quotapulse-prefs', JSON.stringify({ lang, currency: 'USD', rate: 1, hiddenSubscriptions: [] })); localStorage.setItem('quotapulse-theme', theme); }, { lang, theme });
    await installBrowserFixedDate(page, now);
    for (const count of [1, 2, 60, 61, 240]) {
      const ready = page.waitForResponse(response => response.url().includes('/api/cost-analysis?') && response.ok());
      await page.goto(`${base}/#cost?range=custom&from=${now - count * hour}&to=${now}&source=1&basis=api&bucket=hour`);
      const data = await (await ready).json();
      assert.equal(data.bucketMs, hour); assert.equal(data.totals.pricedCalls, 1);
      const plot = page.locator('.qp-cost-chart'); await plot.waitFor();
      await page.waitForFunction(expected => document.querySelectorAll('.qp-cost-column').length === expected, count);
      const measured = await plot.evaluate(node => {
        const svg = node.querySelector<SVGSVGElement>('.qp-cost-token-line')!, rect = svg.getBoundingClientRect();
        const bars = [...node.querySelectorAll('.qp-cost-column')], dots = [...node.querySelectorAll('.qp-cost-token-dot')];
        const points = [...svg.querySelectorAll<SVGCircleElement>('circle[data-at]')];
        const offsets = points.map((point, index) => { const box = bars[index]!.getBoundingClientRect(); return Math.abs(rect.left + Number(point.getAttribute('cx')) * rect.width / 1000 - box.left - box.width / 2); });
        return { bars: bars.length, dots: dots.length, points: points.length, maxOffset: Math.max(...offsets), overflow: document.documentElement.scrollWidth > innerWidth };
      });
      assert.equal(measured.bars, count); assert.equal(measured.points, count);
      assert.equal(measured.dots, count <= 60 ? count : 0);
      assert.ok(measured.maxOffset <= .5, `${count} buckets, ${width}px: ${measured.maxOffset}px misalignment`);
      assert.equal(measured.overflow, false);
      cases.push({ lang, theme, width, count, ...measured });
    }
    await context.close();
  }
  assert.deepEqual(errors, []); assert.deepEqual(forbidden, []); assert.equal(cases.length, 40);
  writeFileSync(resolve(output, 'verification.json'), JSON.stringify({ indexSha256: createHash('sha256').update(readFileSync(resolve(webRoot, 'index.html'))).digest('hex'), cases, errors, forbidden }, null, 2) + '\n');
  console.log('PASS 40 compiled Cost alignment and density-boundary cases.');
} finally { await browser?.close(); await app.close(); db.close(); }
