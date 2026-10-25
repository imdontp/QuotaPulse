/** Real compiled Models table, owned HTTP and in-memory SQLite; no customer data. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync,readFileSync,writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium,type Page } from 'playwright';
import { openDb } from '../packages/daemon/src/db/index.js';
import { buildServer } from '../packages/daemon/src/api/server.js';
import { Scheduler } from '../packages/daemon/src/ingest/scheduler.js';
const root=fileURLToPath(new URL('..',import.meta.url)),output=resolve(root,'screens/model-ratio-bars');mkdirSync(output,{recursive:true});
const db=openDb(':memory:'),now=Date.now();
db.exec(`INSERT INTO source(id,harness,profile,root_path,display_name,detected_at) VALUES(1,'codex','qa','/synthetic/nonexistent','Ratio A',0),(2,'hermes','qa','/synthetic/nonexistent','Ratio B',0);INSERT INTO session(id,source_id,native_session_id,project) VALUES(1,1,'ratio-a','Ratio project'),(2,2,'ratio-b','Ratio project')`);
const usage=db.prepare('INSERT INTO usage_event(source_id,session_id,dedup_key,ts,model,provider,input_tokens,cached_input_tokens,cache_write_tokens,output_tokens,total_tokens,call_count,cost_usd,cost_source) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
let ordinal=0;
function add(model:string,source:number,input:number,cached:number,write:number,output:number,calls:number,cost:number|null,basis:string){usage.run(source,source,'ratio-'+ ++ordinal,now-ordinal*1000,model,source===1?'openai':'anthropic',input,cached,write,output,input+cached+write+output,calls,cost,basis)}
add('Partial',1,40,40,20,10,4,.4,'native');add('Partial',1,100,0,0,0,6,null,'unknown');
add('Zero',1,100,0,0,0,3,null,'unknown');add('Full',2,0,100,0,0,2,.02,'computed');add('Unknown',2,0,0,0,10,0,null,'unknown');
add('Tiny cache',1,999999,1,0,0,1,.1,'computed');add('Tiny coverage',1,10000,0,0,0,1,.1,'native');add('Tiny coverage',1,1,0,0,0,999999,null,'unknown');
const expected:Record<string,[number|null,number|null]>={Partial:[20,40],Zero:[0,0],Full:[100,100],Unknown:[null,null],'Tiny cache':[1/1000000*100,100],'Tiny coverage':[0,1/1000000*100]};
const app=buildServer(db,new Scheduler(db,[]),{token:'owned-model-ratios',port:7833,webRoot:resolve(root,'packages/web/dist')}),base='http://127.0.0.1:7833';
let browser:Awaited<ReturnType<typeof chromium.launch>>|undefined,current:Page|undefined;const cases:object[]=[],errors:string[]=[];
try{
 await app.listen({host:'127.0.0.1',port:7833});browser=await chromium.launch({channel:'chrome',headless:true});
 for(const lang of ['en','th'])for(const theme of ['dark','light'])for(const width of [390,900,1280,1672]){
  const name=`${lang}-${theme}-${width}`,context=await browser.newContext({viewport:{width,height:941},reducedMotion:'reduce',deviceScaleFactor:1,timezoneId:'Asia/Bangkok'}),page=await context.newPage();current=page;
  page.on('pageerror',error=>errors.push(name+': '+error.message));await page.addInitScript(({lang,theme})=>{(window as any).__QUOTAPULSE_TOKEN__='owned-model-ratios';localStorage.setItem('quotapulse-prefs',JSON.stringify({lang,currency:'USD',rate:1,hiddenSubscriptions:[]}));localStorage.setItem('quotapulse-theme',theme)},{lang,theme});
  await page.goto(base+'/#models?range=all');await page.locator('.qp-model-table-wrap tbody tr').nth(5).waitFor();const rows=page.locator('.qp-model-table-wrap tbody tr');assert.equal(await rows.count(),6);
  const facts=[];
  for(const [model,values]of Object.entries(expected)){
   const row=rows.filter({has:page.getByRole('button',{name:model,exact:true})});assert.equal(await row.count(),1);
   for(const [index,kind]of ['cache','coverage'].entries()){
    const value=values[index],cell=row.locator('td').nth(index+6),metric=cell.locator('.qp-model-ratio');
    if(value===null){assert.equal((await cell.innerText()).trim(),'—');assert.equal(await cell.locator('.qp-bar').count(),0);facts.push({model,kind,unknown:true});continue;}
    assert.equal(await metric.getAttribute('data-ratio-kind'),kind);assert.equal(Number(await metric.getAttribute('data-ratio-value')),value);
    const geometry=await metric.evaluate((node,expected)=>{const track=node.querySelector<HTMLElement>('.qp-bar')!,fill=track.firstElementChild as HTMLElement,text=node.firstElementChild!;const control=document.createElement('i');control.style.width=`${Math.max(0,Math.min(100,expected))}%`;return{track:track.getBoundingClientRect().toJSON(),fill:fill.getBoundingClientRect().toJSON(),text:text.getBoundingClientRect().toJSON(),requested:fill.style.width,independentCssom:control.style.width,shadow:getComputedStyle(fill).boxShadow,gradient:getComputedStyle(fill).backgroundImage,overflow:getComputedStyle(track).overflow,minWidth:getComputedStyle(fill).minWidth,caption:text.textContent};},value);
    assert.equal(geometry.requested,geometry.independentCssom,'exact API ratio serialization without a fill floor');assert.equal(geometry.minWidth,'0px');assert.ok(Math.abs(geometry.fill.width-geometry.track.width*value/100)<=1/64+1e-7,'geometry must match browser subpixel quantization');
    if(value===0){assert.equal(geometry.fill.width,0);assert.equal(geometry.shadow,'none');}if(value===100)assert.equal(geometry.fill.width,geometry.track.width);
    if(value>0&&value<1){assert.ok(geometry.caption!.includes('0.0001%'));assert.ok((await metric.getAttribute('title'))!.includes('0.0001%'));}
    if(width===1672&&theme==='dark'){
     assert.equal(geometry.track.height,6);assert.equal(geometry.track.width,kind==='cache'?80:50);assert.equal(geometry.overflow,'visible');
     assert.ok(geometry.gradient.includes(kind==='cache'?'rgb(101, 95, 250)':'rgb(0, 223, 189)'));if(kind==='coverage')assert.ok(Math.abs(geometry.text.y+geometry.text.height/2-geometry.track.y-3)<1);
    }else{assert.equal(geometry.track.height,4);assert.equal(geometry.track.width,width>=1536?48:56);}
    facts.push({model,kind,value,...geometry});
   }
  }
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.screenshot({path:resolve(output,name+'.png'),animations:'disabled'});
  const tinyCache=rows.filter({has:page.getByRole('button',{name:'Tiny cache',exact:true})}).getByRole('button');await tinyCache.focus();await page.keyboard.press('Enter');await page.waitForFunction(()=>document.querySelector('.qp-model-detail h3')?.textContent==='Tiny cache');await page.waitForFunction(()=>document.querySelector('.qp-model-recorded-facts')?.textContent?.includes('0.0001%'));
  const tinyCoverage=rows.filter({has:page.getByRole('button',{name:'Tiny coverage',exact:true})}).getByRole('button');await tinyCoverage.focus();await page.keyboard.press('Enter');await page.waitForFunction(()=>document.querySelector('.qp-model-detail h3')?.textContent==='Tiny coverage');assert.ok((await page.locator('.qp-model-detail-stats>div').nth(2).innerText()).includes('0.0001%'));
  const href=await page.locator('.qp-model-detail>section').first().locator('a').getAttribute('href');const params=new URLSearchParams(href!.split('?')[1]);assert.equal(params.get('model'),'Tiny coverage');assert.equal(params.get('provider'),'openai');
  cases.push({name,facts,zeroAndUnknownDistinct:true,tinyDetailsConsistent:true,keyboardSelection:true,exactHistoryScope:true,noPageOverflow:true});await context.close();current=undefined;
 }
 assert.equal(cases.length,16);assert.deepEqual(errors,[]);writeFileSync(resolve(output,'verification.json'),JSON.stringify({productionIndexSha256:createHash('sha256').update(readFileSync(resolve(root,'packages/web/dist/index.html'))).digest('hex'),cases,errors},null,2)+'\n');console.log('PASS16 Models ratio cases: weighted coverage, cache denominator, zero/unknown/tiny, geometry and selection');
}catch(error){if(current&&!current.isClosed()){await current.screenshot({path:resolve(output,'failure.png'),animations:'disabled'}).catch(()=>{});writeFileSync(resolve(output,'failure.json'),JSON.stringify({url:current.url(),body:await current.locator('body').innerText(),error:String(error),completed:cases},null,2)+'\n');}throw error;}
finally{await browser?.close();await app.close();db.close();}
