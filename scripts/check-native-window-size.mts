/** Exercise the real Electron bridge using an isolated, reader-free profile. */
import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { _electron, type ElectronApplication } from 'playwright';

const root = resolve('.');
const fixtureRoot = resolve(root, '../../../tmp/native-window-size197');
mkdirSync(fixtureRoot, { recursive: true });
const fixture = mkdtempSync(join(fixtureRoot, 'run-'));
const data = join(fixture, 'data'); mkdirSync(data);
const sizeFile = join(data, 'window-size.json');
writeFileSync(sizeFile, JSON.stringify({ width: 1371, height: 887 }));
const entry = join(root, 'scripts/task-entry.cjs');
const electron = createRequire(import.meta.url)('electron') as string;
const port = 7824, base = `http://127.0.0.1:${port}`;
const failures: string[] = [], forbidden: string[] = [];
const env = { ...process.env, ELECTRON_RUN_AS_NODE: undefined, QUOTAPULSE_READERS: 'off' };
let daemon: ChildProcess | undefined, desktop: ElectronApplication | undefined, token = '';
async function until(check: () => Promise<boolean>, message: string) {
  const end = performance.now() + 30_000;
  while (performance.now() < end) { if (await check()) return; await delay(100); }
  throw new Error(message);
}
try {
  daemon = spawn(process.execPath, [entry, '--role', 'daemon', '--port', String(port), '--data-dir', data, '--node-exe', process.execPath, '--no-readers'], { cwd: root, env, windowsHide: true, stdio: 'ignore' });
  await until(async () => {
    if (daemon!.exitCode !== null) throw new Error('Fixture daemon exited');
    try {
      const lock = JSON.parse(readFileSync(join(data, 'daemon.lock'), 'utf8'));
      if (lock.pid !== daemon!.pid) return false;
      const response = await fetch(`${base}/api/health`, { headers: { 'x-quotapulse-token': lock.token }, signal: AbortSignal.timeout(1500) });
      const health = await response.json() as any;
      if (!response.ok || !health.ok || health.scheduler.sources.length) return false;
      token = lock.token; return true;
    } catch { return false; }
  }, 'Isolated daemon did not start');
  const settings = await fetch(`${base}/api/settings`, { method: 'PUT', headers: { 'content-type': 'application/json', 'x-quotapulse-token': token }, body: JSON.stringify({ pet_enabled: false, tray_animation_enabled: false }) });
  assert.ok(settings.ok, 'Disable pets in the synthetic profile');
  desktop = await _electron.launch({ timeout: 30_000, executablePath: electron, args: ['--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding', '--disable-features=CalculateNativeWinOcclusion', entry, '--role', 'tray', '--port', String(port), '--data-dir', data, '--node-exe', process.execPath, '--no-readers'], env });
  await desktop.evaluate(({ app }) => app.whenReady());
  await desktop.evaluate(({ app, ipcMain, screen }) => {
    (globalThis as any).nativeSizeCheck = { shown: 0, errors: [] };
    app.on('browser-window-created', (_event, window) => {
      window.webContents.setBackgroundThrottling(false);
      const displays = screen.getAllDisplays().map(display => display.bounds);
      window.setPosition(Math.max(...displays.map(b => b.x + b.width)) + 2048, Math.max(...displays.map(b => b.y + b.height)) + 2048, false);
      window.setSkipTaskbar(true); window.setFocusable(false);
      window.on('show', () => {
        const r = window.getBounds();
        if (displays.some(b => r.x < b.x + b.width && r.x + r.width > b.x && r.y < b.y + b.height && r.y + r.height > b.y)) {
          window.hide(); (globalThis as any).nativeSizeCheck.errors.push('Window overlapped display');
        } else (globalThis as any).nativeSizeCheck.shown++;
      });
      window.webContents.on('preload-error', (_event, _path, error) => (globalThis as any).nativeSizeCheck.errors.push(error.message));
    });
    ipcMain.emit('qp-popup-open-dashboard');
  });
  await desktop.context().route('**/*', route => {
    const request = route.request(), url = new URL(request.url());
    if (url.origin !== base || !['GET', 'HEAD'].includes(request.method())) { forbidden.push(`${request.method()} ${url.origin}${url.pathname}`); return route.abort(); }
    return route.continue();
  });
  const page = await desktop.firstWindow(); page.setDefaultTimeout(20_000);
  page.on('pageerror', error => failures.push(error.message));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.getByTestId('production-live').locator('.qp-live-metrics:not(.qp-live-initial-metrics)>div strong').first().waitFor({ timeout: 30_000 });
  assert.equal(await page.evaluate(() => localStorage.getItem('quotapulse_window_size')), null);
  const initialFile = readFileSync(sizeFile, 'utf8');
  const identity = await desktop.evaluate(({ app, BrowserWindow }) => ({ userData: app.getPath('userData'), size: BrowserWindow.getAllWindows()[0].getSize(), check: (globalThis as any).nativeSizeCheck }));
  assert.equal(identity.userData, join(data, 'electron')); assert.deepEqual(identity.size, [1371, 887]);
  assert.deepEqual(identity.check.errors, []); assert.ok(identity.check.shown > 0);
  await page.goto(`${base}/#settings`);
  const width = page.getByRole('spinbutton', { name: 'Width (px)', exact: true });
  const height = page.getByRole('spinbutton', { name: 'Height (px)', exact: true });
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('quotapulse_window_size') ?? '{}').width === 1371);
  assert.equal(await width.inputValue(), '1371'); assert.equal(await height.inputValue(), '887');
  assert.deepEqual(await page.evaluate(() => (window as any).qpDashboard.getWindowSize()), { width: 1371, height: 887 });
  assert.equal(readFileSync(sizeFile, 'utf8'), initialFile, 'Reading the window size must not write the native file');
  await width.fill('1461'); await height.fill('877');
  await until(async () => { try { const size = JSON.parse(readFileSync(sizeFile, 'utf8')); return size.width === 1461 && size.height === 877; } catch { return false; } }, 'User change was not saved');
  assert.deepEqual(await desktop.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].getSize()), [1461, 877]);
  const updatedFile = readFileSync(sizeFile, 'utf8');
  await page.evaluate(() => localStorage.removeItem('quotapulse_window_size'));
  await page.reload();
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('quotapulse_window_size') ?? '{}').width === 1461);
  assert.equal(await width.inputValue(), '1461'); assert.equal(await height.inputValue(), '877');
  assert.equal(readFileSync(sizeFile, 'utf8'), updatedFile);
  assert.deepEqual(failures, []); assert.deepEqual(forbidden, []);
  console.log('Native Electron window-size hydration, user resize and reload passed in an isolated profile.');
} finally {
  if (desktop) { const app = desktop; const closed = app.waitForEvent('close', { timeout: 15_000 }); await app.evaluate(async ({ app, session }) => { await session.defaultSession.flushStorageData(); app.quit(); }); await closed; }
  if (daemon && daemon.exitCode === null && daemon.signalCode === null) { const exited = new Promise<void>(done => daemon!.once('exit', () => done())); daemon.kill(); await Promise.race([exited, delay(10_000).then(() => { throw new Error('Owned daemon did not stop'); })]); }
}
