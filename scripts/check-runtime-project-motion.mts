import { installBrowserFixedDate } from './browser-fixed-date.mjs';
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
const output=resolve(root,'tmp/motion89-project-browser');
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
 await installBrowserFixedDate(page, fixedNow);
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
 const runtime=page.locator('#runtime');
 const projects=()=>page.locator('.qp-map-column[data-dimension=project] .qp-map-node').evaluateAll(es=>es.map(e=>e.getAttribute('data-key')));
 const choose=async(project:string)=>{if(!await page.locator('.qp-runtime-options').evaluate(e=>(e as HTMLDetailsElement).open))await page.locator('.qp-runtime-options>summary').click();await page.locator('.qp-runtime-project select').selectOption(JSON.stringify(project));};
 const ready=async(project:string)=>{await page.waitForFunction(project=>document.querySelector('#runtime')?.getAttribute('data-runtime-state')==='ready'&&document.querySelector('.qp-map-column[data-dimension=project] .qp-map-node')?.getAttribute('data-key')===JSON.stringify(project),project);assert.deepEqual(await projects(),[JSON.stringify(project)]);};
 await ready('QuotaPulse');
 // One actual refresh sees A, then a newer B in the same harness. The rail stays global.
 const a=Number(db.prepare("INSERT INTO usage_event(source_id,session_id,dedup_key,ts,model,provider,total_tokens,input_tokens,output_tokens,call_count,cost_source) VALUES(1,1,'motion89-A',?,'DeepSeek V4.1','deepseek',15,10,5,1,'unknown')").run(fixedNow).lastInsertRowid);
 const b=Number(db.prepare("INSERT INTO usage_event(source_id,session_id,dedup_key,ts,model,provider,total_tokens,input_tokens,output_tokens,call_count,cost_source) VALUES(1,101,'motion89-B',?,'DeepSeek V4.1','deepseek',16,11,5,1,'unknown')").run(fixedNow).lastInsertRowid);
 notify();assert.equal((await observe(a)).kind,'edge');await settled(page,pending);assert.equal(await page.evaluate(b=>(window as any).__motionLog.some((v:any)=>v.id===String(b)),b),false);assert.deepEqual(await projects(),[JSON.stringify('QuotaPulse')]);
 const globalNewest=await page.request.get('http://127.0.0.1:7816/api/usage-events?limit=1&offset=0',{headers:{'x-quotapulse-token':'stable-capture-test'}});assert.equal(globalNewest.status(),200);assert.equal((await globalNewest.json()).rows[0].event_id,b);
 // Hold a real B response. New context must not show A or global topology.
 const graphPattern='**/api/runtime-map?**';let release!:()=>void;let held!:()=>void;
 const holding=new Promise<void>(r=>held=r),released=new Promise<void>(r=>release=r);
 let holdingOnce=true;await page.route(graphPattern,async route=>{if(new URL(route.request().url()).searchParams.get('project')!=='Agent Platform'||!holdingOnce)return route.continue();holdingOnce=false;const response=await route.fetch();held();await Promise.race([released,new Promise<void>(r=>setTimeout(r,20000))]);await route.fulfill({response});});
 await choose('Agent Platform');await Promise.race([holding,page.waitForTimeout(10000).then(()=>{throw new Error('B graph not held')})]);assert.equal(await runtime.getAttribute('data-runtime-state'),'loading');assert.equal(await runtime.getAttribute('aria-busy'),'true');assert.deepEqual(await projects(),[]);
 await choose('QuotaPulse');await ready('QuotaPulse');release();await settled(page,pending);await page.unroute(graphPattern);await ready('QuotaPulse');
 // Stronger A→B→A race: the obsolete A response was fetched before a newer
 // exact-A observation, without another global parent serial between B and A.
 let releaseA!:()=>void,signalA!:()=>void,finishA!:()=>void;let holdAOnce=true;
 const heldA=new Promise<void>(r=>signalA=r),releaseOldA=new Promise<void>(r=>releaseA=r),oldAFinished=new Promise<void>(r=>finishA=r);
 await page.route(graphPattern,async route=>{if(new URL(route.request().url()).searchParams.get('project')!=='QuotaPulse'||!holdAOnce)return route.continue();holdAOnce=false;const response=await route.fetch();signalA();await Promise.race([releaseOldA,new Promise<void>(r=>setTimeout(r,20000))]);await route.fulfill({response});finishA();});
 notify();await Promise.race([heldA,page.waitForTimeout(10000).then(()=>{throw new Error('A graph not held')})]);
 await choose('Agent Platform');await ready('Agent Platform');const sameSerial=await runtime.getAttribute('data-observation-batch');
 db.prepare("INSERT INTO usage_event(source_id,session_id,dedup_key,ts,model,provider,total_tokens,input_tokens,output_tokens,call_count,cost_source) VALUES(1,1,'motion89-A-newer-held',?,'DeepSeek V4.1','deepseek',17,12,5,1,'unknown')").run(fixedNow);
 await choose('QuotaPulse');await ready('QuotaPulse');assert.equal(await runtime.getAttribute('data-observation-batch'),sameSerial,'Context changes retain the same global parent serial');const newerATokens=await page.locator('.qp-map-column[data-dimension=project] .qp-map-node').getAttribute('data-tokens');
 releaseA();await oldAFinished;await settled(page,pending);assert.equal(await page.locator('.qp-map-column[data-dimension=project] .qp-map-node').getAttribute('data-tokens'),newerATokens,'Late obsolete A response cannot replace newer same-context facts');await page.unroute(graphPattern);
 // Same-context failures retain only the exact accepted topology and settle busy state.
 await page.route(graphPattern,route=>new URL(route.request().url()).searchParams.get('project')==='QuotaPulse'?route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Synthetic scoped failure'})}):route.continue());
 notify();await page.waitForFunction(()=>document.querySelector('#runtime')?.getAttribute('data-runtime-state')==='stale');assert.equal(await runtime.getAttribute('aria-busy'),'false');assert.deepEqual(await projects(),[JSON.stringify('QuotaPulse')]);await page.unroute(graphPattern);notify();await ready('QuotaPulse');
 // A failed new context cannot borrow A's graph; returning A clears scoped failure.
 await page.route(graphPattern,route=>new URL(route.request().url()).searchParams.get('project')==='Agent Platform'?route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Synthetic new context failure'})}):route.continue());
 await choose('Agent Platform');await page.waitForFunction(()=>document.querySelector('#runtime')?.getAttribute('data-runtime-state')==='error');assert.equal(await runtime.getAttribute('aria-busy'),'false');assert.deepEqual(await projects(),[]);await page.unroute(graphPattern);
 const retryResponse=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/refresh'&&r.request().method()==='POST');await runtime.getByRole('button',{name:'Refresh now',exact:true}).click();assert.equal((await retryResponse).status(),200);await ready('Agent Platform');
 await choose('QuotaPulse');await ready('QuotaPulse');
 await choose('Agent Platform');await ready('Agent Platform');await choose('QuotaPulse');await ready('QuotaPulse');
 writeFileSync(resolve(output,'verification.json'),JSON.stringify({productionIndexSha256:sha(readFileSync(resolve(root,'packages/web/dist/index.html'))),browser:browser.version(),scope:'Synthetic memory DB and actual compiled local API/SSE; no native release claim',records,a,b,globalNewest:b,heldForeignGraphSuppressed:true,lateForeignResponseIgnored:true,sameSerialABARace:{serial:sameSerial,newerATokens,obsoleteResponseIgnored:true},sameContext503Retained:true,newContext503Empty:true,actualRetryPost200:true,recovery:true},null,2));console.log('Selected-project signals, held context isolation, 503 retention and recovery passed.');
}finally{await browser?.close();await daemon.close();db.close();globalThis.Date=realDate;process.env.TZ=priorTimezone;}
