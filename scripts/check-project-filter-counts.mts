/** Real compiled Projects UI and owned in-memory data; never reads a customer DB. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium, type Page } from 'playwright';
import { installBrowserFixedDate } from './browser-fixed-date.mjs';
import { openDb } from '../packages/daemon/src/db/index.js';
import { buildServer } from '../packages/daemon/src/api/server.js';
import { Scheduler } from '../packages/daemon/src/ingest/scheduler.js';
import { en } from '../packages/web/src/i18n/en.ts';
import { th } from '../packages/web/src/i18n/th.ts';

const root=fileURLToPath(new URL('..',import.meta.url)),output=resolve(root,'screens/project-filter-counts');mkdirSync(output,{recursive:true});
const now=Date.parse('2025-05-17T13:42:00Z'),RealDate=globalThis.Date;
globalThis.Date=new Proxy(RealDate,{construct:(target,args)=>Reflect.construct(target,args.length?args:[now]),apply:()=>new RealDate(now).toString(),get:(target,key,receiver)=>key==='now'?()=>now:Reflect.get(target,key,receiver)});
const db=openDb(':memory:');
db.exec(`INSERT INTO source(id,harness,profile,root_path,display_name,detected_at) VALUES(1,'codex','qa','/synthetic/nonexistent','Source A',0),(2,'hermes','qa','/synthetic/nonexistent','Source B',0)`);
const session=db.prepare('INSERT INTO session(id,source_id,native_session_id,project,last_seen_at) VALUES(?,?,?,?,?)');
const usage=db.prepare("INSERT INTO usage_event(source_id,session_id,dedup_key,ts,model,provider,total_tokens,call_count,cost_source) VALUES(?,?,?,?,'QA model','openai',?,1,'unknown')");
for(const [id,source,project,at]of [[1,1,'Recent',now-1000],[2,1,'Boundary',now-300000],[3,2,'Old',now-300001],[4,2,'Future',now+1000],[5,1,null,now-2000],[6,2,'',now-400000]] as const){session.run(id,source,'session-'+id,project,at);usage.run(source,id,'usage-'+id,at,id*10);}
usage.run(1,1,'second-record-same-project',now-500,1);
const app=buildServer(db,new Scheduler(db,[]),{token:'owned-project-counts',port:7831,webRoot:resolve(root,'packages/web/dist')}),base='http://127.0.0.1:7831';
const hash=`#projects?range=custom&from=0&to=${now+60000}`;
function deferred(){let resolve!:()=>void;const promise=new Promise<void>(done=>resolve=done);return{promise,resolve}}
let browser:Awaited<ReturnType<typeof chromium.launch>>|undefined,current:Page|undefined;
const cases:object[]=[],errors:string[]=[];
try{
 await app.listen({host:'127.0.0.1',port:7831});browser=await chromium.launch({channel:'chrome',headless:true});
 for(const lang of ['en','th'] as const)for(const theme of ['dark','light'])for(const width of [390,900,1280,1672]){
  const name=`${lang}-${theme}-${width}`,messages=lang==='en'?en:th;
  const context=await browser.newContext({viewport:{width,height:941},reducedMotion:'reduce',timezoneId:'Asia/Bangkok',deviceScaleFactor:1});const page=await context.newPage();current=page;page.setDefaultTimeout(15000);
  page.on('pageerror',error=>errors.push(name+': '+error.message));
  await page.addInitScript(({lang,theme})=>{(window as any).__QUOTAPULSE_TOKEN__='owned-project-counts';localStorage.setItem('quotapulse-prefs',JSON.stringify({lang,currency:'USD',rate:1,hiddenSubscriptions:[]}));localStorage.setItem('quotapulse-theme',theme)},{lang,theme});await installBrowserFixedDate(page,now);
  await page.goto(base+'/'+hash);
  const tabs=page.locator('.qp-project-tabs button'),cards=page.locator('.qp-project-card'),search=page.locator('.qp-project-search input');
  const counts=async(expected:number[])=>{
   await page.waitForFunction(expected=>[...document.querySelectorAll('.qp-project-tabs button')].map(node=>node.getAttribute('data-count')).join(',')===expected.join(','),expected);
   assert.deepEqual(await tabs.evaluateAll(nodes=>nodes.map(node=>Number(node.getAttribute('data-count')))),expected);
   for(let index=0;index<3;index++){const button=tabs.nth(index);assert.equal(await button.locator('.qp-project-tab-count').getAttribute('aria-hidden'),'true');assert.equal(await button.getAttribute('aria-busy'),null);const description=await button.getAttribute('aria-describedby');assert.ok(description);assert.equal(await page.locator('body').evaluate((_,id)=>document.getElementById(id!)?.textContent,description),await button.getAttribute('title'));}
  };
  await counts([6,3,1]);assert.equal(await cards.count(),6,'project groups, not seven usage records');
  const initial=await tabs.evaluateAll(nodes=>nodes.map(node=>({name:node.getAttribute('aria-label'),count:node.getAttribute('data-count'),description:node.getAttribute('title')})));
  assert.deepEqual(initial.map(row=>row.name),[messages['redesign.allProjects'],messages['redesign.recentProjects'],messages['redesign.unassignedProjects']]);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.screenshot({path:resolve(output,name+'.png'),animations:'disabled'});
  await tabs.nth(1).click();await counts([6,3,1]);assert.equal(await cards.count(),3,'include exact five-minute boundary and exclude future/older observations');
  await tabs.nth(2).click();await counts([6,3,1]);assert.equal(await cards.count(),1,'null project is unassigned; empty string remains a distinct project');
  await tabs.first().click();await search.fill('Recent');await counts([1,1,0]);assert.equal(await cards.count(),1);
  await search.fill('Source B');await counts([3,0,0]);assert.equal(await cards.count(),3,'metadata search counts source-matching groups');
  await search.fill('');await counts([6,3,1]);
  const entered=deferred(),release=deferred();let held=false;
  const handler=async(route:any)=>{if(!held&&new URL(route.request().url()).searchParams.get('harness')==='hermes'){held=true;entered.resolve();await release.promise;}await route.continue();};
  await page.route('**/api/projects?**',handler);
  try{
   await page.locator('.qp-project-toolbar select').nth(1).selectOption('hermes');await Promise.race([entered.promise,delay(5000,undefined,{ref:false}).then(()=>{throw Error('Expected pending harness request')})]);
   assert.deepEqual(await tabs.evaluateAll(nodes=>nodes.map(node=>node.getAttribute('data-count'))),[null,null,null]);assert.deepEqual(await tabs.locator('.qp-project-tab-count').allTextContents(),['—','—','—']);for(const button of await tabs.all())assert.equal(await button.getAttribute('aria-busy'),'true');
   release.resolve();await counts([3,0,0]);assert.equal(await cards.count(),3);
  }finally{release.resolve();await page.unroute('**/api/projects?**',handler);}
  await search.fill('no-project-matches-this');await counts([0,0,0]);assert.equal(await cards.count(),0);await search.fill('');
  await page.locator('.qp-project-toolbar select').nth(1).selectOption('');await counts([6,3,1]);
  let failed=false;
  const failedHandler=async(route:any)=>{if(!failed&&new URL(route.request().url()).searchParams.get('harness')==='hermes'){failed=true;await route.fulfill({status:503,json:{error:'owned test outage'}});}else await route.continue();};
  await page.route('**/api/projects?**',failedHandler);
  try{
   await page.locator('.qp-project-toolbar select').nth(1).selectOption('hermes');
   await page.waitForFunction(label=>document.querySelector('.qp-project-tabs button')?.getAttribute('title')===label,messages['app.couldNotLoad']);
   assert.deepEqual(await tabs.evaluateAll(nodes=>nodes.map(node=>node.getAttribute('data-count'))),[null,null,null]);for(const button of await tabs.all())assert.equal(await button.getAttribute('aria-busy'),null,'failed requests are not still loading');
   await page.getByRole('button',{name:messages['app.retry'],exact:true}).first().click();await counts([3,0,0]);
  }finally{await page.unroute('**/api/projects?**',failedHandler);}
  await page.locator('.qp-project-toolbar select').nth(1).selectOption('');await counts([6,3,1]);
  await page.evaluate(hash=>{location.hash=hash},hash+'&source=1');await counts([3,3,1]);assert.equal(await cards.count(),3);
  await tabs.first().focus();await page.keyboard.press('Tab');assert.equal(await tabs.nth(1).evaluate(node=>node===document.activeElement),true);assert.equal(await tabs.nth(1).evaluate(node=>getComputedStyle(node).outlineStyle),'solid');await page.keyboard.press('Space');assert.equal(await tabs.nth(1).getAttribute('aria-pressed'),'true');await counts([3,3,1]);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  cases.push({name,initial,boundaryIncluded:true,futureExcluded:true,countsBeforeTab:true,metadataSearch:true,sourceAndHarnessScope:true,pendingUnknown:true,errorUnknown:true,retry:true,zeroAfterEmpty:true,keyboard:true});await context.close();current=undefined;
 }
 assert.equal(cases.length,16);assert.deepEqual(errors,[]);writeFileSync(resolve(output,'verification.json'),JSON.stringify({productionIndexSha256:createHash('sha256').update(readFileSync(resolve(root,'packages/web/dist/index.html'))).digest('hex'),cases,errors},null,2)+'\n');console.log('PASS16 Projects filter count cases: boundaries, metadata, source/harness, pending/zero and keyboard');
}catch(error){if(current&&!current.isClosed()){await current.screenshot({path:resolve(output,'failure.png'),animations:'disabled'}).catch(()=>{});writeFileSync(resolve(output,'failure.json'),JSON.stringify({url:current.url(),body:await current.locator('body').innerText(),error:String(error),completed:cases},null,2)+'\n');}throw error;}
finally{await browser?.close();await app.close();db.close();globalThis.Date=RealDate;}
