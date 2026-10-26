/** Real compiled dashboard + HTTP + owned in-memory scope data. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, type Page } from 'playwright';
import { setTimeout as delay } from 'node:timers/promises';
import { openDb } from '../packages/daemon/src/db/index.js';
import { buildServer } from '../packages/daemon/src/api/server.js';
import { Scheduler } from '../packages/daemon/src/ingest/scheduler.js';
import { en } from '../packages/web/src/i18n/en.js';
import { th } from '../packages/web/src/i18n/th.js';
const root=fileURLToPath(new URL('..',import.meta.url)),output=resolve(root,'screens/history-range-picker');mkdirSync(output,{recursive:true});
const db=openDb(':memory:'),now=Date.now(),from=now-7200000,to=now;
db.exec(`INSERT INTO source(id,harness,profile,root_path,display_name,detected_at) VALUES(1,'codex','test','/synthetic/nonexistent','Range source A',0),(2,'claude-code','test','/synthetic/nonexistent','Range source B',0);
 INSERT INTO session(id,source_id,native_session_id,project) VALUES(1,1,'range-session-a','Range project'),(2,2,'range-session-b','Other project');`);
const insert=db.prepare(`INSERT INTO usage_event(source_id,session_id,dedup_key,ts,model,provider,input_tokens,total_tokens,call_count) VALUES(?,?,?,?, 'range-model','openai',?,?,1)`);
insert.run(1,1,'a',now-30000,150,150);insert.run(1,1,'b',now-90000,1,1);insert.run(2,2,'c',now-60000,70,70);
const app=buildServer(db,new Scheduler(db,[]),{token:'range-picker-test',port:7829,webRoot:resolve(root,'packages/web/dist')});
const base='http://127.0.0.1:7829',initial=`#history?range=custom&from=${from}&to=${to}&source=1&session_id=1`;
let browser:Awaited<ReturnType<typeof chromium.launch>>|undefined,current:Page|undefined;
const cases:object[]=[],errors:string[]=[];
function deferred(){let resolve!:()=>void;const promise=new Promise<void>(done=>resolve=done);return{promise,resolve}}
try{
 await app.listen({host:'127.0.0.1',port:7829});browser=await chromium.launch({channel:'chrome',headless:true});
 for(const lang of ['en','th'])for(const theme of ['dark','light'])for(const width of [390,900,1280,1672]){
  const context=await browser.newContext({viewport:{width,height:941},timezoneId:'Asia/Bangkok',reducedMotion:'reduce'}),page=await context.newPage(),name=`${lang}-${theme}-${width}`,messages=lang==='en'?en:th;current=page;
  page.on('pageerror',error=>errors.push(error.message));await page.route('**/*',route=>new URL(route.request().url()).origin===base?route.continue():route.abort());
  await page.addInitScript(({lang,theme})=>{(window as any).__QUOTAPULSE_TOKEN__='range-picker-test';localStorage.setItem('quotapulse-prefs',JSON.stringify({lang,currency:'USD',rate:1,hiddenSubscriptions:[]}));localStorage.setItem('quotapulse-theme',theme)},{lang,theme});
  const response=(predicate:(url:URL)=>boolean=()=>true)=>page.waitForResponse(r=>{const url=new URL(r.url());return url.pathname==='/api/history-summary'&&predicate(url)&&r.ok()});
  const firstReady=response();await page.goto(base+'/'+initial);const first=await(await firstReady).json();assert.equal(first.scope.from,from);assert.equal(first.scope.to,to);assert.equal(first.scope.sourceId,1);assert.equal(first.scope.sessionId,1);assert.equal(first.totals.tokens,151);
  const picker=page.locator('.qp-history-range-picker'),summary=picker.locator('summary'),panel=picker.locator('[role=dialog]');await summary.waitFor();
  assert.equal(await picker.getAttribute('open'),null);assert.equal(await panel.isVisible(),false);assert.ok(!(await summary.innerText()).includes(messages['usage.custom']));assert.match((await summary.getAttribute('title'))!,/20\d\d|25\d\d/);
  await page.waitForFunction(()=>document.querySelector('.qp-history-range-source')?.textContent?.includes('Range source A'));
  for (const button of await page.locator('.qp-history-view-actions button').all()) assert.equal((await button.boundingBox())?.height,35,'History action height must survive shared picker import order');
  const originalUrl=page.url();await summary.focus();await page.keyboard.press('Enter');await panel.waitFor();await page.waitForFunction(()=>document.querySelector('.qp-history-range-picker>summary')?.getAttribute('aria-expanded')==='true');assert.equal(page.url(),originalUrl);
  const controls=panel.locator('select');assert.equal(await controls.count(),2);await page.keyboard.press('Tab');assert.equal(await controls.first().evaluate(node=>node===document.activeElement),true);
  await page.keyboard.press('Escape');assert.equal(await picker.getAttribute('open'),null);assert.equal(await summary.evaluate(node=>node===document.activeElement),true);
  await summary.click();await panel.waitFor();const bounds=await panel.boundingBox();assert.ok(bounds&&bounds.x>=0&&bounds.x+bounds.width<=width+.5,name+' popover containment '+JSON.stringify(bounds));assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.evaluate(()=>document.fonts.ready);await page.screenshot({path:resolve(output,name+'-open.png'),animations:'disabled'});
  const last30Ready=response(url=>Number(url.searchParams.get('from'))<now-20*86400000);await controls.first().selectOption('last30');const last30=await(await last30Ready).json();assert.equal(last30.scope.sourceId,1);assert.equal(last30.scope.sessionId,1);assert.equal(last30.totals.tokens,151);assert.equal(await picker.getAttribute('open'),'');
  const source2Ready=response(url=>url.searchParams.get('source_id')==='2');await controls.last().selectOption('2');const source2=await(await source2Ready).json();assert.equal(source2.scope.sourceId,2);assert.equal(source2.scope.sessionId,1);assert.equal(source2.totals.records,0);assert.ok((await page.locator('.qp-history-range-source').innerText()).includes('Range source B'));
  const clearedReady=response(url=>!url.searchParams.has('source_id'));await controls.last().selectOption('');const cleared=await(await clearedReady).json();assert.equal(cleared.scope.sessionId,1);assert.equal(cleared.totals.tokens,151);assert.equal(await page.locator('.qp-history-range-source').count(),0);
  await page.keyboard.press('Escape');await summary.click();await controls.last().focus();await page.keyboard.press('Tab');assert.equal(await picker.getAttribute('open'),null,'Tab may leave the nonmodal picker');
  await summary.click();await page.locator('.qp-history-filter-search input').click();assert.equal(await picker.getAttribute('open'),null);assert.equal(await page.locator('.qp-history-filter-search input').evaluate(node=>node===document.activeElement),true);
  const entered=deferred(),release=deferred();let held=false;
  const heldHandler=async(route:any)=>{const url=new URL(route.request().url());if(!held&&Number(url.searchParams.get('from'))>now-2*86400000){held=true;entered.resolve();await release.promise;}await route.continue();};
  await page.route('**/api/history-summary?**',heldHandler);
  try{
   await summary.click();const todayReady=response(url=>Number(url.searchParams.get('from'))>now-2*86400000);await controls.first().selectOption('today');await Promise.race([entered.promise,delay(10000,undefined,{ref:false}).then(()=>{throw Error('Expected pending Today summary request was not held')})]);
   assert.equal((await summary.innerText()).trim(),messages['usage.today'],'pending range must not display the previous resolved dates');release.resolve();const today=await(await todayReady).json();assert.equal(today.scope.sessionId,1);assert.equal(today.totals.tokens,151);
   await page.waitForFunction(text=>document.querySelector('.qp-history-range-picker>summary')?.textContent?.trim()!==text,messages['usage.today']);
  }finally{release.resolve();await page.unroute('**/api/history-summary?**',heldHandler);}
  const pausedTitle=await summary.getAttribute('title'),pausedScope=await page.getByTestId('history-timeline').getAttribute('data-scope');const pause=page.locator('.qp-history-view-actions button').first();await pause.click();assert.equal(await summary.getAttribute('aria-disabled'),'true');await summary.click({force:true});assert.equal(await picker.getAttribute('open'),null);assert.equal(await controls.first().isDisabled(),true);
  await page.evaluate(hash=>{location.hash=hash},`#history?range=custom&from=0&to=${to}&source=2&session_id=1`);await page.waitForFunction(()=>(document.querySelector('.qp-history-range-popover select') as HTMLSelectElement|null)?.value==='custom');assert.equal(await summary.getAttribute('title'),pausedTitle,'paused capsule must describe the retained snapshot');assert.equal(await page.locator('.qp-history-range-source').count(),0);assert.equal(await page.getByTestId('history-timeline').getAttribute('data-scope'),pausedScope);
  const resumed=response(url=>url.searchParams.get('source_id')==='2'&&url.searchParams.get('from')==='0');await pause.click();const resumedData=await(await resumed).json();assert.equal(resumedData.scope.sessionId,1);assert.equal(resumedData.totals.records,0);
  cases.push({name,customScope:first.scope,keyboardOpenEscape:true,tabLeaves:true,outsideDismiss:true,popoverContained:true,sourceAndSessionPreserved:true,pendingRangeTruthful:true,pauseBlocks:true,pausedSnapshotLabel:true});await context.close();current=undefined;
 }
 const legacy=await browser.newPage();await legacy.goto(base+'/?mode=legacy'+initial);await legacy.getByTestId('usage-history').locator('input[type=date]').first().waitFor();assert.equal(await legacy.locator('.qp-history-range-picker').count(),0);assert.equal(await legacy.getByTestId('usage-history').locator('input[type=date]').count(),2);await legacy.close();
 assert.equal(cases.length,16);assert.deepEqual(errors,[]);writeFileSync(resolve(output,'verification.json'),JSON.stringify({productionIndexSha256:createHash('sha256').update(readFileSync(resolve(root,'packages/web/dist/index.html'))).digest('hex'),cases,legacyPreserved:true,errors},null,2)+'\n');console.log('PASS16 compiled History range-picker cases including keyboard, source/session, pending data and pause');
}catch(error){if(current&&!current.isClosed()){await current.screenshot({path:resolve(output,'failure.png'),animations:'disabled'}).catch(()=>{});writeFileSync(resolve(output,'failure.json'),JSON.stringify({url:current.url(),body:await current.locator('body').innerText(),error:String(error),completed:cases},null,2)+'\n');}throw error;
}finally{await browser?.close();await app.close();db.close();}
