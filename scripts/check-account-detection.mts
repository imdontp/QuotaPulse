/** Real API and compiled Settings UI with an isolated, synthetic account reader. */
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { openDb } from '../packages/daemon/src/db/index.js';
import { resolveSources } from '../packages/daemon/src/ingest/runner.js';
import { Scheduler } from '../packages/daemon/src/ingest/scheduler.js';
import { buildServer } from '../packages/daemon/src/api/server.js';
import type { Adapter } from '../packages/daemon/src/adapters/types.js';
import { en } from '../packages/web/src/i18n/en.js';
import { th } from '../packages/web/src/i18n/th.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const db = openDb(':memory:');
let failed = false;
const adapter: Adapter = {
  id: 'fixture-account', displayName: 'Fixture account',
  async detect() {
    if (failed) throw new Error('private fixture error');
    return [{ profile: 'test', rootPath: '/synthetic/nonexistent', displayName: 'Fixture account reader', sourceKind: 'account' }];
  },
  watchTargets: () => [],
  async ingest() {},
};
const daemon = buildServer(db, new Scheduler(db, []), { token: 'account-detection-test', port: 0, webRoot: resolve(root, 'packages/web/dist') });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
let cases = 0;
try {
  await resolveSources(db, [adapter]);
  failed = true;
  await resolveSources(db, [adapter]);
  await daemon.listen({ host: '127.0.0.1', port: 0 });
  const address = daemon.server.address();
  assert.ok(address && typeof address !== 'string');
  const base = `http://127.0.0.1:${address.port}`;
  const run = async (language: 'en' | 'th', theme: 'dark' | 'light', width: number, mode: 'failed' | 'old' | 'recovered') => {
    const messages = language === 'en' ? en : th;
    const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
    const page = await context.newPage();
    const errors: string[] = [], forbidden: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', async route => {
      const request = route.request(), url = new URL(request.url());
      if (url.origin !== base || !['GET', 'HEAD'].includes(request.method())) {
        forbidden.push(`${request.method()} ${url.origin}${url.pathname}`); return route.abort();
      }
      if (mode === 'old' && url.pathname === '/api/health') {
        const response = await route.fetch();
        const body = await response.json();
        delete body.accountDetectionErrors;
        return route.fulfill({ response, json: body });
      }
      return route.continue();
    });
    await page.addInitScript(({ language, theme }) => {
      (window as any).__QUOTAPULSE_TOKEN__ = 'account-detection-test';
      localStorage.setItem('quotapulse-prefs', JSON.stringify({ lang: language, currency: 'USD', rate: 1, hiddenSubscriptions: [] }));
      localStorage.setItem('quotapulse-theme', theme);
    }, { language, theme });
    try {
      await page.goto(`${base}/#settings?section=diagnostics`);
      await page.getByRole('heading', { name: messages['health.adapters'], exact: true }).waitFor();
      const diagnostic = page.getByRole('heading', { name: messages['health.accountDetectionErrors'], exact: true });
      if (mode === 'failed') {
        await diagnostic.waitFor();
        const card = diagnostic.locator('..').locator('..');
        assert.match(await card.innerText(), /Fixture account reader/);
        assert.match(await card.innerText(), /fixture-account\/test/);
        assert.doesNotMatch(await card.innerText(), /private fixture error|\/synthetic\/nonexistent/);
      } else if (mode === 'old') {
        await diagnostic.waitFor();
        await page.getByText(messages['health.accountDetectionUnsupported'], { exact: true }).waitFor();
        await page.getByRole('heading', { name: messages['health.clear'], exact: true }).waitFor();
      } else {
        await page.getByRole('heading', { name: messages['health.clear'], exact: true }).waitFor();
        assert.equal(await diagnostic.count(), 0);
      }
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${language}/${theme}/${width}/${mode} overflows`);
      assert.deepEqual(errors, []); assert.deepEqual(forbidden, []);
      cases++;
    } finally { await context.close(); }
  };
  for (const language of ['en', 'th'] as const)
    for (const theme of ['dark', 'light'] as const)
      for (const width of [390, 1440]) await run(language, theme, width, 'failed');
  for (const language of ['en', 'th'] as const) await run(language, 'dark', 390, 'old');
  failed = false;
  await resolveSources(db, [adapter]);
  for (const language of ['en', 'th'] as const) await run(language, 'light', 390, 'recovered');
  assert.equal(cases, 12);
  console.log(`Account detection: ${cases} compiled browser/API cases passed`);
} finally { await browser.close(); await daemon.close(); db.close(); }
