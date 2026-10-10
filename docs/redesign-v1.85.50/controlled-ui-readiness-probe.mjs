/** Local browser regression checks. All API responses are fixtures; no account probes. */
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { chromium } from 'playwright';

const repo = fileURLToPath(new URL('..', import.meta.url));
const output = resolve(repo, 'screens', 'quota-redesign');
mkdirSync(output, { recursive: true });
const now = Date.now();
const totals = { calls: 10, input_tokens: 100000, cached_input_tokens: 500000, cache_write_tokens: 10000,
  output_tokens: 50000, reasoning_tokens: 10000, total_tokens: 660000, cost_usd: 26.83,
  cost_input_usd: 5, cost_cached_input_usd: 5, cost_cache_write_usd: 1, cost_output_usd: 15.83,
  cost_cache_saving_usd: 20, cost_unknown_calls: 2, cost_estimated_calls: 0 };
/*
 * Six tracked subscriptions on purpose, so the arc cap is actually exercised.
 *
 * With three active ones the overflow path was unreachable: the ring had a spare slot and
 * nothing could prove the cap, the "+N" marker, or the counted-elsewhere line ever worked.
 * Two of these exist purely to be folded. `claude-personal` is inactive and
 * `blind-reader` has no reading at all, so they also cover the two ways a subscription can
 * stay off the ring without being dropped.
 */
const specs = [
  ['openai', 'OpenAI Subscription', 'openai', 'active', 88, 52],
  ['claude-company', 'Claude Company Subscription', 'anthropic', 'active', 32, 24],
  ['claude-personal', 'Claude Personal Subscription', 'anthropic', 'inactive', null, null],
  ['opencode-go', 'OpenCode Go Subscription', 'opencode', 'stale', 48, 60],
  ['gemini-team', 'Gemini Team Subscription', 'google', 'active', 21, 15],
  ['qwen-lab', 'Qwen Lab Subscription', 'qwen', 'active', 12, 8],
  // Tracked, enabled, reporting nothing: must be counted, never given an arc.
  ['blind-reader', 'Blind Reader Subscription', 'mistral', 'active', null, null],
];
const subscriptions = specs.map(([key, name, provider, state]) => ({ account_key: key, subscription_key: key,
  provider, display_name: name, subscription_display_name: name, state, reason: null,
  last_success_at: now - (state === 'stale' ? 7200000 : 15000), owners: [], linked_harness_keys: [],
  telemetry: { freshness: state === 'stale' ? 'stale' : state === 'inactive' ? 'unknown' : 'live',
    latest_quota_at: state === 'inactive' ? null : now - (state === 'stale' ? 7200000 : 15000),
    latest_source_fetched_at: now - 15000, latest_usage_at: now, gap: state === 'stale',
    reason: state === 'stale' ? 'usage_newer_than_quota' : null, origins: ['fixture'], windows: [] } }));
const limits = specs.flatMap(([key, name, provider, state, five, week], index) => state === 'inactive' ? [] :
  [['5h', five, 3 * 3600000], ['weekly', week, 4 * 86400000]].map(([kind, used, reset]) => ({
    source_id: index + 1, harness: index === 0 ? 'codex' : 'claude-code', profile: 'default', display_name: name,
    window_kind: kind, used_percent: used, resets_at: now + reset, severity: null, observed_at: now - 15000,
    source_fetched_at: now - 15000, origin: 'fixture', account_key: key, account_provider: provider,
    account_display_name: name, subscription_key: key, subscription_provider: provider, subscription_display_name: name,
    ageSeconds: state === 'stale' ? 7200 : 15, valueAgeSeconds: 15, last_seen_at: now - 15000,
    burn: index === 0 && kind === '5h' ? { percentPerHour: 8, projectedFullAt: now + 90 * 60000,
      fromPercent: 80, fromAt: now - 3600000, samples: 12 } : null })));
