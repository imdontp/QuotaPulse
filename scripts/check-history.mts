/** Real HTTP + in-memory SQLite E2E. Never opens the user's usage database. */
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { openDb } from '../packages/daemon/src/db/index.js';
import { buildServer } from '../packages/daemon/src/api/server.js';
import { recordQuotaAlerts } from '../packages/daemon/src/api/queries.js';
import { Scheduler } from '../packages/daemon/src/ingest/scheduler.js';
import { en as englishMessages } from '../packages/web/src/i18n/en.ts';
import { th as thaiMessages } from '../packages/web/src/i18n/th.ts';
import { checkAlertsLayout } from './check-alerts-layout.mts';

const root = fileURLToPath(new URL('..', import.meta.url));
const output = resolve(root, 'screens/history');
mkdirSync(output, { recursive: true });
const db = openDb(':memory:');
const now = Date.now();
db.exec(`INSERT INTO source(id,harness,profile,root_path,display_name,detected_at) VALUES
  (1,'codex','test','/synthetic/nonexistent','Codex test',0), (2,'hermes','test','/synthetic/nonexistent','Hermes test',0);
  INSERT INTO session(id,source_id,native_session_id,project,last_seen_at) VALUES (1,1,'synthetic-session','alpha_100%',${now - 1000}), (2,2,'aggregate-session',NULL,NULL);`);
db.prepare(`UPDATE source SET account_key='openai:subscription', account_provider='openai',
  account_display_name='OpenAI Test Subscription', account_state='active', account_last_success_at=? WHERE id=1`).run(now - 15000);
db.prepare(`INSERT INTO limit_sample(source_id,window_kind,used_percent,resets_at,observed_at,last_seen_at,source_fetched_at,origin)
  VALUES (1,'5h',38,?,?,?,?,?)`).run(now + 7200000, now - 15000, now - 15000, now - 15000, 'live-synthetic');
for (const [used, observed, reset] of [[80, now - 10800000, now - 7200000], [10, now - 2400000, now + 7200000], [20, now - 1200000, now + 7200000]]) {
  db.prepare(`INSERT INTO limit_sample(source_id,window_kind,used_percent,resets_at,observed_at,last_seen_at,source_fetched_at,origin)
    VALUES (1,'5h',?,?,?,?,?,?)`).run(used, reset, observed, observed, observed, 'live-synthetic');
}
db.prepare(`INSERT INTO limit_sample(source_id,window_kind,used_percent,resets_at,observed_at,last_seen_at,source_fetched_at,origin)
  VALUES (1,'5h',92,?,?,?,?,?)`).run(now + 7200000, now - 7200000, now - 7200000, now - 7200000, 'old-fallback');
const insert = db.prepare(`INSERT INTO usage_event(source_id,session_id,dedup_key,ts,model,provider,total_tokens,call_count,cost_usd,cost_source)
  VALUES (?,?,?,?,?,?,?,1,0.2,'computed')`);
db.transaction(() => {
  for (let i = 0; i < 52; i++) insert.run(1, 1, `test-${i}`, now - 1000 - i, 'gpt-test', 'openrouter', 100 + i);
  insert.run(2, 2, 'aggregate', now - 2000, 'claude-test', 'anthropic', 999);
})();
db.prepare(`UPDATE usage_event SET input_tokens=40,cached_input_tokens=20,
  output_tokens=total_tokens-60,cost_cache_saving_usd=0.03 WHERE source_id=1`).run();
