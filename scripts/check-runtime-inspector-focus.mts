/** Test queued native dialog close against a real UI and isolated synthetic API. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import { openDb } from '../packages/daemon/src/db/index.js';
import { buildServer } from '../packages/daemon/src/api/server.js';
import { Scheduler } from '../packages/daemon/src/ingest/scheduler.js';

const output = resolve('screens/runtime-inspector-focus'), webRoot = resolve('packages/web/dist');
mkdirSync(output, { recursive: true });
rmSync(resolve(output, 'verification.json'), { force: true });
const now = Date.now(), base = 'http://127.0.0.1:7844', token = 'synthetic-inspector-focus';
const db = openDb(':memory:');
db.prepare("INSERT INTO source(id,harness,profile,root_path,display_name,detected_at) VALUES(1,'codex','fixture','/synthetic/nonexistent','Fixture',?)").run(now);
const session = db.prepare('INSERT INTO session(id,source_id,native_session_id,project,last_seen_at) VALUES(?,1,?,?,?)');
const event = db.prepare("INSERT INTO usage_event(source_id,session_id,dedup_key,ts,model,provider,total_tokens,call_count) VALUES(1,?,?,?,'fixture-model','openai',?,1)");
for (const [id, project, tokens] of [[1, null, 11], [2, '', 22], [3, 'Other', 33]] as const) {
  session.run(id, `fixture-session-${id}`, project, now - 1000);
  event.run(id, `fixture-event-${id}`, now - 1000, tokens);
}
const app = buildServer(db, new Scheduler(db, []), { token, port: 7844, webRoot });
const cases: object[] = [], errors: string[] = [], forbidden: string[] = [];
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
try {
  await app.listen({ host: '127.0.0.1', port: 7844 });
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  for (const lang of ['en', 'th']) for (const theme of ['dark', 'light']) for (const width of [390, 1586]) {
    const context = await browser.newContext({ viewport: { width, height: 992 }, reducedMotion: 'reduce' });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => { const request = route.request(), url = new URL(request.url()); if (url.origin !== base || url.pathname.startsWith('/api/') && request.method() !== 'GET') { forbidden.push(`${request.method()} ${url.pathname}`); return route.abort(); } return route.continue(); });
    await page.addInitScript(({ token, lang, theme }) => {
      (window as any).__QUOTAPULSE_TOKEN__ = token;
      localStorage.setItem('quotapulse-prefs', JSON.stringify({ lang, currency: 'USD', rate: 1, hiddenSubscriptions: [] }));
      localStorage.setItem('quotapulse-theme', theme);
      (window as any).__inspectorCloses = 0;
      document.addEventListener('close', event => { if ((event.target as Element)?.matches('.qp-dialog')) (window as any).__inspectorCloses++; }, true);
    }, { token, lang, theme });
    await page.goto(`${base}/#overview?range=all`);
    await page.locator('.qp-runtime-options>summary').click();
    await page.locator('.qp-runtime-project select').selectOption('');
    await page.locator('.qp-runtime-data>summary').click();
    const rows = page.locator('.qp-runtime-nodes tbody tr');
    await page.waitForFunction(() => { const keys = [...document.querySelectorAll('.qp-runtime-nodes tbody tr')].map(node => node.getAttribute('data-identity')); return keys.includes(JSON.stringify(['project', null])) && keys.includes(JSON.stringify(['project', ''])); });
    const keys = await rows.evaluateAll(nodes => nodes.map(node => node.getAttribute('data-identity')));
    const missingIndex = keys.indexOf(JSON.stringify(['project', null])), emptyIndex = keys.indexOf(JSON.stringify(['project', '']));
    assert.ok(missingIndex >= 0 && emptyIndex >= 0);
    const missing = rows.nth(missingIndex).locator('button'), empty = rows.nth(emptyIndex).locator('button');
    const dialog = page.locator('.qp-dialog');
    await missing.focus(); await page.keyboard.press('Enter'); await dialog.waitFor({ state: 'visible' });
    assert.equal(await dialog.locator('h2').textContent(), await missing.textContent());
    assert.equal(await dialog.locator('.qp-detail-grid strong').first().textContent(), '11');
    await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'hidden' });
    assert.equal(await missing.evaluate(node => document.activeElement === node), true, 'Escape restores normal opener focus');
    await missing.focus(); await page.keyboard.press('Enter'); await dialog.waitFor({ state: 'visible' });
    const closeCount = await page.evaluate(() => (window as any).__inspectorCloses);
    const moved = await page.evaluate(index => { const dialog = document.querySelector<HTMLDialogElement>('.qp-dialog')!; const rows = [...document.querySelectorAll('.qp-runtime-nodes tbody tr')]; dialog.close(); const target = rows[index]!.querySelector('button')!; target.focus(); return document.activeElement === target; }, emptyIndex);
    assert.equal(moved, true, 'A new target was focused after close and before the queued event');
    await page.waitForFunction(count => (window as any).__inspectorCloses > count, closeCount);
    assert.equal(await empty.evaluate(node => document.activeElement === node), true, 'The delayed close must not steal the new focus');
    await page.keyboard.press('Enter'); await dialog.waitFor({ state: 'visible' });
    assert.equal(await dialog.locator('h2').textContent(), await empty.textContent());
    assert.equal(await dialog.locator('.qp-detail-grid strong').first().textContent(), '22');
    await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'hidden' });
    assert.equal(await empty.evaluate(node => document.activeElement === node), true, 'The new opener also regains focus on normal close');
    cases.push({ lang, theme, width, normalClose: true, queuedClosePreservesNewFocus: true, subsequentSelectionCorrect: true });
    await context.close();
  }
  assert.equal(cases.length, 8); assert.deepEqual(errors, []); assert.deepEqual(forbidden, []);
  writeFileSync(resolve(output, 'verification.json'), JSON.stringify({ productionIndexSha256: createHash('sha256').update(readFileSync(resolve(webRoot, 'index.html'))).digest('hex'), fixture: 'isolated in-memory API; distinct null/empty project records', cases, errors, forbidden }, null, 2) + '\n');
  console.log('PASS 8 Runtime Map focus and queued-close cases across locale, theme and width.');
} finally { await browser?.close(); await app.close(); db.close(); }
