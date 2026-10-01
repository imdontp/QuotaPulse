// Isolated test host for the real compiled preloads and production web assets.
// Does not load tray/main.js, install a tray, start readers or open user databases.
const { app, BrowserWindow, ipcMain, session } = require('electron');
const { join } = require('node:path');
const root = process.env.QP_DESKTOP_TEST_ROOT;
const url = process.env.QP_DESKTOP_TEST_URL;
if (!root || !url || !process.env.QP_DESKTOP_TEST_USER_DATA) throw new Error('Missing isolated test configuration');
app.setPath('userData', process.env.QP_DESKTOP_TEST_USER_DATA);
globalThis.qpDesktopEvidence = { ready: [], actions: [], preloadErrors: [], blocked: [] };
for (const channel of ['qp-dashboard-ready', 'qp-popup-ready']) ipcMain.on(channel, () => globalThis.qpDesktopEvidence.ready.push(channel));
for (const channel of ['qp-popup-open-dashboard', 'qp-popup-close']) ipcMain.on(channel, () => globalThis.qpDesktopEvidence.actions.push(channel));
app.whenReady().then(async () => {
  session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
    const allowed = details.url.startsWith(url + '/') || details.url === url;
    if (!allowed) globalThis.qpDesktopEvidence.blocked.push(details.url);
    callback({ cancel: !allowed });
  });
  const windows = ['dashboard', 'popup'].map(kind => {
    const win = new BrowserWindow({ title: kind, show: false, width: kind === 'dashboard' ? 1440 : 400, height: kind === 'dashboard' ? 1000 : 650,
      webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false, preload: join(root, 'packages/tray/dist-preload', kind === 'dashboard' ? 'dashboard-preload.js' : 'popup-preload.js') } });
    win.webContents.on('preload-error', (_event, _path, error) => globalThis.qpDesktopEvidence.preloadErrors.push(error.message));
    win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    return [kind, win];
  });
  await Promise.all(windows.map(([kind, win]) => win.loadURL(url + (kind === 'popup' ? '/?mode=popup#overview' : '/#overview'))));
}).catch(error => { console.error(error); app.exit(1); });
app.on('window-all-closed', () => app.quit());
