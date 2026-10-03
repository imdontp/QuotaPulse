/** Repeatability gate; synthetic production captures, not approved visual baselines. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, type Page, type Request } from 'playwright';
import { openDb } from '../packages/daemon/src/db/index.js';
import { buildServer } from '../packages/daemon/src/api/server.js';
import { Scheduler } from '../packages/daemon/src/ingest/scheduler.js';
import { recordQuotaAlerts } from '../packages/daemon/src/api/queries.js';
import type { Overview, MinuteTrendResponse, ProjectDetailResponse, DetailedProjectResponse, DetailedModelResponse, ModelDetailResponse, CostAnalysisResponse, QuotaHistoryResponse, AlertEvent } from '../packages/web/src/api.js';
import { dimensions, type RuntimeGraph } from '../packages/web/src/redesign/model.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const priorTimezone = process.env.TZ;
process.env.TZ = 'Asia/Bangkok';
const liveOnly = process.env.QUOTAPULSE_CAPTURE_SCOPE === 'live';
const compositionOnly = process.env.QUOTAPULSE_CAPTURE_SCOPE === 'composition';
const overviewOnly = process.env.QUOTAPULSE_CAPTURE_SCOPE === 'overview';
const projectsOnly = process.env.QUOTAPULSE_CAPTURE_SCOPE === 'projects';
const providersOnly = process.env.QUOTAPULSE_CAPTURE_SCOPE === 'providers';
const modelsOnly = process.env.QUOTAPULSE_CAPTURE_SCOPE === 'models';
const costOnly = process.env.QUOTAPULSE_CAPTURE_SCOPE === 'cost';
const historyOnly = process.env.QUOTAPULSE_CAPTURE_SCOPE === 'history';
const alertsOnly = process.env.QUOTAPULSE_CAPTURE_SCOPE === 'alerts';
const output = resolve(root, liveOnly ? 'screens/live-density' : compositionOnly ? 'screens/reference-composition' : overviewOnly ? 'screens/overview-layout' : projectsOnly ? 'screens/projects-cards' : providersOnly ? 'screens/providers-comparison' : modelsOnly ? 'screens/models-comparison' : costOnly ? 'screens/cost-axes' : historyOnly ? 'screens/history-details' : alertsOnly ? 'screens/alerts-refinement' : 'screens/stable-captures');
mkdirSync(output, { recursive: true });
// A failed attempt must never leave a previous success manifest in this folder.
rmSync(resolve(output, 'verification.json'), { force: true });
const fixedNow = Date.parse('2026-05-17T13:42:00.000Z');
// Freeze Date only, keeping real timers/performance for HTTP, browser and cleanup.
// This applies to internal query helpers too, without changing production clocks.
const realDate = globalThis.Date;
globalThis.Date = new Proxy(realDate, {
  construct(target, args) { return Reflect.construct(target, args.length ? args : [fixedNow]); },
  apply() { return new realDate(fixedNow).toString(); },
  get(target, property, receiver) { return property === 'now' ? () => fixedNow : Reflect.get(target, property, receiver); },
});
const db = openDb(':memory:');
db.exec(`INSERT INTO source(id,harness,profile,root_path,display_name,detected_at,account_key,account_provider,account_display_name,account_state,account_last_success_at)
  VALUES (1,'codex','fixed','/synthetic/nonexistent','Codex fixture',0,'openai:subscription','openai','OpenAI fixture','active',${fixedNow}),
    (2,'hermes','fixed','/synthetic/nonexistent','Hermes fixture',0,'anthropic:fixture','anthropic','Anthropic fixture','active',${fixedNow});`);
const session = db.prepare('INSERT INTO session(id,source_id,native_session_id,project,last_seen_at) VALUES (?,?,?,?,?)');
const usage = db.prepare("INSERT INTO usage_event(source_id,session_id,dedup_key,ts,model,provider,input_tokens,cached_input_tokens,output_tokens,total_tokens,call_count,cost_usd,cost_source) VALUES (?,?,?,?,?,?,40,20,40,100,?,?,?)");
for (let index = 0; index < 12; index++) {
  const source = index % 2 + 1;
  session.run(index + 1, source, `fixture-session-${index}`, `Fixture project ${index % 8}`, fixedNow - 10_000);
  for (let call = 0; call < 3; call++) usage.run(source, index + 1, `fixed-${index}-${call}`, fixedNow - (index + call + 1) * 30_000, `fixture-model-${index % 8}`, ['openai', 'anthropic', 'openrouter', 'provider-fixture'][index % 4], call + 1, (index + 1) / 100, index === 0 ? 'native' : 'computed');
}
// Values below the old visual minimum catch inflated nonzero bars in both charts.
const tinyUsage = db.prepare("INSERT INTO usage_event(source_id,session_id,dedup_key,ts,model,provider,input_tokens,cached_input_tokens,output_tokens,total_tokens,call_count,cost_usd,cost_source) VALUES (1,1,?,?,'fixture-model-0','openai',1,0,0,1,1,0,'computed')");
tinyUsage.run('fixed-tiny-minute', fixedNow - 15 * 60_000);
tinyUsage.run('fixed-tiny-day', fixedNow - 3 * 86_400_000);
const quota = db.prepare("INSERT INTO limit_sample(source_id,window_kind,used_percent,resets_at,observed_at,last_seen_at,source_fetched_at,origin) VALUES (?,'5h',?,?,?,?,?,'fixed-fixture')");
// Complete history must include older reset periods, nulls and more than eight
// readings per period, without changing the latest live quota/default selection.
for (let segment = 0; segment < 4; segment++) for (let index = 0; index < 12; index++) {
  const at = fixedNow - (5 - segment) * 3_600_000 + index * 60_000;
  quota.run(1, index === 4 ? null : index === 1 ? 0.5 : index * 8, segment === 0 ? null : fixedNow - (4 - segment) * 3_600_000, at, at, at);
}
for (const [percent, minutes] of [[0, 50], [10, 35], [20, 20], [38, 5], [97, 1]]) {
  const at = fixedNow - minutes * 60_000; quota.run(1, percent, fixedNow + 7_200_000, at, at, at);
}
quota.run(2, 85, fixedNow + 7_200_000, fixedNow - 30_000, fixedNow - 30_000, fixedNow - 30_000);
recordQuotaAlerts(db, fixedNow);
const scheduler = new Scheduler(db, [], { pollMs: 1_000_000, detectMs: 1_000_000 });
const daemon = buildServer(db, scheduler, { token: 'stable-capture-test', port: 7804, webRoot: resolve(root, 'packages/web/dist') });
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
const errors: string[] = [];
const forbidden: string[] = [];
const chartChecks: Array<{ page: string; lang: string; theme: string; buckets: number; tokens: number }> = [];
const modelCostChecks: Array<{ route: string; lang: string; theme: string; buckets: number; collapsedBottom: number }> = [];
const quotaChecks: Array<{ page: string; lang: string; theme: string; segments: number; samples: number; unknown: number }> = [];
const runtimeChecks: Array<{ lang: string; theme: string; nodes: number; edges: number; inspected: number }> = [];
const shellChecks: Array<{ page: string; lang: string; theme: string; modal: boolean; backgroundExcluded: boolean }> = [];
const headerChecks: Array<{ page: string; lang: string; theme: string; width: number; height: number; sidebarWidth: number }> = [];
const fontChecks: Array<{ page: string; lang: string; theme: string; family: string; custom: boolean; glyphs: number }> = [];
const cases: Array<{ page: string; lang: string; theme: string; filename: string; sha256: string; repeatSha256?: string; changedPixels?: number; maxChannelDelta?: number; semanticContrasts: Array<{ role: string; color: string; minimumRatio: number }>; checkedElements: string[] }> = [];
const overviewLayouts: Array<{ lang: string; theme: string; heroBottom: number; activityBottom: number; models: number; railHeight: number }> = [];
const referenceColumnChecks: Array<{ page: string; lang: string; theme: string; headerTop: number; railTop: number; summaryRight: number; railLeft: number }> = [];
const liveDensityChecks: Array<{ lang: string; theme: string; bottom: number; sessions: number; records: number }> = [];
const projectCardChecks: Array<{ lang: string; theme: string; cards: number; bottom: number; unknownNative: number }> = [];
const providerChecks: Array<{ lang: string; theme: string; bottom: number; compared: number; unavailable: boolean; expired: boolean; proportional: boolean }> = [];
const modelComparisonChecks: Array<{ lang: string; theme: string; bottom: number; rows: number; ratios: number; boundaryRatios: boolean }> = [];
const costAxisChecks: Array<{ route: string; lang: string; theme: string; priced: boolean; maxAmount: number; maxTokens: number }> = [];
const historyChecks: Array<{ lang: string; theme: string; eventId: number; widths: number[]; modal: boolean; focusRestored: boolean }> = [];
const historyDensityChecks: Array<{ lang: string; theme: string; bottom: number; visibleRows: number; records: number; keyboardScrolled: boolean }> = [];
const alertChecks: Array<{ lang: string; theme: string; bottom: number; events: number; expandedEvents: number; keyboardScrolled: boolean; empty: boolean }> = [];
const sha = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
const fontPath = 'fonts/noto-sans-thai/';
const fontProvenance = JSON.parse(readFileSync(resolve(root, `packages/web/public/${fontPath}provenance.json`), 'utf8'));
assert.equal(sha(readFileSync(resolve(root, `packages/web/dist/${fontPath}NotoSansThai-variable.ttf`))), fontProvenance.sha256);
assert.deepEqual(readFileSync(resolve(root, `packages/web/dist/${fontPath}OFL.txt`)), readFileSync(resolve(root, `packages/web/public/${fontPath}OFL.txt`)));
const rendererArgs = ['--disable-gpu', '--deterministic-mode', '--disable-skia-runtime-opts', '--force-color-profile=srgb'];
const allPages = [
  ['overview', '.qp-activity-item'], ['live', '.qp-live-chart'],
  ['projects', '.qp-project-trend'], ['providers', '.qp-provider-health tbody tr'],
  ['models', '.qp-model-trend'], ['cost', '.qp-cost-chart'],
  ['history', '[data-testid="usage-history"] tbody tr'], ['alerts', '.qp-quota-point'],
] as const;
const pages = liveOnly ? allPages.filter(([destination]) => destination === 'live') : compositionOnly ? allPages.filter(([destination]) => ['overview', 'live', 'models'].includes(destination)) : overviewOnly ? allPages.filter(([destination]) => destination === 'overview') : projectsOnly ? allPages.filter(([destination]) => destination === 'projects') : providersOnly ? allPages.filter(([destination]) => destination === 'providers') : modelsOnly ? allPages.filter(([destination]) => destination === 'models') : costOnly ? allPages.filter(([destination]) => destination === 'cost') : historyOnly ? allPages.filter(([destination]) => destination === 'history') : alertsOnly ? allPages.filter(([destination]) => destination === 'alerts') : allPages;

async function checkLiveDensity(page: Page, lang: string, theme: string) {
  await page.setViewportSize({ width: 1672, height: 941 });
  await page.evaluate(() => window.scrollTo(0, 0));
  const bottom = await page.locator('.qp-live-records').evaluate(element => element.getBoundingClientRect().bottom);
  assert.ok(bottom <= 941, `Live feed and pagination exceed viewport: ${bottom}`);
  const sessions = page.locator('.qp-live-table tbody tr');
  const records = page.locator('.qp-live-feed li');
  assert.equal(await sessions.count(), 10); assert.equal(await records.count(), 8);
  const query = new URLSearchParams({ detailed: '1', from: String(fixedNow - 30 * 60_000), to: String(fixedNow + 1) });
  const response = await daemon.inject({ method: 'GET', url: `/api/models?${query}`, headers: { 'x-quotapulse-token': 'stable-capture-test' } });
  assert.equal(response.statusCode, 200);
  const models = response.json<DetailedModelResponse>();
  const matrix = page.locator('.qp-live-matrix li');
  assert.equal(await matrix.count(), models.groups.slice(0, 12).length);
  const format = new Intl.NumberFormat(lang === 'th' ? 'th-TH' : 'en-US');
  for (const [index, group] of models.groups.slice(0, 12).entries()) {
    assert.equal(await matrix.nth(index).locator('strong').textContent(), format.format(group.tokens));
    const width = await matrix.nth(index).locator('.qp-bar>span').evaluate(element => parseFloat((element as HTMLElement).style.width));
    assert.ok(Math.abs(width - group.tokens / models.totals.tokens * 100) < 0.0001);
  }
  for (const selector of ['.qp-live-table', '.qp-live-feed']) {
    const region = page.locator(selector);
    await region.focus(); await page.keyboard.press('End');
    await page.waitForFunction(selector => {
      const element = document.querySelector(selector)!;
      return element.scrollTop > 0 && element.scrollTop + element.clientHeight >= element.scrollHeight - 1;
    }, selector);
    const bounds = await region.evaluate(element => {
      const last = element.querySelector('tbody tr:last-child, li:last-child')!.getBoundingClientRect();
      return { last: last.bottom, bottom: element.getBoundingClientRect().bottom };
    });
    assert.ok(bounds.last <= bounds.bottom + 1, `${selector} final record is not keyboard reachable`);
    await region.evaluate(element => { element.scrollTop = 0; });
  }
  const target = sessions.last().getByRole('button');
  await target.focus(); await page.keyboard.press('Enter');
  const detail = page.locator('.qp-live-dialog[open]'); await detail.waitFor();
  assert.equal(await detail.locator('dd').first().textContent(), await target.textContent());
  await page.keyboard.press('Escape'); await detail.waitFor({ state: 'hidden' });
  assert.equal(await target.evaluate(element => element === document.activeElement), true);
  await page.locator('.qp-live-table').evaluate(element => { element.scrollTop = 0; });
  liveDensityChecks.push({ lang, theme, bottom, sessions: await sessions.count(), records: await records.count() });
}

async function checkModelComparison(page: Page, lang: string, theme: string, pending: Set<Request>) {
  await page.setViewportSize({ width: 1672, height: 941 }); await page.evaluate(() => window.scrollTo(0, 0));
  const bottom = await page.locator('.qp-model-providers').evaluate(element => element.getBoundingClientRect().bottom);
  assert.ok(bottom <= 941, `Model comparison/provider panels exceed viewport: ${bottom}`);
  const month = new Date(fixedNow); month.setDate(1); month.setHours(0, 0, 0, 0);
  const query = new URLSearchParams({ detailed: '1', from: String(month.getTime()), to: String(fixedNow + 1) });
  const result = await daemon.inject({ method: 'GET', url: `/api/models?${query}`, headers: { 'x-quotapulse-token': 'stable-capture-test' } });
  assert.equal(result.statusCode, 200); const data = result.json<DetailedModelResponse>();
  const rows = page.locator('.qp-model-table-wrap tbody tr'); assert.equal(await rows.count(), 8);
  assert.equal(await page.locator('.qp-model-summary-icon').count(), 4);
  for (const group of data.groups) {
    const row = rows.filter({ has: page.getByRole('button', { name: group.model!, exact: true }) });
    const input = group.inputTokens + group.cachedInputTokens + group.cacheWriteTokens;
    const values = [group.cachedInputTokens / input * 100, (group.native_calls + group.computed_calls + group.estimated_calls) / group.calls * 100];
    const bars = row.locator('.qp-model-ratio .qp-bar>span'); assert.equal(await bars.count(), 2);
    for (const [index, value] of values.entries()) assert.ok(Math.abs(parseFloat((await bars.nth(index).getAttribute('style'))!.split(':')[1]) - value) < 0.0001);
  }
  const last = rows.last().getByRole('button'); const identity = await last.locator('.qp-model-name').textContent();
  await last.focus(); await page.keyboard.press('Enter'); await settled(page, pending);
  assert.equal(await last.getAttribute('aria-pressed'), 'true');
  assert.equal(await page.locator('.qp-model-detail h3').textContent(), identity);
  await page.locator('.qp-model-search input').fill('no-such-synthetic-model'); assert.equal(await rows.count(), 0);
  await page.locator('.qp-model-search input').fill('');
  const fixture = structuredClone(data);
  fixture.groups[0].inputTokens = 0; fixture.groups[0].cachedInputTokens = 0; fixture.groups[0].cacheWriteTokens = 0; fixture.groups[0].calls = 0;
  fixture.groups[1].cachedInputTokens = 0;
  fixture.groups[1].native_calls = 0; fixture.groups[1].computed_calls = 0; fixture.groups[1].estimated_calls = 0;
  fixture.groups[2].inputTokens = 199; fixture.groups[2].cachedInputTokens = 1; fixture.groups[2].cacheWriteTokens = 0;
  fixture.groups[2].calls = 200; fixture.groups[2].native_calls = 0; fixture.groups[2].computed_calls = 1; fixture.groups[2].estimated_calls = 0;
  const pattern = '**/api/models?*';
  await page.route(pattern, route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(fixture) }));
  try {
    await page.goto('http://127.0.0.1:7804/?model-ratios=boundary#models', { waitUntil: 'domcontentloaded' });
    await page.locator('.qp-model-table-wrap tbody tr').first().waitFor(); await settled(page, pending);
    for (const [index, expected] of [[0, null], [1, 0], [2, 0.5]] as const) {
      const row = page.locator('.qp-model-table-wrap tbody tr').filter({ has: page.getByRole('button', { name: fixture.groups[index].model!, exact: true }) });
      const bars = row.locator('.qp-model-ratio .qp-bar>span');
      if (expected === null) { assert.equal(await bars.count(), 0); assert.equal(await row.locator('td').nth(6).textContent(), '—'); assert.equal(await row.locator('td').nth(7).textContent(), '—'); }
      else { assert.equal(await bars.count(), 2); for (const bar of await bars.all()) assert.equal(await bar.evaluate(element => parseFloat(element.style.width)), expected); }
    }
    for (const width of [390, 900, 1280]) { await page.setViewportSize({ width, height: 941 }); assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true); }
  } finally { await page.unroute(pattern); }
  modelComparisonChecks.push({ lang, theme, bottom, rows: data.groups.length, ratios: data.groups.length * 2, boundaryRatios: true });
}

