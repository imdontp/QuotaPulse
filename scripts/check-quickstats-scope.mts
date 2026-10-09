/** Scoped sidebar behavior through production HTTP; isolated synthetic database only. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { openDb } from '../packages/daemon/src/db/index.js';
import { buildServer } from '../packages/daemon/src/api/server.js';
import { Scheduler } from '../packages/daemon/src/ingest/scheduler.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const output = resolve(root, 'screens/quickstats-scope');
mkdirSync(output, { recursive: true });
rmSync(resolve(output, 'verification.json'), { force: true });
const originalNow = Date.now;
const fixedNow = Date.UTC(2026, 9, 9, 12);
Date.now = () => fixedNow;
const db = openDb(':memory:');
db.exec(`INSERT INTO source(id,harness,profile,root_path,display_name,detected_at) VALUES
  (1,'codex','test','/synthetic/nonexistent','Source A',0),
  (2,'hermes','test','/synthetic/nonexistent','Source B',0);
  INSERT INTO session(id,source_id,native_session_id,project,last_seen_at) VALUES
  (1,1,'session-a','Alpha',${fixedNow - 1000}),
  (2,2,'session-b','Beta',${fixedNow - 1000}),
  (3,1,'metadata-only','Metadata only',${fixedNow - 1000});`);
const insert = db.prepare(`INSERT INTO usage_event(source_id,session_id,dedup_key,ts,model,provider,total_tokens,call_count,cost_usd,cost_source)
  VALUES (?,?,?,?,?,?,100,1,0.1,'computed')`);
insert.run(1, 1, 'a', fixedNow - 120_000, 'gpt-test', 'openai');
insert.run(2, 2, 'b', fixedNow - 60_000, 'claude-test', 'anthropic');
insert.run(1, 1, 'outside', fixedNow - 8 * 86_400_000, 'gpt-outside', 'openai');
const from = fixedNow - 3_600_000, to = fixedNow + 1;
const bounds = `range=custom&from=${from}&to=${to}`;
const scheduler = new Scheduler(db, [], { pollMs: 1_000_000, detectMs: 1_000_000 });
const daemon = buildServer(db, scheduler, { token: 'quickstats-test', port: 7806, webRoot: resolve(root, 'packages/web/dist') });
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
let releaseHeld: (() => void) | undefined;
let releasePendingPause: (() => void) | undefined;
try {
  await daemon.listen({ host: '127.0.0.1', port: 7806 });
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 1672, height: 941 }, reducedMotion: 'reduce', timezoneId: 'Asia/Bangkok' });
  await page.addInitScript(`window.__QUOTAPULSE_TOKEN__='quickstats-test';Date.now=()=>${fixedNow};localStorage.setItem('quotapulse-theme','dark');localStorage.setItem('quotapulse-prefs',JSON.stringify({lang:'en',currency:'USD',rate:1}));`);
  const errors: string[] = [];
  const summaryRequests: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (new URL(request.url()).pathname === '/api/runtime-summary') summaryRequests.push(request.url()); });
  await page.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
  const count = (key: string) => page.locator(`.qp-quick-stats [data-stat=${key}]`);
  const waitModels = async (expected: string) => {
    await page.waitForFunction(value => document.querySelector('.qp-quick-stats [data-stat=models]')?.textContent === value, expected);
  };
  await page.goto('http://127.0.0.1:7806/#providers');
  await waitModels('3');
  assert.equal(await count('namedProjects').textContent(), '3', 'Legacy machine scope retains metadata-only projects');
  assert.equal(await count('recentSessions').textContent(), '3');

  // Capture an actual old A result, then change A/B/A while its delivery is delayed.
  let markHeld!: () => void;
  const held = new Promise<void>(resolve => { markHeld = resolve; });
  const release = new Promise<void>(resolve => { releaseHeld = resolve; });
  let intercepted = false;
  await page.route('**/api/runtime-summary?*', async route => {
    const query = new URL(route.request().url()).searchParams;
    if (!intercepted && query.get('source_id') === '1') {
      intercepted = true;
      const response = await route.fetch();
      assert.equal((await response.json()).models, 1);
      markHeld();
      await release;
      await route.fulfill({ response });
    } else await route.continue();
  });
  await page.evaluate(hash => { location.hash = hash; }, `models?${bounds}&source=1`);
  let heldTimeout: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([held, new Promise<never>((_, reject) => { heldTimeout = setTimeout(() => reject(new Error('Scoped summary A was not requested within15 seconds')), 15_000); })]);
  } finally { clearTimeout(heldTimeout); }
  assert.equal(await count('models').textContent(), 'Unknown', 'Pending scoped data must not reuse machine counts');
  const scopedNote = await page.locator('#qp-quick-stats-note').textContent();
  assert.match(scopedNote ?? '', /displayed time range and applied filters/i);
  await page.evaluate(() => {
    const samples: string[] = [];
    (window as any).__quickStatsSamples = samples;
    new MutationObserver(() => { samples.push(document.querySelector('.qp-quick-stats [data-stat=models]')?.textContent ?? ''); }).observe(document.querySelector('.qp-quick-stats')!, { subtree: true, childList: true, characterData: true });
  });
  await page.evaluate(hash => { location.hash = hash; }, `models?${bounds}&source=2`);
  await page.locator('.qp-model-table-wrap tbody tr').filter({ hasText: 'claude-test' }).waitFor();
  assert.equal(await count('models').textContent(), 'Unknown', 'Old A must not appear while B is pending');
  insert.run(1, 1, 'new-a', fixedNow - 60_000, 'gpt-new', 'openai');
  await page.evaluate(hash => { location.hash = hash; }, `models?${bounds}&source=1`);
  await page.locator('.qp-model-table-wrap tbody tr').filter({ hasText: 'gpt-new' }).waitFor();
  releaseHeld!();
  await waitModels('2');
  const samples = await page.evaluate(() => (window as any).__quickStatsSamples as string[]);
  assert.ok(!samples.includes('1'), `Obsolete A response appeared after A/B/A: ${JSON.stringify(samples)}`);
  assert.equal(await count('namedProjects').textContent(), '1');
  assert.equal(await count('providers').textContent(), '1');
  const modelLink = page.locator('.qp-quick-stats [data-stat=models]').locator('..').locator('dt a');
  const modelParams = new URLSearchParams((await modelLink.getAttribute('href'))!.split('?')[1]);
  assert.equal(modelParams.get('source'), '1');
  assert.equal(modelParams.get('from'), String(from)); assert.equal(modelParams.get('to'), String(to));
  const liveLink = page.locator('.qp-quick-stats [data-stat=recentSessions]').locator('..').locator('dt a');
  assert.equal(await liveLink.getAttribute('href'), null, 'Rolling Live cannot silently broaden a custom source/time scope');
  await page.screenshot({ path: resolve(output, 'models-scoped-en-dark.png'), animations: 'disabled' });

  // History counts follow committed filters, remain stable for dirty form/pause.
  await page.goto(`http://127.0.0.1:7806/#history?${bounds}`);
  await waitModels('3');
  const history = page.getByTestId('usage-history');
  const dialog = page.getByRole('dialog');
  if (await dialog.isVisible()) await page.keyboard.press('Escape');
  await history.getByLabel('Routed provider', { exact: true }).fill('openai');
  assert.equal(await count('models').textContent(), '3', 'Unapplied History filter must not change sidebar scope');
  await history.getByRole('button', { name: 'Apply filters', exact: true }).click();
  await waitModels('2');
  let markPauseHeld!: () => void;
  const pauseHeld = new Promise<void>(resolve => { markPauseHeld = resolve; });
  let releasePauseHeld!: () => void;
  const pauseRelease = new Promise<void>(resolve => { releasePauseHeld = resolve; releasePendingPause = resolve; });
  let pauseIntercepted = false;
  await page.route('**/api/runtime-summary?*', async route => {
    if (!pauseIntercepted && new URL(route.request().url()).searchParams.get('provider') === 'openai') {
      pauseIntercepted = true;
      const response = await route.fetch();
      assert.equal((await response.json()).models, 3);
      markPauseHeld();
      await pauseRelease;
      await route.fulfill({ response });
    } else await route.continue();
  });
  insert.run(1, 1, 'inflight', fixedNow - 40_000, 'gpt-inflight', 'openai');
  await page.evaluate(() => dispatchEvent(new Event('online')));
  let pauseTimeout: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([pauseHeld, new Promise<never>((_, reject) => { pauseTimeout = setTimeout(() => reject(new Error('Pre-pause request was not captured')), 15_000); })]);
  } finally { clearTimeout(pauseTimeout); }
  await history.getByRole('button', { name: 'Pause view', exact: true }).click();
  insert.run(1, 1, 'pause', fixedNow - 30_000, 'gpt-paused', 'openai');
  releasePauseHeld();
  await page.evaluate(() => dispatchEvent(new Event('online')));
  await page.waitForTimeout(1500);
  assert.equal(await count('models').textContent(), '2', 'Paused History sidebar must retain its displayed snapshot counts');
  await history.getByRole('button', { name: 'Resume latest', exact: true }).click();
  await waitModels('4');
  await page.screenshot({ path: resolve(output, 'history-scoped-en-dark.png'), animations: 'disabled' });
  await page.goto('http://127.0.0.1:7806/#live?provider=openai');
  const live = page.getByTestId('production-live');
  await live.waitFor();
  await waitModels('4');
  await live.getByRole('button', { name: 'Pause view', exact: true }).click();
  insert.run(1, 1, 'live-pause', fixedNow - 20_000, 'gpt-live', 'openai');
  await page.evaluate(() => dispatchEvent(new Event('online')));
  await page.waitForTimeout(1500);
  assert.equal(await count('models').textContent(), '4', 'Paused Live counts retain its displayed usage snapshot');
  await live.getByRole('button', { name: 'Resume latest', exact: true }).click();
  await waitModels('5');
  await page.screenshot({ path: resolve(output, 'live-scoped-en-dark.png'), animations: 'disabled' });
  assert.deepEqual(errors, []);
  assert.ok(summaryRequests.some(url => !new URL(url).search));
  assert.ok(summaryRequests.some(url => new URL(url).searchParams.get('provider') === 'openai'));
  writeFileSync(resolve(output, 'verification.json'), JSON.stringify({ database: 'isolated in-memory synthetic', clock: fixedNow, productionIndexSha256: createHash('sha256').update(readFileSync(resolve(root, 'packages/web/dist/index.html'))).digest('hex'), checks: ['legacy machine metadata-only counts', 'selected source/time counts', 'pending scoped state never global', 'actual delayed A/B/A response rejected', 'supported navigation preserves scope', 'unsupported navigation non-action', 'History committed scope not dirty draft', 'History rejects pre-pause in-flight response', 'History pause snapshot and resume', 'Live pause snapshot and resume', 'no browser errors'], summaryRequests, samples }, null, 2));
  console.log('QuickStats scoped production workflow passed.');
} finally {
  releaseHeld?.();
  releasePendingPause?.();
  await browser?.close(); await daemon.close(); db.close(); Date.now = originalNow;
}
