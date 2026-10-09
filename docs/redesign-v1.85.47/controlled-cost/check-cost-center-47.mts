/** Controlled frontend response probes only; never backend accuracy or a visual baseline. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { en } from '../packages/web/src/i18n/en';
import { th } from '../packages/web/src/i18n/th';
import type { CostAnalysisResponse } from '../packages/web/src/api';

const root = fileURLToPath(new URL('..', import.meta.url));
const output = resolve(root, 'screens/cost-center-47');
mkdirSync(output, { recursive: true });
const origin = 'http://127.0.0.1:7804';
const token = 'stable-capture-test';
const baseResponse = await fetch(`${origin}/api/cost-analysis?basis=api&bucket=auto&from=1746032400000&to=1747489320001`, { headers: { 'x-quotapulse-token': token } });
assert.equal(baseResponse.status, 200);
const baseline = await baseResponse.json() as CostAnalysisResponse;
writeFileSync(resolve(output, 'base-response.json'), JSON.stringify(baseline, null, 2));
const sha = (content: Buffer | string) => createHash('sha256').update(content).digest('hex');
const errors: Array<{ scenario: string; width: number; lang: string; currency: string; message: string }> = [];
const forbidden: string[] = [];
const results: unknown[] = [];
const screenshots: Record<string, string> = {};
const requests = new Set<string>();
const scenarios = ['base', 'midnight', 'cross-year', 'all', 'medium', 'huge', 'unknown', 'zero', 'actual-native'] as const;
type Scenario = typeof scenarios[number];

function responseFor(scenario: Scenario): CostAnalysisResponse {
  const data = structuredClone(baseline);
  if (scenario === 'midnight') data.scope.to = Date.parse('2025-05-18T00:00:00+07:00');
  if (scenario === 'cross-year') data.scope = { from: Date.parse('2024-12-31T00:00:00+07:00'), to: Date.parse('2025-01-02T00:00:00+07:00') };
  if (scenario === 'all') data.scope.from = 0;
  if (scenario === 'actual-native') data.basis = 'native';
  const factor = scenario === 'medium' ? 1000 : scenario === 'huge' ? 1e12 : scenario === 'zero' || scenario === 'unknown' ? 0 : 1;
  data.totals.amount *= factor;
  data.totals.knownCacheSavingUsd *= factor;
  for (const rows of [data.providers, data.models, data.projects, data.sessions]) for (const row of rows) row.amount *= factor;
  const combined = baseline.points.reduce((sum, point) => ({ amount: sum.amount + point.amount, pricedCalls: sum.pricedCalls + point.pricedCalls, pricedTokens: sum.pricedTokens + point.pricedTokens, allCalls: sum.allCalls + point.allCalls, allTokens: sum.allTokens + point.allTokens }), { amount: 0, pricedCalls: 0, pricedTokens: 0, allCalls: 0, allTokens: 0 });
  data.bucketMs = Math.max(60_000, Math.ceil((data.scope.to - data.scope.from) / 30 / 60_000) * 60_000);
  data.points = [{ start: data.scope.from + Math.floor((data.scope.to - data.scope.from - 1) / data.bucketMs) * data.bucketMs, ...combined, amount: combined.amount * factor }];
  if (scenario === 'unknown') {
    data.totals.pricedCalls = 0; data.totals.pricedTokens = 0;
    data.totals.unknownCalls = data.totals.allCalls;
    data.totals.estimatedCalls = 0; data.totals.knownCacheSavingCalls = 0;
    for (const rows of [data.providers, data.models, data.projects, data.sessions, data.points]) for (const row of rows) { row.pricedCalls = 0; row.pricedTokens = 0; }
  }
  return data;
}

let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
try {
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  for (const scenario of scenarios) for (const width of [390, 1280]) for (const lang of ['en', 'th'] as const) for (const currency of ['USD', 'THB'] as const) {
    const data = responseFor(scenario);
    const context = await browser.newContext({ viewport: { width, height: 941 }, reducedMotion: 'reduce', timezoneId: 'Asia/Bangkok' });
    const page = await context.newPage();
    const caseErrors: string[] = [];
    page.on('pageerror', error => caseErrors.push(error.message));
    const dict = lang === 'th' ? th : en;
    const rate = currency === 'THB' ? 36 : 1;
    await page.addInitScript(({ lang, currency, rate, token }) => {
      (window as unknown as { __QUOTAPULSE_TOKEN__: string }).__QUOTAPULSE_TOKEN__ = token;
      localStorage.setItem('quotapulse-prefs', JSON.stringify({ lang, currency, rate, hiddenSubscriptions: [] }));
      localStorage.setItem('quotapulse-theme', 'dark');
    }, { lang, currency, rate, token });
    await page.clock.setFixedTime(baseline.now);
    await page.route('**/*', async route => {
      const request = route.request(); const url = new URL(request.url());
      if (url.origin !== origin || request.method() !== 'GET') { forbidden.push(`${request.method()} ${request.url()}`); await route.abort(); return; }
      if (url.pathname === '/api/cost-analysis') { requests.add(request.url()); await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) }); }
      else await route.continue();
    });
    const scopeRoute = scenario === 'all' ? 'range=all' : `range=custom&from=${data.scope.from}&to=${data.scope.to}`;
    try {
      await page.goto(`${origin}/?controlled-cost-center=${scenario}-${width}-${lang}-${currency}#cost?${scopeRoute}&basis=api&bucket=auto`, { waitUntil: 'domcontentloaded' });
      await page.getByTestId('production-cost').waitFor();
      await page.locator('.qp-cost-summary article:first-child strong').waitFor();
      await page.evaluate(() => document.fonts.ready);
      const center = page.locator('.qp-cost-donut-content');
      const expectedMoney = new Intl.NumberFormat(lang === 'th' ? 'th-TH' : 'en-US', { style: 'currency', currency }).format(data.totals.amount * rate);
      const expectedValue = data.totals.allCalls === 0 ? expectedMoney : data.totals.pricedCalls === 0 ? dict['redesign.unknownValue'] : `${expectedMoney}${data.totals.pricedCalls < data.totals.allCalls ? '+' : ''}`;
      if (scenario === 'unknown') {
        assert.equal(await center.count(), 0, 'No-priced data must not acquire a numeric donut');
        assert.equal(await page.locator('.qp-cost-summary article:first-child strong .qp-cost-value>span:first-child').textContent(), expectedValue);
        await page.locator('.qp-cost-providers').getByText(dict['redesign.costNoPriced'], { exact: true }).waitFor();
      } else {
        await center.waitFor();
        assert.equal(await center.locator('.qp-cost-value>span:first-child').textContent(), expectedValue, 'Exact formatted amount and partial mark retained');
        assert.match(await center.locator('.qp-cost-value').getAttribute('title') ?? '', new RegExp(`${data.totals.pricedCalls} / ${data.totals.allCalls}`));
        assert.equal(await center.locator('.qp-cost-donut-basis').textContent(), dict[data.basis === 'native' ? 'redesign.costNativeBasis' : 'redesign.costApiBasis']);
        const range = center.locator('.qp-cost-donut-range');
        assert.equal(await range.getAttribute('data-from'), String(data.scope.from));
        assert.equal(await range.getAttribute('data-to'), String(data.scope.to));
        const title = await range.getAttribute('title') ?? '';
        assert.ok(title.includes(new Date(data.scope.from).toISOString()));
        assert.ok(title.includes(new Date(data.scope.to).toISOString()));
        assert.ok(title.includes(dict['redesign.costEndExcluded']));
        assert.equal(await range.getAttribute('aria-label'), title);
        const text = await range.textContent() ?? '';
        if (scenario === 'midnight') { assert.match(text, /17/); assert.doesNotMatch(text, /18/); }
        if (scenario === 'cross-year') { assert.ok(text.includes(lang === 'th' ? '2567' : '2024')); assert.ok(text.includes(lang === 'th' ? '2568' : '2025')); }
        if (scenario === 'all') assert.equal(text, dict['redesign.allTime']);
        const geometry = await page.locator('.qp-cost-donut-hole').evaluate(hole => {
          const box = hole.getBoundingClientRect();
          const content = hole.querySelector('.qp-cost-donut-content')!;
          const elements = [content, ...content.children, content.querySelector('.qp-cost-value>span:first-child')!];
          return { hole: { x: box.x, y: box.y, width: box.width, height: box.height }, children: elements.map(element => { const rect = element.getBoundingClientRect(); return { name: element.className, x: rect.x, y: rect.y, width: rect.width, height: rect.height, left: rect.left - box.left, right: rect.right - box.right, top: rect.top - box.top, bottom: rect.bottom - box.bottom }; }), viewport: { client: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth } };
        });
        assert.equal(geometry.hole.width, width >= 1280 ? 130 : 94);
        assert.equal(geometry.hole.height, width >= 1280 ? 130 : 94);
        for (const child of geometry.children) { assert.ok(child.left >= -1 && child.right <= 1 && child.top >= -1 && child.bottom <= 1, `Center child exceeds hole: ${JSON.stringify(child)}`); }
        assert.ok(geometry.viewport.scroll <= geometry.viewport.client + 1, 'No document horizontal overflow');
        if (scenario === 'zero') { assert.equal(await page.locator('.qp-cost-donut').getAttribute('data-zero'), 'true'); assert.equal(await page.locator('.qp-cost-donut-edge').count(), 0); }
        results.push({ scenario, width, lang, currency, expectedValue, range: text, geometry, passed: true });
      }
      if (width === 1280 && lang === 'en' && currency === 'USD' || width === 390 && lang === 'th' && currency === 'THB' && ['huge', 'midnight', 'cross-year'].includes(scenario)) {
        const filename = `${scenario}-${width}-${lang}-${currency.toLowerCase()}-controlled.png`;
        await page.screenshot({ path: resolve(output, filename), fullPage: true });
        screenshots[filename] = sha(readFileSync(resolve(output, filename)));
      }
      if (scenario === 'unknown') results.push({ scenario, width, lang, currency, expectedValue, passed: true });
    } catch (error) {
      errors.push({ scenario, width, lang, currency, message: error instanceof Error ? error.message : String(error) });
      const filename = `${scenario}-${width}-${lang}-${currency.toLowerCase()}-failure-controlled.png`;
      await page.screenshot({ path: resolve(output, filename), fullPage: true }).catch(() => {});
      if (caseErrors.length) errors.push(...caseErrors.map(message => ({ scenario, width, lang, currency, message: `pageerror: ${message}` })));
    } finally { await context.close(); }
    if (caseErrors.length && !errors.some(item => item.scenario === scenario && item.width === width && item.lang === lang && item.currency === currency)) errors.push(...caseErrors.map(message => ({ scenario, width, lang, currency, message: `pageerror: ${message}` })));
    console.log(JSON.stringify({ scenario, width, lang, currency, passed: !errors.some(item => item.scenario === scenario && item.width === width && item.lang === lang && item.currency === currency) }));
  }
} finally {
  await browser?.close();
  const report = { classification: 'Controlled frontend response probes; not backend correctness, live account data, canonical source captures, or visual baseline acceptance.', origin, getOnly: true, widths: [390, 1280], languages: ['en', 'th'], currencies: ['USD', 'THB'], baseResponseSha256: sha(readFileSync(resolve(output, 'base-response.json'))), builtIndexSha256: sha(readFileSync(resolve(root, 'packages/web/dist/index.html'))), scriptSha256: sha(readFileSync(fileURLToPath(import.meta.url))), requests: [...requests], screenshots, results, errors, forbidden, expectedCases: 72, completedCases: results.length + errors.filter(item => !item.message.startsWith('pageerror:')).length, passed: errors.length === 0 && forbidden.length === 0 && results.length === 72 };
  writeFileSync(resolve(output, 'verification.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ passed: report.passed, cases: results.length, errors: errors.length, forbidden: forbidden.length, verification: resolve(output, 'verification.json') }));
}
if (errors.length || forbidden.length || results.length !== 72) process.exitCode = 1;
