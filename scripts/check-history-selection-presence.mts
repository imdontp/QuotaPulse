/** Exercise retained History details using real API responses and synthetic records. */
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

const output = resolve('screens/history-selection-presence'), webRoot = resolve('packages/web/dist');
mkdirSync(output, { recursive: true });
const now = Date.now(), token = 'synthetic-history-selection', base = 'http://127.0.0.1:7842';
const db = openDb(':memory:');
const source = db.prepare('INSERT INTO source(id,harness,profile,root_path,display_name,detected_at) VALUES(?,?,?,?,?,?)');
const session = db.prepare('INSERT INTO session(id,source_id,native_session_id,project,last_seen_at) VALUES(?,?,?,?,?)');
const event = db.prepare("INSERT INTO usage_event(id,source_id,session_id,dedup_key,ts,model,provider,total_tokens,call_count,cost_usd,cost_source) VALUES(?,?,?,?,?,'fixture-model','openai',10,1,0.1,'computed')");
for (const id of [1, 2]) {
  source.run(id, 'codex', `fixture-${id}`, '/synthetic/nonexistent', `Synthetic source ${id}`, now);
  session.run(id, id, `fixture-session-${id}`, 'Synthetic project', now);
}
for (let id = 1; id <= 53; id++) event.run(id, id === 53 ? 2 : 1, id === 53 ? 2 : 1, `fixture-event-${id}`, now - id * 1000);
const app = buildServer(db, new Scheduler(db, []), { token, port: 7842, webRoot });
const cases: object[] = [], errors: string[] = [], forbidden: string[] = [];
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
try {
  await app.listen({ host: '127.0.0.1', port: 7842 });
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  for (const lang of ['en', 'th'] as const) for (const theme of ['dark', 'light']) for (const width of [390, 1672]) {
    const context = await browser.newContext({ viewport: { width, height: 941 }, reducedMotion: 'reduce' });
    const page = await context.newPage(), messages = lang === 'th' ? th : en;
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => { const req = route.request(), url = new URL(req.url()); if (url.origin !== base || url.pathname.startsWith('/api/') && req.method() !== 'GET') { forbidden.push(`${req.method()} ${url.pathname}`); return route.abort(); } return route.continue(); });
    await page.addInitScript(({ lang, theme, token }) => { (window as any).__QUOTAPULSE_TOKEN__ = token; localStorage.setItem('quotapulse-prefs', JSON.stringify({ lang, currency: 'USD', rate: 1, hiddenSubscriptions: [] })); localStorage.setItem('quotapulse-theme', theme); }, { lang, theme, token });
    await page.goto(`${base}/#history?range=all&source=1`);
    await page.waitForFunction(() => document.querySelector('#history-detail-title')?.textContent?.includes('#1'));
    const notice = page.getByTestId('history-selection-outside-page');
    const link = page.locator('aside a[href*="session_id="]');
    const originalHref = await link.getAttribute('href');
    assert.ok(originalHref);
    assert.equal(new URLSearchParams(originalHref.split('?')[1]).get('source'), '1');
    assert.equal(await notice.count(), 0);
    await page.getByRole('button', { name: messages['history.next'], exact: true }).click();
    await notice.waitFor({ state: 'visible' });
    assert.equal(await notice.textContent(), messages['history.selectionOutsidePage']);
    assert.equal(await notice.getAttribute('role'), 'status');
    assert.equal(await link.getAttribute('href'), originalHref);
    assert.ok((await page.locator('#history-detail-title').textContent())?.includes('#1'));
    await page.getByRole('button', { name: messages['history.previous'], exact: true }).click();
    await notice.waitFor({ state: 'detached' });
    const refreshedHref = await link.getAttribute('href');
    assert.ok(refreshedHref);
    assert.equal(new URLSearchParams(refreshedHref.split('?')[1]).get('source'), '1');
    await page.evaluate(() => { location.hash = '#history?range=all&source=2'; });
    await notice.waitFor({ state: 'visible' });
    await page.waitForFunction(() => [...document.querySelectorAll('[data-testid="usage-history"] tbody button')].some(button => button.textContent === '#53'));
    assert.equal(await link.getAttribute('href'), refreshedHref);
    if (lang === 'en' && theme === 'dark' && width === 1672) {
      await page.evaluate(() => scrollTo(0, 0));
      await page.screenshot({ path: resolve(output, 'history-retained-selection.png'), animations: 'disabled' });
    }
    await page.getByTestId('usage-history').locator('tbody button').filter({ hasText: /^#53$/ }).click();
    await page.waitForFunction(() => document.querySelector('#history-detail-title')?.textContent?.includes('#53'));
    await notice.waitFor({ state: 'detached' });
    const replacementHref = await link.getAttribute('href');
    assert.ok(replacementHref);
    assert.equal(new URLSearchParams(replacementHref.split('?')[1]).get('source'), '2');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    cases.push({ lang, theme, width, pagination: true, sourceChange: true, originalScopePreserved: true, selectingNewRecord: true });
    await context.close();
  }
  assert.equal(cases.length, 8); assert.deepEqual(errors, []); assert.deepEqual(forbidden, []);
  writeFileSync(resolve(output, 'verification.json'), JSON.stringify({ productionIndexSha256: createHash('sha256').update(readFileSync(resolve(webRoot, 'index.html'))).digest('hex'), cases, errors, forbidden }, null, 2) + '\n');
  console.log('PASS 8 History retained-selection cases with real API responses.');
} finally { await browser?.close(); await app.close(); db.close(); }
