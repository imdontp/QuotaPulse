import { createServer } from 'node:http';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { build } from 'esbuild';
import { chromium } from 'playwright';

// Isolated mount of the actual ActivitySparkline source. Not a production-data acceptance gate.
// Run serially with other browser checks. ACTIVITY_PROBE_NO_IO=1 tests the geometry/scroll fallback.
// Hidden document emulation is labeled in evidence and does not prove real Electron minimize behavior.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const evidenceDir = resolve(root, 'screens/activity-visibility');
const noIntersectionObserver = process.env.ACTIVITY_PROBE_NO_IO === '1';
const proof = resolve(evidenceDir, noIntersectionObserver ? 'no-intersection-observer.json' : 'intersection-observer.json');
await mkdir(evidenceDir, { recursive: true });
await rm(proof, { force: true });
const source = resolve(root, 'packages/web/src/redesign/activity-sparkline.tsx');
const bundle = await build({ write: false, bundle: true, platform: 'browser', format: 'iife', jsx: 'automatic', absWorkingDir: root,
  stdin: { resolveDir: resolve(root, 'packages/web'), sourcefile: 'activity-visibility68-fixture.tsx', loader: 'tsx', contents: `
import React from 'react'; import { createRoot } from 'react-dom/client';
import { ActivitySparkline } from ${JSON.stringify(source.replace(/\\/g, '/'))};
const root=createRoot(document.getElementById('mount')!);
let points=[{at:0,value:2},{at:60000,value:4},{at:120000,value:1}];
const render=()=>root.render(<ActivitySparkline points={points} label="Actual source visibility probe" language="en"/>);
(window as any).fixture={update:()=>{points=points.map(p=>({...p,value:p.value+1}));render()},unmount:()=>root.unmount()};render();
` } });
const js=bundle.outputFiles[0].text;
const server=createServer((req,res)=>{res.setHeader('Cache-Control','no-store');if(req.url==='/fixture.js'){res.setHeader('Content-Type','text/javascript');res.end(js);return;}
 res.setHeader('Content-Type','text/html');res.end(`<!doctype html><html><head><meta charset="UTF-8"><style>body{margin:0}.qp-redesign{--qp-accent:#00cfff}#fixture-shell{width:300px;padding-top:0px}canvas{display:block;width:100%;height:22px}.qp-visually-hidden{position:absolute;clip-path:inset(50%);width:1px;height:1px;overflow:hidden}</style></head><body><div id="fixture-shell" class="qp-redesign" data-theme="dark"><div id="mount"></div></div><div style="height:800px" aria-hidden="true"></div><script src="/fixture.js"></script></body></html>`);});
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
const stages:any[]=[];const assertions:any[]=[];
const check=(name:string,pass:boolean,evidence:any)=>assertions.push({name,pass,evidence});
try{
 await new Promise<void>((resolveListen,rejectListen)=>{
  server.once('error',rejectListen);
  server.listen(0,'127.0.0.1',()=>{server.removeListener('error',rejectListen);resolveListen()});
 });
 const address=server.address();if(!address||typeof address==='string')throw new Error('No fixture address');
 browser=await chromium.launch({headless:true});
 const context=await browser.newContext({viewport:{width:700,height:500},deviceScaleFactor:1});
 const page=await context.newPage();
 if(noIntersectionObserver)await page.addInitScript(()=>{Object.defineProperty(window,'IntersectionObserver',{value:undefined,configurable:true})});
 await page.addInitScript(()=>{
  const w=window as any;w.__name=new Function('target','return target');w.paintAudit={clear:0,stroke:0,fill:0,events:[],listeners:[],observers:[]};
  const a=w.paintAudit;
  for(const method of ['clearRect','stroke','fill'] as const){const original=(CanvasRenderingContext2D.prototype as any)[method];(CanvasRenderingContext2D.prototype as any)[method]=function(...args:any[]){if(this.canvas?.classList.contains('qp-activity-sparkline')){a[method==='clearRect'?'clear':method]++;const r=this.canvas.getBoundingClientRect();a.events.push({method,connected:this.canvas.isConnected,hidden:document.hidden,visibility:document.visibilityState,top:r.top,bottom:r.bottom,time:performance.now()});}return original.apply(this,args)};}
  const add=EventTarget.prototype.addEventListener;const remove=EventTarget.prototype.removeEventListener;
  EventTarget.prototype.addEventListener=function(type:any,listener:any,options:any){if((this===window&&(type==='resize'||type==='scroll'))||(this===document&&type==='visibilitychange')||(this instanceof MediaQueryList&&type==='change'))a.listeners.push({target:this,type,listener,capture:typeof options==='boolean'?options:Boolean(options?.capture),active:true});return add.call(this,type,listener,options)};
  EventTarget.prototype.removeEventListener=function(type:any,listener:any,options:any){for(const entry of a.listeners)if(entry.target===this&&entry.type===type&&entry.listener===listener&&entry.capture===(typeof options==='boolean'?options:Boolean(options?.capture)))entry.active=false;return remove.call(this,type,listener,options)};
  for(const name of ['ResizeObserver','MutationObserver','IntersectionObserver']){const Original=w[name];if(!Original)continue;w[name]=class extends Original{record:any;constructor(callback:any){super(callback);this.record={type:name,active:false,owned:false};a.observers.push(this.record)}observe(...args:any[]){this.record.active=true;this.record.owned=args[0] instanceof Element&&(args[0].matches('canvas.qp-activity-sparkline')||args[0].matches('#fixture-shell'));return super.observe(...args)}disconnect(){this.record.active=false;return super.disconnect()}};}
 });
 await page.goto(`http://127.0.0.1:${address.port}/`);await page.waitForSelector('canvas.qp-activity-sparkline');
 const settle=async()=>{await page.waitForTimeout(250)};
 const snap=async(name:string)=>{await settle();const value=await page.evaluate(()=>{const a=(window as any).paintAudit,c=document.querySelector('canvas') as HTMLCanvasElement|null;const r=c?.getBoundingClientRect();return {clear:a.clear,stroke:a.stroke,fill:a.fill,hidden:document.hidden,visibility:document.visibilityState,rect:r?{top:r.top,bottom:r.bottom,width:r.width}:null,title:c?.title,points:document.querySelectorAll('ol li').length,listeners:a.listeners.filter((x:any)=>x.active).length,observers:a.observers.filter((x:any)=>x.active&&x.owned).length,events:a.events.slice(-12)}});stages.push({name,...value});return value};
 const initial=await snap('visible-initial');check('visible paints real supplied buckets',initial.clear>0&&initial.stroke>0&&initial.points===3,initial);
 await page.evaluate(()=>{document.getElementById('fixture-shell')!.style.paddingTop='1800px'});const off=await snap('offscreen-settled');check('fixture actually offscreen',off.rect!.top>=500,off.rect);
 await page.evaluate(()=>(window as any).fixture.update());const offPoints=await snap('offscreen-points-update');check('offscreen points update does not paint',offPoints.clear===off.clear,{before:off.clear,after:offPoints.clear});
 await page.evaluate(()=>{document.getElementById('fixture-shell')!.dataset.theme='light'});const offTheme=await snap('offscreen-theme-update');check('offscreen theme update does not paint',offTheme.clear===offPoints.clear,{before:offPoints.clear,after:offTheme.clear});
 await page.evaluate(()=>{document.getElementById('fixture-shell')!.style.width='360px';window.dispatchEvent(new Event('resize'))});const offResize=await snap('offscreen-resize-update');check('offscreen resize update does not paint',offResize.clear===offTheme.clear,{before:offTheme.clear,after:offResize.clear});
 if(noIntersectionObserver)await page.evaluate(()=>window.scrollTo(0,1700));
 else await page.evaluate(()=>{document.getElementById('fixture-shell')!.style.paddingTop='0px';window.scrollTo(0,0)});const back=await snap('visible-reentry');check('reentry repaints latest data/theme/size',back.clear>offResize.clear&&back.rect!.width===360,{before:offResize.clear,after:back.clear,rect:back.rect});
 // Try a real browser tab visibility transition first. Headless Chromium may keep all pages visible.
 const other=await context.newPage();await other.goto('about:blank');await other.bringToFront();await page.waitForTimeout(150);
 const observedHidden=await page.evaluate(()=>document.hidden);let visibilityMode='actual-tab-transition';
 if(!observedHidden){visibilityMode='EMULATED-document-getters-and-event';await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});Object.defineProperty(document,'visibilityState',{configurable:true,get:()=>'hidden'});document.dispatchEvent(new Event('visibilitychange'))});}
 const hidden=await snap('hidden-settled');check('document hidden during probe',hidden.hidden,{mode:visibilityMode,...hidden});
 await page.evaluate(()=>{(window as any).fixture.update();document.getElementById('fixture-shell')!.dataset.theme='dark';window.dispatchEvent(new Event('resize'))});const hiddenUpdated=await snap('hidden-points-theme-resize');check('hidden updates do not paint',hiddenUpdated.clear===hidden.clear,{mode:visibilityMode,before:hidden.clear,after:hiddenUpdated.clear});
 await other.close();await page.bringToFront();if(visibilityMode.startsWith('EMULATED'))await page.evaluate(()=>{delete (document as any).hidden;delete (document as any).visibilityState;document.dispatchEvent(new Event('visibilitychange'))});
 const resumed=await snap('visible-after-hidden');check('visibility resume repaints latest data',resumed.clear>hiddenUpdated.clear,{mode:visibilityMode,before:hiddenUpdated.clear,after:resumed.clear});
 await page.evaluate(()=>(window as any).fixture.unmount());const unmounted=await snap('unmounted');
 await page.evaluate(()=>{document.getElementById('fixture-shell')!.dataset.theme='light';document.getElementById('fixture-shell')!.style.width='390px';window.dispatchEvent(new Event('resize'));document.dispatchEvent(new Event('visibilitychange'))});const cleanup=await snap('post-unmount-events');check('unmount disconnects listeners/observers and prevents detached paint',cleanup.clear===unmounted.clear&&cleanup.listeners===0&&cleanup.observers===0,{before:unmounted.clear,...cleanup});
 const report={browser:browser.version(),viewport:{width:700,height:500},deviceScaleFactor:1,noIntersectionObserver,source,sourceSha256:createHash('sha256').update(await readFile(source)).digest('hex'),fixture:'isolated actual-source React mount, supplied three buckets; not production-data/performance acceptance',visibilityMode,stages,assertions};
 await writeFile(proof,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({noIntersectionObserver,visibilityMode,assertions:assertions.map(({name,pass,evidence})=>({name,pass,...(evidence.before!==undefined?{before:evidence.before,after:evidence.after}: {})})),proof},null,2));if(assertions.some(a=>!a.pass))process.exitCode=1;
}finally{
 try{await browser?.close()}finally{if(server.listening)await new Promise<void>((r,reject)=>server.close(e=>e?reject(e):r()));}
}
