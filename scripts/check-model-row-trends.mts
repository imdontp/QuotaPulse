/** Real exact-pair trends, bounded comparison pages and accepted-data SSE behavior. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, type Page } from 'playwright';
import { openDb } from '../packages/daemon/src/db/index.js';
import { buildServer } from '../packages/daemon/src/api/server.js';
import { Scheduler } from '../packages/daemon/src/ingest/scheduler.js';
import { en } from '../packages/web/src/i18n/en.js';
import { th } from '../packages/web/src/i18n/th.js';

const root=fileURLToPath(new URL('..',import.meta.url));
const output=resolve(root,'screens/model-row-trends');mkdirSync(output,{recursive:true});rmSync(resolve(output,'verification.json'),{force:true});
const db=openDb(':memory:');const now=Date.now(),to=now+60_000,from=to-30*60_000;
db.prepare('INSERT INTO source(id,harness,profile,root_path,display_name,detected_at) VALUES(1,?,?,?,?,?)').run('codex','synthetic','/synthetic/nonexistent','Synthetic only',now);
db.prepare('INSERT INTO session(id,source_id,native_session_id,project,last_seen_at) VALUES(1,1,?,?,?)').run('row-trends-synthetic','Synthetic only',now);
const insert=db.prepare('INSERT INTO usage_event(source_id,session_id,dedup_key,ts,model,provider,total_tokens,input_tokens,output_tokens,call_count,cost_source) VALUES(1,1,?,?,?,?,?,0,0,1,?)');
let serial=0;const add=(model:string|null,provider:string|null,tokens:number,at=now-60_000)=>insert.run('row-'+serial++,at,model,provider,tokens,'unknown');
const seed=()=>db.transaction(()=>{db.prepare('DELETE FROM usage_event').run();for(let i=1;i<=21;i++)for(let j=0;j<3;j++)add('model-'+String(i).padStart(2,'0'),'anthropic',i*100+j,from+(2+j*10)*60_000);for(const [model,provider] of [[null,'anthropic'],['','anthropic'],['identity',null],['identity','']] as const)add(model,provider,1);})();
seed();const scheduler=new Scheduler(db,[],{pollMs:1_000_000,detectMs:1_000_000});const server=buildServer(db,scheduler,{token:'row-trends-synthetic',port:7816,webRoot:resolve(root,'packages/web/dist')});
const errors:string[]=[],forbidden:string[]=[],cases:any[]=[];let browser:Awaited<ReturnType<typeof chromium.launch>>|undefined;
let activePage:Page|undefined;let releaseHeldGlobal:(()=>void)|undefined;
const deadline=<T>(promise:Promise<T>,label:string)=>Promise.race([promise,new Promise<never>((_,reject)=>{const timer=setTimeout(()=>reject(new Error(label+' timeout')),20_000);timer.unref()})]);
const pairKey=JSON.stringify(['model-01','anthropic']);
const rows=(page:Page)=>page.locator('.qp-model-table-wrap tbody tr[data-model-pair-key]');
const totalFor=(page:Page,key:string)=>page.locator('tr[data-model-pair-key]').evaluateAll((elements,key)=>[...((elements.find(e=>e.getAttribute('data-model-pair-key')===key))?.querySelectorAll('.qp-model-row-trend circle[data-value]')??[])].reduce((sum,e)=>sum+Number(e.getAttribute('data-value')),0),key);
const waitTotal=(page:Page,key:string,total:number)=>page.waitForFunction(({key,total})=>[...(document.querySelector(`tr[data-model-pair-key='${key}']`)?.querySelectorAll('.qp-model-row-trend circle[data-value]')??[])].reduce((sum,e)=>sum+Number(e.getAttribute('data-value')),0)===total,{key,total});
try{
 await server.listen({host:'127.0.0.1',port:7816});browser=await chromium.launch({channel:'chrome',headless:true,args:['--disable-gpu','--force-color-profile=srgb']});
 for(const theme of ['dark','light'] as const)for(const lang of ['en','th'] as const)for(const width of [1672,390]){
  seed();const t=lang==='en'?en:th;const page=await browser.newPage({viewport:{width,height:941},reducedMotion:'reduce',timezoneId:'Asia/Bangkok'});page.setDefaultTimeout(20_000);activePage=page;
  const requests:any[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',request=>{const url=new URL(request.url());if(url.pathname==='/api/model-trends'){let pairs:unknown;try{pairs=request.method()==='POST'?request.postDataJSON().pairs:JSON.parse(url.searchParams.get('pairs')??'null')}catch{pairs=null}requests.push({method:request.method(),pairs,from:url.searchParams.get('from'),to:url.searchParams.get('to')});}});
  await page.route('**/*',route=>{const req=route.request(),url=new URL(req.url());if(url.origin!=='http://127.0.0.1:7816'||url.pathname.startsWith('/api/')&&req.method()!=='GET'&&!(req.method()==='POST'&&url.pathname==='/api/model-trends')){forbidden.push(req.method()+' '+url.pathname);return route.abort()}return route.continue()});
  let mode:'pass'|'hold'|'fail'|'missing'='pass';let release:(()=>void)|undefined,accepted:(()=>void)|undefined,delivered:(()=>void)|undefined;
  let heldBody:Buffer|undefined;let intercepted:Promise<void>|undefined,heldDelivered:Promise<void>|undefined;
  await page.route('**/api/model-trends?*',async route=>{
   const current=mode;if(current==='hold'){
    mode='pass';const response=await route.fetch();heldBody=await response.body();accepted?.();await new Promise<void>(resolve=>{release=resolve;releaseHeldGlobal=resolve});await route.fulfill({response,body:heldBody});delivered?.();
   }else if(current==='fail'||current==='missing'){mode='pass';await route.fulfill({status:current==='missing'?404:503,contentType:'application/json',body:'{"error":"Synthetic trend failure"}'});}else await route.continue();
  });
  await page.addInitScript(({lang,theme})=>{(window as any).__QUOTAPULSE_TOKEN__='row-trends-synthetic';localStorage.setItem('quotapulse-prefs',JSON.stringify({lang,currency:'USD',rate:1,hiddenSubscriptions:[]}));localStorage.setItem('quotapulse-theme',theme)},{lang,theme});await page.clock.setFixedTime(now);
  await page.goto(`http://127.0.0.1:7816/#models?range=custom&from=${from}&to=${to}&model=model-01&selected_provider=anthropic`);
  const nav=page.getByTestId('model-comparison-pagination');await nav.waitFor();await waitTotal(page,pairKey,303);assert.equal(await rows(page).count(),5,'Deep link reveals selected pair on page2');
  assert.equal(await page.locator('tr[data-selected=true]').getAttribute('data-model-pair-key'),pairKey);
  const next=nav.getByRole('button',{name:t['history.next'],exact:true}),previous=nav.getByRole('button',{name:t['history.previous'],exact:true});assert.equal(await next.isDisabled(),true);
  const visibleKeys=await rows(page).evaluateAll(es=>es.map(e=>JSON.parse(e.getAttribute('data-model-pair-key')!)));assert.deepEqual(new Set(visibleKeys.map(v=>JSON.stringify(v))),new Set([['model-01','anthropic'],[null,'anthropic'],['','anthropic'],['identity',null],['identity','']].map(v=>JSON.stringify(v))));
  for(const key of visibleKeys){const expected=db.prepare('SELECT SUM(total_tokens) AS n FROM usage_event WHERE model IS ? AND provider IS ?').get(...key) as {n:number};await waitTotal(page,JSON.stringify(key),expected.n);}
  await previous.focus();await page.keyboard.press('Enter');await page.waitForFunction(()=>document.querySelectorAll('.qp-model-table-wrap tbody tr[data-model-pair-key]').length===20);await page.locator('.qp-model-row-trend').first().waitFor();assert.equal(await previous.isDisabled(),true);
  const retainedTitle=await page.locator('.qp-model-detail h3').innerText();assert.equal(retainedTitle,'model-01','Manual page preserves selected detail');
  await next.focus();await page.keyboard.press('Enter');await waitTotal(page,pairKey,303);assert.equal(await rows(page).count(),5);
  const navFits=await nav.evaluate(e=>e.getBoundingClientRect().right<=innerWidth+1&&e.scrollWidth<=e.clientWidth+1);assert.equal(navFits,true);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  const nativeFit=await page.locator('.qp-model-table-wrap').evaluate(e=>({client:e.clientWidth,scroll:e.scrollWidth}));if(width===1672)assert.ok(nativeFit.scroll<=nativeFit.client+1,'Native Trend must fit with all factual columns visible: '+JSON.stringify(nativeFit));
  let race=false,retry=false,large=false,missing=false;
  mode='missing';scheduler.emit('data',{newEvents:0,newLimits:0,trigger:'synthetic-missing-endpoint'});const missingRetry=page.locator('.qp-model-row-trend-error button');await missingRetry.waitFor();assert.equal(await totalFor(page,pairKey),303,'404 preserves accepted same-key snapshot');const retryRequestCount=requests.length;await missingRetry.focus();await page.keyboard.press('Enter');await missingRetry.waitFor({state:'hidden'});await waitTotal(page,pairKey,303);assert.equal(requests.length,retryRequestCount+1,'Keyboard retry uses one batch request');missing=true;
  if(theme==='dark'&&lang==='en'&&width===1672){
   intercepted=new Promise<void>(resolve=>{accepted=resolve});heldDelivered=new Promise<void>(resolve=>{delivered=resolve});mode='hold';add('model-01','anthropic',1);scheduler.emit('data',{newEvents:1,newLimits:0,trigger:'synthetic-held-trends'});await deadline(intercepted!,'same-scope batch refresh');assert.equal(await totalFor(page,pairKey),303,'Retained same-key trend while real read held');
   add('model-01','anthropic',1);scheduler.emit('data',{newEvents:1,newLimits:0,trigger:'synthetic-newer-trends'});await waitTotal(page,pairKey,305);
   const oldResponse=page.waitForResponse(async response=>{if(new URL(response.url()).pathname!=='/api/model-trends')return false;try{const body=await response.json();return body.pairs?.some((p:any)=>JSON.stringify([p.model,p.provider])===pairKey&&p.points.reduce((n:number,v:any)=>n+v.tokens,0)===304)}catch{return false}});
   release!();await deadline(heldDelivered!,'held batch delivery');assert.equal(await(await oldResponse).finished(),null);await page.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve()))));assert.equal(await totalFor(page,pairKey),305,'Completed older response cannot overwrite newer trend');race=true;
   mode='fail';add('model-01','anthropic',1);scheduler.emit('data',{newEvents:1,newLimits:0,trigger:'synthetic-trend-error'});const retryButton=page.locator('.qp-model-row-trend-error button');await retryButton.waitFor();assert.equal(await totalFor(page,pairKey),305);await retryButton.focus();await page.keyboard.press('Enter');await waitTotal(page,pairKey,306);retry=true;
   db.transaction(()=>{for(let i=0;i<1240;i++)add('large-'+String(i).padStart(4,'0'),'anthropic',100_000+i)})();scheduler.emit('data',{newEvents:1240,newLimits:0,trigger:'synthetic-many-models'});await page.waitForFunction(()=>document.querySelector('.qp-model-summary article:first-child strong')?.textContent?.replaceAll(',','')==='1265');await page.waitForFunction(()=>document.querySelectorAll('.qp-model-table-wrap tbody tr[data-model-pair-key]').length===20);await page.locator('.qp-model-row-trend').first().waitFor();assert.ok(requests.every(r=>r.pairs.length<=20));assert.equal(await page.locator('.qp-model-detail h3').innerText(),'model-01');assert.equal(await page.locator('.qp-model-row-trend circle').count()<=600,true);const largeFit=await page.locator('.qp-model-table-wrap').evaluate(e=>({client:e.clientWidth,scroll:e.scrollWidth}));assert.ok(largeFit.scroll<=largeFit.client+1,'Twenty large rows fit native width: '+JSON.stringify(largeFit));large=true;
  }
  assert.ok(requests.every(r=>Array.isArray(r.pairs)&&r.pairs.length>0&&r.pairs.length<=20));
  await page.screenshot({path:resolve(output,`${lang}-${theme}-${width}.png`),animations:'disabled'});cases.push({lang,theme,width,deepLinkSecondPage:true,exactNullEmptyIdentities:true,keyboardPages:true,selectedDetailRetained:true,race,retry,missingEndpointRetainsSnapshot:missing,large1265:large,renderedRows:await rows(page).count(),domElements:await page.locator('*').count(),requests,nativeFit,navFits});await page.close();
 }
 assert.deepEqual(errors,[]);assert.deepEqual(forbidden,[]);writeFileSync(resolve(output,'verification.json'),JSON.stringify({productionIndexSha256:createHash('sha256').update(readFileSync(resolve(root,'packages/web/dist/index.html'))).digest('hex'),browser:browser.version(),fixture:'Synthetic memory DB, real scoped API/SSE. Only held earlier response,404 and503 deliberately intercepted; no user data/readers.',cases,errors,forbidden},null,2));console.log('Models exact row trends, bounded pages, deep links, SSE race and retry passed.');
}catch(error){if(activePage&&!activePage.isClosed()){await activePage.screenshot({path:resolve(output,'failure.png'),animations:'disabled'}).catch(()=>{});writeFileSync(resolve(output,'failure.json'),JSON.stringify({error:String((error as Error)?.stack??error),cases,rows:await rows(activePage).count(),pageText:await activePage.locator('main').innerText().catch(()=>null)},null,2))}throw error;}finally{releaseHeldGlobal?.();await browser?.close();await server.close();db.close()}
