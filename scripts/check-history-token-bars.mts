/** Compiled dashboard + real HTTP + in-memory records only. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { openDb } from '../packages/daemon/src/db/index.js';
import { buildServer } from '../packages/daemon/src/api/server.js';
import { Scheduler } from '../packages/daemon/src/ingest/scheduler.js';
import { en } from '../packages/web/src/i18n/en.js';
import { th } from '../packages/web/src/i18n/th.js';
const root=fileURLToPath(new URL('..',import.meta.url)),output=resolve(root,'screens/history-token-bars');mkdirSync(output,{recursive:true});
const db=openDb(':memory:'),now=Date.now();
db.exec(`INSERT INTO source(id,harness,profile,root_path,display_name,detected_at) VALUES(1,'codex','test','/synthetic/nonexistent','Token fixture',0),(2,'hermes','test','/synthetic/nonexistent','Other source',0);
 INSERT INTO session(id,source_id,native_session_id,project) VALUES(1,1,'token-session','Token project'),(2,2,'other-session','Other project');`);
const insert=db.prepare(`INSERT INTO usage_event(source_id,session_id,dedup_key,ts,model,provider,input_tokens,total_tokens,call_count) VALUES(?,?,?,?,?,'openai',?,?,1)`);
const counts=[...Array.from({length:50},(_,i)=>[100,50,25,1,0][i%5]!),1000000,500000,250000,1,0,5];
counts.forEach((value,i)=>insert.run(1,1,'owned-'+i,now-i*1000,'tokens-'+value,value,value));insert.run(2,2,'other',now,'other-model',4000000,4000000);
const app=buildServer(db,new Scheduler(db,[]),{token:'token-bars-test',port:7828,webRoot:resolve(root,'packages/web/dist')});
const base='http://127.0.0.1:7828',hash='#history?range=all&source=1&session_id=1';
let browser:Awaited<ReturnType<typeof chromium.launch>>|undefined;
const cases:object[]=[],errors:string[]=[];
try{
 await app.listen({host:'127.0.0.1',port:7828});browser=await chromium.launch({channel:'chrome',headless:true});
 for(const lang of ['en','th'])for(const theme of ['dark','light'])for(const width of [390,900,1280,1672]){
  const context=await browser.newContext({viewport:{width,height:941},timezoneId:'Asia/Bangkok',reducedMotion:'reduce'}),page=await context.newPage(),name=`${lang}-${theme}-${width}`;
  page.on('pageerror',error=>errors.push(error.message));await page.route('**/*',route=>new URL(route.request().url()).origin===base?route.continue():route.abort());
  await page.addInitScript(({lang,theme})=>{(window as any).__QUOTAPULSE_TOKEN__='token-bars-test';localStorage.setItem('quotapulse-prefs',JSON.stringify({lang,currency:'USD',rate:1,hiddenSubscriptions:[]}));localStorage.setItem('quotapulse-theme',theme)},{lang,theme});
  const response=(offset=0)=>page.waitForResponse(r=>{const u=new URL(r.url());return u.pathname==='/api/usage-events'&&Number(u.searchParams.get('offset'))===offset&&r.ok()});
  async function check(data:any){
   const maximum=Math.max(0,...data.rows.map((row:any)=>row.total_tokens));
   await page.waitForFunction(({tokens,max})=>{const cells=[...document.querySelectorAll('.qp-history-token-comparison')];return cells.length===tokens.length&&cells.every((cell,i)=>Number(cell.getAttribute('data-token-count'))===tokens[i]&&Number(cell.getAttribute('data-page-token-max'))===max)},{tokens:data.rows.map((row:any)=>row.total_tokens),max:maximum});
   const actual=await page.locator('.qp-history-token-comparison').evaluateAll(nodes=>nodes.map(node=>{const value=node.querySelector('.qp-history-token-value')!,track=node.querySelector('.qp-history-token-bar')!,fill=track.firstElementChild as HTMLElement;return{count:Number(node.getAttribute('data-token-count')),maximum:Number(node.getAttribute('data-page-token-max')),ratio:Number(fill.getAttribute('data-token-ratio')),width:fill.style.width,minimum:getComputedStyle(fill).minWidth,trackWidth:track.getBoundingClientRect().width,trackHeight:track.getBoundingClientRect().height,trackLeft:track.getBoundingClientRect().left,valueRight:value.getBoundingClientRect().right,title:node.getAttribute('title'),rawTitle:value.getAttribute('title'),rawLabel:value.getAttribute('aria-label'),decorative:track.getAttribute('aria-hidden'),gradient:getComputedStyle(fill).backgroundImage};}));
   const serializedControls=await page.evaluate(ratios=>ratios.map(ratio=>{const control=document.createElement('i');control.style.width=`${ratio*100}%`;return control.style.width}),data.rows.map((row:any)=>maximum>0?row.total_tokens/maximum:0));
   for(let i=0;i<actual.length;i++){
    const cell=actual[i],expected=data.rows[i].total_tokens,ratio=maximum>0?expected/maximum:0;
    assert.equal(cell.count,expected);assert.equal(cell.maximum,maximum);assert.ok(Math.abs(cell.ratio-ratio)<1e-12);
    assert.equal(cell.width,serializedControls[i],'width must match independently serialized exact API ratio; no product floor or rounding');
    assert.equal(cell.minimum,'0px');assert.equal(cell.trackWidth,50);assert.equal(cell.trackHeight,6);assert.ok(cell.trackLeft-cell.valueRight>=5.9);
    assert.equal(cell.rawTitle,String(expected));assert.equal(cell.rawLabel,String(expected));assert.equal(cell.decorative,'true');assert.match(cell.gradient,/linear-gradient/);
    if(maximum>0)assert.ok(cell.title?.startsWith(lang==='en'?'Relative to the largest':'เทียบกับจำนวน'));else assert.equal(cell.title,null);
    if(expected===1&&maximum===1000000)assert.ok(cell.title?.endsWith('0.0001%'),'tiny positive comparison must not read as zero');
   }
   assert.ok(Math.max(...actual.map(cell=>cell.trackLeft))-Math.min(...actual.map(cell=>cell.trackLeft))<1,'bars align within their column');
   const messages=lang==='en'?en:th;
   assert.deepEqual(await page.getByTestId('usage-history').locator('thead th').allTextContents(),['history.recordedAt','col.project','col.harness','history.provider','col.model','col.total','history.basis','history.kind','history.detail'].map(key=>messages[key as keyof typeof messages]));
   assert.equal(await page.getByTestId('usage-history').locator('thead th').first().getAttribute('aria-sort'),'descending');
   const firstRow=page.getByTestId('usage-history').locator('tbody tr').first();
   assert.equal(await firstRow.locator('td').nth(1).innerText(),data.rows[0].project);
   assert.equal(await firstRow.locator('td').nth(2).innerText(),data.rows[0].source_name);
   assert.equal(await firstRow.locator('.qp-history-model-name').innerText(),data.rows[0].model);
   assert.equal(await firstRow.locator('td').nth(7).innerText(),messages['history.call']);
   assert.equal(data.scope.sourceId,1);assert.equal(data.scope.sessionId,1);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,name+' document overflow');
   return{maximum,rows:actual.length,smallestPositiveRatio:actual.some(cell=>cell.count>0)?Math.min(...actual.filter(cell=>cell.count>0).map(cell=>cell.ratio)):null};
  }
  const firstReady=response();await page.goto(base+'/'+hash);const first=await(await firstReady).json();assert.equal(first.total,56);assert.equal(first.rows.length,50);const firstCheck=await check(first);assert.equal(firstCheck.maximum,100);
  await page.evaluate(()=>document.fonts.ready);if(width<1280)await page.locator('.qp-history-token-bar').first().scrollIntoViewIfNeeded();await page.mouse.move(0,0);await page.screenshot({path:resolve(output,name+'.png'),animations:'disabled'});
  const nextReady=response(50);await page.locator('.qp-history-pagination button').last().click();const second=await(await nextReady).json();assert.equal(second.rows.length,6);const secondCheck=await check(second);assert.equal(secondCheck.maximum,1000000);assert.equal(secondCheck.smallestPositiveRatio,0.000001);
  const tinyReady=response();await page.goto(base+'/'+hash+'&model=tokens-1');const tiny=await(await tinyReady).json();assert.equal(tiny.total,11);const tinyCheck=await check(tiny);assert.equal(tinyCheck.maximum,1);
  const zeroReady=response();await page.goto(base+'/'+hash+'&model=tokens-0');const zero=await(await zeroReady).json();assert.equal(zero.total,11);const zeroCheck=await check(zero);assert.equal(zeroCheck.maximum,0);
  cases.push({name,first:firstCheck,second:secondCheck,filtered:tinyCheck,zero:zeroCheck,paging:true,exactScope:true,rawNumbersRetained:true});await context.close();
 }
 const legacy=await browser.newPage({viewport:{width:1672,height:941}});await legacy.goto(base+'/?mode=legacy'+hash);await legacy.getByTestId('usage-history').locator('tbody tr').first().waitFor();assert.equal(await legacy.locator('.qp-history-token-comparison').count(),0);const oldRow=legacy.getByTestId('usage-history').locator('tbody tr').first();assert.equal(await oldRow.locator('td').nth(6).innerText(),'100');assert.equal(await oldRow.locator('td').nth(2).innerText(),'Token fixture');assert.equal(await oldRow.locator('td').nth(3).innerText(),'Token project');await legacy.close();
 assert.deepEqual(errors,[]);assert.equal(cases.length,16);
 writeFileSync(resolve(output,'verification.json'),JSON.stringify({productionIndexSha256:createHash('sha256').update(readFileSync(resolve(root,'packages/web/dist/index.html'))).digest('hex'),cases,legacyPreserved:true,errors},null,2)+'\n');console.log('PASS16 compiled token-bar cases: pagination, filters, zero, tiny values, raw labels and legacy');
}finally{await browser?.close();await app.close();db.close();}
