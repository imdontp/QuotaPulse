import { installBrowserFixedDate } from './browser-fixed-date.mjs';
/** Compiled History/Alerts motion regression using isolated API/SSE and a synthetic DB. */
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
import { checkAlertsMotionLifecycle } from './check-alerts-motion-lifecycle.mts';
import { checkHistoryRail } from './check-history-rail.mts';
import { checkHistoryMotionLifecycle } from './check-history-motion-lifecycle.mts';
const root = fileURLToPath(new URL('..', import.meta.url));
const priorTimezone = process.env.TZ;
process.env.TZ = 'Asia/Bangkok';
const taskLang='en', taskTheme='dark';
const output=resolve(root,'tmp/history94-browser');
mkdirSync(output,{recursive:true});rmSync(resolve(output,'verification.json'),{force:true});
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
const rendererArgs = ['--force-color-profile=srgb'];
async function settled(page:Page,pending:Set<Request>) {
 const deadline=performance.now()+30_000;let idle=0;
 while(idle<12){assert.ok(performance.now()<deadline,`API did not settle: ${[...pending].map(r=>r.url()).join(', ')}`);idle=pending.size===0?idle+1:0;await page.waitForTimeout(25);}
 await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(1_000);
}
const stages:any[]=[],errors:string[]=[],forbidden:string[]=[];let page:Page|undefined;
const notify=()=>scheduler.emit('data',{newEvents:1,newLimits:1,trigger:'synthetic-motion91'});
let eventSerial=0;const add=(at=fixedNow-1)=>Number(db.prepare("INSERT INTO usage_event(source_id,session_id,dedup_key,ts,model,provider,input_tokens,output_tokens,total_tokens,call_count,cost_source) VALUES(1,1,?,?,'DeepSeek V4.1','deepseek',11,6,17,1,'unknown')").run('motion91-'+eventSerial++,at).lastInsertRowid);
async function clear(){await page!.evaluate(()=>(window as any).__effects=[])}
async function arm(ms:number){await clear();await page!.evaluate(ms=>{const probe={done:false,started:false,samples:[] as any[]};(window as any).__probe=probe;(window as any).__startProbe=()=>{if(probe.started)return;probe.started=true;const start=performance.now();const sample=()=>{probe.samples.push({ms:performance.now()-start,effects:(window as any).__effects.map((e:any)=>({key:e.key,duration:e.duration,time:e.animation.currentTime,state:e.animation.playState,opacity:getComputedStyle(e.target).opacity,background:getComputedStyle(e.target).backgroundColor,outline:getComputedStyle(e.target).outlineColor,outlineWidth:getComputedStyle(e.target).outlineWidth,transform:getComputedStyle(e.target).transform}))});if(performance.now()-start<ms)requestAnimationFrame(sample);else probe.done=true};requestAnimationFrame(sample)}},ms)}
async function collect(label:string,durations:number[]){await page!.waitForFunction(()=>(window as any).__probe?.done,{},{timeout:12000});const data=await page!.evaluate(()=>({samples:(window as any).__probe.samples,effects:(window as any).__effects.map((e:any)=>({key:e.key,duration:e.duration,frames:e.frames,state:e.animation.playState,iterations:e.animation.effect.getTiming().iterations,fill:e.animation.effect.getTiming().fill}))}));assert.deepEqual(data.effects.map((e:any)=>e.duration).sort((a:number,b:number)=>a-b),[...durations].sort((a,b)=>a-b),label+' exact finite effects');data.effects.forEach((e:any,i:number)=>{assert.equal(e.iterations,1);assert.equal(e.fill,'none');assert.equal(e.state,'idle');assert.ok(data.samples.some((s:any)=>{const a=s.effects[i];return a?.state==='running'&&a.time>=e.duration-60&&a.time<=e.duration}),label+' actual native timeline near full duration '+e.duration);if(e.duration===700)assert.ok(new Set(data.samples.map((s:any)=>s.effects[i]?.outline)).size>=3,label+' visible outline interpolation');else assert.ok(data.samples.some((s:any)=>Number(s.effects[i]?.opacity)>0&&Number(s.effects[i]?.opacity)<1),label+' intermediate opacity')});stages.push({label,...data})}
async function waitHistory(id:number){await page!.locator(`tr[data-history-record^="[${id},"]`).waitFor()}
async function settledResponse(path:string,action:()=>Promise<unknown>|void){const response=page!.waitForResponse(r=>new URL(r.url()).pathname===path&&r.request().method()==='GET');await action();await (await response).finished();await page!.waitForTimeout(250)}
try {
 await daemon.listen({host:'127.0.0.1',port:7816});browser=await chromium.launch({channel:'chrome',headless:true,args:rendererArgs});page=await browser.newPage({viewport:{width:1672,height:1100},reducedMotion:'no-preference',timezoneId:'Asia/Bangkok'});page.setDefaultTimeout(12000);page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',r=>{const req=r.request(),u=new URL(req.url());if(u.origin!=='http://127.0.0.1:7816'||u.pathname.startsWith('/api/')&&req.method()!=='GET'){forbidden.push(req.method()+' '+u.pathname);return r.abort()}return r.continue()});
 await page.addInitScript('globalThis.__name = value => value');await page.addInitScript(()=>{(window as any).__QUOTAPULSE_TOKEN__='stable-capture-test';localStorage.setItem('quotapulse-theme','dark');localStorage.setItem('quotapulse-prefs',JSON.stringify({lang:'en',currency:'USD',rate:1,hiddenSubscriptions:[]}));(window as any).__effects=[];const native=Element.prototype.animate;Element.prototype.animate=function(...args:Parameters<Element['animate']>){const animation=native.apply(this,args);const key=this.getAttribute('data-history-record')??this.getAttribute('data-alert-motion-key')??(this.matches('.qp-history-detail-groups')?'detail':null);if(key){(window as any).__effects.push({key,target:this,frames:args[0],duration:animation.effect!.getTiming().duration,animation});(window as any).__startProbe?.()}return animation}});await installBrowserFixedDate(page, fixedNow);
 await page.goto('http://127.0.0.1:7816/#history?range=today');await page.locator('.qp-history-table tbody tr').first().waitFor();await page.evaluate(()=>document.fonts.ready);const rail=page.locator('[data-history-detail-rail]');await rail.waitFor();assert.equal(await page.locator('dialog[aria-labelledby=history-detail-title]').count(),0,'History detail is a non-blocking rail');assert.equal(await page.evaluate(()=>(window as any).__effects.length),0,'Initial history and automatic detail do not replay');await page.locator('.qp-history-table').scrollIntoViewIfNeeded();await page.waitForTimeout(150);
 const usageScopeResponse=await page.request.get('http://127.0.0.1:7816/api/usage?range=today',{headers:{'x-quotapulse-token':'stable-capture-test'}});assert.equal(usageScopeResponse.status(),200);assert.equal((await usageScopeResponse.json()).range.to,fixedNow,'Synthetic current range is half-open and excludes its exact to timestamp');
 await arm(850);const first=add();notify();await waitHistory(first);await collect('history-new-observed-presence',[180,700]);
 // Hold a real duplicate snapshot, then release it while selection effects run.
 let held!:()=>void,release!:()=>void;let holdOnce=true;const heldRequest=new Promise<void>(r=>held=r),released=new Promise<void>(r=>release=r);const historyPattern='**/api/usage-events?**';
 await page.route(historyPattern,async route=>{if(!holdOnce||new URL(route.request().url()).searchParams.get('limit')!=='50')return route.continue();holdOnce=false;const response=await route.fetch();held();await Promise.race([released,new Promise<void>(r=>setTimeout(r,20000))]);await route.fulfill({response});});notify();await Promise.race([heldRequest,page.waitForTimeout(12000).then(()=>{throw new Error('History duplicate request not held')})]);
 const opener=page.locator(`tr[data-history-record^="[${first},"] button`);await arm(850);await opener.click();await rail.waitFor();release();await collect('history-selection-survives-duplicate',[180,700,180,700]);await page.unroute(historyPattern);await rail.focus();await page.keyboard.press('Escape');await rail.waitFor({state:'detached'});assert.equal(await opener.evaluate(e=>document.activeElement===e),true,'Rail Escape restores exact visible opener focus');
 await page.emulateMedia({reducedMotion:'reduce'});await clear();const late=add(fixedNow-30000);notify();await waitHistory(late);await page.waitForTimeout(150);assert.equal(await page.evaluate(()=>(window as any).__effects.length),0,'Reduced late observation is static');await page.emulateMedia({reducedMotion:'no-preference'});await page.waitForTimeout(100);await clear();const restore=add();notify();await waitHistory(restore);await page.waitForTimeout(150);assert.equal(await page.evaluate(()=>(window as any).__effects.length),0,'Preference restoration seeds no backlog');
 await arm(850);const afterRestore=add();notify();await waitHistory(afterRestore);await collect('history-fresh-after-preference',[180,700]);
 await clear();await page.goto('http://127.0.0.1:7816/#alerts');await page.locator('.qp-alert-risk li[data-alert-motion-key]').first().waitFor();await page.locator('.qp-alert-history li[data-alert-motion-key]').first().waitFor();await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(250);assert.equal(await page.evaluate(()=>(window as any).__effects.length),0,'Initial risk/history static');
 await arm(350);db.prepare("UPDATE limit_sample SET used_percent=96 WHERE source_id=1 AND window_kind='5h' AND observed_at=(SELECT MAX(observed_at) FROM limit_sample WHERE source_id=1 AND window_kind='5h')").run();recordQuotaAlerts(db,fixedNow);notify();await page.locator('.qp-alert-risk li[data-window="5h"][data-level=critical]').waitFor();await collect('alerts-new-risk-and-history',[180,180]);assert.equal(await page.locator('[data-alert-motion=entering]').count(),0);
 await clear();await settledResponse('/api/alerts',()=>notify());assert.equal(await page.evaluate(()=>(window as any).__effects.length),0,'Duplicate accepted alerts do not replay');
 await page.locator('.qp-alert-risk-filters button[data-level=critical]').click();await page.locator('.qp-alert-risk-filters button[data-level=all]').click();await page.waitForTimeout(200);assert.equal(await page.evaluate(()=>(window as any).__effects.length),0,'Local filter does not replay');
 await settledResponse('/api/alerts',()=>page.locator('.qp-alert-history-heading button').click());assert.equal(await page.evaluate(()=>(window as any).__effects.length),0,'Show-more dependency seeds');
 await page.emulateMedia({reducedMotion:'reduce'});await clear();db.prepare("UPDATE limit_sample SET used_percent=96 WHERE source_id=2 AND window_kind='monthly'").run();recordQuotaAlerts(db,fixedNow);notify();await page.locator('.qp-alert-risk li[data-window=monthly][data-level=critical]').last().waitFor();await page.waitForTimeout(300);assert.equal(await page.evaluate(()=>(window as any).__effects.length),0,'Reduced severity derivation static');assert.equal(await page.locator('[data-alert-motion=entering]').count(),0);
 const alertsLifecycle=await checkAlertsMotionLifecycle({page,db,notify,fixedNow,output});
 const historyLifecycle=await checkHistoryMotionLifecycle({page,db,notify,fixedNow,output});
 const railComposition=await checkHistoryRail(browser,output,fixedNow);
 await page.screenshot({path:resolve(output,'alerts-final.png')});assert.deepEqual(errors,[]);assert.deepEqual(forbidden,[]);writeFileSync(resolve(output,'verification.json'),JSON.stringify({productionIndexSha256:sha(readFileSync(resolve(root,'packages/web/dist/index.html'))),browser:browser.version(),scope:'Actual compiled memory API/SSE, synthetic facts; no native release claim',stages,first,late,restore,afterRestore,initialStatic:true,historyRailEscapeFocus:true,railComposition,reducedStatic:true,duplicateStatic:true,filterStatic:true,showMoreStatic:true,alertsLifecycle,historyLifecycle,errors,forbidden},null,2));console.log('History and Alerts actual native timelines, accepted snapshots, duplicate, selection/focus and static controls passed.');
}catch(error){if(page&&!page.isClosed()){await page.screenshot({path:resolve(output,'failure.png')}).catch(()=>{});writeFileSync(resolve(output,'failure.json'),JSON.stringify({error:String((error as Error).stack??error),stages,probe:await page.evaluate(()=>(window as any).__probe).catch(()=>null),effects:await page.evaluate(()=>(window as any).__effects.map((e:any)=>({key:e.key,duration:e.duration,time:e.animation.currentTime,state:e.animation.playState}))).catch(()=>null)},null,2))}throw error}finally{await browser?.close();await daemon.close();db.close();globalThis.Date=realDate;process.env.TZ=priorTimezone;}
