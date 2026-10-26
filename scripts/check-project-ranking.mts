/** Project ranking reference content, backed by real HTTP and an owned SQLite fixture. */
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

const root=fileURLToPath(new URL('..',import.meta.url)),output=resolve(root,'screens/project-ranking');mkdirSync(output,{recursive:true});
const now=Date.parse('2025-05-17T13:42:00Z'),from=now-86400000,base='http://127.0.0.1:7839',token='owned-project-ranking',RealDate=globalThis.Date;
globalThis.Date=new Proxy(RealDate,{construct:(target,args)=>Reflect.construct(target,args.length?args:[now]),apply:()=>new RealDate(now).toString(),get:(target,key,receiver)=>key==='now'?()=>now:Reflect.get(target,key,receiver)});
const db=openDb(':memory:');db.exec("INSERT INTO source(id,harness,profile,root_path,display_name,detected_at) VALUES(1,'codex','qa','/synthetic/one','Ranking source',0),(2,'claude-code','qa','/synthetic/two','Excluded source',0)");
const names=['Ranking A','Native only','Priced zero','Estimated',null,'Excluded'];names.forEach((project,index)=>db.prepare('INSERT INTO session(id,source_id,native_session_id,project,last_seen_at) VALUES(?,?,?,?,?)').run(index+1,index===5?2:1,'ranking-'+index,project,now-30000));
const insert=db.prepare("INSERT INTO usage_event(source_id,session_id,dedup_key,ts,model,provider,total_tokens,call_count,cost_usd,cost_source) VALUES(?,?,?,?,'Ranking model','openai',?,?,?,?)");
for(const [id,tokens,calls,amount,basis]of [[1,100,2,.2,'computed'],[1,100,1,.1,'estimated'],[1,100,4,8,'native'],[1,100,3,null,'unknown'],[2,200,2,50,'native'],[3,100,1,0,'computed'],[4,50,1,.005,'estimated'],[5,50,1,.01,'computed'],[6,9000,1,999,'computed']]as const)insert.run(id===6?2:1,id,'ranking-'+id+'-'+basis,now-30000,tokens,calls,amount,basis);
const webRoot=resolve(root,'packages/web/dist'),productionIndexSha256=createHash('sha256').update(readFileSync(resolve(webRoot,'index.html'))).digest('hex');
const app=buildServer(db,new Scheduler(db,[]),{token,port:7839,webRoot});
let browser:Awaited<ReturnType<typeof chromium.launch>>|undefined,current:Page|undefined;
const cases:unknown[]=[],errors:string[]=[],external:string[]=[],writes:string[]=[];
try{
 await app.listen({host:'127.0.0.1',port:7839});browser=await chromium.launch({channel:'chrome',headless:true});
 for(const lang of ['en','th']as const)for(const theme of ['dark','light'])for(const width of [390,900,1280,1672])for(const currency of ['USD','THB']as const){
  const context=await browser.newContext({viewport:{width,height:941},timezoneId:'Asia/Bangkok',reducedMotion:'reduce'}),page=await context.newPage();current=page;const messages=lang==='th'?th:en;
  page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(new URL(r.url()).origin!==base)external.push(r.url());if(r.method()!=='GET')writes.push(r.method()+' '+r.url());});
  await page.addInitScript(({lang,theme,currency,token})=>{(window as any).__QUOTAPULSE_TOKEN__=token;localStorage.setItem('quotapulse-prefs',JSON.stringify({lang,currency,rate:37.25,hiddenSubscriptions:[]}));localStorage.setItem('quotapulse-theme',theme);},{lang,theme,currency,token});await installBrowserFixedDate(page,now);
  const pending=page.waitForResponse(r=>r.url().includes('/api/projects?detailed=1')&&r.ok());await page.goto(base+`/#projects?range=custom&from=${from}&to=${now}&source=1`);const data=await(await pending).json();assert.equal(data.totals.tokens,800);assert.equal(data.totals.calls,15);assert.equal(data.groups.length,5);
  const rows=page.locator('.qp-project-top li[data-project-key]');await rows.nth(4).waitFor();assert.equal(await rows.count(),5);assert.equal(await page.locator('.qp-project-rank-heading p').innerText(),messages['redesign.value']);
  const rendered=[];
  for(const row of await rows.all()){
   const key=JSON.parse((await row.getAttribute('data-project-key'))!),group=data.groups.find((g:any)=>g.key===key);assert.ok(group);const price=row.locator('.qp-project-rank-value'),share=row.locator('[data-share]');
   assert.equal(Number(await price.getAttribute('data-api-value')),group.api_value_usd);assert.equal(Number(await price.getAttribute('data-priced-calls')),group.computed_calls+group.estimated_calls);assert.equal(Number(await price.getAttribute('data-all-calls')),group.calls);assert.equal(Number(await row.locator('strong[data-value]').getAttribute('data-value')),group.tokens);
   assert.equal(Number(await share.getAttribute('data-share')),group.tokens/800);assert.equal(await share.innerText(),new Intl.NumberFormat(lang==='th'?'th-TH':'en-US',{style:'percent',maximumFractionDigits:1}).format(group.tokens/800));
   const money=new Intl.NumberFormat(lang==='th'?'th-TH':'en-US',{style:'currency',currency}),priced=group.computed_calls+group.estimated_calls,expected=priced===0?messages['redesign.unknownValue']:money.format(group.api_value_usd*(currency==='THB'?37.25:1))+(priced<group.calls?'+':'');
   assert.equal(await price.locator('.qp-cost-value>span').first().innerText(),expected);rendered.push({key,tokens:group.tokens,share:group.tokens/800,apiValue:group.api_value_usd,pricedCalls:priced,allCalls:group.calls,label:expected});
  }
  assert.ok(rendered.every((r,i)=>i===0||rendered[i-1]!.tokens>=r.tokens));assert.equal(rendered.find(r=>r.key==='Ranking A')!.apiValue,.2+.1);assert.equal(rendered.find(r=>r.key==='Native only')!.pricedCalls,0);
  const rank=page.locator('.qp-project-top button').filter({hasText:'Native only'});await rank.focus();await page.keyboard.press('Enter');await page.locator('.qp-project-detail h2').getByText('Native only',{exact:true}).waitFor();assert.equal(await rank.getAttribute('aria-pressed'),'true');
  if(width===390&&theme==='dark'){
   const search=page.locator('.qp-project-search input');await search.fill('Priced zero');await rows.first().waitFor();await page.waitForFunction(()=>document.querySelectorAll('.qp-project-top li').length===1);assert.equal(Number(await rows.first().locator('[data-share]').getAttribute('data-share')),.125);await search.fill('');await rows.nth(4).waitFor();
   await page.locator('button[data-tab=unassigned]').click();await page.waitForFunction(()=>document.querySelectorAll('.qp-project-top li').length===1);assert.equal(await rows.first().getAttribute('data-project-key'),'null');assert.equal(Number(await rows.first().locator('[data-share]').getAttribute('data-share')),.0625);await page.locator('button[data-tab=all]').click();await rows.nth(4).waitFor();
  }
  await page.locator('.qp-project-top').scrollIntoViewIfNeeded();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);const overflow=await page.locator('.qp-project-top').evaluate(el=>el.scrollWidth>el.clientWidth+1);assert.equal(overflow,false,'Ranking content must stay inside its panel');
  await page.screenshot({path:resolve(output,`${lang}-${theme}-${width}-${currency}.png`),animations:'disabled'});cases.push({lang,theme,width,currency,scope:data.scope,rows:rendered,keyboardSelection:true});await context.close();current=undefined;
 }
 assert.equal(cases.length,32);assert.deepEqual(errors,[]);assert.deepEqual(external,[]);assert.deepEqual(writes,[]);writeFileSync(resolve(output,'verification.json'),JSON.stringify({productionIndexSha256,cases,errors,external,writes},null,2)+'\n');console.log('PASS32 project-ranking combinations: scoped tokens/shares, separate API value, weighted partial pricing, native-only unknown, priced zero, keyboard, filters and locale/currency/layout');
}catch(error){if(current&&!current.isClosed()){await current.screenshot({path:resolve(output,'failure.png'),animations:'disabled'}).catch(()=>{});writeFileSync(resolve(output,'failure.json'),JSON.stringify({productionIndexSha256,error:String(error),url:current.url(),cases},null,2)+'\n');}throw error;}
finally{await browser?.close();await app.close();db.close();globalThis.Date=RealDate;}