async function checkAlerts(page: Page, lang: string, theme: string, pending: Set<Request>) {
  await page.setViewportSize({ width: 1672, height: 941 }); await page.evaluate(() => scrollTo(0, 0));
  const bottom = await page.locator('.qp-alert-layout').evaluate(element => element.getBoundingClientRect().bottom + scrollY);
  assert.ok(bottom <= 941, `Alerts occupied panels exceed viewport: ${bottom}`);
  assert.deepEqual(await page.locator('.qp-alert-rules [data-threshold]').allTextContents(), ['50%', '80%', '95%']);
  for (const [threshold, color] of [[80, '--qp-warning'], [95, '--qp-danger']] as const) {
    const swatch = await page.locator(`.qp-alert-history [data-threshold="${threshold}"]`).first().evaluate((element, color) => ({ actual: getComputedStyle(element).color, expected: getComputedStyle(document.querySelector('.qp-redesign')!).getPropertyValue(color).trim() }), color);
    assert.deepEqual(rgb(swatch.actual), rgb(swatch.expected));
  }
  const response = await daemon.inject({ method: 'GET', url: '/api/alerts?limit=100', headers: { 'x-quotapulse-token': 'stable-capture-test' } });
  assert.equal(response.statusCode, 200); const events = response.json<{ events: AlertEvent[] }>().events;
  const items = page.locator('.qp-alert-history li'); assert.equal(await items.count(), events.length);
  for (const [index, event] of events.entries()) {
    assert.equal(await items.nth(index).locator('.qp-alert-event-threshold').innerText(), `${event.threshold}%`);
    assert.ok((await items.nth(index).locator('strong').innerText()).includes(event.subscription_display_name ?? event.display_name));
  }
  const more = page.locator('.qp-alert-history button'); const originalLabel = await more.innerText();
  const expanded = page.waitForResponse(response => response.url().includes('/api/alerts?limit=500'));
  await more.focus(); await page.keyboard.press('Enter'); assert.equal((await expanded).status(), 200); await settled(page, pending);
  assert.notEqual(await more.innerText(), originalLabel);
  const collapsed = page.waitForResponse(response => response.url().includes('/api/alerts?limit=100'));
  await page.keyboard.press('Enter'); assert.equal((await collapsed).status(), 200); await settled(page, pending);
  assert.equal(await more.innerText(), originalLabel);
  assert.ok(events.length > 0);
  const pattern = '**/api/alerts?*';
  for (const state of ['large', 'empty']) {
    const fixture = state === 'empty' ? [] : Array.from({ length: 60 }, (_, index) => ({ ...events[index % events.length], id: 1000 + index }));
    await page.route(pattern, route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ events: fixture }) }));
    try {
      await page.goto(`http://127.0.0.1:7804/?alert-history=${state}#alerts`, { waitUntil: 'domcontentloaded' });
      await page.locator('.qp-alert-history').waitFor(); await settled(page, pending);
      assert.equal(await page.locator('.qp-alert-history li').count(), fixture.length);
      assert.ok(await page.locator('.qp-alert-layout').evaluate(element => element.getBoundingClientRect().bottom + scrollY <= 941));
      const list = page.locator('.qp-alert-history ol');
      if (state === 'empty') assert.equal(await list.count(), 0);
      else {
        await list.focus(); await page.keyboard.press('End'); await page.waitForTimeout(300);
        assert.ok(await list.evaluate(element => element.scrollTop > 0));
        assert.ok(await list.evaluate(element => element.lastElementChild!.getBoundingClientRect().bottom <= element.getBoundingClientRect().bottom + 1));
        for (const width of [390, 900, 1280]) { await page.setViewportSize({ width, height: 941 }); assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true); }
        await page.setViewportSize({ width: 1672, height: 941 });
      }
    } finally { await page.unroute(pattern); }
  }
  alertChecks.push({ lang, theme, bottom, events: events.length, expandedEvents: 60, keyboardScrolled: true, empty: true });
}

