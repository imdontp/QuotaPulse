/** Compiled Overview motion regression using real isolated API/SSE and synthetic DB. */
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
const output=resolve(root,'tmp/motion81-browser');
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
const rendererArgs = ['--disable-gpu', '--deterministic-mode', '--disable-skia-runtime-opts', '--force-color-profile=srgb'];
async function settled(page:Page,pending:Set<Request>) {
 const deadline=performance.now()+30_000;let idle=0;
 while(idle<12){assert.ok(performance.now()<deadline,`API did not settle: ${[...pending].map(r=>r.url()).join(', ')}`);idle=pending.size===0?idle+1:0;await page.waitForTimeout(25);}
 await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(1_000);
}
try {
 await daemon.listen({host:'127.0.0.1',port:7816});
 browser=await chromium.launch({channel:'chrome',headless:true,args:rendererArgs});
 const page=await browser.newPage({viewport:{width:1672,height:941},reducedMotion:'no-preference',deviceScaleFactor:1,timezoneId:'Asia/Bangkok'});
 page.setDefaultTimeout(10_000);
 const pending=new Set<Request>();
 page.on('request',r=>{if(new URL(r.url()).pathname.startsWith('/api/')&&!r.url().includes('/events/stream'))pending.add(r)});
 page.on('requestfinished',r=>pending.delete(r));page.on('requestfailed',r=>pending.delete(r));
 await page.addInitScript(({lang,theme})=>{(window as unknown as {__QUOTAPULSE_TOKEN__:string}).__QUOTAPULSE_TOKEN__='stable-capture-test';localStorage.setItem('quotapulse-prefs',JSON.stringify({lang,currency:'USD',rate:1,hiddenSubscriptions:[]}));localStorage.setItem('quotapulse-theme',theme)},{lang:taskLang,theme:taskTheme});
 await page.clock.setFixedTime(fixedNow);
 const results=[];
 await page.setViewportSize({width:1586,height:992});
 await page.goto('http://127.0.0.1:7816/#overview',{waitUntil:'domcontentloaded'});
 await page.locator('[data-testid="production-overview"] .qp-pulse-art').waitFor();await settled(page,pending);await page.evaluate(()=>document.fonts.ready);

 await page.waitForFunction(()=>/^\d[\d,]*$/.test(document.querySelector('[data-stat=models]')?.textContent??''));
 await page.waitForFunction(()=>document.querySelector('.qp-map-column[data-dimension=project]')?.querySelectorAll('.qp-map-node').length===1);
 await page.locator('#runtime').scrollIntoViewIfNeeded();await page.waitForTimeout(100);
 page.setDefaultTimeout(10_000);
 const records=[];const notify=()=>scheduler.emit('data',{newEvents:1,newLimits:0,trigger:'watch',durationMs:0});
 const insert=(label:string,source=1,at=fixedNow)=>{const result=db.prepare("INSERT INTO usage_event(source_id,session_id,dedup_key,ts,model,provider,input_tokens,output_tokens,total_tokens,call_count,cost_source) VALUES (?,?,?,?,?,?,?,?,?,?,?)").run(source,source===2?7:1,label,at,'DeepSeek V4.1','deepseek',10,5,15,1,'unknown');notify();return Number(result.lastInsertRowid)};
 const dots=page.locator('.qp-map-flow-dot');assert.equal(await dots.count(),0,'Mount has no idle particles');
 await page.evaluate(()=>{(window as any).__motionLog=[];new MutationObserver(()=>{for(const e of document.querySelectorAll('.qp-map-flow-dot,[data-motion-highlight=aggregate]')){const id=e.getAttribute('data-event-id')??e.getAttribute('data-motion-event-id');if(!(window as any).__motionLog.some((v:any)=>v.id===id))(window as any).__motionLog.push({id,kind:e.matches('.qp-map-flow-dot')?'edge':'node',state:e.getAttribute('data-motion-state'),from:e.getAttribute('data-from'),to:e.getAttribute('data-to'),repeat:e.querySelector('animateMotion')?.getAttribute('repeatCount'),duration:e.querySelector('animateMotion')?.getAttribute('dur')});}}).observe(document.querySelector('#runtime')!,{childList:true,subtree:true,attributes:true});});
 const observe=async(id:number)=>{await page.waitForFunction(id=>(window as any).__motionLog.some((v:any)=>v.id===String(id)),id,{timeout:10_000});const entry=await page.evaluate(id=>(window as any).__motionLog.find((v:any)=>v.id===String(id)),id);records.push({id,...entry});return entry;};
 const pulse=page.locator('.qp-pulse');const orbit=page.locator('.qp-orbit');assert.equal(await orbit.evaluate(e=>getComputedStyle(e).animationDuration),'6s');assert.equal(await pulse.getAttribute('data-idle'),'false');assert.equal(await orbit.evaluate(e=>getComputedStyle(e).animationPlayState),'running');
 const coldAggregate = db.prepare('SELECT id,ts FROM usage_event WHERE source_id=2 ORDER BY ts DESC,id DESC LIMIT 1').get() as {id:number;ts:number};
 assert.ok(coldAggregate.ts<fixedNow,'Cold aggregate keeps its older session timestamp');
 db.prepare('UPDATE usage_event SET reasoning_tokens=COALESCE(reasoning_tokens,0)+1 WHERE id=?').run(coldAggregate.id);notify();
 const coldRevision=await observe(coldAggregate.id);assert.equal(coldRevision.kind,'node');assert.equal(await page.locator('animateMotion').count(),0);
 assert.equal(await dots.count(),0,'Cold aggregate revision is a node highlight only');await page.locator('[data-motion-highlight=aggregate]').waitFor({state:'detached'});
 console.log('Cold initial aggregate baseline and first ordinary revision passed.');
 console.log('Mount ready; inserting actual first call.');
 const id=insert('motion81-first');const first=await observe(id);const firstPresentedAt=performance.now();assert.equal(first.kind,'edge');assert.equal(first.repeat,'1');assert.equal(first.duration,'.7s');
 const moving=dots.filter({has:page.locator('animateMotion')});await moving.waitFor();const position=()=>moving.evaluate(e=>{const c=e as SVGCircleElement;const p=new DOMPoint(c.cx.baseVal.value,c.cy.baseVal.value).matrixTransform(c.getScreenCTM()!);return{x:p.x,y:p.y}});const p0=await position();await page.waitForTimeout(180);const p1=await position();console.log('SMIL positions/timeline:',JSON.stringify({p0,p1,timeline:await moving.evaluate(e=>({svg:(e.ownerSVGElement as SVGSVGElement).getCurrentTime(),start:(e.querySelector('animateMotion') as SVGAnimationElement).getStartTime()}))}));assert.ok(Math.hypot(p1.x-p0.x,p1.y-p0.y)>2);await dots.waitFor({state:'detached',timeout:1_300});const firstExpiryObservedMs=performance.now()-firstPresentedAt;assert.ok(firstExpiryObservedMs<=1_300,`Motion expiry exceeded 700ms plus 600ms scheduling allowance: ${firstExpiryObservedMs}`);
 notify();await settled(page,pending);await page.waitForTimeout(1600);assert.equal(await dots.count(),0,'Duplicate actual snapshot does not replay');
 await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await orbit.evaluate(e=>getComputedStyle(e).animationName),'none');assert.equal(await page.locator('.qp-core-progress-mask').first().evaluate(e=>getComputedStyle(e).transitionProperty),'none');const reducedId=insert('motion81-reduced');const reduced=await observe(reducedId);assert.equal(reduced.state,'static');assert.equal(await page.locator('animateMotion').count(),0);await dots.waitFor({state:'detached'});
 db.prepare("UPDATE limit_sample SET used_percent=95 WHERE source_id=1 AND window_kind='5h' AND observed_at=(SELECT MAX(observed_at) FROM limit_sample WHERE source_id=1 AND window_kind='5h')").run();notify();await page.waitForFunction(()=>document.querySelector('.qp-pulse-label strong')?.textContent==='95%');assert.equal(await page.getByTestId('pulse-progress').getAttribute('stroke-dasharray'),'95 100');assert.equal(await page.getByTestId('pulse-progress').evaluate(e=>getComputedStyle(e).transitionProperty),'none');
 const aggregateId=insert('motion81-aggregate',2);const aggregate=await observe(aggregateId);assert.equal(aggregate.kind,'node');assert.equal(await dots.count(),0);await page.locator('[data-motion-highlight=aggregate]').waitFor({state:'detached'});
 db.prepare('UPDATE usage_event SET reasoning_tokens=2 WHERE id=?').run(aggregateId);await page.evaluate(id=>{(window as any).__motionLog=(window as any).__motionLog.filter((v:any)=>v.id!==String(id))},aggregateId);notify();assert.equal((await observe(aggregateId)).kind,'node');await page.locator('[data-motion-highlight=aggregate]').waitFor({state:'detached'});
 await page.emulateMedia({reducedMotion:'no-preference'});const runtime=page.locator('#runtime');await runtime.evaluate(e=>{(e as HTMLElement).style.transform='translateY(2500px)'});await page.waitForTimeout(100);const offscreenId=insert('motion81-offscreen',1,fixedNow-1);await page.waitForTimeout(2500);assert.equal(await page.evaluate(id=>(window as any).__motionLog.some((v:any)=>v.id===String(id)),offscreenId),false);assert.equal(await dots.count(),0);
 await runtime.evaluate(e=>{(e as HTMLElement).style.transform=''});await runtime.scrollIntoViewIfNeeded();await page.waitForTimeout(100);assert.equal(await dots.count(),0,'Offscreen backlog is not replayed');const later=insert('motion81-first-eligible-after-return');assert.equal((await observe(later)).state,'running');await dots.waitFor({state:'detached'});
 let releaseHeld!:()=>void;let signalHeld!:()=>void;const held=new Promise<void>(r=>{signalHeld=r});const release=new Promise<void>(r=>{releaseHeld=r});
 await page.route('**/api/overview',async route=>{const response=await route.fetch();signalHeld();await release;await route.fulfill({response});});
 await runtime.evaluate(e=>{(e as HTMLElement).style.transform='translateY(2500px)'});await page.waitForTimeout(100);const inFlightId=insert('motion81-inflight-offscreen');await Promise.race([held,page.waitForTimeout(10_000).then(()=>{throw new Error('Held overview request did not arrive')})]);
 await runtime.evaluate(e=>{(e as HTMLElement).style.transform=''});await runtime.scrollIntoViewIfNeeded();await page.waitForTimeout(100);const beforeHeld=await runtime.getAttribute('data-observation-batch');releaseHeld();await page.waitForFunction(serial=>Number(document.querySelector('#runtime')?.getAttribute('data-observation-batch'))>Number(serial),beforeHeld,{timeout:10_000});await page.unroute('**/api/overview');await page.waitForTimeout(800);
 assert.equal(await page.evaluate(id=>(window as any).__motionLog.some((v:any)=>v.id===String(id)),inFlightId),false,'Late offscreen response must remain consumed without replay');const postInFlight=insert('motion81-post-inflight');assert.equal((await observe(postInFlight)).state,'running');await dots.waitFor({state:'detached'});
 console.log('Held response race and first genuine post-return call passed.');
 let releaseGraph!:()=>void;let signalGraph!:()=>void;const graphHeld=new Promise<void>(r=>{signalGraph=r});const graphRelease=new Promise<void>(r=>{releaseGraph=r});
 const graphPattern='**/api/runtime-map?**';
 await page.route(graphPattern,async route=>{if(!new URL(route.request().url()).searchParams.has('project')){await route.continue();return;}const response=await route.fetch();signalGraph();await graphRelease;await route.fulfill({response});});
 const pendingGraphId=insert('motion81-held-selected-graph');await Promise.race([graphHeld,page.waitForTimeout(10_000).then(()=>{throw new Error('Selected graph did not arrive')})]);
 assert.equal(await page.evaluate(id=>(window as any).__motionLog.some((v:any)=>v.id===String(id)),pendingGraphId),false,'Motion waits for the exact selected graph');
 await runtime.evaluate(e=>{(e as HTMLElement).style.transform='translateY(2500px)'});await page.waitForTimeout(100);await runtime.evaluate(e=>{(e as HTMLElement).style.transform=''});await runtime.scrollIntoViewIfNeeded();await page.waitForTimeout(100);
 releaseGraph();await settled(page,pending);await page.unroute(graphPattern);await page.waitForTimeout(800);
 assert.equal(await page.evaluate(id=>(window as any).__motionLog.some((v:any)=>v.id===String(id)),pendingGraphId),false,'A late selected graph must not revive motion across an eligibility loss');
 const postGraph=insert('motion81-post-selected-graph');assert.equal((await observe(postGraph)).state,'running');await dots.waitFor({state:'detached'});
 console.log('Held selected graph canceled across eligibility change; next fresh call passed.');

 await pulse.evaluate(e=>{(e as HTMLElement).style.transform='translateY(2500px)'});await page.waitForFunction(()=>document.querySelector('.qp-redesign')?.getAttribute('data-paused')==='true');assert.equal(await orbit.evaluate(e=>getComputedStyle(e).animationPlayState),'paused');await pulse.evaluate(e=>{(e as HTMLElement).style.transform=''});await page.waitForFunction(()=>document.querySelector('.qp-redesign')?.getAttribute('data-paused')==='false');
 db.prepare('UPDATE usage_event SET ts=?').run(fixedNow-31*60_000);notify();await page.waitForFunction(()=>document.querySelector('.qp-pulse')?.getAttribute('data-idle')==='true');assert.equal(await orbit.evaluate(e=>getComputedStyle(e).animationPlayState),'paused');
 db.prepare('UPDATE limit_sample SET last_seen_at=last_seen_at-?,observed_at=observed_at-?,source_fetched_at=source_fetched_at-?').run(2*3_600_000+1234,2*3_600_000+1234,2*3_600_000+1234);const staleCall=insert('motion81-stale-quota');await observe(staleCall);await page.waitForFunction(()=>document.querySelector('.qp-pulse')?.getAttribute('data-stale')==='true');assert.equal(await pulse.getAttribute('data-runtime-activity'),'recent-observation');assert.equal(await orbit.evaluate(e=>getComputedStyle(e).animationPlayState),'paused');await dots.waitFor({state:'detached'});
 db.prepare('UPDATE limit_sample SET used_percent=NULL').run();const beforeUnknown=await runtime.getAttribute('data-observation-batch');notify();await page.waitForFunction(serial=>Number(document.querySelector('#runtime')?.getAttribute('data-observation-batch'))>Number(serial),beforeUnknown,{timeout:10_000});await page.waitForFunction(()=>document.querySelector('.qp-pulse')?.getAttribute('data-idle')==='true');assert.equal(await orbit.evaluate(e=>getComputedStyle(e).animationPlayState),'paused');
 await page.evaluate(()=>{(window as any).__motionDocumentSentinel='same-document-motion81';location.hash='models'});await page.getByTestId('production-models').waitFor();assert.equal(await page.evaluate(()=>(window as any).__motionDocumentSentinel),'same-document-motion81','Unmount must retain the document');assert.equal(await page.locator('#runtime').count(),0);insert('motion81-unmounted');await page.waitForTimeout(1600);assert.equal(await dots.count(),0);
 writeFileSync(resolve(output,'verification.json'),JSON.stringify({productionIndexSha256:sha(readFileSync(resolve(root,'packages/web/dist/index.html'))),scope:'Actual local API/SSE and synthetic DB; Scheduler notification manually emitted; no adapter/native-minimize claim',records,offscreenId,inFlightId,pendingGraphId,firstExpiryObservedMs,expirySchedulingAllowanceMs:600,sameDocumentUnmount:true,pulse:{durationSeconds:6,idle:true,stale:true,unavailable:true,reduced:true,offscreen:true},cleanup:true},null,2));console.log('Actual-observation motion, 700ms expiry, reduced, aggregate, duplicate, offscreen and unmount passed.');
}finally{await browser?.close();await daemon.close();db.close();globalThis.Date=realDate;process.env.TZ=priorTimezone;}
