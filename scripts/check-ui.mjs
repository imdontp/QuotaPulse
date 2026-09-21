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
const specs = [
  ['openai', 'OpenAI Subscription', 'openai', 'active', 88, 52],
  ['claude-company', 'Claude Company Subscription', 'anthropic', 'active', 32, 24],
  ['claude-personal', 'Claude Personal Subscription', 'anthropic', 'inactive', null, null],
  ['opencode-go', 'OpenCode Go Subscription', 'opencode', 'stale', 48, 60],
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
let trendUnpriced = false;
let trendMixed = false;
const pricingRequests = [];
const apiMethods = [];
const externalRequests = [];
const sourceRow = value => ({ ...value, source_id: 1, harness: 'hermes', profile: 'default', display_name: 'Hermes Agent', vendor: 'deepseek' });
const unpriced = { ...totals, cost_usd: 0, cost_unknown_calls: 10, model: 'deepseek-v4.1-flash', harness: 'hermes', effort: 'low', vendor: 'deepseek' };
const overview = (hiddenSubscriptions = []) => ({ now, today,
  week: { ...totals, calls: 250, total_tokens: 16500000 }, allTime: totals,
  bySourceToday: [sourceRow(today)], bySourceAll: [sourceRow(totals)], limits: empty ? [] : limits, subscriptions: empty ? [] : subscriptions,
  harnesses: [], accounts: subscriptions, sources: [], sourceStatus: [], lastPass: null,
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
    else if (u.pathname === '/api/usage') data = { range: { range: u.searchParams.get('range') ?? 'today', from: 0, to: now, bucket: u.searchParams.get('bucket') ?? 'day', timezone: 'fixture' }, totals: today, timeline: [], bySource: [sourceRow(today)] };
    else if (u.pathname === '/api/overview') data = overview(sharedHiddenSubscriptions);
    else if (u.pathname === '/api/trend') {
      requests.push(Object.fromEntries(u.searchParams));
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
    } else if (u.pathname === '/api/models') data = { models: [unpriced] };
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
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const { context, page } = await contextFor();
  await page.goto('http://127.0.0.1:7798/#live'); await settle(page);
  await page.getByRole('region', { name: 'Data status' }).waitFor();
  await page.getByText('What needs your attention', { exact: true }).waitFor();
  await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true })));
  const palette = page.getByRole('dialog', { name: 'Command palette', exact: true });
  await palette.waitFor();
  await palette.locator('input').fill('Alerts');
  await palette.locator('button').filter({ hasText: 'Alerts' }).first().click();
  await page.waitForURL('**/#alerts');
  await page.getByText('Alert history', { exact: true }).waitFor();
  await page.goto('http://127.0.0.1:7798/#live'); await settle(page);
  await page.getByRole('tab', { name: 'Limits', exact: true }).click();
  await page.waitForURL('**/#limits');
  await page.goBack();
  await page.waitForFunction(() => document.querySelector('[role=tab][aria-selected=true]')?.textContent === 'Live');
  await page.goForward();
  await page.waitForFunction(() => document.querySelector('[role=tab][aria-selected=true]')?.textContent === 'Limits');
  await page.getByRole('combobox', { name: 'All subscriptions' }).selectOption('openai');
  assert.equal(await page.locator('tbody tr').count(), 2);
  await page.getByRole('combobox', { name: 'All statuses' }).selectOption('available');
  await page.getByText('No subscriptions match these filters.').waitFor();
  await page.goto('http://127.0.0.1:7798/#live'); await settle(page);
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
  await page.goto('http://127.0.0.1:7798/#live'); await settle(page);
  assert.equal(await page.locator('.quota-card').filter({ hasText: 'OpenAI Subscription' }).count(), 0);
  assert.equal(await page.getByRole('list', { name: 'Next resets', exact: true }).getByText('OpenAI Subscription', { exact: true }).count(), 0);
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: 'Open full Settings', exact: true }).click();
  await page.locator('h2').filter({ hasText: 'Settings' }).waitFor();
  await page.getByRole('checkbox', { name: 'OpenAI Subscription', exact: true }).check();
  await page.getByText('shown', { exact: true }).first().waitFor();
  await page.goto('http://127.0.0.1:7798/#live'); await settle(page);
  const day = requests.find(r => r.bucket === 'day');
  assert.equal(Number(day.to) - Number(day.from), 7 * 86400000);
  const hour = requests.find(r => r.bucket === 'hour');
  assert.equal(new Date(Number(hour.from)).getHours(), 0);
  await page.goto('http://127.0.0.1:7798/#usage?range=today&view=summary');
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
    await page.goto(`http://127.0.0.1:7798/${target}`);
    await page.locator('[role=tabpanel][data-state=active]').waitFor();
    await page.waitForTimeout(250);
    await noOverflow(page, tab);
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
  for (const lang of ['en', 'th']) for (const theme of ['dark', 'light']) for (const width of [390, 900, 1280, 1440]) {
    const { context, page } = await contextFor(lang, theme, width);
    await page.goto('http://127.0.0.1:7798/#live'); await settle(page);
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
      await page.waitForURL('**/#limits');
      assert.equal(await page.locator('dialog').evaluate(el => el.open), false);
    } else await page.goto('http://127.0.0.1:7798/#limits');
    await page.getByRole('combobox').first().waitFor();
    await noOverflow(page, `limits-${lang}-${theme}-${width}`);
    await page.screenshot({ path: resolve(output, `limits-${lang}-${theme}-${width}.png`), fullPage: true });
    await context.close();
    console.log(`PASS ${lang} ${theme} ${width}px Live + Limits`);
  }
  const last = await contextFor();
  empty = true;
  await last.page.goto('http://127.0.0.1:7798/#live'); await settle(last.page);
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
  await pet.page.goto('http://127.0.0.1:7798/?mode=popup');
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
