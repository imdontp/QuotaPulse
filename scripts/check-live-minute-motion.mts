/** Compiled minute-chart motion, actual memory API/SSE; synthetic observations only. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, type Page } from 'playwright';
import { openDb } from '../packages/daemon/src/db/index.js';
import { buildServer } from '../packages/daemon/src/api/server.js';
import { Scheduler } from '../packages/daemon/src/ingest/scheduler.js';
import { en } from '../packages/web/src/i18n/en.js';
const root=fileURLToPath(new URL('..',import.meta.url));
const output=resolve(root,'screens/live-minute-motion');mkdirSync(output,{recursive:true});rmSync(resolve(output,'verification.json'),{force:true});
const db=openDb(':memory:');const now=Date.now(),from=Math.floor(now/60000)*60000-30*60000,to=from+31*60000;
const changedAt=from+10*60000,anchorAt=from+2*60000;
for(const id of [1,2]){
 db.prepare('INSERT INTO source(id,harness,profile,root_path,display_name,detected_at) VALUES(?,?,?,?,?,?)').run(id,'codex','synthetic-'+id,'/synthetic/nonexistent','Synthetic '+id,now);
 db.prepare('INSERT INTO session(id,source_id,native_session_id,project,last_seen_at) VALUES(?,?,?,?,?)').run(id,id,'minute-motion-'+id,'Synthetic',now);
}
const insert=db.prepare('INSERT INTO usage_event(source_id,session_id,dedup_key,ts,model,provider,total_tokens,input_tokens,output_tokens,call_count,cost_source) VALUES(?,?,?,?,?,?,?,?,?,1,?)');let serial=0;
const add=(tokens:number,source=1,at=changedAt)=>insert.run(source,source,'minute-motion-'+serial++,at,source===1?'synthetic-model':'scope-two','openai',tokens,tokens*.6,tokens*.4,'unknown');
for(const id of [1,2]){add(1000,id,anchorAt);add(400,id)}
const scheduler=new Scheduler(db,[],{pollMs:1_000_000,detectMs:1_000_000});
const server=buildServer(db,scheduler,{token:'minute-motion-synthetic',port:7816,webRoot:resolve(root,'packages/web/dist')});
let browser:Awaited<ReturnType<typeof chromium.launch>>|undefined,page:Page|undefined;
const stages:any[]=[],errors:string[]=[],forbidden:string[]=[];
const notify=()=>scheduler.emit('data',{newEvents:1,newLimits:0,trigger:'synthetic-motion'});
const waitValue=(value:number)=>page!.waitForFunction(({at,value})=>document.querySelector(`.qp-live-flow-total circle[data-at="${at}"]`)?.getAttribute('data-value')===String(value),{at:changedAt,value});
async function prepare(label:string,target:number|null){
 await page!.evaluate(({at,anchorAt,label,target,pauseName})=>{
  let region=document.querySelector('.qp-live-token-flow')!;
  let circle=region.querySelector(`circle[data-series=total][data-at="${at}"]`)! as SVGCircleElement;
  let anchor=region.querySelector(`circle[data-series=total][data-at="${anchorAt}"]`)! as SVGCircleElement;
  const probe={label,target,oldValue:Number(circle.getAttribute('data-value')),oldY:circle.cy.animVal.value,samples:[] as any[],animations:[] as any[],done:false,started:false};
  (window as any).__minuteProbe=probe;let start=0;
  const sample=()=>{if(!circle.isConnected){probe.done=true;observer.disconnect();return}probe.samples.push({ms:performance.now()-start,y:circle.cy.animVal.value,baseY:circle.cy.baseVal.value,value:Number(circle.getAttribute('data-value')),anchorY:anchor.cy.animVal.value,maximum:region.getAttribute('data-maximum'),axes:[...region.querySelectorAll('.qp-live-flow-y-axis,.qp-live-flow-axis')].map(e=>e.textContent).join('|')});if(performance.now()-start<450)requestAnimationFrame(sample);else{probe.done=true;observer.disconnect()}};
  const observer=new MutationObserver(records=>{
   const current=document.querySelector('.qp-live-token-flow');if(current){region=current;circle=region.querySelector(`circle[data-series=total][data-at="${at}"]`)! as SVGCircleElement;anchor=region.querySelector(`circle[data-series=total][data-at="${anchorAt}"]`)! as SVGCircleElement;}
   for(const record of records)for(const node of record.addedNodes)if(node instanceof SVGElement&&node.tagName==='animate')probe.animations.push({attribute:node.getAttribute('attributeName'),duration:node.getAttribute('dur'),repeat:node.getAttribute('repeatCount'),fill:node.getAttribute('fill'),spline:node.getAttribute('keySplines')});
   if((window as any).__minuteCancelOnBegin==='pause'&&probe.animations.length){(window as any).__minuteCancelOnBegin=null;const button=[...document.querySelectorAll('button')].find(b=>b.textContent?.trim()===pauseName);button?.click()}
   if(circle?.isConnected&&!probe.started&&(target===null||circle.getAttribute('data-value')===String(target))){probe.started=true;start=performance.now();requestAnimationFrame(sample)}
  });observer.observe(document.body,{attributes:true,childList:true,subtree:true});
  if(target===null){probe.started=true;start=performance.now();requestAnimationFrame(sample)}
 },{at:changedAt,anchorAt,label,target,pauseName:en['redesign.livePause']});
}
async function collect(label:string,animated:boolean|'cancelled'){
 await page!.waitForFunction(()=>(window as any).__minuteProbe?.done,{},{timeout:15000});
 const proof=await page!.evaluate(()=>(window as any).__minuteProbe);assert.equal(proof.label,label);assert.ok(proof.samples.length>2,label+': real frame samples');
 const final=proof.samples.at(-1);assert.ok(Math.abs(final.y-final.baseY)<.0001,label+': final accepted ordinate');
 assert.ok(proof.samples.every((s:any)=>Math.abs(s.anchorY-proof.samples[0].anchorY)<.0001),label+': unchanged anchor stays fixed');assert.ok(proof.samples.every((s:any)=>s.axes===proof.samples[0].axes),label+': axes stable during transition');
 if(animated){assert.ok(proof.animations.length>0,label+': one finite transition');if(animated!=='cancelled')assert.ok(proof.samples.some((s:any)=>Math.abs(s.y-s.baseY)>.001&&Math.abs(s.y-proof.oldY)>.001),label+': actual interpolated ordinate');for(const a of proof.animations){assert.equal(a.duration,'180ms');assert.equal(a.repeat,'1');assert.equal(a.fill,'remove')}}else assert.equal(proof.animations.length,0,label+': immediate/no replay');
 assert.equal(await page!.locator('.qp-live-token-flow animate').count(),0,label+': completed handles removed');stages.push(proof);
}
async function update(label:string,target:number,delta:number,animated:boolean,source=1){await prepare(label,target);add(delta,source);notify();await waitValue(target);await collect(label,animated)}
try{
 await server.listen({host:'127.0.0.1',port:7816});browser=await chromium.launch({channel:'chrome',headless:true,args:['--disable-gpu','--force-color-profile=srgb']});
 page=await browser.newPage({viewport:{width:1672,height:941},reducedMotion:'no-preference',timezoneId:'Asia/Bangkok'});page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',route=>{const r=route.request(),u=new URL(r.url());if(u.origin!=='http://127.0.0.1:7816'||u.pathname.startsWith('/api/')&&r.method()!=='GET'){forbidden.push(r.method()+' '+u.pathname);return route.abort()}return route.continue()});
 await page.addInitScript('globalThis.__name = value => value');
 await page.addInitScript(()=>{const Native=window.IntersectionObserver;(window as any).__minuteVisibility=[];window.IntersectionObserver=class extends Native{constructor(callback:IntersectionObserverCallback,options?:IntersectionObserverInit){super((entries,observer)=>{for(const e of entries)if(e.target.classList.contains('qp-live-flow-canvas'))(window as any).__minuteVisibility.push({at:performance.now(),visible:e.isIntersecting,hidden:document.hidden,reduced:matchMedia('(prefers-reduced-motion: reduce)').matches,rect:e.boundingClientRect.toJSON()});callback(entries,observer)},options)}}});
 await page.addInitScript(()=>{(window as any).__QUOTAPULSE_TOKEN__='minute-motion-synthetic';localStorage.setItem('quotapulse-theme','dark');localStorage.setItem('quotapulse-prefs',JSON.stringify({lang:'en',currency:'USD',rate:1,hiddenSubscriptions:[]}))});await page.clock.setFixedTime(now);
 await page.goto('http://127.0.0.1:7816/#live?model=synthetic-model');await waitValue(400);await page.locator('.qp-live-token-flow').scrollIntoViewIfNeeded();await page.waitForTimeout(100);assert.equal(await page.locator('.qp-live-token-flow animate').count(),0,'Initial snapshot does not replay');
 await update('changed-common-bucket',500,100,true);

 await prepare('duplicate-snapshot',null);const duplicate=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/trend');notify();await (await duplicate).finished();await collect('duplicate-snapshot',false);
 await prepare('pause-cancels-active',520);await page.evaluate(()=>(window as any).__minuteCancelOnBegin='pause');add(20);notify();await waitValue(520);await collect('pause-cancels-active','cancelled');add(5);notify();await page.waitForTimeout(300);assert.equal(await page.locator(`.qp-live-flow-total circle[data-at="${changedAt}"]`).getAttribute('data-value'),'520','Pause freezes accepted snapshot');
 await prepare('resume-no-backlog',525);await page.getByRole('button',{name:en['redesign.liveResume'],exact:true}).click();await waitValue(525);await collect('resume-no-backlog',false);await update('fresh-after-resume',550,25,true);
 await page.emulateMedia({reducedMotion:'reduce'});await update('reduced-immediate',575,25,false);await page.emulateMedia({reducedMotion:'no-preference'});await update('preference-return-no-replay',600,25,false);await update('fresh-after-preference',625,25,true);
 // Real IntersectionObserver loss, without altering actual values or chart geometry.
 await page.locator('.qp-live-flow-canvas').evaluate(e=>(e as HTMLElement).style.transform='translateY(2500px)');await page.waitForTimeout(100);await update('offscreen-immediate',650,25,false);await page.locator('.qp-live-flow-canvas').evaluate(e=>(e as HTMLElement).style.transform='');await page.locator('.qp-live-token-flow').scrollIntoViewIfNeeded();await page.waitForTimeout(100);await update('intersection-return-no-replay',675,25,false);await update('fresh-after-intersection',700,25,true);
 // Explicit browser signal simulation; native minimize/hide is a separate gate.
 await page.evaluate(()=>{(window as any).__minuteHidden=true;Object.defineProperty(document,'hidden',{configurable:true,get:()=>(window as any).__minuteHidden});Object.defineProperty(document,'visibilityState',{configurable:true,get:()=>(window as any).__minuteHidden?'hidden':'visible'});document.dispatchEvent(new Event('visibilitychange'))});add(25);notify();await page.waitForTimeout(300);assert.equal(await page.locator(`.qp-live-flow-total circle[data-at="${changedAt}"]`).getAttribute('data-value'),'700','Hidden refresh remains suspended');await prepare('visibility-return-no-replay',725);await page.evaluate(()=>{(window as any).__minuteHidden=false;document.dispatchEvent(new Event('visibilitychange'))});await waitValue(725);await collect('visibility-return-no-replay',false);await update('fresh-after-visibility',775,50,true);
 await update('changed-maximum-snaps-domain',1500,725,false);
 await prepare('scope-change-does-not-borrow',400);await page.evaluate(()=>{location.hash='live?model=scope-two'});await waitValue(400);await collect('scope-change-does-not-borrow',false);
 await page.evaluate(()=>{(window as any).__detachedMinuteRoot=document.querySelector('.qp-live-token-flow');location.hash='models'});await page.getByTestId('production-models').waitFor();add(25,2);notify();await page.waitForTimeout(300);assert.equal(await page.evaluate(()=>(window as any).__detachedMinuteRoot.querySelectorAll('animate').length),0,'Unmount removes transient motion handles');
 assert.deepEqual(errors,[]);assert.deepEqual(forbidden,[]);writeFileSync(resolve(output,'verification.json'),JSON.stringify({productionIndexSha256:createHash('sha256').update(readFileSync(resolve(root,'packages/web/dist/index.html'))).digest('hex'),browser:browser.version(),fixture:'Synthetic memory DB; actual local API/SSE. Visibility signal explicitly emulated; real native lifecycle unproven.',stages,initialNoReplay:true,pauseFrozen:true,sameDocumentUnmount:true,errors,forbidden},null,2));console.log('Minute changed-point interpolation, stable axes, finite cleanup, pause, reduced, intersection, emulated visibility, scope and unmount passed.');
}catch(error){if(page&&!page.isClosed()){await page.screenshot({path:resolve(output,'failure.png')}).catch(()=>{});writeFileSync(resolve(output,'failure.json'),JSON.stringify({error:String((error as Error).stack??error),stages,probe:await page.evaluate(()=>(window as any).__minuteProbe).catch(()=>null),visibility:await page.evaluate(()=>(window as any).__minuteVisibility).catch(()=>null)},null,2))}throw error}finally{await browser?.close();await server.close();db.close()}
