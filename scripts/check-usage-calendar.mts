/** Compiled dashboard, real HTTP and in-memory SQLite; no customer data. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, type Page } from 'playwright';
import { openDb } from '../packages/daemon/src/db/index.js';
import { buildServer } from '../packages/daemon/src/api/server.js';
import { Scheduler } from '../packages/daemon/src/ingest/scheduler.js';

const root=fileURLToPath(new URL('..',import.meta.url)),output=resolve(root,'screens/usage-calendar');
mkdirSync(output,{recursive:true});
const db=openDb(':memory:');
db.exec(`INSERT INTO source(id,harness,profile,root_path,display_name,detected_at) VALUES (1,'codex','test','/synthetic/nonexistent','Calendar fixture',0);
  INSERT INTO session(id,source_id,native_session_id,project) VALUES(1,1,'calendar-session','Calendar project');`);
const app=buildServer(db,new Scheduler(db,[]),{token:'calendar-test',port:7827,webRoot:resolve(root,'packages/web/dist')});
const base='http://127.0.0.1:7827';
const epoch=(value:string)=>Date.parse(value);
const ranges={
 'Asia/Bangkok':{springFrom:'2025-03-09T00:00:00+07:00',springEnd:'2025-03-10T00:00:00+07:00',fallFrom:'2025-11-02T00:00:00+07:00',fallEnd:'2025-11-03T00:00:00+07:00',crossFrom:'2025-05-17T23:55:00+07:00',crossEnd:'2025-05-18T00:10:00+07:00',springEditFrom:'2025-03-08T00:00:00+07:00',springEditEnd:'2025-03-11T00:00:00+07:00',fallEditFrom:'2025-11-01T00:00:00+07:00',fallEditEnd:'2025-11-04T00:00:00+07:00'},
 'UTC':{springFrom:'2025-03-09T00:00:00Z',springEnd:'2025-03-10T00:00:00Z',fallFrom:'2025-11-02T00:00:00Z',fallEnd:'2025-11-03T00:00:00Z',crossFrom:'2025-05-17T23:55:00Z',crossEnd:'2025-05-18T00:10:00Z',springEditFrom:'2025-03-08T00:00:00Z',springEditEnd:'2025-03-11T00:00:00Z',fallEditFrom:'2025-11-01T00:00:00Z',fallEditEnd:'2025-11-04T00:00:00Z'},
 'America/New_York':{springFrom:'2025-03-09T00:00:00-05:00',springEnd:'2025-03-10T00:00:00-04:00',fallFrom:'2025-11-02T00:00:00-04:00',fallEnd:'2025-11-03T00:00:00-05:00',crossFrom:'2025-05-17T23:55:00-04:00',crossEnd:'2025-05-18T00:10:00-04:00',springEditFrom:'2025-03-08T00:00:00-05:00',springEditEnd:'2025-03-11T00:00:00-04:00',fallEditFrom:'2025-11-01T00:00:00-04:00',fallEditEnd:'2025-11-04T00:00:00-05:00'},
};
let browser:Awaited<ReturnType<typeof chromium.launch>>|undefined,page:Page|undefined;
const checks:object[]=[],errors:string[]=[];
try{
 await app.listen({host:'127.0.0.1',port:7827});browser=await chromium.launch({channel:'chrome',headless:true});
 for(const [timezone,dates]of Object.entries(ranges))for(const lang of ['en','th']){
  const theme=lang==='en'?'dark':'light',width=lang==='en'?1672:390,context=await browser.newContext({timezoneId:timezone,viewport:{width,height:941},reducedMotion:'reduce'});
  page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/*',route=>new URL(route.request().url()).origin===base?route.continue():route.abort());
  await page.addInitScript(({lang,theme})=>{(window as any).__QUOTAPULSE_TOKEN__='calendar-test';localStorage.setItem('quotapulse-prefs',JSON.stringify({lang,currency:'USD',rate:1,hiddenSubscriptions:[]}));localStorage.setItem('quotapulse-theme',theme)},{lang,theme});
  const current=page;
  async function open(from:number,to:number){
   const ready=current.waitForResponse(response=>new URL(response.url()).pathname==='/api/history-summary'&&response.ok());
   await current.goto(`${base}/#history?range=custom&from=${from}&to=${to}&source=1&session_id=1`);
   const result=await(await ready).json();await current.getByTestId('history-timeline').waitFor();
   const picker=current.locator('.qp-history-range-picker');if(await picker.getAttribute('open')===null)await picker.locator('summary').click();await current.locator('.qp-history-range-popover').waitFor();
   assert.equal(result.scope.from,from);assert.equal(result.scope.to,to);assert.equal(result.scope.sourceId,1);assert.equal(result.scope.sessionId,1);
   return result.scope;
  }
  const fields=current.getByTestId('usage-history').locator('input[type=date]');
  const cases=[
   {name:'subday',from:epoch('2025-05-17T13:42:00Z'),to:epoch('2025-05-17T14:02:00Z'),fromLabel:'2025-05-17',toLabel:'2025-05-17'},
   {name:'exclusive-midnight',from:epoch(dates.crossFrom),to:epoch(dates.crossEnd)-600000,fromLabel:'2025-05-17',toLabel:'2025-05-17'},
   {name:'spring-day',from:epoch(dates.springFrom),to:epoch(dates.springEnd),fromLabel:'2025-03-09',toLabel:'2025-03-09'},
   {name:'fall-day',from:epoch(dates.fallFrom),to:epoch(dates.fallEnd),fromLabel:'2025-11-02',toLabel:'2025-11-02'},
   {name:'cross-midnight',from:epoch(dates.crossFrom),to:epoch(dates.crossEnd),fromLabel:'2025-05-17',toLabel:'2025-05-18'},
  ];
  for(const item of cases){
   const scope=await open(item.from,item.to);assert.equal(await fields.count(),2);
   assert.equal(await fields.nth(0).inputValue(),item.fromLabel,item.name+'/'+timezone+' from');
   assert.equal(await fields.nth(1).inputValue(),item.toLabel,item.name+'/'+timezone+' to');
   checks.push({timezone,lang,theme,width,...item,scope});
   if(item.name==='subday'){await current.evaluate(()=>document.fonts.ready);await current.screenshot({path:resolve(output,timezone.replaceAll('/','-')+'-'+lang+'.png'),animations:'disabled'});}
  }
  const beforeClear=current.url();await fields.nth(0).fill('');assert.equal(current.url(),beforeClear);assert.equal(await fields.nth(0).inputValue(),'2025-05-17');
  await fields.nth(1).fill('');assert.equal(current.url(),beforeClear);assert.equal(await fields.nth(1).inputValue(),'2025-05-18');
  for(const edit of [
   {name:'spring-edit',from:epoch(dates.springEditFrom),initialTo:epoch(dates.springEditEnd),date:'2025-03-09',expectedTo:epoch(dates.springEnd)},
   {name:'fall-edit',from:epoch(dates.fallEditFrom),initialTo:epoch(dates.fallEditEnd),date:'2025-11-02',expectedTo:epoch(dates.fallEnd)},
  ]){
   await open(edit.from,edit.initialTo);
   const changed=current.waitForResponse(response=>{const url=new URL(response.url());return url.pathname==='/api/history-summary'&&url.searchParams.get('to')!==String(edit.initialTo)&&response.ok()});
   await fields.nth(1).fill(edit.date);const body=await(await changed).json();
   assert.equal(body.scope.to,edit.expectedTo,edit.name+'/'+timezone+' calendar end');assert.equal(body.scope.from,edit.from);assert.equal(body.scope.sourceId,1);assert.equal(body.scope.sessionId,1);
   assert.equal(await fields.nth(1).inputValue(),edit.date);
   const params=new URLSearchParams(new URL(current.url()).hash.split('?')[1]);assert.equal(params.get('to'),String(edit.expectedTo));assert.equal(params.get('from'),String(edit.from));
   checks.push({timezone,lang,theme,width,...edit,scope:body.scope});
  }
  assert.equal(await current.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await context.close();page=undefined;
 }
 assert.equal(checks.length,42);assert.deepEqual(errors,[]);
 writeFileSync(resolve(output,'verification.json'),JSON.stringify({productionIndexSha256:createHash('sha256').update(readFileSync(resolve(root,'packages/web/dist/index.html'))).digest('hex'),checks,clearedInputsPreserveScope:true,errors},null,2)+'\n');
 console.log('PASS42 compiled calendar scope/display/edit checks across three timezones and two language/theme/width combinations');
}catch(error){
 if(page&&!page.isClosed()){await page.screenshot({path:resolve(output,'failure.png'),animations:'disabled'}).catch(()=>{});writeFileSync(resolve(output,'failure.json'),JSON.stringify({url:page.url(),dates:await page.locator('input[type=date]').evaluateAll(nodes=>nodes.map(node=>(node as HTMLInputElement).value)),error:String(error),completed:checks},null,2)+'\n');}
 throw error;
}finally{await browser?.close();await app.close();db.close();}
