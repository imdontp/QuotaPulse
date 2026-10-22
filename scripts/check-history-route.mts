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
const output=resolve(root,'tmp/history91-route-repro');
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
const requests:string[]=[];try{
 await daemon.listen({host:'127.0.0.1',port:7816});browser=await chromium.launch({channel:'chrome',headless:true,args:rendererArgs});const page=await browser.newPage({viewport:{width:1672,height:1100},reducedMotion:'reduce',timezoneId:'Asia/Bangkok'});page.on('request',r=>{const u=new URL(r.url());if(u.pathname==='/api/usage-events')requests.push(u.pathname+u.search)});await page.addInitScript(()=>{(window as any).__QUOTAPULSE_TOKEN__='stable-capture-test';localStorage.setItem('quotapulse-theme','dark');localStorage.setItem('quotapulse-prefs',JSON.stringify({lang:'en',currency:'USD',rate:1,hiddenSubscriptions:[]}))});await installBrowserFixedDate(page, fixedNow);await page.goto('http://127.0.0.1:7816/#history?range=today');await page.locator('.qp-history-table tbody tr').first().waitFor();await page.locator('dialog[open]').waitFor();await page.keyboard.press('Escape');await page.waitForTimeout(200);
 const pause=page.locator('.qp-history-view-actions button').first();await pause.click();await page.waitForTimeout(1600);const resumed=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/usage-events');await pause.click();await (await resumed).finished();await page.waitForTimeout(150);const before=page.url();requests.length=0;await page.evaluate(()=>{location.hash='#history?range=today&provider=deepseek'});await page.waitForTimeout(1800);const final=await page.evaluate(()=>({hash:location.hash,provider:(document.querySelector('input[placeholder="Routed provider"]') as HTMLInputElement)?.value,rows:[...document.querySelectorAll('.qp-history-table tbody tr')].map(e=>e.textContent)}));writeFileSync(resolve(output,'result.json'),JSON.stringify({productionIndexSha256:sha(readFileSync(resolve(root,'packages/web/dist/index.html'))),before,intended:'#history?range=today&provider=deepseek',requests,final},null,2));assert.equal(final.provider,'deepseek','Same-document route must apply exact incoming provider');assert.equal(new URLSearchParams(final.hash.split('?')[1]).get('provider'),'deepseek');assert.ok(requests.some(r=>new URL(r,'http://local').searchParams.get('provider')==='deepseek'));const back=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/usage-events'&&!new URL(r.url()).searchParams.has('provider'));await page.goBack();await (await back).finished();await page.waitForTimeout(200);assert.equal(await page.locator('input[placeholder="Routed provider"]').inputValue(),'');const forward=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/usage-events'&&new URL(r.url()).searchParams.get('provider')==='deepseek');await page.goForward();await (await forward).finished();await page.waitForTimeout(200);assert.equal(await page.locator('input[placeholder="Routed provider"]').inputValue(),'deepseek');writeFileSync(resolve(output,'history-navigation.json'),JSON.stringify({productionIndexSha256:sha(readFileSync(resolve(root,'packages/web/dist/index.html'))),providerRoute:true,backClears:true,forwardRestores:true,finalUrl:page.url(),requests},null,2));const custom=new URLSearchParams({range:'custom',from:String(fixedNow-3600000),to:String(fixedNow),source:'1',provider:'deepseek',model:'DeepSeek V4.1'});const isCustom=(r:any)=>{const u=new URL(r.url());return u.pathname==='/api/usage-events'&&u.searchParams.get('source_id')==='1'&&u.searchParams.get('provider')==='deepseek'&&u.searchParams.get('model')==='DeepSeek V4.1'};const customResponse=page.waitForResponse(isCustom);await page.evaluate(hash=>{location.hash=hash},'#history?'+custom);const customAccepted=await customResponse;await customAccepted.finished();const data=await customAccepted.json();assert.ok(data.rows.length>0);assert.ok(data.rows.every((row:any)=>row.source_id===1&&row.provider==='deepseek'&&row.model==='DeepSeek V4.1'));assert.equal(data.scope.from,fixedNow-3600000);assert.equal(data.scope.to,fixedNow);await page.waitForTimeout(200);assert.equal(new URLSearchParams(new URL(page.url()).hash.split('?')[1]).get('source'),'1');const customBack=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/usage-events'&&!new URL(r.url()).searchParams.has('source_id')&&new URL(r.url()).searchParams.get('provider')==='deepseek');await page.goBack();await (await customBack).finished();const customForward=page.waitForResponse(isCustom);await page.goForward();await (await customForward).finished();await page.waitForTimeout(200);assert.equal(new URLSearchParams(new URL(page.url()).hash.split('?')[1]).get('range'),'custom');assert.equal(await page.locator('input[placeholder="Routed provider"]').inputValue(),'deepseek');writeFileSync(resolve(output,'history-navigation-custom.json'),JSON.stringify({productionIndexSha256:sha(readFileSync(resolve(root,'packages/web/dist/index.html'))),scope:data.scope,records:data.rows.map((row:any)=>({id:row.event_id,source:row.source_id,provider:row.provider,model:row.model})),customSourceModel:true,backRestoresPriorScope:true,forwardRestoresCustomScope:true,finalUrl:page.url(),requests},null,2));const aliasStart=requests.length;await page.evaluate(()=>{location.hash='#sessions?range=today&provider=openai'});await page.waitForTimeout(1800);const alias=await page.evaluate(()=>({hash:location.hash,provider:(document.querySelector('input[placeholder="Routed provider"]') as HTMLInputElement)?.value,model:(document.querySelector('input[placeholder="Exact model"]') as HTMLInputElement)?.value}));writeFileSync(resolve(output,'history-alias.json'),JSON.stringify({productionIndexSha256:sha(readFileSync(resolve(root,'packages/web/dist/index.html'))),incoming:'#sessions?range=today&provider=openai',final:alias,requests:requests.slice(aliasStart)},null,2));assert.equal(alias.provider,'openai','Legacy sessions alias preserves its exact incoming provider');assert.equal(alias.model,'','Alias clears the previous model filter');assert.equal(alias.hash.split('?')[0],'#history');console.log('Incoming History provider, custom/source/model, Back/Forward and legacy sessions alias preserved.');
}finally{await browser?.close();await daemon.close();db.close();globalThis.Date=realDate;process.env.TZ=priorTimezone;}
