/** Bounded compiled Cost display, real HTTP, owned SQLite only. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium,type Page} from 'playwright';
import {installBrowserFixedDate} from './browser-fixed-date.mjs';
import {openDb} from '../packages/daemon/src/db/index.js';
import {buildServer} from '../packages/daemon/src/api/server.js';
import {Scheduler} from '../packages/daemon/src/ingest/scheduler.js';
import {en} from '../packages/web/src/i18n/en.ts';
import {th} from '../packages/web/src/i18n/th.ts';
const root=fileURLToPath(new URL('..',import.meta.url)),output=resolve(root,'screens/cost-resolution');mkdirSync(output,{recursive:true});
const hour=3600000,now=Date.parse('2025-05-17T13:42:00Z'),from=now-481*hour-7*60000,RealDate=globalThis.Date;
globalThis.Date=new Proxy(RealDate,{construct:(target,args)=>Reflect.construct(target,args.length?args:[now]),apply:()=>new RealDate(now).toString(),get:(target,key,receiver)=>key==='now'?()=>now:Reflect.get(target,key,receiver)});
const db=openDb(':memory:');db.exec(`INSERT INTO source(id,harness,profile,root_path,display_name,detected_at) VALUES(1,'codex','qa','/synthetic/one','Bounded fixture',0),(2,'claude-code','qa','/synthetic/two','Excluded fixture',0);INSERT INTO session(id,source_id,native_session_id,project) VALUES(1,1,'bounded-one','Bounded project'),(2,2,'excluded-two','Other project')`);
const insert=db.prepare('INSERT INTO usage_event(source_id,session_id,dedup_key,ts,model,provider,total_tokens,call_count,cost_usd,cost_source) VALUES(?,?,?,?,\'A\',\'openai\',?,?,?,?)');
insert.run(1,1,'api-a',from+hour,100,2,2,'computed');insert.run(1,1,'api-b',from+2*hour,300,3,6,'estimated');insert.run(1,1,'zero',from+240*hour,100,1,0,'computed');insert.run(1,1,'native',from+300*hour,400,4,4,'native');insert.run(1,1,'unknown',from+400*hour,200,5,null,'unknown');insert.run(2,2,'excluded',from+hour,9000,1,999,'computed');
const webRoot=resolve(root,process.env.QP_COST_WEB_ROOT??'packages/web/dist');
const base='http://127.0.0.1:7837',app=buildServer(db,new Scheduler(db,[]),{token:'owned-cost-resolution',port:7837,webRoot});
let browser:Awaited<ReturnType<typeof chromium.launch>>|undefined,current:Page|undefined;const cases:object[]=[],extremes:object[]=[],errors:string[]=[];
const productionIndexSha256=createHash('sha256').update(readFileSync(resolve(webRoot,'index.html'))).digest('hex');
async function chart(page:Page,data:any){
 const columns=page.locator('.qp-cost-column');await page.locator('.qp-cost-chart').waitFor();await columns.first().waitFor({state:'attached'});const count=await columns.count();assert.ok(count<=240,`Chart must not materialize more than240 slots; observed${count}`);
 assert.equal(count,Math.ceil((data.scope.to-data.scope.from)/data.bucketMs));assert.equal(data.resolution.maxBuckets,240);assert.equal(data.bucket,'hour');assert.equal(data.scope.sourceId,1);assert.equal(data.totals.allTokens,1100);assert.equal(data.totals.allCalls,15);
 assert.ok(count>60);assert.equal(await page.locator('.qp-cost-token-dot').count(),0,'Dense plots suppress overlapping decorative dots');
 const offsets=await page.locator('.qp-cost-chart').evaluate(node=>{
  const svg=node.querySelector<SVGSVGElement>('.qp-cost-token-line')!,bounds=svg.getBoundingClientRect();
  const bars=[...node.querySelectorAll('.qp-cost-column')],points=[...svg.querySelectorAll<SVGCircleElement>('circle[data-at]')];
  return {barCount:bars.length,offsets:points.map((point,index)=>{const bar=bars[index]?.getBoundingClientRect(),x=bounds.left+Number(point.getAttribute('cx'))/1000*bounds.width;return bar?Math.abs(x-bar.left-bar.width/2):Infinity})};
 });
 assert.equal(offsets.offsets.length,offsets.barCount);
 assert.ok(offsets.offsets.every(offset=>offset<=.5),`Dense bars and token line buckets must align: ${Math.max(...offsets.offsets)}px`);
 const guides=await page.locator('.qp-cost-time-guide').evaluateAll(nodes=>nodes.map(node=>({at:Number((node as HTMLElement).dataset.at),left:(node as HTMLElement).style.left})));
 const dates=await page.locator('.qp-cost-plot-dates time').evaluateAll(nodes=>nodes.map(node=>({at:Date.parse((node as HTMLTimeElement).dateTime),left:(node as HTMLElement).style.left})));
 assert.deepEqual(guides,dates,'Dense plots retain guides at actual axis ticks');
 const note=page.locator('.qp-cost-resolution');await note.waitFor();assert.equal(Number(await note.getAttribute('data-interval-ms')),data.bucketMs);assert.equal(Number(await note.getAttribute('data-requested-ms')),hour);
 await page.locator('.qp-cost-chart-data>summary').click();const table=page.locator('.qp-cost-chart-data table');await table.waitFor();assert.ok((await table.locator('caption').innerText()).includes((await note.innerText()).trim()));
 const totals=await table.locator('tbody tr').evaluateAll(nodes=>nodes.reduce((s,row)=>({amount:s.amount+Number(row.getAttribute('data-amount')),tokens:s.tokens+Number(row.getAttribute('data-priced-tokens')),priced:s.priced+Number(row.getAttribute('data-priced-calls')),calls:s.calls+Number(row.getAttribute('data-all-calls'))}),{amount:0,tokens:0,priced:0,calls:0}));assert.equal(totals.amount,data.totals.amount);assert.equal(totals.tokens,data.totals.pricedTokens);assert.equal(totals.priced,data.totals.pricedCalls);assert.equal(totals.calls,15);
 await page.locator('.qp-cost-chart-data>summary').click();const plot=page.locator('.qp-cost-chart');await plot.focus();await page.keyboard.press('Home');const tooltip=page.locator('.qp-cost-inspection-tooltip');await tooltip.waitFor();assert.equal(Number(await tooltip.getAttribute('data-at')),data.scope.from);await page.keyboard.press('End');assert.equal(Number(await tooltip.getAttribute('data-at')),data.scope.from+(count-1)*data.bucketMs);await page.keyboard.press('Escape');assert.equal(await tooltip.count(),0);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);return{slots:count,bucketMs:data.bucketMs,requestedMs:hour,totals,disclosed:true,keyboard:true};
}
try{
 await app.listen({host:'127.0.0.1',port:7837});browser=await chromium.launch({channel:'chrome',headless:true});
 for(const lang of ['en','th']as const)for(const theme of ['dark','light'])for(const width of [1672,1280,900,390]){
  const messages=lang==='en'?en:th,name=`${lang}-${theme}-${width}`,context=await browser.newContext({viewport:{width,height:941},timezoneId:'Asia/Bangkok',reducedMotion:'reduce'}),page=await context.newPage();current=page;page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(({lang,theme})=>{(window as any).__QUOTAPULSE_TOKEN__='owned-cost-resolution';localStorage.setItem('quotapulse-prefs',JSON.stringify({lang,currency:'USD',rate:1,hiddenSubscriptions:[]}));localStorage.setItem('quotapulse-theme',theme)},{lang,theme});await installBrowserFixedDate(page,now);
  let ready=page.waitForResponse(r=>r.url().includes('/api/cost-analysis?')&&r.ok());await page.goto(base+`/#cost?range=custom&from=${from}&to=${now}&source=1&basis=api&bucket=hour`);let data=await(await ready).json();const api=await chart(page,data);assert.equal(data.totals.amount,8);assert.equal(data.bucketMs,3*hour);assert.equal(api.slots,161);await page.screenshot({path:resolve(output,name+'.png'),animations:'disabled'});
  await page.locator('.qp-cost-toolbar summary').click();ready=page.waitForResponse(r=>r.url().includes('/api/cost-analysis?')&&new URL(r.url()).searchParams.get('basis')==='native'&&r.ok());await page.locator('.qp-cost-range-controls').getByRole('combobox',{name:messages['redesign.costBasis'],exact:true}).selectOption('native');data=await(await ready).json();await page.keyboard.press('Escape');await page.waitForFunction(()=>document.querySelector('.qp-cost-summary .qp-cost-value>span')?.textContent?.includes('4.00'));const native=await chart(page,data);assert.equal(data.totals.amount,4);
  const history=page.getByRole('link',{name:messages['redesign.costOpenHistory'],exact:true}).first();const params=new URLSearchParams((await history.getAttribute('href'))!.split('?')[1]);assert.equal(params.get('from'),String(from));assert.equal(params.get('to'),String(now));assert.equal(params.get('source'),'1');
  await page.locator('.qp-cost-toolbar summary').click();ready=page.waitForResponse(r=>r.url().includes('/api/cost-analysis?')&&Number(new URL(r.url()).searchParams.get('from'))>now-24*hour&&r.ok());await page.locator('.qp-cost-range-controls').getByRole('combobox',{name:messages['redesign.projectRange'],exact:true}).selectOption('today');data=await(await ready).json();await page.keyboard.press('Escape');await page.getByText(messages['redesign.costNoData'],{exact:true}).waitFor();assert.equal(data.bucketMs,hour);assert.equal(data.totals.allCalls,0);assert.equal(await page.locator('.qp-cost-chart-data').count(),0);assert.equal(await page.locator('.qp-cost-resolution').count(),0);
  cases.push({name,api,native,shortRangeRestored:true,historyScopePreserved:true});
  if(width===1672)for(const range of ['all','maximum'])for(const basis of ['api','native']){
   const hash=range==='all'?`#cost?range=all&source=1&basis=${basis}&bucket=hour`:`#cost?range=custom&from=0&to=8640000000000000&source=1&basis=${basis}&bucket=hour`;
   ready=page.waitForResponse(r=>r.url().includes('/api/cost-analysis?')&&new URL(r.url()).searchParams.get('from')==='0'&&new URL(r.url()).searchParams.get('basis')===basis&&r.ok());await page.goto(base+'/'+hash);data=await(await ready).json();await page.waitForFunction(expected=>document.querySelector('.qp-cost-resolution')?.getAttribute('data-interval-ms')===String(expected),data.bucketMs);const result=await chart(page,data);assert.equal(data.scope.from,0);assert.equal(data.scope.to,range==='all'?now+1:8640000000000000);assert.equal(result.slots,240);assert.equal(data.totals.amount,basis==='api'?8:4);extremes.push({name,range,basis,scope:data.scope,...result});
  }
  await context.close();current=undefined;
 }
 assert.equal(cases.length,16);assert.equal(extremes.length,16);assert.deepEqual(errors,[]);writeFileSync(resolve(output,'verification.json'),JSON.stringify({productionIndexSha256,cases,extremes,errors},null,2)+'\n');console.log('PASS32 bounded compiled Cost cases: all facts, source/basis, actual resolution disclosure, keyboard, short-range recovery, epoch/all-time and maximum date bounds');
}catch(error){if(current&&!current.isClosed()){await current.screenshot({path:resolve(output,'failure.png'),animations:'disabled'}).catch(()=>{});writeFileSync(resolve(output,'failure.json'),JSON.stringify({productionIndexSha256,url:current.url(),error:String(error),cases,extremes},null,2)+'\n');}throw error;}
finally{await browser?.close();await app.close();db.close();globalThis.Date=RealDate;}
