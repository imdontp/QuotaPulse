// Native probe runs without Playwright/DevTools and their startup switches.
const { app, BrowserWindow, ipcMain } = require('electron');
const { writeFileSync } = require('node:fs');
const { join } = require('node:path');
const runtime = process.env.QUOTAPULSE_TEST_RUNTIME_ROOT;
const report = process.env.QUOTAPULSE_TEST_REPORT;
if (!runtime || !report || !process.env.QUOTAPULSE_DATA_DIR || process.env.QUOTAPULSE_READERS !== 'off') throw new Error('Isolated probe environment required');
require(join(runtime, 'packages/tray/dist/main.js'));
const evidence = { unresponsive: [], responsive: [], crashes: [], loads: 0, ready: 0 };
let before, finished = false;
function finish(status, message, recovered) {
  if (finished) return;
  finished = true;
  writeFileSync(report, JSON.stringify({ status, message, before, recovered, evidence, automation: 'native Electron without Playwright/DevTools' }, null, 2));
  for (const win of BrowserWindow.getAllWindows()) win.destroy();
  app.exit(status === 'passed' ? 0 : 1);
}
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(condition, milliseconds, message) {
  const end = Date.now() + milliseconds;
  while (Date.now() < end) { if (await condition()) return; await delay(100); }
  throw new Error(message);
}
setTimeout(() => finish('failed', 'Native probe deadline exceeded'), 90000);
app.whenReady().then(async () => {
  await delay(100); ipcMain.emit('qp-popup-open-dashboard');
  let win;
  await until(async () => {
    win = BrowserWindow.getAllWindows().find(w => w.webContents.getURL().includes('#live'));
    if (!win || win.webContents.isLoading()) return false;
    return win.webContents.executeJavaScript('Boolean(document.querySelector(".qp-live-metrics") && window.qpDashboard?.ready)').catch(() => false);
  }, 30000, 'Dashboard did not become ready');
  before = { id: win.id, pid: win.webContents.getOSProcessId() };
  win.webContents.on('unresponsive', () => evidence.unresponsive.push(Date.now()));
  win.webContents.on('responsive', () => evidence.responsive.push(Date.now()));
  win.webContents.on('render-process-gone', (_event, details) => evidence.crashes.push(details.reason));
  win.webContents.on('did-start-loading', () => evidence.loads++);
  ipcMain.on('qp-dashboard-ready', event => { if (event.sender === win.webContents) evidence.ready++; });
  win.focus();
  evidence.injectedAt = Date.now();
  await win.webContents.executeJavaScript('setTimeout(() => { window.qpInjectedHang = true; const end = Date.now() + 60000; while (Date.now() < end) {} }, 100); true');
  await delay(300);
  win.webContents.sendInputEvent({ type: 'mouseDown', button: 'left', x: 40, y: 40, clickCount: 1 });
  win.webContents.sendInputEvent({ type: 'mouseUp', button: 'left', x: 40, y: 40, clickCount: 1 });
  await until(() => evidence.unresponsive.length > 0, 20000, 'Electron did not detect actual unresponsiveness');
  await until(() => !win.isDestroyed() && win.webContents.getOSProcessId() > 0 && win.webContents.getOSProcessId() !== before.pid && evidence.ready > 0, 25000, 'Dashboard did not recover before the injected 60-second hang ended');
  await until(async () => win.isVisible() && await win.webContents.executeJavaScript('Boolean(document.querySelector(".qp-live-metrics") && window.qpDashboard?.ready && !window.qpInjectedHang)').catch(() => false), 10000, 'Recovered dashboard is not interactive and visible');
  const interactive = true;
  evidence.recoveredAt = Date.now();
  if (evidence.recoveredAt - evidence.injectedAt >= 60000) throw new Error('Recovery depended on the injected hang ending naturally');
  finish('passed', 'Real unresponsive renderer replaced and preload/React restored', { id: win.id, pid: win.webContents.getOSProcessId(), interactive, visible: win.isVisible() });
}).catch(error => finish('failed', String(error)));
