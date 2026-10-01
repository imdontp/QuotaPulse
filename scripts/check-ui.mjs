/** Local browser regression checks. All API responses are fixtures; no account probes. */
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
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
  await page.getByTestId('stat-1').waitFor();
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
  const { context, page } = await contextFor();
  await page.goto('http://127.0.0.1:7798/?mode=legacy#live'); await settle(page);
  /*
   * The attention panel and the status strip are folded into a "Data health" disclosure at
   * the foot of the page now, so both have to be opened before they can be asserted on. The
   * summary line has to report health on its own, though: a disclosure that only says
   * "details" would let a stale quota feed look like a clean page.
   */
  const health = page.getByTestId('data-health');
  await health.getByText('All feeds reporting', { exact: false }).or(
    health.getByText(/feed\(s\) to check/)).first().waitFor();
  await health.locator('summary').click();
  await page.getByRole('region', { name: 'Data status' }).waitFor();
  await page.getByText('What needs your attention', { exact: true }).waitFor();
  await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true })));
  const palette = page.getByRole('dialog', { name: 'Command palette', exact: true });
  await palette.waitFor();
  await palette.locator('input').fill('Alerts');
  await palette.locator('button').filter({ hasText: 'Alerts' }).first().click();
  await page.waitForURL(/#alerts$/);
  await page.getByText('Alert history', { exact: true }).waitFor();
  await page.goto('http://127.0.0.1:7798/?mode=legacy#live'); await settle(page);
  await page.getByRole('tab', { name: 'Limits', exact: true }).click();
  await page.waitForURL(/#limits$/);
  await page.goBack();
  await page.waitForFunction(() => document.querySelector('[role=tab][aria-selected=true]')?.textContent === 'Live');
  await page.goForward();
  await page.waitForFunction(() => document.querySelector('[role=tab][aria-selected=true]')?.textContent === 'Limits');
  await page.getByRole('combobox', { name: 'All subscriptions' }).selectOption('openai');
  assert.equal(await page.locator('tbody tr').count(), 2);
  // The status filter used to borrow `quota.all` ("All statuses") as its accessible name,
  // which named the control after its first option rather than after what it filters.
  await page.getByRole('combobox', { name: 'Status', exact: true }).selectOption('available');
  await page.getByText('No subscriptions match these filters.').waitFor();
  await page.goto('http://127.0.0.1:7798/?mode=legacy#live'); await settle(page);
  for (const [cost, unknown, expected] of [[0, 10, '--'], [0, 0, '$0.0000'], [26.83, 2, '$26.83+'], [26.83, 0, '$26.83']]) {
    today = { ...totals, cost_usd: cost, cost_unknown_calls: unknown };
    await page.reload(); await settle(page);
    assert.equal(await page.getByTestId('stat-1').locator('[data-value-number]').innerText(), expected);
    assert.equal(await page.locator('tbody tr td').last().locator('[data-value-number]').innerText(), expected);
  }
  today = {...totals,calls:0,cost_usd:0,cost_unknown_calls:0};
  await page.reload(); await settle(page);
  assert.equal(await page.getByTestId('stat-1').locator('[data-pricing-state]').getAttribute('data-pricing-state'),'empty');
  today = {...totals,cost_estimated_calls:3};
  await page.reload(); await settle(page);
  await page.getByTestId('stat-1').getByLabel(/3 calls use another provider’s reference price/).waitFor();
  const pricingButton = page.getByRole('button',{name:'Pricing details — Hermes Agent',exact:true});
  await pricingButton.focus(); await page.keyboard.press('Enter');
  let dialog = page.getByRole('dialog',{name:'Pricing details — Hermes Agent',exact:true});
  await dialog.getByTestId('pricing-coverage').waitFor();
  assert.equal(await dialog.getByTestId('pricing-coverage').innerText(),'8 of 10 calls valued · 2 unpriced');
  await dialog.getByText('deepseek-v4.1-flash',{exact:true}).waitFor();
  await dialog.getByText('Reference price provider: openai',{exact:true}).waitFor();
  await dialog.getByText('Hermes records running session totals',{exact:false}).waitFor();
  for(let i=0;i<12;i++) {
    await page.keyboard.press('Tab');
    assert.equal(await dialog.evaluate(el=>el.contains(document.activeElement)),true,`focus must stay in modal: ${await page.evaluate(()=>({tag:document.activeElement?.tagName,html:document.activeElement?.outerHTML.slice(0,250),open:document.querySelector('dialog[open]')!=null})).then(JSON.stringify)}`);
  }
  await page.screenshot({path:resolve(output,'pricing-en-dark-1440.png')});
  await page.keyboard.press('Escape');
  await dialog.waitFor({state:'hidden'});
  assert.equal(await page.evaluate(()=>document.activeElement?.getAttribute('aria-label')),'Pricing details — Hermes Agent');
  assert.equal(pricingRequests.at(-1).source_id,'1');
  assert.equal(Number(pricingRequests.at(-1).to),now);
  assert.equal(new Date(Number(pricingRequests.at(-1).from)).getHours(),0);

  pricingFailure=true;
  await pricingButton.click();
  dialog=page.getByRole('dialog',{name:'Pricing details — Hermes Agent',exact:true});
  await dialog.getByRole('alert').waitFor();
  pricingFailure=false;
  await dialog.getByRole('button',{name:'Try again'}).click();
  await dialog.getByTestId('pricing-coverage').waitFor();
  pricingEmpty=true;
  await page.evaluate(()=>window.__quotaStreams.forEach(s=>s.dispatchEvent(new MessageEvent('data',{data:'{}'}))));
  await dialog.getByText('No missing or reference prices in this selection.').waitFor();
  await dialog.getByText('No usage in this period',{exact:true}).waitFor();
  await dialog.getByRole('button',{name:'Close pricing details'}).click();
  pricingEmpty=false;
  pricingDelay=250;
  await pricingButton.click();
  dialog=page.getByRole('dialog',{name:'Pricing details — Hermes Agent',exact:true});
  await dialog.getByRole('status').waitFor();
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  assert.equal(await page.getByRole('dialog').count(),0,'late results must not reopen a closed dialog');
  pricingDelay=0;
  today = { ...totals };
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  assert.equal(await page.getByRole('dialog', { name: 'Settings', exact: true }).getByRole('checkbox').count(), 0,
    'the top-bar menu keeps quick preferences only');
  await page.getByRole('button', { name: 'Open full Settings', exact: true }).click();
  await page.locator('h2').filter({ hasText: 'Settings' }).waitFor();
  await page.getByRole('checkbox', { name: 'OpenAI Subscription', exact: true }).uncheck();
  await page.getByText('hidden', { exact: true }).first().waitFor();
  await page.goto('http://127.0.0.1:7798/?mode=legacy#live'); await settle(page);
  assert.equal(await page.locator('.quota-card').filter({ hasText: 'OpenAI Subscription' }).count(), 0);
  // The subscription cards are collapsed behind a disclosure now, so a count of zero has to
  // be paired with a positive case or it proves nothing about the hidden preference.
  assert.equal(await page.getByTestId('subscription-detail').count(), 1);
  assert.equal(await page.locator('.quota-card').filter({ hasText: 'Claude Company Subscription' }).count(), 1,
    'a visible subscription is still present in the collapsed detail');
  const resets = page.getByRole('list', { name: 'Next resets', exact: true });
  assert.equal(await resets.getByText('OpenAI Subscription', { exact: true }).count(), 0);
  // Pair the above with its positive case, or the count of zero proves nothing: the strip
  // groups simultaneous resets into one stop, so a hidden name must be gone from the group
  // while its neighbours stay.
  assert.ok(await resets.getByText('Claude Company Subscription', { exact: true }).count() > 0,
    'a visible subscription is still listed under Next resets');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: 'Open full Settings', exact: true }).click();
  await page.locator('h2').filter({ hasText: 'Settings' }).waitFor();
  await page.getByRole('checkbox', { name: 'OpenAI Subscription', exact: true }).check();
  await page.getByText('shown', { exact: true }).first().waitFor();
  await page.goto('http://127.0.0.1:7798/?mode=legacy#live'); await settle(page);
  const day = requests.find(r => r.bucket === 'day');
  // 30 daily buckets, not 7: the streak and the 30-day badge need month-scale history, and
  // the week sparkline is the last seven points of the same series.
  assert.equal(Number(day.to) - Number(day.from), 30 * 86400000);
  const hour = requests.find(r => r.bucket === 'hour');
  assert.equal(new Date(Number(hour.from)).getHours(), 0);
  assert.equal(await page.getByTestId('stat-1').count(), 1, 'the ticker owns the pinned value cell');
  assert.equal(await page.getByTestId('pulse-ring').count(), 1);
  /*
   * Six tracked subscriptions, four of them reporting, and the ring draws four. The two that
   * are held back must be *counted* rather than dropped: a quota you cannot see anywhere is
   * worse than a busy ring. The seventh reports nothing at all and must not take a slot to
   * render "--", so it is counted separately instead.
   */
  assert.equal(await page.locator('[data-pulse-arcs]').getAttribute('data-pulse-arcs'), '4',
    'one arc per reporting subscription, capped');
  assert.equal(await page.getByTestId('pulse-folded').innerText(), '+1',
    'a reporting subscription the cap held back is counted, not dropped');
  assert.equal(await page.getByTestId('pulse-unmeasured').innerText(), '1 without a reading yet');
  // The inactive subscription must not take a ring slot either. It is still rendered further
  // down the page inside the inactive disclosure, hence the scoped lookup.
  assert.equal(await page.getByTestId('pulse-hero').getByText('Claude Personal Subscription', { exact: true }).count(), 0,
    'an inactive subscription stays out of the hero');
  assert.equal(await page.getByTestId('pulse-hero').getByText('Blind Reader Subscription', { exact: true }).count(), 0,
    'a subscription with no reading does not take an arc either');
  // Progression is browser-local: the dashboard must not add an endpoint to write it.
  assert.ok(apiMethods.every(({ path }) => !path.includes('progress')),
    'progression persists to localStorage, never the daemon');
  await page.goto('http://127.0.0.1:7798/?mode=legacy#usage?range=today&view=summary');
  await page.getByRole('button', { name: 'Export CSV', exact: true }).waitFor();
  const [usageDownload] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Export CSV', exact: true }).click(),
  ]);
  assert.equal(usageDownload.suggestedFilename(), 'fixture.csv');
  for (const [tab, target] of [
    ['sources', '#sources'], ['limits', '#limits'], ['cost', '#usage?range=all&view=cost'],
    ['sessions', '#sessions'], ['projects', '#usage?range=month&view=projects'],
    ['models', '#usage?range=month&view=models'], ['health', '#health'], ['alerts', '#alerts'],
  ]) {
    await page.goto(`http://127.0.0.1:7798/?mode=legacy${target}`);
    await page.locator('[role=tabpanel][data-state=active]').waitFor();
    await page.waitForTimeout(250);
    await noOverflow(page, tab);
    if(tab==='sources') {
      /*
       * The Sources page rendered one row per database source, so a single account read by
       * two profiles appeared as two identically named rows with nothing to tell them apart.
       * It now groups by account, which means the grouping itself is the behaviour worth
       * asserting -- and that the two shapes the fixture covers really do differ, because a
       * group with one reader would pass the same assertions as a group with two if the
       * members were only ever counted and never rendered.
       */
      const groups = page.getByTestId('source-group');
      assert.equal(await groups.count(), 3, 'two bound accounts and one unbound harness group');
      assert.deepEqual(
        await groups.evaluateAll(nodes => nodes.map(n => `${n.dataset.key}:${n.dataset.members}`)),
        ['openai:2', 'claude-company:1', 'unbound:hermes:2'],
        'readers collapse under their account, unbound harnesses group by harness',
      );
      const openai = page.locator('[data-testid="source-group"][data-key="openai"]');
      // Two readers means a real table, and both profiles must be named in it.
      assert.equal(await openai.locator('tbody tr').count(), 2, 'both readers of the account are listed');
      assert.equal(await openai.getByText('claude-code/work', { exact: true }).count(), 1,
        'the second reader is distinguishable by its profile');
      // One reader means no table at all: a header row and a grid to say "one of these".
      const claude = page.locator('[data-key="claude-company"]');
      assert.equal(await claude.locator('table').count(), 0, 'a single reader does not get a table header');
      // And the account name is not echoed back as the reader name, which is what made the
      // old single-row layout read as the same string twice.
      assert.equal(await claude.getByText('Claude Company Subscription', { exact: true }).count(), 1,
        'the group is named once; the reader line adds profile, feed state and tokens instead');
      assert.equal(await claude.getByText('claude-code/default', { exact: true }).count(), 1,
        'the reader still identifies which harness profile did the reading');
      /*
       * `freshness: 'gap'` and `reason: 'usage_newer_than_quota'` are the same fact from two
       * directions and the daemon sets both at once, so the badge and the detail line used to
       * print the same sentence twice. A stale feed whose reason is the same is different: the
       * badge says "stale" and the line is the only thing that says why.
       */
      assert.equal(await openai.getByText('usage newer', { exact: true }).count(), 1,
        'a gap feed states the fact once');
      assert.equal(await openai.getByText('usage is newer than quota', { exact: false }).count(), 0,
        'and the detail line does not repeat it');
      assert.equal(await claude.getByText('stale', { exact: true }).count(), 1, 'a stale feed keeps its badge');
      assert.equal(await claude.getByText('usage is newer than quota', { exact: false }).count(), 1,
        'and the reason the badge does not carry is still spelled out');
      // Unbound profiles must all stay visible, not collapse into one summary line.
      const unbound = page.getByTestId('source-unbound');
      assert.equal(await unbound.getByText('Hermes Lab', { exact: false }).count() > 0, true,
        'the quieter unbound profile is still shown');
      /*
       * A disabled source is still listed precisely because it has history, so the page
       * cannot say "expired" about its feed and leave the reader hunting for a quota
       * problem that does not exist.
       */
      assert.equal(await unbound.getByText('disabled', { exact: true }).count(), 1,
        'the switched-off source says so next to its feed state');
      assert.equal(await page.getByText('disabled', { exact: true }).count(), 1,
        'and only the one that is actually switched off claims to be');
      /*
       * An unbound group is a table of readers with no subscription to name. Keeping the
       * column makes it the widest thing on the page and fills it with em dashes.
       */
      assert.equal(await unbound.getByRole('columnheader', { name: 'Subscription', exact: true }).count(), 0,
        'a table with no subscription in it drops the subscription column');
      assert.equal(await unbound.getByRole('columnheader', { name: 'reader', exact: true }).count(), 1,
        'and keeps the columns that do carry something');
      // The other side of that rule: a group whose readers are linked to a subscription keeps it.
      assert.equal(await openai.getByRole('columnheader', { name: 'Subscription', exact: true }).count(), 1,
        'a group that is linked to a subscription keeps the column');
      // Scoped to the column cells: the group header carries the same name, and counting the
      // whole group would pass even if only one of the two readers resolved.
      assert.equal(await openai.locator('tbody tr td:nth-child(2)').allInnerTexts().then(t => t.filter(v => v === 'OpenAI Subscription').length), 2,
        'and both readers name the subscription they read');
    }
    if(tab==='health') {
      /*
       * Unpriced models and ingest errors each used to render a card unconditionally, so a
       * healthy install showed two titled boxes whose entire contents were "nothing to
       * report". The fixture has neither, so this is exactly the state that was broken.
       */
      assert.equal(
        await page.getByText('Nothing to flag', { exact: true }).count(),
        1,
        'a clean install gets one clear line, not two empty cards',
      );
      assert.equal(
        await page.getByText('Ingest errors', { exact: true }).count(),
        0,
        'the ingest-errors card must not exist with no errors to list',
      );
    }
    if(tab==='cost') {
      /*
       * The all-time cost used to be printed twice on this one view: once in the headline
       * card and again in the breakdown table's total row, each with its own copy of the
       * pricing modal, so a reader could not tell which was authoritative. The table total
       * is plain text now; the headline keeps the interactive figure.
       */
      assert.equal(
        await page.getByRole('button', { name: 'Pricing details — All-time value', exact: true }).count(),
        1,
        'exactly one interactive all-time figure: the headline',
      );
      assert.equal(
        await page.locator('tbody tr.border-t-2 [data-value-number]').count(),
        0,
        'the breakdown total must not be a second interactive value',
      );
      // The total row still exists and still totals the column -- dedupe is not deletion.
      assert.equal(await page.locator('tbody tr.border-t-2 td').count(), 4);
    }
    if(tab==='sessions') {
      assert.equal(await page.locator('tbody [data-value-number]').innerText(),'--');
      assert.equal(await page.locator('tbody tr td').last().innerText(),'$0.0000','native cost stays separate');
    }
    if(tab==='models') {
      assert.equal(await page.locator('tbody [data-pricing-state]').getAttribute('data-pricing-state'),'unknown');
      await page.locator('select').filter({ has: page.locator('option[value="cost_usd"]') }).first().selectOption('cost_usd');
      await page.getByText('--',{exact:true}).nth(2).waitFor();
      assert.ok(await page.getByText('--',{exact:true}).count()>=3,'unpriced model remains in both effort charts and table');
    }
    if(tab==='projects') {
      await page.locator('select').filter({ has: page.locator('option[value="cost_usd"]') }).first().selectOption('cost_usd');
      const project=page.getByRole('button',{name:/fixture-project/});
      await project.waitFor();
      await project.getByText('--',{exact:true}).waitFor();
      assert.ok((await project.innerText()).includes('--'),'unpriced project must not disappear');
      await project.click();
      await page.locator('tbody [data-value-number]').waitFor();
      assert.equal(await page.locator('tbody [data-value-number]').innerText(),'--');
    }
    if(tab==='sessions') {
      const sessionRow = page.getByRole('row').filter({ hasText: 'fixture-project' }).first();
      await sessionRow.click();
      const drawer = page.getByRole('dialog', { name: 'Session details', exact: true });
      await drawer.getByText('Recorded calls').waitFor();
      await drawer.getByRole('button', { name: 'Close session details', exact: true }).click();
      await drawer.waitFor({ state: 'hidden' });
    }
    if(tab==='cost') {
      await page.getByRole('button',{name:'Pricing details — Hermes Agent',exact:true}).click();
      await page.getByRole('dialog').getByTestId('pricing-coverage').waitFor();
      assert.equal(pricingRequests.at(-1).from,'0');
      await page.keyboard.press('Escape');
    }
  }
  await context.close();
  console.log('PASS navigation, filters, cost states, periods, and all sections');

  /*
   * A view must never claim something about the user's data that it has not established yet.
   *
   * The Models tab guarded its "nothing here" branch on `loaded && models.length === 0` and
   * then tested a second branch on `filtered.length === 0` -- which is the same empty array
   * while the request is in flight. So every cold open showed "no models match your filters"
   * beside a call count of 0, before a single byte of data had arrived. An instant fixture
   * cannot catch that, because the loading state never survives long enough to be seen; the
   * response is held open here to make the window observable.
   */
  modelsDelay = 2500;
  const slowModels = await contextFor();
  await slowModels.page.goto('http://127.0.0.1:7798/?mode=legacy#usage?range=month&view=models');
  await slowModels.page.locator('[role=tabpanel][data-state=active]').waitFor();
  const modelTab = slowModels.page.locator('[role=tabpanel][data-state=active]');
  /*
   * A short wait is safe rather than flaky here, because the delay is a hard block inside
   * the route handler: at 400ms into a 2500ms response the data cannot have arrived, so
   * whatever is on screen is what the loading state decided to say. Waiting on the
   * placeholder instead would make a regression fail as a bare timeout, which is a much
   * worse thing to read than "it claimed the user has no models".
   */
  await modelTab.waitFor({ timeout: 5000 });
  await slowModels.page.waitForTimeout(400);
  assert.equal(
    await modelTab.getByText('no models match this filter', { exact: false }).count(),
    0,
    'a view still loading must not report that the user has no models',
  );
  assert.equal(
    await modelTab.getByText('no model usage recorded yet', { exact: false }).count(),
    0,
    'nor that there is nothing to track',
  );
  assert.equal(
    await modelTab.locator('[data-slot=skeleton]').count() > 0,
    true,
    'and it says it is waiting, in the shape the data will arrive in',
  );
  // The promise, not just the absence of a wrong answer: once the data lands the same view
  // must show it, so the placeholder is a loading state and not a permanent one.
  await modelTab.locator('tbody').waitFor({ timeout: 10000 });
  assert.equal(
    await modelTab.locator('[aria-busy=true]').count(),
    0,
    'the placeholder clears once the data arrives',
  );
  await slowModels.context.close();
  modelsDelay = 0;
  console.log('PASS a loading view claims nothing about the data it is still waiting for');

  /*
   * Every tab must be reachable by heading.
   *
   * `CardTitle` drew a div, and it is the title primitive for every section card, so six of
   * the eleven surfaces had no heading element anywhere in their subtree. That is invisible
   * on screen and removes the page from a screen reader's heading list, from the rotor, and
   * from jumping between sections by heading for everyone -- a navigation aid that needs no
   * assistive technology at all. Asserting the outline rather than the presence of one
   * heading is what makes this worth checking: a page with a single h1 and nothing under it
   * is exactly the failure that looks like a pass.
   */
  for (const [tab, target] of [
    ['live', '#live'], ['usage', '#usage?range=today&view=summary'], ['sessions', '#sessions'],
    ['limits', '#limits'], ['alerts', '#alerts'], ['sources', '#sources'], ['health', '#health'],
    ['settings', '#settings'],
    // The four Usage sub-views are four surfaces, not one with tabs: each mounts its own
    // panels, and each had its own missing headings.
    ['usage/cost', '#usage?range=all&view=cost'],
    ['usage/projects', '#usage?range=month&view=projects'],
    ['usage/models', '#usage?range=month&view=models'],
  ]) {
    const { context, page } = await contextFor();
    await page.goto(`http://127.0.0.1:7798/?mode=legacy${target}`);
    const panel = page.locator('[role=tabpanel][data-state=active]');
    await panel.waitFor();
    await page.waitForTimeout(300);
    // h1 is the tab name in the topbar, outside the panel; the panel must add a level under it.
    const levels = await panel.evaluate(node =>
      [...node.querySelectorAll('h1,h2,h3,h4,h5,h6')].map(h => Number(h.tagName[1])));
    assert.ok(levels.length > 0, `${tab}: the page has no heading of its own under the tab title`);
    assert.equal(levels.filter(l => l === 1).length, 0, `${tab}: must not introduce a second h1`);
    assert.ok(levels.every(l => l >= 2), `${tab}: headings must sit below the page's h1, got ${levels.join(',')}`);
    // No level may be skipped: an h4 straight under an h2 is an outline the reader cannot follow.
    let previous = 1;
    for (const level of levels) {
      assert.ok(level <= previous + 1, `${tab}: heading level jumps from h${previous} to h${level}`);
      previous = level;
    }
    /*
     * The outline being non-empty is not the same as the outline being complete. A page with
     * four regions where only one carries a heading satisfies the check above, and it is
     * still three regions a reader cannot jump to. So this asserts the stronger property:
     * every top-level card is a region, and every region has a name.
     */
    const unnamed = await panel.evaluate(node => {
      // A card is a region of the page only if nothing above it already frames it. A card
      // inside a card, inside a <details>, or inside a labelled <section> is part of that
      // enclosing region -- the data-status strip is four tiles in one named group, and
      // giving each its own heading would be four entries where a reader expects one.
      const framed = element => {
        for (let el = element.parentElement; el && el !== node; el = el.parentElement) {
          if (el.matches('[data-slot=card], details, section[aria-label], [role=region]')) return true;
        }
        return false;
      };
      return [...node.querySelectorAll('[data-slot=card]')]
        .filter(card => !framed(card))
        .filter(card => !card.querySelector('h1,h2,h3,h4,h5,h6'))
        .map(card => (card.textContent ?? '').trim().slice(0, 40));
    });
    assert.deepEqual(unnamed, [], `${tab}: every top-level region needs a heading, these have none`);
    await context.close();
  }
  console.log('PASS every tab has a heading outline under its title, with no skipped levels');

  /*
   * The ambient backdrop has to be everywhere, and it has to be a decision rather than a
   * constant.
   *
   * "Everywhere" is the whole point -- the craft in this app used to live only on Live, the
   * page a person sees for three seconds on launch. A per-tab test is the only way to catch
   * someone adding it to one surface and considering the job done.
   *
   * "A decision" matters more: a backdrop that is always the same colour is wallpaper, and a
   * backdrop that contradicts the rings is worse than none. So the fixture is pushed to
   * states that must produce different tones, and the element has to report which one it
   * decided on rather than leaving us to reverse-engineer a gradient.
   */
  const ambientTabs = [
    ['#live'], ['#usage?range=today&view=summary'], ['#sessions'], ['#limits'],
    ['#alerts'], ['#sources'], ['#health'], ['#settings'],
  ];
  for (const [target] of ambientTabs) {
    const { context, page } = await contextFor();
    await page.goto(`http://127.0.0.1:7798/?mode=legacy${target}`);
    const field = page.locator('[data-ambient]');
    await field.waitFor({ timeout: 10000 });
    const tone = await field.getAttribute('data-tone');
    // One of the four states, not an empty string and not a fifth value.
    assert.ok(['idle', 'ok', 'warn', 'crit'].includes(tone), `${target}: ambient tone is "${tone}"`);
    // A weight that is a real number, so a NaN or undefined cannot pass as "zero intensity".
    const weight = await field.evaluate(node => getComputedStyle(node).getPropertyValue('--ambient-weight').trim());
    assert.match(weight, /^\d+(\.\d+)?%?$/, `${target}: ambient weight is "${weight}"`);
    // It must not be painted over the content: the field is behind everything.
    assert.equal(await field.evaluate(node => getComputedStyle(node).pointerEvents), 'none',
      `${target}: the backdrop must not intercept clicks`);
    await context.close();
  }
  console.log('PASS every tab carries a data-driven ambient backdrop');

  /*
   * ...and it has to actually respond to the data, which is the part a "is the element
   * there" test cannot see. A backdrop that renders on every tab with a hardcoded colour
   * passes everything above and is pure wallpaper.
   *
   * The fixture is pushed from a comfortable dashboard to a nearly-full one and the reported
   * tone has to move with it. Checking the attribute rather than sampling a pixel is
   * deliberate: the gradient is a `color-mix` of an OKLCH token, so its computed colour is a
   * browser's interpretation of it, and asserting on that would be testing Chromium.
   */
  const toneAt = async (fill) => {
    // Normalised first, because the standing fixture is the crisis scenario -- 88% used with
    // a dead feed -- so "calm" has to be arranged rather than assumed.
    for (const limit of limits) limit.used_percent = fill;
    const { context, page } = await contextFor();
    await page.goto('http://127.0.0.1:7798/?mode=legacy#live');
    const field = page.locator('[data-ambient]');
    await field.waitFor({ timeout: 10000 });
    const tone = await field.getAttribute('data-tone');
    const weight = Number((await field.evaluate(node => getComputedStyle(node).getPropertyValue('--ambient-weight'))) || 0);
    await context.close();
    return { tone, weight, fill };
  };
  const calm = await toneAt(10);
  const strained = await toneAt(92);
  assert.equal(calm.tone, 'ok', 'a dashboard with quota to spare is calm');
  assert.equal(strained.tone, 'crit', 'and one with every window past 85% is not');
  assert.ok(strained.weight > calm.weight, 'and the wash gets stronger, not just differently coloured');
  for (const limit of limits) limit.used_percent = 10;
  console.log('PASS the ambient backdrop follows the data rather than a constant');

  /*
   * The figure tint has to be selective, which is the entire design.
   *
   * On a page that repaints about once a second, a tint on every change is a strobe and no
   * tint at all makes a working machine indistinguishable from an idle one. Both failure
   * modes are invisible to a unit test of the threshold, because the threshold is pure --
   * what needs checking in a browser is that the class actually lands on the element, and
   * that it does not land on drift.
   */
  {
    const { context, page } = await contextFor();
    await page.goto('http://127.0.0.1:7798/?mode=legacy#usage?range=today&view=summary');
    await page.locator('.tabular').first().waitFor();
    // Mounting is not a change, so a tile that has only ever had one value must be silent.
    const before = await page.locator('.value-moved').count();
    assert.equal(before, 0, 'a figure that has not moved is not highlighted');
    // A real jump: the fixture's totals are pushed far past any relative threshold.
    today = { ...totals, total_tokens: totals.total_tokens * 4 };
    // The fixture has no daemon. Publish the same data event a real ingest pass sends;
    // waiting for the 30-second fallback made this assertion depend on test timing.
    await page.evaluate(() => window.__quotaStreams.forEach(stream => stream.dispatchEvent(new MessageEvent('data', { data: '{}' }))));
    const lit = page.locator('.value-moved');
    await lit.first().waitFor({ timeout: 10000 });
    assert.ok((await lit.count()) > 0, 'a figure that moved far enough says so');
    // And it is a tint, not a slide: the element must not be mid-transform.
    const moving = await lit.first().evaluate(node => {
      const style = getComputedStyle(node);
      return style.transform !== 'none' || style.translate !== 'none';
    });
    assert.equal(moving, false, 'the highlight moves nothing, so it cannot cause motion sickness');
    today = { ...totals };
    await context.close();
  }
  console.log('PASS a figure that moved is highlighted, and one that merely drifted is not');

  /*
   * Dates follow the language the reader chose, not the one their machine is set to.
   *
   * Six call sites passed no locale to `toLocaleDateString()`, so Intl used the OS. That is
   * invisible in a test that runs in one language and wrong for everyone: a Thai build on an
   * English machine read English dates, and the trend chart's two axes ended up in different
   * languages. The browser is launched with `--lang=en-US` for exactly this reason.
   *
   * The assertion compares the two renders against each other rather than against a literal
   * month name, because the month depends on the fixture's range and hard-coding one turned
   * this into a test of the fixture. What is being checked is the property: the same input
   * formatted for two languages must come out different. If the OS locale were leaking
   * through, both would be English and identical.
   */
  const ENGLISH_MONTHS = /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b/;
  const rendered = async (lang, testid) => {
    const { context, page } = await contextFor(lang, 'dark', 1440);
    await page.goto('http://127.0.0.1:7798/?mode=legacy#usage?range=month&view=summary');
    const target = page.getByTestId(testid);
    await target.waitFor({ timeout: 10000 });
    await page.waitForTimeout(300);
    const text = await target.innerText();
    await context.close();
    return text;
  };
  for (const testid of ['usage-range', 'usage-range-label']) {
    const thai = await rendered('th', testid);
    const english = await rendered('en', testid);
    /*
     * The Thai build must contain no English month at all, and the English build no Thai.
     * This is the clause that catches the original bug, and it is deliberately not written
     * as "the two renders differ" -- every label on the page differs between the two builds
     * anyway, so that comparison would pass on a page whose dates were both in English.
     */
    assert.ok(!ENGLISH_MONTHS.test(thai),
      `${testid}: a Thai build must not format dates in English, got ${JSON.stringify(thai)}`);
    assert.ok(!/[ก-๙]/.test(english),
      `${testid}: an English build must not format dates in Thai, got ${JSON.stringify(english)}`);
    // And a real range, so the assertion is looking at formatted dates and not at the
    // "all time" label, which formats nothing.
    assert.notEqual(thai, english, `${testid}: the two builds must not be identical`);
  }
  console.log('PASS dates follow the chosen language, not the operating system');

  /*
   * Every column header says what it heads.
   *
   * A `<th>` with no `scope` tells a screen reader that it is a header and nothing more, so
   * the value under it is unassociated. Eleven tables had that, and the fix belongs in the
   * primitive rather than at eleven call sites.
   *
   * The companion check is the one worth having: `aria-sort` must appear on no table in this
   * app, because none of them have a sort control. It is the sort of accessibility attribute
   * that gets added on principle and then promises a person can reorder a table that cannot
   * be reordered.
   */
  {
    const { context, page } = await contextFor();
    const found = { total: 0, unscoped: 0, sorted: 0 };
    for (const target of ['#limits', '#health', '#sources', '#sessions', '#usage?range=today&view=summary',
      '#usage?range=month&view=models', '#usage?range=month&view=projects', '#live']) {
      await page.goto(`http://127.0.0.1:7798/?mode=legacy${target}`);
      await page.locator('[role=tabpanel][data-state=active]').waitFor();
      await page.waitForTimeout(200);
      const heads = await page.locator('th').evaluateAll(nodes => nodes.map(node => ({
        scope: node.getAttribute('scope'),
        sort: node.getAttribute('aria-sort'),
      })));
      found.total += heads.length;
      found.unscoped += heads.filter(head => !head.scope).length;
      found.sorted += heads.filter(head => head.sort).length;
    }
    assert.ok(found.total > 20, `expected to find the tables' column headers, saw ${found.total}`);
    assert.equal(found.unscoped, 0, `${found.unscoped} of ${found.total} column headers have no scope`);
    assert.equal(found.sorted, 0,
      'no table here has a sort control, so aria-sort would promise one that does not exist');
    await context.close();
  }
  console.log('PASS every column header is scoped, and none claims to be sortable');
  for (const lang of ['en', 'th']) for (const theme of ['dark', 'light']) for (const width of [390, 900, 1280, 1440]) {
    const { context, page } = await contextFor(lang, theme, width);
    await page.goto('http://127.0.0.1:7798/?mode=legacy#live'); await settle(page);
    await noOverflow(page, `${lang}-${theme}-${width}`);
    assert.equal(await page.locator('html').getAttribute('lang'), lang);
    assert.equal(await page.locator('html').evaluate(el => el.classList.contains('dark')), theme === 'dark');
    await page.screenshot({ path: resolve(output, `${lang}-${theme}-${width}.png`), fullPage: true });
    if(width===390 || width===1440) {
      const details=lang==='en'?'Pricing details':'รายละเอียดราคา';
      await page.getByRole('button',{name:`${details} — Hermes Agent`,exact:true}).click();
      const modal=page.getByRole('dialog');
      await modal.getByTestId('pricing-coverage').waitFor();
      const box=await modal.boundingBox();
      assert.ok(box.x>=0 && box.x+box.width<=width && box.height<=900,'pricing dialog fits viewport');
      await noOverflow(page,`pricing-${lang}-${theme}-${width}`);
      await page.screenshot({path:resolve(output,`pricing-${lang}-${theme}-${width}.png`)});
      await page.keyboard.press('Escape');
      await modal.waitFor({state:'hidden'});
    }
    if (width === 390 && lang === 'en') {
      await page.getByRole('button', { name: 'Open navigation' }).click();
      await page.getByRole('dialog', { name: 'Open navigation' }).getByRole('button', { name: 'Limits', exact: true }).click();
      await page.waitForURL(/#limits$/);
      assert.equal(await page.locator('dialog').evaluate(el => el.open), false);
    } else await page.goto('http://127.0.0.1:7798/?mode=legacy#limits');
    await page.getByRole('combobox').first().waitFor();
    await noOverflow(page, `limits-${lang}-${theme}-${width}`);
    await page.screenshot({ path: resolve(output, `limits-${lang}-${theme}-${width}.png`), fullPage: true });
    await context.close();
    console.log(`PASS ${lang} ${theme} ${width}px Live + Limits`);
  }
  const last = await contextFor();
  empty = true;
  await last.page.goto('http://127.0.0.1:7798/?mode=legacy#live'); await settle(last.page);
  await last.page.getByText('Waiting for subscription readings.', { exact: false }).waitFor();
  await last.page.getByText('No upcoming reset time has been reported.').waitFor();
  unavailable = true;
  await last.page.reload();
  await last.page.getByText('503', { exact: false }).first().waitFor();
  unavailable = false; empty = false;
  await last.page.reload(); await settle(last.page);
  await last.context.close();

  /*
   * PulsePet popup: the SAME app in ?mode=popup, which is what the taskbar pet opens in
   * its small frameless window. Rendering it here is what proves the two hard parts --
   * it is not a second UI, and hiding a subscription in Settings hides it here too.
   */
  const pet = await contextFor();
  await pet.page.goto('http://127.0.0.1:7798/?mode=popup#overview');
  await pet.page.getByRole('heading', { name: 'Quotas', exact: true }).waitFor();
  await pet.page.getByText('OpenAI Subscription', { exact: true }).waitFor();
  assert.equal(await pet.page.getByText('Claude Personal Subscription', { exact: true }).count(), 1);
  await noOverflow(pet.page, 'pet-popup');
  await pet.page.screenshot({ path: resolve(output, 'pet-popup-en-dark.png') });
  await pet.context.close();

  // Request 3: the preference the dashboard's Settings writes must reach the popup too.
  const petHidden = await contextFor('en', 'dark', 1440, ['claude-personal']);
  await petHidden.page.goto('http://127.0.0.1:7798/?mode=popup');
  await petHidden.page.getByRole('heading', { name: 'Quotas', exact: true }).waitFor();
  await petHidden.page.getByText('OpenAI Subscription', { exact: true }).waitFor();
  assert.equal(await petHidden.page.getByText('Claude Personal Subscription', { exact: true }).count(), 0,
    'a subscription hidden in Settings must be hidden in the pet popup');
  await petHidden.context.close();
  console.log('PASS PulsePet popup renders and follows the hidden-subscription preference');

  assert.deepEqual(errors, []);
  assert.deepEqual(externalRequests, []);
  assert.ok(apiMethods.every(({ method, path }) => method === 'GET' ||
    (method === 'PUT' && (path === '/api/settings' || path === '/api/notification-settings'))),
    'only settings controls may mutate fixture data');
  console.log(`PASS empty, unavailable, recovery; no page errors. Screenshots: ${output}`);
} finally {
  await browser?.close();
  await server?.close();
}
