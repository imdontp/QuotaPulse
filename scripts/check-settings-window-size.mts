/** Compiled Settings UI: native-size hydration, fallback and user-edit races. */
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { openDb } from '../packages/daemon/src/db/index.js';
import { buildServer } from '../packages/daemon/src/api/server.js';
import { Scheduler } from '../packages/daemon/src/ingest/scheduler.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const db = openDb(':memory:');
const daemon = buildServer(db, new Scheduler(db, [], { pollMs: 1_000_000, detectMs: 1_000_000 }), {
  token: 'settings-window-test', port: 7823, webRoot: resolve(root, 'packages/web/dist'),
});
const base = 'http://127.0.0.1:7823';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const cases: string[] = [];
try {
  await daemon.listen({ host: '127.0.0.1', port: 7823 });
  for (const mode of ['native', 'browser', 'old', 'rejected', 'invalid', 'edit-race', 'reset-race', 'unmount-race']) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
    const page = await context.newPage();
    const errors: string[] = [], forbidden: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => {
      const request = route.request(), url = new URL(request.url());
      if (url.origin !== base || !['GET', 'HEAD'].includes(request.method())) {
        forbidden.push(`${request.method()} ${url.origin}${url.pathname}`); return route.abort();
      }
      return route.continue();
    });
    await page.addInitScript('globalThis.__name = value => value');
    await page.addInitScript((scenario: string) => {
      (window as any).__QUOTAPULSE_TOKEN__ = 'settings-window-test';
      localStorage.setItem('quotapulse-prefs', JSON.stringify({ lang: 'en', currency: 'USD', rate: 1, hiddenSubscriptions: [] }));
      localStorage.setItem('quotapulse-theme', 'dark');
      localStorage.setItem('quotapulse_window_size', JSON.stringify({ width: 1200, height: 800 }));
      (window as any).__sizeWrites = [];
      if (scenario === 'browser') return;
      const bridge: any = { ready() {}, setWindowSize(size: unknown) { (window as any).__sizeWrites.push(size); return Promise.resolve(true); } };
      if (scenario !== 'old') bridge.getWindowSize = () => {
        (window as any).__sizeReadStarted = true;
        if (scenario === 'rejected') return Promise.reject(new Error('Unavailable old main process'));
        if (scenario === 'invalid') return Promise.resolve({ width: 1, height: 99999 });
        if (scenario.endsWith('-race')) return new Promise(resolve => { (window as any).__resolveNativeSize = resolve; });
        return Promise.resolve({ width: 1371, height: 887 });
      };
      (window as any).qpDashboard = bridge;
    }, mode);
    try {
      await page.goto(`${base}/#settings`, { waitUntil: 'domcontentloaded' });
      const width = page.getByRole('spinbutton', { name: 'Width (px)', exact: true });
      const height = page.getByRole('spinbutton', { name: 'Height (px)', exact: true });
      await width.waitFor();
      if (mode === 'native') {
        await page.waitForFunction(() => JSON.parse(localStorage.getItem('quotapulse_window_size') ?? '{}').width === 1371);
        assert.equal(await width.inputValue(), '1371'); assert.equal(await height.inputValue(), '887');
        assert.deepEqual(await page.evaluate(() => (window as any).__sizeWrites), [], 'Reading native size must not resize the window');
      } else if (mode === 'edit-race' || mode === 'reset-race') {
        await page.waitForFunction(() => typeof (window as any).__resolveNativeSize === 'function');
        if (mode === 'edit-race') await width.fill('1450');
        else await page.getByRole('button', { name: /Reset to defaults/i }).click();
        await page.evaluate(() => (window as any).__resolveNativeSize({ width: 1371, height: 887 }));
        await page.waitForTimeout(150);
        assert.equal(await width.inputValue(), mode === 'edit-race' ? '1450' : '1080');
        assert.equal(await height.inputValue(), mode === 'edit-race' ? '800' : '860');
        const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('quotapulse_window_size')!));
        assert.deepEqual(saved, mode === 'edit-race' ? { width: 1450, height: 800 } : { width: 1080, height: 860 });
      } else if (mode === 'unmount-race') {
        await page.waitForFunction(() => typeof (window as any).__resolveNativeSize === 'function');
        await page.goto(`${base}/#live`); await page.getByTestId('production-live').waitFor();
        await page.evaluate(() => (window as any).__resolveNativeSize?.({ width: 1371, height: 887 }));
        await page.waitForTimeout(150);
        assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('quotapulse_window_size')!)), { width: 1200, height: 800 });
      } else {
        await page.waitForTimeout(150);
        assert.equal(await width.inputValue(), '1200'); assert.equal(await height.inputValue(), '800');
        assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('quotapulse_window_size')!)), { width: 1200, height: 800 });
      }
      assert.deepEqual(errors, []); assert.deepEqual(forbidden, []);
      cases.push(mode); console.log(`Settings window size ${mode} passed`);
    } finally { await context.close(); }
  }
  assert.equal(cases.length, 8);
} finally {
  await browser.close(); await daemon.close(); db.close();
}