async function checkHistoryDetails(page: Page, lang: string, theme: string, pass: number, pending: Set<Request>) {
  const history = page.getByTestId('usage-history');
  const trigger = history.locator('tbody tr').first().getByRole('button');
  const eventId = Number((await trigger.innerText()).slice(1));
  const response = await daemon.inject({ method: 'GET', url: `/api/usage-events?from=0&to=${fixedNow}&limit=50`, headers: { 'x-quotapulse-token': 'stable-capture-test' } });
  assert.equal(response.statusCode, 200);
  const row = response.json().rows.find((row: { event_id: number }) => row.event_id === eventId);
  assert.ok(row);
  await trigger.focus(); await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog'); await dialog.waitFor();
  assert.equal(await dialog.evaluate(element => element.matches(':modal')), true);
  assert.equal(await history.locator('tr[data-selected=true]').count(), 1);
  assert.equal(await history.locator('tr[data-selected=true] button').innerText(), `#${eventId}`);
  const groups = dialog.locator('.qp-history-detail-groups section'); assert.equal(await groups.count(), 4);
  const tokens = dialog.locator('[data-group="history.tokenBreakdown"] dd');
  for (const [index, value] of [row.total_tokens, row.input_tokens, row.cached_input_tokens, row.cache_write_tokens, row.output_tokens, row.reasoning_tokens].entries()) {
    assert.equal(await tokens.nth(index).innerText(), value.toLocaleString(lang));
  }
  for (const value of [row.project, row.harness, row.provider, row.vendor, row.model]) assert.ok((await groups.first().innerText()).includes(value));
  await page.evaluate(() => window.scrollTo(0, 0)); await settled(page, pending);
  const filename = `history-selected-${lang}-${theme}.png`;
  const screenshot = await page.screenshot({ path: resolve(output, pass === 0 ? filename : `repeat-${filename}`), animations: 'disabled' });
  if (pass === 0) cases.push({ page: 'history-selected', lang, theme, filename, sha256: sha(screenshot), semanticContrasts: [], checkedElements: ['API-matched recorded metadata', 'native modal', 'selected record'] });
  else {
    const item = cases.find(item => item.filename === filename)!; item.repeatSha256 = sha(screenshot);
    const difference = await comparePixels(page, readFileSync(resolve(output, filename)), screenshot);
    item.changedPixels = difference.changedPixels; item.maxChannelDelta = difference.maxChannelDelta;
    assert.ok(difference.maxChannelDelta <= 2 && difference.changedPixels / difference.pixelCount <= 0.0001, `${filename}: ${JSON.stringify(difference)}`);
  }
  if (pass === 0) {
    for (const width of [390, 900, 1280]) {
      await page.setViewportSize({ width, height: 941 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      assert.equal(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth), true);
      const box = await dialog.boundingBox(); assert.ok(box && box.x >= 0 && box.x + box.width <= width && box.height <= 941);
      await dialog.evaluate(element => { element.scrollTop = element.scrollHeight; });
      const heading = await dialog.locator('.qp-history-detail-heading').boundingBox(); assert.ok(heading && heading.y >= box.y && heading.y + heading.height <= box.y + box.height);
    }
    await dialog.getByRole('button').first().focus();
    let browserFocusStep = false;
    for (let index = 0; index < 10; index++) {
      await page.keyboard.press('Tab');
      const focus = await dialog.evaluate(element => element.contains(document.activeElement) ? 'dialog' : document.activeElement === document.body ? 'browser' : 'background');
      assert.notEqual(focus, 'background', 'Modal allowed focus on a background control');
      assert.ok(!(browserFocusStep && focus === 'browser'), 'Tab did not return from browser chrome to the modal');
      browserFocusStep = focus === 'browser';
    }
    await dialog.getByRole('button').first().focus();
    await trigger.evaluate(element => element.focus());
    assert.equal(await dialog.evaluate(element => element.contains(document.activeElement)), true, 'Background control accepted programmatic focus');
  }
  await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'hidden' });
  assert.equal(await trigger.evaluate(element => element === document.activeElement), true);
  assert.equal(await history.locator('tr[data-selected=true]').count(), 0);
  if (pass === 0) historyChecks.push({ lang, theme, eventId, widths: [390, 900, 1280], modal: true, focusRestored: true });
  await page.setViewportSize({ width: 1672, height: 941 }); await page.evaluate(() => window.scrollTo(0, 0));
}
async function checkHistoryDensity(page: Page, lang: string, theme: string) {
  const history = page.getByTestId('usage-history');
  const region = history.locator('.qp-history-table');
  const geometry = await region.evaluate(element => {
    const box = element.getBoundingClientRect();
    const rows = [...element.querySelectorAll('tbody tr')];
    return { visibleRows: rows.filter(row => { const rect = row.getBoundingClientRect(); return rect.top >= box.top && rect.bottom <= box.bottom; }).length, records: rows.length };
  });
  const bottom = await history.locator('.qp-history-records').evaluate(element => element.getBoundingClientRect().bottom + scrollY);
  console.log('History occupied geometry', lang, theme, { bottom, ...geometry });
  assert.ok(bottom <= 941, `History pagination outside desktop viewport: ${bottom}`);
  assert.ok(geometry.visibleRows >= 4, `Fewer than four complete History rows: ${geometry.visibleRows}`);
  assert.equal(geometry.records, 37, 'Scrollable region dropped displayed records');
  await region.focus(); await page.keyboard.press('End'); await page.waitForTimeout(300);
  assert.ok(await region.evaluate(element => element.scrollTop > 0), 'History region did not scroll with keyboard');
  const last = region.locator('tbody tr').last().getByRole('button');
  await last.focus(); await page.keyboard.press('Enter'); await page.getByRole('dialog').waitFor();
  assert.ok((await page.locator('#history-detail-title').innerText()).includes(await last.innerText()));
  await page.keyboard.press('Escape'); await page.getByRole('dialog').waitFor({ state: 'hidden' });
  assert.equal(await last.evaluate(element => element === document.activeElement), true);
  await region.evaluate(element => { element.scrollTop = 0; element.scrollLeft = 0; });
  await last.evaluate(element => element.blur()); await page.evaluate(() => scrollTo(0, 0));
  historyDensityChecks.push({ lang, theme, bottom, ...geometry, keyboardScrolled: true });
}
async function checkProviders(page: Page, lang: string, theme: string, pending: Set<Request>) {
  await page.setViewportSize({ width: 1672, height: 941 });
  await page.evaluate(() => window.scrollTo(0, 0));
  const bottom = await page.locator('.qp-provider-bottom').evaluate(element => element.getBoundingClientRect().bottom);
  assert.ok(bottom <= 941, `Provider comparison/reader panels exceed viewport: ${bottom}`);
  const result = await daemon.inject({ method: 'GET', url: '/api/overview', headers: { 'x-quotapulse-token': 'stable-capture-test' } });
  assert.equal(result.statusCode, 200);
  const data = result.json<Overview>();
  const latest = [1, 2].map(source => data.limits.filter(reading => reading.source_id === source && reading.window_kind === '5h').sort((a, b) => b.last_seen_at - a.last_seen_at)[0]);
  const rows = page.locator('.qp-provider-comparison li'); assert.equal(await rows.count(), 2);
  for (const [index, reading] of latest.entries()) {
    const bar = rows.nth(index).locator('.qp-bar');
    assert.equal(await bar.evaluate(element => element.style.getPropertyValue('--qp-quota-used')), `${reading.used_percent}%`);
    const heights = await bar.evaluate(element => ({ outer: element.getBoundingClientRect().height, inner: element.firstElementChild!.getBoundingClientRect().height }));
    assert.ok(Math.abs(heights.inner / heights.outer * 100 - reading.used_percent!) < 0.02);
    assert.ok((await rows.nth(index).locator('strong').textContent())!.includes(String(reading.used_percent)));
    const valueBox = await rows.nth(index).locator('strong').boundingBox();
    const barBox = await bar.boundingBox(); const nameBox = await rows.nth(index).locator('button').boundingBox();
    assert.ok(valueBox && barBox && nameBox && valueBox.y + valueBox.height <= barBox.y + barBox.height - heights.inner + 1 && nameBox.y >= barBox.y + barBox.height, 'Percent must sit above the observed bar and owner below its plot');
  }
  const last = rows.last().locator('button'); const owner = await last.locator('.qp-provider-comparison-name').textContent();
  await last.focus(); await page.keyboard.press('Enter');
  assert.equal(await last.getAttribute('aria-pressed'), 'true');
  assert.ok((await page.locator('.qp-provider-detail h2').textContent())!.includes(owner!));
  assert.equal(await page.locator('.qp-provider-inspector').getAttribute('open'), '');
  assert.equal(await page.locator('.qp-provider-detail').isVisible(), true);
  const inspectorToggle = page.locator('.qp-provider-inspector>summary');
  await inspectorToggle.focus(); await page.keyboard.press('Enter');
  assert.equal(await page.locator('.qp-provider-detail').isVisible(), false);
  await inspectorToggle.focus(); await page.keyboard.press('Enter');
  assert.equal(await page.locator('.qp-provider-detail').isVisible(), true);
  for (const width of [390, 900, 1280]) {
    await page.setViewportSize({ width, height: 941 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  }
  const pattern = '**/api/overview';
  for (const state of ['unknown', 'expired', 'tiny'] as const) {
    const fixture = structuredClone(data);
    for (const reading of fixture.limits) {
      if (state === 'unknown') reading.used_percent = null;
      else if (state === 'expired') reading.resets_at = fixedNow - 1;
      else reading.used_percent = reading.source_id === 1 ? 0.5 : 0;
    }
    await page.route(pattern, route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(fixture) }));
    try {
      await page.setViewportSize({ width: 1672, height: 941 });
      await page.goto(`http://127.0.0.1:7804/?provider-check=${state}#providers`, { waitUntil: 'domcontentloaded' });
      await page.locator('.qp-provider-health').waitFor(); await settled(page, pending);
      if (state !== 'tiny') { assert.equal(await page.locator('.qp-provider-comparison li').count(), 0); assert.equal(await page.locator('.qp-provider-comparison-chart').count(), 0); }
      else {
        const heights = await page.locator('.qp-provider-comparison li .qp-bar').evaluateAll(elements => elements.map(element => element.firstElementChild!.getBoundingClientRect().height));
        assert.equal(heights.length, 2); assert.ok(heights[0] > 0 && heights[0] < 1); assert.equal(heights[1], 0);
      }
    } finally { await page.unroute(pattern); }
  }
  providerChecks.push({ lang, theme, bottom, compared: latest.length, unavailable: true, expired: true, proportional: true });
}

