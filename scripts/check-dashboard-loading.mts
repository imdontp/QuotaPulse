/** Initial API region layout/recovery gate using an isolated synthetic daemon. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, type Page } from 'playwright';
import { openDb } from '../packages/daemon/src/db/index.js';
import { buildServer } from '../packages/daemon/src/api/server.js';
import { Scheduler } from '../packages/daemon/src/ingest/scheduler.js';
import { recordQuotaAlerts } from '../packages/daemon/src/api/queries.js';
import { en } from '../packages/web/src/i18n/en.js';
import { th } from '../packages/web/src/i18n/th.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const priorTimezone = process.env.TZ;
process.env.TZ = 'Asia/Bangkok';
const output = resolve(root, 'screens/dashboard-loading');
mkdirSync(output, { recursive: true });
// A failed attempt must never leave a previous success manifest in this folder.
rmSync(resolve(output, 'verification.json'), { force: true });
rmSync(resolve(output, 'cost-reference-layout.json'), { force: true });
rmSync(resolve(output, 'reference-detail-regions.json'), { force: true });
const fixedNow = Date.parse('2025-05-17T13:42:00.000Z');
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
  VALUES (1,'codex','fixed','/synthetic/nonexistent','Codex fixture',0,'openai:subscription','openai','OpenAI Subscription','active',${fixedNow}),
    (2,'hermes','fixed','/synthetic/nonexistent','Hermes fixture',0,'opencode:go','opencode','OpenCode Go Subscription','active',${fixedNow}),
    (3,'claude-code','fixed','/synthetic/nonexistent','Claude Code fixture',0,'opencode:go','opencode','OpenCode Go Subscription','active',${fixedNow}),
    (4,'opencode','fixed','/synthetic/nonexistent','OpenCode fixture',0,'openai:subscription','openai','OpenAI Subscription','active',${fixedNow});`);
const referenceProjects = ['QuotaPulse', 'Agent Platform', 'Edge Services', 'Developer Tools', 'Research Lab'];
const referenceModels = [
  { name: 'DeepSeek V4.1', provider: 'deepseek', share: 38 },
  { name: 'GPT-5.x', provider: 'openai', share: 24 },
  { name: 'Claude 3.7', provider: 'anthropic', share: 18 },
  { name: 'Claude 3.5', provider: 'anthropic', share: 11 },
  { name: 'Others', provider: 'openrouter', share: 9 },
  { name: 'GPT-4.1 mini', provider: 'openai', share: 0 },
];
const session = db.prepare('INSERT INTO session(id,source_id,native_session_id,project,last_seen_at) VALUES (?,?,?,?,?)');
const usage = db.prepare('INSERT INTO usage_event(source_id,session_id,dedup_key,ts,model,provider,input_tokens,cached_input_tokens,output_tokens,total_tokens,call_count,cost_usd,cost_source,cost_input_usd,cost_cached_input_usd,cost_cache_write_usd,cost_output_usd,cost_cache_saving_usd,price_provider) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
// Synthetic catalogue rates for the in-memory visual fixture only. The saved
// amount is derived from the same fresh/cached input components the UI reports.
const fixtureInputUsdPerMillion = 0.0593846153846154, fixtureCachedInputUsdPerMillion = 0.004, fixtureOutputUsdPerMillion = 0.004;
for (let index = 0; index < 12; index++) {
  // Keep the reference map's 4 Codex, 2 Claude Code, 6 Hermes, 0 OpenCode
  // recent-session distribution while preserving the same 12 sessions.
  const source = [1, 1, 1, 1, 3, 3, 2, 2, 2, 2, 2, 2][index]!;
  session.run(index + 1, source, `fixture-session-${index}`, referenceProjects[0], fixedNow - 10_000);
  const model = referenceModels[index % referenceModels.length]!;
  const totalTokens = model.share === 0 ? 1 : model.share * 721_000_000 / 600;
  for (let call = 0; call < 3; call++) {
    const inputShare = [.6, .65, .7][(index + call) % 3]!;
    const inputTokens = totalTokens * inputShare * .58, cachedInputTokens = totalTokens * inputShare * .42;
    const outputTokens = totalTokens * (1 - inputShare);
    const costSource = index === 0 ? 'native' : 'computed';
    const inputUsd = inputTokens / 1_000_000 * fixtureInputUsdPerMillion;
    const cachedInputUsd = cachedInputTokens / 1_000_000 * fixtureCachedInputUsdPerMillion;
    const outputUsd = outputTokens / 1_000_000 * fixtureOutputUsdPerMillion;
    const cacheSavingUsd = cachedInputTokens / 1_000_000 * (fixtureInputUsdPerMillion - fixtureCachedInputUsdPerMillion);
    // Keep each session's latest record within four minutes, then spread older calls across the visible 30-minute interval.
    const ageMs = call === 0 ? 15_000 + index * 20_000 : source === 2
      ? 300_000 + index * 120_000 + (call === 2 ? 30_000 : 0)
      : 300_000 + index * 240_000 + (call === 2 ? 90_000 : 0);
    const recordedAt = fixedNow - ageMs;
    usage.run(source, index + 1, `fixed-${index}-${call}`, recordedAt, model.name, model.provider,
      inputTokens, cachedInputTokens, outputTokens, totalTokens, call + 1,
      costSource === 'native' ? (index + 1) / 100 : inputUsd + cachedInputUsd + outputUsd, costSource,
      costSource === 'native' ? null : inputUsd, costSource === 'native' ? null : cachedInputUsd,
      costSource === 'native' ? null : 0, costSource === 'native' ? null : outputUsd,
      costSource === 'native' ? null : cacheSavingUsd, costSource === 'native' ? null : model.provider);
  }
}
// A stale recorded OpenCode route keeps the concept's zero-active-session edge
// visible without manufacturing a provider relationship or changing live counts.
const openCodeAt = fixedNow - 10 * 60_000;
session.run(13, 4, 'fixture-opencode-quota-pulse', referenceProjects[0], openCodeAt);
usage.run(4, 13, 'fixed-opencode-route', openCodeAt, 'DeepSeek V4.1', 'deepseek', 1, 0, 0, 1, 1,
  null, 'unknown', null, null, null, null, null, null);
// The monthly concept is focused on QuotaPulse while the machine-wide quick
// stats still report all five named projects. Keep four small monthly records
// for the other projects, outside the recent-session window.
for (let index = 1; index < referenceProjects.length; index++) {
  const id = 100 + index, source = [1, 3, 4, 2][index - 1]!;
  const model = referenceModels[index - 1]!;
  const at = fixedNow - 10 * 60_000;
  session.run(id, source, `fixture-project-${index}`, referenceProjects[index], at);
  const inputUsd = fixtureInputUsdPerMillion / 1_000_000;
  usage.run(source, id, `fixture-project-usage-${index}`, at, model.name, model.provider, 1, 0, 0, 1, 1,
    inputUsd, 'computed', inputUsd, 0, 0, 0, 0, model.provider);
}
// Values below the old visual minimum catch inflated nonzero bars in both charts.
const tinyUsage = db.prepare("INSERT INTO usage_event(source_id,session_id,dedup_key,ts,model,provider,input_tokens,cached_input_tokens,output_tokens,total_tokens,call_count,cost_usd,cost_source) VALUES (1,1,?,?,'DeepSeek V4.1','deepseek',1,0,0,1,1,0,'computed')");
tinyUsage.run('fixed-tiny-minute', fixedNow - 15 * 60_000);
tinyUsage.run('fixed-tiny-day', fixedNow - 3 * 86_400_000);
const quota = db.prepare('INSERT INTO limit_sample(source_id,window_kind,used_percent,resets_at,observed_at,last_seen_at,source_fetched_at,origin) VALUES (?,?,?,?,?,?,?,?)');
const addQuotaSample = (sourceId: number, window: string, percent: number | null, resetAt: number | null, observedAt: number) => quota.run(sourceId, window, percent, resetAt, observedAt, observedAt, observedAt, 'fixed-fixture');
// Complete history must include older reset periods, nulls and more than eight
// readings per period, without changing the latest live quota/default selection.
for (let segment = 0; segment < 4; segment++) for (let index = 0; index < 12; index++) {
  const at = fixedNow - (5 - segment) * 3_600_000 + index * 60_000;
  addQuotaSample(1, '5h', index === 4 ? null : index === 1 ? 0.5 : index * 8, segment === 0 ? null : fixedNow - (4 - segment) * 3_600_000, at);
}
addQuotaSample(1, '5h', 38, fixedNow + (2 * 60 + 17) * 60_000, fixedNow - 5 * 60_000);
addQuotaSample(1, '5h', 83, fixedNow + (2 * 60 + 17) * 60_000, fixedNow - 30_000);
addQuotaSample(1, 'weekly', 62, fixedNow + (3 * 24 + 5) * 3_600_000, fixedNow - 30_000);
const monthlyReset = fixedNow + (6 * 24 + 2) * 3_600_000;
addQuotaSample(1, 'monthly', 59, monthlyReset, fixedNow - 48 * 3_600_000);
addQuotaSample(1, 'monthly', 65.5, monthlyReset, fixedNow - 24 * 3_600_000);
addQuotaSample(1, 'monthly', 72, monthlyReset, fixedNow - 30_000);
addQuotaSample(2, 'monthly', 58, fixedNow + (12 * 24 + 6) * 3_600_000, fixedNow - 30_000);
addQuotaSample(2, 'daily', 34, fixedNow + (7 * 60 + 18) * 60_000, fixedNow - 30_000);
recordQuotaAlerts(db, fixedNow);
const scheduler = new Scheduler(db, [], { pollMs: 1_000_000, detectMs: 1_000_000 });
const daemon = buildServer(db, scheduler, { token: 'stable-capture-test', port: 7816, webRoot: resolve(root, 'packages/web/dist') });
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
const sha = (value: Buffer) => createHash('sha256').update(value).digest('hex');
const rendererArgs = ['--disable-gpu', '--deterministic-mode', '--disable-skia-runtime-opts', '--force-color-profile=srgb'];
const routes = [
  { name: 'live', endpoint: '/api/live-sessions', loaded: '.qp-live-sessions tbody tr', minRegions: 9 },
  { name: 'projects', endpoint: '/api/projects', loaded: '.qp-project-card', minRegions: 3 },
  { name: 'models', endpoint: '/api/models', loaded: '.qp-model-table-wrap tbody tr', minRegions: 7 },
  { name: 'providers', endpoint: '/api/overview', loaded: '.qp-provider-card', minRegions: 3 },
  { name: 'cost', endpoint: '/api/cost-analysis', loaded: '.qp-cost-summary strong', minRegions: 6 },
  { name: 'history', endpoint: '/api/history-summary', loaded: '.qp-history-records tbody tr', minRegions: 3 },
  { name: 'alerts', endpoint: '/api/overview', loaded: '.qp-alert-summary strong', minRegions: 7 },
];
const matrix = [
  { lang: 'en', theme: 'dark', width: 1586 },
  { lang: 'th', theme: 'dark', width: 390 },
  { lang: 'en', theme: 'light', width: 390 },
  { lang: 'th', theme: 'light', width: 1586 },
];
const results: unknown[] = [];
const browserErrors: string[] = [];
const forbiddenRequests: string[] = [];

async function makePage(config: typeof matrix[number]) {
  const context = await browser!.newContext({ viewport: { width: config.width, height: 992 },
    deviceScaleFactor: 1, reducedMotion: 'reduce', locale: config.lang === 'th' ? 'th-TH' : 'en-US', timezoneId: 'Asia/Bangkok' });
  const page = await context.newPage();
  page.on('pageerror', error => browserErrors.push(String(error)));
  page.on('request', request => {
    if (!request.url().startsWith('http://127.0.0.1:7816/') || request.method() !== 'GET') forbiddenRequests.push(`${request.method()} ${request.url()}`);
  });
  await page.addInitScript(({ lang, theme }) => {
    (window as any).__QUOTAPULSE_TOKEN__ = 'stable-capture-test';
    localStorage.setItem('quotapulse-prefs', JSON.stringify({ lang, currency: 'USD', rate: 1, hiddenSubscriptions: [] }));
    localStorage.setItem('quotapulse-theme', theme);
  }, config);
  await page.clock.setFixedTime(fixedNow);
  return { context, page };
}

async function noOverflow(page: Page) {
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'Horizontal viewport overflow');
}

async function waitLoaded(page: Page, selector: string) {
  await page.locator(selector).first().waitFor({ state: 'visible', timeout: 30_000 });
  await page.waitForFunction(() => document.querySelectorAll('[data-initial-region]').length === 0);
  await page.evaluate(async () => { await document.fonts.ready; });
  await noOverflow(page);
}

async function pendingState(page: Page, kind: string, minRegions: number) {
  await page.locator(`[data-initial-region][data-initial-state=${kind}]`).first().waitFor();
  const regions = await page.locator('[data-initial-region]').evaluateAll(nodes => nodes.map(node => {
    const box = node.getBoundingClientRect();
    return { id: node.getAttribute('data-initial-region'), state: node.getAttribute('data-initial-state'),
      busy: node.getAttribute('aria-busy'), label: node.getAttribute('aria-label'),
      box: { x: box.x, y: box.y, width: box.width, height: box.height },
      hiddenSlots: node.querySelector('.qp-initial-region-slots')?.getAttribute('aria-hidden') };
  }));
  assert.ok(regions.length >= minRegions, `Expected >=${minRegions} reserved regions, got ${regions.length}`);
  assert.ok(regions.every(region => region.label && region.box.width > 0 && region.box.height > 0 && region.hiddenSlots === 'true'));
  assert.ok(regions.every(region => region.state === kind && region.busy === String(kind === 'loading')));
  await noOverflow(page);
  return regions;
}

try {
  await daemon.listen({ host: '127.0.0.1', port: 7816 });
  browser = await chromium.launch({ channel: 'chrome', headless: true, args: rendererArgs });
  for (const config of matrix) for (const route of routes) {
    const { context, page } = await makePage(config);
    let mode: 'hold' | 'fail' | 'pass' = 'hold';
    let release!: () => void;
    const held = new Promise<void>(resolve => { release = resolve; });
    let calls = 0;
    await page.route('**/api/**', async request => {
      if (new URL(request.request().url()).pathname !== route.endpoint) return request.continue();
      calls++;
      if (mode === 'hold') await held;
      if (mode === 'fail') return request.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'initial-region-fixture-503' }) });
      return request.continue();
    });
    const stem = `${route.name}-${config.lang}-${config.theme}-${config.width}`;
    await page.goto(`http://127.0.0.1:7816/#${route.name}`, { waitUntil: 'domcontentloaded' });
    const pending = await pendingState(page, 'loading', route.minRegions);
    if (route.name === 'live') {
      const input = page.locator('.qp-live-search input');
      const before = calls;
      await page.getByRole('button', { name: (config.lang === 'th' ? th : en)['redesign.liveRecentFilter'], exact: true }).click();
      await page.locator('.qp-live-search button').click();
      assert.equal(calls, before, 'Unchanged filters/search must preserve the current in-flight query');
      await input.fill('unsubmitted draft'); await input.focus();
      await input.evaluate(node => { (window as any).__pendingSearchInput = node; });
    }
    await page.screenshot({ path: resolve(output, `${stem}-loading.png`), animations: 'disabled' });
    mode = 'fail'; release();
    const failed = await pendingState(page, 'error', route.minRegions);
    assert.deepEqual(failed.map(region => region.id), pending.map(region => region.id));
    for (let index = 0; index < pending.length; index++) for (const dimension of ['x', 'y', 'width', 'height'] as const) {
      assert.ok(Math.abs(pending[index].box[dimension] - failed[index].box[dimension]) <= 2,
        `${stem}/${pending[index].id}: loading-to-error ${dimension} shifted by more than2px`);
    }
    if (route.name === 'live') assert.equal(await page.evaluate(() => document.activeElement === (window as any).__pendingSearchInput), true, 'Live search DOM/focus must survive pending to error');
    if (route.name === 'projects') {
      const before = calls;
      await page.locator('.qp-project-toolbar select').last().selectOption('recent');
      await pendingState(page, 'error', route.minRegions);
      assert.equal(calls, before, 'Client-only sort neither hides the error nor pretends to start a query');
    }
    const retry = page.locator('[data-initial-state=error] button').first();
    assert.equal(await retry.textContent(), (config.lang === 'th' ? th : en)['app.retry']);
    await page.screenshot({ path: resolve(output, `${stem}-error.png`), animations: 'disabled' });
    mode = 'pass'; await retry.focus(); await page.keyboard.press('Enter');
    await waitLoaded(page, route.loaded);
    assert.ok(calls >= 2, 'Retry must query the failed endpoint again');
    const mainText = await page.locator('main').textContent();
    assert.ok(mainText && !mainText.includes('initial-region-fixture-503'));
    await page.screenshot({ path: resolve(output, `${stem}-recovered.png`), animations: 'disabled' });
    // A failed background query must keep accepted data rather than restoring cold slots.
    const loadedText = await page.locator(route.loaded).first().textContent();
    mode = 'fail'; await page.evaluate(() => window.dispatchEvent(new Event('online')));
    await page.waitForFunction(endpoint => {
      const text = document.querySelector('main')?.textContent ?? '';
      return text.includes('503 Service Unavailable') && text.includes(endpoint);
    }, route.endpoint);
    assert.equal(await page.locator(route.loaded).first().textContent(), loadedText);
    assert.equal(await page.locator('[data-initial-region]').count(), 0);
    results.push({ ...config, route: route.name, calls, pending, failed, backgroundFailureKeptAcceptedData: true, recoveredTextSha256: sha(Buffer.from(mainText)) });
    await context.close();
    console.log(`Initial delay / failure / keyboard query retry passed: ${stem}`);
  }
  for (const config of [matrix[0], matrix[2]]) for (const detail of [
    { name: 'projects', endpoint: '/api/project-detail', initial: 'project-trend', facts: '.qp-project-detail-metrics' },
    { name: 'models', endpoint: '/api/model-detail', initial: 'models-detail-trend', facts: '.qp-model-summary' },
    { name: 'alerts', endpoint: '/api/quota-history', initial: 'alert-history-chart', facts: '.qp-alert-summary' },
  ]) {
    const { context, page } = await makePage(config);
    let mode: 'hold' | 'fail' | 'pass' = 'hold';
    let release!: () => void;
    const held = new Promise<void>(resolve => { release = resolve; });
    let calls = 0;
    await page.route('**/api/**', async request => {
      if (new URL(request.request().url()).pathname !== detail.endpoint) return request.continue();
      calls++; if (mode === 'hold') await held;
      if (mode === 'fail') return request.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'detail-region-fixture-503' }) });
      return request.continue();
    });
    await page.goto(`http://127.0.0.1:7816/#${detail.name}?range=custom&from=${fixedNow - 86_400_000}&to=${fixedNow + 1}`, { waitUntil: 'domcontentloaded' });
    const initial = page.locator(`[data-initial-region=${detail.initial}]`);
    await initial.waitFor();
    const facts = await page.locator(detail.facts).textContent();
    mode = 'fail'; release();
    await page.locator(`[data-initial-region=${detail.initial}][data-initial-state=error]`).waitFor();
    const beforeRetry = calls;
    mode = 'pass'; await initial.getByRole('button').focus(); await page.keyboard.press('Enter');
    await page.waitForFunction(() => document.querySelectorAll('[data-initial-region]').length === 0);
    assert.ok(calls > beforeRetry, 'Same fixed detail identity must issue a fresh query after retry');
    assert.equal(await page.locator(detail.facts).textContent(), facts, 'Primary facts must survive detail loading/failure/retry');
    await noOverflow(page);
    results.push({ kind: 'detail-retry', ...config, route: detail.name, endpoint: detail.endpoint, calls, fixedScope: true, primaryFactsPreserved: true });
    await context.close();
    console.log(`Same-key detail retry passed: ${detail.name}/${config.theme}/${config.width}`);
  }
  for (const name of ['live', 'history']) {
    const config = matrix[0];
    const spec = routes.find(route => route.name === name)!;
    const { context, page } = await makePage(config);
    let release!: () => void;
    const held = new Promise<void>(resolve => { release = resolve; });
    await page.route('**/api/**', async request => {
      if (new URL(request.request().url()).pathname === spec.endpoint) await held;
      await request.continue();
    });
    await page.goto(`http://127.0.0.1:7816/#${name}`, { waitUntil: 'domcontentloaded' });
    await pendingState(page, 'loading', spec.minRegions);
    await page.getByRole('button', { name: en[name === 'live' ? 'redesign.livePause' : 'history.pause'], exact: true }).click();
    await pendingState(page, 'paused', spec.minRegions);
    const response = page.waitForResponse(response => new URL(response.url()).pathname === spec.endpoint);
    release(); await (await response).finished();
    await pendingState(page, 'paused', spec.minRegions);
    await page.getByRole('button', { name: en[name === 'live' ? 'redesign.liveResume' : 'history.resume'], exact: true }).click();
    await waitLoaded(page, spec.loaded);
    results.push({ kind: 'cold-pause-resume', route: name, ...config, ignoredResponseWhilePaused: true });
    await context.close();
    console.log(`Cold pause / resume passed: ${name}`);
  }
  assert.deepEqual(browserErrors, []);
  assert.deepEqual(forbiddenRequests, []);
  writeFileSync(resolve(output, 'verification.json'), JSON.stringify({
    scope: 'seven-route initial API layout and keyboard query-only recovery',
    productionIndexSha256: sha(readFileSync(resolve(root, 'packages/web/dist/index.html'))),
    browser: browser.version(), matrix, results, browserErrors, forbiddenRequests,
    limits: ['This matrix pairs language/theme/width; it is not every combination.', 'Native loaded-image parity, scope races and detail replacement identities require additional checks.', 'Static slot counts are neutral decoration and do not report account, model or project counts.'],
  }, null, 2));
} finally {
  await browser?.close(); await daemon.close(); db.close(); globalThis.Date = realDate; process.env.TZ = priorTimezone;
}
