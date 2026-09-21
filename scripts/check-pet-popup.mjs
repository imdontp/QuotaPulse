/** Built-app popup checks with local fixtures and a mock Electron bridge. */
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { preview } from 'vite';
import { chromium } from 'playwright';
import { renderConceptPet } from '../packages/tray/dist/pet/concept-art.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const output = resolve(root, 'screens/pet-concept');
mkdirSync(output, { recursive: true });
const now = Date.now();
const subscriptions = [['openai', 'OpenAI', 42], ['claude', 'Claude', 78]].map(([key, name]) => ({
  subscription_key: key, account_key: key, subscription_display_name: name, display_name: name,
  provider: key, state: 'active', telemetry: { gap: false, freshness: 'live' },
}));
const limits = subscriptions.map((s, i) => ({
  ...s, source_id: i + 1, harness: i ? 'claude-code' : 'codex', profile: 'default',
  account_provider: s.provider, subscription_provider: s.provider, window_kind: 'weekly',
  used_percent: i ? 78 : 42, resets_at: now + (i ? 14400000 : 30720000),
  observed_at: now, source_fetched_at: now, origin: 'fixture', ageSeconds: 10,
  valueAgeSeconds: 10, last_seen_at: now, burn: null,
}));
const overview = { now, subscriptions, limits, today: {}, week: {}, allTime: {}, sources: [] };
const svg = renderConceptPet('nova', 'healthy', `data:image/png;base64,${readFileSync(resolve(root, 'packages/tray/assets/pets/nova/concept-states.png')).toString('base64')}`);
const server = await preview({ root: resolve(root, 'packages/web'), preview: { host: '127.0.0.1', port: 0 } });
let browser;
try {
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 380, height: 520 }, reducedMotion: 'reduce' });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/api/**', route => {
    if (route.request().url().includes('events/stream')) return route.fulfill({ contentType: 'text/event-stream', body: ': connected\n\n' });
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify(overview) });
  });
  await page.addInitScript(svg => {
    let listener;
    window.actions = [];
    window.qpPopup = {
      onSprite(fn) { listener = fn; return () => { listener = null; }; },
      ready() { listener?.(svg); },
      refresh() { window.actions.push('refresh'); }, openDashboard() { window.actions.push('dashboard'); },
      hidePet() { window.actions.push('hide'); }, close() { window.actions.push('close'); },
    };
    if (!localStorage.getItem('quotapulse-prefs')) localStorage.setItem('quotapulse-prefs', JSON.stringify({ lang: 'en', currency: 'USD', rate: 1, hiddenSubscriptions: [] }));
    localStorage.setItem('quotapulse-theme', 'dark');
  }, svg);
  await page.goto(`${server.resolvedUrls.local[0]}?mode=popup`);
  await page.getByText('OpenAI', { exact: true }).waitFor();
  await page.locator('.pet-popup-companion svg[data-concept-pose]').waitFor();
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  assert.equal(await page.getByText('42%', { exact: true }).count(), 1);
  assert.equal(await page.getByText('78%', { exact: true }).count(), 1);
  await page.screenshot({ path: resolve(output, 'popup-en.png') });
  await page.getByRole('button', { name: 'Open dashboard', exact: true }).click();
  assert.ok((await page.evaluate(() => window.actions)).includes('dashboard'));
  await page.evaluate(() => localStorage.setItem('quotapulse-prefs', JSON.stringify({ lang: 'th', currency: 'USD', rate: 1, hiddenSubscriptions: [] })));
  await page.reload();
  await page.getByText('OpenAI', { exact: true }).waitFor();
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.screenshot({ path: resolve(output, 'popup-th.png') });
  assert.deepEqual(errors, []);
  console.log('PASS: built popup at 380×520, bonus art bridge, actual quota values, dashboard action, English and Thai layouts.');
} finally {
  await browser?.close();
  await new Promise(done => server.httpServer.close(done));
}