async function checkProjectCards(page: Page, lang: string, theme: string, pending: Set<Request>) {
  const month = new Date(fixedNow); month.setDate(1); month.setHours(0, 0, 0, 0);
  const query = new URLSearchParams({ detailed: '1', trends: '1', from: String(month.getTime()), to: String(fixedNow + 1) });
  const result = await daemon.inject({ method: 'GET', url: `/api/projects?${query}`, headers: { 'x-quotapulse-token': 'stable-capture-test' } });
  assert.equal(result.statusCode, 200);
  const data = result.json<DetailedProjectResponse>();
  const cards = page.locator('.qp-project-card');
  assert.equal(await cards.count(), 8);
  const bottom = await page.locator('.qp-project-cards').evaluate(element => element.getBoundingClientRect().bottom);
  assert.ok(bottom <= 941, `Project card region exceeds canonical viewport: ${bottom}`);
  const money = new Intl.NumberFormat(lang === 'th' ? 'th-TH' : 'en-US', { style: 'currency', currency: 'USD' });
  for (const group of data.groups) {
    const card = cards.filter({ has: page.locator('.qp-project-card-identity>strong', { hasText: group.key! }) });
    assert.equal(await card.count(), 1);
    assert.equal(await card.evaluate(element => element.querySelector('.qp-project-card-facts')!.getBoundingClientRect().bottom <= element.getBoundingClientRect().bottom - 1), true, 'Project facts are clipped by the card');
    const actual = await card.locator('.qp-project-spark>circle').evaluateAll(elements => elements.map(element => ({ at: Number(element.getAttribute('data-at')), value: Number(element.getAttribute('data-value')) })));
    const expected = Array.from({ length: Math.ceil((data.scope.to - data.scope.from) / data.trends!.bucketMs) }, (_, index) => {
      const at = data.scope.from + index * data.trends!.bucketMs;
      return { at, value: data.trends!.points.find(point => point.project === group.key && point.start === at)?.tokens ?? 0 };
    });
    assert.deepEqual(actual, expected);
    assert.equal(actual.reduce((sum, point) => sum + point.value, 0), group.tokens);
    const values = card.locator('.qp-project-card-money>span');
    for (const [index, amount, priced] of [[0, group.reported_native_usd, group.native_calls], [1, group.api_value_usd, group.computed_calls + group.estimated_calls]]) {
      const expected = priced === 0 ? (lang === 'th' ? 'ไม่ทราบ' : 'Unknown') : `${money.format(amount)}${priced < group.calls ? '+' : ''}`;
      assert.equal(await values.nth(index).locator('.qp-cost-value>span:first-child').textContent(), expected);
      assert.ok((await values.nth(index).locator('.qp-cost-value').getAttribute('title'))!.includes(`${priced} / ${group.calls}`));
    }
  }
  assert.ok(data.groups.some(group => group.native_calls === 0));
  assert.ok(data.groups.some(group => group.native_calls > 0 && group.native_calls < group.calls));
  // Keyboard selection must keep the existing detail/identity behavior.
  const last = cards.last(); const identity = await last.locator('.qp-project-card-identity>strong').textContent();
  await last.focus(); await page.keyboard.press('Enter'); await settled(page, pending);
  const lastBounds = await last.boundingBox(); const regionBounds = await page.locator('.qp-project-cards').boundingBox();
  assert.ok(lastBounds && regionBounds && lastBounds.y >= regionBounds.y && lastBounds.y + lastBounds.height <= regionBounds.y + regionBounds.height + 1, 'Final project card is not keyboard reachable');
  assert.equal(await last.getAttribute('aria-pressed'), 'true');
  assert.ok((await page.locator('.qp-project-detail h2').textContent())!.includes(identity!));
  await page.locator('.qp-project-search input').fill('no-such-synthetic-project');
  assert.equal(await cards.count(), 0);
  await page.locator('.qp-project-search input').fill('');
  const first = cards.filter({ has: page.locator('.qp-project-card-identity>strong', { hasText: 'Fixture project 0' }) });
  await first.click(); await settled(page, pending);
  await first.evaluate(element => (element as HTMLElement).blur()); await page.evaluate(() => window.scrollTo(0, 0));
  projectCardChecks.push({ lang, theme, cards: data.groups.length, bottom, unknownNative: data.groups.filter(group => group.native_calls === 0).length });
}

async function settled(page: Page, pending: Set<Request>) {
  const deadline = performance.now() + 15_000;
  let idle = 0;
  while (idle < 12) {
    assert.ok(performance.now() < deadline, 'API requests did not settle');
    idle = pending.size === 0 ? idle + 1 : 0;
    await page.waitForTimeout(25);
  }
  await page.evaluate(() => document.fonts.ready);
  // Native form controls/compositor paints can outlive the last HTTP request.
  await page.waitForTimeout(1_000);
}

async function comparePixels(page: Page, first: Buffer, second: Buffer) {
  return page.evaluate(async ({ first, second }) => {
    // Inline decoding avoids tsx's nested-function __name helper in page context.
    const firstImage = new Image(); firstImage.src = `data:image/png;base64,${first}`;
    const secondImage = new Image(); secondImage.src = `data:image/png;base64,${second}`;
    await Promise.all([firstImage.decode(), secondImage.decode()]);
    const firstCanvas = new OffscreenCanvas(firstImage.width, firstImage.height);
    const secondCanvas = new OffscreenCanvas(secondImage.width, secondImage.height);
    const firstContext = firstCanvas.getContext('2d')!; firstContext.drawImage(firstImage, 0, 0);
    const secondContext = secondCanvas.getContext('2d')!; secondContext.drawImage(secondImage, 0, 0);
    const a = { width: firstImage.width, height: firstImage.height, pixels: firstContext.getImageData(0, 0, firstImage.width, firstImage.height).data };
    const b = { width: secondImage.width, height: secondImage.height, pixels: secondContext.getImageData(0, 0, secondImage.width, secondImage.height).data };
    if (a.width !== b.width || a.height !== b.height) throw new Error('Capture dimensions differ');
    let changedPixels = 0; let maxChannelDelta = 0;
    for (let index = 0; index < a.pixels.length; index += 4) {
      let changed = false;
      for (let channel = 0; channel < 4; channel++) {
        const delta = Math.abs(a.pixels[index + channel] - b.pixels[index + channel]);
        maxChannelDelta = Math.max(maxChannelDelta, delta); changed ||= delta !== 0;
      }
      if (changed) changedPixels++;
    }
    return { changedPixels, maxChannelDelta, pixelCount: a.width * a.height };
  }, { first: first.toString('base64'), second: second.toString('base64') });
}

// WCAG relative luminance. Check computed CSS colors, rather than antialiased glyphs.
const rgb = (color: string) => color.startsWith('#') ? (color.length === 4 ? color.slice(1).split('').map(value => value + value).join('') : color.slice(1)).match(/../g)!.map(value => parseInt(value, 16)) : color.match(/[\d.]+/g)!.slice(0, 3).map(Number);
const luminance = (color: string) => rgb(color).map(value => value / 255).map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4).reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
const contrast = (foreground: string, background: string) => (Math.max(luminance(foreground), luminance(background)) + 0.05) / (Math.min(luminance(foreground), luminance(background)) + 0.05);
assert.deepEqual(rgb('#fff'), rgb('rgb(255, 255, 255)'));
assert.equal(contrast('#000', '#fff'), 21);
async function semanticContrast(page: Page) {
  const result = await page.evaluate(() => {
    const root = document.querySelector('.qp-redesign')!; const style = getComputedStyle(root);
    const colors = Object.fromEntries(['danger', 'warning', 'series', 'success', 'muted'].map(role => [role, style.getPropertyValue(`--qp-${role}`).trim()]));
    const backgrounds = [style.backgroundColor, style.getPropertyValue('--qp-panel').trim(), style.backgroundImage.match(/rgb\([^)]+\)/)![0]];
    const samples = [['danger', '.qp-alert-level[data-level=critical]'], ['warning', '.qp-alert-level[data-level=warning]'], ['series', '.qp-cost-chart-labels>span:nth-child(2)'], ['success', '.qp-daemon-badge[data-state=live]'], ['muted', '.qp-chart-scale>span']].flatMap(([role, selector]) => {
      const element = root.querySelector(selector); return element ? [{ role, selector, color: getComputedStyle(element).color }] : [];
    });
    return { colors, backgrounds, samples };
  });
  const semanticContrasts = Object.entries(result.colors).map(([role, color]) => ({ role, color, minimumRatio: Math.min(...result.backgrounds.map(background => contrast(color, background))) }));
  for (const item of semanticContrasts) assert.ok(item.minimumRatio >= 4.5, `${item.role}: insufficient text contrast (${item.minimumRatio})`);
  for (const sample of result.samples) assert.deepEqual(rgb(sample.color), rgb(result.colors[sample.role]), `${sample.selector}: semantic color was overridden`);
  return { semanticContrasts, checkedElements: result.samples.map(sample => sample.selector) };
}

