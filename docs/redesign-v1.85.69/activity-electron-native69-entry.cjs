// Native private-IPC fixture: no Playwright, CDP, background flags or visibility overrides.
const { app, BrowserWindow, ipcMain, session, screen } = require('electron');
const { join } = require('node:path');
const root=process.env.QP_ACTIVITY_ROOT,url=process.env.QP_ACTIVITY_URL,profile=process.env.QP_ACTIVITY_PROFILE;
if(!root||!url||!profile||typeof process.send!=='function')throw new Error('Missing isolated native IPC fixture config');
require(join(root,'packages/tray/dist/instance-profile.js')).configureInstanceProfile(app,profile);
const evidence={ready:0,blocked:[],preloadErrors:[],states:[],windowId:null,focusEvents:0,nativeEvents:[]};let win;
let resolveReady,rejectReady;const windowReady=new Promise((resolve,reject)=>{resolveReady=resolve;rejectReady=reject});
windowReady.catch(()=>{});
const reply=(message)=>{if(process.connected)process.send(message)};
ipcMain.on('qp-dashboard-ready',()=>evidence.ready++);
function state(action){const bounds=win.getBounds();const offMonitor=evidence.displays.every(d=>bounds.x+bounds.width<=d.x||bounds.x>=d.x+d.width||bounds.y+bounds.height<=d.y||bounds.y>=d.y+d.height);return{action,bounds,offMonitor,focused:win.isFocused(),visible:win.isVisible(),minimized:win.isMinimized(),preferences:win.webContents.getLastWebPreferences(),backgroundThrottling:win.webContents.getBackgroundThrottling(),focusable:win.isFocusable()}}
function action(name,width){
 const outside=(r)=>evidence.displays.every(d=>r.x+r.width<=d.x||r.x>=d.x+d.width||r.y+r.height<=d.y||r.y>=d.y+d.height);
 if(name==='show'||name==='restore'){win.setFocusable(false);win.setBounds(evidence.offMonitorBounds);if(!outside(win.getBounds()))throw new Error('Unsafe onscreen bounds before show');if(name==='restore')win.restore();win.setBounds(evidence.offMonitorBounds);win.show()}
 else if(name==='hide')win.hide();else if(name==='minimize'){if(!outside(win.getBounds())||win.isFocused()||evidence.focusEvents>0)throw new Error('Unsafe state before controlled minimize');win.setFocusable(true);win.minimize();}else if(name==='resize'){if(!Number.isInteger(width)||width<1000||width>1800)throw new Error('Invalid isolated width');win.setSize(width,evidence.offMonitorBounds.height)}
 else throw new Error('Unknown native action');
 const result=state(name);evidence.states.push(result);if(!result.offMonitor||result.focused||evidence.focusEvents>0){win.hide();throw new Error('Fixture moved onscreen or acquired focus')};return result;
}
process.on('message',async message=>{
 if(!message||!Number.isSafeInteger(message.id))return;
 try{
  if(message.op==='close'){reply({id:message.id,ok:true,value:{closing:true}});if(win&&!win.isDestroyed())win.destroy();app.quit();return}
  await windowReady;
  let value;
  if(message.op==='evaluate'){if(typeof message.source!=='string'||message.source.length>100000)throw new Error('Invalid fixture renderer expression');value=await win.webContents.executeJavaScript(message.source,false)}
  else if(message.op==='action')value=action(message.action,message.width);
  else if(message.op==='state')value={main:evidence,userData:app.getPath('userData'),sessionData:app.getPath('sessionData'),versions:process.versions,processArguments:process.argv,window:state('snapshot')};
  else throw new Error('Unknown private IPC operation');
  reply({id:message.id,ok:true,value});
 }catch(error){reply({id:message.id,ok:false,error:String(error?.stack||error)})}
});
process.on('disconnect',()=>{if(win&&!win.isDestroyed())win.destroy();app.quit()});
app.whenReady().then(async()=>{
 const displays=screen.getAllDisplays().map(d=>d.bounds),minX=Math.min(...displays.map(d=>d.x)),minY=Math.min(...displays.map(d=>d.y));
 evidence.displays=displays;evidence.offMonitorBounds={x:minX-2000,y:minY-1800,width:1602,height:1032};
 session.defaultSession.setPermissionRequestHandler((_w,_p,callback)=>callback(false));
 session.defaultSession.webRequest.onBeforeRequest((details,callback)=>{const allowed=details.url===url||details.url.startsWith(url+'/');if(!allowed)evidence.blocked.push(details.url);callback({cancel:!allowed})});
 win=new BrowserWindow({...evidence.offMonitorBounds,show:false,frame:true,resizable:true,maximizable:true,minimizable:true,skipTaskbar:true,focusable:false,title:'QuotaPulse isolated native Activity visibility',webPreferences:{preload:join(root,'packages/tray/dist-preload/dashboard-preload.js'),nodeIntegration:false,contextIsolation:true}});
 // backgroundThrottling omitted exactly as production dashboard; native default applies.
 evidence.windowId=win.id;win.on('focus',()=>{evidence.focusEvents++;win.setFocusable(false);win.hide()});for(const event of ['focus','show','hide','minimize','restore'])win.on(event,()=>evidence.nativeEvents.push({event,at:Date.now(),visible:win.isVisible(),minimized:win.isMinimized(),focused:win.isFocused(),focusable:win.isFocusable()}));win.webContents.setWindowOpenHandler(()=>({action:'deny'}));
 win.webContents.on('preload-error',(_e,_p,error)=>evidence.preloadErrors.push(error.message));
 await win.loadURL(url+'/#overview');resolveReady();reply({event:'ready',pid:process.pid});
}).catch(error=>{rejectReady(error);reply({event:'fatal',error:String(error?.stack||error)});app.exit(1)});
app.on('window-all-closed',()=>app.quit());
