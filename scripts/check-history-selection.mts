import { installBrowserFixedDate } from './browser-fixed-date.mjs';
/** Repeatability gate; synthetic production captures, not approved visual baselines. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, type Page, type Request, type Route } from 'playwright';
import { openDb } from '../packages/daemon/src/db/index.js';
import { buildServer } from '../packages/daemon/src/api/server.js';
import { Scheduler } from '../packages/daemon/src/ingest/scheduler.js';
import { recordQuotaAlerts } from '../packages/daemon/src/api/queries.js';
import type { Overview, CompareResult, MinuteTrendResponse, ProviderModelMinuteResponse, ProjectDetailResponse, DetailedProjectResponse, DetailedModelResponse, ModelDetailResponse, CostAnalysisResponse, QuotaHistoryResponse, UsageResponse, AlertEvent } from '../packages/web/src/api.js';
import { en } from '../packages/web/src/i18n/en.js';
import { th } from '../packages/web/src/i18n/th.js';
import { dimensions, runtimeActivityState, type RuntimeGraph } from '../packages/web/src/redesign/model.js';
import { activeQuotaRiskCount, getQuotaRiskModel } from '../packages/web/src/redesign/alert-risks.js';
import { averageDailyTokenPace, cacheShareTrendSeries, metricTrendSeries } from '../packages/web/src/redesign/metric-series.js';
import { cacheSharePercent, percentagePointChange, relativeChangePercent } from '../packages/web/src/redesign/insight-model.js';
import type { UsageEventsResponse } from '../packages/web/src/lib/usage-events.js';
import { countdown, tokens as formatTokens } from '../packages/web/src/format.js';
import { usageEventParams } from '../packages/web/src/lib/usage-events.js';
import { activityTokensPerMinute, activityTrendScope, latestActivityByHarness } from '../packages/web/src/redesign/activity-trend.js';
import { ACTIVITY_SPARKLINE_HEIGHT } from '../packages/web/src/redesign/activity-sparkline.js';
import { checkLiveMinuteRefresh } from '../scripts/check-live-minute-refresh.mjs';
import { checkLiveTokenFlow } from '../scripts/check-live-token-flow.mjs';
import { checkSectionMarks } from '../scripts/check-section-marks.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const priorTimezone = process.env.TZ;
process.env.TZ = 'Asia/Bangkok';
const liveOnly = process.env.QUOTAPULSE_CAPTURE_SCOPE === 'live';
const compositionOnly = process.env.QUOTAPULSE_CAPTURE_SCOPE === 'composition';
const runtimeLayoutOnly = process.env.QUOTAPULSE_CAPTURE_SCOPE === 'runtime-layout';
const overviewOnly = process.env.QUOTAPULSE_CAPTURE_SCOPE === 'overview' || runtimeLayoutOnly;
const projectsOnly = process.env.QUOTAPULSE_CAPTURE_SCOPE === 'projects';
const providersOnly = process.env.QUOTAPULSE_CAPTURE_SCOPE === 'providers';
const modelsOnly = process.env.QUOTAPULSE_CAPTURE_SCOPE === 'models';
const costOnly = process.env.QUOTAPULSE_CAPTURE_SCOPE === 'cost';
const historyOnly = process.env.QUOTAPULSE_CAPTURE_SCOPE === 'history';
const alertsOnly = process.env.QUOTAPULSE_CAPTURE_SCOPE === 'alerts';
const settingsOnly = process.env.QUOTAPULSE_CAPTURE_SCOPE === 'settings';
const captureLanguages = process.env.QUOTAPULSE_CAPTURE_LANGUAGE ? [process.env.QUOTAPULSE_CAPTURE_LANGUAGE] : ['en', 'th'];
const captureThemes = process.env.QUOTAPULSE_CAPTURE_THEME ? [process.env.QUOTAPULSE_CAPTURE_THEME] : ['dark', 'light'];
assert.ok(captureLanguages.every(language => language === 'en' || language === 'th'), 'Capture language must be en or th');
assert.ok(captureThemes.every(theme => theme === 'dark' || theme === 'light'), 'Capture theme must be dark or light');
const taskLang=process.env.QUOTAPULSE_SIDEBAR_LANGUAGE ?? 'en';
const taskTheme=process.env.QUOTAPULSE_SIDEBAR_THEME ?? 'dark';
const phase=process.env.QUOTAPULSE_HISTORY83_PHASE ?? 'candidate';
const output=resolve(root,'tmp/history83-'+phase);
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
const daemon = buildServer(db, scheduler, { token: 'stable-capture-test', port: 7816, webRoot: resolve(root, phase==='before'?'tmp/source83-dist82':'packages/web/dist') });


let browser:Awaited<ReturnType<typeof chromium.launch>>|undefined;
const errors:string[]=[],forbidden:string[]=[],checks:string[]=[];
const sha=(b:Buffer)=>createHash('sha256').update(b).digest('hex');
try {
 await daemon.listen({host:'127.0.0.1',port:7816});browser=await chromium.launch({channel:'chrome',headless:true,args:['--disable-gpu','--deterministic-mode','--disable-skia-runtime-opts','--force-color-profile=srgb']});
 const page=await browser.newPage({viewport:{width:1672,height:941},deviceScaleFactor:1,reducedMotion:'reduce',timezoneId:'Asia/Bangkok'});page.setDefaultTimeout(15000);
 const pending=new Set<Request>();page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.url().includes('/api/')&&!r.url().includes('/events/stream'))pending.add(r)});page.on('requestfinished',r=>pending.delete(r));page.on('requestfailed',r=>pending.delete(r));
 await page.route('**/*',route=>{const req=route.request(),u=new URL(req.url());if(u.origin!=='http://127.0.0.1:7816'||u.pathname.startsWith('/api/')&&req.method()!=='GET'){forbidden.push(req.method()+' '+u.pathname);return route.abort()}return route.continue()});
 await page.addInitScript({content:"window.__QUOTAPULSE_TOKEN__='stable-capture-test';localStorage.setItem('quotapulse-prefs',JSON.stringify({lang:'en',currency:'USD',rate:1,hiddenSubscriptions:[]}));localStorage.setItem('quotapulse-theme','dark');Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async function(text){window.__history83Copied=text;}}});"});await installBrowserFixedDate(page, fixedNow);
 const settle=async()=>{let n=0;const end=performance.now()+20000;while(n<8){assert.ok(performance.now()<end,'API settle deadline');n=pending.size?0:n+1;await page.waitForTimeout(30)}await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(200)};
 const usageResponse=(predicate:(u:URL)=>boolean=()=>true)=>page.waitForResponse(r=>new URL(r.url()).pathname==='/api/usage-events'&&r.status()===200&&predicate(new URL(r.url())));
 const initialRequest=usageResponse();await page.goto('http://127.0.0.1:7816/?history83=fresh#history?range=month',{waitUntil:'domcontentloaded'});const initial=await (await initialRequest).json();const dialog=page.locator('dialog[aria-labelledby=history-detail-title]');await dialog.locator('h2 span').waitFor();await settle();
 assert.equal(await dialog.getAttribute('open'),'');assert.equal((await dialog.locator('h2 span').textContent())?.trim(),'#'+initial.rows[0].event_id);await page.screenshot({path:resolve(output,'history-fresh-entry.png'),animations:'disabled'});checks.push('fresh entry selects newest actual row and displays Source-shaped rail before interactions');
 await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('dialog[aria-labelledby=history-detail-title]')?.hasAttribute('open'));
 const aggregate=initial.rows.find((r:any)=>r.grain==='session_aggregate');assert.ok(aggregate?.session_key,'Fixture has a real aggregate/session identity');const openAggregate=async()=>{await page.locator('[data-testid=usage-history] button').filter({hasText:new RegExp('^#'+aggregate.event_id+'$')}).click();await page.waitForFunction(id=>document.querySelector('#history-detail-title span')?.textContent?.trim()==='#'+id,aggregate.event_id)};await openAggregate();await dialog.evaluate(e=>e.setAttribute('data-probe83','same-selected-dialog'));
 const changed=usageResponse();db.prepare("UPDATE usage_event SET total_tokens=1234567,input_tokens=1000000,output_tokens=234567,cached_input_tokens=0,cache_write_tokens=0,reasoning_tokens=77,cost_usd=1.25,cost_source='native' WHERE id=?").run(aggregate.event_id);scheduler.emit('data',{newEvents:1,newLimits:0,trigger:'history83-synthetic-revision',durationMs:0});const fresh=await (await changed).json();assert.equal(fresh.rows.find((r:any)=>r.event_id===aggregate.event_id)?.total_tokens,1234567);
 await page.waitForFunction(()=>document.querySelector('[data-testid=usage-history] tr[data-selected=true] .qp-history-token-value')?.getAttribute('aria-label')==='1234567');
 await page.waitForFunction(()=>!!document.querySelector('dialog[open] [data-group="history.tokenBreakdown"] dd[aria-label="1234567"]'),undefined,{timeout:12000});assert.equal(await dialog.getAttribute('data-probe83'),'same-selected-dialog');assert.equal(await dialog.locator('[data-group="history.tokenBreakdown"] dd[aria-label="77"]').count(),1);assert.ok((await dialog.locator('[data-group="history.pricingSource"]').innerText()).includes('$1.25'));
 await dialog.locator('.qp-history-detail-actions button').click();await page.waitForFunction(()=>typeof (window as any).__history83Copied==='string');const copied=JSON.parse(await page.evaluate(()=>(window as any).__history83Copied));assert.equal(copied.event_id,aggregate.event_id);assert.equal(copied.total_tokens,1234567);assert.equal(copied.reasoning_tokens,77);assert.equal(copied.cost_usd,1.25);assert.equal(copied.cost_source,'native');assert.equal(Object.keys(copied).some(k=>/prompt|response|payload|content|body/.test(k)),false);checks.push('actual SSE aggregate revision refreshes same selected event, token/pricing details and allowlisted metadata copy');
 await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('dialog[aria-labelledby=history-detail-title]')?.hasAttribute('open'));const closedRefresh=usageResponse();scheduler.emit('data',{newEvents:1,newLimits:0,trigger:'history83-closed-revision',durationMs:0});await closedRefresh;await settle();assert.equal(await dialog.getAttribute('open'),null);checks.push('explicitly closed detail does not reopen on accepted refresh');
 await openAggregate();const originalRelated=await dialog.locator('.qp-history-detail-actions>a').getAttribute('href');assert.ok(originalRelated?.includes('session_id='+aggregate.session_key));const absentResponse=usageResponse(u=>u.searchParams.get('source_id')==='1');await page.evaluate(()=>{location.hash='history?range=all&source=1'});const absent=await (await absentResponse).json();assert.equal(absent.rows.some((r:any)=>r.event_id===aggregate.event_id),false);await settle();assert.equal((await dialog.locator('h2 span').textContent())?.trim(),'#'+aggregate.event_id);assert.equal(await dialog.locator('.qp-history-detail-actions>a').getAttribute('href'),originalRelated);checks.push('retained out-of-page selection keeps its original exact related-session scope');
 const relatedResponse=usageResponse(u=>u.searchParams.get('session_id')===String(aggregate.session_key));await dialog.locator('.qp-history-detail-actions>a').click();const related=await (await relatedResponse).json();await settle();assert.ok(related.rows.length>0);assert.ok(related.rows.every((r:any)=>r.session_key===aggregate.session_key));assert.equal(new URLSearchParams(new URL(page.url()).hash.split('?')[1]).get('session_id'),String(aggregate.session_key));
 const rangeResponse=usageResponse(u=>u.searchParams.get('session_id')===String(aggregate.session_key));await page.getByRole('combobox',{name:en['usage.rangeLabel'],exact:true}).selectOption('all');await rangeResponse;await settle();assert.equal(new URLSearchParams(new URL(page.url()).hash.split('?')[1]).get('session_id'),String(aggregate.session_key));
 const sourceResponse=usageResponse(u=>u.searchParams.get('session_id')===String(aggregate.session_key)&&u.searchParams.get('source_id')===String(aggregate.source_id));await page.getByRole('combobox',{name:en['analysis.source'],exact:true}).selectOption(String(aggregate.source_id));const scoped=await (await sourceResponse).json();await settle();assert.equal(new URLSearchParams(new URL(page.url()).hash.split('?')[1]).get('session_id'),String(aggregate.session_key));assert.ok(scoped.rows.length>0&&scoped.rows.every((r:any)=>r.session_key===aggregate.session_key&&r.source_id===aggregate.source_id));checks.push('related-session constraint survives actual range/source dropdown edits in hash and API');
 assert.deepEqual(errors,[]);assert.deepEqual(forbidden,[]);writeFileSync(resolve(output,'verification.json'),JSON.stringify({phase,indexSha256:sha(readFileSync(resolve(root,phase==='before'?'tmp/source83-dist82/index.html':'packages/web/dist/index.html'))),checks,eventId:aggregate.event_id,sessionId:aggregate.session_key,originalRelated,initialSelected:initial.rows[0].event_id,errors,forbidden,scope:'Real compiled application + isolated synthetic DB/API/SSE; metadata clipboard is intercepted; no native lifecycle claim'},null,2));console.log('History83 compiled API/SSE state cases passed:',checks);
}finally{await browser?.close();await daemon.close();db.close();globalThis.Date=realDate;process.env.TZ=priorTimezone}
