/** Deterministic, daemon-free pilot verification. */
import assert from 'node:assert/strict';
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { chromium } from 'playwright';

const repo = fileURLToPath(new URL('..', import.meta.url));
const output = resolve(repo, 'screens/redesign-foundation');
mkdirSync(output, { recursive: true });
const dependencies = resolve(dirname(fileURLToPath(import.meta.resolve('vite/package.json'))), '..');
const server = await createServer({ root: resolve(repo, 'packages/web'), server: { host: '127.0.0.1', port: 7797, strictPort: true, fs: { allow: [repo, dependencies] } } });
let browser;
try {
  await server.listen();
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ reducedMotion: 'reduce' });
  const errors = [];
  const forbidden = [];
  let requestCount = 0;
  page.on('request', () => requestCount++);
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.hostname !== '127.0.0.1' || url.pathname.startsWith('/api/')) { forbidden.push(url.href); return route.abort(); }
    return route.continue();
  });
  await page.addInitScript(() => localStorage.setItem('preview-test-sentinel', 'unchanged'));
  const startedAt = performance.now();
  await page.goto('http://127.0.0.1:7797/?mode=redesign-preview');
  await page.getByRole('heading', { name: 'Your AI operations, in focus.' }).waitFor();
  await page.evaluate(() => document.fonts.ready);
  assert.equal(await page.evaluate(() => document.fonts.check('13px "Geist Variable"')), true, 'bundled font did not load');
  const initialReadyMs = Math.round(performance.now() - startedAt);
  const initialRequests = requestCount;
  const before = await page.evaluate(() => JSON.stringify(localStorage));
  assert.deepEqual(JSON.parse(before), { 'preview-test-sentinel': 'unchanged' }, 'preview wrote preferences during mount');
  await page.getByRole('button', { name: /Anthropic 7d/ }).click();
  assert.equal(await page.locator('.qp-pulse-label strong').textContent(), '18%');
  await page.getByRole('button', { name: /OpenAI 5h/ }).click();
  assert.equal(await page.locator('.qp-pulse-label strong').textContent(), '62%');
  const node = page.locator('.qp-map-node').filter({ hasText: 'QuotaPulse' });
  await node.click();
  await page.getByRole('dialog').waitFor();
  assert.match(await page.getByRole('dialog').textContent(), /420,000/);
  await page.keyboard.press('Escape');
  await page.getByRole('dialog').waitFor({ state: 'hidden' });
  assert.equal(await node.evaluate(element => element === document.activeElement), true);
  await node.evaluate(element => element.blur());
  const screenshots = [];
  const measurements = [];
  for (const language of ['en', 'th']) {
    if (language === 'th') await page.getByRole('button', { name: 'Switch language' }).click();
    for (const theme of ['dark', 'light']) {
      if (theme === 'light') await page.locator('.qp-tools button').last().click();
      for (const width of [390, 900, 1280, 1440]) {
        await page.setViewportSize({ width, height: 1000 });
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `overflow: ${language}/${theme}/${width}`);
        assert.equal(await page.locator('.qp-orbit').evaluate(element => getComputedStyle(element).animationName), 'none');
        const name = `${language}-${theme}-${width}.png`;
        await page.screenshot({ path: resolve(output, name), fullPage: true, animations: 'disabled' });
        screenshots.push(name);
        measurements.push({ language, theme, width, regions: await page.evaluate(() => Object.fromEntries(['.qp-sidebar', '.qp-topbar', '.qp-hero', '.qp-pulse', '.qp-runtime'].map(selector => {
          const { x, y, width, height } = document.querySelector(selector).getBoundingClientRect();
          return [selector, { x, y, width, height }];
        }))) });
      }
    }
    await page.locator('.qp-tools button').last().click();
  }
  assert.equal(await page.evaluate(() => JSON.stringify(localStorage)), before, 'preview changed stored preferences');
  assert.deepEqual(forbidden, [], 'preview accessed daemon or external network');
  assert.deepEqual(errors, [], 'browser errors');
  await page.goto('http://127.0.0.1:7797/?mode=redesign-preview');
  await page.setViewportSize({ width: 1586, height: 992 });
  await page.locator('.qp-pulse-label').waitFor();
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: resolve(output, 'en-dark-1586.png'), fullPage: true, animations: 'disabled' });
  screenshots.push('en-dark-1586.png');
  for (const scenario of ['empty', 'stale', 'critical', 'long-names']) {
    await page.goto(`http://127.0.0.1:7797/?mode=redesign-preview&scenario=${scenario}`);
    await page.setViewportSize({ width: 390, height: 1000 });
    await page.locator('.qp-pulse-label').waitFor();
    if (scenario === 'empty') assert.equal(await page.getByText('No usage records', { exact: true }).count(), 1);
    if (scenario === 'stale') assert.equal(await page.locator('.qp-pulse').getAttribute('data-stale'), 'true');
    if (scenario === 'critical') assert.equal(await page.locator('.qp-pulse-label strong').textContent(), '3%');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, scenario);
    await page.screenshot({ path: resolve(output, `${scenario}-390.png`), fullPage: true, animations: 'disabled' });
    screenshots.push(`${scenario}-390.png`);
  }
  assert.deepEqual(errors, [], 'scenario browser errors');
  assert.deepEqual(forbidden, [], 'scenario daemon or external requests');
  const assets = resolve(repo, 'packages/web/dist/assets');
  const productionJs = readdirSync(assets).filter(name => name.endsWith('.js')).map(name => readFileSync(resolve(assets, name), 'utf8')).join('\n');
  for (const marker of ['sample-1', 'openai-primary', 'qp-pulse-label', 'redesign-preview']) assert.equal(productionJs.includes(marker), false, `preview leaked into production: ${marker}`);
  writeFileSync(resolve(output, 'verification.json'), JSON.stringify({ checks: ['quota selection', 'node details', 'dialog focus restore', 'en/th × dark/light × 4 widths', 'no page overflow', 'reduced motion', 'no preference writes', 'no daemon/external requests', 'no browser errors', 'production preview exclusion', 'empty/stale/critical/long-name scenarios'], profile: { initialReadyMs, initialRequests, mode: 'Vite development, headless Chrome; not a production performance score' }, measurements, screenshots, visualApproval: 'pending' }, null, 2));
  console.log(`Redesign pilot: all checks passed; ${screenshots.length} screenshots saved to screens/redesign-foundation.`);
} finally {
  await browser?.close();
  await server.close();
}
