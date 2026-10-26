/** Compiled Cost summaries over real HTTP and an owned SQLite fixture. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium,type Page} from 'playwright';
import {openDb} from '../packages/daemon/src/db/index.js';
import {buildServer} from '../packages/daemon/src/api/server.js';
import {Scheduler} from '../packages/daemon/src/ingest/scheduler.js';
import {installBrowserFixedDate} from './browser-fixed-date.mjs';
import {en} from '../packages/web/src/i18n/en.ts';
import {th} from '../packages/web/src/i18n/th.ts';

const root=fileURLToPath(new URL('..',import.meta.url)),output=resolve(root,'screens/cost-summary-trends');mkdirSync(output,{recursive:true});
const day=86400000,from=Date.parse('2025-05-13T00:00:00+07:00'),to=from+3.5*day,RealDate=globalThis.Date;
globalThis.Date=new Proxy(RealDate,{construct:(target,args)=>Reflect.construct(target,args.length?args:[to]),apply:()=>new RealDate(to).toString(),get:(target,key,receiver)=>key==='now'?()=>to:Reflect.get(target,key,receiver)});
const db=openDb(':memory:');db.exec(`INSERT INTO source(id,harness,profile,root_path,display_name,detected_at) VALUES(1,'codex','qa','/synthetic/nonexistent','Summary fixture',0);INSERT INTO session(id,source_id,native_session_id,project) VALUES(1,1,'summary-fixture','Summary project')`);
const insert=db.prepare('INSERT INTO usage_event(source_id,session_id,dedup_key,ts,model,provider,total_tokens,call_count,cost_usd,cost_source) VALUES(1,1,?,?,\'A\',\'openai\',?,?,?,?)');
insert.run('first-api',from+.5*day,100,2,2,'computed');insert.run('unpriced',from+1.5*day,200,5,null,'unknown');insert.run('next-api',from+2.5*day,300,3,6,'computed');insert.run('native',from+2.5*day,400,4,4,'native');insert.run('priced-zero',from+3.25*day,100,1,0,'computed');
const app=buildServer(db,new Scheduler(db,[]),{token:'owned-summary-fixture',port:7836,webRoot:resolve(root,'packages/web/dist')}),base='http://127.0.0.1:7836';
let browser:Awaited<ReturnType<typeof chromium.launch>>|undefined,current:Page|undefined;const errors:string[]=[],external:string[]=[],cases:object[]=[],futureCases:object[]=[],emptyCases:object[]=[];
async function series(page:Page,index:number){
 const svg=page.locator('.qp-cost-summary article').nth(index).locator('.qp-cost-summary-trend');assert.equal(await svg.count(),1);
 const description=await svg.locator('desc').textContent();assert.ok(description);assert.equal(await svg.getAttribute('aria-describedby'),await svg.locator('desc').getAttribute('id'));
 return{points:await svg.locator('circle[data-value]').evaluateAll(nodes=>nodes.map(node=>({at:Number(node.getAttribute('data-at')),value:Number(node.getAttribute('data-value')),title:node.querySelector('title')?.textContent??''}))),runs:await svg.locator('.qp-observed-line').count(),label:await svg.getAttribute('aria-label'),description};
}
try{
 await app.listen({host:'127.0.0.1',port:7836});browser=await chromium.launch({channel:'chrome',headless:true});
 for(const lang of ['en','th']as const)for(const theme of ['dark','light'])for(const width of [390,900,1280,1672]){
  const currency=width===1672?'THB':'USD',rate=currency==='THB'?37.25:1,name=`${lang}-${theme}-${width}`,messages=lang==='en'?en:th;
  const context=await browser.newContext({viewport:{width,height:941},timezoneId:'Asia/Bangkok',reducedMotion:'reduce',deviceScaleFactor:1}),page=await context.newPage();current=page;page.on('pageerror',e=>errors.push(e.message));
  page.on('request',r=>{if(new URL(r.url()).origin!==base)external.push(r.url())});
  await page.addInitScript(({lang,theme,currency})=>{(window as any).__QUOTAPULSE_TOKEN__='owned-summary-fixture';localStorage.setItem('quotapulse-prefs',JSON.stringify({lang,currency,rate:37.25,hiddenSubscriptions:[]}));localStorage.setItem('quotapulse-theme',theme)},{lang,theme,currency});await installBrowserFixedDate(page,to);
  let ready=page.waitForResponse(r=>r.url().includes('/api/cost-analysis?')&&r.ok());await page.goto(base+`/#cost?range=custom&from=${from}&to=${to}&source=1&bucket=day&basis=api`);const data=await(await ready).json();assert.equal(data.totals.amount,8);assert.equal(data.totals.pricedTokens,500);assert.equal(data.totals.allTokens,1100);assert.equal(data.totals.pricedCalls,6);assert.equal(data.totals.allCalls,15);
  await page.locator('.qp-cost-summary-trend circle').first().waitFor();
  const amount=await series(page,0);
  assert.deepEqual(amount.points.map(p=>p.value),[2,6,0].map(v=>v*rate),'An interval with unpriced calls must be a gap, not a zero-valued sample');
  assert.deepEqual(amount.points.map(p=>p.at),[from,from+2*day,from+3*day]);assert.equal(amount.runs,2);
  const average=await series(page,1),unit=await series(page,3);
  assert.deepEqual(average.points.map(p=>p.value),[2,1,8/3,8/3.5].map(v=>v*rate));assert.equal(average.points.at(-1)!.at,to);
  assert.deepEqual(unit.points.map(p=>p.value),[20,20,20,16].map(v=>v*rate));assert.equal(unit.points.at(-1)!.at,to);
  assert.equal(average.label,`${messages['redesign.costDailyTrend']} (${currency})`);assert.equal(unit.label,`${messages['redesign.costUnitTrend']} (${currency})`);
  assert.match(average.points.at(-1)!.title,/\+/);assert.ok(average.points.at(-1)!.title.includes('6 / 15'));assert.ok(unit.points.at(-1)!.title.includes('6 / 15'));assert.equal(unit.points.at(-1)!.title.includes('+'),false,'The per-priced-token quotient is exact for its priced subset');
  const projection=page.locator('.qp-cost-summary article').nth(2);assert.equal(await projection.locator('.qp-cost-summary-trend').count(),0);assert.equal(await projection.locator('strong').innerText(),messages['redesign.unknownValue']);
  await page.screenshot({path:resolve(output,name+'-api.png'),animations:'disabled'});
  await page.locator('.qp-cost-toolbar summary').click();ready=page.waitForResponse(r=>r.url().includes('/api/cost-analysis?')&&new URL(r.url()).searchParams.get('basis')==='native'&&r.ok());await page.locator('.qp-cost-range-controls').getByRole('combobox',{name:messages['redesign.costBasis'],exact:true}).selectOption('native');const nativeData=await(await ready).json();assert.equal(nativeData.totals.amount,4);assert.equal(nativeData.totals.pricedTokens,400);assert.equal(nativeData.totals.allTokens,1100);
  await page.waitForFunction(value=>document.querySelector('.qp-cost-summary-trend circle')?.getAttribute('data-value')===String(value),4*rate);await page.keyboard.press('Escape');
  const nativeAmount=await series(page,0),nativeAverage=await series(page,1),nativeUnit=await series(page,3);
  assert.deepEqual(nativeAmount.points.map(p=>p.value),[4*rate]);assert.deepEqual(nativeAmount.points.map(p=>p.at),[from+2*day]);assert.equal(nativeAmount.runs,1);
  assert.deepEqual(nativeAverage.points.map(p=>p.value),[4/3,4/3.5].map(v=>v*rate));assert.deepEqual(nativeUnit.points.map(p=>p.value),[10,10].map(v=>v*rate));assert.ok(nativeAverage.points.at(-1)!.title.includes('4 / 15'));
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:resolve(output,name+'-native.png'),animations:'disabled'});
  cases.push({name,currency,rate,api:amount,average,unit,native:{amount:nativeAmount,average:nativeAverage,unit:nativeUnit},projectionUnavailable:true,scopePreserved:nativeData.scope,allTokens:1100});
  if(width===1672){
   const futureTo=to+day;ready=page.waitForResponse(r=>r.url().includes('/api/cost-analysis?')&&new URL(r.url()).searchParams.get('to')===String(futureTo)&&r.ok());await page.goto(base+`/#cost?range=custom&from=${from}&to=${futureTo}&source=1&bucket=day&basis=native`);const future=await(await ready).json();assert.equal(future.scope.to,futureTo);assert.equal(future.now,to);assert.equal(future.totals.amount,4);
   const futureAverage=page.locator('.qp-cost-summary article').nth(1);await futureAverage.getByText(messages['redesign.costFutureAverage'],{exact:true}).waitFor();assert.equal(await futureAverage.locator('strong').innerText(),messages['redesign.unknownValue']);assert.equal(await futureAverage.locator('.qp-cost-summary-trend').count(),0);const futureUnit=await series(page,3);assert.equal(futureUnit.points.at(-1)!.value,10*rate);futureCases.push({name,to:futureTo,asOf:future.now,averageUnavailable:true,pricedUnitPreserved:true});
   const emptyFrom=from-10*day,emptyTo=emptyFrom+3.5*day;ready=page.waitForResponse(r=>r.url().includes('/api/cost-analysis?')&&new URL(r.url()).searchParams.get('from')===String(emptyFrom)&&r.ok());await page.goto(base+`/#cost?range=custom&from=${emptyFrom}&to=${emptyTo}&source=1&bucket=day&basis=api`);const empty=await(await ready).json();assert.equal(empty.totals.allCalls,0);assert.equal(empty.totals.amount,0);
   const emptyAverage=page.locator('.qp-cost-summary article').nth(1);await emptyAverage.locator('.qp-cost-summary-trend circle').first().waitFor();const zero=await series(page,1);assert.deepEqual(zero.points.map(p=>p.value),[0,0,0,0]);const money=new Intl.NumberFormat(lang==='th'?'th-TH':'en-US',{style:'currency',currency}).format(0);assert.equal(await emptyAverage.locator('.qp-cost-value>span').first().innerText(),money);assert.equal(await page.locator('.qp-cost-summary article').nth(3).locator('strong').innerText(),messages['redesign.unknownValue']);emptyCases.push({name,scope:empty.scope,averageZero:true,unitUnknown:true});
  }
  await context.close();current=undefined;
 }
 assert.equal(cases.length,16);assert.equal(futureCases.length,4);assert.equal(emptyCases.length,4);assert.deepEqual(errors,[]);assert.deepEqual(external,[]);writeFileSync(resolve(output,'verification.json'),JSON.stringify({productionIndexSha256:createHash('sha256').update(readFileSync(resolve(root,'packages/web/dist/index.html'))).digest('hex'),cases,futureCases,emptyCases,errors,external},null,2)+'\n');console.log('PASS24 compiled Cost summary cases: unknown gaps, cumulative averages/units, partial interval, weighted coverage, native/API, currency, future/empty ranges and responsive locales');
}catch(error){if(current&&!current.isClosed()){await current.screenshot({path:resolve(output,'failure.png'),animations:'disabled'}).catch(()=>{});writeFileSync(resolve(output,'failure.json'),JSON.stringify({url:current.url(),error:String(error),completed:cases},null,2)+'\n');}throw error;}
finally{await browser?.close();await app.close();db.close();globalThis.Date=RealDate;}
