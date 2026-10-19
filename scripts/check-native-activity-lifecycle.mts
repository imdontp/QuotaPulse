import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync,mkdtempSync,readFileSync,rmSync,writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { spawn, type ChildProcess } from 'node:child_process';
import { openDb } from '../packages/daemon/src/db/index.js';
import { buildServer } from '../packages/daemon/src/api/server.js';
import { Scheduler } from '../packages/daemon/src/ingest/scheduler.js';

// Exclusive native slot: real production main, synthetic daemon/profile, no Playwright or CDP.
const root=fileURLToPath(new URL('..',import.meta.url));
const runtimeRoot=process.env.QUOTAPULSE_REVIEW_ROOT?resolve(process.env.QUOTAPULSE_REVIEW_ROOT):root;
const electron=createRequire(resolve(runtimeRoot,'package.json'))('electron');
if(runtimeRoot!==root)assert.ok(electron.startsWith(runtimeRoot+'\\'),'Extracted bundle must resolve its own Electron');
const output=resolve(root,'screens/native-activity-lifecycle',runtimeRoot===root?'source':'bundle');
mkdirSync(output,{recursive:true});rmSync(resolve(output,'verification.json'),{force:true});
const profiles=resolve(root,'tmp/native-activity-lifecycle');mkdirSync(profiles,{recursive:true});
const profile=mkdtempSync(resolve(profiles,'instance-'));
writeFileSync(resolve(profile,'pet-settings.json'),JSON.stringify({schemaVersion:4,enabled:false}));
writeFileSync(resolve(profile,'window-size.json'),JSON.stringify({width:1602,height:1032}));
const db=openDb(':memory:');db.exec("INSERT INTO app_setting(id,pet_enabled,tray_animation_enabled,hidden_subscriptions,updated_at) VALUES(1,0,0,'[]',0)");
const now=Date.now();
db.exec(`INSERT INTO source(id,harness,profile,root_path,display_name,detected_at) VALUES(1,'codex','synthetic','/synthetic/nonexistent','Activity Electron fixture',0);
 INSERT INTO session(id,source_id,native_session_id,project,last_seen_at) VALUES(1,1,'activity-electron','Visibility fixture',${now});`);
const insert=db.prepare(`INSERT INTO usage_event(source_id,session_id,dedup_key,ts,model,provider,input_tokens,output_tokens,total_tokens,call_count,cost_source) VALUES(1,1,?,?,'gpt-test','openrouter',?,?,?,1,'unknown')`);
for(const [i,value] of [100,200,50].entries())insert.run('initial-'+i,now-(3-i)*60000,Math.floor(value/2),value-Math.floor(value/2),value);
const scheduler=new Scheduler(db,[],{pollMs:1000000,detectMs:1000000});
const requests:string[]=[];const daemon=buildServer(db,scheduler,{token:'activity-electron-synthetic',port:7818,webRoot:resolve(runtimeRoot,'packages/web/dist')});
daemon.addHook('onRequest',async req=>{requests.push(req.url.split('?')[0])});

