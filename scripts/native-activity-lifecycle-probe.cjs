// Raw Electron private IPC observer. Import the actual compiled production main unchanged.
// No BrowserWindow constructor/options replacement, CDP, focus/visibility emulation or startup switches.
const { app, BrowserWindow, ipcMain } = require('electron');
const { join } = require('node:path');
const runtime = process.env.QUOTAPULSE_TEST_RUNTIME_ROOT;
if (!runtime || !process.env.QUOTAPULSE_DATA_DIR || process.env.QUOTAPULSE_READERS !== 'off' || typeof process.send !== 'function') {
  throw new Error('Isolated native lifecycle environment and private parent IPC required');
}
let win;
let closing = false;
const evidence = { ready: 0, states: [], nativeEvents: [], preloadErrors: [], created: [] };
const reply = message => { if (process.connected) process.send(message); };
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const state = action => ({ action, id: win.id, bounds: win.getBounds(), focused: win.isFocused(), visible: win.isVisible(), minimized: win.isMinimized(), focusable: win.isFocusable(), backgroundThrottling: win.webContents.getBackgroundThrottling(), preferences: win.webContents.getLastWebPreferences() });
app.on('browser-window-created', (_event, created) => {
  evidence.created.push({ id: created.id, bounds: created.getBounds(), preferences: created.webContents.getLastWebPreferences() });
  created.webContents.on('preload-error', (_event, _path, error) => evidence.preloadErrors.push(error.message));
  for (const event of ['focus', 'show', 'hide', 'minimize', 'restore']) {
    created.on(event, () => evidence.nativeEvents.push({ id: created.id, event, at: Date.now(), visible: created.isVisible(), minimized: created.isMinimized() }));
  }
});
ipcMain.on('qp-dashboard-ready', () => evidence.ready++);
require(join(runtime, 'packages/tray/dist/main.js'));
let resolveReady, rejectReady;
const ready = new Promise((resolve, reject) => { resolveReady = resolve; rejectReady = reject; });
ready.catch(() => {});
app.whenReady().then(async () => {
  // Production whenReady registers the normal dashboard-open IPC synchronously first.
  ipcMain.emit('qp-popup-open-dashboard');
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    win = BrowserWindow.getAllWindows().find(candidate => candidate.webContents.getURL().includes('#live'));
    if (win && !win.webContents.isLoading() && await win.webContents.executeJavaScript('Boolean(document.querySelector(".qp-live-metrics") && window.qpDashboard?.ready)').catch(() => false)) {
      resolveReady(); reply({ event: 'ready', pid: process.pid }); return;
    }
    await delay(100);
  }
  throw new Error('Actual production dashboard did not become ready');
}).catch(error => { rejectReady(error); reply({ event: 'fatal', error: String(error.stack || error) }); });
function close() {
  if (closing) return;
  closing = true;
  for (const candidate of BrowserWindow.getAllWindows()) candidate.destroy();
  app.quit();
}
process.on('disconnect', close);
process.on('message', async message => {
  if (!message || !Number.isSafeInteger(message.id)) return;
  try {
    if (message.op === 'close') { reply({ id: message.id, ok: true, value: { closing: true } }); close(); return; }
    await ready;
    let value;
    if (message.op === 'evaluate') {
      if (typeof message.source !== 'string' || message.source.length > 100000) throw new Error('Invalid private renderer expression');
      value = await win.webContents.executeJavaScript(message.source, false);
    } else if (message.op === 'state') {
      value = { main: evidence, userData: app.getPath('userData'), sessionData: app.getPath('sessionData'), versions: process.versions, processArguments: process.argv, window: state('snapshot') };
    } else if (message.op === 'action') {
      if (message.action === 'show' || message.action === 'restore') ipcMain.emit('qp-popup-open-dashboard');
      else if (message.action === 'hide') win.hide();
      else if (message.action === 'minimize') win.minimize();
      else if (message.action === 'resize') {
        if (!Number.isInteger(message.width) || message.width < 1000 || message.width > 1800) throw new Error('Invalid isolated resize width');
        win.setSize(message.width, win.getSize()[1]);
      } else throw new Error('Unknown native action');
      // Let native notifications settle; document visibility is asserted independently by parent.
      await delay(150);
      value = state(message.action); evidence.states.push(value);
    } else throw new Error('Unknown private IPC operation');
    reply({ id: message.id, ok: true, value });
  } catch (error) { reply({ id: message.id, ok: false, error: String(error.stack || error) }); }
});
