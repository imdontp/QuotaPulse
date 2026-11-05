/** Compiled Diagnostics with a failing and recovering synthetic transcript scan. */
import assert from 'node:assert/strict';
import { mkdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';
import { openDb, upsertSource } from '../packages/daemon/src/db/index.js';
import { codexAdapter } from '../packages/daemon/src/adapters/codex.js';
import { runPass } from '../packages/daemon/src/ingest/runner.js';
import { Scheduler } from '../packages/daemon/src/ingest/scheduler.js';
import { buildServer } from '../packages/daemon/src/api/server.js';
import { tmpRoot, writeCodexProfile } from '../packages/daemon/test/fixtures.js';
import { en } from '../packages/web/src/i18n/en.js';
import { th } from '../packages/web/src/i18n/th.js';

const home = tmpRoot('quotapulse-discovery-'), root = join(home, 'profile');
mkdirSync(root);
const blocked = join(root, 'sessions');
writeFileSync(blocked, 'not a directory');
const db = openDb(':memory:');
const profile = { profile: 'fixture', rootPath: root, displayName: 'Fixture Codex' };
const sourceId = upsertSource(db, { harness: 'codex', ...profile });
const sources = [{ adapter: codexAdapter, profile, sourceId }];
const daemon = buildServer(db, new Scheduler(db, []), { token: 'discovery-test', port: 0, webRoot: resolve('packages/web/dist') });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
let checked = 0;
try {
  await runPass(db, sources);
  await daemon.listen({ host: '127.0.0.1', port: 0 });
  const address = daemon.server.address();
  assert.ok(address && typeof address !== 'string');
  const base = `http://127.0.0.1:${address.port}`;
  for (const language of ['en', 'th'] as const) for (const theme of ['dark', 'light'] as const) for (const width of [390, 1440]) {
    const messages = language === 'en' ? en : th;
    const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
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
    await page.addInitScript(({ language, theme }) => {
      (window as any).__QUOTAPULSE_TOKEN__ = 'discovery-test';
      localStorage.setItem('quotapulse-prefs', JSON.stringify({ lang: language, currency: 'USD', rate: 1, hiddenSubscriptions: [] }));
      localStorage.setItem('quotapulse-theme', theme);
    }, { language, theme });
    try {
      await page.goto(`${base}/#settings?section=diagnostics`);
      const heading = page.getByRole('heading', { name: messages['health.ingestErrors'], exact: true });
      await heading.waitFor();
      const card = heading.locator('..').locator('..');
      assert.match(await card.innerText(), /\(discovery\)/);
      assert.ok((await card.innerText()).includes(messages['health.errorsBlurb']));
      assert.doesNotMatch(await card.innerText(), /not a directory|quotapulse-discovery-/);
      if (width === 390) {
        const tableScroll = await page.getByRole('table').first().locator('..').evaluate(element => {
          element.scrollLeft = element.scrollWidth;
          return { width: element.clientWidth, content: element.scrollWidth, left: element.scrollLeft };
        });
        assert.ok(tableScroll.content > tableScroll.width && tableScroll.left > 0, JSON.stringify(tableScroll));
      }
      const geometry = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth,
        offenders: [...document.querySelectorAll('*')].map(element => ({ tag: element.tagName, class: element.getAttribute('class'), rect: element.getBoundingClientRect().toJSON(), scroll: element.scrollWidth, client: element.clientWidth })).filter(item => item.rect.right > innerWidth + 1).slice(0, 16) }));
      assert.ok(geometry.scroll <= geometry.width, JSON.stringify({ language, theme, width, geometry }));
      assert.deepEqual(errors, []); assert.deepEqual(forbidden, []);
      checked++;
    } finally { await context.close(); }
  }
  unlinkSync(blocked);
  writeCodexProfile(root);
  await runPass(db, sources);
  assert.ok((db.prepare('SELECT COUNT(*) AS n FROM usage_event WHERE source_id = ?').get(sourceId) as { n: number }).n > 0);
  const response = await daemon.inject({ method: 'GET', url: '/api/health', headers: { 'x-quotapulse-token': 'discovery-test' } });
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json().errors, []);
  for (const language of ['en', 'th'] as const) {
    const context = await browser.newContext({ viewport: { width: 390, height: 900 }, reducedMotion: 'reduce' });
    try {
      const page = await context.newPage();
      await page.route('**/*', route => {
        const request = route.request(), url = new URL(request.url());
        return url.origin === base && ['GET', 'HEAD'].includes(request.method()) ? route.continue() : route.abort();
      });
      await page.addInitScript(({ language }) => {
        (window as any).__QUOTAPULSE_TOKEN__ = 'discovery-test';
        localStorage.setItem('quotapulse-prefs', JSON.stringify({ lang: language, currency: 'USD', rate: 1, hiddenSubscriptions: [] }));
      }, { language });
      await page.goto(`${base}/#settings?section=diagnostics`);
      await page.getByRole('heading', { name: (language === 'en' ? en : th)['health.adapters'], exact: true }).waitFor();
      await page.getByText('Fixture Codex', { exact: true }).waitFor();
      assert.equal(await page.getByText('(discovery)', { exact: true }).count(), 0);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    } finally { await context.close(); }
  }
  console.log(`Transcript discovery: ${checked} compiled browser cases and 2 recovered views passed`);
} finally { await browser.close(); await daemon.close(); db.close(); }
