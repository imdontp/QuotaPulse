/** Source-directed visual controls using isolated API/SSE and a synthetic DB. */
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
const visualMode=process.env.QUOTAPULSE_VISUAL91_MODE??'trial';
assert.ok(['trial','compiled'].includes(visualMode));
const output=resolve(root,'tmp/source91-'+visualMode);
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
const cases:any[]=[];
const trialCss=readFileSync(resolve(root,'tmp/source91-trial.css'),'utf8');
const applicationIndex=sha(readFileSync(resolve(root,'packages/web/dist/index.html')));
const baseline=visualMode==='compiled'?JSON.parse(readFileSync(resolve(root,'tmp/source91-trial/verification.json'),'utf8')):null;
try {
 await daemon.listen({host:'127.0.0.1',port:7816});browser=await chromium.launch({channel:'chrome',headless:true,args:rendererArgs});
 for(const routeName of ['overview','live','models'])for(const mode of ['native','light','compact','mobile',...(routeName==='overview'?['long']:routeName==='models'?['dense']:[])]){
  db.exec('SAVEPOINT visual_case');
  if(mode==='long')db.prepare("UPDATE usage_event SET model=? WHERE model='DeepSeek V4.1'").run('Exact recorded model identity / โมเดลที่มีชื่อยาว / '+ 'long-routing-component-'.repeat(12));
  if(mode==='dense')for(let day=1;day<=16;day++){const total=(day%5+1)*70000000;db.prepare("INSERT INTO usage_event(source_id,session_id,dedup_key,ts,model,provider,input_tokens,output_tokens,total_tokens,call_count,cost_source) VALUES(1,1,?,?,'DeepSeek V4.1','deepseek',?,?,?,1,'unknown')").run('dense-trend-'+day,Date.parse('2025-05-'+String(day).padStart(2,'0')+'T12:00:00Z'),total*.6,total*.4,total);}
  const width=mode==='compact'?1280:mode==='mobile'?390:routeName==='overview'?1586:1672;const height=routeName==='overview'?992:941;
  const theme=mode==='light'?'light':'dark';const page=await browser.newPage({viewport:{width,height},reducedMotion:'reduce',timezoneId:'Asia/Bangkok'});const errors:string[]=[],forbidden:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',r=>{const req=r.request(),u=new URL(req.url());if(u.origin!=='http://127.0.0.1:7816'||u.pathname.startsWith('/api/')&&req.method()!=='GET'){forbidden.push(req.method()+' '+u.pathname);return r.abort()}return r.continue()});
  await page.addInitScript('globalThis.__name = value => value');await page.addInitScript(({theme})=>{(window as any).__QUOTAPULSE_TOKEN__='stable-capture-test';localStorage.setItem('quotapulse-theme',theme);localStorage.setItem('quotapulse-prefs',JSON.stringify({lang:'en',currency:'USD',rate:1,hiddenSubscriptions:[]}))},{theme});await page.clock.setFixedTime(fixedNow);
  await page.goto('http://127.0.0.1:7816/#'+routeName);await page.getByTestId('production-'+routeName).waitFor();await page.evaluate(()=>document.fonts.ready);
  const ready=routeName==='overview'?'#runtime[data-runtime-state=ready] .qp-map-node':routeName==='live'?'.qp-live-table tbody tr':'.qp-model-table-wrap tbody tr';await page.locator(ready).first().waitFor();await page.waitForTimeout(500);
  const read=()=>page.evaluate(routeName=>{
   const box=(e:Element)=>{const r=e.getBoundingClientRect();return [r.x,r.y,r.width,r.height]};
   const panels=[...document.querySelectorAll('.qp-panel')].map(e=>({class:e.className,box:box(e)}));
   const table=routeName==='live'?'.qp-live-table':'.qp-model-table-wrap';
   const values=routeName==='overview'?[...document.querySelectorAll('.qp-map-node')].map(e=>({key:e.getAttribute('data-key'),dim:e.getAttribute('data-dimension'),tokens:e.getAttribute('data-tokens'),sessions:e.getAttribute('data-sessions'),text:e.textContent,box:box(e)})):[...document.querySelectorAll(table+' tr')].map(e=>({text:e.textContent,box:box(e)}));
   const paths=[...document.querySelectorAll(routeName==='overview'?'.qp-map-edges path':'.qp-model-row-trend polyline,.qp-live-flow-canvas polyline')].map(e=>({points:e.getAttribute('points'),d:e.getAttribute('d')}));
   const shares=[...document.querySelectorAll('.qp-node-share')].map(e=>({box:box(e),track:box(e.querySelector('.qp-node-track')!),fill:box(e.querySelector('.qp-node-track>span')!),value:e.textContent,inline:(e.querySelector('.qp-node-track>span') as HTMLElement).style.width,paint:getComputedStyle(e.querySelector('.qp-node-track>span')!).backgroundImage}));
   const headers=[...document.querySelectorAll(table+' th')].map(e=>({text:e.textContent,box:box(e),background:getComputedStyle(e).backgroundColor,shadow:getComputedStyle(e).boxShadow}));
   const strokes=[...document.querySelectorAll('.qp-model-row-trend .qp-observed-line')].map(e=>getComputedStyle(e).strokeWidth);
   return {panels,values,paths,shares,headers,strokes,overflow:document.documentElement.scrollWidth>innerWidth};
  },routeName);
  const before=baseline?baseline.cases.find((c:any)=>c.routeName===routeName&&c.mode===mode).before:await read();
  if(visualMode==='trial'){await page.screenshot({path:resolve(output,routeName+'-'+mode+'-before.png')});await page.addStyleTag({content:trialCss});await page.evaluate(()=>new Promise<void>(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>r()))));}
  const after=await read();await page.screenshot({path:resolve(output,routeName+'-'+mode+'-after.png')});
  assert.deepEqual(after.panels,before.panels,routeName+mode+' outer panels');assert.deepEqual(after.values,before.values,routeName+mode+' factual values and outer row/node boxes');assert.deepEqual(after.paths,before.paths,routeName+mode+' real edge/trend coordinates');assert.deepEqual(after.headers.map(({background,shadow,...rest}:any)=>rest),before.headers.map(({background,shadow,...rest}:any)=>rest),'header facts/geometry');assert.equal(after.overflow,false);
  if(['light','compact','mobile'].includes(mode))assert.deepEqual(after,before,'Light/compact/mobile control remains exact');else if(routeName==='overview'){assert.deepEqual(after.shares.map((s:any)=>[s.value,s.inline]),before.shares.map((s:any)=>[s.value,s.inline]));assert.ok(after.shares[0].track[0]<before.shares[0].track[0]-20)}else if(routeName==='models')assert.ok(after.strokes.every((s:string)=>s==='1.25px'));
  assert.deepEqual(errors,[]);assert.deepEqual(forbidden,[]);let longNameProof:any=null,stickyProof:any=null;
  if(mode==='long') { const model=page.locator('.qp-map-column[data-dimension=model] .qp-map-node').filter({hasText:'Exact recorded model identity'});await model.focus();const fullName=await model.getAttribute('data-key');assert.ok(fullName?.includes('long-routing-component-'));assert.ok((await model.getAttribute('aria-label'))?.includes('long-routing-component-'));assert.equal(await model.evaluate(e=>document.activeElement===e),true);longNameProof={fullName,accessibleName:await model.getAttribute('aria-label'),title:await model.getAttribute('title')}; }
  if(routeName==='live'&&mode==='native') { stickyProof=await page.locator('.qp-live-table').evaluate(e=>{const node=e as HTMLElement;const oldMax=node.style.maxHeight;node.style.maxHeight='110px';node.scrollTop=80;const th=node.querySelector('th')!;const r=th.getBoundingClientRect(),parent=node.getBoundingClientRect();const result={scrollTop:node.scrollTop,headerTop:r.top,containerTop:parent.top,background:getComputedStyle(th).backgroundColor,position:getComputedStyle(th).position};node.scrollTop=0;node.style.maxHeight=oldMax;return result});assert.ok(stickyProof.scrollTop>0);assert.ok(Math.abs(stickyProof.headerTop-stickyProof.containerTop)<2);assert.equal(stickyProof.position,'sticky');assert.equal(stickyProof.background,'rgb(10, 22, 42)'); }
  cases.push({routeName,mode,width,height,before,after,longNameProof,stickyProof,errors,forbidden});await page.close();db.exec('ROLLBACK TO visual_case; RELEASE visual_case');
 }
 writeFileSync(resolve(output,'verification.json'),JSON.stringify({applicationIndex,visualMode,trialCssSha256:sha(Buffer.from(trialCss)),fixture:'Actual memory DB API; synthetic facts. Source-directed paint comparison, not complete original visual acceptance.',cases},null,2));console.log('Source91 visual factual/outer geometry/control checks passed.');
}finally{await browser?.close();await daemon.close();db.close();globalThis.Date=realDate;process.env.TZ=priorTimezone;}
