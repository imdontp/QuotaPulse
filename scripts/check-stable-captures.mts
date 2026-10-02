/** Repeatability gate; synthetic production captures, not approved visual baselines. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, type Page, type Request } from 'playwright';
import { openDb } from '../packages/daemon/src/db/index.js';
import { buildServer } from '../packages/daemon/src/api/server.js';
import { Scheduler } from '../packages/daemon/src/ingest/scheduler.js';
import { recordQuotaAlerts } from '../packages/daemon/src/api/queries.js';
import type { MinuteTrendResponse, ProjectDetailResponse, ModelDetailResponse, CostAnalysisResponse } from '../packages/web/src/api.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const priorTimezone = process.env.TZ;
process.env.TZ = 'Asia/Bangkok';
const output = resolve(root, 'screens/stable-captures');
mkdirSync(output, { recursive: true });
// A failed attempt must never leave a previous success manifest in this folder.
rmSync(resolve(output, 'verification.json'), { force: true });
const fixedNow = Date.parse('2026-05-17T13:42:00.000Z');
// Freeze Date only, keeping real timers/performance for HTTP, browser and cleanup.
// This applies to internal query helpers too, without changing production clocks.
const realDate = globalThis.Date;
globalThis.Date = new Proxy(realDate, {
  construct(target, args) { return Reflect.construct(target, args.length ? args : [fixedNow]); },
  apply() { return new realDate(fixedNow).toString(); },
  get(target, property, receiver) { return property === 'now' ? () => fixedNow : Reflect.get(target, property, receiver); },
});
const db = openDb(':memory:');
db.exec(`INSERT INTO source(id,harness,profile,root_path,display_name,detected_at,account_key,account_provider,account_display_name,account_state,account_last_success_at)
  VALUES (1,'codex','fixed','/synthetic/nonexistent','Codex fixture',0,'openai:subscription','openai','OpenAI fixture','active',${fixedNow}),
    (2,'hermes','fixed','/synthetic/nonexistent','Hermes fixture',0,'anthropic:fixture','anthropic','Anthropic fixture','active',${fixedNow});`);
const session = db.prepare('INSERT INTO session(id,source_id,native_session_id,project,last_seen_at) VALUES (?,?,?,?,?)');
const usage = db.prepare("INSERT INTO usage_event(source_id,session_id,dedup_key,ts,model,provider,input_tokens,cached_input_tokens,output_tokens,total_tokens,call_count,cost_usd,cost_source) VALUES (?,?,?,?,?,?,40,20,40,100,?,?,?)");
for (let index = 0; index < 12; index++) {
  const source = index % 2 + 1;
  session.run(index + 1, source, `fixture-session-${index}`, `Fixture project ${index % 8}`, fixedNow - 10_000);
  for (let call = 0; call < 3; call++) usage.run(source, index + 1, `fixed-${index}-${call}`, fixedNow - (index + call + 1) * 30_000, `fixture-model-${index % 8}`, ['openai', 'anthropic', 'openrouter', 'provider-fixture'][index % 4], call + 1, (index + 1) / 100, index === 0 ? 'native' : 'computed');
}
// Values below the old visual minimum catch inflated nonzero bars in both charts.
const tinyUsage = db.prepare("INSERT INTO usage_event(source_id,session_id,dedup_key,ts,model,provider,input_tokens,cached_input_tokens,output_tokens,total_tokens,call_count,cost_usd,cost_source) VALUES (1,1,?,?,'fixture-model-0','openai',1,0,0,1,1,0,'computed')");
tinyUsage.run('fixed-tiny-minute', fixedNow - 15 * 60_000);
tinyUsage.run('fixed-tiny-day', fixedNow - 3 * 86_400_000);
const quota = db.prepare("INSERT INTO limit_sample(source_id,window_kind,used_percent,resets_at,observed_at,last_seen_at,source_fetched_at,origin) VALUES (?,'5h',?,?,?,?,?,'fixed-fixture')");
for (const [percent, minutes] of [[0, 50], [10, 35], [20, 20], [38, 5], [97, 1]]) {
  const at = fixedNow - minutes * 60_000; quota.run(1, percent, fixedNow + 7_200_000, at, at, at);
}
quota.run(2, 85, fixedNow + 7_200_000, fixedNow - 30_000, fixedNow - 30_000, fixedNow - 30_000);
recordQuotaAlerts(db, fixedNow);
const scheduler = new Scheduler(db, [], { pollMs: 1_000_000, detectMs: 1_000_000 });
const daemon = buildServer(db, scheduler, { token: 'stable-capture-test', port: 7804, webRoot: resolve(root, 'packages/web/dist') });
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
const errors: string[] = [];
const forbidden: string[] = [];
const chartChecks: Array<{ page: string; lang: string; theme: string; buckets: number; tokens: number }> = [];
const modelCostChecks: Array<{ route: string; lang: string; theme: string; buckets: number; collapsedBottom: number }> = [];
const cases: Array<{ page: string; lang: string; theme: string; filename: string; sha256: string; repeatSha256?: string; changedPixels?: number; maxChannelDelta?: number; semanticContrasts: Array<{ role: string; color: string; minimumRatio: number }>; checkedElements: string[] }> = [];
const sha = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
const rendererArgs = ['--disable-gpu', '--deterministic-mode', '--disable-skia-runtime-opts', '--force-color-profile=srgb'];
const pages = [
  ['overview', '.qp-activity-item'], ['live', '.qp-live-chart'],
  ['projects', '.qp-project-trend'], ['providers', '.qp-provider-health tbody tr'],
  ['models', '.qp-model-trend'], ['cost', '.qp-cost-chart'],
  ['history', '[data-testid="usage-history"] tbody tr'], ['alerts', '.qp-quota-point'],
] as const;

async function settled(page: Page, pending: Set<Request>) {
  const deadline = performance.now() + 15_000;
  let idle = 0;
  while (idle < 12) {
    assert.ok(performance.now() < deadline, 'API requests did not settle');
    idle = pending.size === 0 ? idle + 1 : 0;
    await page.waitForTimeout(25);
  }
  await page.evaluate(() => document.fonts.ready);
  // Native form controls/compositor paints can outlive the last HTTP request.
  await page.waitForTimeout(1_000);
}

async function comparePixels(page: Page, first: Buffer, second: Buffer) {
  return page.evaluate(async ({ first, second }) => {
    // Inline decoding avoids tsx's nested-function __name helper in page context.
    const firstImage = new Image(); firstImage.src = `data:image/png;base64,${first}`;
    const secondImage = new Image(); secondImage.src = `data:image/png;base64,${second}`;
    await Promise.all([firstImage.decode(), secondImage.decode()]);
    const firstCanvas = new OffscreenCanvas(firstImage.width, firstImage.height);
    const secondCanvas = new OffscreenCanvas(secondImage.width, secondImage.height);
    const firstContext = firstCanvas.getContext('2d')!; firstContext.drawImage(firstImage, 0, 0);
    const secondContext = secondCanvas.getContext('2d')!; secondContext.drawImage(secondImage, 0, 0);
    const a = { width: firstImage.width, height: firstImage.height, pixels: firstContext.getImageData(0, 0, firstImage.width, firstImage.height).data };
    const b = { width: secondImage.width, height: secondImage.height, pixels: secondContext.getImageData(0, 0, secondImage.width, secondImage.height).data };
    if (a.width !== b.width || a.height !== b.height) throw new Error('Capture dimensions differ');
    let changedPixels = 0; let maxChannelDelta = 0;
    for (let index = 0; index < a.pixels.length; index += 4) {
      let changed = false;
      for (let channel = 0; channel < 4; channel++) {
        const delta = Math.abs(a.pixels[index + channel] - b.pixels[index + channel]);
        maxChannelDelta = Math.max(maxChannelDelta, delta); changed ||= delta !== 0;
      }
      if (changed) changedPixels++;
    }
    return { changedPixels, maxChannelDelta, pixelCount: a.width * a.height };
  }, { first: first.toString('base64'), second: second.toString('base64') });
}

// WCAG relative luminance. Check computed CSS colors, rather than antialiased glyphs.
const rgb = (color: string) => color.startsWith('#') ? (color.length === 4 ? color.slice(1).split('').map(value => value + value).join('') : color.slice(1)).match(/../g)!.map(value => parseInt(value, 16)) : color.match(/[\d.]+/g)!.slice(0, 3).map(Number);
const luminance = (color: string) => rgb(color).map(value => value / 255).map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4).reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
const contrast = (foreground: string, background: string) => (Math.max(luminance(foreground), luminance(background)) + 0.05) / (Math.min(luminance(foreground), luminance(background)) + 0.05);
assert.deepEqual(rgb('#fff'), rgb('rgb(255, 255, 255)'));
assert.equal(contrast('#000', '#fff'), 21);
async function semanticContrast(page: Page) {
  const result = await page.evaluate(() => {
    const root = document.querySelector('.qp-redesign')!; const style = getComputedStyle(root);
    const colors = Object.fromEntries(['danger', 'warning', 'series', 'success', 'muted'].map(role => [role, style.getPropertyValue(`--qp-${role}`).trim()]));
    const backgrounds = [style.backgroundColor, style.getPropertyValue('--qp-panel').trim(), style.backgroundImage.match(/rgb\([^)]+\)/)![0]];
    const samples = [['danger', '.qp-alert-level[data-level=critical]'], ['warning', '.qp-alert-level[data-level=warning]'], ['series', '.qp-cost-chart-labels>span:nth-child(2)'], ['success', '.qp-daemon-badge[data-state=live]'], ['muted', '.qp-chart-scale>span']].flatMap(([role, selector]) => {
      const element = root.querySelector(selector); return element ? [{ role, selector, color: getComputedStyle(element).color }] : [];
    });
    return { colors, backgrounds, samples };
  });
  const semanticContrasts = Object.entries(result.colors).map(([role, color]) => ({ role, color, minimumRatio: Math.min(...result.backgrounds.map(background => contrast(color, background))) }));
  for (const item of semanticContrasts) assert.ok(item.minimumRatio >= 4.5, `${item.role}: insufficient text contrast (${item.minimumRatio})`);
  for (const sample of result.samples) assert.deepEqual(rgb(sample.color), rgb(result.colors[sample.role]), `${sample.selector}: semantic color was overridden`);
  return { semanticContrasts, checkedElements: result.samples.map(sample => sample.selector) };
}

async function checkChartAccess(page: Page, destination: 'live' | 'projects', lang: string, theme: string) {
  const headers = { 'x-quotapulse-token': 'stable-capture-test' };
  let expected: Array<{ at: number; tokens: number }>;
  if (destination === 'live') {
    const result = await daemon.inject({ method: 'GET', url: `/api/trend?bucket=minute&group_by=none&from=${fixedNow - 1_800_000}&to=${fixedNow + 1}`, headers });
    assert.equal(result.statusCode, 200);
    const trend = result.json<MinuteTrendResponse>();
    const start = Math.floor(trend.from / 60_000) * 60_000;
    expected = Array.from({ length: Math.floor((trend.to - 1) / 60_000) - Math.floor(trend.from / 60_000) + 1 }, (_, index) => ({ at: start + index * 60_000, tokens: trend.rows.find(row => row.bucket_ts === start + index * 60_000)?.total_tokens ?? 0 }));
  } else {
    const month = new Date(fixedNow); month.setDate(1); month.setHours(0, 0, 0, 0);
    const query = new URLSearchParams({ from: String(month.getTime()), to: String(fixedNow + 1), project: 'Fixture project 0' });
    const result = await daemon.inject({ method: 'GET', url: `/api/project-detail?${query}&limit=20&offset=0`, headers });
    assert.equal(result.statusCode, 200);
    const detail = result.json<ProjectDetailResponse>();
    expected = Array.from({ length: Math.ceil((detail.scope.to - detail.scope.from) / detail.bucketMs) }, (_, index) => ({ at: detail.scope.from + index * detail.bucketMs, tokens: detail.points.find(point => point.start === detail.scope.from + index * detail.bucketMs)?.tokens ?? 0 }));
  }
  const disclosure = page.locator('.qp-chart-data'); const summary = disclosure.locator('summary');
  await summary.focus(); await page.keyboard.press('Enter');
  assert.equal(await disclosure.getAttribute('open'), '');
  assert.equal(await disclosure.locator('table').isVisible(), true);
  const rows = await disclosure.locator('tbody tr').evaluateAll(elements => elements.map(element => ({ at: Number(element.getAttribute('data-at')), tokens: Number(element.getAttribute('data-value')), text: element.querySelector('td:last-child')!.textContent, stamp: element.querySelector('td:first-child')!.textContent, iso: element.querySelector('time')!.getAttribute('datetime') })));
  assert.deepEqual(rows.map(({ at, tokens }) => ({ at, tokens })), expected);
  const format = new Intl.NumberFormat(lang === 'th' ? 'th-TH' : 'en-US');
  for (const row of rows) { assert.equal(row.text, format.format(row.tokens)); assert.equal(row.iso, new Date(row.at).toISOString()); assert.equal(row.stamp, new Date(row.at).toLocaleString(lang === 'th' ? 'th-TH' : 'en-US')); }
  const heights = await page.locator(destination === 'live' ? '.qp-live-chart>span' : '.qp-project-trend>span').evaluateAll(elements => elements.map(element => parseFloat((element as HTMLElement).style.height)));
  assert.equal(heights.length, expected.length);
  const maximum = Math.max(0, ...expected.map(point => point.tokens));
  assert.ok(expected.some(point => point.tokens === 1) && expected.some(point => point.tokens === 0), 'Tiny and zero bucket regression fixtures must be present');
  heights.forEach((height, index) => assert.ok(Math.abs(height - expected[index].tokens / (maximum || 1) * 100) < 0.0001, 'Bar height is not proportional to the API value'));
  for (const width of [390, 900, 1280]) {
    await page.setViewportSize({ width, height: 941 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${destination}: expanded data table overflows at ${width}`);
  }
  await summary.focus(); await page.keyboard.press('Enter'); assert.equal(await disclosure.getAttribute('open'), null);
  chartChecks.push({ page: destination, lang, theme, buckets: expected.length, tokens: expected.reduce((sum, point) => sum + point.tokens, 0) });
}

async function checkModelCostAccess(page: Page, destination: 'models' | 'cost', lang: string, theme: string, pending: Set<Request>) {
  const routes = destination === 'models'
    ? ['models?metric=tokens', 'models?metric=calls', 'models?metric=api_value_usd']
    : ['cost?basis=api&range=month', 'cost?basis=native&range=month', 'cost?basis=native&range=month&source=2'];
  const locale = lang === 'th' ? 'th-TH' : 'en-US';
  const number = new Intl.NumberFormat(locale);
  const money = new Intl.NumberFormat(locale, { style: 'currency', currency: 'USD' });
  for (const route of routes) {
    await page.setViewportSize({ width: 1672, height: 941 });
    const responsePromise = page.waitForResponse(response => response.url().includes(destination === 'models' ? '/api/model-detail?' : '/api/cost-analysis?') && response.status() === 200);
    await page.goto(`http://127.0.0.1:7804/?chart-access=${encodeURIComponent(route)}#${route}`, { waitUntil: 'domcontentloaded' });
    const response = await responsePromise;
    // Query the daemon independently using the precise scope/identity requested by the UI.
    const result = await daemon.inject({ method: 'GET', url: new URL(response.url()).pathname + new URL(response.url()).search, headers: { 'x-quotapulse-token': 'stable-capture-test' } });
    assert.equal(result.statusCode, 200);
    const data = result.json<ModelDetailResponse | CostAnalysisResponse>();
    await page.locator('.qp-chart-data').waitFor(); await settled(page, pending);
    const collapsedBottom = await page.locator(destination === 'models' ? '.qp-model-detail' : '.qp-cost-layout').evaluate(element => element.getBoundingClientRect().bottom);
    assert.ok(collapsedBottom < 941, `${route}: collapsed detail outside viewport (${collapsedBottom})`);
    const disclosure = page.locator('.qp-chart-data'); const summary = disclosure.locator('summary');
    await summary.focus(); await page.keyboard.press('Enter');
    assert.equal(await disclosure.getAttribute('open'), '');
    const starts = Array.from({ length: Math.ceil((data.scope.to - data.scope.from) / data.bucketMs) }, (_, index) => data.scope.from + index * data.bucketMs);
    const rows = disclosure.locator('tbody tr'); assert.equal(await rows.count(), starts.length);
    const calls = route.includes('metric=calls');
    const values: number[] = [];
    for (const [index, start] of starts.entries()) {
      const row = rows.nth(index);
      assert.equal(await row.getAttribute('data-at'), String(start));
      assert.equal(await row.locator('time').getAttribute('datetime'), new Date(start).toISOString());
      assert.equal(await row.locator('time').textContent(), new Date(start).toLocaleString(locale));
      if (destination === 'models') {
        const point = (data as ModelDetailResponse).points.find(point => point.start === start);
        const value = (calls ? point?.calls : point?.tokens) ?? 0; values.push(value);
        assert.equal(await row.getAttribute('data-value'), String(value));
        assert.equal(await row.locator('td').nth(1).textContent(), number.format(value));
      } else {
        const point = (data as CostAnalysisResponse).points.find(point => point.start === start) ?? { amount: 0, pricedTokens: 0, pricedCalls: 0, allCalls: 0 };
        for (const [attribute, value] of Object.entries({ amount: point.amount, 'priced-tokens': point.pricedTokens, 'priced-calls': point.pricedCalls, 'all-calls': point.allCalls })) assert.equal(await row.getAttribute(`data-${attribute}`), String(value));
        const expected = point.allCalls === 0 ? money.format(0) : point.pricedCalls === 0 ? (lang === 'th' ? 'ไม่ทราบ' : 'Unknown') : money.format(point.amount) + (point.pricedCalls < point.allCalls ? '+' : '');
        assert.equal(await row.locator('.qp-cost-value>span').first().textContent(), expected);
        assert.equal(await row.locator('td').nth(2).textContent(), number.format(point.pricedTokens));
        assert.equal(await row.locator('td').nth(3).textContent(), `${number.format(point.pricedCalls)} / ${number.format(point.allCalls)} ${lang === 'th' ? 'คำขอ' : 'Calls'}`);
      }
    }
    if (destination === 'models') {
      assert.ok(values.includes(0), 'Zero model buckets must remain zero');
      if (!route.includes('api_value_usd')) assert.ok(values.includes(1), 'Tiny model bucket fixture is missing');
      const heights = await page.locator('.qp-model-trend>span').evaluateAll(elements => elements.map(element => parseFloat((element as HTMLElement).style.height)));
      const maximum = Math.max(0, ...values);
      heights.forEach((height, index) => assert.ok(Math.abs(height - values[index] / (maximum || 1) * 100) < 0.0001));
      assert.equal(heights.length, values.length);
      const header = await disclosure.locator('th').nth(1).textContent();
      assert.equal(header, lang === 'th' ? (calls ? 'คำขอ' : 'โทเค็นที่บันทึก') : (calls ? 'Calls' : 'Recorded tokens'));
    } else {
      const cost = data as CostAnalysisResponse;
      assert.equal(await disclosure.getAttribute('data-basis'), cost.basis);
      if (route.includes('source=2')) {
        assert.ok(cost.totals.allCalls > 0); assert.equal(cost.totals.pricedCalls, 0);
      } else if (cost.basis === 'api') {
        assert.ok(cost.points.some(point => point.pricedCalls > 0 && point.amount === 0), 'Known-zero price bucket fixture is missing');
        assert.ok(cost.points.some(point => point.pricedCalls > 0 && point.pricedCalls < point.allCalls), 'Partial price bucket fixture is missing');
      } else assert.ok(cost.points.some(point => point.allCalls > 0 && point.pricedCalls === 0), 'Unknown native bucket fixture is missing');
    }
    for (const width of [390, 900, 1280]) {
      await page.setViewportSize({ width, height: 941 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${route}: expanded table overflow at ${width}`);
    }
    await summary.focus(); await page.keyboard.press('Enter'); assert.equal(await disclosure.getAttribute('open'), null);
    modelCostChecks.push({ route, lang, theme, buckets: starts.length, collapsedBottom });
  }
}

try {
  await daemon.listen({ host: '127.0.0.1', port: 7804 });
  assert.equal((await daemon.inject({ method: 'GET', url: '/api/overview', headers: { 'x-quotapulse-token': 'stable-capture-test' } })).json().now, fixedNow);
  for (const pass of [0, 1]) {
    for (const lang of ['en', 'th']) for (const theme of ['dark', 'light']) {
      // Each language/theme set starts a new renderer process in both passes.
      browser = await chromium.launch({ channel: 'chrome', headless: true, args: rendererArgs });
      const page = await browser.newPage({ viewport: { width: 1672, height: 941 }, reducedMotion: 'reduce', deviceScaleFactor: 1, timezoneId: 'Asia/Bangkok' });
      const pending = new Set<Request>();
      const isData = (url: string) => new URL(url).pathname.startsWith('/api/') && !url.includes('/api/events/stream');
      try {
        page.on('pageerror', error => errors.push(error.message));
        page.on('request', request => { if (isData(request.url())) pending.add(request); });
        page.on('requestfinished', request => pending.delete(request));
        page.on('requestfailed', request => pending.delete(request));
        await page.route('**/*', route => {
          const request = route.request(); const url = new URL(request.url());
          if (url.origin !== 'http://127.0.0.1:7804' || (url.pathname.startsWith('/api/') && request.method() !== 'GET')) { forbidden.push(`${request.method()} ${url.origin}${url.pathname}`); return route.abort(); }
          return route.continue();
        });
        await page.addInitScript(({ lang, theme }) => {
          (window as unknown as { __QUOTAPULSE_TOKEN__: string }).__QUOTAPULSE_TOKEN__ = 'stable-capture-test';
          localStorage.setItem('quotapulse-prefs', JSON.stringify({ lang, currency: 'USD', rate: 1, hiddenSubscriptions: [] }));
          localStorage.setItem('quotapulse-theme', theme);
        }, { lang, theme });
        await page.clock.setFixedTime(fixedNow);
        for (const [destination, ready] of pages) {
          await page.setViewportSize(destination === 'overview' ? { width: 1586, height: 992 } : { width: 1672, height: 941 });
          // A distinct document URL avoids carrying hash-navigation paint caches
          // and asynchronous state from the preceding route into this capture.
          await page.goto(`http://127.0.0.1:7804/?capture=${destination}#${destination}`, { waitUntil: 'domcontentloaded' });
          await page.getByTestId(`production-${destination}`).locator(ready).first().waitFor();
          await page.locator('.qp-daemon-badge[data-state=live]').waitFor();
          await page.waitForFunction(() => document.querySelector('[data-stat=models]')?.textContent === '8');
          await settled(page, pending);
          assert.equal(await page.evaluate(() => Date.now()), fixedNow);
          assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
          const contrastEvidence = await semanticContrast(page);
          const filename = `${destination}-${lang}-${theme}.png`;
          const screenshot = await page.screenshot({ path: resolve(output, pass === 0 ? filename : `repeat-${filename}`), animations: 'disabled' });
          if (pass === 0) cases.push({ page: destination, lang, theme, filename, sha256: sha(screenshot), ...contrastEvidence });
          else {
            const item = cases.find(item => item.filename === filename)!;
            item.repeatSha256 = sha(screenshot);
            const difference = await comparePixels(page, readFileSync(resolve(output, filename)), screenshot);
            item.changedPixels = difference.changedPixels; item.maxChannelDelta = difference.maxChannelDelta;
            // Compare every pixel, without masks. Permit only tiny raster rounding;
            // No region is hidden, blurred or exempted from the comparison.
            assert.ok(difference.maxChannelDelta <= 2 && difference.changedPixels / difference.pixelCount <= 0.0001, `${filename}: capture differs beyond raster tolerance (${JSON.stringify(difference)})`);
          }
          if (pass === 0 && (destination === 'live' || destination === 'projects')) await checkChartAccess(page, destination, lang, theme);
          if (pass === 0 && (destination === 'models' || destination === 'cost')) await checkModelCostAccess(page, destination, lang, theme, pending);
        }
      } finally { await page.close(); await browser.close(); }
      console.log(`Stable capture pass ${pass + 1}: ${lang}/${theme}, eight pages`);
    }
  }
  assert.deepEqual(errors, []); assert.deepEqual(forbidden, []);
  writeFileSync(resolve(output, 'verification.json'), JSON.stringify({ status: 'repeatable within recorded raster tolerance; review candidates, not approved visual baselines', clock: fixedNow, isoClock: new realDate(fixedNow).toISOString(), browser: browser.version(), rendererArgs, timezone: 'Asia/Bangkok', dpr: 1, reducedMotion: true, tolerance: { maxChannelDelta: 2, maxChangedPixelFraction: 0.0001, masks: false }, productionIndexSha256: sha(readFileSync(resolve(root, 'packages/web/dist/index.html'))), fixture: { database: 'in-memory synthetic', sessions: 12, namedProjects: 8, models: 8, providers: 4, records: 38 }, checks: ['frozen daemon and browser Date', '64 screenshots / 32 pairs within raster tolerance', 'independent browser process per language/theme set', 'fresh document per route', 'production web without Vite', 'fonts ready and API settled', 'no page overflow', 'no external or write requests', 'no browser errors', 'API-matched complete chart tables, keyboard and 390/900/1280 overflow', 'proportional one-token and zero bars'], chartChecks, modelCostChecks, cases }, null, 2));
  console.log(`Stable captures passed: 32 pairs, ${cases.filter(item => item.sha256 === item.repeatSha256).length} byte-identical, remaining pairs within recorded raster tolerance; no masks.`);
} finally {
  await browser?.close(); await daemon.close(); db.close(); globalThis.Date = realDate;
  if (priorTimezone === undefined) delete process.env.TZ; else process.env.TZ = priorTimezone;
}
