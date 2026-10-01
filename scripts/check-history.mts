/** Real HTTP + in-memory SQLite E2E. Never opens the user's usage database. */
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { openDb } from '../packages/daemon/src/db/index.js';
import { buildServer } from '../packages/daemon/src/api/server.js';
import { Scheduler } from '../packages/daemon/src/ingest/scheduler.js';

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
const daemon = buildServer(db, new Scheduler(db, [], { pollMs: 1000000, detectMs: 1000000 }), { token: 'history-test', port: 7800, webRoot: resolve(root, 'packages/web/dist') });
const vite = await createServer({ root: resolve(root, 'packages/web'), server: { host: '127.0.0.1', port: 7801, strictPort: true, proxy: { '/api': { target: 'http://127.0.0.1:7800', changeOrigin: true } } } });
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
try {
  await daemon.listen({ host: '127.0.0.1', port: 7800 });
  await vite.listen();
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
  await page.addInitScript(() => { (window as unknown as { __QUOTAPULSE_TOKEN__: string }).__QUOTAPULSE_TOKEN__ = 'history-test'; });
  const errors: string[] = [];
  const requests: string[] = [];
  const liveRequests: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (request.url().includes('/api/usage-events')) requests.push(request.url()); if (request.url().includes('/api/live-sessions')) liveRequests.push(request.url()); });
  await page.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
  await page.goto('http://127.0.0.1:7801/#history?range=all');
  const history = page.getByTestId('usage-history');
  await history.getByText('1–50 of 53 records', { exact: true }).waitFor();
  await history.getByRole('button', { name: 'Next page', exact: true }).click();
  await history.getByText('51–53 of 53 records', { exact: true }).waitFor();
  await history.getByRole('button', { name: 'Record details 53', exact: true }).click();
  await page.getByRole('dialog').waitFor();
  assert.match(await page.getByRole('dialog').innerText(), /Session aggregate|session_aggregate/);
  await page.keyboard.press('Escape');
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
  await page.goto('http://127.0.0.1:7801/#live');
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
  await overview.getByTestId('quota-history').locator('summary').click();
  await overview.getByTestId('quota-history').locator('.qp-history-segments ol').first().waitFor();
  assert.equal(await overview.getByTestId('quota-history').locator('.qp-history-segments ol').count(), 2);
  await overview.getByTestId('quota-history').locator('summary').click();
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
  await page.screenshot({ path: resolve(output, 'overview-real-en-dark-1440.png'), fullPage: true });
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
  await page.goto('http://127.0.0.1:7801/#live?mode=redesign');
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
  await providers.locator('.qp-provider-card').filter({ hasText: 'Hermes test' }).getByRole('button', { name: 'Hermes test' }).click();
  await providers.locator('.qp-provider-detail').getByText('No quota percentage published').waitFor();
  await page.screenshot({ path: resolve(output, 'providers-real-en-dark-1440.png'), fullPage: true });
  await providers.locator('.qp-provider-card').filter({ hasText: 'Hermes test' }).getByRole('link', { name: 'Open diagnostics' }).click();
  await page.waitForURL(/#health\?source_id=2/);
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
  assert.deepEqual(errors, []);
  assert.equal(requests.some(url => new URL(url).searchParams.get('offset') === '50'), true);
  writeFileSync(resolve(output, 'verification.json'), JSON.stringify({ database: 'in-memory synthetic', checks: ['real authenticated API', '53 records across pages', 'metadata details', 'pause suppresses fetch', 'pause ignores in-flight results', 'resume resets page', 'literal search', 'whole-range CSV', 'empty and unassigned', 'failed request retains snapshot and disables export', 'recovery', 'en/th, dark/light, 390/900/1440', 'currency preference', '30-minute call-only chart with aggregate exclusion', 'production overview uses scoped graph', 'fresh reader and two quota-history segments', 'safe pace and cache insight', 'activity opens session-scoped History', 'Projects grouped by exact project and filtered by harness, tab, metadata search', 'Projects trend and server-scoped Sessions tab', 'Projects opens exact scoped History', 'Projects responsive in English and Thai', 'Live call-only trend and aggregate exclusion', 'Live source-time sessions and metadata dialog', 'Live matrix scope and pause/resume', 'Live responsive in English and Thai', 'Providers retain known inactive catalog subscriptions and unbound sources', 'Providers compare one actual quota window and disclose exclusions', 'Providers link to scoped Settings and Health diagnostics', 'Providers responsive in English dark and Thai light', 'no page errors'], requestCount: requests.length, liveSessionRequests: liveRequests.length }, null, 2));
  console.log('History/Overview/Projects/Live/Providers E2E passed: authenticated HTTP and in-memory SQLite, scopes, pagination, pause, quota runway, drill-down, responsive layout.');
} finally {
  await browser?.close();
  await vite.close();
  await daemon.close();
  db.close();
}
