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
const phase=process.env.QUOTAPULSE_VISUAL82_PHASE ?? 'candidate';
const output=resolve(root,'tmp/projects88-compiled-check');
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

const sha=(b:Buffer)=>createHash('sha256').update(b).digest('hex');

let browser:Awaited<ReturnType<typeof chromium.launch>>|undefined;
const errors:string[]=[],forbidden:string[]=[],results:any[]=[];
try {
 await daemon.listen({host:'127.0.0.1',port:7816});
 browser=await chromium.launch({channel:'chrome',headless:true,args:['--disable-gpu','--deterministic-mode','--disable-skia-runtime-opts','--force-color-profile=srgb']});
 for(const config of [{lang:'en',theme:'dark',width:1672},{lang:'th',theme:'dark',width:1672},{lang:'en',theme:'light',width:1672},{lang:'en',theme:'dark',width:1280},{lang:'th',theme:'dark',width:390}]) { const route='projects';const captureName=`${config.lang}-${config.theme}-${config.width}`;
  const page=await browser.newPage({viewport:{width:config.width,height:941},deviceScaleFactor:1,reducedMotion:'reduce',timezoneId:'Asia/Bangkok'});page.setDefaultTimeout(20000);
  const pending=new Set<Request>();page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.url().includes('/api/')&&!r.url().includes('/events/stream'))pending.add(r)});page.on('requestfinished',r=>pending.delete(r));page.on('requestfailed',r=>pending.delete(r));
  await page.route('**/*',r=>{const q=r.request(),u=new URL(q.url());if(u.origin!=='http://127.0.0.1:7816'||u.pathname.startsWith('/api/')&&q.method()!=='GET'){forbidden.push(q.method()+' '+u.pathname);return r.abort()}return r.continue()});
  await page.addInitScript(({lang,theme})=>{(window as any).__QUOTAPULSE_TOKEN__='stable-capture-test';localStorage.setItem('quotapulse-prefs',JSON.stringify({lang,currency:'USD',rate:1,hiddenSubscriptions:[]}));localStorage.setItem('quotapulse-theme',theme)},config);await page.clock.setFixedTime(fixedNow);
  await page.goto('http://127.0.0.1:7816/?trial85='+route+'#'+route);await page.locator(route==='projects'?'.qp-project-card':'.qp-model-summary-icon').first().waitFor();
  for(let n=0;n<300&&pending.size;n++)await page.waitForTimeout(100);assert.equal(pending.size,0);await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(1000);await page.mouse.move(0,0);await page.addStyleTag({content:'*,*::before,*::after{transition:none!important;caret-color:transparent!important}'});
  const snap=()=>page.evaluate(()=>({text:document.querySelector('main')!.textContent,markup:document.querySelector('main')!.innerHTML,boxes:[...document.querySelectorAll('main *')].map(e=>e.getBoundingClientRect().toJSON()),cards:[...document.querySelectorAll('.qp-model-summary article')].map(e=>({rect:e.getBoundingClientRect().toJSON(),icon:e.querySelector('.qp-model-summary-icon')?.getBoundingClientRect().toJSON(),strong:e.querySelector('strong')?.getBoundingClientRect().toJSON()})),comparison:document.querySelector('.qp-model-comparison')?.getBoundingClientRect().toJSON(),lines:[...document.querySelectorAll('.qp-project-spark>.qp-observed-line')].map(e=>({points:e.getAttribute('points'),rect:e.getBoundingClientRect().toJSON(),stroke:getComputedStyle(e).stroke,strokeWidth:getComputedStyle(e).strokeWidth,filter:getComputedStyle(e).filter}))}));
  await page.screenshot({path:resolve(output,captureName+'-before.png'),animations:'disabled'});const before=await snap();
  const css='@media(min-width:1536px){.qp-redesign[data-testid=production-projects][data-theme=dark] .qp-project-card .qp-project-spark>line{opacity:0}}';const style=await page.addStyleTag({content:css});await page.waitForTimeout(400);const after=await snap();
  writeFileSync(resolve(output,captureName+'-snapshots.json'),JSON.stringify({before,after},null,2));assert.equal(after.text,before.text,route+': actual facts retained');assert.ok(after.markup===before.markup,route+': markup differs; inspect snapshots');
  if(route==='projects')assert.deepEqual(after.boxes,before.boxes,'Projects geometry retained');
  if(route==='models')assert.deepEqual(after.comparison,before.comparison,'Models comparison anchor retained');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,route+': horizontal overflow');
  await page.screenshot({path:resolve(output,captureName+'-after.png'),animations:'disabled'});results.push({route,config,factsMarkupEqual:true,geometryEqual:JSON.stringify(after.boxes)===JSON.stringify(before.boxes),before,after});await style.evaluate(e=>e.remove());await page.close();
 }
 assert.deepEqual(errors,[]);assert.deepEqual(forbidden,[]);writeFileSync(resolve(output,'verification.json'),JSON.stringify({status:'Same-build interventions, not full Source acceptance',productionIndexSha256:sha(readFileSync(resolve(root,'packages/web/dist/index.html'))),results,errors,forbidden},null,2));console.log('Projects selected-card grid-only trial retains actual facts/markup/allgeometry.');
} finally {await browser?.close();await daemon.close();db.close();globalThis.Date=realDate;process.env.TZ=priorTimezone}
