/** Compiled History axes against real API data in an isolated synthetic database. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import { openDb } from '../packages/daemon/src/db/index.js';
import { buildServer } from '../packages/daemon/src/api/server.js';
import { Scheduler } from '../packages/daemon/src/ingest/scheduler.js';

const root = resolve('.'), output = resolve(root, 'screens/history-axis'), webRoot = resolve(root, 'packages/web/dist');
mkdirSync(output, { recursive: true });
const now = Date.now(), token = 'synthetic-history-axis', base = 'http://127.0.0.1:7841';
const db = openDb(':memory:');
const source = db.prepare('INSERT INTO source(id,harness,profile,root_path,display_name,detected_at) VALUES(?,?,?,?,?,?)');
const session = db.prepare('INSERT INTO session(id,source_id,native_session_id,project,last_seen_at) VALUES(?,?,?,?,?)');
const event = db.prepare("INSERT INTO usage_event(id,source_id,session_id,dedup_key,ts,model,provider,input_tokens,output_tokens,total_tokens,call_count,cost_usd,cost_source) VALUES(?,?,?,?,?,'fixture-model','openai',?,0,?,1,0.1,'computed')");
const values = [0, 1, 2, .5, .000001, 1_000_000];
for (const [index, value] of values.entries()) {
  const id = index + 1;
  source.run(id, 'codex', `axis-${id}`, '/synthetic/nonexistent', `Axis fixture ${id}`, now);
  session.run(id, id, `axis-session-${id}`, 'Synthetic project', now - 1000);
  event.run(id, id, id, `axis-event-${id}`, now - 1000, value, value);
}
const app = buildServer(db, new Scheduler(db, []), { token, port: 7841, webRoot });
const cases: object[] = [], errors: string[] = [], forbidden: string[] = [];
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
try {
  await app.listen({ host: '127.0.0.1', port: 7841 });
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  for (const lang of ['en', 'th'] as const) for (const theme of ['dark', 'light']) for (const width of [390, 1672]) {
    const context = await browser.newContext({ viewport: { width, height: 941 }, reducedMotion: 'reduce' });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => { const req = route.request(), url = new URL(req.url()); if (url.origin !== base || url.pathname.startsWith('/api/') && req.method() !== 'GET') { forbidden.push(`${req.method()} ${url.pathname}`); return route.abort(); } return route.continue(); });
    await page.addInitScript(({ lang, theme, token }) => { (window as any).__QUOTAPULSE_TOKEN__ = token; localStorage.setItem('quotapulse-prefs', JSON.stringify({ lang, currency: 'USD', rate: 1, hiddenSubscriptions: [] })); localStorage.setItem('quotapulse-theme', theme); }, { lang, theme, token });
    for (const [index, value] of values.entries()) {
      const ready = page.waitForResponse(res => res.url().includes('/api/history-summary?') && res.ok());
      await page.goto(`${base}/#history?range=all&source=${index + 1}`);
      const data = await (await ready).json();
      const svg = page.getByTestId('history-timeline').locator(':scope > svg');
      await svg.locator('text[data-axis-value]').first().waitFor();
      const maximum = Math.max(0, ...data.timeline.flatMap((point: any) => [point.inputTokens, point.outputTokens]));
      assert.equal(maximum, value);
      const ticks = await svg.locator('text[data-axis-value]').evaluateAll(nodes => nodes.map(node => ({ value: Number(node.getAttribute('data-axis-value')), label: node.textContent })));
      assert.deepEqual(ticks.map(tick => tick.value), maximum === 0 ? [0] : [0, .25, .5, .75, 1].map(fraction => maximum * fraction));
      assert.equal(new Set(ticks.map(tick => tick.label)).size, ticks.length, 'Different scale positions must have different labels');
      const pointY = await svg.locator('g[data-bucket-at] circle').first().getAttribute('cy');
      assert.equal(Number(pointY), maximum === 0 ? 118 : 18, 'A nonzero recorded maximum reaches the top of its own scale');
      const overlap = await svg.evaluate(node => { const bounds = node.getBoundingClientRect(), scale = bounds.width / node.viewBox.baseVal.width; return [...node.querySelectorAll('text[data-axis-value]')].some(label => label.getBoundingClientRect().right > bounds.left + 44 * scale + 1); });
      assert.equal(overlap, false, `Axis labels overlap the plot for ${value} at ${width}px`);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      if (lang === 'en' && theme === 'dark' && width === 1672 && (value === 0 || value === 1)) {
        const row = page.getByTestId('usage-history').locator('tbody tr').filter({ has: page.locator('button').filter({ hasText: new RegExp(`^#${index + 1}$`) }) });
        await row.locator('button').click();
        await page.waitForFunction(id => document.querySelector('#history-detail-title')?.textContent?.includes(`#${id}`), index + 1);
        await page.evaluate(() => scrollTo(0, 0));
        await page.screenshot({ path: resolve(output, `history-axis-${value}.png`), animations: 'disabled' });
      }
      cases.push({ lang, theme, width, value, ticks, maximumAtTop: maximum > 0, noOverlap: true });
    }
    await context.close();
  }
  assert.equal(cases.length, 48); assert.deepEqual(errors, []); assert.deepEqual(forbidden, []);
  writeFileSync(resolve(output, 'verification.json'), JSON.stringify({ productionIndexSha256: createHash('sha256').update(readFileSync(resolve(webRoot, 'index.html'))).digest('hex'), cases, errors, forbidden }, null, 2) + '\n');
  console.log('PASS 48 History axis cases for zero, fractional and large API values.');
} finally { await browser?.close(); await app.close(); db.close(); }
