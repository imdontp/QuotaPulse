/** Windows portable reader opt-in. Only an owned fake home/log/profile is touched. */
import assert from 'node:assert/strict';
import { appendFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { dirname, join, resolve, sep } from 'node:path';
import { spawnSync } from 'node:child_process';
import { request as httpRequest } from 'node:http';
import { fileURLToPath } from 'node:url';
import { chromium, type Browser } from 'playwright';

assert.equal(process.platform,'win32','PowerShell review launcher check requires Windows');
const root=fileURLToPath(new URL('..',import.meta.url)),sha=(bytes:Buffer)=>createHash('sha256').update(bytes).digest('hex');
const built=JSON.parse(readFileSync(resolve(root,'screens/tray-recovery/bundle-build.json'),'utf8'));
const bundle=realpathSync(process.env.QP_REVIEW_READERS_BUNDLE??built.bundle),data=join(bundle,'review-data');
const ownedBuild=bundle.toLowerCase().startsWith((resolve(root,'tmp/review-bundles')+sep).toLowerCase());
const ownedExtraction=dirname(bundle)===realpathSync.native(tmpdir())&&/^QuotaPulse-review-[a-zA-Z0-9]+$/.test(bundle.slice(dirname(bundle).length+1));
assert.ok(ownedBuild||ownedExtraction,'Only a generated review bundle or fresh owned ZIP extraction may be checked');
assert.equal(existsSync(data),false,'Only a fresh unused review bundle may be tested');
const scriptHash=(file:string)=>sha(Buffer.from(readFileSync(file,'utf8').replaceAll('\r\n','\n')));
assert.equal(scriptHash(join(bundle,'scripts/start-review.ps1')),scriptHash(join(root,'scripts/start-review.ps1')));
const output=resolve(root,'screens/review-readers');mkdirSync(output,{recursive:true});
const fixture=mkdtempSync(join(realpathSync.native(tmpdir()),'qp-readers-')),fakeHome=join(fixture,'home'),local=join(fakeHome,'AppData/Local');
mkdirSync(local,{recursive:true});const sourceDir=join(fakeHome,'.codex/sessions/2026/10/25');mkdirSync(sourceDir,{recursive:true});
const log=join(sourceDir,'rollout-2026-10-25-reader-qa.jsonl'),sentinel=join(local,'quotapulse/usage.db');mkdirSync(dirname(sentinel),{recursive:true});writeFileSync(sentinel,'owned original-profile sentinel; never import');
const originalHash=sha(readFileSync(sentinel)),now=Date.now();
const event=(ordinal:number,input:number,output:number)=>({timestamp:new Date(now+ordinal).toISOString(),ordinal,type:'event_msg',payload:{type:'token_count',info:{last_token_usage:{input_tokens:input,cached_input_tokens:0,output_tokens:output,total_tokens:input+output}}}});
writeFileSync(log,[{timestamp:new Date(now).toISOString(),type:'session_meta',payload:{id:'reader-qa-session',cwd:'C:/qa/reader-project'}},{timestamp:new Date(now+1).toISOString(),type:'turn_context',payload:{model:'Reader QA model',effort:'high'}},{timestamp:new Date(now+2).toISOString(),type:'response_item',payload:{role:'user',content:'reader-qa-private-prompt-sentinel'}},event(10,100,50)].map(row=>JSON.stringify(row)).join('\n')+'\n');
let expectedLogHash=sha(readFileSync(log));
const env={...process.env,USERPROFILE:fakeHome,APPDATA:join(fakeHome,'AppData/Roaming'),LOCALAPPDATA:local,CLAUDE_CONFIG_DIR:join(fakeHome,'.claude-absent'),QUOTAPULSE_CLAUDE_QUOTA:'off',QUOTAPULSE_HERMES_ACCOUNT_QUOTA:'off',QUOTAPULSE_OPENCODE_GO_QUOTA:'off',ELECTRON_RUN_AS_NODE:undefined};
const homeProbe=spawnSync(process.execPath,['-p',"require('node:os').homedir()"],{env,encoding:'utf8',windowsHide:true});assert.equal(homeProbe.status,0);assert.equal(resolve(homeProbe.stdout.trim()),fakeHome,'Refuse to launch readers outside the owned fake home');
writeFileSync(join(fixture,'fixture.json'),JSON.stringify({mode:'owned-review-reader-check',bundle,fakeHome,sourceLog:log})+'\n');
const ps=join(process.env.WINDIR!,'System32/WindowsPowerShell/v1.0/powershell.exe'),port=7823,base=`http://127.0.0.1:${port}`,checks:string[]=[];
let browser:Browser|undefined,success=false,failure:string|undefined;
function script(name:string,args:string[]=[],readers='off') {
 const result=spawnSync(ps,['-NoProfile','-NonInteractive','-File',join(bundle,'scripts',name),...args],{env:{...env,QUOTAPULSE_READERS:readers},encoding:'utf8',timeout:350000,windowsHide:true});
 assert.equal(result.status,0,result.stderr+result.stdout);return result.stdout;
}
function state(){return JSON.parse(readFileSync(join(data,'review-processes.json'),'utf8'))}
async function api(path:string,method='GET'){
 const lock=JSON.parse(readFileSync(join(data,'daemon.lock'),'utf8'));assert.equal(lock.port,port);
 // Synchronous PowerShell restarts block close-event delivery to this Node process.
 // Use a new connection for each lifecycle assertion, rather than a stale pooled socket.
 return new Promise<any>((resolve,reject)=>{const req=httpRequest(base+path,{method,agent:false,headers:{'x-quotapulse-token':lock.token}},response=>{const chunks:Buffer[]=[];response.on('data',chunk=>chunks.push(Buffer.from(chunk)));response.on('error',reject);response.on('end',()=>{try{assert.equal(response.statusCode,200,path);resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')))}catch(error){reject(error)}})});req.on('error',reject);req.setTimeout(10000,()=>req.destroy(new Error('Owned API request timed out')));req.end()});
}
async function usage(total:number){const value=await api('/api/usage-events?from=0&to='+(Date.now()+60000)+'&limit=50');assert.equal(value.rows.reduce((sum:number,row:any)=>sum+row.total_tokens,0),total);assert.ok(!JSON.stringify(value).includes('reader-qa-private-prompt-sentinel'));if(total>0){const models=await api('/api/models?from=0&to='+(Date.now()+60000)+'&detailed=1&breakdown=0');assert.equal(models.totals.sessions,1,'one recorded session must remain one across incremental passes');assert.equal(models.groups[0].sessions,1)}return value.rows.length}
function preserved(){assert.equal(sha(readFileSync(log)),expectedLogHash);assert.equal(sha(readFileSync(sentinel)),originalHash)}
try{
 for(const args of [[],['-EnableReaders']]){script('start-review.ps1',['-Port',String(port),...args,'-WhatIf'],'on');assert.equal(existsSync(data),false)}checks.push('both launch modes WhatIf create no profile/process state');
 script('start-review.ps1',['-Port',String(port)],'on');assert.equal(state().readersEnabled,false);assert.deepEqual((await api('/api/health')).scheduler.sources,[]);await usage(0);script('stop-review.ps1');preserved();checks.push('default launch disables readers despite inherited on and leaves harness/original sentinels unchanged');
 script('start-review.ps1',['-Port',String(port),'-EnableReaders'],'off');assert.equal(state().readersEnabled,true);
 const health=await api('/api/health');assert.ok(health.scheduler.sources.some((source:any)=>source.harness==='codex'));for(const source of health.scheduler.sources)assert.ok(resolve(source.rootPath).startsWith(fakeHome+sep)||resolve(source.rootPath).startsWith(data+sep));
 assert.equal(await usage(150),1);preserved();checks.push('explicit opt-in overrides inherited off and actual Codex adapter ingests150 tokens from owned home');
 browser=await chromium.launch({channel:'chrome',headless:true});const page=await browser.newPage({viewport:{width:1672,height:941},reducedMotion:'reduce'}),errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 const lock=JSON.parse(readFileSync(join(data,'daemon.lock'),'utf8'));await page.addInitScript(token=>{(window as any).__QUOTAPULSE_TOKEN__=token;localStorage.setItem('quotapulse-prefs',JSON.stringify({lang:'en',currency:'USD',rate:1,hiddenSubscriptions:[]}));localStorage.setItem('quotapulse-theme','dark')},lock.token);
 await page.goto(base+'/#models?range=all');await page.locator('.qp-model-detail h3').filter({hasText:'Reader QA model'}).waitFor();assert.equal(await page.locator('.qp-model-summary article').nth(1).locator('strong').innerText(),'150');await page.screenshot({path:join(output,'reader-ingested.png'),animations:'disabled'});
 appendFileSync(log,JSON.stringify(event(20,25,15))+'\n');expectedLogHash=sha(readFileSync(log));await api('/api/refresh','POST');assert.equal(await usage(190),2);await api('/api/refresh','POST');assert.equal(await usage(190),2);preserved();
 await page.reload();await page.locator('.qp-model-detail h3').filter({hasText:'Reader QA model'}).waitFor();assert.equal(await page.locator('.qp-model-summary article').nth(1).locator('strong').innerText(),'190');assert.equal(await page.locator('.qp-model-summary article').nth(2).locator('strong').innerText(),'1');assert.deepEqual(errors,[]);await page.screenshot({path:join(output,'reader-incremental.png'),animations:'disabled'});await browser.close();browser=undefined;checks.push('incremental append and repeated manual refresh retain exactly190 tokens and one session; real Models page matches API and excludes prompt content');
 script('stop-review.ps1');script('start-review.ps1',['-Port',String(port),'-EnableReaders'],'off');assert.equal(await usage(190),2);script('stop-review.ps1');checks.push('reader-enabled restart preserves cursor and does not duplicate events');
 script('start-review.ps1',['-Port',String(port)],'on');assert.equal(state().readersEnabled,false);assert.deepEqual((await api('/api/health')).scheduler.sources,[]);assert.equal(await usage(190),2);script('stop-review.ps1');preserved();checks.push('default restart disables collection and retains already collected review data');success=true;
}catch(error){failure=String(error);throw error}finally{
 await browser?.close();if(existsSync(join(data,'review-processes.json')))script('stop-review.ps1');
 writeFileSync(join(output,'verification.json'),JSON.stringify({status:success?'passed':'failed',fixture,bundle,sourceLogHash:expectedLogHash,originalSentinelHash:originalHash,productionIndexSha256:sha(readFileSync(join(bundle,'packages/web/dist/index.html'))),checks,failure,limitations:['owned synthetic log and fake home; no customer data or credentials accessed','account quota probes disabled for this check','portable launcher only; installed wrapper opt-in is not exercised']},null,2)+'\n');
}console.log(`Review reader opt-in passed: ${checks.length} checks.`);
