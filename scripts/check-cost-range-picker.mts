/** Compiled Cost controls, real HTTP and owned SQLite fixture. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync,readFileSync,writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium,type Page } from 'playwright';
import { installBrowserFixedDate } from './browser-fixed-date.mjs';
import { openDb } from '../packages/daemon/src/db/index.js';
import { buildServer } from '../packages/daemon/src/api/server.js';
import { Scheduler } from '../packages/daemon/src/ingest/scheduler.js';
import { en } from '../packages/web/src/i18n/en.ts';
import { th } from '../packages/web/src/i18n/th.ts';
const root=fileURLToPath(new URL('..',import.meta.url)),output=resolve(root,'screens/cost-range-picker');mkdirSync(output,{recursive:true});
const now=Date.parse('2025-05-17T13:42:00Z'),RealDate=globalThis.Date;
globalThis.Date=new Proxy(RealDate,{construct:(target,args)=>Reflect.construct(target,args.length?args:[now]),apply:()=>new RealDate(now).toString(),get:(target,key,receiver)=>key==='now'?()=>now:Reflect.get(target,key,receiver)});
const db=openDb(':memory:');db.exec(`INSERT INTO source(id,harness,profile,root_path,display_name,detected_at) VALUES(1,'codex','qa','/synthetic/nonexistent','Cost A',0),(2,'claude-code','qa','/synthetic/nonexistent','Cost B',0);INSERT INTO session(id,source_id,native_session_id,project) VALUES(1,1,'cost-a','Cost project'),(2,2,'cost-b','Cost project')`);
const usage=db.prepare('INSERT INTO usage_event(source_id,session_id,dedup_key,ts,model,provider,total_tokens,call_count,cost_usd,cost_source) VALUES(?,?,?,?,?,?,?,1,?,?)');
usage.run(1,1,'native',now-30000,'A','openai',150,.25,'native');usage.run(1,1,'unknown',now-90000,'A','openai',1,null,'unknown');usage.run(2,2,'api',now-60000,'B','anthropic',70,.0123,'computed');
const app=buildServer(db,new Scheduler(db,[]),{token:'owned-cost-range',port:7835,webRoot:resolve(root,'packages/web/dist')}),base='http://127.0.0.1:7835';
function deferred(){let resolve!:()=>void;const promise=new Promise<void>(done=>resolve=done);return{promise,resolve}}
let browser:Awaited<ReturnType<typeof chromium.launch>>|undefined,current:Page|undefined;const cases:object[]=[],dstCases:object[]=[],errors:string[]=[];
async function contextPage(lang:string,theme:string,timezoneId='Asia/Bangkok',width=1672){
 const context=await browser!.newContext({viewport:{width,height:941},reducedMotion:'reduce',timezoneId,deviceScaleFactor:1}),page=await context.newPage();current=page;page.setDefaultTimeout(30000);page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(({lang,theme})=>{(window as any).__QUOTAPULSE_TOKEN__='owned-cost-range';localStorage.setItem('quotapulse-prefs',JSON.stringify({lang,currency:'USD',rate:1,hiddenSubscriptions:[]}));localStorage.setItem('quotapulse-theme',theme)},{lang,theme});await installBrowserFixedDate(page,now);return{context,page};
}
function response(page:Page,predicate:(url:URL)=>boolean){return page.waitForResponse(r=>new URL(r.url()).pathname==='/api/cost-analysis'&&r.ok()&&predicate(new URL(r.url())))}
try{
 await app.listen({host:'127.0.0.1',port:7835});browser=await chromium.launch({channel:'chrome',headless:true});
 for(const lang of ['en','th'] as const)for(const theme of ['dark','light'])for(const width of [390,900,1280,1672]){
  const name=`${lang}-${theme}-${width}`,messages=lang==='en'?en:th,{context,page}=await contextPage(lang,theme,'Asia/Bangkok',width);
  const from=now-120000,to=now,ready=response(page,url=>url.searchParams.get('from')===String(from));await page.goto(base+`/#cost?range=custom&from=${from}&to=${to}&source=1&basis=native&bucket=auto`);const first=await(await ready).json();assert.equal(first.scope.sourceId,1);assert.equal(first.scope.from,from);assert.equal(first.scope.to,to);assert.equal(first.basis,'native');assert.equal(first.totals.amount,.25);assert.equal(first.totals.allTokens,151);
  await page.locator('.qp-cost-summary .qp-cost-value').first().waitFor();
  const picker=page.locator('.qp-cost-toolbar .qp-history-range-picker'),summary=picker.locator('summary'),panel=page.locator('.qp-cost-range-controls');
  await summary.focus();await page.keyboard.press('Enter');await panel.waitFor();assert.equal(await summary.getAttribute('aria-expanded'),'true');
  const bounds=await page.locator('.qp-cost-toolbar .qp-history-range-popover').boundingBox();assert.ok(bounds&&bounds.x>=0&&bounds.x+bounds.width<=width);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  const period=panel.getByRole('combobox',{name:messages['redesign.projectRange'],exact:true}),basis=panel.getByRole('combobox',{name:messages['redesign.costBasis'],exact:true}),bucket=panel.getByRole('combobox',{name:messages['redesign.costBucket'],exact:true}),fields=panel.locator('input[type=date]');
  assert.equal(await period.inputValue(),'custom');assert.equal(await basis.inputValue(),'native');assert.equal(await bucket.inputValue(),'auto');assert.equal(await fields.nth(0).inputValue(),'2025-05-17');assert.equal(await fields.nth(1).inputValue(),'2025-05-17');
  await page.screenshot({path:resolve(output,name+'-open.png'),animations:'disabled'});
  const original=page.url();await fields.nth(1).fill('');assert.equal(page.url(),original);assert.equal(await fields.nth(1).inputValue(),'2025-05-17');
  const editedFrom=Date.parse('2025-05-16T00:00:00+07:00'),editedTo=Date.parse('2025-05-19T00:00:00+07:00');let pending=response(page,url=>url.searchParams.get('from')===String(editedFrom));await fields.first().fill('2025-05-16');let data=await(await pending).json();assert.equal(data.scope.to,to);assert.equal(data.scope.sourceId,1);assert.equal(data.totals.amount,.25);
  pending=response(page,url=>url.searchParams.get('to')===String(editedTo));await fields.nth(1).fill('2025-05-18');data=await(await pending).json();assert.equal(data.scope.from,editedFrom);assert.equal(data.scope.to,editedTo);assert.equal(data.totals.allTokens,151);
  await page.keyboard.press('Escape');assert.equal(await picker.getAttribute('open'),null);assert.equal(await summary.evaluate(node=>node===document.activeElement),true);await summary.click();
  pending=response(page,url=>url.searchParams.get('basis')==='api');await basis.selectOption('api');data=await(await pending).json();assert.equal(data.totals.amount,0);assert.equal(data.totals.pricedCalls,0);assert.equal(data.totals.allTokens,151);assert.equal(data.scope.sourceId,1);
  pending=response(page,url=>url.searchParams.get('basis')==='native');await basis.selectOption('native');data=await(await pending).json();assert.equal(data.totals.amount,.25);
  pending=response(page,url=>url.searchParams.get('bucket')==='hour');await bucket.selectOption('hour');data=await(await pending).json();assert.equal(data.bucketMs,3600000);assert.equal(data.scope.from,editedFrom);assert.equal(data.scope.to,editedTo);
  pending=response(page,url=>url.searchParams.get('bucket')==='auto');await bucket.selectOption('auto');await pending;
  pending=response(page,url=>url.searchParams.get('from')==='0');await period.selectOption('all');await pending;assert.equal((await summary.innerText()).trim(),messages['usage.allTime']);
  await period.selectOption('custom');await fields.first().waitFor();assert.equal(new URLSearchParams(new URL(page.url()).hash.split('?')[1]).get('from'),'0');
  const today=Date.parse('2025-05-17T00:00:00+07:00'),entered=deferred(),release=deferred();let held=false;
  const handler=async(route:any)=>{if(!held&&new URL(route.request().url()).searchParams.get('from')===String(today)){held=true;entered.resolve();await release.promise;}await route.continue();};await page.route('**/api/cost-analysis?**',handler);
  try{
   pending=response(page,url=>url.searchParams.get('from')===String(today));await period.selectOption('today');await Promise.race([entered.promise,delay(10000,undefined,{ref:false}).then(()=>{throw Error('Pending Today request was not held')})]);assert.equal((await summary.innerText()).trim(),messages['usage.today']);release.resolve();data=await(await pending).json();assert.equal(data.scope.sourceId,1);assert.equal(data.totals.amount,.25);
  }finally{release.resolve();await page.unroute('**/api/cost-analysis?**',handler);}
  await page.waitForFunction(label=>document.querySelector('.qp-cost-toolbar summary')?.textContent?.trim()!==label,messages['usage.today']);
  await period.selectOption('custom');await fields.first().waitFor();assert.equal(new URLSearchParams(new URL(page.url()).hash.split('?')[1]).get('from'),String(today),'Custom must seed the current preset bounds, not stale epoch bounds');
  await bucket.focus();await page.keyboard.press('Tab');assert.equal(await picker.getAttribute('open'),null);await summary.click();await page.locator('.qp-cost-heading h1').click();assert.equal(await picker.getAttribute('open'),null);
  cases.push({name,initialScope:first.scope,exactNativeAmount:.25,sourcePreserved:true,clearedEndIgnored:true,inclusiveDateEdits:true,basesSeparated:true,bucketPreserved:true,pendingCaptionTruthful:true,customSeedsCurrentScope:true,keyboard:true,outsideAndTabDismiss:true,popoverContained:true});await context.close();current=undefined;
 }
 for(const [kind,fromIso,initialToIso,endIso,date,hours]of [['spring','2025-03-09T00:00:00-05:00','2025-03-11T00:00:00-04:00','2025-03-10T00:00:00-04:00','2025-03-09',23],['fall','2025-11-02T00:00:00-04:00','2025-11-04T00:00:00-05:00','2025-11-03T00:00:00-05:00','2025-11-02',25]] as const)for(const [lang,theme]of [['en','dark'],['th','light']] as const){
  const {context,page}=await contextPage(lang,theme,'America/New_York'),from=Date.parse(fromIso),initialTo=Date.parse(initialToIso),expectedTo=Date.parse(endIso),ready=response(page,url=>url.searchParams.get('to')===String(initialTo));await page.goto(base+`/#cost?range=custom&from=${from}&to=${initialTo}&source=1&basis=native&bucket=hour`);await ready;
  await page.locator('.qp-cost-toolbar summary').click();const end=page.locator('.qp-cost-range-controls input[type=date]').nth(1),changed=response(page,url=>url.searchParams.get('to')===String(expectedTo));await end.fill(date);const result=await(await changed).json();assert.equal(result.scope.from,from);assert.equal(result.scope.to,expectedTo);assert.equal(result.scope.sourceId,1);assert.equal(result.basis,'native');assert.equal((result.scope.to-result.scope.from)/3600000,hours);assert.equal(await end.inputValue(),date);
  const url=page.url();await end.fill('');assert.equal(page.url(),url);assert.equal(await end.inputValue(),date);dstCases.push({kind,lang,theme,hours,scope:result.scope});await context.close();current=undefined;
 }
 const bare=await contextPage('en','dark'),bareReady=response(bare.page,url=>url.searchParams.get('from')==='0');await bare.page.goto(base+'/#cost');await bareReady;assert.equal((await bare.page.locator('.qp-cost-toolbar summary').innerText()).trim(),en['usage.allTime']);await bare.context.close();current=undefined;
 assert.equal(cases.length,16);assert.equal(dstCases.length,4);assert.deepEqual(errors,[]);writeFileSync(resolve(output,'verification.json'),JSON.stringify({productionIndexSha256:createHash('sha256').update(readFileSync(resolve(root,'packages/web/dist/index.html'))).digest('hex'),cases,dstCases,bareCostAllTime:true,errors},null,2)+'\n');console.log('PASS20 Cost range cases plus bare-route compatibility: dates/DST, basis, bucket, pending scope and keyboard');
}catch(error){if(current&&!current.isClosed()){await current.screenshot({path:resolve(output,'failure.png'),animations:'disabled'}).catch(()=>{});writeFileSync(resolve(output,'failure.json'),JSON.stringify({url:current.url(),body:await current.locator('body').innerText(),error:String(error),completed:cases,dstCases},null,2)+'\n');}throw error;}
finally{await browser?.close();await app.close();db.close();globalThis.Date=RealDate;}
