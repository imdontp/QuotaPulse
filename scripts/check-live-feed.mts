/** Compiled feed correctness: real API grain, exact identities/tokens and narrow keyboard access. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import { openDb } from '../packages/daemon/src/db/index.js';
import { buildServer } from '../packages/daemon/src/api/server.js';
import { Scheduler } from '../packages/daemon/src/ingest/scheduler.js';
import type { UsageEventsResponse } from '../packages/web/src/lib/usage-events.js';
import { en } from '../packages/web/src/i18n/en.js';
import { th } from '../packages/web/src/i18n/th.js';
import { installBrowserFixedDate } from './browser-fixed-date.mjs';

const output = resolve('tmp/live-feed113-browser');
mkdirSync(output, { recursive: true }); rmSync(resolve(output, 'verification.json'), { force: true });
const now = Date.now();
const db = openDb(':memory:');
const longHarness = 'future-reader-' + 'ข้อมูลเครื่องมือ長い名前'.repeat(12);
const longModel = 'Actual recorded model ' + 'ชื่อยาว長い名前'.repeat(15);
const source = db.prepare('INSERT INTO source(id,harness,profile,root_path,display_name,detected_at) VALUES (?, ?, ?, ?, ?, ?)');
for (const [id, harness] of [[1, 'codex'], [2, 'hermes'], [3, longHarness], [4, 'claude-code']] as const)
  source.run(id, harness, 'synthetic', '/synthetic/nonexistent', `Feed fixture ${id}`, now);
const session = db.prepare('INSERT INTO session(id,source_id,native_session_id,project,last_seen_at) VALUES (?, ?, ?, ?, ?)');
for (let id = 1; id <= 4; id++) session.run(id, id, `feed-session-${id}`, 'Feed project', now - 1000);
const add = db.prepare('INSERT INTO usage_event(source_id,session_id,dedup_key,ts,model,provider,total_tokens,call_count,cost_source) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)');
add.run(1, 1, 'feed-call', now - 3000, longModel, 'recorded-gateway', 123456789012345, 'unknown');
add.run(2, 2, 'feed-aggregate', now - 2000, '', '', 0, 'unknown');
add.run(3, 3, 'feed-unknown', now - 1000, null, null, 7, 'unknown');
add.run(4, 4, 'feed-known-vendor', now - 4000, 'claude-3-7-sonnet', 'openrouter', 42, 'unknown');
const scheduler = new Scheduler(db, [], { pollMs: 1_000_000, detectMs: 1_000_000 });
const daemon = buildServer(db, scheduler, { token: 'synthetic-live-feed', port: 7816, webRoot: resolve('packages/web/dist') });
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
const errors: string[] = [], forbidden: string[] = [], cases: unknown[] = [];
try {
  await daemon.listen({ host: '127.0.0.1', port: 7816 });
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  for (const lang of ['en', 'th'] as const) for (const theme of ['dark', 'light']) for (const width of [390, 1672]) {
    const messages = lang === 'th' ? th : en;
    const context = await browser.newContext({ viewport: { width, height: 941 }, locale: lang, timezoneId: 'Asia/Bangkok', reducedMotion: 'reduce' });
    const page = await context.newPage(); page.setDefaultTimeout(10000);
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => {
      const request = route.request(), url = new URL(request.url());
      if (url.origin !== 'http://127.0.0.1:7816' || url.pathname.startsWith('/api/') && request.method() !== 'GET') {
        forbidden.push(request.method() + ' ' + url.pathname); return route.abort();
      }
      return route.continue();
    });
    await page.addInitScript(({ lang, theme }) => {
      (window as any).__QUOTAPULSE_TOKEN__ = 'synthetic-live-feed';
      localStorage.setItem('quotapulse-theme', theme);
      localStorage.setItem('quotapulse-prefs', JSON.stringify({ lang, currency: 'USD', rate: 1, hiddenSubscriptions: [] }));
    }, { lang, theme });
    await installBrowserFixedDate(page, now);
    await page.goto('http://127.0.0.1:7816/#live');
    const records = page.locator('.qp-live-feed li'); await records.last().waitFor();
    const response = await daemon.inject({ method: 'GET', url: `/api/usage-events?from=${now - 30 * 60_000}&to=${now + 1}&limit=8&offset=0`, headers: { 'x-quotapulse-token': 'synthetic-live-feed' } });
    assert.equal(response.statusCode, 200);
    const rows = response.json<UsageEventsResponse>().rows;
    assert.deepEqual(rows.map(row => row.grain), ['unknown', 'session_aggregate', 'call', 'call']);
    assert.equal(await records.count(), 4);
    const format = new Intl.NumberFormat(lang === 'th' ? 'th-TH' : 'en-US');
    for (const [index, row] of rows.entries()) {
      const record = records.nth(index);
      assert.equal(await record.getAttribute('data-grain'), row.grain);
      assert.equal(await record.locator('time').getAttribute('datetime'), new Date(row.timestamp_ms).toISOString());
      const kind = messages[row.grain === 'call' ? 'redesign.callRecord' : row.grain === 'session_aggregate' ? 'redesign.aggregateUpdate' : 'history.unknown'];
      assert.equal(await record.locator('.qp-live-feed-kind>span').textContent(), kind);
      assert.deepEqual(await record.locator('.qp-live-feed-identity>span:last-child').allTextContents(), [row.harness, row.provider ?? messages['redesign.unknownValue']]);
      assert.equal(await record.locator('.qp-live-feed-model>span').textContent(), row.model ?? messages['redesign.unknownValue']);
      assert.equal(await record.locator('.qp-live-feed-model').getAttribute('title'), row.model ?? messages['redesign.unknownValue']);
      assert.equal(await record.locator('.qp-live-feed-model').getAttribute('data-vendor'), row.vendor);
      assert.equal(await record.locator('.qp-live-feed-model>i').count(), row.model && row.vendor !== 'unknown' ? 1 : 0);
      if (row.model && row.vendor !== 'unknown') assert.equal(await record.locator('.qp-live-feed-model>i').getAttribute('aria-hidden'), 'true');
      assert.equal(await record.locator('strong').textContent(), format.format(row.total_tokens));
    }
    assert.equal(rows[3]!.vendor, 'anthropic', 'Model maker is distinct from the openrouter route');
    assert.equal(rows[3]!.provider, 'openrouter');
    const harnesses = page.locator('.qp-live-session-harness');
    await harnesses.first().waitFor();
    assert.deepEqual(new Set(await harnesses.evaluateAll(nodes => nodes.map(node => node.getAttribute('data-harness')))), new Set(['codex', 'hermes', 'claude-code', longHarness]));
    for (const harness of await harnesses.all()) assert.equal(await harness.locator('span:last-child').textContent(), await harness.getAttribute('data-harness'));
    if (theme === 'dark') {
      const colors = await harnesses.evaluateAll(nodes => nodes.map(node => ({ harness: node.getAttribute('data-harness'), color: getComputedStyle(node).color })));
      assert.equal(new Set(colors.map(row => row.color)).size, 4, 'Known harnesses are distinguishable and unknown retains its neutral color');
    }
    assert.equal(await records.first().locator('.qp-live-feed-kind svg').getAttribute('aria-hidden'), 'true');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'Feed never expands the page horizontally');
    const feed = page.locator('.qp-live-feed'); await feed.scrollIntoViewIfNeeded(); await feed.focus();
    if (width === 390) {
      const frame = await feed.evaluate(element => ({ width: element.clientWidth, scrollWidth: element.scrollWidth }));
      assert.ok(frame.scrollWidth > frame.width, 'Narrow feed preserves full columns inside its scroll region');
      for (let step = 0; step < 12; step++) await page.keyboard.press('ArrowRight');
      await page.waitForFunction(() => document.querySelector('.qp-live-feed')!.scrollLeft > 0);
    }
    await page.screenshot({ path: resolve(output, `${lang}-${theme}-${width}.png`) });
    cases.push({ lang, theme, width, grains: rows.map(row => row.grain), exactNullEmptyAndLongIdentities: true, exactLargeAndZeroTokens: true, keyboardNarrowScroll: width === 390 });
    await context.close();
  }
  assert.deepEqual(errors, []); assert.deepEqual(forbidden, []);
  writeFileSync(resolve(output, 'verification.json'), JSON.stringify({ browser: browser.version(), productionIndexSha256: createHash('sha256').update(readFileSync('packages/web/dist/index.html')).digest('hex'), fixture: 'isolated real API, in-memory synthetic records; readers off', cases, errors, forbidden }, null, 2));
  console.log(`Live feed API/grain/identity/keyboard regression passed: ${cases.length} native browser cases.`);
} finally { await browser?.close(); await daemon.close(); db.close(); }
