import { installBrowserFixedDate } from './browser-fixed-date.mjs';
/** Compiled Models/Live motion regression using isolated API/SSE and a synthetic DB. */
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
const root = fileURLToPath(new URL('..', import.meta.url));
const priorTimezone = process.env.TZ;
process.env.TZ = 'Asia/Bangkok';
const taskLang='en', taskTheme='dark';
const output=resolve(root,'tmp/motion92-browser');
mkdirSync(output,{recursive:true});if((process.env.QUOTAPULSE_MOTION92_MODE??'verify')==='verify')rmSync(resolve(output,'verification.json'),{force:true});
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
async function settled(page:Page,pending:Set<Request>) {
 const deadline=performance.now()+30_000;let idle=0;
 while(idle<12){assert.ok(performance.now()<deadline,`API did not settle: ${[...pending].map(r=>r.url()).join(', ')}`);idle=pending.size===0?idle+1:0;await page.waitForTimeout(25);}
 await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(1_000);
}
const stages:any[]=[],errors:string[]=[],forbidden:string[]=[];let page:Page|undefined;
const mode=process.env.QUOTAPULSE_MOTION92_MODE??'verify';
const notify=()=>scheduler.emit('data',{newEvents:1,newLimits:0,trigger:'synthetic-motion92'});
let eventSerial=0;
const add=(sessionId=1)=>Number(db.prepare("INSERT INTO usage_event(source_id,session_id,dedup_key,ts,model,provider,input_tokens,output_tokens,total_tokens,call_count,cost_source) VALUES(1,?,?,?,'DeepSeek V4.1','deepseek',11,6,17,1,'unknown')").run(sessionId,'motion92-'+eventSerial++,fixedNow-1).lastInsertRowid);
async function clear(){await page!.evaluate(()=>{(window as any).__effects=[];(window as any).__startProbe=undefined})}
async function arm(ms=1000){await clear();await page!.evaluate(ms=>{const probe={done:false,started:false,samples:[] as any[]};(window as any).__probe=probe;(window as any).__startProbe=()=>{if(probe.started)return;probe.started=true;const start=performance.now();const sample=()=>{probe.samples.push({ms:performance.now()-start,effects:(window as any).__effects.map((e:any)=>({key:e.key,duration:e.duration,time:e.animation.currentTime,state:e.animation.playState,opacity:getComputedStyle(e.target).opacity,background:getComputedStyle(e.target).backgroundColor,outlineColor:getComputedStyle(e.target).outlineColor,outlineWidth:getComputedStyle(e.target).outlineWidth,outlineStyle:getComputedStyle(e.target).outlineStyle,outlineOffset:getComputedStyle(e.target).outlineOffset}))});if(performance.now()-start<ms)requestAnimationFrame(sample);else probe.done=true};requestAnimationFrame(sample)}},ms)}
async function collect(label:string,durations:number[]){await page!.waitForFunction(()=>(window as any).__probe?.done,{},{timeout:12000});const data=await page!.evaluate(()=>({samples:(window as any).__probe.samples,effects:(window as any).__effects.map((e:any)=>({key:e.key,duration:e.duration,frames:e.frames,state:e.animation.playState,iterations:e.animation.effect.getTiming().iterations,fill:e.animation.effect.getTiming().fill}))}));writeFileSync(resolve(output,'probe-'+label+'.json'),JSON.stringify(data,null,2));assert.deepEqual(data.effects.map((e:any)=>e.duration).sort((a:number,b:number)=>a-b),[...durations].sort((a,b)=>a-b),label+' finite effects');data.effects.forEach((e:any,i:number)=>{assert.equal(e.iterations,1);assert.equal(e.fill,'none');assert.equal(e.state,'idle');assert.ok(data.samples.some((s:any)=>{const a=s.effects[i];return a?.state==='running'&&a.time>=e.duration-60&&a.time<=e.duration}),label+' actual native timeline '+e.duration);if(e.duration===700){const outline=e.frames.some((frame:any)=>frame.outlineColor!==undefined);assert.ok(new Set(data.samples.map((s:any)=>outline?s.effects[i]?.outlineColor:s.effects[i]?.background)).size>=3,label+' actual emphasis interpolation');if(outline)assert.ok(data.samples.some((s:any)=>s.effects[i]?.state==='running'&&s.effects[i]?.outlineWidth==='2px'&&s.effects[i]?.outlineStyle==='solid'&&s.effects[i]?.outlineOffset==='-2px'),label+' visible inset outline over opaque surfaces');}else assert.ok(data.samples.some((s:any)=>Number(s.effects[i]?.opacity)>.78&&Number(s.effects[i]?.opacity)<1),label+' actual opacity interpolation')});stages.push({label,...data})}
async function accepted(path:string,action:()=>Promise<unknown>|void){const response=page!.waitForResponse(r=>new URL(r.url()).pathname===path&&r.request().method()==='GET');await action();await(await response).finished();await page!.waitForTimeout(180)}
async function staticNow(label:string){await page!.waitForTimeout(100);const effects=await page!.evaluate(()=>(window as any).__effects.map((e:any)=>({key:e.key,duration:e.duration})));assert.deepEqual(effects,[],label);stages.push({label,static:true})}
let releaseHeld:(()=>void)|undefined;
try {
 await daemon.listen({host:'127.0.0.1',port:7816});browser=await chromium.launch({channel:'chrome',headless:true,args:rendererArgs});page=await browser.newPage({viewport:{width:1672,height:1100},reducedMotion:'no-preference',timezoneId:'Asia/Bangkok'});page.setDefaultTimeout(12000);page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',r=>{const req=r.request(),u=new URL(req.url());if(u.origin!=='http://127.0.0.1:7816'||u.pathname.startsWith('/api/')&&req.method()!=='GET'){forbidden.push(req.method()+' '+u.pathname);return r.abort()}return r.continue()});
 await page.addInitScript('globalThis.__name = value => value');await page.addInitScript(()=>{(window as any).__QUOTAPULSE_TOKEN__='stable-capture-test';localStorage.setItem('quotapulse-theme','dark');localStorage.setItem('quotapulse-prefs',JSON.stringify({lang:'en',currency:'USD',rate:1,hiddenSubscriptions:[]}));(window as any).__effects=[];(window as any).__io=[];const nativeIO=window.IntersectionObserver;window.IntersectionObserver=class extends nativeIO {constructor(callback:any,options:any){super((entries,observer)=>{(window as any).__io.push(...entries.map(e=>({ms:performance.now(),target:(e.target as HTMLElement).className,intersecting:e.isIntersecting,ratio:e.intersectionRatio,bounds:e.boundingClientRect.toJSON(),intersection:e.intersectionRect.toJSON()})));callback(entries,observer)},options)}};const native=Element.prototype.animate;Element.prototype.animate=function(...args:Parameters<Element['animate']>){const animation=native.apply(this,args);const key=this.getAttribute('data-model-pair-key')??this.getAttribute('data-model-selection-detail')??this.getAttribute('data-live-session')??this.getAttribute('data-live-record')??(this.matches('.qp-live-detail-content')?'live-detail':null);if(key){(window as any).__effects.push({key,target:this,frames:args[0],duration:animation.effect!.getTiming().duration,animation});(window as any).__startProbe?.()}return animation}});await installBrowserFixedDate(page, fixedNow);
 // Before/after resting controls use the same actual API fixture and route. A
 // current native motion build must preserve the reduced, fully settled view.
 if(mode==='baseline'||mode==='paint'){
   await page.emulateMedia({reducedMotion:'reduce'});await page.setViewportSize({width:1672,height:941});
   for(const routeName of ['models','live']){
     await page.goto('http://127.0.0.1:7816/#'+routeName);await page.getByTestId('production-'+routeName).waitFor();await page.locator(routeName==='models'?'.qp-model-detail [data-testid=model-catalog-context]':'.qp-live-table tbody tr').first().waitFor();await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(1400);await page.screenshot({path:resolve(output,routeName+'-'+mode+'.png'),animations:'disabled'});
   }
   writeFileSync(resolve(output,mode+'.json'),JSON.stringify({productionIndexSha256:sha(readFileSync(resolve(root,'packages/web/dist/index.html'))),mode,errors,forbidden}));
 }else{
 if(mode!=='live'){ await page.goto('http://127.0.0.1:7816/#models');await page.locator('[data-testid=model-catalog-context]').waitFor();await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(300);await staticNow('models-initial-static');
 const modelRows=page.locator('tr[data-model-pair-key]');const second=modelRows.nth(1);const secondKey=await second.getAttribute('data-model-pair-key');
 let held!:()=>void;const intercepted=new Promise<void>(r=>held=r),released=new Promise<void>(r=>releaseHeld=r);let holdOnce=true;
 const detailPattern='**/api/model-detail?**';await page.route(detailPattern,async route=>{if(!holdOnce)return route.continue();holdOnce=false;const response=await route.fetch();held();await Promise.race([released,new Promise<void>(r=>setTimeout(r,20000))]);await route.fulfill({response})});
 await arm(1400);await second.locator('button').click();await Promise.race([intercepted,page.waitForTimeout(12000).then(()=>{throw Error('Actual model detail response not held')})]);
 const pending=await page.evaluate(()=>(window as any).__effects.map((e:any)=>({key:e.key,duration:e.duration})));assert.equal(pending.length,2,'Only explicit row animates while real detail response is held');assert.ok(pending.every((e:any)=>e.key===secondKey));await page.waitForTimeout(220);releaseHeld!();releaseHeld=undefined;await collect('models-explicit-row-then-accepted-detail',[180,700,180,700]);await page.unroute(detailPattern);
 await clear();await second.locator('button').click();await staticNow('models-repeat-current-selection-static');
 await clear();await accepted('/api/model-detail',()=>notify());await staticNow('models-duplicate-refresh-static');
 await page.emulateMedia({reducedMotion:'reduce'});await clear();await accepted('/api/model-detail',()=>modelRows.nth(2).locator('button').click());await staticNow('models-reduced-selection-static');await page.emulateMedia({reducedMotion:'no-preference'});await page.waitForTimeout(150);
 await clear();await page.locator('.qp-model-search input').fill('DeepSeek');await staticNow('models-search-fallback-static');await page.locator('.qp-model-search input').fill('');await page.waitForTimeout(200);await clear();
 // Deliver an actual selected-detail response after real loss/return of viewport
 // eligibility. It updates facts, but the consumed selection must not replay.
 let lostHeld!:()=>void;const lostIntercepted=new Promise<void>(r=>lostHeld=r),lostReleased=new Promise<void>(r=>releaseHeld=r);let loseOnce=true;
 await page.route(detailPattern,async route=>{if(!loseOnce)return route.continue();loseOnce=false;const response=await route.fetch();lostHeld();await Promise.race([lostReleased,new Promise<void>(r=>setTimeout(r,20000))]);await route.fulfill({response})});
 await clear();const fourth=modelRows.nth(3);await fourth.locator('button').click();await Promise.race([lostIntercepted,page.waitForTimeout(12000).then(()=>{throw Error('Selected-detail lifecycle response not held')})]);assert.equal(await page.evaluate(()=>(window as any).__effects.length),2);await page.setViewportSize({width:1672,height:60});await page.waitForTimeout(150);await page.setViewportSize({width:1672,height:1100});await page.waitForTimeout(150);const restoredResponse=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/model-detail');releaseHeld!();releaseHeld=undefined;await(await restoredResponse).finished();await page.waitForTimeout(200);const lostEffects=await page.evaluate(()=>(window as any).__effects.map((e:any)=>({key:e.key,duration:e.duration,state:e.animation.playState})));assert.equal(lostEffects.length,2,'No detail replay after actual IO epoch loss');assert.ok(lostEffects.every((e:any)=>e.state==='idle'));await page.unroute(detailPattern);stages.push({label:'models-held-detail-crosses-real-offscreen-return',effects:lostEffects});
 await clear();await modelRows.first().locator('button').click();await page.waitForFunction(()=>(window as any).__effects.some((e:any)=>e.animation.playState==='running'));await page.evaluate(()=>{location.hash='#live'});await page.getByTestId('production-live').waitFor();const detached=await page.evaluate(()=>(window as any).__effects.map((e:any)=>({state:e.animation.playState,connected:e.target.isConnected})));assert.ok(detached.length>=2);assert.ok(detached.every((e:any)=>e.state==='idle'&&!e.connected));stages.push({label:'models-active-unmount-cancels-native-effects',effects:detached});
 }
 // A genuinely new synthetic session also owns a real recorded feed event.
 await page.goto('http://127.0.0.1:7816/#live');await page.locator('.qp-live-table tbody tr').first().waitFor();await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(300);await clear();await staticNow('live-initial-static');writeFileSync(resolve(output,'live-initial-io.json'),JSON.stringify(await page.evaluate(()=>({io:(window as any).__io,regions:[...document.querySelectorAll('.qp-live-sessions,.qp-live-records')].map(el=>({class:el.className,rect:el.getBoundingClientRect().toJSON(),parents:(()=>{const a=[];for(let p=el.parentElement;p;p=p.parentElement)a.push({class:p.className,rect:p.getBoundingClientRect().toJSON(),overflow:getComputedStyle(p).overflow});return a})()}))})),null,2));
 db.prepare('INSERT INTO session(id,source_id,native_session_id,project,last_seen_at) VALUES (501,1,?,?,?)').run('motion92-session-501','QuotaPulse',fixedNow-1);
 await arm();const freshEvent=add(501);notify();await page.locator('tr[data-live-session=\'["session",501]\']').waitFor();await page.locator('li[data-live-record^="['+freshEvent+',"]').waitFor();await collect('live-observed-session-and-feed',[180,700,180,700]);
 await clear();await accepted('/api/live-sessions',()=>notify());await staticNow('live-duplicate-refresh-static');
 let duplicateHeld!:()=>void;const duplicateIntercepted=new Promise<void>(r=>duplicateHeld=r),duplicateReleased=new Promise<void>(r=>releaseHeld=r);let duplicateOnce=true;const sessionsPattern='**/api/live-sessions?**';await page.route(sessionsPattern,async route=>{if(!duplicateOnce)return route.continue();duplicateOnce=false;const response=await route.fetch();duplicateHeld();await Promise.race([duplicateReleased,new Promise<void>(r=>setTimeout(r,20000))]);await route.fulfill({response})});notify();await Promise.race([duplicateIntercepted,page.waitForTimeout(12000).then(()=>{throw Error('Live duplicate response not held')})]);
 const opener=page.locator('tr[data-live-session=\'["session",501]\'] button').first();await arm();await opener.focus();await page.keyboard.press('Enter');await page.locator('.qp-live-dialog[open]').waitFor();releaseHeld!();releaseHeld=undefined;await collect('live-explicit-session-and-native-detail',[180,700,180,700]);await page.unroute(sessionsPattern);await page.keyboard.press('Escape');await page.locator('.qp-live-dialog[open]').waitFor({state:'hidden'});assert.equal(await opener.evaluate(e=>document.activeElement===e),true,'Escape restores exact Live opener');
 await page.locator('.qp-live-actions button').first().click();await clear();const pausedEvent=add();notify();await page.waitForTimeout(1600);assert.equal(await page.locator('li[data-live-record^="['+pausedEvent+',"]').count(),0,'Paused page is retained');await staticNow('live-paused-static');await accepted('/api/live-sessions',()=>page!.locator('.qp-live-actions button').first().click());await staticNow('live-resume-seeds-static');
 await page.emulateMedia({reducedMotion:'reduce'});await clear();const reducedEvent=add();notify();await page.locator('li[data-live-record^="['+reducedEvent+',"]').waitFor();await staticNow('live-reduced-new-record-static');await page.emulateMedia({reducedMotion:'no-preference'});await page.waitForTimeout(150);await accepted('/api/live-sessions',()=>notify());await clear();
 await arm();const freshAfterRestore=add();notify();await page.locator('li[data-live-record^="['+freshAfterRestore+',"]').waitFor();await collect('live-fresh-after-restoration',[180,700]);
 await page.screenshot({path:resolve(output,'live-final.png')});assert.deepEqual(errors,[]);assert.deepEqual(forbidden,[]);writeFileSync(resolve(output,'verification.json'),JSON.stringify({productionIndexSha256:sha(readFileSync(resolve(root,'packages/web/dist/index.html'))),browser:browser.version(),scope:'Actual compiled Models/Live through isolated synthetic memory API/SSE; native timeline samples, not packaged release',stages,errors,forbidden},null,2));
 }
 console.log('Models/Live92 '+mode+' complete.');
}catch(error){writeFileSync(resolve(output,'failure.json'),JSON.stringify({message:String(error),stack:(error as Error).stack,url:page?.url(),productionIndexSha256:sha(readFileSync(resolve(root,'packages/web/dist/index.html'))),stages,io:await page?.evaluate(()=>(window as any).__io),errors,forbidden},null,2));await page?.screenshot({path:resolve(output,'failure.png')}).catch(()=>{});throw error;
}finally{releaseHeld?.();await browser?.close();await daemon.close();db.close();globalThis.Date=realDate;process.env.TZ=priorTimezone;}