let today = { ...totals };
let empty = false;
let unavailable = false;
let pricingFailure = false;
let pricingEmpty = false;
let pricingDelay = 0;
let modelsDelay = 0;
let trendUnpriced = false;
let trendMixed = false;
const pricingRequests = [];
const apiMethods = [];
const externalRequests = [];
const sourceRow = value => ({ ...value, source_id: 1, harness: 'hermes', profile: 'default', display_name: 'Hermes Agent', vendor: 'deepseek' });
const unpriced = { ...totals, cost_usd: 0, cost_unknown_calls: 10, model: 'deepseek-v4.1-flash', harness: 'hermes', effort: 'low', vendor: 'deepseek' };
/*
 * Sources are grouped by account, so the fixture has to be able to prove the grouping.
 *
 * `openai` is read by two profiles under the same display name, which is exactly the case
 * that made the old one-row-per-source layout unreadable. `claude-company` has a single
 * reader, which must stay one line instead of becoming a one-row table -- and since
 * `groupSources` names a group after its busiest member, that reader's name is by
 * construction the account name, so printing it again would be a duplicate. `hermes` has
 * no account binding, and two unbound profiles, to prove the unbound section keeps every
 * member visible instead of collapsing them into a single summary row.
 */
const telemetry = (freshness, reason = null, gap = false) => ({ freshness, reason, origins: ['fixture'], gap,
  latest_quota_at: now - 15000, latest_source_fetched_at: now - 15000, latest_usage_at: now, windows: [] });
const sourceStatus = [
  // `gap` set: the feed badge already says "usage newer", so the detail line must not repeat it.
  { source_id: 11, harness: 'codex', profile: 'default', display_name: 'OpenAI Subscription', root_path: '/fixture/codex', vendor: 'openai',
    account_state: 'active', enabled: true, account_key: 'openai', calls: 120, total_tokens: 3000000, last_event_ts: now - 20000,
    last_limit_at: now - 15000, last_limit_source_fetched_at: now - 15000, last_limit_reset_at: null, limit_origins: 'fixture',
    limit_samples: 40, telemetry: telemetry('mixed', null, true) },
  { source_id: 12, harness: 'claude-code', profile: 'work', display_name: 'OpenAI Subscription', root_path: '/fixture/claude-work', vendor: 'openai',
    account_state: 'active', enabled: true, account_key: 'openai', calls: 30, total_tokens: 400000, last_event_ts: now - 60000,
    last_limit_at: now - 15000, last_limit_source_fetched_at: now - 15000, last_limit_reset_at: null, limit_origins: 'fixture',
    limit_samples: 12, telemetry: telemetry('stale', 'cached_only') },
  { source_id: 13, harness: 'claude-code', profile: 'default', display_name: 'Claude Company Subscription', root_path: '/fixture/claude', vendor: 'anthropic',
    account_state: 'active', enabled: true, account_key: 'claude-company', calls: 90, total_tokens: 2000000, last_event_ts: now - 30000,
    last_limit_at: now - 15000, last_limit_source_fetched_at: now - 15000, last_limit_reset_at: null, limit_origins: 'fixture',
    limit_samples: 25, telemetry: telemetry('stale', 'usage_newer_than_quota') },
  { source_id: 14, harness: 'hermes', profile: 'default', display_name: 'Hermes Agent', root_path: '/fixture/hermes', vendor: 'deepseek',
    account_state: 'waiting', enabled: true, account_key: null, calls: 60, total_tokens: 900000, last_event_ts: now - 300000,
    last_limit_at: null, last_limit_source_fetched_at: null, last_limit_reset_at: null, limit_origins: null,
    limit_samples: 0, telemetry: telemetry('unknown', 'no_quota_observed') },
  { source_id: 15, harness: 'hermes', profile: 'lab', display_name: 'Hermes Lab', root_path: '/fixture/hermes-lab', vendor: 'deepseek',
    account_state: 'waiting', enabled: false, account_key: null, calls: 5, total_tokens: 60000, last_event_ts: now - 900000,
    last_limit_at: null, last_limit_source_fetched_at: null, last_limit_reset_at: null, limit_origins: null,
    limit_samples: 0, telemetry: telemetry('unknown', 'no_quota_observed') },
];
const harness = (patch) => ({ harness_key: 'codex:default', harness: 'codex', vendor: 'openai', display_name: 'Codex CLI',
  parent_harness_key: null, source_ids: [], subscription_keys: [], delegate_keys: [], detected: true, usage_attributed: true,
  calls: 0, total_tokens: 0, last_event_ts: now, limit_samples: 0, ...patch });