db.prepare(`UPDATE usage_event SET cache_write_tokens=7,duration_ms=1234,service_tier='test-tier',price_provider='anthropic' WHERE id=53`).run();
db.prepare(`UPDATE session SET is_subagent=1 WHERE id=2`).run();
const scheduler = new Scheduler(db, [], { pollMs: 1000000, detectMs: 1000000 });
const daemon = buildServer(db, scheduler, { token: 'history-test', port: 7800, webRoot: resolve(root, 'packages/web/dist') });
const vite = await createServer({ root: resolve(root, 'packages/web'), server: { host: '127.0.0.1', port: 7801, strictPort: true, proxy: { '/api': { target: 'http://127.0.0.1:7800', changeOrigin: true, configure: proxy => {
  // Vite installs response-close cleanup only after upstream headers arrive.
  // StrictMode/reload can cancel SSE before that point; bind cleanup earlier.
  proxy.on('proxyReq', (upstream, request, response) => {
    if (!request.url?.startsWith('/api/events/stream')) return;
    response.once('close', () => upstream.destroy());
    if (response.destroyed) upstream.destroy();
  });
} } } } });
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
try {
  await daemon.listen({ host: '127.0.0.1', port: 7800 });
  await vite.listen();
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce', deviceScaleFactor: 1, timezoneId: 'Asia/Bangkok', permissions: ['clipboard-read', 'clipboard-write'] });
  await page.addInitScript(() => { (window as unknown as { __QUOTAPULSE_TOKEN__: string }).__QUOTAPULSE_TOKEN__ = 'history-test'; });
  await page.addInitScript(() => {
    const Original = window.EventSource;
    const state = { opened: 0, closed: 0 };
    (window as unknown as { __streamCounts: typeof state }).__streamCounts = state;
    window.EventSource = class extends Original {
      constructor(url: string | URL, options?: EventSourceInit) { super(url, options); state.opened++; }
      close() { state.closed++; super.close(); }
    };
  });
  const errors: string[] = [];
  const requests: string[] = [];
  const liveRequests: string[] = [];
  const modelRequests: string[] = [];
  const costRequests: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (request.url().includes('/api/usage-events')) requests.push(request.url()); if (request.url().includes('/api/live-sessions')) liveRequests.push(request.url()); if (request.url().includes('/api/models?detailed=1')) modelRequests.push(request.url()); if (request.url().includes('/api/cost-analysis?')) costRequests.push(request.url()); });
  await page.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
  await page.goto('http://127.0.0.1:7801/#history?range=all');
  const history = page.getByTestId('usage-history');
  await history.getByText('1–50 of 53 records', { exact: true }).waitFor();
  await history.getByTestId('history-total-tokens').getByText('7,525', { exact: true }).waitFor();
  await page.getByRole('dialog').waitFor();
  await page.keyboard.press('Escape');
  await page.getByRole('dialog').waitFor({ state: 'hidden' });
  await history.getByRole('button', { name: 'Next page', exact: true }).click();
  await history.getByText('51–53 of 53 records', { exact: true }).waitFor();
  assert.equal(await history.getByTestId('history-total-tokens').innerText(), '7,525', 'timeline total changed with pagination');
  await history.getByRole('button', { name: 'Record details 53', exact: true }).click();
  await page.getByRole('dialog').waitFor();
  assert.match(await page.getByRole('dialog').innerText(), /Session aggregate|session_aggregate/);
  for (const name of ['Event summary', 'Token breakdown', 'Pricing source', 'Runtime metadata', 'Related records and metadata']) {
    await page.getByRole('dialog').getByRole('heading', { name, exact: true }).waitFor();
  }
  await page.getByRole('dialog').getByText('Cache write', { exact: true }).waitFor();
  await page.getByRole('dialog').getByText('Subagent', { exact: true }).waitFor();
  assert.match(await page.getByRole('dialog').getByRole('region', { name: 'Token breakdown' }).innerText(), /Cache write\s+7/);
  assert.match(await page.getByRole('dialog').getByRole('region', { name: 'Runtime metadata' }).innerText(), /Subagent\s+Yes/);
  assert.match(await page.getByRole('dialog').getByRole('region', { name: 'Runtime metadata' }).innerText(), /1,234 ms/);
  const openTheme = await page.getByTestId('production-history').getAttribute('data-theme');
  await page.screenshot({ path: resolve(output, `history-detail-open-en-${openTheme}-1440.png`) });
  await page.getByRole('dialog').getByRole('button', { name: 'Copy safe metadata', exact: true }).click();
  await page.getByRole('dialog').getByText('Metadata copied', { exact: true }).waitFor();
  const copied = JSON.parse(await page.evaluate(() => navigator.clipboard.readText()));
  assert.equal(copied.event_id, 53);
  for (const field of ['root_path', 'cwd', 'native_session_id', 'request_id', 'dedup_key']) assert.equal(field in copied, false);
  const relatedParams = new URLSearchParams((await page.getByRole('dialog').getByRole('link', { name: 'Open related session records' }).getAttribute('href'))!.split('?')[1]);
  assert.equal(relatedParams.get('session_id'), '2');
  const detailTheme = await page.getByTestId('production-history').getAttribute('data-theme');
  await page.screenshot({ path: resolve(output, `history-detail-en-${detailTheme}-1440.png`) });
  await page.keyboard.press('Escape');
  assert.equal(await history.getByRole('button', { name: 'Record details 53', exact: true }).evaluate(element => element === document.activeElement), true);
  await history.getByRole('button', { name: 'Pause view', exact: true }).click();
  assert.equal(await history.getByRole('button', { name: 'Export matching records', exact: true }).isDisabled(), true);
  const atPause = requests.length;
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await page.waitForTimeout(1600);
  assert.equal(requests.length, atPause, 'paused view queried usage records');
  assert.equal(await history.getByRole('button', { name: 'Apply filters', exact: true }).isDisabled(), true);
  await history.getByRole('button', { name: 'Resume latest', exact: true }).click();
  await history.getByText('1–50 of 53 records', { exact: true }).waitFor();
  await history.getByLabel('Search metadata', { exact: true }).fill('%');
  await history.getByRole('button', { name: 'Apply filters', exact: true }).click();
  await history.getByText('1–50 of 52 records', { exact: true }).waitFor();
  const downloading = page.waitForEvent('download');
  await history.getByRole('button', { name: 'Export matching records', exact: true }).click();
  const download = await downloading;
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  const csv = Buffer.concat(chunks).toString('utf8');
  assert.equal(csv.trimEnd().split('\r\n').length, 53, 'export truncated to loaded page');
  assert.match(csv.split('\r\n')[0]!, /,grain$/);
  await history.getByLabel('Search metadata', { exact: true }).fill('nothing-matches');
  await history.getByRole('button', { name: 'Apply filters', exact: true }).click();
  await history.getByText('No matching usage records', { exact: true }).waitFor();
  await history.getByLabel('Search metadata', { exact: true }).fill('');
  await history.getByLabel('Unassigned projects only', { exact: true }).check();
  await history.getByRole('button', { name: 'Apply filters', exact: true }).click();
  await history.getByText('1–1 of 1 records', { exact: true }).waitFor();
  await history.getByText('Session aggregate', { exact: true }).last().waitFor();
  // Hold a real request across Pause: its late result must not replace the frozen rows.
  let release!: () => void;
  let entered!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  const requested = new Promise<void>(resolve => { entered = resolve; });
  let holdOnce = true;
  await page.route('**/api/usage-events?**', async route => {
    const q = new URL(route.request().url()).searchParams.get('q');
    if (q === 'synthetic-error') return route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"synthetic failure"}' });
    if (holdOnce && q === 'alpha') { holdOnce = false; entered(); await held; }
    return route.continue();
  });
  await history.getByLabel('Unassigned projects only', { exact: true }).uncheck();
  await history.getByLabel('Search metadata', { exact: true }).fill('alpha');
  await history.getByRole('button', { name: 'Apply filters', exact: true }).click();
  await requested;
  await history.getByRole('button', { name: 'Pause view', exact: true }).click();
  const response = page.waitForResponse(res => res.url().includes('/api/usage-events') && res.url().includes('q=alpha'));
  release();
  await response;
  await page.waitForTimeout(150);
  await history.getByText('1–1 of 1 records', { exact: true }).waitFor();
  await history.getByRole('button', { name: 'Resume latest', exact: true }).click();
  await history.getByText('1–50 of 52 records', { exact: true }).waitFor();
  await history.getByLabel('Search metadata', { exact: true }).fill('synthetic-error');
  await history.getByRole('button', { name: 'Apply filters', exact: true }).click();
  await history.getByText('Showing the last successful snapshot.', { exact: false }).waitFor();
  assert.equal(await history.getByRole('button', { name: 'Export matching records', exact: true }).isDisabled(), true);
  await history.getByLabel('Search metadata', { exact: true }).fill('');
  await history.getByRole('button', { name: 'Apply filters', exact: true }).click();
  await history.getByText('1–50 of 53 records', { exact: true }).waitFor();
  for (const width of [390, 900, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `overflow at ${width}`);
    await page.screenshot({ path: resolve(output, `history-${width}.png`) });
  }
  for (const lang of ['en', 'th']) {
    for (const theme of ['dark', 'light']) {
      await page.evaluate(({ lang, theme }) => {
        localStorage.setItem('quotapulse-prefs', JSON.stringify({ lang, currency: lang === 'th' ? 'THB' : 'USD', rate: 35, hiddenSubscriptions: [] }));
        localStorage.setItem('quotapulse-theme', theme);
      }, { lang, theme });
      await page.reload();
      await page.getByRole('heading', { name: lang === 'th' ? 'รายการใช้งาน' : 'Usage records', exact: true }).waitFor();
      await page.locator('[data-testid=usage-history] tbody tr').first().waitFor();
      assert.equal(await page.locator('html').getAttribute('lang'), lang);
      if (lang === 'th') assert.match(await page.locator('[data-testid=usage-history] tbody tr').first().innerText(), /฿|THB/);
      for (const width of [390, 900, 1440]) {
        await page.setViewportSize({ width, height: 1000 });
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${lang}/${theme}/${width}`);
        await page.screenshot({ path: resolve(output, `${lang}-${theme}-${width}.png`) });
      }
    }
  }
  await page.goto('http://127.0.0.1:7801/?mode=legacy#live');
  const chart = page.getByTestId('recorded-minute-trend');
  await chart.getByRole('img').waitFor().catch(async error => {
    console.error('Live chart diagnostic', page.url(), errors, (await page.locator('body').innerText()).slice(0, 1800));
    await page.screenshot({ path: resolve(output, 'live-failure-diagnostic.png'), fullPage: true });
    throw error;
  });
  await chart.getByText('ดูค่ารายนาที', { exact: true }).click();
  assert.equal(await chart.locator('details li').count() >= 30, true);
  await chart.getByText('ดูค่ารายนาที', { exact: true }).click();
  await chart.getByText('ตัดข้อมูลสะสมหรือข้อมูลไม่ทราบชนิด 1 รายการ', { exact: true }).waitFor();
  assert.match(await chart.innerText(), /52 ครั้ง/);
  assert.equal(await chart.locator('[role=img] > span').count() >= 30, true);
  await page.screenshot({ path: resolve(output, 'live-minute-th-light.png') });
  await page.goto('http://127.0.0.1:7801/#overview');
  const overview = page.getByTestId('production-overview');
  await overview.locator('.qp-metrics strong').first().getByText('7,525').waitFor();
  assert.equal(await overview.locator('.qp-pulse-label strong').textContent(), '62%');
  assert.equal(await overview.locator('.qp-metrics strong').nth(1).textContent(), '2');
  assert.match(await overview.locator('.qp-metrics strong').nth(3).textContent() ?? '', /฿|THB/);
  await overview.getByTestId('quota-history').locator('summary').first().click();
  await overview.getByTestId('quota-history').locator('.qp-alert-segments>g[data-reset]').first().waitFor();
  assert.equal(await overview.getByTestId('quota-history').locator('.qp-alert-segments>g[data-reset]').count(), 2);
  await overview.getByTestId('quota-history').locator('summary').first().click();
  assert.match(await overview.getByTestId('quota-runway').innerText(), /31/);
  assert.match(await overview.getByTestId('usage-insights').innerText(), /33%/);
  assert.equal(await overview.getByText('ตัวอย่างดีไซน์', { exact: false }).count(), 0);
  await overview.locator('.qp-map-node').filter({ hasText: 'alpha_100%' }).click();
  await page.getByRole('dialog').waitFor();
  assert.match(await page.getByRole('dialog').innerText(), /6,526/);
  await page.keyboard.press('Escape');
  for (const width of [390, 900, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `overview overflow at ${width}`);
    await page.screenshot({ path: resolve(output, `overview-real-th-light-${width}.png`), fullPage: true });
  }
  await page.evaluate(() => {
    localStorage.setItem('quotapulse-prefs', JSON.stringify({ lang: 'en', currency: 'USD', rate: 1, hiddenSubscriptions: [] }));
    localStorage.setItem('quotapulse-theme', 'dark');
  });
  await page.reload();
  await overview.locator('.qp-metrics strong').first().getByText('7,525').waitFor();
  assert.equal(await overview.getAttribute('data-theme'), 'dark');
  const overviewFrom = now - 60_000;
  const overviewTo = Date.now() + 1;
  await page.goto(`http://127.0.0.1:7801/#overview?range=custom&from=${overviewFrom}&to=${overviewTo}&source=2`);
  await overview.locator('.qp-metrics strong').first().getByText('999', { exact: true }).waitFor();
  assert.equal(await overview.locator('.qp-hero .qp-chip').isVisible(), true);
  assert.match(await overview.getByTestId('recent-activity').innerText(), /hermes/);
  await overview.getByTestId('recent-activity').getByRole('link', { name: 'Open History', exact: true }).click();
  const scopedOverviewHistory = new URLSearchParams(new URL(page.url()).hash.split('?')[1]);
  assert.equal(scopedOverviewHistory.get('source'), '2');
  assert.equal(scopedOverviewHistory.get('from'), String(overviewFrom));
  assert.equal(scopedOverviewHistory.get('to'), String(overviewTo));
  await page.getByTestId('usage-history').getByText('1–1 of 1 records', { exact: true }).waitFor();
  await page.goto('http://127.0.0.1:7801/#overview');
  await overview.locator('.qp-metrics strong').first().getByText('7,525').waitFor();
  await page.screenshot({ path: resolve(output, 'overview-real-en-dark-1440.png'), fullPage: true });
  assert.equal(await overview.locator('.qp-machine-scope').innerText(), 'This machine');
  await overview.getByRole('button', { name: 'Go to' }).click();
  const palette = page.getByRole('dialog', { name: 'Command palette' });
  await palette.locator('input').focus();
  await page.keyboard.press('Shift+Tab');
  assert.equal(await palette.locator('button').last().evaluate(element => element === document.activeElement), true);
  await page.keyboard.press('Tab');
  assert.equal(await palette.locator('input').evaluate(element => element === document.activeElement), true);
  await page.keyboard.press('Escape');
  assert.equal(await overview.getByRole('button', { name: 'Go to' }).evaluate(element => element === document.activeElement), true);
  await overview.getByRole('button', { name: 'Go to' }).click();
  await palette.getByRole('button', { name: 'Settings' }).click();
  await page.waitForURL('**/#settings');
  await page.getByRole('heading', { name: 'Settings', exact: true, level: 1 }).waitFor();
  await page.goto('http://127.0.0.1:7801/#overview');
  await overview.locator('.qp-metrics strong').first().getByText('7,525').waitFor();
  await page.keyboard.press('Control+k');
  await palette.getByPlaceholder('Search a page…').fill('Providers');
  await page.keyboard.press('Enter');
  await page.waitForURL('**/#providers');
  await page.goto('http://127.0.0.1:7801/#overview');
  await overview.locator('.qp-metrics strong').first().getByText('7,525').waitFor();
  await overview.getByTestId('recent-activity').locator('a.qp-activity-item').first().click();
  await page.waitForURL('**/#history?range=all&session_id=1');
  await page.getByRole('heading', { name: 'Usage records', exact: true }).waitFor();
  await page.getByTestId('usage-history').getByText('1–50 of 52 records', { exact: true }).waitFor();
  await page.getByTestId('usage-history').getByRole('link', { name: 'Show all sessions', exact: true }).click();
  await page.getByTestId('usage-history').getByText('1–50 of 53 records', { exact: true }).waitFor();
  await page.goto('http://127.0.0.1:7801/#projects?range=all');
  const projects = page.getByTestId('production-projects');
  await projects.getByRole('heading', { name: 'Projects', exact: true }).waitFor();
  await projects.locator('.qp-project-card').first().waitFor();
  assert.equal(await projects.locator('.qp-project-card').count(), 2);
  assert.match(await projects.locator('.qp-project-detail').innerText(), /6,526/);
  await projects.locator('.qp-project-money').getByText('Not reported', { exact: true }).waitFor();
  await projects.locator('.qp-project-trend').waitFor();
  assert.equal(await projects.locator('.qp-project-trend span').count() > 1, true);
  await projects.getByRole('button', { name: 'Sessions', exact: true }).click();
  await projects.locator('.qp-project-breakdown a').first().waitFor();
  assert.match(await projects.locator('.qp-project-breakdown').innerText(), /synthetic-session/);
  await projects.getByRole('button', { name: 'Usage', exact: true }).click();
  await projects.getByRole('link', { name: 'Open filtered History' }).click();
  await page.waitForURL(/#history\?range=custom.*project=alpha_100%25/);
  await page.getByTestId('usage-history').getByText('1–50 of 52 records', { exact: true }).waitFor();
  await page.goto('http://127.0.0.1:7801/#projects?range=all');
  await projects.locator('.qp-project-card').first().waitFor();
  await projects.getByRole('button', { name: 'Unassigned', exact: true }).click();
  assert.equal(await projects.locator('.qp-project-card').count(), 1);
  await projects.getByRole('button', { name: 'All projects', exact: true }).click();
  await projects.getByRole('combobox', { name: /Harness/ }).selectOption('codex');
  await projects.locator('.qp-project-card').first().waitFor();
  assert.equal(await projects.locator('.qp-project-card').count(), 1);
  await projects.getByRole('combobox', { name: /Harness/ }).selectOption('');
  await projects.locator('.qp-project-card').first().waitFor();
  await projects.getByPlaceholder('Search project metadata').fill('Codex test');
  assert.equal(await projects.locator('.qp-project-card').count(), 1);
  await projects.getByPlaceholder('Search project metadata').fill('nothing-matches');
  await projects.locator('.qp-project-cards').getByText('No projects match this scope', { exact: true }).waitFor();
  await projects.getByPlaceholder('Search project metadata').fill('');
  for (const width of [390, 900, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `projects overflow at ${width}`);
  }
  await page.screenshot({ path: resolve(output, 'projects-real-en-dark-1440.png'), fullPage: true });
  await page.evaluate(() => {
    localStorage.setItem('quotapulse-prefs', JSON.stringify({ lang: 'th', currency: 'THB', rate: 35, hiddenSubscriptions: [] }));
    localStorage.setItem('quotapulse-theme', 'light');
  });
  await page.setViewportSize({ width: 390, height: 1000 });
  await page.reload();
  await projects.locator('.qp-project-card').first().waitFor();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'Thai projects mobile overflow');
  await page.screenshot({ path: resolve(output, 'projects-real-th-light-390.png'), fullPage: true });
  await page.goto('http://127.0.0.1:7801/#live');
  const live = page.getByTestId('production-live');
  await live.getByRole('heading', { name: 'ติดตามการใช้งานสด', exact: true }).waitFor();
  await live.getByRole('img', { name: /โทเคนที่บันทึกต่อนาที/ }).waitFor();
  assert.match(await live.innerText(), /ข้อมูลสะสมที่อัปเดต/);
  assert.match(await live.innerText(), /synthetic-session/);
  await live.getByRole('button', { name: 'ทั้งหมดที่ตรวจพบ', exact: true }).click();
  await live.getByRole('button', { name: 'aggregate-session', exact: true }).waitFor();
  await live.getByRole('button', { name: 'aggregate-session', exact: true }).click();
  await page.getByRole('dialog').waitFor();
  await page.keyboard.press('Escape');
  await live.locator('.qp-live-matrix button').first().click();
  await page.waitForURL(/provider=openrouter.*model=gpt-test/);
  await live.getByRole('button', { name: 'aggregate-session', exact: true }).waitFor({ state: 'hidden' });
  await live.getByRole('button', { name: 'ล้างตัวกรองผู้ให้บริการและโมเดล', exact: true }).click();
  await live.getByRole('button', { name: 'aggregate-session', exact: true }).waitFor();
  const beforePause = liveRequests.length;
  await live.getByRole('button', { name: 'หยุดภาพชั่วคราว', exact: true }).click();
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await page.waitForTimeout(1600);
  assert.equal(liveRequests.length, beforePause, 'paused Live queried sessions');
  await live.getByRole('button', { name: 'กลับสู่ข้อมูลล่าสุด', exact: true }).click();
  await live.getByRole('button', { name: 'หยุดภาพชั่วคราว', exact: true }).waitFor();
  await page.setViewportSize({ width: 1440, height: 1000 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'Live desktop overflow');
  await page.screenshot({ path: resolve(output, 'live-real-th-light-1440.png'), fullPage: true });
  await page.setViewportSize({ width: 390, height: 1000 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'Live mobile overflow');
  await page.screenshot({ path: resolve(output, 'live-real-th-light-390.png'), fullPage: true });
  await page.evaluate(() => {
    localStorage.setItem('quotapulse-prefs', JSON.stringify({ lang: 'en', currency: 'USD', rate: 1, hiddenSubscriptions: [] }));
    localStorage.setItem('quotapulse-theme', 'dark');
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.reload();
  await live.getByRole('heading', { name: 'Live monitoring', exact: true }).waitFor();
  await page.screenshot({ path: resolve(output, 'live-real-en-dark-1440.png'), fullPage: true });
  await page.goto('http://127.0.0.1:7801/#providers');
  const providers = page.getByTestId('production-providers');
  await providers.getByRole('heading', { name: 'Providers and subscriptions', exact: true }).waitFor();
  await providers.locator('.qp-provider-card').first().waitFor();
  assert.equal(await providers.locator('.qp-provider-card').count(), 4);
  assert.match(await providers.locator('.qp-provider-comparison').innerText(), /3 Owners without a comparable reading/);
  const publishedReset = providers.locator('.qp-provider-detail-windows dt').filter({ hasText: /^Reset$/ }).locator('xpath=following-sibling::dd[1]');
  assert.notEqual(await publishedReset.innerText(), 'Unknown', 'published future quota reset was hidden');
  await providers.locator('.qp-provider-card').filter({ hasText: 'Hermes test' }).getByRole('button', { name: 'Hermes test' }).click();
  await providers.locator('.qp-provider-detail').getByText('No quota percentage published').waitFor();
  await page.screenshot({ path: resolve(output, 'providers-real-en-dark-1440.png'), fullPage: true });
  await providers.locator('.qp-provider-card').filter({ hasText: 'Hermes test' }).getByRole('link', { name: 'Open diagnostics' }).click();
  await page.waitForURL(/#settings\?.*section=diagnostics/);
  await page.locator('#health-source-2').waitFor();
  await page.goto('http://127.0.0.1:7801/#providers');
  await providers.locator('.qp-provider-card').filter({ hasText: 'OpenAI Subscription' }).getByRole('link', { name: 'Manage in Settings' }).click();
  await page.waitForURL(/#settings\?subscription=openai%3Asubscription/);
  await page.getByRole('checkbox', { name: 'OpenAI Subscription' }).waitFor();
  assert.equal(await page.evaluate(() => Boolean(document.getElementById('subscription-openai%3Asubscription'))), true);
  await page.goto('http://127.0.0.1:7801/#providers');
  await page.evaluate(() => {
    localStorage.setItem('quotapulse-prefs', JSON.stringify({ lang: 'th', currency: 'THB', rate: 35, hiddenSubscriptions: [] }));
    localStorage.setItem('quotapulse-theme', 'light');
  });
  await page.setViewportSize({ width: 390, height: 1000 });
  await page.reload();
  await providers.locator('.qp-provider-card').first().waitFor();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'Providers mobile overflow');
  await page.screenshot({ path: resolve(output, 'providers-real-th-light-390.png'), fullPage: true });
  await page.evaluate(() => {
    localStorage.setItem('quotapulse-prefs', JSON.stringify({ lang: 'en', currency: 'USD', rate: 1, hiddenSubscriptions: [] }));
    localStorage.setItem('quotapulse-theme', 'dark');
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('http://127.0.0.1:7801/#models');
  await page.reload();
  const models = page.getByTestId('production-models');
  await models.getByRole('heading', { name: 'Model usage', exact: true }).waitFor();
  await models.locator('.qp-model-table-wrap tbody tr').first().waitFor();
  const modelDefaultFrom = Number(new URL(modelRequests.at(-1)!).searchParams.get('from'));
  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
  assert.equal(modelDefaultFrom, monthStart.getTime(), 'Models default scope must be the calendar month');
  assert.equal(await models.locator('.qp-model-table-wrap tbody tr').count(), 2);
  await models.locator('.qp-model-detail').getByText('gpt-test', { exact: true }).waitFor();
  await models.locator('.qp-model-trend span').first().waitFor({ state: 'attached' });
  assert.match(await models.locator('.qp-model-summary').innerText(), /Model and route pairs\s+2/);
  assert.match(await models.locator('.qp-model-comparison').innerText(), /openrouter/);
  await page.screenshot({ path: resolve(output, 'models-real-en-dark-1440.png'), fullPage: true });
  await models.locator('.qp-model-providers button').filter({ hasText: 'openrouter' }).click();
  await page.waitForURL(/provider=openrouter/);
  await models.locator('.qp-model-table-wrap tbody tr').first().waitFor();
  assert.equal(await models.locator('.qp-model-table-wrap tbody tr').count(), 1);
  await models.getByRole('link', { name: 'Open scoped History' }).click();
  await page.waitForURL(/#history\?/);
  const modelHistory = new URLSearchParams(new URL(page.url()).hash.split('?')[1]);
  assert.equal(modelHistory.get('model'), 'gpt-test');
  assert.equal(modelHistory.get('provider'), 'openrouter');
  await page.evaluate(() => {
    localStorage.setItem('quotapulse-prefs', JSON.stringify({ lang: 'th', currency: 'THB', rate: 35, hiddenSubscriptions: [] }));
    localStorage.setItem('quotapulse-theme', 'light');
  });
  await page.setViewportSize({ width: 390, height: 1000 });
  await page.goto('http://127.0.0.1:7801/#models');
  await page.reload();
  await models.locator('.qp-model-table-wrap tbody tr').first().waitFor();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'Models mobile overflow');
  await page.screenshot({ path: resolve(output, 'models-real-th-light-390.png'), fullPage: true });
  await page.evaluate(() => {
    localStorage.setItem('quotapulse-prefs', JSON.stringify({ lang: 'en', currency: 'USD', rate: 1, hiddenSubscriptions: [] }));
    localStorage.setItem('quotapulse-theme', 'dark');
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('http://127.0.0.1:7801/#cost');
  await page.reload();
  const cost = page.getByTestId('production-cost');
  await cost.getByRole('heading', { name: 'Cost analysis', exact: true }).waitFor();
  await cost.locator('.qp-cost-summary strong').first().waitFor();
  assert.equal(new URL(costRequests.at(-1)!).searchParams.get('from'), '0', 'Cost default scope must be all time');
  await cost.getByRole('combobox', { name: 'Period' }).selectOption('month');
  await page.waitForFunction(() => (document.querySelector('.qp-cost-toolbar select') as HTMLSelectElement)?.value === 'month');
  await cost.locator('.qp-cost-sessions tbody tr').first().waitFor();
  assert.equal(Number(new URL(costRequests.at(-1)!).searchParams.get('from')), monthStart.getTime(), 'Cost explicit month must retain its calendar scope');
  await cost.getByRole('combobox', { name: 'Period' }).selectOption('all');
  await cost.locator('.qp-cost-sessions tbody tr').first().waitFor();
  assert.match(await cost.locator('.qp-cost-summary').innerText(), /\$10\.60/);
  await cost.locator('.qp-cost-sessions tbody tr').first().waitFor();
  assert.match(await cost.locator('.qp-cost-sessions tbody tr').first().innerText(), /synthetic-session/);
  await page.screenshot({ path: resolve(output, 'cost-real-en-dark-1440.png'), fullPage: true });
  await cost.getByRole('combobox', { name: 'Monetary basis' }).selectOption('native');
  await cost.getByText('No value on the selected basis').first().waitFor();
  await cost.getByRole('combobox', { name: 'Monetary basis' }).selectOption('api');
  await cost.locator('.qp-cost-sessions tbody tr').first().waitFor();
  await cost.locator('.qp-cost-sessions tbody tr').first().getByRole('link').click();
  await page.waitForURL(/#history\?/);
  assert.equal(new URLSearchParams(new URL(page.url()).hash.split('?')[1]).get('session_id'), '1');
  await page.evaluate(() => {
    localStorage.setItem('quotapulse-prefs', JSON.stringify({ lang: 'th', currency: 'THB', rate: 35, hiddenSubscriptions: [] }));
    localStorage.setItem('quotapulse-theme', 'light');
  });
  await page.setViewportSize({ width: 390, height: 1000 });
  await page.goto('http://127.0.0.1:7801/#cost');
  await page.reload();
  if (await cost.getAttribute('lang') !== 'th') await cost.locator('.qp-tools button').last().click();
  await cost.getByRole('heading', { name: 'วิเคราะห์ต้นทุน', exact: true }).waitFor();
  await cost.locator('.qp-cost-summary strong').first().waitFor();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'Cost mobile overflow');
  await page.screenshot({ path: resolve(output, 'cost-real-th-light-390.png'), fullPage: true });
  await page.evaluate(() => {
    localStorage.setItem('quotapulse-prefs', JSON.stringify({ lang: 'en', currency: 'USD', rate: 1, hiddenSubscriptions: [] }));
    localStorage.setItem('quotapulse-theme', 'dark');
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  for (const destination of ['projects', 'models', 'cost']) {
    await page.goto(`http://127.0.0.1:7801/#${destination}?range=custom&from=${overviewFrom}&to=${overviewTo}&source=1`);
    await page.reload();
    const scoped = page.getByTestId(`production-${destination}`);
    await scoped.getByTestId('scope-notice').getByText(/Source #1/).waitFor();
    if (destination === 'projects') await scoped.getByRole('button', { name: 'Usage', exact: true }).click();
    const label = destination === 'projects' ? 'Open filtered History' : 'Open scoped History';
    const link = scoped.getByRole('link', { name: label, exact: true }).first();
    await link.waitFor();
    const params = new URLSearchParams((await link.getAttribute('href'))!.split('?')[1]);
    assert.equal(params.get('source'), '1', `${destination} lost source in History`);
    assert.equal(params.get('from'), String(overviewFrom));
    assert.equal(params.get('to'), String(overviewTo));
    assert.equal(await scoped.getByRole('combobox', { name: 'Period', exact: true }).inputValue(), 'custom');
  }
  const alertAt = Date.now() - 1000;
  db.prepare(`INSERT INTO limit_sample(source_id,window_kind,used_percent,resets_at,observed_at,last_seen_at,source_fetched_at,origin)
    VALUES (1,'5h',97,?,?,?,?,?)`).run(now + 7200000, alertAt, alertAt, alertAt, 'live-synthetic');
  assert.equal(recordQuotaAlerts(db, alertAt).length, 3);
  await page.evaluate(() => {
    localStorage.setItem('quotapulse-prefs', JSON.stringify({ lang: 'en', currency: 'USD', rate: 1, hiddenSubscriptions: [] }));
    localStorage.setItem('quotapulse-theme', 'dark');
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('http://127.0.0.1:7801/#alerts');
  await page.reload();
  const alerts = page.getByTestId('production-alerts');
  if (await alerts.getAttribute('lang') !== 'en') await alerts.locator('.qp-tools button').last().click();
  await alerts.getByRole('heading', { name: 'Alerts and quota guard', exact: true }).waitFor();
  await alerts.locator('.qp-alert-risk li').first().waitFor();
  assert.equal(await alerts.locator('.qp-alert-risk li').count(), 1);
  assert.equal(await alerts.locator('.qp-alert-history li').count(), 3);
  await alerts.locator('.qp-quota-point').last().waitFor();
  const notificationToggle = alerts.getByRole('checkbox', { name: 'Desktop notifications' });
  await notificationToggle.click();
  await page.waitForFunction(() => !(document.querySelector('[data-testid="production-alerts"] input[type="checkbox"]') as HTMLInputElement).checked);
  await notificationToggle.click();
  await page.waitForFunction(() => (document.querySelector('[data-testid="production-alerts"] input[type="checkbox"]') as HTMLInputElement).checked);
  await page.screenshot({ path: resolve(output, 'alerts-real-en-dark-1440.png'), fullPage: true });
  await page.evaluate(() => localStorage.setItem('quotapulse-theme', 'light'));
  await page.setViewportSize({ width: 390, height: 1000 });
  await page.reload();
  if (await alerts.getAttribute('lang') !== 'th') await alerts.locator('.qp-tools button').last().click();
  await alerts.getByRole('heading', { name: 'การแจ้งเตือนและเฝ้าโควตา', exact: true }).waitFor();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'Alerts mobile overflow');
  await page.screenshot({ path: resolve(output, 'alerts-real-th-light-390.png'), fullPage: true });
  const recoveredAt = Date.now();
  db.prepare(`INSERT INTO limit_sample(source_id,window_kind,used_percent,resets_at,observed_at,last_seen_at,source_fetched_at,origin)
    VALUES (1,'5h',20,?,?,?,?,?)`).run(now + 7200000, recoveredAt, recoveredAt, recoveredAt, 'live-synthetic');
  await page.reload();
  await alerts.getByText('ค่าที่สดยังไม่พบความเสี่ยงปัจจุบัน').waitFor();
  assert.equal(await alerts.locator('.qp-alert-history li').count(), 3);
  db.prepare("UPDATE source SET account_state='unavailable' WHERE id=2").run();
  await page.reload();
  await alerts.locator('.qp-alert-risk li').filter({ hasText: 'Hermes test' }).waitFor();
  await page.evaluate(() => localStorage.setItem('quotapulse-prefs', JSON.stringify({ lang: 'en', currency: 'USD', rate: 1, hiddenSubscriptions: [] })));
  await page.setViewportSize({ width: 1440, height: 1000 });
  const aliases = [
    ['#today', '#overview?range=today', 'overview'],
    ['#trend', '#overview?range=month', 'overview'],
    ['#usage?view=models', '#models?range=month', 'models'],
    ['#usage?view=cost', '#cost?range=all', 'cost'],
    ['#sources', '#providers', 'providers'],
    ['#limits', '#providers?section=quotas', 'providers'],
    ['#health?source=2', '#settings?source=2&section=diagnostics', 'settings'],
    ['#sessions?range=all&source=2', '#history?range=all&source=2', 'history'],
  ];
  for (const [alias, canonical, destination] of aliases) {
    await page.goto(`http://127.0.0.1:7801/${alias}`);
    await page.reload();
    await page.getByTestId(`production-${destination}`).waitFor();
    assert.equal(new URL(page.url()).hash, canonical, `alias ${alias}`);
  }
  await page.goto('http://127.0.0.1:7801/#overview');
  await page.getByTestId('production-overview').waitFor();
  await page.evaluate(() => { location.hash = '#usage?view=models'; });
  await page.getByTestId('production-models').waitFor();
  await page.goBack();
  await page.getByTestId('production-overview').waitFor();
  assert.equal(new URL(page.url()).hash, '#overview');
  await page.goForward();
  await page.getByTestId('production-models').waitFor();
  assert.equal(new URL(page.url()).hash, '#models?range=month');
  await page.goto('http://127.0.0.1:7801/#settings');
  await page.getByTestId('production-settings').getByRole('heading', { level: 1 }).waitFor();
  await page.screenshot({ path: resolve(output, 'settings-real-en-light-1440.png'), fullPage: true });
  await page.clock.setFixedTime(now);
  await page.evaluate(() => localStorage.setItem('quotapulse-theme', 'dark'));
  const reviewCaptures = [];
  for (const [destination, ready] of [
    ['overview', '.qp-metrics strong'], ['live', '.qp-live-chart'],
    ['projects', '.qp-project-cards'], ['providers', '.qp-provider-grid'],
    ['models', '.qp-model-summary'], ['cost', '.qp-cost-summary'],
    ['history', '[data-testid="usage-history"] tbody tr'], ['alerts', '.qp-alert-history li'],
  ]) {
    const viewport = destination === 'overview' ? { width: 1586, height: 992 } : { width: 1672, height: 941 };
    await page.setViewportSize(viewport);
    await page.goto(`http://127.0.0.1:7801/#${destination}`);
    await page.reload();
    await page.getByTestId(`production-${destination}`).locator(ready).first().waitFor();
    await page.evaluate(() => document.fonts.ready);
    if (destination === 'history') {
      const geometry = await page.getByTestId('history-timeline').evaluate(element => {
        const svg = element.querySelector('svg')!;
        const line = svg.querySelector('line')!;
        const table = document.querySelector('[data-testid="usage-history"] tbody tr')!;
        return { timelineHeight: element.getBoundingClientRect().height, chartWidth: svg.getBoundingClientRect().width, plotWidth: Number(line.getAttribute('x2')) - Number(line.getAttribute('x1')), firstRowBottom: table.getBoundingClientRect().bottom };
      });
      assert.ok(geometry.timelineHeight < 390, `History timeline too tall: ${geometry.timelineHeight}`);
      assert.ok(geometry.plotWidth > geometry.chartWidth * .9, 'History plot does not use available width');
      assert.ok(geometry.firstRowBottom < viewport.height, 'History first record is outside concept viewport');
    }
    const densitySelectors: Record<string, string[]> = {
      overview: ['.qp-hero-grid', '.qp-bottom-grid', '.qp-activity', '.qp-activity-item'],
      live: ['.qp-live-metrics', '.qp-live-sessions', '.qp-live-trend', '.qp-live-records', '.qp-live-feed li', '.qp-live-rail'],
      projects: ['.qp-project-cards', '.qp-project-detail', '.qp-project-top', '.qp-project-rail'],
      providers: ['.qp-provider-grid', '.qp-provider-detail', '.qp-provider-bottom'],
      models: ['.qp-model-summary', '.qp-model-providers', '.qp-model-detail'],
    };
    if (destination === 'models') await page.locator('.qp-model-trend span').first().waitFor({ state: 'attached' });
    if (destination === 'projects') await page.locator('.qp-project-trend').waitFor();
    const regions = await page.evaluate(selectors => Object.fromEntries(selectors.map(selector => {
      const { x, y, width, height } = document.querySelector(selector)!.getBoundingClientRect();
      return [selector, { x, y, width, height }];
    })), ['.qp-sidebar', '.qp-topbar', '.qp-workspace main', ...(densitySelectors[destination] ?? [])]);
    const bottom = (selector: string) => regions[selector].y + regions[selector].height;
    if (destination === 'overview') {
      await page.screenshot({ path: resolve(output, 'overview-density-gate.png') });
      assert.ok(bottom('.qp-activity-item') < viewport.height, `Overview first activity record is outside concept viewport: ${JSON.stringify(regions)}`);
    }
    if (destination === 'providers') assert.ok(bottom('.qp-provider-bottom') < viewport.height, 'Providers comparison/health region is outside concept viewport');
    if (destination === 'live') assert.ok(bottom('.qp-live-feed li') < viewport.height, 'Live first usage record is outside concept viewport');
    if (destination === 'projects') {
      assert.ok(regions['.qp-project-top'].y >= bottom('.qp-project-detail'), 'Projects ranking is not below selected details');
      assert.equal(regions['.qp-project-top'].x, regions['.qp-project-detail'].x, 'Projects ranking is outside detail column');
      assert.ok(bottom('.qp-project-rail') < viewport.height, 'Projects detail and ranking are outside concept viewport');
    }
    if (destination === 'models') {
      assert.ok(bottom('.qp-model-providers') < viewport.height, 'Models provider summary is outside concept viewport');
      assert.ok(bottom('.qp-model-detail') < viewport.height, 'Models detail rail is outside concept viewport');
      assert.equal(await page.locator('.qp-model-search .qp-visually-hidden').evaluate(node => node.getBoundingClientRect().width), 1, 'Models search label was visible on direct load');
    }
    const filename = `${destination}-concept-size.png`;
    await page.screenshot({ path: resolve(output, filename), animations: 'disabled' });
    reviewCaptures.push({ destination, viewport, filename, regions });
  }
  writeFileSync(resolve(output, 'review-candidates.json'), JSON.stringify({
    status: 'review candidates; not approved visual baselines', browser: browser.version(),
    timezone: 'Asia/Bangkok', dpr: 1, language: 'en', theme: 'dark', reducedMotion: true,
    browserClock: now, daemonClock: 'real clock; synthetic data seeded at browserClock',
    captures: reviewCaptures,
  }, null, 2));
  const matrix = [];
  for (const lang of ['en', 'th']) for (const theme of ['dark', 'light']) for (const width of [390, 900, 1280, 1440]) {
    await page.evaluate(({ lang, theme }) => {
      localStorage.setItem('quotapulse-prefs', JSON.stringify({ lang, currency: 'USD', rate: 1, hiddenSubscriptions: [] }));
      localStorage.setItem('quotapulse-theme', theme);
    }, { lang, theme });
    await page.setViewportSize({ width, height: 1000 });
    await page.reload();
    for (const [destination, ready] of [
      ['overview', '.qp-metrics strong'], ['live', '.qp-live-chart'],
      ['projects', '.qp-project-cards'], ['providers', '.qp-provider-grid'],
      ['models', '.qp-model-summary'], ['cost', '.qp-cost-summary'],
      ['history', '[data-testid="history-total-tokens"]'], ['alerts', '.qp-alert-history li'],
      ['settings', 'main input'],
    ]) {
      await page.goto(`http://127.0.0.1:7801/#${destination}`);
      const screen = page.getByTestId(`production-${destination}`);
      await screen.locator(ready).first().waitFor();
      await page.evaluate(() => document.fonts.ready);
      assert.equal(await screen.getAttribute('lang'), lang);
      assert.equal(await screen.getAttribute('data-theme'), theme);
      assert.equal(await screen.locator('.qp-sidebar nav a').count(), 9);
      assert.equal(await screen.locator('.qp-sidebar nav a[aria-current="page"]').count(), 1);
      assert.equal(await screen.locator('main h1').count(), 1);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${destination}/${lang}/${theme}/${width} overflow`);
      const link = screen.locator('.qp-sidebar nav a').first();
      await link.focus();
      assert.equal(await link.evaluate(element => getComputedStyle(element).outlineStyle), 'solid', 'missing keyboard focus');
      await page.waitForTimeout(100);
      // The previous HTTP stream can still be closing after a document reload.
      // Bound transport cleanup separately from the synchronous client count.
      for (let retry = 0; retry < 20 && scheduler.listenerCount('data') > 1; retry++) await page.waitForTimeout(50);
      const clientStreams = await page.evaluate(() => (window as unknown as { __streamCounts: { opened: number; closed: number } }).__streamCounts);
      assert.equal(clientStreams.opened - clientStreams.closed, 1, `${destination}: duplicate client EventSources`);
      assert.ok(scheduler.listenerCount('data') <= 1, `${destination}: server streams=${scheduler.listenerCount('data')}, client=${JSON.stringify(clientStreams)}`);
      matrix.push({ destination, lang, theme, width, streams: scheduler.listenerCount('data') });
    }
    console.log(`PASS redesigned matrix: ${lang}/${theme}/${width}, nine pages`);
  }
  writeFileSync(resolve(output, 'responsive-matrix.json'), JSON.stringify({ browser: browser.version(), checks: ['loaded production page', 'language and theme', 'nine destinations and current page', 'one main heading', 'no page overflow', 'visible keyboard focus', 'at most one active SSE listener after navigation'], cases: matrix }, null, 2));
  // Price semantics use real HTTP and weighted call_count; restore the fixture afterwards.
  const costCases: Array<{ name: string; setup: () => void; native: string; api: string; coverage: string; suffix?: string }> = [
    { name: 'missing prices', setup: () => { db.exec("UPDATE usage_event SET cost_usd=NULL,cost_source='unknown',call_count=1"); }, native: 'Unknown', api: 'Unknown', coverage: '0 / 53' },
    { name: 'known zero', setup: () => { db.exec("UPDATE usage_event SET cost_usd=0,cost_source='computed',call_count=1"); }, native: 'Unknown', api: '$0.00', coverage: '53 / 53' },
    { name: 'mixed weighted bases', setup: () => {
      db.exec("UPDATE usage_event SET cost_usd=NULL,cost_source='unknown',call_count=1");
      db.exec("UPDATE usage_event SET cost_usd=0.1,cost_source='native',call_count=10 WHERE id=1; UPDATE usage_event SET cost_usd=0.2,cost_source='computed',call_count=20 WHERE id=2; UPDATE usage_event SET cost_usd=0.3,cost_source='estimated',call_count=30 WHERE id=3;");
    }, native: '$0.10+', api: '$0.50+', coverage: '50 / 110' },
    { name: 'empty source scope', setup: () => {}, native: '$0.00', api: '$0.00', coverage: '0 / 0', suffix: '&source=999' },
  ];
  try {
    await page.evaluate(() => localStorage.setItem('quotapulse-prefs', JSON.stringify({ lang: 'en', currency: 'USD', rate: 1, hiddenSubscriptions: [] })));
    for (const entry of costCases) {
      entry.setup();
      await page.goto(`http://127.0.0.1:7801/#overview?range=all${entry.suffix ?? ''}`);
      await page.reload();
      const metrics = page.getByTestId('production-overview').locator('.qp-metrics strong');
      await metrics.first().waitFor();
      assert.equal(await metrics.nth(2).locator('span > span').first().textContent(), entry.native, `${entry.name}: Overview native`);
      assert.equal(await metrics.nth(3).locator('span > span').first().textContent(), entry.api, `${entry.name}: Overview API`);
      assert.match(await metrics.nth(3).locator('[title]').getAttribute('title') ?? '', new RegExp(entry.coverage));
      await page.goto(`http://127.0.0.1:7801/#models?range=all${entry.suffix ?? ''}`);
      await page.reload();
      const summary = page.getByTestId('production-models').locator('.qp-model-summary article').last();
      await summary.waitFor();
      assert.equal(await summary.locator('strong span > span').first().textContent(), entry.api, `${entry.name}: Models API`);
      assert.equal(await summary.locator('small span > span').first().textContent(), entry.native, `${entry.name}: Models native`);
      assert.match(await summary.locator('strong [title]').getAttribute('title') ?? '', new RegExp(entry.coverage));
      if (!entry.suffix) {
        const selectedValue = page.locator('.qp-model-detail-stats > div').last().locator('strong span > span').first();
        assert.equal(await selectedValue.textContent(), entry.api, `${entry.name}: selected model API`);
        assert.equal(await page.locator('.qp-model-table-wrap tbody tr').first().locator('td').last().locator('span > span').first().textContent(), entry.api, `${entry.name}: table API`);
      }
      for (const basis of ['api', 'native']) {
        await page.goto(`http://127.0.0.1:7801/#cost?range=custom&from=${now - 30 * 86400000}&to=${now + 1}&basis=${basis}${entry.suffix ?? ''}`);
        await page.reload();
        const screen = page.getByTestId('production-cost');
        const value = screen.locator('.qp-cost-summary article').first().locator('.qp-cost-value');
        await value.waitFor();
        assert.equal(await value.locator('span').first().textContent(), entry[basis as 'api' | 'native'], `${entry.name}: Cost ${basis}`);
        if (entry.name === 'known zero' && basis === 'api') {
          assert.ok(await screen.locator('.qp-cost-column').evaluateAll(nodes => nodes.every(node => node.getBoundingClientRect().height === 0)), 'Known zero has a nonzero chart bar');
          assert.equal(await screen.locator('.qp-cost-donut').getAttribute('data-zero'), 'true');
        }
        if (entry.name === 'mixed weighted bases') {
          assert.match(await screen.locator('.qp-cost-models tbody .qp-cost-value').first().getAttribute('title') ?? '', new RegExp(basis === 'api' ? '50 / 109' : '10 / 109'));
          assert.equal(await screen.locator('.qp-cost-models tbody .qp-cost-value > span').first().textContent(), entry[basis as 'api' | 'native']);
        }
        if (entry.name === 'missing prices' || (entry.name === 'known zero' && basis === 'native')) assert.equal(await screen.locator('.qp-cost-chart').count(), 0);
      }
    }
  } finally { db.exec("UPDATE usage_event SET cost_usd=0.2,cost_source='computed',call_count=1"); }
  writeFileSync(resolve(output, 'cost-semantics.json'), JSON.stringify({ database: 'in-memory synthetic', cases: costCases.map(({ name, native, api, coverage }) => ({ name, native, api, coverage })), checks: ['Overview, Models and Cost summary', 'Models comparison and selected model', 'weighted call counts', 'separate native and API bases', 'accessible coverage explanation', 'Cost zero bars and neutral zero donut', 'Cost model weighted coverage'] }, null, 2));
  // Occupied Live layouts and pagination get a separate synthetic fixture after
  // the baseline flow, so its original totals and captured reference values stay intact.
  await page.close();
  const occupiedCaptures: unknown[] = [];
  const occupiedNow = Date.now();
  const originalRecentAt = (db.prepare('SELECT last_seen_at FROM session WHERE id=1').get() as { last_seen_at: number | null }).last_seen_at;
  db.transaction(() => {
    db.prepare('UPDATE session SET last_seen_at=? WHERE id=1').run(occupiedNow - 100);
    const addSession = db.prepare('INSERT INTO session(id,source_id,native_session_id,project,last_seen_at) VALUES (?,1,?,?,?)');
    const addUsage = db.prepare("INSERT INTO usage_event(source_id,session_id,dedup_key,ts,model,provider,total_tokens,call_count,cost_usd,cost_source) VALUES (1,?,?,?,?,'openrouter',?,1,0.1,'computed')");
    for (let index = 0; index < 12; index++) {
      addSession.run(100 + index, `layout-session-${index}`, `Project ${index}`, occupiedNow - 100);
      addUsage.run(100 + index, `layout-${index}`, now - 100, `layout-model-${index}`, 300 + index * 100);
    }
  })();
  try {
    for (const lang of ['en', 'th'] as const) for (const theme of ['dark', 'light'] as const) {
      const occupied = await browser.newPage({ viewport: { width: 1672, height: 941 }, reducedMotion: 'reduce', deviceScaleFactor: 1, timezoneId: 'Asia/Bangkok' });
      try {
        occupied.on('pageerror', error => errors.push(error.message));
        await occupied.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
        await occupied.addInitScript(({ lang, theme }) => {
          (window as unknown as { __QUOTAPULSE_TOKEN__: string }).__QUOTAPULSE_TOKEN__ = 'history-test';
          localStorage.setItem('quotapulse-prefs', JSON.stringify({ lang, currency: 'USD', rate: 1, hiddenSubscriptions: [] }));
          localStorage.setItem('quotapulse-theme', theme);
        }, { lang, theme });
        await occupied.clock.setFixedTime(now);
        await occupied.goto('http://127.0.0.1:7801/#live');
        const screen = occupied.getByTestId('production-live');
        await screen.getByRole('heading', { name: lang === 'en' ? 'Live monitoring' : 'ติดตามการใช้งานสด', exact: true }).waitFor();
        await screen.locator('.qp-live-table tbody tr').nth(9).waitFor();
        await occupied.evaluate(() => document.fonts.ready);
        assert.equal(await screen.locator('.qp-live-metrics strong').first().textContent(), '13');
        assert.equal(await screen.locator('.qp-live-matrix li').count(), 12);
        assert.equal(await screen.locator('.qp-live-feed li').count(), 8);
        const regions = await screen.evaluate(node => Object.fromEntries(['.qp-live-sessions', '.qp-live-trend', '.qp-live-records', '.qp-live-feed li', '.qp-live-rail'].map(selector => {
          const { x, y, width, height, bottom } = node.querySelector(selector)!.getBoundingClientRect();
          return [selector, { x, y, width, height, bottom }];
        })));
        assert.ok(regions['.qp-live-feed li'].bottom < 941, `${lang}/${theme}: occupied Live first feed record outside viewport: ${JSON.stringify(regions)}`);
        assert.ok(regions['.qp-live-rail'].bottom < 941, `${lang}/${theme}: occupied Live rail outside viewport: ${JSON.stringify(regions)}`);
        const filename = `live-occupied-${lang}-${theme}.png`;
        await occupied.screenshot({ path: resolve(output, filename), animations: 'disabled' });
        occupiedCaptures.push({ lang, theme, viewport: { width: 1672, height: 941 }, filename, regions });
        const sessionControls = screen.locator('.qp-live-sessions .qp-live-pagination button');
        await sessionControls.last().click();
        await occupied.waitForURL(/session_offset=10/);
        await screen.getByRole('button', { name: 'synthetic-session', exact: true }).waitFor();
        assert.equal(await screen.locator('.qp-live-table tbody tr').count(), 3);
        assert.equal(await sessionControls.last().isDisabled(), true);
        await sessionControls.first().click();
        await screen.getByRole('button', { name: 'layout-session-11', exact: true }).waitFor();
        assert.equal(await screen.locator('.qp-live-table tbody tr').count(), 10);
        for (const width of [390, 900, 1280]) {
          await occupied.setViewportSize({ width, height: 1000 });
          assert.ok(await occupied.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${lang}/${theme}: occupied Live overflow at ${width}`);
        }
        if (lang === 'th' && theme === 'light') {
          const longName = `layout-long-${'รายละเอียดเซสชัน'.repeat(12)}`;
          db.prepare('UPDATE session SET native_session_id=?,project=? WHERE id=111').run(longName, 'โครงการที่มีชื่อยาวมาก'.repeat(10));
          await occupied.setViewportSize({ width: 390, height: 1000 });
          await occupied.reload();
          const sessionButton = screen.getByRole('button', { name: longName, exact: true });
          await sessionButton.waitFor();
          assert.ok(await occupied.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'long Thai Live metadata overflows mobile');
          await sessionButton.click();
          await occupied.getByRole('dialog').waitFor();
          await occupied.keyboard.press('Escape');
          assert.equal(await sessionButton.evaluate(node => node === document.activeElement), true, 'Live dialog did not restore focus');
          await occupied.screenshot({ path: resolve(output, 'live-occupied-th-light-390-long.png'), fullPage: true });
          const search = screen.locator('.qp-live-search input');
          await search.fill('no-live-layout-match');
          await screen.locator('.qp-live-search button').click();
          await screen.getByText('ไม่มีเซสชันตรงกับตัวกรอง', { exact: true }).waitFor();
          assert.equal(await screen.locator('.qp-live-table tbody tr').count(), 0);
          assert.equal(await screen.locator('.qp-live-feed li').count(), 0);
        }
      } finally { await occupied.close(); }
    }
  } finally {
    db.transaction(() => {
      db.exec('DELETE FROM usage_event WHERE session_id BETWEEN 100 AND 111; DELETE FROM session WHERE id BETWEEN 100 AND 111;');
      db.prepare('UPDATE session SET last_seen_at=? WHERE id=1').run(originalRecentAt);
    })();
  }
  writeFileSync(resolve(output, 'live-occupied-layout.json'), JSON.stringify({ database: 'in-memory synthetic', fixture: { addedSessions: 12, recentSessions: 13, observedSessions: 14, sessionPageRows: 10, feedPageRows: 8, matrixRows: 12 }, checks: ['first feed record and complete rail in concept viewport', 'en/th and dark/light', 'session pagination without missing rows', '390/900/1280 overflow', 'long Thai session/project names', 'dialog focus restore', 'empty filtered sessions/feed'], captures: occupiedCaptures }, null, 2));
  const projectCaptures: unknown[] = [];
  db.transaction(() => {
    const addSession = db.prepare('INSERT INTO session(id,source_id,native_session_id,project,last_seen_at,cwd) VALUES (?,1,?,?,?,?)');
    const addUsage = db.prepare("INSERT INTO usage_event(source_id,session_id,dedup_key,ts,model,provider,total_tokens,call_count,cost_usd,cost_source) VALUES (1,?,?,?,?,'openrouter',?,?,?,?)");
    for (let index = 0; index < 30; index++) {
      const project = index < 25 ? 'Project 6' : `Project ${index - 24}`;
      addSession.run(200 + index, `project-session-${index}`, project, Date.now() - 100, `/synthetic/${project}/path-${index % 2}`);
      addUsage.run(200 + index, `project-layout-${index}`, now - 2000, `project-model-${index % 3}`, index < 25 ? 1000 + index * 100 : (index - 24) * 1000, [4, 2, 3][index % 3], [.1, .2, .2][index % 3], ['native', 'computed', 'estimated'][index % 3]);
    }
  })();
  try {
    for (const lang of ['en', 'th'] as const) for (const theme of ['dark', 'light'] as const) {
      const messages = lang === 'en' ? englishMessages : thaiMessages;
      const occupied = await browser.newPage({ viewport: { width: 1672, height: 941 }, reducedMotion: 'reduce', deviceScaleFactor: 1, timezoneId: 'Asia/Bangkok' });
      try {
        occupied.on('pageerror', error => errors.push(error.message));
        await occupied.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
        await occupied.addInitScript(({ lang, theme }) => {
          (window as unknown as { __QUOTAPULSE_TOKEN__: string }).__QUOTAPULSE_TOKEN__ = 'history-test';
          localStorage.setItem('quotapulse-prefs', JSON.stringify({ lang, currency: 'USD', rate: 1, hiddenSubscriptions: [] }));
          localStorage.setItem('quotapulse-theme', theme);
        }, { lang, theme });
        await occupied.clock.setFixedTime(now);
        await occupied.goto('http://127.0.0.1:7801/#projects?range=all');
        const screen = occupied.getByTestId('production-projects');
        await screen.getByRole('heading', { name: messages['redesign.projectHeading'], exact: true }).waitFor();
        await screen.locator('.qp-project-card').nth(7).waitFor();
        await screen.locator('.qp-project-trend').waitFor();
        await occupied.evaluate(() => document.fonts.ready);
        assert.equal(await screen.locator('.qp-project-card').count(), 8);
        assert.equal(await screen.locator('.qp-project-detail h2').textContent(), 'Project 6');
        assert.equal(await screen.locator('.qp-project-top li').count(), 5);
        assert.ok(await screen.locator('.qp-project-top button').evaluateAll(nodes => nodes.every(node => node.getBoundingClientRect().height >= 24 && node.getBoundingClientRect().width >= 24)), 'Project ranking targets are smaller than 24 px');
        assert.equal(await screen.locator('.qp-project-identity-panel').count(), 2);
        assert.ok(await screen.locator('.qp-project-identity-panel li').count() > 0);
        await screen.getByRole('button', { name: messages['redesign.projectMetadataTab'], exact: true }).click();
        assert.equal(await screen.locator('.qp-project-full-breakdown li').count(), 3);
        await screen.getByRole('button', { name: messages['redesign.projectOverviewTab'], exact: true }).click();
        const native = screen.locator('.qp-project-money > div').first().locator('.qp-cost-value');
        const apiValue = screen.locator('.qp-project-money > div').last().locator('.qp-cost-value');
        const expectedMoney = (amount: number) => new Intl.NumberFormat(lang === 'th' ? 'th-TH' : 'en-US', { style: 'currency', currency: 'USD' }).format(amount);
        assert.equal(await native.locator('span').first().textContent(), `${expectedMoney(.9)}+`);
        assert.equal(await apiValue.locator('span').first().textContent(), `${expectedMoney(3.2)}+`);
        assert.equal(await screen.locator('.qp-project-detail-metrics > div').nth(2).locator('small').textContent(), messages['redesign.modelsCalls']);
        assert.equal(await screen.locator('.qp-project-detail-metrics > div').nth(2).locator('strong').textContent(), '76');
        assert.match(await native.getAttribute('title') ?? '', /36 \/ 76/);
        assert.match(await apiValue.getAttribute('title') ?? '', /40 \/ 76/);
        const regions = await screen.evaluate(node => Object.fromEntries(['.qp-project-cards', '.qp-project-card:nth-child(6)', '.qp-project-detail', '.qp-project-top', '.qp-project-rail'].map(selector => {
          const { x, y, width, height, bottom } = node.querySelector(selector)!.getBoundingClientRect();
          return [selector, { x, y, width, height, bottom }];
        })));
        assert.equal(regions['.qp-project-top'].x, regions['.qp-project-detail'].x, 'Occupied ranking is outside detail column');
        assert.ok(regions['.qp-project-top'].y >= regions['.qp-project-detail'].bottom, 'Occupied ranking is above detail');
        assert.ok(regions['.qp-project-rail'].bottom < 941, `${lang}/${theme}: Projects rail outside viewport: ${JSON.stringify(regions)}`);
        assert.ok(regions['.qp-project-card:nth-child(6)'].bottom < 941, `${lang}/${theme}: first six project cards outside viewport`);
        const filename = `projects-occupied-${lang}-${theme}.png`;
        await occupied.screenshot({ path: resolve(output, filename), animations: 'disabled' });
        projectCaptures.push({ lang, theme, viewport: { width: 1672, height: 941 }, filename, regions });
        await screen.locator('.qp-project-top button').filter({ hasText: 'Project 3' }).click();
        await screen.locator('.qp-project-detail h2').getByText('Project 3', { exact: true }).waitFor();
        assert.equal(await screen.locator('.qp-project-card[aria-pressed=true] .qp-project-card-heading strong').textContent(), 'Project 3');
        await screen.locator('.qp-project-top button').filter({ hasText: 'Project 6' }).click();
        await screen.getByRole('button', { name: messages['redesign.projectSessionsTab'], exact: true }).click();
        await screen.locator('.qp-project-breakdown li').nth(19).waitFor();
        await screen.locator('.qp-project-pagination button').last().click();
        await screen.getByRole('link').filter({ hasText: 'project-session-0' }).waitFor();
        assert.equal(await screen.locator('.qp-project-breakdown li').count(), 5);
        assert.equal(await screen.locator('.qp-project-pagination button').last().isDisabled(), true);
        await screen.locator('.qp-project-pagination button').first().click();
        await screen.getByRole('link').filter({ hasText: 'project-session-24' }).waitFor();
        assert.equal(await screen.locator('.qp-project-breakdown li').count(), 20);
        for (const width of [390, 900, 1280]) {
          await occupied.setViewportSize({ width, height: 1000 });
          assert.ok(await occupied.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${lang}/${theme}: occupied Projects overflow at ${width}`);
        }
        if (lang === 'en' && theme === 'dark') {
          const scope = new URLSearchParams({ range: 'custom', from: String(now - 60000), to: String(now + 1), source: '1', harness: 'codex', project: 'Project 6', detail: 'sessions' });
          await occupied.goto(`http://127.0.0.1:7801/#projects?${scope}`);
          await screen.getByRole('link').filter({ hasText: 'project-session-24' }).click();
          await occupied.getByTestId('usage-history').locator('tbody tr').first().waitFor();
          const historyScope = new URLSearchParams(new URL(occupied.url()).hash.split('?')[1]);
          for (const key of ['range', 'from', 'to', 'source', 'harness', 'project']) assert.equal(historyScope.get(key), scope.get(key), `Projects session History lost ${key}`);
          assert.equal(historyScope.get('session_id'), '224');
          assert.equal(await occupied.getByTestId('usage-history').locator('tbody tr').count(), 1);
        }
        if (lang === 'th' && theme === 'light') {
          const longProject = `project-long-${'ชื่อโครงการภาษาไทย'.repeat(12)}`;
          db.prepare('UPDATE session SET project=? WHERE id BETWEEN 200 AND 224').run(longProject);
          await occupied.setViewportSize({ width: 390, height: 1000 });
          await occupied.goto(`http://127.0.0.1:7801/#projects?${new URLSearchParams({ range: 'all', project: longProject, detail: 'details' })}`);
          await occupied.reload();
          await screen.locator('.qp-project-detail h2').getByText(longProject, { exact: true }).waitFor();
          await screen.locator('.qp-project-paths li').first().waitFor();
          assert.match(await screen.locator('.qp-project-paths').innerText(), /\/synthetic\/Project 6\/path-/);
          assert.ok(await occupied.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'long Thai Projects identity overflows mobile');
          await occupied.screenshot({ path: resolve(output, 'projects-occupied-th-light-390-long.png'), fullPage: true });
          await screen.locator('.qp-project-search input').fill('no-project-layout-match');
          await screen.locator('.qp-project-cards').getByText(messages['redesign.noProjects'], { exact: true }).waitFor();
          assert.equal(await screen.locator('.qp-project-card').count(), 0);
          assert.equal(await screen.locator('.qp-project-top').count(), 0);
        }
      } finally { await occupied.close(); }
    }
  } finally {
    db.transaction(() => {
      db.exec('DELETE FROM usage_event WHERE session_id BETWEEN 200 AND 229; DELETE FROM session WHERE id BETWEEN 200 AND 229;');
    })();
  }
  writeFileSync(resolve(output, 'projects-occupied-layout.json'), JSON.stringify({ database: 'in-memory synthetic', fixture: { projects: 8, addedSessions: 30, selectedProjectSessions: 25, selectedProjectCalls: 76, selectedProjectRoutes: 3 }, checks: ['ranking below details in same column', 'first six cards and complete rail in concept viewport', 'en/th and dark/light', 'weighted native and API monetary coverage', 'ranking selects project', '20/5 session pagination', '390/900/1280 overflow', 'exact source/harness/project/session History scope', 'long Thai identity and observed paths', 'empty filtered cards and ranking'], captures: projectCaptures }, null, 2));
  // Occupied Cost: five recorded providers, nine models (top eight), seven projects,
  // twelve sessions (top ten), with values distributed through a 30-day scope.
  const costCaptures: unknown[] = [];
  const costFrom = now - 30 * 86400000;
  const costTo = now + 1;
  const addCostSession = db.prepare('INSERT INTO session(id,source_id,native_session_id,project,last_seen_at) VALUES (?,1,?,?,?)');
  const addCostUsage = db.prepare("INSERT INTO usage_event(source_id,session_id,dedup_key,ts,model,provider,total_tokens,call_count,cost_usd,cost_source) VALUES (1,?,?,?,?,?,?,1,?,'computed')");
  db.transaction(() => {
    for (let index = 0; index < 10; index++) {
      addCostSession.run(300 + index, `cost-session-${index}`, `Cost project ${index % 5}`, now - 100);
      addCostUsage.run(300 + index, `cost-layout-${index}`, now - index * 3 * 86400000, `cost-model-${index % 7}`, ['openrouter', 'anthropic', 'provider-a', 'provider-b', 'provider-c'][index % 5], 1000 * (index + 1), index + 1);
    }
  })();
  try {
    for (const lang of ['en', 'th'] as const) for (const theme of ['dark', 'light'] as const) {
      const messages = lang === 'en' ? englishMessages : thaiMessages;
      const candidate = await browser.newPage({ viewport: { width: 1672, height: 941 }, reducedMotion: 'reduce', deviceScaleFactor: 1, timezoneId: 'Asia/Bangkok' });
      try {
        candidate.on('pageerror', error => errors.push(error.message));
        await candidate.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
        await candidate.addInitScript(({ lang, theme }) => {
          (window as unknown as { __QUOTAPULSE_TOKEN__: string }).__QUOTAPULSE_TOKEN__ = 'history-test';
          localStorage.setItem('quotapulse-prefs', JSON.stringify({ lang, currency: 'USD', rate: 1, hiddenSubscriptions: [] }));
          localStorage.setItem('quotapulse-theme', theme);
        }, { lang, theme });
        await candidate.clock.setFixedTime(now);
        const costUrl = `http://127.0.0.1:7801/#cost?range=custom&from=${costFrom}&to=${costTo}&source=1`;
        await candidate.goto(costUrl);
        const screen = candidate.getByTestId('production-cost');
        await screen.getByRole('heading', { name: messages['redesign.costHeading'], exact: true }).waitFor();
        await screen.locator('.qp-cost-sessions tbody tr').nth(9).waitFor();
        await candidate.evaluate(() => document.fonts.ready);
        const money = (amount: number) => new Intl.NumberFormat(lang === 'th' ? 'th-TH' : 'en-US', { style: 'currency', currency: 'USD' }).format(amount);
        assert.equal(await screen.locator('.qp-cost-summary .qp-cost-value > span').first().textContent(), money(65.4));
        assert.equal(await screen.locator('.qp-cost-providers li').count(), 5);
        assert.equal(await screen.locator('.qp-cost-models tbody tr').count(), 8);
        assert.equal(await screen.locator('.qp-cost-projects tbody tr').count(), 6);
        assert.equal(await screen.locator('.qp-cost-sessions tbody tr').count(), 10);
        assert.ok(await screen.locator('.qp-cost-column').evaluateAll(nodes => nodes.some(node => node.getBoundingClientRect().height === 0)), 'Empty Cost buckets show nonzero bars');
        assert.ok((await screen.locator('.qp-cost-chart').getAttribute('aria-label'))?.includes(messages['redesign.costPricedTokens']));
        const regions = await screen.evaluate(node => Object.fromEntries(['.qp-cost-summary', '.qp-cost-providers', '.qp-cost-trend', '.qp-cost-models', '.qp-cost-projects', '.qp-cost-sessions', '.qp-cost-insights'].map(selector => {
          const { x, y, width, height, bottom } = node.querySelector(selector)!.getBoundingClientRect();
          return [selector, { x, y, width, height, bottom }];
        })));
        assert.equal(regions['.qp-cost-summary'].y, regions['.qp-cost-providers'].y, 'Cost provider breakdown is below the summary');
        assert.ok(regions['.qp-cost-providers'].x >= regions['.qp-cost-summary'].x + regions['.qp-cost-summary'].width, 'Provider panel overlaps summary');
        assert.equal(regions['.qp-cost-trend'].y, regions['.qp-cost-models'].y, 'Cost models do not share the trend row');
        for (const selector of ['.qp-cost-projects', '.qp-cost-sessions', '.qp-cost-insights']) assert.ok(regions[selector].bottom < 941, `${lang}/${theme}: Cost outside viewport: ${JSON.stringify(regions)}`);
        const filename = `cost-occupied-${lang}-${theme}.png`;
        await candidate.screenshot({ path: resolve(output, filename), animations: 'disabled' });
        costCaptures.push({ lang, theme, filename, viewport: { width: 1672, height: 941 }, regions });
        for (const width of [390, 900, 1280]) {
          await candidate.setViewportSize({ width, height: 941 });
          assert.equal(await candidate.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${lang}/${theme}/${width}: occupied Cost overflow`);
        }
        // Exact model + provider drilldown, not a display-name search.
        await screen.locator('.qp-cost-models tbody tr').filter({ hasText: 'cost-model-2' }).getByRole('link').click();
        await candidate.waitForURL(/#history\?/);
        const modelScope = new URLSearchParams(new URL(candidate.url()).hash.split('?')[1]);
        assert.equal(modelScope.get('from'), String(costFrom)); assert.equal(modelScope.get('to'), String(costTo));
        assert.equal(modelScope.get('source'), '1'); assert.equal(modelScope.get('model'), 'cost-model-2'); assert.equal(modelScope.get('provider'), 'provider-c');
        await candidate.getByTestId('usage-history').locator('tbody tr').first().waitFor();
        assert.equal(await candidate.getByTestId('usage-history').locator('tbody tr').count(), 1);
        await candidate.goto(costUrl);
        await screen.locator('.qp-cost-projects tbody tr').first().waitFor();
        await screen.locator('.qp-cost-projects tbody tr').filter({ hasText: 'Cost project 4' }).getByRole('link').click();
        await candidate.waitForURL(/#history\?/);
        assert.equal(new URLSearchParams(new URL(candidate.url()).hash.split('?')[1]).get('project'), 'Cost project 4');
        await candidate.getByTestId('usage-history').locator('tbody tr').nth(1).waitFor();
        assert.equal(await candidate.getByTestId('usage-history').locator('tbody tr').count(), 2);
        if (lang === 'th' && theme === 'light') {
          await candidate.setViewportSize({ width: 390, height: 941 });
          db.prepare('UPDATE session SET project=?,native_session_id=? WHERE id=309').run('โครงการยาว '.repeat(18), 'cost-session-long-'.repeat(18));
          await candidate.goto(costUrl); await candidate.reload();
          await screen.locator('.qp-cost-sessions tbody tr').filter({ hasText: 'cost-session-long-' }).waitFor();
          assert.equal(await candidate.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'Long Cost identity overflows mobile');
          await candidate.screenshot({ path: resolve(output, 'cost-occupied-th-light-390-long.png'), fullPage: true });
          db.prepare('UPDATE session SET project=?,native_session_id=? WHERE id=309').run('Cost project 4', 'cost-session-9');
        }
      } finally { await candidate.close(); }
    }
  } finally {
    db.exec("DELETE FROM usage_event WHERE dedup_key LIKE 'cost-layout-%'; DELETE FROM session WHERE id BETWEEN 300 AND 309;");
  }
  writeFileSync(resolve(output, 'cost-occupied-layout.json'), JSON.stringify({ database: 'in-memory synthetic', fixture: { source: 1, addedSessions: 10, providers: 5, displayedModels: 8, displayedProjects: 6, displayedSessions: 10, apiValue: 65.4 }, checks: ['provider beside summary without overlap', 'models beside trend', 'complete occupied bottom panels in concept viewport', 'en/th and dark/light', '390/900/1280 overflow', 'exact model/provider/project History scope', 'zero empty-bucket bars', 'long Thai identities'], captures: costCaptures }, null, 2));
  await checkAlertsLayout(browser, db, output, errors, scheduler);
  assert.deepEqual(errors, []);
  assert.equal(requests.some(url => new URL(url).searchParams.get('offset') === '50'), true);
  writeFileSync(resolve(output, 'verification.json'), JSON.stringify({ database: 'in-memory synthetic', checks: ['real authenticated API', '53 records across pages', 'metadata details', 'pause suppresses fetch', 'pause ignores in-flight results', 'resume resets page', 'literal search', 'whole-range CSV', 'empty and unassigned', 'failed request retains snapshot and disables export', 'recovery', 'en/th, dark/light, 390/900/1440', 'currency preference', '30-minute call-only chart with aggregate exclusion', 'production overview uses scoped graph', 'fresh reader and two quota-history segments', 'safe pace and cache insight', 'activity opens session-scoped History', 'shared shell shows machine scope', 'shared command palette opens Settings and supports Ctrl+K to Providers', 'Projects grouped by exact project and filtered by harness, tab, metadata search', 'Projects trend and server-scoped Sessions tab', 'Projects opens exact scoped History', 'Projects responsive in English and Thai', 'Live call-only trend and aggregate exclusion', 'Live source-time sessions and metadata dialog', 'Live matrix scope and pause/resume', 'Live responsive in English and Thai', 'Providers retain known inactive catalog subscriptions and unbound sources', 'Providers compare one actual quota window and disclose exclusions', 'Providers link to scoped Settings and Health diagnostics', 'Providers responsive in English dark and Thai light', 'Models preserve model and recorded provider identity', 'Models show selected detail trend and priced-call coverage', 'Models provider filter and exact scoped History navigation', 'Models responsive in English dark and Thai light', 'Cost API/native basis separation and missing native value', 'Cost server-ranked sessions and exact History scope', 'Cost English dark desktop and Thai light mobile', 'Alerts threshold facts remain after current risk recovers', 'Alerts notification delivery toggle and reader advisory', 'Alerts English dark desktop and Thai light mobile', 'no page errors'], requestCount: requests.length, liveSessionRequests: liveRequests.length }, null, 2));
  console.log('History/Overview/Projects/Live/Providers/Models/Cost/Alerts E2E passed: authenticated HTTP and in-memory SQLite, scopes, pagination, pause, quota runway, drill-down, responsive layout.');
} finally {
  await browser?.close();
  console.log('History teardown: browser closed');
  await vite.close();
  console.log('History teardown: Vite closed');
  await daemon.close();
  console.log('History teardown: daemon closed');
  db.close();
  console.log('History teardown: database closed');
}