interface Reply { id?: number; event?: string; ok?: boolean; value?: any; error?: string }
let child:ChildProcess|undefined;let closed=false;let terminal:{code:number|null;signal:NodeJS.Signals|null}|undefined;
let nextId=0;const pending=new Map<number,{resolve:(v:any)=>void;reject:(e:Error)=>void;timer:ReturnType<typeof setTimeout>}>();
let resolveTerminal:(v:any)=>void=()=>{};const terminalPromise=new Promise<any>(r=>{resolveTerminal=r});
let resolveReady:()=>void=()=>{},rejectReady:(e:Error)=>void=()=>{};const readyPromise=new Promise<void>((r,j)=>{resolveReady=r;rejectReady=j});readyPromise.catch(()=>{});
let stdout='',stderr='';const stages:any[]=[];let successful:any;let failed:unknown;
const rpc=(op:string,fields:Record<string,any>={},timeoutMs=20000)=>new Promise<any>((resolveRpc,rejectRpc)=>{
 if(!child?.connected||closed){rejectRpc(new Error('Owned native child is not connected'));return}
 const id=++nextId,timer=setTimeout(()=>{pending.delete(id);rejectRpc(new Error(`Private IPC ${op}/${id} timeout`))},timeoutMs);
 pending.set(id,{resolve:resolveRpc,reject:rejectRpc,timer});child.send({id,op,...fields},error=>{if(error){const p=pending.get(id);if(p){clearTimeout(p.timer);pending.delete(id);p.reject(error)}}});
});
const evaluate=async<T=any>(fn:()=>T|Promise<T>):Promise<T>=>rpc('evaluate',{source:`(${fn.toString()})()`});
const wait=async(fn:()=>boolean,label:string,timeoutMs=20000)=>{const until=Date.now()+timeoutMs;let last:any;while(Date.now()<until){last=await evaluate(fn);if(last)return;await delay(100)}throw new Error(`Native visibility predicate timeout: ${label}, last=${JSON.stringify(last)}`)};
const windowAction=(action:string,width?:number)=>rpc('action',{action,width});
const snap=async(name:string)=>{await delay(300);const renderer=await evaluate(()=>{const w=window as any,a=w.actualActivityPaint,c=document.querySelector('canvas.qp-activity-sparkline') as HTMLCanvasElement|null;return{hidden:document.hidden,visibility:document.visibilityState,clear:a?.clear??null,stroke:a?.stroke??null,events:a?.events??[],canvas:c?{width:c.width,height:c.height,pixels:c.toDataURL(),cssWidth:c.getBoundingClientRect().width}:null,values:[...document.querySelectorAll('canvas.qp-activity-sparkline+ol li')].map(el=>Number(el.getAttribute('data-value')))}});const main=await rpc('state');stages.push({name,requests:requests.length,renderer,window:main.window});return renderer};
try{
 await daemon.listen({host:'127.0.0.1',port:7818});
 writeFileSync(resolve(profile,'daemon.lock'),JSON.stringify({pid:process.pid,port:7818,token:'activity-electron-synthetic',startedAt:Date.now()}));
 const env={...process.env,QUOTAPULSE_TEST_RUNTIME_ROOT:runtimeRoot,QUOTAPULSE_DATA_DIR:profile,QUOTAPULSE_PORT:'7818',QUOTAPULSE_NODE_EXE:process.execPath,QUOTAPULSE_READERS:'off'};delete env.ELECTRON_RUN_AS_NODE;
 child=spawn(electron,[resolve(root,'scripts/native-activity-lifecycle-probe.cjs')],{env,stdio:['ignore','pipe','pipe','ipc'],windowsHide:true});
 child.stdout!.on('data',data=>{stdout+=String(data)});child.stderr!.on('data',data=>{stderr+=String(data)});
 child.on('message',(message:Reply)=>{if(message.event==='ready'){resolveReady();return}if(message.event==='fatal'){rejectReady(new Error(message.error));return}if(message.id===undefined)return;const p=pending.get(message.id);if(!p)return;clearTimeout(p.timer);pending.delete(message.id);message.ok?p.resolve(message.value):p.reject(new Error(message.error||'Native child IPC error'))});
 child.on('error',error=>{rejectReady(error);for(const p of pending.values()){clearTimeout(p.timer);p.reject(error)}pending.clear()});
 child.on('close',(code,signal)=>{closed=true;terminal={code,signal};resolveTerminal(terminal);rejectReady(new Error(`Owned child terminal before ready ${code}/${signal}`));for(const p of pending.values()){clearTimeout(p.timer);p.reject(new Error(`Owned native child closed ${code}/${signal}`))}pending.clear()});
 const readyTimeout=setTimeout(()=>rejectReady(new Error('Native child readiness timeout')),30000);try{await readyPromise}finally{clearTimeout(readyTimeout)};
 await evaluate(()=>{location.hash='overview'});
 await wait(()=>Boolean(document.querySelector('canvas.qp-activity-sparkline')),'actual Activity mount');
 await evaluate(()=>{const w=window as any;w.__name=new Function('target','return target');w.actualActivityPaint={clear:0,stroke:0,events:[]};for(const method of ['clearRect','stroke']){const old=(CanvasRenderingContext2D.prototype as any)[method];(CanvasRenderingContext2D.prototype as any)[method]=function(...args:any[]){if(this.canvas.classList.contains('qp-activity-sparkline')){w.actualActivityPaint[method==='clearRect'?'clear':'stroke']++;w.actualActivityPaint.events.push({method,hidden:document.hidden,visibility:document.visibilityState,connected:this.canvas.isConnected,at:performance.now(),values:[...document.querySelectorAll('canvas.qp-activity-sparkline+ol li')].map(el=>Number(el.getAttribute('data-value')))})}return old.apply(this,args)}}});
 const state=await windowAction('show');assert.equal(state.backgroundThrottling,true);
 await wait(()=>document.visibilityState==='visible','real BrowserWindow show visibility');
 await evaluate(()=>{document.querySelector('canvas.qp-activity-sparkline')!.scrollIntoView({block:'center'});(document.querySelector('.qp-tools button') as HTMLElement).click()});const visible=await snap('visible-actual-theme');assert.ok(visible.clear>0);
 await windowAction('hide');await wait(()=>document.hidden,'real BrowserWindow hide visibility');const hidden=await snap('actual-native-hide');
 insert.run('hidden-new-call',now,400,400,800);scheduler.emit('data',{newEvents:1,newLimits:0,trigger:'isolated-native-electron-hide'});
 await evaluate(()=>{(document.querySelector('.qp-tools button') as HTMLElement).click()});await windowAction('resize',1500);const hiddenUpdated=await snap('hidden-actual-SSE-theme-resize');assert.equal(hiddenUpdated.clear,hidden.clear);assert.equal(hiddenUpdated.stroke,hidden.stroke);
 await windowAction('show');await wait(()=>!document.hidden,'real native show after hide');await wait(()=>[...document.querySelectorAll('canvas.qp-activity-sparkline+ol li')].some(e=>Number(e.getAttribute('data-value'))>=800),'latest800 actual API bucket');
 const resumed=await snap('actual-native-show-latest-api');assert.ok(resumed.clear>hiddenUpdated.clear);assert.notEqual(resumed.canvas!.pixels,visible.canvas!.pixels);
 await delay(1000);const idleAfterShow=await snap('show-latest-settled-no-replay');assert.equal(idleAfterShow.clear,resumed.clear,'no replay paints after latest settled');assert.ok(idleAfterShow.values.includes(800));
 const nativeMinimized=await windowAction('minimize');assert.equal(nativeMinimized.minimized,true,'OS native minimize independently verified');await wait(()=>document.hidden,'real native minimize visibility');const minimized=await snap('actual-native-minimize');
 insert.run('minimized-new-call',now,450,450,900);scheduler.emit('data',{newEvents:1,newLimits:0,trigger:'isolated-native-electron-minimize'});
 await evaluate(()=>{(document.querySelector('.qp-tools button') as HTMLElement).click()});await windowAction('resize',1450);const minimizedUpdated=await snap('minimized-actual-SSE-theme-resize');assert.equal(minimizedUpdated.clear,minimized.clear);assert.equal(minimizedUpdated.stroke,minimized.stroke);
 await windowAction('restore');await wait(()=>!document.hidden,'real native restore visibility');await wait(()=>[...document.querySelectorAll('canvas.qp-activity-sparkline+ol li')].some(e=>Number(e.getAttribute('data-value'))>=1700),'latest1700 actual API bucket');const restored=await snap('actual-native-restore-latest-api');assert.ok(restored.clear>minimizedUpdated.clear);
 await delay(1000);const idleAfterRestore=await snap('restore-latest-settled-no-replay');assert.equal(idleAfterRestore.clear,restored.clear,'no replay paints after latest settled');assert.ok(idleAfterRestore.values.includes(1700));
 await evaluate(()=>{location.hash='live'});await wait(()=>Boolean(document.querySelector('[data-testid=production-live]')),'actual navigation Live');const navigated=await snap('actual-navigation-unmounted');
 await evaluate(()=>{(document.querySelector('.qp-tools button') as HTMLElement).click()});await windowAction('resize',1400);const cleanup=await snap('post-navigation-theme-resize');assert.equal(cleanup.clear,navigated.clear);assert.equal(cleanup.stroke,navigated.stroke);assert.equal(cleanup.canvas,null,'Activity route must really unmount');
 const evidence=await rpc('state');assert.deepEqual(evidence.main.preloadErrors,[]);assert.ok(evidence.main.ready>0);
 assert.equal(evidence.userData,resolve(profile,'electron'));assert.equal(evidence.sessionData,evidence.userData);
 assert.equal(evidence.window.focusable,true);
 assert.equal(evidence.window.preferences.contextIsolation,true);assert.equal(evidence.window.preferences.nodeIntegration,false);assert.equal(evidence.window.preferences.sandbox,true);
 assert.ok(stages.every(stage=>stage.renderer.events.every((event:any)=>!event.hidden&&event.connected)),'no hidden or detached Activity canvas paint');
 assert.ok(evidence.processArguments.every((arg:string)=>!arg.includes('disable-background')&&!arg.includes('disable-renderer-backgrounding')&&!arg.includes('remote-debugging')));
 successful={status:'passed',visibilityMode:'actual native BrowserWindow show/hide/minimize/restore; no Playwright/CDP/visibility emulation/background flags',indexSha256:createHash('sha256').update(readFileSync(resolve(runtimeRoot,'packages/web/dist/index.html'))).digest('hex'),stages,evidence,runtimeRoot,dashboardPreloadSha256:createHash('sha256').update(readFileSync(resolve(runtimeRoot,'packages/tray/dist-preload/dashboard-preload.js'))).digest('hex'),mainSha256:createHash('sha256').update(readFileSync(resolve(runtimeRoot,'packages/tray/dist/main.js'))).digest('hex'),limitations:['actual compiled production main/preload/web; native window visible on current desktop during this test','synthetic in-memory daemon, adapters disabled, isolated profile; not physical tray input','paint operations and accepted buckets; not CPU benchmark or exhaustive listener/timer leak coverage','hidden refresh may defer by production coordinator; latest asserted after real resume API completion; no replay means settled latest has no further paints during observed idle window','taskbar option remains actual unmodified production main; Electron has no skipTaskbar getter' ,'theme click and navigation use renderer DOM; native state uses BrowserWindow directly']};
}catch(error){failed=error;let evidence:any;try{if(child?.connected&&!closed)evidence=await rpc('state',{},3000)}catch(stateError){evidence={stateError:String(stateError)}}writeFileSync(resolve(output,'failure.json'),JSON.stringify({status:'failed',error:String((error as Error)?.stack||error),stages,evidence},null,2));
}finally{
 let cleanupError:unknown;
 try{
  if(child&&!closed){try{await rpc('close',{},3000)}catch{}
   await Promise.race([terminalPromise,delay(5000)]);
   if(!closed){child.kill();await Promise.race([terminalPromise,delay(5000)]);}
   if(!closed)throw new Error(`Owned native Electron PID${child.pid} did not reach terminal after timeout cleanup`);
  }
 }catch(error){cleanupError=error}
 try{await daemon.close()}catch(error){cleanupError??=error}finally{db.close()}
 writeFileSync(resolve(output,'stdout.log'),stdout);writeFileSync(resolve(output,'stderr.log'),stderr);
 writeFileSync(resolve(output,'process-terminal.json'),JSON.stringify({pid:child?.pid,closed,terminal,cleanupError:cleanupError?String(cleanupError):null},null,2));
 if(cleanupError)failed??=cleanupError;
}
if(failed)throw failed;
assert.ok(closed&&terminal?.code===0,'Native owned process must terminate0 before success proof');
writeFileSync(resolve(output,'verification.json'),JSON.stringify({...successful,processTerminal:{pid:child?.pid,...terminal}},null,2));
console.log('Production native Activity lifecycle passed; owned Electron terminal0.');