async function checkChartAccess(page: Page, destination: 'live' | 'projects', lang: string, theme: string) {
  const headers = { 'x-quotapulse-token': 'stable-capture-test' };
  let expected: Array<{ at: number; tokens: number }>;
  if (destination === 'live') {
    const result = await daemon.inject({ method: 'GET', url: `/api/trend?bucket=minute&group_by=none&from=${fixedNow - 1_800_000}&to=${fixedNow + 1}`, headers });
    assert.equal(result.statusCode, 200);
    const trend = result.json<MinuteTrendResponse>();
    const start = Math.floor(trend.from / 60_000) * 60_000;
    expected = Array.from({ length: Math.floor((trend.to - 1) / 60_000) - Math.floor(trend.from / 60_000) + 1 }, (_, index) => ({ at: start + index * 60_000, tokens: trend.rows.find(row => row.bucket_ts === start + index * 60_000)?.total_tokens ?? 0 }));
  } else {
    const month = new Date(fixedNow); month.setDate(1); month.setHours(0, 0, 0, 0);
    const query = new URLSearchParams({ from: String(month.getTime()), to: String(fixedNow + 1), project: 'Fixture project 0' });
    const result = await daemon.inject({ method: 'GET', url: `/api/project-detail?${query}&limit=20&offset=0`, headers });
    assert.equal(result.statusCode, 200);
    const detail = result.json<ProjectDetailResponse>();
    expected = Array.from({ length: Math.ceil((detail.scope.to - detail.scope.from) / detail.bucketMs) }, (_, index) => ({ at: detail.scope.from + index * detail.bucketMs, tokens: detail.points.find(point => point.start === detail.scope.from + index * detail.bucketMs)?.tokens ?? 0 }));
  }
  const disclosure = page.locator('.qp-chart-data'); const summary = disclosure.locator('summary');
  await summary.focus(); await page.keyboard.press('Enter');
  assert.equal(await disclosure.getAttribute('open'), '');
  assert.equal(await disclosure.locator('table').isVisible(), true);
  const rows = await disclosure.locator('tbody tr').evaluateAll(elements => elements.map(element => ({ at: Number(element.getAttribute('data-at')), tokens: Number(element.getAttribute('data-value')), text: element.querySelector('td:last-child')!.textContent, stamp: element.querySelector('td:first-child')!.textContent, iso: element.querySelector('time')!.getAttribute('datetime') })));
  assert.deepEqual(rows.map(({ at, tokens }) => ({ at, tokens })), expected);
  const format = new Intl.NumberFormat(lang === 'th' ? 'th-TH' : 'en-US');
  for (const row of rows) { assert.equal(row.text, format.format(row.tokens)); assert.equal(row.iso, new Date(row.at).toISOString()); assert.equal(row.stamp, new Date(row.at).toLocaleString(lang === 'th' ? 'th-TH' : 'en-US')); }
  const maximum = Math.max(0, ...expected.map(point => point.tokens));
  assert.ok(expected.some(point => point.tokens === 1) && expected.some(point => point.tokens === 0), 'Tiny and zero bucket regression fixtures must be present');
  if (destination === 'live') {
    const points = await page.locator('.qp-live-chart>circle').evaluateAll(elements => elements.map(element => ({ at: Number(element.getAttribute('data-at')), tokens: Number(element.getAttribute('data-value')), cy: Number(element.getAttribute('cy')) })));
    assert.deepEqual(points.map(({ at, tokens }) => ({ at, tokens })), expected);
    points.forEach((point, index) => assert.ok(Math.abs(point.cy - (94 - 88 * expected[index].tokens / (maximum || 1))) < 0.0001, 'Line point is not proportional to the API value'));
  } else {
    const points = await page.locator('.qp-project-trend>circle').evaluateAll(elements => elements.map(element => ({ at: Number(element.getAttribute('data-at')), tokens: Number(element.getAttribute('data-value')), cy: Number(element.getAttribute('cy')) })));
    assert.deepEqual(points.map(({ at, tokens }) => ({ at, tokens })), expected);
    points.forEach((point, index) => assert.ok(Math.abs(point.cy - (94 - 88 * expected[index].tokens / (maximum || 1))) < 0.0001, 'Project line point is not proportional to the API value'));
  }
  for (const width of [390, 900, 1280]) {
    await page.setViewportSize({ width, height: 941 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${destination}: expanded data table overflows at ${width}`);
  }
  await summary.focus(); await page.keyboard.press('Enter'); assert.equal(await disclosure.getAttribute('open'), null);
  chartChecks.push({ page: destination, lang, theme, buckets: expected.length, tokens: expected.reduce((sum, point) => sum + point.tokens, 0) });
}

async function checkModelCostAccess(page: Page, destination: 'models' | 'cost', lang: string, theme: string, pending: Set<Request>) {
  const routes = destination === 'models'
    ? ['models?metric=tokens', 'models?metric=calls', 'models?metric=api_value_usd']
    : ['cost?basis=api&range=month', 'cost?basis=native&range=month', 'cost?basis=native&range=month&source=2'];
  const locale = lang === 'th' ? 'th-TH' : 'en-US';
  const number = new Intl.NumberFormat(locale);
  const money = new Intl.NumberFormat(locale, { style: 'currency', currency: 'USD' });
  for (const route of routes) {
    await page.setViewportSize({ width: 1672, height: 941 });
    const responsePromise = page.waitForResponse(response => response.url().includes(destination === 'models' ? '/api/model-detail?' : '/api/cost-analysis?') && response.status() === 200);
    await page.goto(`http://127.0.0.1:7804/?chart-access=${encodeURIComponent(route)}#${route}`, { waitUntil: 'domcontentloaded' });
    const response = await responsePromise;
    // Query the daemon independently using the precise scope/identity requested by the UI.
    const result = await daemon.inject({ method: 'GET', url: new URL(response.url()).pathname + new URL(response.url()).search, headers: { 'x-quotapulse-token': 'stable-capture-test' } });
    assert.equal(result.statusCode, 200);
    const data = result.json<ModelDetailResponse | CostAnalysisResponse>();
    await page.locator('.qp-chart-data').waitFor(); await settled(page, pending);
    const collapsedBottom = await page.locator(destination === 'models' ? '.qp-model-detail' : '.qp-cost-layout').evaluate(element => element.getBoundingClientRect().bottom);
    if (destination === 'cost' && collapsedBottom >= 941) console.log('Cost overflow geometry', await page.locator('.qp-cost-top,.qp-cost-summary,.qp-cost-trend,.qp-cost-models,.qp-cost-projects,.qp-cost-sessions,.qp-cost-insights').evaluateAll(elements => elements.map(element => ({ className: element.className, top: element.getBoundingClientRect().top, height: element.getBoundingClientRect().height }))));
    assert.ok(collapsedBottom < 941, `${route}: collapsed detail outside viewport (${collapsedBottom})`);
    if (destination === 'cost') {
      const cost = data as CostAnalysisResponse;
      const maxAmount = Math.max(0, ...cost.points.map(point => point.amount));
      const maxTokens = Math.max(0, ...cost.points.map(point => point.pricedTokens));
      if (cost.totals.pricedCalls > 0) {
        for (const [axis, maximum] of [['amount', maxAmount], ['tokens', maxTokens]] as const) {
          const ticks = page.locator(`.qp-cost-axis[data-axis=${axis}]>span`);
          assert.equal(await ticks.count(), 5);
          assert.deepEqual(await ticks.evaluateAll(elements => elements.map(element => Number(element.getAttribute('data-value')))), [1, 0.75, 0.5, 0.25, 0].map(fraction => fraction * maximum));
          if (axis === 'amount') assert.deepEqual(await ticks.allTextContents(), [1, 0.75, 0.5, 0.25, 0].map(fraction => money.format(fraction * maximum)));
        }
        const times = page.locator('.qp-cost-plot-dates time');
        assert.equal(await times.nth(0).getAttribute('datetime'), new Date(cost.scope.from).toISOString());
        assert.equal(await times.nth(1).getAttribute('datetime'), new Date(cost.scope.to).toISOString());
        assert.equal(await times.nth(0).textContent(), new Date(cost.scope.from).toLocaleString(locale, { dateStyle: 'short', timeStyle: 'short' }));
        const heights = await page.locator('.qp-cost-column').evaluateAll(elements => elements.map(element => parseFloat((element as HTMLElement).style.height)));
        const points = Array.from({ length: Math.ceil((cost.scope.to - cost.scope.from) / cost.bucketMs) }, (_, index) => cost.points.find(point => point.start === cost.scope.from + index * cost.bucketMs)?.amount ?? 0);
        assert.equal(heights.length, points.length);
        heights.forEach((height, index) => assert.ok(Math.abs(height - points[index] / (maxAmount || 1) * 100) < 0.0001));
        const tokenPoints = await page.locator('.qp-cost-token-line>circle').evaluateAll(elements => elements.map(element => ({ at: Number(element.getAttribute('data-at')), value: Number(element.getAttribute('data-value')), x: Number(element.getAttribute('cx')), y: Number(element.getAttribute('cy')) })));
        const expectedTokens = points.map((_, index) => { const at = cost.scope.from + index * cost.bucketMs; return { at, value: cost.points.find(point => point.start === at)?.pricedTokens ?? 0 }; });
        assert.deepEqual(tokenPoints.map(({ at, value }) => ({ at, value })), expectedTokens);
        tokenPoints.forEach((point, index) => {
          assert.ok(Math.abs(point.y - (100 - 100 * point.value / (maxTokens || 1))) < 0.0001, 'Token line does not match its own axis');
          assert.ok(Math.abs(point.x - 1000 * (index + 0.5) / tokenPoints.length) < 0.0001, 'Token point is not centered on its bucket');
        });
      } else assert.equal(await page.locator('.qp-cost-plot').count(), 0, 'Unpriced scope must not show a monetary plot/axis');
      for (const [selector, groups] of [['.qp-cost-models', cost.models], ['.qp-cost-projects', cost.projects]] as const) {
        const expected = groups.filter(group => group.pricedCalls > 0).slice(0, 8);
        const bars = await page.locator(`${selector} .qp-cost-share b`).evaluateAll(elements => elements.map(element => parseFloat((element as HTMLElement).style.width)));
        assert.equal(bars.length, expected.length);
        bars.forEach((width, index) => assert.ok(Math.abs(width - (cost.totals.amount > 0 ? expected[index].amount / cost.totals.amount * 100 : 0)) < 0.0001, 'Share bar differs from recorded amount fraction'));
      }
      if (cost.sessions.length > 0) {
        const table = page.locator('.qp-cost-sessions .qp-cost-table');
        assert.equal(await table.locator('tbody tr').count(), cost.sessions.length);
        await table.focus(); await page.keyboard.press('End');
        const last = table.locator('tbody tr:last-child a');
        await last.focus(); await page.keyboard.press('Tab'); await page.keyboard.press('Shift+Tab');
        assert.equal(await last.evaluate(element => element === document.activeElement), true, 'Last session link is not keyboard reachable');
        assert.equal(await last.evaluate(element => { const row = element.getBoundingClientRect(); const scroll = element.closest('.qp-cost-table')!.getBoundingClientRect(); return row.top >= scroll.top && row.bottom <= scroll.bottom; }), true, 'Last session is hidden by its table viewport');
      }
      costAxisChecks.push({ route, lang, theme, priced: cost.totals.pricedCalls > 0, maxAmount, maxTokens });
    }
    const disclosure = page.locator('.qp-chart-data'); const summary = disclosure.locator('summary');
    await summary.focus(); await page.keyboard.press('Enter');
    assert.equal(await disclosure.getAttribute('open'), '');
    const starts = Array.from({ length: Math.ceil((data.scope.to - data.scope.from) / data.bucketMs) }, (_, index) => data.scope.from + index * data.bucketMs);
    const rows = disclosure.locator('tbody tr'); assert.equal(await rows.count(), starts.length);
    const calls = route.includes('metric=calls');
    const values: number[] = [];
    for (const [index, start] of starts.entries()) {
      const row = rows.nth(index);
      assert.equal(await row.getAttribute('data-at'), String(start));
      assert.equal(await row.locator('time').getAttribute('datetime'), new Date(start).toISOString());
      assert.equal(await row.locator('time').textContent(), new Date(start).toLocaleString(locale));
      if (destination === 'models') {
        const point = (data as ModelDetailResponse).points.find(point => point.start === start);
        const value = (calls ? point?.calls : point?.tokens) ?? 0; values.push(value);
        assert.equal(await row.getAttribute('data-value'), String(value));
        assert.equal(await row.locator('td').nth(1).textContent(), number.format(value));
      } else {
        const point = (data as CostAnalysisResponse).points.find(point => point.start === start) ?? { amount: 0, pricedTokens: 0, pricedCalls: 0, allCalls: 0 };
        for (const [attribute, value] of Object.entries({ amount: point.amount, 'priced-tokens': point.pricedTokens, 'priced-calls': point.pricedCalls, 'all-calls': point.allCalls })) assert.equal(await row.getAttribute(`data-${attribute}`), String(value));
        const expected = point.allCalls === 0 ? money.format(0) : point.pricedCalls === 0 ? (lang === 'th' ? 'ไม่ทราบ' : 'Unknown') : money.format(point.amount) + (point.pricedCalls < point.allCalls ? '+' : '');
        assert.equal(await row.locator('.qp-cost-value>span').first().textContent(), expected);
        assert.equal(await row.locator('td').nth(2).textContent(), number.format(point.pricedTokens));
        assert.equal(await row.locator('td').nth(3).textContent(), `${number.format(point.pricedCalls)} / ${number.format(point.allCalls)} ${lang === 'th' ? 'คำขอ' : 'Calls'}`);
      }
    }
    if (destination === 'models') {
      assert.ok(values.includes(0), 'Zero model buckets must remain zero');
      if (!route.includes('api_value_usd')) assert.ok(values.includes(1), 'Tiny model bucket fixture is missing');
      const points = await page.locator('.qp-model-trend>circle').evaluateAll(elements => elements.map(element => ({ at: Number(element.getAttribute('data-at')), value: Number(element.getAttribute('data-value')), cy: Number(element.getAttribute('cy')) })));
      const maximum = Math.max(0, ...values);
      assert.deepEqual(points.map(point => point.at), starts);
      assert.deepEqual(points.map(point => point.value), values);
      points.forEach((point, index) => assert.ok(Math.abs(point.cy - (94 - 88 * values[index] / (maximum || 1))) < 0.0001));
      const header = await disclosure.locator('th').nth(1).textContent();
      assert.equal(header, lang === 'th' ? (calls ? 'คำขอ' : 'โทเค็นที่บันทึก') : (calls ? 'Calls' : 'Recorded tokens'));
    } else {
      const cost = data as CostAnalysisResponse;
      assert.equal(await disclosure.getAttribute('data-basis'), cost.basis);
      if (route.includes('source=2')) {
        assert.ok(cost.totals.allCalls > 0); assert.equal(cost.totals.pricedCalls, 0);
      } else if (cost.basis === 'api') {
        assert.ok(cost.points.some(point => point.pricedCalls > 0 && point.amount === 0), 'Known-zero price bucket fixture is missing');
        assert.ok(cost.points.some(point => point.pricedCalls > 0 && point.pricedCalls < point.allCalls), 'Partial price bucket fixture is missing');
      } else assert.ok(cost.points.some(point => point.allCalls > 0 && point.pricedCalls === 0), 'Unknown native bucket fixture is missing');
    }
    for (const width of [390, 900, 1280]) {
      await page.setViewportSize({ width, height: 941 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${route}: expanded table overflow at ${width}`);
    }
    await summary.focus(); await page.keyboard.press('Enter'); assert.equal(await disclosure.getAttribute('open'), null);
    modelCostChecks.push({ route, lang, theme, buckets: starts.length, collapsedBottom });
  }
}

async function checkFontAccess(page: Page, destination: string, lang: string, theme: string) {
  const cdp = await page.context().newCDPSession(page);
  try {
    await cdp.send('DOM.enable'); await cdp.send('CSS.enable');
    const { root } = await cdp.send('DOM.getDocument');
    const selector = lang === 'th' ? '.qp-sidebar nav a span' : '.qp-tools button';
    const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector });
    const { fonts } = await cdp.send('CSS.getPlatformFontsForNode', { nodeId });
    const thai = fonts.find(font => font.familyName === 'Noto Sans Thai');
    assert.ok(thai && thai.isCustomFont && thai.glyphCount > 0, `${destination}/${lang}/${theme}: Thai glyphs did not use the bundled custom font`);
    assert.ok(fonts.every(font => font.isCustomFont), 'Selected Thai label must not fall back to system fonts');
    fontChecks.push({ page: destination, lang, theme, family: thai.familyName, custom: thai.isCustomFont, glyphs: thai.glyphCount });
  } finally { await cdp.detach(); }
}

async function checkShellAccess(page: Page, destination: string, lang: string, theme: string) {
  const originalViewport = page.viewportSize()!;
  for (const width of [originalViewport.width, 390, 900, 1280]) {
    await page.setViewportSize({ width, height: originalViewport.height });
    const header = await page.locator('.qp-topbar').boundingBox();
    const brand = await page.locator('.qp-topbar .qp-brand').boundingBox();
    const sidebar = await page.locator('.qp-sidebar').boundingBox();
    assert.ok(header && brand && sidebar);
    assert.equal(header.x, 0); assert.equal(header.width, width); assert.equal(header.height, 60);
    assert.equal(brand.x, 0); assert.equal(brand.width, sidebar.width);
    assert.equal(sidebar.width, width <= 500 ? 48 : width <= 1100 ? 66 : 226);
    assert.equal(await page.locator('.qp-sidebar nav a').count(), 9);
    assert.equal(await page.locator('.qp-sidebar nav a[aria-current=page]').count(), 1);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    headerChecks.push({ page: destination, lang, theme, width, height: header.height, sidebarWidth: sidebar.width });
  }
  await page.setViewportSize(originalViewport);
  const originalHash = await page.evaluate(() => location.hash);
  const shell = page.getByTestId(`production-${destination}`);
  assert.equal(await shell.locator('.qp-sidebar nav').getAttribute('aria-label'), lang === 'th' ? 'เมนูหลัก' : 'Main navigation');
  const main = shell.locator('main');
  assert.ok(await main.getAttribute('aria-label'));
  await shell.locator('.qp-skip').focus(); await page.keyboard.press('Enter');
  assert.equal(await main.evaluate(element => element === document.activeElement), true);
  const trigger = shell.locator('.qp-topbar button[aria-haspopup=dialog]');
  await trigger.focus(); await page.keyboard.press('Enter');
  const modal = shell.locator('.qp-command-dialog');
  await modal.waitFor();
  assert.equal(await modal.evaluate(element => element.matches(':modal')), true);
  assert.equal(await trigger.getAttribute('aria-expanded'), 'true');
  const search = modal.getByRole('searchbox');
  assert.ok(await search.getAttribute('aria-label'));
  assert.equal(await search.evaluate(element => element === document.activeElement), true);
  await page.keyboard.press('Shift+Tab');
  assert.equal(await modal.locator('button').last().evaluate(element => element === document.activeElement), true);
  await page.keyboard.press('Tab');
  assert.equal(await search.evaluate(element => element === document.activeElement), true);
  await page.evaluate(() => (document.querySelector('.qp-sidebar a') as HTMLElement).focus());
  assert.equal(await search.evaluate(element => element === document.activeElement), true, 'Background must remain inert');
  const cdp = await page.context().newCDPSession(page);
  try {
    const tree = await cdp.send('Accessibility.getFullAXTree');
    const roles = tree.nodes.filter(node => !node.ignored).map(node => node.role?.value);
    assert.ok(roles.includes('dialog') && roles.includes('searchbox'));
    assert.ok(!roles.includes('main') && !roles.includes('navigation'), 'Modal must exclude background landmarks from the browser accessibility tree');
  } finally { await cdp.detach(); }
  await page.keyboard.press('ArrowDown');
  assert.equal(await modal.getByRole('status').textContent(), lang === 'th' ? 'สด' : 'Live');
  await search.fill('no-such-synthetic-page');
  assert.equal(await modal.locator('button').count(), 1);
  await page.keyboard.press('Enter'); assert.equal(await modal.evaluate(element => element.matches(':modal')), true);
  await page.keyboard.press('Escape'); await modal.waitFor({ state: 'hidden' });
  assert.equal(await trigger.evaluate(element => element === document.activeElement), true);
  assert.equal(await trigger.getAttribute('aria-expanded'), 'false');
  await page.keyboard.press('Control+k'); await modal.waitFor();
  assert.equal(await search.inputValue(), '');
  if (destination === 'overview') {
    for (const width of [390, 900, 1280]) {
      await page.setViewportSize({ width, height: 992 });
      const box = await modal.locator('div').first().boundingBox();
      assert.ok(box && box.x >= 0 && box.x + box.width <= width && box.y + box.height <= 992);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      if (width === 390) await page.screenshot({ path: resolve(output, `palette-${lang}-${theme}-390.png`), animations: 'disabled' });
    }
  }
  await page.mouse.click(4, 4); await modal.waitFor({ state: 'hidden' });
  assert.equal(await trigger.evaluate(element => element === document.activeElement), true);
  assert.equal(await page.evaluate(() => location.hash), originalHash);
  if (destination === 'live') {
    const sessions = shell.locator('.qp-live-table tbody tr button');
    assert.ok(await sessions.count() >= 2);
    for (const index of [0, 1, 0]) {
      const target = sessions.nth(index); await target.focus(); await page.keyboard.press('Enter');
      const detail = shell.locator('.qp-live-dialog[open]'); await detail.waitFor();
      assert.equal(await detail.getAttribute('aria-labelledby'), 'qp-live-detail-title');
      assert.ok(await detail.locator('#qp-live-detail-title').textContent());
      assert.equal(await detail.locator('dd').first().textContent(), await target.textContent());
      await page.keyboard.press('Escape'); await detail.waitFor({ state: 'hidden' });
      assert.equal(await target.evaluate(element => element === document.activeElement), true);
    }
  }
  shellChecks.push({ page: destination, lang, theme, modal: true, backgroundExcluded: true });
}

async function checkRuntimeAccess(page: Page, lang: string, theme: string, pending: Set<Request>) {
  // Owned synthetic rows exist only for this check; default capture data stays fixed.
  try {
    db.prepare("INSERT INTO source(id,harness,profile,root_path,display_name,detected_at) VALUES (900,'codex','runtime-access','/synthetic/nonexistent','Runtime access fixture',?)").run(fixedNow);
    const extra = db.prepare("INSERT INTO usage_event(source_id,session_id,dedup_key,ts,model,provider,input_tokens,total_tokens,call_count,cost_usd,cost_source) VALUES (900,?,?,?,?,?,1,1,1,0,'computed')");
    for (let index = 0; index < 11; index++) {
      session.run(900 + index, 900, `runtime-${index}`, index === 9 ? null : index === 10 ? '' : `Runtime extra project ${index}`, fixedNow - 10_000);
      extra.run(900 + index, `runtime-${index}`, fixedNow - 10_000, index === 9 ? null : index === 10 ? '' : `runtime-model-${index}`, index === 9 ? null : index === 10 ? '' : 'runtime-provider');
    }
    await page.setViewportSize({ width: 1586, height: 992 });
    const response = page.waitForResponse(response => new URL(response.url()).pathname === '/api/runtime-map' && response.status() === 200);
    await page.goto('http://127.0.0.1:7804/?runtime-access=full#overview', { waitUntil: 'domcontentloaded' });
    const graph = await (await response).json() as RuntimeGraph;
    await settled(page, pending);
    assert.ok(graph.nodes.project.length > 8 && graph.nodes.model.length > 8);
    const disclosure = page.locator('.qp-runtime-data'); const summary = disclosure.locator('summary');
    assert.equal(await disclosure.locator('table').count(), 0);
    await summary.focus(); await page.keyboard.press('Enter');
    await disclosure.locator('.qp-runtime-nodes').waitFor();
    assert.equal(await disclosure.locator('caption').count(), 2);
    assert.equal(await disclosure.locator('th[scope=col]').count(), 10);
    const number = new Intl.NumberFormat(lang === 'th' ? 'th-TH' : 'en-US');
    const expected = dimensions.flatMap(dimension => graph.nodes[dimension].map(node => ({ identity: JSON.stringify([dimension, node.key]), tokens: String(node.tokens), records: String(node.records), sessions: String(node.sessions), values: [node.tokens, node.records, node.sessions].map(value => number.format(value)) })));
    const rows = await disclosure.locator('.qp-runtime-nodes tbody tr').evaluateAll(elements => elements.map(element => ({ identity: element.getAttribute('data-identity'), tokens: element.getAttribute('data-tokens'), records: element.getAttribute('data-records'), sessions: element.getAttribute('data-sessions'), values: Array.from(element.querySelectorAll('td')).slice(2).map(cell => cell.textContent) })));
    assert.deepEqual(rows, expected);
    const edges = await disclosure.locator('.qp-runtime-edges tbody tr').evaluateAll(elements => elements.map(element => ({ identity: element.getAttribute('data-identity'), tokens: element.getAttribute('data-tokens'), value: element.querySelector('td:last-child')?.textContent })));
    assert.deepEqual(edges, graph.edges.map(edge => ({ identity: JSON.stringify([edge.column, edge.from, edge.to]), tokens: String(edge.tokens), value: number.format(edge.tokens) })));
    for (const column of [0, 1, 2]) assert.equal(graph.edges.filter(edge => edge.column === column).reduce((sum, edge) => sum + edge.tokens, 0), graph.totals.tokens);
    let inspected = 0;
    for (const [dimension, key] of [['model', 'runtime-model-8'], ['project', null], ['project', ''], ['model', null], ['model', '']] as const) {
      const button = disclosure.locator('.qp-runtime-nodes tbody tr').filter({ has: page.locator('button') });
      const index = expected.findIndex(node => node.identity === JSON.stringify([dimension, key]));
      const target = button.nth(index).locator('button');
      await target.focus(); await page.keyboard.press('Enter');
      const dialog = page.locator('.qp-dialog[open]'); await dialog.waitFor();
      assert.equal(await dialog.locator('h2').textContent(), await target.textContent());
      const node = graph.nodes[dimension].find(node => node.key === key)!;
      assert.deepEqual(await dialog.locator('.qp-detail-grid strong').allTextContents(), [node.tokens, node.sessions, node.callRecords, node.aggregateRecords].map(value => number.format(value)));
      await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'hidden' });
      assert.equal(await target.evaluate(element => element === document.activeElement), true);
      inspected++;
    }
    await page.screenshot({ path: resolve(output, `runtime-expanded-${lang}-${theme}.png`), animations: 'disabled', fullPage: true });
    for (const width of [390, 900, 1280]) {
      await page.setViewportSize({ width, height: 992 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `Runtime overflow at ${width}`);
    }
    await summary.focus(); await page.keyboard.press('Enter');
    await disclosure.locator('table').first().waitFor({ state: 'detached' });
    runtimeChecks.push({ lang, theme, nodes: rows.length, edges: edges.length, inspected });
  } finally {
    db.transaction(() => { db.prepare('DELETE FROM usage_event WHERE source_id=900').run(); db.prepare('DELETE FROM session WHERE source_id=900').run(); db.prepare('DELETE FROM source WHERE id=900').run(); })();
    assert.equal((db.prepare('SELECT COUNT(*) AS count FROM usage_event').get() as { count: number }).count, 38);
  }
}

async function checkQuotaAccess(page: Page, destination: 'overview' | 'alerts', lang: string, theme: string, pending: Set<Request>) {
  await page.setViewportSize({ width: 1672, height: 941 });
  await page.goto(`http://127.0.0.1:7804/?quota-access=${destination}#${destination}${destination === 'alerts' ? '?owner=openai%3Asubscription&window=5h' : ''}`, { waitUntil: 'domcontentloaded' });
  if (destination === 'overview') {
    const outer = page.getByTestId('quota-history');
    await outer.waitFor(); await settled(page, pending);
    assert.equal(await outer.locator('.qp-quota-chart').count(), 0, 'Collapsed Overview must not mount the full quota plot');
    await outer.locator('summary').first().focus(); await page.keyboard.press('Enter');
    assert.equal(await outer.getAttribute('open'), '');
  }
  await page.locator('.qp-quota-point').first().waitFor(); await settled(page, pending);
  const result = await daemon.inject({ method: 'GET', url: '/api/quota-history?subscription_key=openai%3Asubscription&window_kind=5h', headers: { 'x-quotapulse-token': 'stable-capture-test' } });
  assert.equal(result.statusCode, 200);
  const history = result.json<QuotaHistoryResponse>();
  const samples = history.segments.flatMap(segment => segment.samples);
  assert.ok(history.segments.length > 3 && history.segments.some(segment => segment.samples.length > 8), 'Complete-history fixture missing');
  assert.ok(samples.some(sample => sample.usedPercent === null) && samples.some(sample => sample.usedPercent === 0) && samples.some(sample => sample.usedPercent === 0.5));
  const chart = page.locator('.qp-quota-chart');
  assert.equal(await chart.locator('svg>g[data-reset]').count(), history.segments.length);
  const disclosure = chart.locator('.qp-quota-samples'); const summary = disclosure.locator('summary');
  assert.equal(await disclosure.locator('table').count(), 0, 'Collapsed quota samples must not mount all rows');
  await summary.focus(); await page.keyboard.press('Enter'); assert.equal(await disclosure.getAttribute('open'), '');
  await disclosure.locator('table').waitFor();
  assert.equal(await disclosure.locator('caption').isVisible(), true);
  assert.equal(await disclosure.locator('th[scope=col]').count(), 3);
  const expected = history.segments.flatMap(segment => segment.samples.map(sample => ({ at: sample.observedAt, value: sample.usedPercent, reset: segment.resetAt })));
  const rows = await disclosure.locator('tbody tr').evaluateAll(elements => elements.map(element => ({ at: Number(element.getAttribute('data-at')), value: element.getAttribute('data-value'), reset: element.getAttribute('data-reset'), cells: Array.from(element.querySelectorAll('td')).map(cell => cell.textContent), iso: Array.from(element.querySelectorAll('time')).map(time => time.getAttribute('datetime')) })));
  assert.equal(rows.length, expected.length);
  const locale = lang === 'th' ? 'th-TH' : 'en-US'; const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 20 });
  const unknown = lang === 'th' ? 'ไม่ทราบ' : 'Unknown';
  rows.forEach((row, index) => {
    const sample = expected[index];
    assert.equal(row.at, sample.at); assert.equal(row.value, String(sample.value ?? 'unknown')); assert.equal(row.reset, String(sample.reset ?? 'unknown'));
    assert.deepEqual(row.cells, [new Date(sample.at).toLocaleString(locale), sample.value === null ? unknown : `${number.format(sample.value)}%`, sample.reset === null ? unknown : new Date(sample.reset).toLocaleString(locale)]);
    assert.deepEqual(row.iso, [new Date(sample.at).toISOString(), ...(sample.reset === null ? [] : [new Date(sample.reset).toISOString()])]);
  });
  const points = await chart.locator('.qp-quota-point').evaluateAll(elements => elements.map(element => ({ at: Number(element.getAttribute('data-at')), value: Number(element.getAttribute('data-value')), x: Number(element.getAttribute('cx')), y: Number(element.getAttribute('cy')) })));
  const known = samples.filter(sample => sample.usedPercent !== null);
  assert.equal(points.length, known.length);
  const viewBox = (await chart.locator('svg').getAttribute('viewBox'))!.split(' ').map(Number);
  const first = Math.min(...samples.map(sample => sample.observedAt)); const last = Math.max(...samples.map(sample => sample.observedAt));
  points.forEach((point, index) => {
    const sample = known[index]; assert.equal(point.at, sample.observedAt); assert.equal(point.value, sample.usedPercent);
    assert.ok(Math.abs(point.y - (6 + (100 - sample.usedPercent!) / 100 * 98)) < 0.0001, 'Incorrect percentage ordinate');
    assert.ok(Math.abs(point.x - (34 + (sample.observedAt - first) / (last - first) * (viewBox[2] - 40))) < 0.0001, 'Incorrect timestamp abscissa');
  });
  const expectedLines = history.segments.reduce((total, segment) => total + segment.samples.filter((sample, index) => index > 0 && sample.usedPercent !== null && segment.samples[index - 1].usedPercent !== null).length, 0);
  assert.equal(await chart.locator('.qp-quota-series').count(), expectedLines, 'Unknown/reset intervals must break the series');
  await page.screenshot({ path: resolve(output, `quota-expanded-${destination}-${lang}-${theme}.png`), animations: 'disabled' });
  for (const width of [390, 900, 1280]) {
    await page.setViewportSize({ width, height: 941 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${destination}: quota table overflow at ${width}`);
  }
  await summary.focus(); await page.keyboard.press('Enter'); assert.equal(await disclosure.getAttribute('open'), null);
  await disclosure.locator('table').waitFor({ state: 'detached' });
  if (destination === 'overview') { const outer = page.getByTestId('quota-history'); await outer.locator('summary').first().focus(); await page.keyboard.press('Enter'); assert.equal(await outer.getAttribute('open'), null); await outer.locator('.qp-quota-chart').waitFor({ state: 'detached' }); }
  quotaChecks.push({ page: destination, lang, theme, segments: history.segments.length, samples: samples.length, unknown: samples.filter(sample => sample.usedPercent === null).length });
  if (destination === 'overview') {
    const pattern = '**/api/quota-history?**';
    for (const state of ['unknown', 'empty', 'recovered']) {
      if (state !== 'recovered') await page.route(pattern, route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ...history, segments: state === 'empty' ? [{ resetAt: history.reader!.resetAt, samples: [] }] : history.segments.map(segment => ({ ...segment, samples: segment.samples.map(sample => ({ ...sample, usedPercent: null })) })) }) }));
      try {
        await page.goto(`http://127.0.0.1:7804/?quota-state=${state}#overview`, { waitUntil: 'domcontentloaded' });
        const outer = page.getByTestId('quota-history'); await outer.waitFor(); await settled(page, pending);
        await outer.locator('summary').first().focus(); await page.keyboard.press('Enter');
        if (state === 'empty') {
          await outer.getByRole('status').waitFor();
          assert.equal(await outer.locator('svg').count(), 0, 'Empty history must not create an invalid time axis');
        } else {
          await outer.locator('.qp-quota-samples').waitFor();
          assert.equal(await outer.locator('.qp-quota-point').count(), state === 'unknown' ? 0 : known.length);
          if (state === 'unknown') {
            assert.equal(await outer.locator('.qp-quota-series').count(), 0);
            await outer.locator('.qp-quota-samples summary').focus(); await page.keyboard.press('Enter');
            await outer.locator('table').waitFor();
            assert.equal(await outer.locator('tr[data-value=unknown]').count(), samples.length);
          }
        }
      } finally { if (state !== 'recovered') await page.unroute(pattern); }
    }
  }
}

try {
  await daemon.listen({ host: '127.0.0.1', port: 7804 });
  assert.equal((await daemon.inject({ method: 'GET', url: '/api/overview', headers: { 'x-quotapulse-token': 'stable-capture-test' } })).json().now, fixedNow);
  for (const pass of [0, 1]) {
    for (const lang of ['en', 'th']) for (const theme of ['dark', 'light']) {
      // Each language/theme set starts a new renderer process in both passes.
      browser = await chromium.launch({ channel: 'chrome', headless: true, args: rendererArgs });
      const page = await browser.newPage({ viewport: { width: 1672, height: 941 }, reducedMotion: 'reduce', deviceScaleFactor: 1, timezoneId: 'Asia/Bangkok' });
      const pending = new Set<Request>();
      const isData = (url: string) => new URL(url).pathname.startsWith('/api/') && !url.includes('/api/events/stream');
      try {
        page.on('pageerror', error => errors.push(error.message));
        page.on('request', request => { if (isData(request.url())) pending.add(request); });
        page.on('requestfinished', request => pending.delete(request));
        page.on('requestfailed', request => pending.delete(request));
        await page.route('**/*', route => {
          const request = route.request(); const url = new URL(request.url());
          if (url.origin !== 'http://127.0.0.1:7804' || (url.pathname.startsWith('/api/') && request.method() !== 'GET')) { forbidden.push(`${request.method()} ${url.origin}${url.pathname}`); return route.abort(); }
          return route.continue();
        });
        await page.addInitScript(({ lang, theme }) => {
          (window as unknown as { __QUOTAPULSE_TOKEN__: string }).__QUOTAPULSE_TOKEN__ = 'stable-capture-test';
          localStorage.setItem('quotapulse-prefs', JSON.stringify({ lang, currency: 'USD', rate: 1, hiddenSubscriptions: [] }));
          localStorage.setItem('quotapulse-theme', theme);
        }, { lang, theme });
        await page.clock.setFixedTime(fixedNow);
        for (const [destination, ready] of pages) {
          await page.setViewportSize(destination === 'overview' ? { width: 1586, height: 992 } : { width: 1672, height: 941 });
          // A distinct document URL avoids carrying hash-navigation paint caches
          // and asynchronous state from the preceding route into this capture.
          await page.goto(`http://127.0.0.1:7804/?capture=${destination}#${destination}`, { waitUntil: 'domcontentloaded' });
          await page.getByTestId(`production-${destination}`).locator(ready).first().waitFor();
          await page.locator('.qp-daemon-badge[data-state=live]').waitFor();
          await page.waitForFunction(() => document.querySelector('[data-stat=models]')?.textContent === '8');
          await settled(page, pending);
          // Native select text can retain a renderer font cache. Warm and inspect
          // fonts in the same order in both independent capture passes.
          await checkFontAccess(page, destination, lang, theme);
          assert.equal(await page.evaluate(() => Date.now()), fixedNow);
          assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
          const contrastEvidence = await semanticContrast(page);
          if (pass === 0 && (destination === 'live' || destination === 'models')) {
            const header = await page.locator(destination === 'live' ? '.qp-live-header' : '.qp-model-header').boundingBox();
            const summary = await page.locator(destination === 'live' ? '.qp-live-metrics' : '.qp-model-summary').boundingBox();
            const rail = await page.locator(destination === 'live' ? '.qp-live-rail' : '.qp-model-detail').boundingBox();
            assert.ok(header && summary && rail);
            assert.ok(Math.abs(header.y - rail.y) <= 1, `${destination}: reference rail must start beside the header`);
            assert.ok(rail.x > summary.x + summary.width, `${destination}: summary must stay in the main column`);
            referenceColumnChecks.push({ page: destination, lang, theme, headerTop: header.y, railTop: rail.y, summaryRight: summary.x + summary.width, railLeft: rail.x });
          }
          if (destination === 'overview') {
            const hero = await page.locator('.qp-hero').boundingBox();
            const activity = await page.locator('.qp-activity-item').first().boundingBox();
            const rail = page.locator('.qp-top-models');
            const box = await rail.boundingBox();
            assert.ok(hero && activity && box);
            if (overviewOnly && pass === 0) {
              await page.screenshot({ path: resolve(output, `layout-${lang}-${theme}.png`), animations: 'disabled' });
              writeFileSync(resolve(output, `layout-${lang}-${theme}.json`), JSON.stringify({ hero, activity, rail: box, runtime: await page.locator('.qp-runtime').boundingBox(), bottom: await page.locator('.qp-bottom-grid').boundingBox() }, null, 2));
            }
            assert.ok(box.height <= 270.1, `Model rail exceeds its desktop height: ${box.height}`);
            assert.ok(activity.y + activity.height <= 992, `Overview activity is outside concept viewport: ${activity.y + activity.height}`);
            assert.equal(await rail.locator('.qp-model-row').count(), 8);
            if (pass === 0) {
              await rail.focus(); await page.keyboard.press('End'); await page.waitForTimeout(300);
              assert.ok(await rail.evaluate(element => element.scrollTop > 0), 'Model rail is not keyboard-scrollable');
              const last = rail.locator('.qp-model-row').last();
              await last.focus(); await page.keyboard.press('Enter');
              await page.getByRole('dialog').waitFor();
              assert.equal(await page.locator('#qp-detail-title').textContent(), 'fixture-model-7');
              await page.keyboard.press('Escape'); await page.getByRole('dialog').waitFor({ state: 'hidden' });
              assert.equal(await last.evaluate(element => element === document.activeElement), true);
              await rail.evaluate(element => { element.scrollTop = 0; }); await last.evaluate(element => (element as HTMLElement).blur());
              await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(300);
              overviewLayouts.push({ lang, theme, heroBottom: hero.y + hero.height, activityBottom: activity.y + activity.height, models: 8, railHeight: box.height });
            }
          }
          const filename = `${destination}-${lang}-${theme}.png`;
          const screenshot = await page.screenshot({ path: resolve(output, pass === 0 ? filename : `repeat-${filename}`), animations: 'disabled' });
          if (pass === 0) cases.push({ page: destination, lang, theme, filename, sha256: sha(screenshot), ...contrastEvidence });
          else {
            const item = cases.find(item => item.filename === filename)!;
            item.repeatSha256 = sha(screenshot);
            const difference = await comparePixels(page, readFileSync(resolve(output, filename)), screenshot);
            item.changedPixels = difference.changedPixels; item.maxChannelDelta = difference.maxChannelDelta;
            // Compare every pixel, without masks. Permit only tiny raster rounding;
            // No region is hidden, blurred or exempted from the comparison.
            assert.ok(difference.maxChannelDelta <= 2 && difference.changedPixels / difference.pixelCount <= 0.0001, `${filename}: capture differs beyond raster tolerance (${JSON.stringify(difference)})`);
          }
          if (pass === 0 && destination === 'history') await checkHistoryDensity(page, lang, theme);
          if (destination === 'history') await checkHistoryDetails(page, lang, theme, pass, pending);
          if (pass === 0) await checkShellAccess(page, destination, lang, theme);
          if (pass === 0 && destination === 'alerts') await checkAlerts(page, lang, theme, pending);
          if (pass === 0 && destination === 'projects') await checkProjectCards(page, lang, theme, pending);
          if (pass === 0 && destination === 'providers') await checkProviders(page, lang, theme, pending);
          if (pass === 0 && destination === 'models') await checkModelComparison(page, lang, theme, pending);
          if (pass === 0 && destination === 'live') await checkLiveDensity(page, lang, theme);
          if (pass === 0 && (destination === 'live' || destination === 'projects')) await checkChartAccess(page, destination, lang, theme);
          if (pass === 0 && (destination === 'models' || destination === 'cost')) await checkModelCostAccess(page, destination, lang, theme, pending);
          if (pass === 0 && destination === 'overview') await checkRuntimeAccess(page, lang, theme, pending);
          if (pass === 0 && (destination === 'overview' || destination === 'alerts')) await checkQuotaAccess(page, destination, lang, theme, pending);
        }
        if (pass === 0) {
          await page.goto('http://127.0.0.1:7804/?shell-access=settings#settings', { waitUntil: 'domcontentloaded' });
          await page.getByTestId('production-settings').waitFor(); await settled(page, pending);
          await checkFontAccess(page, 'settings', lang, theme);
          await checkShellAccess(page, 'settings', lang, theme);
        }
      } finally { await page.close(); await browser.close(); }
      console.log(`Stable capture pass ${pass + 1}: ${lang}/${theme}, ${pages.length} pages`);
    }
  }
  assert.deepEqual(errors, []); assert.deepEqual(forbidden, []);
  writeFileSync(resolve(output, 'verification.json'), JSON.stringify({ status: 'repeatable within recorded raster tolerance; review candidates, not approved visual baselines', scope: liveOnly ? 'live' : compositionOnly ? 'composition' : overviewOnly ? 'overview' : projectsOnly ? 'projects' : providersOnly ? 'providers' : modelsOnly ? 'models' : costOnly ? 'cost' : historyOnly ? 'history' : alertsOnly ? 'alerts' : 'all', clock: fixedNow, isoClock: new realDate(fixedNow).toISOString(), browser: browser.version(), rendererArgs, timezone: 'Asia/Bangkok', dpr: 1, reducedMotion: true, tolerance: { maxChannelDelta: 2, maxChangedPixelFraction: 0.0001, masks: false }, productionIndexSha256: sha(readFileSync(resolve(root, 'packages/web/dist/index.html'))), fixture: { database: 'in-memory synthetic', sessions: 12, namedProjects: 8, models: 8, providers: 4, records: 38 }, checks: ['frozen daemon and browser Date', `${cases.length * 2} screenshots / ${cases.length} pairs within raster tolerance`, 'independent browser process per language/theme set', 'fresh document per route', 'production web without Vite', 'fonts ready and API settled', 'no page overflow', 'no external or write requests', 'no browser errors', ...(alertsOnly ? ['Alerts occupied panels, API-matched thresholds, show-more scope, complete 60-event keyboard scrolling and empty history', 'Complete quota sample table, null/reset gaps and 390/900/1280 overflow'] : historyOnly ? ['History recorded metadata matches API, native modal focus trap, selected row, Escape restoration and 390/900/1280 overflow'] : providersOnly ? ['Provider comparison API values, keyboard selection, 390/900/1280 overflow, unknown/expired/tiny/zero readings'] : overviewOnly ? ['Overview model rail geometry, keyboard scrolling and last-model detail/focus restoration', 'complete Runtime Map table and quota-history access, keyboard and 390/900/1280 overflow'] : ['API-matched complete chart tables, keyboard and 390/900/1280 overflow', 'proportional one-token and zero bars/line points'])], referenceColumnChecks, liveDensityChecks, overviewLayouts, projectCardChecks, providerChecks, modelComparisonChecks, costAxisChecks, historyChecks, historyDensityChecks, alertChecks, chartChecks, modelCostChecks, quotaChecks, runtimeChecks, shellChecks, headerChecks, fontProvenance, fontChecks, cases }, null, 2));
  console.log(`Stable captures passed: ${cases.length} pairs, ${cases.filter(item => item.sha256 === item.repeatSha256).length} byte-identical, remaining pairs within recorded raster tolerance; no masks.`);
} finally {
  await browser?.close(); await daemon.close(); db.close(); globalThis.Date = realDate;
  if (priorTimezone === undefined) delete process.env.TZ; else process.env.TZ = priorTimezone;
}
