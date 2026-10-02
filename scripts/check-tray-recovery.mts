import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { _electron } from 'playwright';
import { openDb } from '../packages/daemon/src/db/index.js';
import { buildServer } from '../packages/daemon/src/api/server.js';
import { Scheduler } from '../packages/daemon/src/ingest/scheduler.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const runtimeRoot = process.env.QUOTAPULSE_REVIEW_ROOT ? resolve(process.env.QUOTAPULSE_REVIEW_ROOT) : root;
const bundled = runtimeRoot !== root;
const output = resolve(root, bundled ? 'screens/tray-recovery/bundle' : 'screens/tray-recovery');
const runtimeRequire = createRequire(resolve(runtimeRoot, 'package.json'));
const electron = runtimeRequire('electron');
if (bundled) assert.ok(electron.startsWith(runtimeRoot + '\\'), 'Review Electron must resolve inside the extracted bundle');
mkdirSync(output, { recursive: true });
rmSync(resolve(output, 'verification.json'), { force: true });
const profiles = resolve(root, 'tmp/tray-recovery'); mkdirSync(profiles, { recursive: true });
const data = mkdtempSync(resolve(profiles, 'instance-'));
writeFileSync(resolve(data, 'pet-settings.json'), JSON.stringify({ schemaVersion: 4, enabled: false }));
const db = openDb(':memory:');
db.exec(`INSERT INTO app_setting(id,pet_enabled,tray_animation_enabled,hidden_subscriptions,updated_at) VALUES(1,0,0,'[]',0);`);
const scheduler = new Scheduler(db, [], { pollMs: 1000000, detectMs: 1000000 });
const daemon = buildServer(db, scheduler, { token: 'synthetic-recovery-test', port: 7806, webRoot: resolve(runtimeRoot, 'packages/web/dist') });
let desktop: Awaited<ReturnType<typeof _electron.launch>> | undefined;
const checks: string[] = [];
async function until(condition: () => Promise<boolean>, message: string) {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) { if (await condition()) return; await delay(100); }
  throw new Error(message);
}
try {
  await daemon.listen({ host: '127.0.0.1', port: 7806 });
  writeFileSync(resolve(data, 'daemon.lock'), JSON.stringify({ pid: process.pid, port: 7806, token: 'synthetic-recovery-test', startedAt: Date.now() }));
  desktop = await _electron.launch({ timeout: 30000, executablePath: electron, args: [resolve(runtimeRoot, 'scripts/task-entry.cjs'), '--role', 'tray', '--port', '7806', '--data-dir', data, '--node-exe', process.execPath, '--no-readers'], env: { ...process.env, ELECTRON_RUN_AS_NODE: undefined } });
  await desktop.evaluate(({ app }) => app.whenReady());
  await desktop.evaluate(({ ipcMain }) => { ipcMain.emit('qp-popup-open-dashboard'); });
  const dashboard = await desktop.firstWindow();
  await dashboard.locator('.qp-live-metrics').waitFor();
  const identity = await desktop.evaluate(({ BrowserWindow, app, ipcMain }) => {
    const win = BrowserWindow.getAllWindows().find(window => window.webContents.getURL().includes('#live'))!;
    (globalThis as any).qpRecoveryEvidence = { crashes: [], loads: 0, ready: 0 };
    win.webContents.on('render-process-gone', (_event, details) => (globalThis as any).qpRecoveryEvidence.crashes.push(details.reason));
    win.webContents.on('did-start-loading', () => (globalThis as any).qpRecoveryEvidence.loads++);
    ipcMain.on('qp-dashboard-ready', event => { if (event.sender.getURL().includes('#live')) (globalThis as any).qpRecoveryEvidence.ready++; });
    return { id: win.id, pid: win.webContents.getOSProcessId(), userData: app.getPath('userData'), sessionData: app.getPath('sessionData'), preferences: win.webContents.getLastWebPreferences() };
  });
  assert.equal(identity.userData, resolve(data, 'electron')); assert.equal(identity.sessionData, identity.userData);
  assert.equal(identity.preferences.contextIsolation, true); assert.equal(identity.preferences.nodeIntegration, false); assert.equal(identity.preferences.sandbox, true);
  checks.push('real compiled tray/main opens built dashboard through its existing open action with isolated profile and sandbox');
  await desktop.evaluate(({ BrowserWindow }, id) => BrowserWindow.fromId(id)!.webContents.forcefullyCrashRenderer(), identity.id);
  await until(async () => desktop!.evaluate(({ BrowserWindow }, before) => {
    const win = BrowserWindow.fromId(before.id);
    return !!win && !win.isDestroyed() && win.webContents.getOSProcessId() > 0 && win.webContents.getOSProcessId() !== before.pid && !win.webContents.isLoading();
  }, identity), 'dashboard renderer did not recover with a new process');
  await until(async () => desktop!.evaluate(async ({ BrowserWindow }, id) => {
    const win = BrowserWindow.fromId(id);
    if (!win || win.isDestroyed()) return false;
    try { return win.isVisible() && await win.webContents.executeJavaScript('Boolean(document.querySelector(".qp-live-metrics") && window.qpDashboard?.ready)'); }
    catch { return false; }
  }, identity.id), 'React/preload did not return after renderer crash');
  assert.equal(await desktop.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().filter(win => win.webContents.getURL().includes('#live')).length), 1);
  checks.push('actual renderer crash reloads the same native window with a new renderer and restored React/preload');
  const capture = await desktop.evaluate(async ({ BrowserWindow }, id) => (await BrowserWindow.fromId(id)!.webContents.capturePage()).toPNG().toString('base64'), identity.id);
  writeFileSync(resolve(output, 'dashboard-recovered.png'), Buffer.from(capture, 'base64'));
  // Fail document loads only; the production recovery handler must stop retrying.
  await desktop.evaluate(({ session }) => session.defaultSession.webRequest.onBeforeRequest({ urls: ['http://127.0.0.1:7806/*'] }, (details, callback) => callback({ cancel: details.resourceType === 'mainFrame' })));
  await desktop.evaluate(({ BrowserWindow }, id) => BrowserWindow.fromId(id)!.webContents.forcefullyCrashRenderer(), identity.id);
  await until(async () => desktop!.evaluate(({ BrowserWindow }, id) => !BrowserWindow.fromId(id), identity.id), 'dashboard did not close after bounded recovery failures');
  const failed = await desktop.evaluate(() => (globalThis as any).qpRecoveryEvidence);
  assert.ok(failed.loads >= 2 && failed.loads <= 4, `unexpected reload count ${failed.loads}`);
  checks.push('repeated document-load failures close dashboard after bounded retries while tray/main remains alive');
  await desktop.evaluate(({ session }) => session.defaultSession.webRequest.onBeforeRequest(null));
  await desktop.evaluate(({ ipcMain }) => { ipcMain.emit('qp-popup-open-dashboard'); });
  await until(async () => desktop!.windows().some(page => !page.isClosed() && page.url().includes('#live')), 'dashboard did not reopen');
  const reopened = desktop.windows().find(page => !page.isClosed() && page.url().includes('#live'))!;
  await reopened.locator('.qp-live-metrics').waitFor();
  await reopened.getByRole('button', { name: 'Pause view', exact: true }).click();
  await reopened.getByRole('button', { name: 'Resume latest', exact: true }).waitFor();
  const final = await desktop.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().filter(win => win.webContents.getURL().includes('#live')).map(win => ({ id: win.id, visible: win.isVisible(), pid: win.webContents.getOSProcessId() })));
  assert.equal(final.length, 1); assert.notEqual(final[0].id, identity.id);
  checks.push('reopening after failed recovery creates one replacement window with loaded data and working pause control');
  const recovery = await desktop.evaluate(() => (globalThis as any).qpRecoveryEvidence);
  assert.ok(recovery.ready >= 2);
  writeFileSync(resolve(output, 'verification.json'), JSON.stringify({ status: 'passed', runtimeRoot, bundled, checks, identity, recovery, final, database: 'in-memory synthetic; no adapters', limitations: ['unpacked compiled tray/main; not packaged installer', 'dashboard crash/load failure covered; pet/quota popup and actual unresponsive renderer remain separate', 'open action dispatched from test main; no physical tray-click automation'] }, null, 2));
  console.log(`Tray recovery passed: ${checks.length} checks through real compiled main.`);
} finally { await desktop?.close(); await daemon.close(); db.close(); }
