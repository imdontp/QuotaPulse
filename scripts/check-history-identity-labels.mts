/** History identity rendering against isolated long/short/null API records. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import { openDb } from '../packages/daemon/src/db/index.js';
import { buildServer } from '../packages/daemon/src/api/server.js';
import { Scheduler } from '../packages/daemon/src/ingest/scheduler.js';
import { en } from '../packages/web/src/i18n/en.js';
import { th } from '../packages/web/src/i18n/th.js';

const root = resolve('.'), output = resolve(root, 'screens/history-identity-labels'), webRoot = resolve(root, 'packages/web/dist');
mkdirSync(output, { recursive: true });
const now = Date.now(), token = 'synthetic-history-labels', base = 'http://127.0.0.1:7840';
const longSource = 'Claude Code synthetic source with a very long descriptive identity';
const longProject = 'Synthetic project with a very long descriptive name and ภาษาไทย';
const db = openDb(':memory:');
const source = db.prepare('INSERT INTO source(id,harness,profile,root_path,display_name,detected_at) VALUES(?,?,?,?,?,?)');
const session = db.prepare('INSERT INTO session(id,source_id,native_session_id,project,last_seen_at) VALUES(?,?,?,?,?)');
const event = db.prepare("INSERT INTO usage_event(id,source_id,session_id,dedup_key,ts,model,provider,total_tokens,call_count,cost_usd,cost_source) VALUES(?,?,?,?,?,'fixture-model','openai',10,1,0.1,'computed')");
for (const [id, name, project] of [[1, 'Short', 'Short'], [2, longSource, longProject], [3, 'No project source', null], [4, 'Empty project source', '']] as const) {
  source.run(id, 'claude-code', `fixture-${id}`, '/synthetic/nonexistent', name, now);
  session.run(id, id, `fixture-session-${id}`, project, now - id * 1000);
  event.run(id, id, id, `fixture-event-${id}`, now - id * 1000);
}
const app = buildServer(db, new Scheduler(db, []), { token, port: 7840, webRoot });
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
const cases: object[] = [], errors: string[] = [], forbidden: string[] = [];
try {
  await app.listen({ host: '127.0.0.1', port: 7840 });
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  for (const lang of ['en', 'th'] as const) for (const theme of ['dark', 'light']) for (const width of [390, 900, 1280, 1672]) {
    const context = await browser.newContext({ viewport: { width, height: 941 }, reducedMotion: 'reduce' });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => { const req = route.request(), url = new URL(req.url()); if (url.origin !== base || url.pathname.startsWith('/api/') && req.method() !== 'GET') { forbidden.push(`${req.method()} ${url.pathname}`); return route.abort(); } return route.continue(); });
    await page.addInitScript(({ lang, theme, token }) => { (window as any).__QUOTAPULSE_TOKEN__ = token; localStorage.setItem('quotapulse-prefs', JSON.stringify({ lang, currency: 'USD', rate: 1, hiddenSubscriptions: [] })); localStorage.setItem('quotapulse-theme', theme); }, { lang, theme, token });
    const response = page.waitForResponse(res => res.url().includes('/api/usage-events?') && res.ok());
    await page.goto(`${base}/#history?range=all`);
    const data = await (await response).json();
    const table = page.getByTestId('usage-history').locator('.qp-history-table');
    await table.locator('tbody tr').first().waitFor();
    assert.equal(data.rows.length, 4); assert.equal(await table.locator('tbody tr').count(), 4);
    for (const row of data.rows) {
      const rendered = table.locator('tbody tr').filter({ has: page.locator('button').filter({ hasText: new RegExp(`^#${row.event_id}$`) }) });
      assert.equal(await rendered.count(), 1);
      const project = row.project ?? (lang === 'th' ? th : en)['redesign.unassigned'];
      for (const [selector, value] of [['.qp-history-project', project], ['.qp-history-harness', row.source_name]]) {
        const identity = rendered.locator(selector), label = identity.locator('.qp-history-identity-label');
        assert.equal(await identity.getAttribute('title'), value); assert.equal(await label.textContent(), value);
        const state = await label.evaluate(element => ({ client: element.clientWidth, scroll: element.scrollWidth, overflow: getComputedStyle(element).textOverflow }));
        if (width >= 1280) {
          assert.equal(state.overflow, 'ellipsis');
          if (value === longProject || value === longSource) assert.ok(state.scroll > state.client, `Long ${selector} should truncate within the table`);
          if (value === 'Short') assert.ok(state.scroll <= state.client, `Short ${selector} should remain untruncated`);
        }
      }
    }
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    if (lang === 'en' && theme === 'dark' && width === 1672) await page.screenshot({ path: resolve(output, 'history-long-identities.png'), animations: 'disabled' });
    cases.push({ lang, theme, width, rows: data.rows.length, longAndShortLabels: true, nullAndEmptyProjects: true });
    await context.close();
  }
  assert.equal(cases.length, 16); assert.deepEqual(errors, []); assert.deepEqual(forbidden, []);
  writeFileSync(resolve(output, 'verification.json'), JSON.stringify({ productionIndexSha256: createHash('sha256').update(readFileSync(resolve(webRoot, 'index.html'))).digest('hex'), cases, errors, forbidden }, null, 2) + '\n');
  console.log('PASS 16 History identity label cases with long, short, null and empty synthetic values.');
} finally { await browser?.close(); await app.close(); db.close(); }
