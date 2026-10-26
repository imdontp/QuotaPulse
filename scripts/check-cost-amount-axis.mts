/** Compiled Cost axis readability over owned SQLite and real HTTP; no customer reads. */
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

const root=fileURLToPath(new URL('..',import.meta.url));
const output=resolve(root,process.env.QP_COST_AXIS_OUTPUT??'screens/cost-amount-axis');mkdirSync(output,{recursive:true});
const now=Date.parse('2025-05-17T13:42:00Z'),from=now-86400000,token='owned-cost-axis',base='http://127.0.0.1:7838';
const db=openDb(':memory:');
const amounts=[.0123,.0000123,.0000000123,12.3,0];
const source=db.prepare("INSERT INTO source(id,harness,profile,root_path,display_name,detected_at) VALUES(?,'codex',?,'/synthetic/nonexistent',?,0)");
const event=db.prepare("INSERT INTO usage_event(source_id,dedup_key,ts,model,provider,total_tokens,call_count,cost_usd,cost_source) VALUES(?,?,?,'Axis model','openai',100,?,?,?)");
amounts.forEach((amount,index)=>{const id=index+1;source.run(id,'axis-'+id,'Axis source '+id);event.run(id,'api-'+id,from+3600000,2,amount,'computed');event.run(id,'native-'+id,from+7200000,3,.00000456,'native');});
const webRoot=resolve(root,'packages/web/dist'),productionIndexSha256=createHash('sha256').update(readFileSync(resolve(webRoot,'index.html'))).digest('hex');
const app=buildServer(db,new Scheduler(db,[]),{token,port:7838,webRoot});
let browser:Awaited<ReturnType<typeof chromium.launch>>|undefined,current:Page|undefined;
const cases:unknown[]=[],errors:string[]=[],external:string[]=[];
async function dateAxis(page:Page){
 await page.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve()))));
 const axis=page.locator('.qp-cost-plot-dates');
 assert.equal(await axis.locator('time').first().getAttribute('datetime'),new Date(from).toISOString());assert.equal(await axis.locator('time').last().getAttribute('datetime'),new Date(now).toISOString());
 const state=await axis.evaluate(axis=>{
  const all=[...axis.querySelectorAll('time')],nodes=all.filter(n=>getComputedStyle(n).display!=='none'&&getComputedStyle(n).visibility!=='hidden'),boxes=nodes.map(n=>n.getBoundingClientRect());
  return{endpoints:nodes.includes(all[0]!)&&nodes.includes(all.at(-1)!),collision:boxes.some((a,i)=>boxes.slice(i+1).some(b=>a.right>b.left+1&&b.right>a.left+1&&a.bottom>b.top+1&&b.bottom>a.top+1))};
 });
 assert.equal(state.endpoints,true,'Exact selected time endpoints must remain visible');assert.equal(state.collision,false,'Date/time labels must not overlap');
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
}
async function check(page:Page,sourceId:number,basis:'api'|'native',lang:'en'|'th',currency:'USD'|'THB'){
 const pending=page.waitForResponse(r=>r.url().includes('/api/cost-analysis?')&&r.ok());
 await page.goto(base+`/#cost?range=custom&from=${from}&to=${now}&source=${sourceId}&basis=${basis}&bucket=hour`);
 const data=await(await pending).json();await page.locator('.qp-cost-axis[data-axis=amount]>span').first().waitFor();
 const expected=basis==='api'?amounts[sourceId-1]!:.00000456;assert.equal(data.totals.amount,expected);
 const axis=page.locator('.qp-cost-axis[data-axis=amount]');
 const ticks=await axis.locator(':scope>span').evaluateAll(nodes=>nodes.map(node=>({value:Number(node.getAttribute('data-value')),label:node.textContent??''})));
 assert.equal(ticks.length,5);assert.deepEqual(ticks.map(t=>t.value),[expected,expected*.75,expected*.5,expected*.25,0]);
 if(expected>0)assert.equal(new Set(ticks.map(t=>t.label)).size,5,'Distinct monetary tick values need distinct displayed labels');
 else assert.ok(ticks.every(t=>t.value===0),'A real zero must not acquire an invented nonzero scale');
 assert.equal(await axis.getAttribute('data-size-label'),ticks.map(t=>t.label).join('\n'));
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 const overlapping=await page.locator('.qp-cost-plot').evaluate(plot=>{const chart=plot.querySelector('.qp-cost-chart')!.getBoundingClientRect();return [...plot.querySelectorAll('.qp-cost-axis>span')].some(node=>{const r=node.getBoundingClientRect(),parent=node.parentElement!.getBoundingClientRect();return r.left<parent.left-.5||r.right>parent.right+.5||(node.parentElement!.getAttribute('data-axis')==='amount'?r.right>chart.left:r.left<chart.right);});});assert.equal(overlapping,false,'Axis text must remain in its own region');
 await dateAxis(page);
 const plot=page.locator('.qp-cost-chart');await plot.focus();await page.keyboard.press('Home');await page.keyboard.press('ArrowRight');if(basis==='native')await page.keyboard.press('ArrowRight');
 const tooltip=page.locator('.qp-cost-inspection-tooltip');await tooltip.waitFor();assert.equal(Number(await tooltip.locator('[data-amount]').getAttribute('data-amount')),expected);
 assert.equal(await tooltip.locator('[data-amount] .qp-cost-value>span').first().innerText(),new Intl.NumberFormat(lang==='th'?'th-TH':'en-US',{style:'currency',currency}).format(currency==='THB'?expected*37.25:expected));
 await page.keyboard.press('Escape');assert.equal(await tooltip.count(),0);
 return {sourceId,basis,amount:expected,ticks};
}
try{
 await app.listen({host:'127.0.0.1',port:7838});browser=await chromium.launch({channel:'chrome',headless:true});
 for(const lang of ['en','th']as const)for(const theme of ['dark','light'])for(const width of [390,900,1280,1672])for(const currency of ['USD','THB']as const){
  const context=await browser.newContext({viewport:{width,height:941},timezoneId:'Asia/Bangkok',reducedMotion:'reduce'}),page=await context.newPage();current=page;
  page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(new URL(r.url()).origin!==base)external.push(r.url());});
  await page.addInitScript(({lang,theme,currency,token})=>{(window as any).__QUOTAPULSE_TOKEN__=token;localStorage.setItem('quotapulse-prefs',JSON.stringify({lang,currency,rate:37.25,hiddenSubscriptions:[]}));localStorage.setItem('quotapulse-theme',theme);},{lang,theme,currency,token});await installBrowserFixedDate(page,now);
  const api=await check(page,1,'api',lang,currency),native=await check(page,1,'native',lang,currency),extra=[];
  if(width===390&&theme==='dark')for(const id of [2,3,4,5])extra.push(await check(page,id,'api',lang,currency));
  if(width===1672&&currency==='USD')for(const resizedWidth of [390,900,1672]){await page.setViewportSize({width:resizedWidth,height:941});await dateAxis(page);}
  await check(page,1,'api',lang,currency);await page.locator('.qp-cost-chart').evaluate(el=>(el as HTMLElement).blur());await page.screenshot({path:resolve(output,`${lang}-${theme}-${width}-${currency}.png`),animations:'disabled'});
  cases.push({lang,theme,width,currency,api,native,extra});await context.close();current=undefined;
 }
 assert.equal(cases.length,32);assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
 writeFileSync(resolve(output,'verification.json'),JSON.stringify({productionIndexSha256,cases,errors,external},null,2)+'\n');console.log('PASS80 monetary-axis cases: exact ticks, distinct labels, currencies/locales/themes/widths, zero/small/scientific values, unchanged tooltip and no overflow');
}catch(error){if(current&&!current.isClosed()){await current.screenshot({path:resolve(output,'failure.png'),animations:'disabled'}).catch(()=>{});const ticks=await current.locator('.qp-cost-axis[data-axis=amount]>span').allTextContents();writeFileSync(resolve(output,'failure.json'),JSON.stringify({productionIndexSha256,error:String(error),ticks,cases},null,2)+'\n');}throw error;}
finally{await browser?.close();await app.close();db.close();}
