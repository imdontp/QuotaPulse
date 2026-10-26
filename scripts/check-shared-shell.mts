/** Compiled shared shell contracts; owned empty SQLite, local HTTP only. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium,type Page} from 'playwright';
import {openDb} from '../packages/daemon/src/db/index.js';
import {buildServer} from '../packages/daemon/src/api/server.js';
import {Scheduler} from '../packages/daemon/src/ingest/scheduler.js';
import {en} from '../packages/web/src/i18n/en.ts';
import {th} from '../packages/web/src/i18n/th.ts';

const root=fileURLToPath(new URL('..',import.meta.url)),output=resolve(root,'screens/shared-shell');mkdirSync(output,{recursive:true});
const base='http://127.0.0.1:7840',token='owned-shared-shell',webRoot=resolve(root,'packages/web/dist');
const db=openDb(':memory:'),app=buildServer(db,new Scheduler(db,[]),{token,port:7840,webRoot});
const productionIndexSha256=createHash('sha256').update(readFileSync(resolve(webRoot,'index.html'))).digest('hex');
const destinations=['overview','live','projects','models','cost','history','alerts','providers','settings'];
const viewports=[{width:390,height:941},{width:900,height:941},{width:1280,height:941},{width:1440,height:941},{width:1586,height:992},{width:1672,height:941},{width:390,height:480},{width:1280,height:600}];
let browser:Awaited<ReturnType<typeof chromium.launch>>|undefined,current:Page|undefined;
const cases:unknown[]=[],errors:string[]=[],external:string[]=[],writes:string[]=[];
async function noOverflow(page:Page){assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);const clipped=await page.locator('.qp-topbar').evaluate(el=>[...el.querySelectorAll('.qp-tools button,.qp-avatar')].some(n=>{const r=n.getBoundingClientRect();return r.left<0||r.right>innerWidth||r.top<0||r.bottom>innerHeight;}));assert.equal(clipped,false,'Theme/language/avatar must remain inside viewport');}
try{
 await app.listen({host:'127.0.0.1',port:7840});browser=await chromium.launch({channel:'chrome',headless:true});
 for(const lang of ['en','th']as const)for(const theme of ['dark','light'])for(const viewport of viewports){
  const context=await browser.newContext({viewport,reducedMotion:'reduce'}),page=await context.newPage();current=page;
  page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(new URL(r.url()).origin!==base)external.push(r.url());if(r.method()!=='GET')writes.push(r.method()+' '+r.url());});
  await page.addInitScript(({lang,theme,token})=>{(window as any).__QUOTAPULSE_TOKEN__=token;if(!localStorage.getItem('quotapulse-prefs'))localStorage.setItem('quotapulse-prefs',JSON.stringify({lang,currency:'THB',rate:37.25,hiddenSubscriptions:[]}));if(!localStorage.getItem('quotapulse-theme'))localStorage.setItem('quotapulse-theme',theme);},{lang,theme,token});
  const inspected=[];
  for(const destination of ['overview','providers','cost','settings']){
   await page.goto(base+'/#'+destination);await page.locator('main h1').waitFor();await page.evaluate(()=>document.fonts.ready);
   const nav=page.locator('.qp-sidebar nav'),links=nav.locator('a');assert.equal(await links.count(),9);
   const actual=await links.evaluateAll(nodes=>nodes.map(n=>(n.getAttribute('href')??'').slice(1).split('?')[0]));assert.deepEqual(actual,destinations);
   for(const link of await links.all())assert.equal(await link.isVisible(),true,'Destination must be visible without opening More');
   assert.equal(await nav.locator('details').count(),0);assert.equal(await nav.locator('a[aria-current=page]').getAttribute('data-nav-id'),destination);assert.equal(await nav.locator('a[data-nav-id=cost]').getAttribute('href'),'#cost?range=month');
   const before=await page.evaluate(()=>({hash:location.hash,prefs:localStorage.getItem('quotapulse-prefs'),theme:localStorage.getItem('quotapulse-theme'),lang:document.documentElement.lang}));
   assert.equal(await page.locator('.qp-brand').evaluate(el=>el.tagName),'DIV');assert.equal(await page.locator('.qp-brand a,.qp-brand button').count(),0);const avatar=page.locator('.qp-avatar');assert.equal(await avatar.getAttribute('role'),'img');assert.equal(await avatar.getAttribute('tabindex'),null);assert.equal(await avatar.innerText(),'Q');
   await avatar.click();await page.locator('.qp-brand').click();assert.deepEqual(await page.evaluate(()=>({hash:location.hash,prefs:localStorage.getItem('quotapulse-prefs'),theme:localStorage.getItem('quotapulse-theme'),lang:document.documentElement.lang})),before);
   const settings=nav.locator('a[data-nav-id=settings]');await settings.focus();await settings.scrollIntoViewIfNeeded();assert.equal(await settings.evaluate(el=>getComputedStyle(el).outlineStyle),'solid');const box=await settings.boundingBox();assert.ok(box&&box.y>=0&&box.y+box.height<=viewport.height+1,'Settings must be reachable in a short sidebar');
   await noOverflow(page);inspected.push(destination);
  }
  const language=page.locator('.qp-language-toggle');await language.focus();await page.keyboard.press('Enter');await page.waitForFunction(expected=>document.documentElement.lang===expected,lang==='en'?'th':'en');await noOverflow(page);
  const themeButton=page.locator('.qp-theme-toggle');await themeButton.focus();await page.keyboard.press('Enter');await page.waitForFunction(expected=>document.querySelector('.qp-redesign')?.getAttribute('data-theme')===expected,theme==='dark'?'light':'dark');
  const changedPrefs=await page.evaluate(()=>JSON.parse(localStorage.getItem('quotapulse-prefs')??'{}'));assert.equal(changedPrefs.currency,lang==='th'?'USD':'THB');assert.equal(changedPrefs.rate,lang==='th'?1:37.25);
  await page.reload();await page.locator('main h1').waitFor();assert.equal(await page.locator('.qp-redesign').getAttribute('lang'),lang==='en'?'th':'en');assert.equal(await page.locator('.qp-redesign').getAttribute('data-theme'),theme==='dark'?'light':'dark');const prefs=await page.evaluate(()=>JSON.parse(localStorage.getItem('quotapulse-prefs')??'{}'));assert.deepEqual(prefs,changedPrefs);
  await language.click();await themeButton.click();await page.waitForFunction(expected=>document.documentElement.lang===expected,lang);await noOverflow(page);
  await page.locator('.qp-topbar-actions>button[aria-haspopup=dialog]').click();const messages=lang==='th'?th:en;await page.getByRole('dialog').waitFor();await page.getByRole('dialog').getByRole('button',{name:messages['redesign.provider'],exact:true}).click();await page.getByTestId('production-providers').waitFor();await noOverflow(page);
  await page.locator('.qp-sidebar a[data-nav-id=overview]').click();await page.getByTestId('production-overview').waitFor();await page.locator('.qp-sidebar').evaluate(el=>el.scrollTop=0);
  await page.screenshot({path:resolve(output,`${lang}-${theme}-${viewport.width}x${viewport.height}.png`),animations:'disabled'});cases.push({lang,theme,viewport,inspected,visibleDestinations:9,staticBrandAvatar:true,keyboardControls:true,reloadPreferences:true,commandPalette:true});await context.close();current=undefined;
 }
 assert.equal(cases.length,32);assert.deepEqual(errors,[]);assert.deepEqual(external,[]);assert.deepEqual(writes,[]);writeFileSync(resolve(output,'verification.json'),JSON.stringify({productionIndexSha256,cases,errors,external,writes},null,2)+'\n');console.log('PASS128 shared-shell route inspections,32 theme/locale/viewport contexts: stable visible navigation, static brand/avatar, keyboard language/theme, persistence, palette and short-height reachability');
}catch(error){if(current&&!current.isClosed()){await current.screenshot({path:resolve(output,'failure.png'),animations:'disabled'}).catch(()=>{});writeFileSync(resolve(output,'failure.json'),JSON.stringify({productionIndexSha256,error:String(error),url:current.url(),cases},null,2)+'\n');}throw error;}
finally{await browser?.close();await app.close();db.close();}
