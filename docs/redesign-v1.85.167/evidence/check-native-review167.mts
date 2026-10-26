/** Real compiled daemon/main/preload/web from an unused, checkout-bound bundle. */
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { createWriteStream, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve, sep } from 'node:path';
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { _electron, type ElectronApplication, type Page } from 'playwright';

const root=fileURLToPath(new URL('..',import.meta.url));
const require=createRequire(import.meta.url);
const { inventory }=require(resolve(root,'scripts/check-release-rollback.cjs'));
const sha=(bytes:Buffer)=>createHash('sha256').update(bytes).digest('hex');
const json=(file:string)=>JSON.parse(readFileSync(file,'utf8').replace(/^\uFEFF/,''));
const input=json(process.env.QP_REVIEW_DASHBOARD_INPUT!);
function plain(file:string){let at=resolve(file);for(;;){if(existsSync(at))assert.equal(lstatSync(at).isSymbolicLink(),false,at);const up=dirname(at);if(up===at)break;at=up;}return resolve(file);}
const checkout=plain(realpathSync(input.checkout)),bundle=plain(realpathSync(input.bundle));
assert.ok(bundle.toLowerCase().startsWith((join(checkout,'tmp','review-bundles')+sep).toLowerCase()));
assert.equal(existsSync(join(bundle,'review-data')),false,'Only unused source bundles are accepted');
assert.match(input.sourceCommit,/^[a-f0-9]{40}$/);
const git=spawnSync('git',['-C',checkout,'rev-parse','HEAD'],{encoding:'utf8',windowsHide:true});
assert.equal(git.status,0);assert.equal(git.stdout.trim(),input.sourceCommit);
const receipt=json(input.buildReceipt);assert.equal(receipt.sourceCommit,input.sourceCommit);assert.equal(receipt.steps.length,6);assert.ok(receipt.steps.every((step:any)=>step.exitCode===0));
const manifest=json(join(bundle,'review-manifest.json'));assert.equal(manifest.requiredNodeAbi,process.versions.modules);
const runtime=inventory(bundle);for(const [file,hash]of Object.entries(runtime))assert.equal(sha(readFileSync(join(checkout,file))),hash,file);
const fullBefore=inventory(bundle,true),webRoot=join(bundle,'packages/web/dist'),indexSha256=sha(readFileSync(join(webRoot,'index.html')));
const uid=randomUUID(),output=resolve(root,'tmp','release167','native-'+uid),profile=plain(mkdtempSync(join(tmpdir(),'qpdash-')));
mkdirSync(output,{recursive:true});writeFileSync(join(profile,'fixture.json'),JSON.stringify({mode:'owned-native-dashboard-review',uid,bundle,sourceCommit:input.sourceCommit})+'\n');
const data=join(profile,'data');mkdirSync(data);assert.equal(existsSync(join(data,'usage.db')),false);
const bundleRequire=createRequire(join(bundle,'package.json'));
for(const name of ['better-sqlite3','electron'])assert.ok(realpathSync(bundleRequire.resolve(name)).toLowerCase().startsWith((bundle+sep).toLowerCase()));
const { openDb }=await import(pathToFileURL(join(bundle,'packages/daemon/dist/db/index.js')).href);
const db=openDb(join(data,'usage.db')),now=Date.now();
db.transaction(()=>{
 db.prepare(`INSERT INTO source(id,harness,profile,root_path,display_name,enabled,detected_at,account_key,account_provider,account_display_name,account_state,account_last_success_at) VALUES(?,?,?,?,?,0,?,?,?,?,?,?)`).run(1,'codex','native-review','/synthetic/nonexistent','Native review source A',now,'review:openai','openai','Native review OpenAI','active',now);
 db.prepare(`INSERT INTO source(id,harness,profile,root_path,display_name,enabled,detected_at,account_key,account_provider,account_display_name,account_state,account_last_success_at) VALUES(?,?,?,?,?,0,?,?,?,?,?,?)`).run(2,'claude-code','native-review','/synthetic/nonexistent','Native review source B',now,'review:anthropic','anthropic','Native review Anthropic','active',now);
 db.prepare('INSERT INTO session(id,source_id,native_session_id,project,last_seen_at) VALUES(1,1,?,?,?)').run('native-review-a','Native review project',now);
 db.prepare('INSERT INTO session(id,source_id,native_session_id,project,last_seen_at) VALUES(2,2,?,?,?)').run('native-review-b','Native review second project',now);
 const event=db.prepare(`INSERT INTO usage_event(source_id,session_id,dedup_key,ts,model,provider,input_tokens,cached_input_tokens,output_tokens,total_tokens,call_count,cost_usd,cost_source,cost_input_usd,cost_cached_input_usd,cost_output_usd,cost_cache_saving_usd,price_provider) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
 event.run(1,1,'native-review-1',now-30000,'Native Model A','openai',100,0,50,150,1,.25,'native',null,null,null,null,null);
 event.run(2,2,'native-review-2',now-60000,'Native Model B','anthropic',40,10,20,70,2,.0123,'computed',.004,.0003,.008,.0007,'anthropic');
 event.run(1,1,'native-review-3',now-90000,null,null,1,0,0,1,1,null,'unknown',null,null,null,null,null);
 const quota=db.prepare('INSERT INTO limit_sample(source_id,window_kind,used_percent,resets_at,observed_at,last_seen_at,source_fetched_at,origin) VALUES(?,?,?,?,?,?,?,?)');
 quota.run(1,'5h',83,now+7200000,now,now,now,'native-review');quota.run(2,'monthly',62,now+86400000,now,now,now,'native-review');
 db.exec(`INSERT OR REPLACE INTO app_setting(id,pet_enabled,tray_animation_enabled,hidden_subscriptions,updated_at) VALUES(1,0,0,'[]',0);INSERT OR REPLACE INTO notification_setting(id,enabled,snooze_until,quiet_start,quiet_end,updated_at) VALUES(1,0,4102444800000,1320,420,0);`);
})();
const factsBefore=db.prepare('SELECT * FROM usage_event ORDER BY id').all();db.close();
writeFileSync(join(data,'pet-settings.json'),JSON.stringify({schemaVersion:4,enabled:false}));
const port=7819,base=`http://127.0.0.1:${port}`;
let daemon:ChildProcess|undefined,desktop:ElectronApplication|undefined,lock:any,success=false,failure:string|undefined;
const errors:string[]=[],forbidden:string[]=[],writes:string[]=[],served:Record<string,string>={},responseChecks:Promise<void>[]=[],captures:any[]=[],cycles:any[]=[];
const featureChecks:any[]=[];
const logs=createWriteStream(join(output,'daemon.log'));
async function until(check:()=>Promise<boolean>,label:string){const end=performance.now()+30000;while(performance.now()<end){if(await check())return;await delay(100);}throw Error(label);}
async function request(path:string){const response=await fetch(base+path,{headers:{'x-quotapulse-token':lock.token},signal:AbortSignal.timeout(3000)});assert.equal(response.status,200,path);return response.json() as Promise<any>;}
async function launch(){
 desktop=await _electron.launch({timeout:30000,executablePath:bundleRequire('electron'),args:['--disable-backgrounding-occluded-windows','--disable-renderer-backgrounding','--disable-features=CalculateNativeWinOcclusion',join(bundle,'scripts/task-entry.cjs'),'--role','tray','--port',String(port),'--data-dir',data,'--node-exe',process.execPath,'--no-readers'],env:{...process.env,ELECTRON_RUN_AS_NODE:undefined}});
 await desktop.evaluate(({app})=>app.whenReady());
 await desktop.evaluate(({app,ipcMain,screen})=>{
  (globalThis as any).reviewNative={ready:[],shown:[],preloadErrors:[],placementErrors:[]};
  app.on('browser-window-created',(_event,window)=>{
   window.webContents.setBackgroundThrottling(false);
   const displays=screen.getAllDisplays().map(display=>display.bounds);
   window.setPosition(Math.max(...displays.map(bounds=>bounds.x+bounds.width))+2048,Math.max(...displays.map(bounds=>bounds.y+bounds.height))+2048,false);
   window.setSkipTaskbar(true);window.setFocusable(false);
   window.on('show',()=>{(globalThis as any).reviewNative.shown.push(window.id);const r=window.getBounds();if(displays.some(b=>r.x<b.x+b.width&&r.x+r.width>b.x&&r.y<b.y+b.height&&r.y+r.height>b.y)){window.hide();(globalThis as any).reviewNative.placementErrors.push({id:window.id,bounds:r});}});
   window.webContents.on('preload-error',(_event,path,error)=>(globalThis as any).reviewNative.preloadErrors.push({path,message:error.message}));
  });
  ipcMain.on('qp-dashboard-ready',event=>(globalThis as any).reviewNative.ready.push({id:event.sender.id,url:event.sender.getURL()}));
 });
 const context=desktop.context();
 await context.route('**/*',route=>{const req=route.request(),url=new URL(req.url());const readPost=req.method()==='POST'&&url.pathname==='/api/model-row-trends';const settingsPut=req.method()==='PUT'&&url.pathname==='/api/settings';if(url.origin!==base||!['GET','HEAD'].includes(req.method())&&!readPost&&!settingsPut){forbidden.push(req.method()+' '+url.origin+url.pathname);return route.abort();}if(!['GET','HEAD'].includes(req.method()))writes.push(req.method()+' '+url.pathname);return route.continue();});
 context.on('page',page=>{
  page.on('pageerror',error=>errors.push(error.message));
  page.on('response',response=>{const url=new URL(response.url());if(response.status()>=400)errors.push(response.status()+' '+url.pathname);if(url.origin!==base||url.pathname.startsWith('/api/'))return;
   responseChecks.push((async()=>{const relative=url.pathname==='/'?'index.html':decodeURIComponent(url.pathname.slice(1)),file=join(webRoot,relative);assert.ok(plain(file).startsWith(webRoot+sep));let expected=readFileSync(file);if(relative.endsWith('.html'))expected=Buffer.from(expected.toString('utf8').replace('</head>',`<script>window.__QUOTAPULSE_TOKEN__=${JSON.stringify(lock.token)};</script></head>`));const bytes=await response.body();assert.equal(sha(bytes),sha(expected),relative);served[relative]=sha(bytes);})().catch(error=>{errors.push('Served asset: '+String(error));}));
  });
 });
 await desktop.evaluate(({ipcMain})=>{ipcMain.emit('qp-popup-open-dashboard');});
 const page=await desktop.firstWindow();page.setDefaultTimeout(20000);await page.emulateMedia({reducedMotion:'reduce'});
 await page.getByTestId('production-live').locator('.qp-live-metrics').waitFor();
 await page.waitForFunction(()=>typeof (window as any).qpDashboard?.ready==='function');
 const identity=await desktop.evaluate(({app,BrowserWindow})=>{const window=BrowserWindow.getAllWindows()[0];return{pid:process.pid,id:window.id,userData:app.getPath('userData'),sessionData:app.getPath('sessionData'),preferences:window.webContents.getLastWebPreferences(),evidence:(globalThis as any).reviewNative};});
 cycles.push(identity);
 assert.equal(identity.userData,join(data,'electron'));assert.equal(identity.sessionData,identity.userData);assert.equal(identity.preferences.contextIsolation,true);assert.equal(identity.preferences.nodeIntegration,false);assert.equal(identity.preferences.sandbox,true);
 const inspector=await context.newCDPSession(page),parsed:Array<{scriptId:string;url:string}>=[];
 inspector.on('Debugger.scriptParsed',script=>parsed.push({scriptId:script.scriptId,url:script.url}));
 await inspector.send('Debugger.enable');
 writeFileSync(join(output,'preload-scripts-'+cycles.length+'.json'),JSON.stringify(parsed,null,2)+'\n');
 const expectedPreload=readFileSync(join(bundle,'packages/tray/dist-preload/dashboard-preload.js'),'utf8');
 let loadedPreload:any=null;
 try{for(const script of parsed.filter(script=>!script.url||/preload/i.test(script.url))){const source=await inspector.send('Debugger.getScriptSource',{scriptId:script.scriptId});if(source.scriptSource.includes(expectedPreload.trim())){loadedPreload={url:script.url,scriptSourceSha256:sha(Buffer.from(source.scriptSource)),compiledPreloadSha256:sha(Buffer.from(expectedPreload)),exactCompiledSourceContained:true};break;}}}finally{await inspector.detach();}
 assert.ok(loadedPreload,'Loaded isolated-world script must contain the exact compiled bundle preload');
 (identity as any).loadedPreload=loadedPreload;
 await until(async()=>desktop!.evaluate(()=>(globalThis as any).reviewNative.ready.length>0&&(globalThis as any).reviewNative.shown.length>0),'Real preload readiness/show event missing');
 assert.equal(await page.evaluate(()=>typeof (window as any).require),'undefined');
 return page;
}
async function stopElectron(){if(!desktop)return;const app=desktop;const closed=app.waitForEvent('close',{timeout:15000});await app.evaluate(({app,session})=>{session.defaultSession.flushStorageData();setTimeout(()=>app.quit(),0);});await closed;desktop=undefined;}
async function captureRoutes(page:Page,phase:string){
 const targets:Record<string,string>={overview:'.qp-metrics strong',live:'.qp-live-metrics',projects:'.qp-project-card',models:'.qp-model-table-wrap tbody tr',history:'[data-testid=history-total-tokens]',alerts:'.qp-alert-summary article strong',providers:'.qp-provider-health tbody tr',cost:'.qp-cost-chart'};
 for(const [route,ready]of Object.entries(targets)){
  await page.goto(base+'/#'+route+(route==='cost'?'?range=month':route==='history'?'?range=all':''),{waitUntil:'domcontentloaded'});
  await page.getByTestId('production-'+route).locator(ready).first().waitFor();await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(300);
  const prefs=await page.evaluate(()=>({lang:document.documentElement.lang,theme:localStorage.getItem('quotapulse-theme'),prefs:JSON.parse(localStorage.getItem('quotapulse-prefs')??'{}'),overflow:document.documentElement.scrollWidth>innerWidth,viewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio}}));
  assert.equal(prefs.overflow,false,route+' overflow');
  const links=page.locator('.qp-sidebar nav a');assert.equal(await links.count(),9);assert.deepEqual(await links.evaluateAll(nodes=>nodes.map(n=>(n.getAttribute('href')??'').slice(1).split('?')[0])),['overview','live','projects','models','cost','history','alerts','providers','settings']);for(const link of await links.all())assert.equal(await link.isVisible(),true);assert.equal(await page.locator('.qp-sidebar nav details').count(),0);assert.equal(await page.locator('.qp-brand').evaluate(el=>el.tagName),'DIV');assert.equal(await page.locator('.qp-avatar').innerText(),'Q');assert.equal(await page.locator('.qp-avatar').getAttribute('role'),'img');assert.equal(await page.locator('.qp-language-toggle').count(),1);
  const checked:any={phase,route,visibleDestinations:9,staticIdentity:true,separateLanguage:true};
  if(route==='projects'){
   const response=await request('/api/projects?detailed=1&from=0&to='+String(Date.now()+1));const rows=page.locator('.qp-project-top li[data-project-key]');await rows.first().waitFor();assert.equal(await rows.count(),response.groups.length);checked.ranking=[];
   for(const row of await rows.all()){const key=JSON.parse((await row.getAttribute('data-project-key'))!),group=response.groups.find((g:any)=>g.key===key);assert.ok(group);const price=row.locator('.qp-project-rank-value');assert.equal(Number(await price.getAttribute('data-api-value')),group.api_value_usd);assert.equal(Number(await price.getAttribute('data-priced-calls')),group.computed_calls+group.estimated_calls);assert.equal(Number(await price.getAttribute('data-all-calls')),group.calls);assert.equal(Number(await row.locator('[data-share]').getAttribute('data-share')),group.tokens/response.totals.tokens);checked.ranking.push({key,apiValue:group.api_value_usd,pricedCalls:group.computed_calls+group.estimated_calls,allCalls:group.calls});}
  }
  if(route==='cost'){
   const ticks=await page.locator('.qp-cost-axis[data-axis=amount]>span').evaluateAll(nodes=>nodes.map(node=>({value:Number(node.getAttribute('data-value')),label:node.textContent})));assert.equal(ticks.length,5);if(ticks[0]!.value>0)assert.equal(new Set(ticks.map(t=>t.label)).size,5);checked.amountTicks=ticks;
   const collision=await page.locator('.qp-cost-plot-dates').evaluate(axis=>{const boxes=[...axis.querySelectorAll('time')].filter(n=>getComputedStyle(n).display!=='none'&&getComputedStyle(n).visibility!=='hidden').map(n=>n.getBoundingClientRect());return boxes.some((a,i)=>boxes.slice(i+1).some(b=>a.right>b.left+1&&b.right>a.left+1&&a.bottom>b.top+1&&b.bottom>a.top+1));});assert.equal(collision,false);checked.dateLabelsDoNotOverlap=true;
  }
  featureChecks.push(checked);
  const native=await Promise.race([desktop!.evaluate(async({BrowserWindow})=>{const image=await BrowserWindow.getAllWindows()[0].webContents.capturePage(undefined,{stayHidden:true,stayAwake:true});return{empty:image.isEmpty(),size:image.getSize(),png:image.toPNG().toString('base64')};}),delay(15000).then(()=>{throw Error('Native hidden capture timed out');})]);
  assert.equal(native.empty,false);assert.ok(native.size.width>0&&native.size.height>0);const screenshot=Buffer.from(native.png,'base64');writeFileSync(join(output,phase+'-'+route+'.png'),screenshot);captures.push({phase,route,...prefs,nativeImageSize:native.size,captureMethod:'webContents.capturePage stayHidden/stayAwake',sha256:sha(screenshot)});console.log('Native dashboard '+phase+' '+route+' passed');
 }
}
try{
 daemon=spawn(process.execPath,[join(bundle,'scripts/task-entry.cjs'),'--role','daemon','--port',String(port),'--data-dir',data,'--node-exe',process.execPath,'--no-readers'],{cwd:bundle,windowsHide:true,env:{...process.env,ELECTRON_RUN_AS_NODE:undefined},stdio:['ignore','pipe','pipe']});daemon.stdout!.pipe(logs,{end:false});daemon.stderr!.pipe(logs,{end:false});
 await until(async()=>{if(daemon!.exitCode!==null)throw Error('Owned daemon exited '+daemon!.exitCode);if(!existsSync(join(data,'daemon.lock')))return false;try{lock=json(join(data,'daemon.lock'));assert.equal(lock.pid,daemon!.pid);const health=await request('/api/health');return health.ok&&health.scheduler.sources.length===0;}catch{return false;}},'Actual readers-off daemon not ready');
 const facts=await request('/api/usage-events?from=0&to='+Date.now()+'&limit=50');assert.equal(facts.rows.reduce((sum:number,row:any)=>sum+row.total_tokens,0),221);
 let page=await launch();
 await desktop!.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setContentSize(1672,941));
 if(await page.evaluate(()=>document.documentElement.lang)!=='en'){await page.locator('.qp-tools button').last().click();await page.waitForFunction(()=>document.documentElement.lang==='en');}
 if(await page.locator('.qp-redesign').getAttribute('data-theme')!=='dark')await page.getByRole('button',{name:'Switch color theme',exact:true}).click();
 await captureRoutes(page,'initial');
 await page.goto(base+'/#settings');await page.getByTestId('production-settings').getByRole('button',{name:/THB$/}).click();
 const rate=page.getByRole('textbox',{name:'Rate',exact:true});await rate.fill('37.25');await rate.press('Enter');
 await page.getByRole('spinbutton',{name:'Width (px)',exact:true}).fill('1371');await page.getByRole('spinbutton',{name:'Height (px)',exact:true}).fill('887');
 await until(async()=>existsSync(join(data,'window-size.json'))&&json(join(data,'window-size.json')).width===1371&&json(join(data,'window-size.json')).height===887,'Actual size IPC did not persist');
 const actualSize=await desktop!.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].getSize());assert.deepEqual(actualSize,[1371,887]);
 await page.getByRole('button',{name:'Thai',exact:true}).click();await page.waitForFunction(()=>document.documentElement.lang==='th');
 await page.locator('.qp-tools button').first().click();await page.waitForFunction(()=>localStorage.getItem('quotapulse-theme')==='light');
 const expected=await page.evaluate(()=>({prefs:JSON.parse(localStorage.getItem('quotapulse-prefs')??'{}'),theme:localStorage.getItem('quotapulse-theme'),windowSize:JSON.parse(localStorage.getItem('quotapulse_window_size')??'{}')}));assert.equal(expected.prefs.lang,'th');assert.equal(expected.prefs.currency,'THB');assert.equal(expected.prefs.rate,37.25);
 await stopElectron();page=await launch();
 const restored=await page.evaluate(()=>({prefs:JSON.parse(localStorage.getItem('quotapulse-prefs')??'{}'),theme:localStorage.getItem('quotapulse-theme'),windowSize:JSON.parse(localStorage.getItem('quotapulse_window_size')??'{}')}));assert.deepEqual(restored,expected);
 assert.deepEqual(await desktop!.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].getSize()),[1371,887]);
 await captureRoutes(page,'restored-th-light');
 await page.goto(base+'/#sessions?range=all');await page.getByTestId('production-history').waitFor();assert.equal(new URL(page.url()).hash,'#history?range=all');
 await Promise.all(responseChecks);assert.deepEqual(errors,[]);assert.deepEqual(forbidden,[]);
 const event=await desktop!.evaluate(()=>(globalThis as any).reviewNative);assert.deepEqual(event.preloadErrors,[]);assert.deepEqual(event.placementErrors,[]);
 await stopElectron();
 const checked=openDb(join(data,'usage.db'));assert.deepEqual(checked.prepare('SELECT * FROM usage_event ORDER BY id').all(),factsBefore);assert.equal(checked.pragma('integrity_check',{simple:true}),'ok');checked.close();
 assert.deepEqual(inventory(bundle,true),fullBefore,'Unused source bundle changed during test');
 success=true;
 writeFileSync(join(output,'settings.json'),JSON.stringify({expected,restored,actualSize},null,2)+'\n');
}catch(error){failure=String(error);throw error;}finally{
 const cleanup:string[]=[];try{await stopElectron();}catch(error){cleanup.push(String(error));try{await desktop?.close();}catch{}}
 if(daemon&&daemon.exitCode===null&&daemon.signalCode===null){const stopped=once(daemon,'exit');daemon.kill();await Promise.race([stopped,delay(10000).then(()=>{throw Error('Owned daemon stop timed out');})]).catch(error=>cleanup.push(String(error)));}
 logs.end();
 writeFileSync(join(output,'verification.json'),JSON.stringify({status:success&&cleanup.length===0?'passed':'failed',sourceCommit:input.sourceCommit,checkout,bundle,profile,output,productionIndexSha256:indexSha256,buildReceiptSha256:sha(readFileSync(input.buildReceipt)),bundleFiles:Object.keys(fullBefore).length,served,captures,featureChecks,cycles,errors,forbidden,writes,failure,cleanup,daemonStopped:!!daemon&&(daemon.exitCode!==null||daemon.signalCode!==null),daemonExit:{pid:daemon?.pid,exitCode:daemon?.exitCode,signalCode:daemon?.signalCode},limitations:['actual production windows placed beyond all displays, nonfocusable and absent from taskbar; anti-occlusion flags/background-throttling override and reduced motion are test-only','initial content resized by test to1672x941; restored native size1371x887 tested through real Settings/preload/main','same-version Electron restart with explicit storage flush; no installer or two-version upgrade exercised here','two native language/theme combinations; not complete four-combination matrix','synthetic owned DB only; readers/account probes disabled; no physical tray-click/minimize/monitor or resource proof']},null,2)+'\n');
 console.log('Native dashboard review '+(success?'finished':'failed')+': '+output);
 if(cleanup.length)process.exitCode=1;
}
