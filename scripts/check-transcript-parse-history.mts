/** Compiled Diagnostics against real adapters and isolated synthetic transcript files. */
import assert from 'node:assert/strict';
import { appendFileSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';
import { openDb, upsertSource } from '../packages/daemon/src/db/index.js';
import { codexAdapter } from '../packages/daemon/src/adapters/codex.js';
import { claudeCodeAdapter } from '../packages/daemon/src/adapters/claude-code.js';
import { runPass } from '../packages/daemon/src/ingest/runner.js';
import { Scheduler } from '../packages/daemon/src/ingest/scheduler.js';
import { buildServer } from '../packages/daemon/src/api/server.js';
import { tmpRoot, writeCodexProfile, writeClaudeProfile } from '../packages/daemon/test/fixtures.js';
import { en } from '../packages/web/src/i18n/en.js';
import { th } from '../packages/web/src/i18n/th.js';

const home = tmpRoot('quotapulse-parse-');
const codexRoot = join(home, 'codex'), claudeRoot = join(home, 'claude');
mkdirSync(codexRoot); mkdirSync(claudeRoot);
const codexFile = writeCodexProfile(codexRoot), claudeFile = writeClaudeProfile(claudeRoot);
appendFileSync(codexFile, '{invalid-private-fixture}\n{}\n');
const db = openDb(':memory:');
const codex = { profile: 'fixture-codex', rootPath: codexRoot, displayName: 'Fixture Codex' };
const claude = { profile: 'fixture-claude', rootPath: claudeRoot, displayName: 'Fixture Claude' };
const codexId = upsertSource(db, { harness: 'codex', ...codex });
const claudeId = upsertSource(db, { harness: 'claude-code', ...claude });
const sources = [{ adapter: codexAdapter, profile: codex, sourceId: codexId }, { adapter: claudeCodeAdapter, profile: claude, sourceId: claudeId }];
const daemon = buildServer(db, new Scheduler(db, []), { token: 'parse-history-test', port: 0, webRoot: resolve('packages/web/dist') });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
let cases = 0;
try {
  await runPass(db, sources);
  // Simulate a cursor already consumed by an older daemon, and preserve historical data after disabling that reader.
  db.prepare('UPDATE ingest_state SET meta = ? WHERE source_id = ? AND target_key = ?').run('{}', claudeId, claudeFile);
  db.prepare('UPDATE source SET enabled = 0 WHERE id = ?').run(claudeId);
  appendFileSync(codexFile, '{}\n');
  await runPass(db, [sources[0]!]);
  const response = await daemon.inject({ method: 'GET', url: '/api/health', headers: { 'x-quotapulse-token': 'parse-history-test' } });
  assert.equal(response.statusCode, 200);
  const warnings = response.json().transcriptParseWarnings;
  assert.deepEqual(warnings.map(({ sourceId, malformedLines, unverifiedFiles, enabled }: any) => ({ sourceId, malformedLines, unverifiedFiles, enabled })), [
    { sourceId: claudeId, malformedLines: 0, unverifiedFiles: 1, enabled: false },
    { sourceId: codexId, malformedLines: 1, unverifiedFiles: 0, enabled: true },
  ]);
  assert.doesNotMatch(JSON.stringify(warnings), /quotapulse-parse-|invalid-private-fixture/);
  await daemon.listen({ host: '127.0.0.1', port: 0 });
  const address = daemon.server.address(); assert.ok(address && typeof address !== 'string');
  const base = `http://127.0.0.1:${address.port}`;
  for (const language of ['en', 'th'] as const) for (const theme of ['dark', 'light'] as const) for (const width of [390, 1440]) {
    const messages = language === 'en' ? en : th;
    const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
    const page = await context.newPage(), errors: string[] = [], forbidden: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => {
      const request = route.request(), url = new URL(request.url());
      if (url.origin !== base || !['GET', 'HEAD'].includes(request.method())) { forbidden.push(`${request.method()} ${url.origin}${url.pathname}`); return route.abort(); }
      return route.continue();
    });
    await page.addInitScript(({ language, theme }) => {
      (window as any).__QUOTAPULSE_TOKEN__ = 'parse-history-test';
      localStorage.setItem('quotapulse-prefs', JSON.stringify({ lang: language, currency: 'USD', rate: 1, hiddenSubscriptions: [] }));
      localStorage.setItem('quotapulse-theme', theme);
    }, { language, theme });
    try {
      await page.goto(`${base}/#settings?section=diagnostics`);
      const card = page.getByTestId('transcript-parse-warnings'); await card.waitFor();
      assert.ok((await card.innerText()).includes(messages['health.transcriptParseBlurb']));
      assert.deepEqual((await card.locator('tbody tr').filter({ hasText: 'Fixture Codex' }).locator('td').allInnerTexts()).slice(1), ['1', '1', '0']);
      const legacy = card.locator('tbody tr').filter({ hasText: 'Fixture Claude' });
      assert.ok((await legacy.innerText()).includes(messages['health.transcriptInactive']));
      assert.deepEqual((await legacy.locator('td').allInnerTexts()).slice(1), ['1', '0', '1']);
      assert.doesNotMatch(await card.innerText(), /quotapulse-parse-|invalid-private-fixture/);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      if (width === 390) {
        const scroll = await card.getByRole('table').locator('..').evaluate(element => { element.scrollLeft = element.scrollWidth; return element.scrollLeft; });
        assert.ok(scroll > 0, 'all diagnostic columns remain reachable inside the table');
      }
      assert.deepEqual(errors, []); assert.deepEqual(forbidden, []); cases++;
    } finally { await context.close(); }
  }
  for (const language of ['en', 'th'] as const) {
    const messages = language === 'en' ? en : th;
    const context = await browser.newContext({ viewport: { width: 390, height: 900 }, reducedMotion: 'reduce' });
    const page = await context.newPage();
    await page.route('**/*', async route => {
      const request = route.request(), url = new URL(request.url());
      if (url.origin !== base || !['GET', 'HEAD'].includes(request.method())) return route.abort();
      if (url.pathname === '/api/health') {
        const original = await route.fetch(), body = await original.json();
        delete body.transcriptParseWarnings;
        return route.fulfill({ response: original, json: body });
      }
      return route.continue();
    });
    await page.addInitScript(({ language }) => {
      (window as any).__QUOTAPULSE_TOKEN__ = 'parse-history-test';
      localStorage.setItem('quotapulse-prefs', JSON.stringify({ lang: language, currency: 'USD', rate: 1, hiddenSubscriptions: [] }));
    }, { language });
    try {
      await page.goto(`${base}/#settings?section=diagnostics`);
      await page.getByText(messages['health.transcriptParseUnsupported'], { exact: true }).waitFor();
      assert.equal(await page.getByTestId('transcript-parse-warnings').count(), 0);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      cases++;
    } finally { await context.close(); }
  }
  console.log(`Transcript parse history: ${cases} compiled browser cases passed`);
} finally { await browser.close(); await daemon.close(); db.close(); }
