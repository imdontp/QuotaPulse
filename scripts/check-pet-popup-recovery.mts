import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
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
const electron = createRequire(resolve(runtimeRoot, 'package.json'))('electron');
if (bundled) assert.ok(electron.startsWith(runtimeRoot + '\\'));
const output = resolve(root, 'screens/pet-popup-recovery', bundled ? 'bundle' : 'source');
const profiles = resolve(root, 'tmp/pet-popup-recovery');
mkdirSync(output, { recursive: true }); mkdirSync(profiles, { recursive: true });
rmSync(resolve(output, 'verification.json'), { force: true });
const data = mkdtempSync(resolve(profiles, 'instance-'));
const settingsPath = resolve(data, 'pet-settings.json');
writeFileSync(settingsPath, JSON.stringify({ schemaVersion: 4, enabled: true, movement: 'companion', reducedMotion: false, allowCrossMonitor: true, lockPosition: true }));
const db = openDb(':memory:');
db.exec("INSERT INTO app_setting(id,pet_enabled,tray_animation_enabled,hidden_subscriptions,updated_at) VALUES(1,1,0,'[]',0)");
const daemon = buildServer(db, new Scheduler(db, [], { pollMs: 1000000, detectMs: 1000000 }), { token: 'synthetic-pet-recovery', port: 7812, webRoot: resolve(runtimeRoot, 'packages/web/dist') });
let desktop: Awaited<ReturnType<typeof _electron.launch>> | undefined;
const checks: string[] = [];
async function until(condition: () => Promise<boolean>, message: string) {
  const deadline = Date.now() + 40000;
  while (Date.now() < deadline) { if (await condition()) return; await delay(100); }
  throw new Error(message);
}
async function surface(kind: 'pet' | 'popup') {
  return desktop!.evaluate(({ BrowserWindow }, kind) => {
    const win = BrowserWindow.getAllWindows().find(w => kind === 'pet' ? w.webContents.getURL().includes('pet.html') : w.webContents.getURL().includes('mode=popup'));
    return win ? { id: win.id, pid: win.webContents.getOSProcessId(), visible: win.isVisible(), preferences: win.webContents.getLastWebPreferences() } : null;
  }, kind);
}
async function ready(id: number, expression: string) {
  await until(() => desktop!.evaluate(async ({ BrowserWindow }, { id, expression }) => {
    const win = BrowserWindow.fromId(id);
    if (!win || win.isDestroyed() || win.webContents.isLoading()) return false;
    try { return win.isVisible() && Boolean(await win.webContents.executeJavaScript(expression)); } catch { return false; }
  }, { id, expression }), `surface ${id} did not become interactive`);
}
async function crash(id: number) {
  await desktop!.evaluate(({ BrowserWindow }, id) => BrowserWindow.fromId(id)!.webContents.forcefullyCrashRenderer(), id);
}
try {
  await daemon.listen({ host: '127.0.0.1', port: 7812 });
  writeFileSync(resolve(data, 'daemon.lock'), JSON.stringify({ pid: process.pid, port: 7812, token: 'synthetic-pet-recovery', startedAt: Date.now() }));
  desktop = await _electron.launch({ timeout: 30000, executablePath: electron, args: [resolve(runtimeRoot, 'scripts/task-entry.cjs'), '--role', 'tray', '--port', '7812', '--data-dir', data, '--node-exe', process.execPath, '--no-readers'], env: { ...process.env, ELECTRON_RUN_AS_NODE: undefined } });
  await until(async () => !!await surface('pet'), 'pet did not open');
  const pet = (await surface('pet'))!;
  const petReady = 'Boolean(window.qpPet?.click && document.querySelector("#pet").style.backgroundImage)';
  await ready(pet.id, petReady);
  await desktop.evaluate(({ BrowserWindow, ipcMain }, id) => {
    (globalThis as any).qpPetPopupEvidence = { petCrashes: [], popupCrashes: [], popupReady: 0, popupLoads: 0 };
    BrowserWindow.fromId(id)!.webContents.on('render-process-gone', (_event, details) => (globalThis as any).qpPetPopupEvidence.petCrashes.push(details.reason));
    ipcMain.on('qp-popup-ready', event => { if (event.sender.getURL().includes('mode=popup')) (globalThis as any).qpPetPopupEvidence.popupReady++; });
  }, pet.id);
  assert.equal(pet.preferences.contextIsolation, true); assert.equal(pet.preferences.sandbox, true); assert.equal(pet.preferences.nodeIntegration, false);
  const profile = await desktop.evaluate(({ app }) => app.getPath('userData'));
  assert.equal(profile, resolve(data, 'electron'));
  const saved = readFileSync(settingsPath, 'utf8');
  for (let i = 0; i < 2; i++) {
    const before = (await surface('pet'))!;
    await crash(before.id);
    await until(async () => { const after = await surface('pet'); return !!after && after.id === before.id && after.pid > 0 && after.pid !== before.pid; }, 'pet did not replace its crashed renderer');
    await ready(before.id, petReady);
  }
  checks.push('two actual pet renderer crashes recover the same sandboxed window with new renderer processes and restored sprite/preload');
  await crash(pet.id);
  await until(async () => { const after = await surface('pet'); return !!after && after.id !== pet.id && after.pid > 0; }, 'third crash did not recreate pet in safe mode');
  const safePet = (await surface('pet'))!;
  await ready(safePet.id, petReady + ' && document.querySelector("#pet-wrap").classList.contains("reduced-motion")');
  assert.equal(readFileSync(settingsPath, 'utf8'), saved);
  assert.equal(await desktop.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().filter(w => w.webContents.getURL().includes('pet.html')).length), 1);
  checks.push('third real crash creates one visible reduced-motion pet without changing persisted preferences');
  // Use the production renderer bridge; this is not a physical mouse/tray click.
  async function openPopup() {
    await desktop!.evaluate(async ({ BrowserWindow }, id) => { await BrowserWindow.fromId(id)!.webContents.executeJavaScript('window.qpPet.details()'); }, safePet.id);
    await until(async () => !!await surface('popup'), 'quota popup did not open');
    const popup = (await surface('popup'))!;
    await ready(popup.id, 'Boolean(window.qpPopup?.ready && document.querySelector("#root")?.textContent?.length)');
    return popup;
  }
  const popup = await openPopup();
  await until(() => desktop!.evaluate(() => (globalThis as any).qpPetPopupEvidence.popupReady >= 1), 'initial popup-ready signal was not received');
  await desktop.evaluate(({ BrowserWindow }, id) => {
    const contents = BrowserWindow.fromId(id)!.webContents;
    contents.on('render-process-gone', (_event, details) => (globalThis as any).qpPetPopupEvidence.popupCrashes.push(details.reason));
    contents.on('did-start-loading', () => (globalThis as any).qpPetPopupEvidence.popupLoads++);
  }, popup.id);
  assert.equal(popup.preferences.sandbox, true); assert.equal(popup.preferences.contextIsolation, true); assert.equal(popup.preferences.nodeIntegration, false);
  await crash(popup.id);
  await until(async () => { const after = await surface('popup'); return !!after && after.id === popup.id && after.pid > 0 && after.pid !== popup.pid; }, 'quota popup renderer did not recover');
  await ready(popup.id, 'Boolean(window.qpPopup?.ready && document.querySelector("#root")?.textContent?.length)');
  await until(() => desktop!.evaluate(() => (globalThis as any).qpPetPopupEvidence.popupReady >= 2), 'recovered popup-ready signal was not received');
  checks.push('quota popup opened by real pet preload recovers in the same native window after a renderer crash');
  await desktop.evaluate(({ session }) => session.defaultSession.webRequest.onBeforeRequest({ urls: ['http://127.0.0.1:7812/*'] }, (details, callback) => callback({ cancel: details.resourceType === 'mainFrame' })));
  await crash(popup.id);
  await until(() => desktop!.evaluate(({ BrowserWindow }, id) => !BrowserWindow.fromId(id), popup.id), 'quota popup failed to close after bounded retries');
  checks.push('failed document loads exhaust bounded popup recovery and close the panel while pet/main stay alive');
  await desktop.evaluate(({ session }) => session.defaultSession.webRequest.onBeforeRequest(null));
  const replacement = await openPopup(); assert.notEqual(replacement.id, popup.id);
  await until(() => desktop!.evaluate(() => (globalThis as any).qpPetPopupEvidence.popupReady >= 3), 'three production popup-ready signals were not received');
  await desktop.evaluate(async ({ BrowserWindow }, id) => { await BrowserWindow.fromId(id)!.webContents.executeJavaScript('window.qpPopup.close()'); }, replacement.id);
  await until(() => desktop!.evaluate(({ BrowserWindow }, id) => !BrowserWindow.fromId(id), replacement.id), 'reopened popup close bridge did not work');
  checks.push('popup reopens as one replacement and its production close bridge works after recovery exhaustion');
  assert.equal(readFileSync(settingsPath, 'utf8'), saved);
  const recovery = await desktop.evaluate(() => (globalThis as any).qpPetPopupEvidence);
  assert.equal(recovery.petCrashes.length, 3); assert.equal(recovery.popupCrashes.length, 2);
  assert.ok(recovery.popupReady >= 3, JSON.stringify(recovery)); assert.ok(recovery.popupLoads >= 2 && recovery.popupLoads <= 4, JSON.stringify(recovery));
  writeFileSync(resolve(output, 'verification.json'), JSON.stringify({ status: 'passed', runtimeRoot, bundled, checks, pet, safePet, popup, replacement, recovery, database: 'in-memory synthetic; no adapters', limitations: ['actual unresponsive renderer and physical click automation remain separate', 'safe mode persistence retained; manual exit not exercised', 'empty synthetic quota data, no live accounts'] }, null, 2));
  console.log(`Pet/popup recovery passed: ${checks.length} checks.`);
} finally { await desktop?.close(); await daemon.close(); db.close(); }
