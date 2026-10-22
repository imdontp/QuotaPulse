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
const output=resolve(root,'tmp/runway90-browser');
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
addQuotaSample(1, '5h', 20, fixedNow + (2 * 60 + 17) * 60_000, fixedNow - 30 * 60_000);
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
const errors:string[]=[],stages:any[]=[];
try {
 await daemon.listen({host:'127.0.0.1',port:7816});browser=await chromium.launch({channel:'chrome',headless:true,args:rendererArgs});
 const page=await browser.newPage({viewport:{width:1672,height:1400},reducedMotion:'no-preference',timezoneId:'Asia/Bangkok'});page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript('globalThis.__name = value => value');
 await page.addInitScript(()=>{(window as any).__QUOTAPULSE_TOKEN__='stable-capture-test';localStorage.setItem('quotapulse-theme','dark');localStorage.setItem('quotapulse-prefs',JSON.stringify({lang:'en',currency:'USD',rate:1,hiddenSubscriptions:[]}));const native=Element.prototype.animate;(window as any).__runwayAnimations=[];Element.prototype.animate=function(...args:Parameters<Element['animate']>){const result=native.apply(this,args);if(this.closest('.qp-runway'))(window as any).__runwayAnimations.push({element:this.className,keyframes:args[0],options:args[1],animation:result});return result}});
 await installBrowserFixedDate(page, fixedNow);await page.goto('http://127.0.0.1:7816/#overview');const region=page.getByTestId('quota-runway');await page.locator('.qp-runway-marker').waitFor();await region.scrollIntoViewIfNeeded();await page.waitForTimeout(200);
 const notify=()=>scheduler.emit('data',{newEvents:0,newLimits:1,trigger:'synthetic-runway'});
 const marker=()=>page.locator('.qp-runway-marker').evaluate(e=>({left:(e as HTMLElement).style.left,x:parseFloat(getComputedStyle(e).left),width:e.parentElement!.getBoundingClientRect().width,projected:e.parentElement!.getAttribute('data-projected-at'),reset:e.parentElement!.getAttribute('data-reset-at')}));
 const clear=()=>page.evaluate(()=>(window as any).__runwayAnimations=[]);
 const count=()=>page.evaluate(()=>(window as any).__runwayAnimations.length);
 const waitFresh=async(previous:string|null)=>{await page.waitForFunction(previous=>document.querySelector('.qp-runway-track')?.getAttribute('data-projected-at')!==previous,previous);};
 const update=async(value:number)=>{const before=await marker();db.prepare("UPDATE limit_sample SET used_percent=? WHERE source_id=1 AND window_kind='5h' AND observed_at=(SELECT MAX(observed_at) FROM limit_sample WHERE source_id=1 AND window_kind='5h')").run(value);notify();await waitFresh(before.projected);return before;};
 assert.equal(await count(),0,'Initial forecast does not replay');
 // If the browser initially laid this bottom section outside the viewport, seed
 // its restored eligibility with an actual new sample before the measured change.
 await update(84);await page.waitForTimeout(500);await clear();
 await page.evaluate(()=>{(window as any).__runwaySamples=[];let started=false;const observer=new MutationObserver(()=>{if(!started&&(window as any).__runwayAnimations.length){started=true;const start=performance.now();const sample=()=>{const e=document.querySelector('.qp-runway-marker') as HTMLElement;(window as any).__runwaySamples.push({ms:performance.now()-start,x:parseFloat(getComputedStyle(e).left),base:e.style.left,width:e.parentElement!.getBoundingClientRect().width,timelines:(window as any).__runwayAnimations.map((v:any)=>({time:v.animation.currentTime,state:v.animation.playState}))});if(performance.now()-start<650)requestAnimationFrame(sample);else observer.disconnect()};requestAnimationFrame(sample)}});observer.observe(document.body,{subtree:true,childList:true,attributes:true})});
 const before=await update(86);await page.waitForFunction(()=>(window as any).__runwaySamples.at(-1)?.ms>=650);const moving=await page.evaluate(()=>({samples:(window as any).__runwaySamples,animations:(window as any).__runwayAnimations.map((v:any)=>({element:v.element,keyframes:v.keyframes,options:v.options,state:v.animation.playState}))}));assert.equal(moving.animations.length,3);for(const a of moving.animations){assert.equal(a.options.duration,420);assert.equal(a.options.iterations,1);assert.equal(a.options.fill,'none');assert.equal(a.state,'idle')};const finalX=moving.samples.at(-1).x;const lo=Math.min(before.x,finalX),hi=Math.max(before.x,finalX);const intermediate=moving.samples.filter((s:any)=>s.x>lo+.002&&s.x<hi-.002);assert.ok(new Set(intermediate.map((s:any)=>s.x)).size>=3,'At least three distinct actual intermediate positions, independent of border-box width');assert.ok(moving.samples.some((s:any)=>s.timelines.every((t:any)=>t.state==='running'&&t.time>=350&&t.time<=420)),'All three native timelines remain active near the full420ms duration');stages.push({label:'same-period420',before,...moving});
 await clear();await installBrowserFixedDate(page, fixedNow+1000);notify();await page.waitForTimeout(1800);assert.equal(await count(),0,'Clock-only/duplicate forecast cannot replay');
 await page.emulateMedia({reducedMotion:'reduce'});await clear();await update(87);await page.waitForTimeout(100);assert.equal(await count(),0,'Reduced forecast immediate');await page.emulateMedia({reducedMotion:'no-preference'});
 // Explicit selection remains the same exact stale reader instead of a new default.
 await clear();const frozen=await marker();
 db.prepare("UPDATE limit_sample SET last_seen_at=?,source_fetched_at=?").run(fixedNow-2*3600000,fixedNow-2*3600000);notify();await page.waitForFunction(()=>document.querySelector('[data-testid=quota-runway]')?.getAttribute('data-state')==='stale');assert.deepEqual(await marker(),frozen);assert.ok((await region.getByRole('status').textContent())?.includes('last valid forecast frozen'));assert.equal(await count(),0);assert.equal(await page.locator('.qp-pulse').getAttribute('data-idle'),'true','Core does not promote a stale default');stages.push({label:'automatic-default-loss-stale-frozen',frozen});
 await page.getByRole('button',{name:'Switch language',exact:true}).click();await page.waitForFunction(()=>document.documentElement.lang==='th');assert.equal(await region.getAttribute('data-state'),'stale');assert.deepEqual(await marker(),frozen);assert.ok((await region.getByRole('status').textContent())?.includes('คงภาพการคาดการณ์ล่าสุด'));await page.getByRole('button',{name:'เปลี่ยนภาษา',exact:true}).click();await page.waitForFunction(()=>document.documentElement.lang==='en');assert.deepEqual(await marker(),frozen);stages.push({label:'stale-survives-language-change'});
 // A reset identity replaces this frozen period; no backwards tween is allowed.
 db.prepare("UPDATE limit_sample SET resets_at=resets_at+3600000,last_seen_at=?,source_fetched_at=? WHERE source_id=1 AND window_kind='5h'").run(fixedNow,fixedNow);notify();await page.waitForFunction(reset=>document.querySelector('[data-testid=quota-runway]')?.getAttribute('data-state')==='fresh'&&document.querySelector('.qp-runway-track')?.getAttribute('data-reset-at')!==reset,frozen.reset);assert.equal(await count(),0);stages.push({label:'new-reset-replaces',value:await marker()});
 await page.locator('.qp-quota[data-window="5h"]').click();await clear();const explicitFrozen=await marker();db.prepare("UPDATE limit_sample SET last_seen_at=?,source_fetched_at=? WHERE source_id=1 AND window_kind='5h'").run(fixedNow-2*3600000,fixedNow-2*3600000);notify();await page.waitForFunction(()=>document.querySelector('[data-testid=quota-runway]')?.getAttribute('data-state')==='stale');assert.deepEqual(await marker(),explicitFrozen);assert.equal(await count(),0);stages.push({label:'explicit-reader-stale-frozen',value:explicitFrozen});
 db.prepare("DELETE FROM limit_sample WHERE source_id=1 AND window_kind='5h'").run();notify();await page.waitForFunction(()=>document.querySelector('[data-testid=quota-runway]')?.getAttribute('data-state')==='unavailable');assert.equal(await region.locator('.qp-runway-track').count(),0,'Removed reader cannot retain an old forecast');assert.equal(await count(),0);stages.push({label:'removed-reader-clears'});
 await page.screenshot({path:resolve(output,'runway-final.png')});assert.deepEqual(errors,[]);writeFileSync(resolve(output,'verification.json'),JSON.stringify({productionIndexSha256:sha(readFileSync(resolve(root,'packages/web/dist/index.html'))),browser:browser.version(),fixture:'Synthetic memory DB with actual compiled API/SSE, no native lifecycle claim',stages,initialNoReplay:true,clockOnlyNoReplay:true,reducedImmediate:true,staleFreeze:true,automaticDefaultLoss:true,localeRetention:true,resetReplaces:true,explicitStale:true,removedReaderClears:true,errors},null,2));console.log('Runway real420ms, clock-only, reduced, stale freeze and reset replacement passed.');
}finally{await browser?.close();await daemon.close();db.close();globalThis.Date=realDate;process.env.TZ=priorTimezone;}