const overview = (hiddenSubscriptions = []) => ({ now, today,
  week: { ...totals, calls: 250, total_tokens: 16500000 }, allTime: totals,
  bySourceToday: [sourceRow(today)], bySourceAll: [sourceRow(totals)], limits: empty ? [] : limits, subscriptions: empty ? [] : subscriptions,
  // Only the two OpenAI readers are linked to a subscription, so the bound account resolves
  // names and the unbound group does not -- which is what decides whether the readers table
  // keeps its subscription column.
  harnesses: empty ? [] : [harness({ source_ids: [11, 12], subscription_keys: ['openai'], calls: 150, total_tokens: 3400000 })],
  sources: [], sourceStatus: empty ? [] : sourceStatus, lastPass: null,
  settings: { pet_enabled: true, tray_animation_enabled: true, hidden_subscriptions: hiddenSubscriptions, updated_at: now } });

let server, browser;
const errors = [];
const requests = [];
async function contextFor(lang = 'en', theme = 'dark', width = 1440, hiddenSubscriptions = []) {
  const context = await browser.newContext({ viewport: { width, height: 1000 }, colorScheme: theme, reducedMotion: 'reduce' });
  let sharedHiddenSubscriptions = [...hiddenSubscriptions];
  let settingsUpdatedAt = now;
  let fixtureNotifications = { enabled: true, snooze_until: null, quiet_start: null, quiet_end: null, updated_at: now };
  await context.addInitScript(({ lang, theme, hiddenSubscriptions }) => {
    localStorage.setItem('quotapulse-theme', theme);
    localStorage.setItem('quotapulse-prefs', JSON.stringify({ lang, currency: 'USD', rate: 1, hiddenSubscriptions }));
    window.EventSource = class extends EventTarget {
      constructor() { super(); (window.__quotaStreams ??= new Set()).add(this); setTimeout(() => this.dispatchEvent(new Event('open')), 10); }
      close() { window.__quotaStreams.delete(this); }
    };
  }, { lang, theme, hiddenSubscriptions });
  await context.route('**/api/**', async route => {
    const u = new URL(route.request().url());
    apiMethods.push({ method: route.request().method(), path: u.pathname });
    if (unavailable) return route.fulfill({ status: 503, json: { error: 'fixture unavailable' } });
    let data;
    if (u.pathname === '/api/pricing/coverage') {
      assert.equal(route.request().method(), 'GET');
      pricingRequests.push(Object.fromEntries(u.searchParams));
      if (pricingDelay) await new Promise(resolve => setTimeout(resolve, pricingDelay));
      if (pricingFailure) return route.fulfill({status:503,json:{error:'fixture pricing unavailable'}});
      const value = pricingEmpty ? {...totals,calls:0,cost_usd:0,cost_unknown_calls:0,cost_estimated_calls:0} : today;
      data = {from:Number(u.searchParams.get('from')),to:Number(u.searchParams.get('to')),
        source_id:u.searchParams.has('source_id')?Number(u.searchParams.get('source_id')):null,
        sourceName:u.searchParams.has('source_id')?'Hermes Agent':null,totals:value,hasHermes:!pricingEmpty,
        models:pricingEmpty?[]:[
          ...(value.cost_unknown_calls ? [{...unpriced, calls:value.cost_unknown_calls, cost_unknown_calls:value.cost_unknown_calls, provider:'opencode-go',price_provider:null}] : []),
          ...(value.cost_estimated_calls ? [{...totals,calls:value.cost_estimated_calls,cost_unknown_calls:0,cost_estimated_calls:value.cost_estimated_calls,model:'reference-model',provider:'gateway',price_provider:'openai'}] : []),
        ], catalog:{pricedModels:0,loadedAt:null,catalogAgeMs:null,catalogOwn:false,catalogPresent:false}};
    }
    else if (u.pathname === '/api/settings') {
      if (route.request().method() === 'PUT') {
        const body = route.request().postDataJSON() ?? {};
        if (Array.isArray(body.hidden_subscriptions)) sharedHiddenSubscriptions = [...new Set(body.hidden_subscriptions)];
        settingsUpdatedAt += 1;
      } else assert.equal(route.request().method(), 'GET');
      data = { pet_enabled: true, tray_animation_enabled: true, hidden_subscriptions: sharedHiddenSubscriptions, updated_at: settingsUpdatedAt };
    }
    else if (u.pathname === '/api/notification-settings') {
      if (route.request().method() === 'PUT') fixtureNotifications = { ...fixtureNotifications, ...(route.request().postDataJSON() ?? {}), updated_at: ++settingsUpdatedAt };
      data = fixtureNotifications;
    }
    else if (u.pathname === '/api/export/usage') {
      return route.fulfill({ status: 200, contentType: 'text/csv; charset=utf-8', headers: { 'content-disposition': 'attachment; filename="fixture.csv"' }, body: '\uFEFFevent_id,total_tokens\r\n1,42\r\n' });
    }
    else if (u.pathname === '/api/alerts') data = { events: [] };
    else if (u.pathname === '/api/compare') data = { current: today, previous: { ...today, calls: 5, total_tokens: 1000, cost_usd: 1, cost_unknown_calls: 0 }, series: [] };
    else if (u.pathname.startsWith('/api/sessions/')) data = { session: { id: 1, native_session_id: 'fixture', project: 'fixture-project', cwd: '/fixture/project', git_branch: null, model_default: unpriced.model, agent: null, started_at: now - 3600000, last_seen_at: now, is_subagent: 0, native_cost_usd: 0, harness: 'hermes', profile: 'default', display_name: 'Hermes Agent' }, events: [] };
    else if (u.pathname === '/api/usage') {
      /*
       * A real range, not always the epoch. `from: 0` is the "all time" sentinel, and with it
       * the usage view short-circuits to the "all time" label before it ever formats a date
       * -- so a month request in the fixture could not exercise the date code at all, and the
       * test for "dates follow the language" was passing on the one call site that was
       * still correct while the others went unchecked.
       */
      const range = u.searchParams.get('range') ?? 'today';
      const from = range === 'all' ? 0 : range === 'week' ? now - 7 * 86400000 : now - 30 * 86400000;
      data = { range: { range, from, to: now, bucket: u.searchParams.get('bucket') ?? 'day', timezone: 'fixture' }, totals: today, timeline: [], bySource: [sourceRow(today)] };
    }
    else if (u.pathname === '/api/overview') data = overview(sharedHiddenSubscriptions);
    else if (u.pathname === '/api/trend') {
      requests.push(Object.fromEntries(u.searchParams));
      if (u.searchParams.get('bucket') === 'minute') {
        const end = Date.now();
        data = { bucket: 'minute', from: end - 1800000, to: end, groupBy: 'none', measurement: 'recorded_tokens_per_minute',
          rows: [{ bucket_ts: Math.floor((end - 60000) / 60000) * 60000, series: 'all', records: 1, calls: 2, total_tokens: 1200 }],
          coverage: { includedRecords: 1, includedCalls: 2, excludedRecords: 1, excludedCalls: 15,
            excludedSources: [{ source_id: 1, source_name: 'Hermes Agent', grain: 'session_aggregate', records: 1, calls: 15, last_observed_tokens: 900 }] } };
      } else {
      const from = Number(u.searchParams.get('from')), to = Number(u.searchParams.get('to'));
      const size = u.searchParams.get('bucket') === 'hour' ? 3600000 : 86400000;
      const rows = [];
      for (let ts = Math.floor(from / size) * size, i = 0; ts < to; ts += size, i++) {
        if(trendMixed && i>=3) break;
        rows.push({ ...totals, bucket_ts: ts, series: 'all', calls: 10, total_tokens: 5000 + (i % 5) * 1500,
          cost_usd: trendMixed ? [0,5,0][i] : trendUnpriced ? 0 : 1 + i % 3,
          cost_unknown_calls:trendMixed ? [10,2,0][i] : trendUnpriced ? 10 : 2 });
      }
      data = { bucket: u.searchParams.get('bucket'), from, to, rows };
      }
    } else if (u.pathname === '/api/models') {
      /*
       * Models is the one view whose loading and empty states were the same array, so it is
       * the one that needs a slow response to be testable. Instant fixtures are why the bug
       * survived: with no delay, `loaded` flips in the same tick the data lands and the
       * false empty state is never on screen long enough to see. `modelsDelay` is what makes
       * the window observable.
       */
      if (modelsDelay) await new Promise(resolve => setTimeout(resolve, modelsDelay));
      data = { models: [unpriced] };
    }
    else if (u.pathname === '/api/projects') data = { rows: [{...unpriced,source_id:1,display_name:'Hermes Agent',project:'fixture-project',harness_vendor:'unknown',last_ts:now}] };
    else if (u.pathname === '/api/sessions') data = { sessions: [{...unpriced,id:1,native_session_id:'fixture',project:'fixture-project',cwd:'/fixture/project',git_branch:null,model_default:unpriced.model,agent:null,started_at:now-3600000,last_seen_at:now,is_subagent:0,native_cost_usd:0,profile:'default',display_name:'Hermes Agent'}], total: 1, vendors: [{vendor:'deepseek',sessions:1}], limit: 50, offset: 0 };
    else if (u.pathname === '/api/health') data = { ok: true, now, pricedModels: 0,
      scheduler: { sources: [], lastPass: null, running: false }, sources: [], coverage: [], errors: [],
      unpriced: [], estimated: [], catalogPath: null, catalogAgeMs: null, catalogOwn: false };
    else if (u.pathname === '/api/refresh') data = { now, pass: { newEvents: 0, newLimits: 0, durationMs: 1, trigger: 'manual' } };
    else throw new Error(`Unexpected API request: ${u.pathname}`);
    await route.fulfill({ json: data });
  });
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  page.on('pageerror', e => errors.push(e.message));
  page.on('request', r => { if (!r.url().startsWith('http://127.0.0.1:7798/')) externalRequests.push(r.url()); });
  return { context, page };
}
async function settle(page) {
  try {
    await page.getByTestId('stat-1').waitFor();
  } catch (error) {
    const state = await page.evaluate(() => ({ url: location.href, readyState: document.readyState, text: document.body.innerText, statCount: document.querySelectorAll('[data-testid="stat-1"]').length }));
    writeFileSync(resolve(output, 'settle-failure.json'), JSON.stringify({ state, errors, externalRequests, apiMethods }, null, 2));
    await page.screenshot({ path: resolve(output, 'settle-failure.png') });
    console.error('UI settle failure evidence:', JSON.stringify({ ...state, errors }));
    throw error;
  }
  await page.evaluate(() => document.fonts.ready);
}
async function noOverflow(page, label) {
  const dimensions = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth }));
  assert.ok(dimensions.scroll <= dimensions.width, `${label}: ${JSON.stringify(dimensions)}`);
}
try {
  server = await createServer({ root: resolve(repo, 'packages/web'), server: { host: '127.0.0.1', port: 7798, strictPort: true } });
  await server.listen();
  /*
   * `--lang=en-US` is not cosmetic. Six date call sites used to pass no locale to Intl,
   * which means "the operating system's", and on a machine whose OS happens to be English
   * that is indistinguishable from correct. Pinning the browser's language to English makes
   * the Thai build have to work harder than the OS was already doing, which is the only
   * way a test on an English CI machine can tell the difference.
   */
  browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--lang=en-US'] });
  for (const limit of limits) limit.used_percent = 10;
  const { context, page } = await contextFor();
  page.setDefaultTimeout(30000);
  let releaseOverview;
  const overviewHold = new Promise(resolve => { releaseOverview = resolve; });
  await page.route('**/api/overview', async route => { await overviewHold; await route.fallback(); });
  await page.goto('http://127.0.0.1:7798/?mode=legacy#live', {waitUntil:'domcontentloaded'});
  const field = page.locator('[data-ambient]'); await field.waitFor();
  const before = { tone:await field.getAttribute('data-tone'), statCount:await page.getByTestId('stat-1').count(), fixtureAgeMs:Date.now()-now };
  releaseOverview();
  await settle(page);
  await page.waitForFunction(() => Number(document.querySelector('[data-testid="pulse-ring"]')?.getAttribute('data-pulse-arcs')) > 0);
  const after = { tone:await field.getAttribute('data-tone'), statCount:await page.getByTestId('stat-1').count(), fixtureAgeMs:Date.now()-now };
  const result={before,after,errors};
  writeFileSync(resolve(repo,'tmp/ui50-tone-probe.json'),JSON.stringify(result,null,2));
  console.log(JSON.stringify(result));
} finally {
  await browser?.close();
  await server?.close();
}
