/** Concept-sized comparison using varied synthetic data served by the real API. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium, type Request } from 'playwright';
import { openDb } from '../packages/daemon/src/db/index.js';
import { buildServer } from '../packages/daemon/src/api/server.js';
import { Scheduler } from '../packages/daemon/src/ingest/scheduler.js';
import { installBrowserFixedDate } from './browser-fixed-date.mjs';

const root = resolve('.'), output = resolve('screens/dense-projects-models'), webRoot = resolve('packages/web/dist');
mkdirSync(output, { recursive: true });
rmSync(resolve(output, 'verification.json'), { force: true });
const now = Date.parse('2025-05-17T13:42:00Z'), base = 'http://127.0.0.1:7843', token = 'synthetic-dense-comparison';
const realDate = globalThis.Date;
globalThis.Date = new Proxy(realDate, {
  construct(target, args) { return Reflect.construct(target, args.length ? args : [now]); },
  apply() { return new realDate(now).toString(); },
  get(target, property, receiver) { return property === 'now' ? () => now : Reflect.get(target, property, receiver); },
});
const db = openDb(':memory:');
const source = db.prepare('INSERT INTO source(id,harness,profile,root_path,display_name,detected_at) VALUES(?,?,?,?,?,?)');
const session = db.prepare('INSERT INTO session(id,source_id,native_session_id,project,last_seen_at) VALUES(?,?,?,?,?)');
const usage = db.prepare("INSERT INTO usage_event(source_id,session_id,dedup_key,ts,model,provider,input_tokens,cached_input_tokens,output_tokens,total_tokens,call_count,cost_usd,cost_source) VALUES(?,?,?,?,?,?,?,?,?,?,1,?,'computed')");
const projects = ['QuotaPulse', 'Research Lab', 'Marketing Studio', 'Client Work', 'Playground', 'Archived Demos'];
const models = [
  ['DeepSeek V4.1','deepseek',28], ['GPT-5.x','openai',22], ['Claude 3.7','anthropic',18], ['Claude 3.5','anthropic',15],
  ['OpenAI o1','openai',12], ['Gemini 1.5 Pro','google',10], ['Gemini 1.5 Flash','google',8], ['Llama 3.3 70B','meta',7],
  ['Mistral Large','mistral',6], ['Qwen2.5 72B','alibaba',5], ['Phi 3 Medium','microsoft',4], ['Command R+','cohere',3],
] as const;
for (const [i, harness] of ['codex','claude-code','hermes','opencode'].entries()) source.run(i + 1, harness, `fixture-${i}`, '/synthetic/nonexistent', `Fixture ${harness}`, now);
const dayFactors = [8, 14, 9, 20, 13, 25, 18];
let records = 0;
for (const [p, project] of projects.entries()) for (const [m, [model, provider, weight]] of models.entries()) {
  const sessionId = p * models.length + m + 1, sourceId = m % 4 + 1;
  session.run(sessionId, sourceId, `fixture-session-${sessionId}`, project, now - 60_000);
  for (const [day, factor] of dayFactors.entries()) {
    const at = now - (6 - day) * 86_400_000 - (m + 1) * 30_000 - p * 5_000;
    const total = Math.round(weight * [38, 24, 17, 11, 7, 3][p]! * factor * 15);
    const input = Math.round(total * .58), cached = Math.round(total * .16), outputTokens = total - input - cached;
    usage.run(sourceId, sessionId, `fixture-${sessionId}-${day}`, at, model, provider, input, cached, outputTokens, total, total / 70_000_000);
    records++;
  }
}
const app = buildServer(db, new Scheduler(db, []), { token, port: 7843, webRoot });
const errors: string[] = [], forbidden: string[] = [], captures: object[] = [], layouts: object[] = [], headingCases: object[] = [];
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
const sha = (data: Buffer) => createHash('sha256').update(data).digest('hex');
try {
  await app.listen({ host: '127.0.0.1', port: 7843 });
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  for (const name of ['projects', 'models']) {
    const context = await browser.newContext({ viewport: { width: 1672, height: 941 }, deviceScaleFactor: 1, timezoneId: 'Asia/Bangkok', reducedMotion: 'reduce', colorScheme: 'dark' });
    const page = await context.newPage(), pending = new Set<Request>();
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => { if (response.status() >= 400) errors.push(`${response.status()} ${new URL(response.url()).pathname}`); });
    page.on('request', request => { const path = new URL(request.url()).pathname; if (path.startsWith('/api/') && !path.includes('/events/stream')) pending.add(request); });
    page.on('requestfinished', request => pending.delete(request)); page.on('requestfailed', request => pending.delete(request));
    await page.route('**/*', route => { const req = route.request(), url = new URL(req.url()); const readPost = req.method() === 'POST' && url.pathname === '/api/model-row-trends'; if (url.origin !== base || url.pathname.startsWith('/api/') && req.method() !== 'GET' && !readPost) { forbidden.push(`${req.method()} ${url.pathname}`); return route.abort(); } return route.continue(); });
    await page.addInitScript(({ token }) => { (window as any).__QUOTAPULSE_TOKEN__ = token; localStorage.setItem('quotapulse-prefs', JSON.stringify({ lang: 'en', currency: 'USD', rate: 1, hiddenSubscriptions: [] })); localStorage.setItem('quotapulse-theme', 'dark'); }, { token });
    await installBrowserFixedDate(page, now);
    await page.goto(`${base}/#${name}?range=custom&from=${now - 7 * 86_400_000}&to=${now + 1}`, { waitUntil: 'domcontentloaded' });
    await page.getByTestId(`production-${name}`).waitFor();
    const rows = name === 'projects' ? page.locator('.qp-project-card') : page.locator('.qp-model-table-wrap tbody tr');
    await page.waitForFunction(({ name, count }) => document.querySelectorAll(name === 'projects' ? '.qp-project-card' : '.qp-model-table-wrap tbody tr').length === count, { name, count: name === 'projects' ? projects.length : models.length });
    await page.locator(name === 'projects' ? '.qp-project-trend' : '.qp-model-trend').waitFor();
    if (name === 'models') await page.waitForFunction(count => document.querySelectorAll('.qp-model-row-trend').length === count, models.length);
    await page.evaluate(() => document.fonts.ready);
    const deadline = performance.now() + 30000; let idle = 0;
    while (idle < 12) { assert.ok(performance.now() < deadline, `${name} API did not settle`); await page.waitForTimeout(40); idle = pending.size ? 0 : idle + 1; }
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    let valueGeometry: object | null = null, tableGeometry: object | null = null;
    if (name === 'models') {
      const value = page.locator('.qp-model-summary article').last().locator('strong .qp-cost-value > span').first();
      const geometry = await value.evaluate(node => { const range = document.createRange(); range.selectNodeContents(node); return { text: node.textContent, lines: [...range.getClientRects()].map(rect => ({ x: rect.x, y: rect.y, right: rect.right })) }; });
      assert.equal(geometry.lines.length, 1, `The monetary figure must remain on one line: ${JSON.stringify(geometry)}`);
      const spark = await page.locator('.qp-model-value-spark').boundingBox();
      assert.ok(spark && geometry.lines[0]!.right <= spark.x + 1, `The value and sparkline must not overlap: ${JSON.stringify({ geometry, spark })}`);
      const points = await page.locator('.qp-model-value-spark').evaluate(svg => ({
        lines: [...svg.querySelectorAll('polyline')].map(line => line.getAttribute('points')?.trim().split(/\s+/).length),
        dots: [...svg.querySelectorAll('circle[data-value]')].map(dot => ({ value: Number(dot.getAttribute('data-value')), stroke: dot.getAttribute('stroke'), strokeWidth: dot.getAttribute('stroke-width'), vectorEffect: dot.getAttribute('vector-effect') })),
      }));
      const total = (db.prepare('SELECT SUM(cost_usd) AS amount FROM usage_event').get() as { amount: number }).amount;
      assert.equal(points.dots.length, 7);
      assert.ok(Math.abs(points.dots.reduce((sum, point) => sum + point.value, 0) - total) < 1e-8, 'Plotted values must match the actual synthetic API records');
      assert.ok(points.lines.every(count => count === 1), 'Unknown buckets must continue to break the line');
      assert.ok(points.dots.every(dot => dot.stroke === 'var(--qp-accent)' && dot.strokeWidth === '3' && dot.vectorEffect === 'non-scaling-stroke'), 'Every isolated value needs a visible screen-space marker');
      valueGeometry = { geometry, spark, points };
      tableGeometry = await page.locator('.qp-model-comparison').evaluate(panel => {
        const wrap = panel.querySelector('.qp-model-table-wrap')!;
        const rows = [...wrap.querySelectorAll('tbody tr')];
        const panelBox = panel.getBoundingClientRect(), wrapBox = wrap.getBoundingClientRect(), headBox = wrap.querySelector('thead')!.getBoundingClientRect();
        return { panel: { top: panelBox.top, bottom: panelBox.bottom, height: panelBox.height }, wrap: { top: wrapBox.top, bottom: wrapBox.bottom, height: wrapBox.height }, head: { top: headBox.top, bottom: headBox.bottom, height: headBox.height }, rows: rows.map(row => { const rect = row.getBoundingClientRect(); return { top: rect.top, bottom: rect.bottom, height: rect.height }; }), children: [...panel.children].map(element => { const rect = element.getBoundingClientRect(); return { className: element.className, top: rect.top, bottom: rect.bottom, height: rect.height }; }), scrollHeight: wrap.scrollHeight, clientHeight: wrap.clientHeight };
      });
      const actual = tableGeometry as { wrap: { top: number; bottom: number }; rows: Array<{ top: number; bottom: number }>; scrollHeight: number; clientHeight: number };
      assert.equal(actual.rows.length, 12);
      assert.ok(actual.rows[0]!.top >= actual.wrap.top && actual.rows.at(-1)!.bottom <= actual.wrap.bottom + 1, `All 12 model rows must be visible at the concept viewport: ${JSON.stringify(actual)}`);
      assert.ok(actual.scrollHeight <= actual.clientHeight + 1, 'The 12-row fixture must not require vertical table scrolling');
      assert.ok((await page.locator('.qp-model-comparison-meta [data-testid=scope-notice]').innerText()).includes('May'));
    }
    await page.evaluate(() => { if (document.activeElement instanceof HTMLElement) document.activeElement.blur(); window.scrollTo(0, 0); });
    await page.addStyleTag({ content: '*,*::before,*::after { transition: none !important; caret-color: transparent !important; }' });
    await page.mouse.move(0, 0);
    const screenshot = await page.screenshot({ path: resolve(output, `${name}.png`), animations: 'disabled' });
    const repeated = await page.screenshot({ path: resolve(output, `${name}-repeat.png`), animations: 'disabled' });
    assert.equal(sha(screenshot), sha(repeated), `${name} capture must repeat exactly`);
    if (name === 'projects') {
      const identities = await rows.evaluateAll(nodes => nodes.map(node => ({ name: node.querySelector('.qp-project-card-identity>strong')?.textContent, tone: node.getAttribute('data-tone'), mark: node.querySelector('.qp-project-icon svg')?.getAttribute('class'), decorative: node.querySelector('.qp-project-icon')?.getAttribute('aria-hidden') })));
      assert.equal(identities.length, 6);
      assert.ok(new Set(identities.map(identity => identity.tone)).size >= 3, 'Named projects use a varied decorative palette');
      assert.ok(new Set(identities.map(identity => identity.mark)).size >= 3, 'Named projects use varied generic marks');
      assert.ok(identities.every(identity => identity.decorative === 'true' && identity.tone !== 'neutral'));
      const ranked = await page.locator('.qp-project-top li').evaluateAll(nodes => nodes.map(node => ({ name: JSON.parse(node.getAttribute('data-project-key')!), tone: node.getAttribute('data-tone'), mark: node.querySelector('.qp-project-rank-icon svg')?.getAttribute('class') })));
      for (const item of ranked) { const card = identities.find(identity => identity.name === item.name); assert.ok(card); assert.equal(item.tone, card.tone); assert.equal(item.mark, card.mark); }
      const last = rows.last(), selected = identities.at(-1)!;
      await last.focus(); await page.keyboard.press('Enter');
      await page.locator('.qp-project-detail h2').filter({ hasText: selected.name! }).waitFor();
      assert.equal(await page.locator('.qp-project-detail').getAttribute('data-tone'), selected.tone);
      assert.equal(await page.locator('.qp-project-detail h2 .qp-project-icon svg').getAttribute('class'), selected.mark);
      const search = page.locator('.qp-project-search input');
      await search.fill('Research Lab'); await page.waitForFunction(() => document.querySelectorAll('.qp-project-card').length === 1);
      const matching = identities.find(identity => identity.name === 'Research Lab')!;
      assert.equal(await rows.first().getAttribute('data-tone'), matching.tone);
      assert.equal(await rows.first().locator('.qp-project-icon svg').getAttribute('class'), matching.mark);
      await search.fill(''); await page.waitForFunction(() => document.querySelectorAll('.qp-project-card').length === 6);
    }
    if (name === 'models') {
      const history = page.locator('.qp-model-comparison-meta .qp-model-history');
      const summary = history.locator('summary');
      await summary.focus(); await page.keyboard.press('Enter');
      assert.equal(await history.getAttribute('open'), '');
      const chartData = history.locator('[role=region]');
      await chartData.focus();
      assert.equal(await chartData.evaluate(node => document.activeElement === node), true);
      assert.equal(await chartData.locator('tbody tr').count(), 30);
      await summary.focus(); await page.keyboard.press('Enter');
      assert.equal(await history.getAttribute('open'), null);
      const last = rows.last().locator('button');
      await last.focus(); await page.keyboard.press('Enter');
      await page.locator('.qp-model-detail h3').filter({ hasText: 'Command R+' }).waitFor();
      assert.equal(await last.getAttribute('aria-pressed'), 'true');
    }
    captures.push({ page: name, count: await rows.count(), sha256: sha(screenshot), repeated: true, valueGeometry, tableGeometry });
    await context.close();
  }
  if (!process.env.QP_DENSE_CAPTURE_ONLY && !process.env.QP_DENSE_HEADING_ONLY) for (const lang of ['en', 'th']) for (const theme of ['dark', 'light']) for (const currency of ['USD', 'THB']) for (const width of [390, 900, 1280, 1536, 1672]) {
    const context = await browser.newContext({ viewport: { width, height: 941 }, reducedMotion: 'reduce' });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => { const req = route.request(), url = new URL(req.url()); const readPost = req.method() === 'POST' && url.pathname === '/api/model-row-trends'; if (url.origin !== base || url.pathname.startsWith('/api/') && req.method() !== 'GET' && !readPost) { forbidden.push(`${req.method()} ${url.pathname}`); return route.abort(); } return route.continue(); });
    await page.addInitScript(({ token, lang, theme, currency }) => { (window as any).__QUOTAPULSE_TOKEN__ = token; localStorage.setItem('quotapulse-prefs', JSON.stringify({ lang, currency, rate: 35, hiddenSubscriptions: [] })); localStorage.setItem('quotapulse-theme', theme); }, { token, lang, theme, currency });
    await installBrowserFixedDate(page, now);
    await page.goto(`${base}/#models?range=month`);
    await page.locator('.qp-model-value-spark').waitFor();
    const result = await page.locator('.qp-model-summary article').last().evaluate(card => {
      const value = card.querySelector('strong .qp-cost-value > span')!, spark = card.querySelector('.qp-model-value-spark')!;
      const range = document.createRange(); range.selectNodeContents(value);
      const rects = [...range.getClientRects()].map(rect => ({ x: rect.x, y: rect.y, right: rect.right, bottom: rect.bottom }));
      const c = card.getBoundingClientRect(), s = spark.getBoundingClientRect();
      return { text: value.textContent, rects, card: { x: c.x, right: c.right }, spark: { x: s.x, y: s.y, right: s.right, bottom: s.bottom } };
    });
    assert.ok(result.text && result.rects.length === 1, `A normal ${currency} figure must remain on one line: ${JSON.stringify({ lang, theme, width, result })}`);
    for (const rect of result.rects) {
      assert.ok(rect.x >= result.card.x - 1 && rect.right <= result.card.right + 1, `Value exceeds its card: ${JSON.stringify({ lang, theme, width, currency, result })}`);
      assert.ok(rect.right <= result.spark.x + 1 || rect.x >= result.spark.right - 1 || rect.bottom <= result.spark.y + 1 || rect.y >= result.spark.bottom - 1, `Sparkline overlaps value: ${JSON.stringify({ lang, theme, width, currency, result })}`);
    }
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    layouts.push({ lang, theme, currency, width, text: result.text, sparkWidth: result.spark.right - result.spark.x, singleLine: true, contained: true, nonOverlapping: true });
    await context.close();
  }
  assert.equal(layouts.length, process.env.QP_DENSE_CAPTURE_ONLY || process.env.QP_DENSE_HEADING_ONLY ? 0 : 40);
  if (!process.env.QP_DENSE_CAPTURE_ONLY) {
    db.prepare("UPDATE usage_event SET cost_usd=NULL,cost_source='unknown' WHERE dedup_key='fixture-1-6'").run();
    for (const lang of ['en', 'th']) for (const theme of ['dark', 'light']) for (const width of [390, 900, 1280, 1672]) {
      const context = await browser.newContext({ viewport: { width, height: 941 }, reducedMotion: 'reduce' });
      const page = await context.newPage();
      page.on('pageerror', error => errors.push(error.message));
      await page.route('**/*', route => { const req = route.request(), url = new URL(req.url()); const readPost = req.method() === 'POST' && url.pathname === '/api/model-row-trends'; if (url.origin !== base || url.pathname.startsWith('/api/') && req.method() !== 'GET' && !readPost) { forbidden.push(`${req.method()} ${url.pathname}`); return route.abort(); } return route.continue(); });
      await page.addInitScript(({ token, lang, theme }) => { (window as any).__QUOTAPULSE_TOKEN__ = token; localStorage.setItem('quotapulse-prefs', JSON.stringify({ lang, currency: 'USD', rate: 1, hiddenSubscriptions: [] })); localStorage.setItem('quotapulse-theme', theme); }, { token, lang, theme });
      await installBrowserFixedDate(page, now);
      await page.goto(`${base}/#models?range=custom&from=${now - 7 * 86_400_000}&to=${now + 1}&source=1`);
      const heading = page.locator('.qp-model-comparison-heading');
      const scope = heading.getByTestId('scope-notice'), warning = heading.locator('.qp-footnote:not([data-testid=scope-notice])');
      const history = heading.locator('.qp-model-history'), summary = history.locator('summary');
      await warning.waitFor(); await scope.waitFor(); await summary.waitFor();
      assert.ok((await scope.innerText()).includes('#1'));
      assert.ok((await warning.innerText()).includes('1'));
      const boxes = await Promise.all([heading.locator('h2').boundingBox(), scope.boundingBox(), warning.boundingBox(), summary.boundingBox()]);
      assert.ok(boxes.every(Boolean));
      for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i]!, b = boxes[j]!;
        const x = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
        const y = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
        assert.ok(x <= 1 || y <= 1, `Heading content overlaps: ${JSON.stringify({ lang, theme, width, i, j, a, b })}`);
      }
      await summary.focus(); await page.keyboard.press('Enter');
      assert.equal(await history.getAttribute('open'), '');
      const chartData = history.locator('[role=region]');
      await chartData.focus(); assert.equal(await chartData.evaluate(node => document.activeElement === node), true);
      assert.equal(await chartData.locator('tbody tr').count(), 30);
      await page.keyboard.press('End');
      await page.waitForFunction(() => (document.querySelector('.qp-model-history[open] [role=region]')?.scrollTop ?? 0) > 0, undefined, { timeout: 5000 });
      await summary.focus(); await page.keyboard.press('Enter');
      assert.equal(await history.getAttribute('open'), null);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      headingCases.push({ lang, theme, width, customAndSourceScope: true, partialPriceWarning: true, noHeadingOverlap: true, chartKeyboardScroll: true });
      await context.close();
    }
  }
  assert.equal(headingCases.length, process.env.QP_DENSE_CAPTURE_ONLY ? 0 : 16);
  assert.deepEqual(errors, []); assert.deepEqual(forbidden, []);
  writeFileSync(resolve(output, 'verification.json'), JSON.stringify({ synthetic: true, records, projects: projects.length, modelProviderPairs: models.length, days: dayFactors.length, layoutComplete: layouts.length === 40 && headingCases.length === 16, productionIndexSha256: sha(readFileSync(resolve(webRoot, 'index.html'))), captures, layouts, headingCases, errors, forbidden }, null, 2) + '\n');
  console.log(`PASS dense comparison: ${records} synthetic records, 6 projects, 12 model/provider pairs, 7 days; two repeat-identical captures, ${layouts.length} currency/layout cases and ${headingCases.length} scope/heading cases.`);
} finally { await browser?.close(); await app.close(); db.close(); globalThis.Date = realDate; }
