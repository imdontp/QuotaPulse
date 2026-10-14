/** Bounded Overview first-API lifecycle. Prepared only: root runs after patch/build freeze. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, type Page } from 'playwright';
import { buildServer } from '../packages/daemon/src/api/server.js';
import { Scheduler } from '../packages/daemon/src/ingest/scheduler.js';
import { en } from '../packages/web/src/i18n/en.js';
import { th } from '../packages/web/src/i18n/th.js';
import { createLoadingFixture } from './loading72-fixture.mts';

const root = fileURLToPath(new URL('..', import.meta.url));
const output = resolve(root, 'tmp/loading72-probe');
mkdirSync(output, { recursive: true });
for (const name of ['verification.json', 'failure.json']) rmSync(resolve(output, name), { force: true });
const hash = (value: Buffer) => createHash('sha256').update(value).digest('hex');
const index = hash(readFileSync(resolve(root, 'packages/web/dist/index.html')));
if (process.env.QUOTAPULSE_EXPECTED_INDEX_SHA) assert.equal(index, process.env.QUOTAPULSE_EXPECTED_INDEX_SHA);
const fixedNow = Date.parse('2025-05-17T13:42:00.000Z');
const previousTZ = process.env.TZ, RealDate = globalThis.Date;
process.env.TZ = 'Asia/Bangkok';
globalThis.Date = new Proxy(RealDate, {
  construct(target, args) { return Reflect.construct(target, args.length ? args : [fixedNow]); },
  apply() { return new RealDate(fixedNow).toString(); },
  get(target, property, receiver) { return property === 'now' ? () => fixedNow : Reflect.get(target, property, receiver); },
});
type CaseFixture = { db: ReturnType<typeof createLoadingFixture>; scheduler: Scheduler; daemon: ReturnType<typeof buildServer> };
let activeFixture: CaseFixture | undefined;
async function closeFixture(fixture: CaseFixture) {
  fixture.scheduler.stop();
  try { await fixture.daemon.close(); } finally { fixture.db.close(); }
}
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
const results: unknown[] = [];
const rendererArgs = ['--disable-gpu', '--deterministic-mode', '--disable-skia-runtime-opts', '--force-color-profile=srgb'];
function gate() {
  let release!: () => void;
  return { promise: new Promise<void>(resolvePromise => { release = resolvePromise; }), open: () => release() };
}
const rectSelectors = {
  header: '.qp-topbar', sidebar: '.qp-sidebar', nav: '.qp-sidebar nav', main: 'main#overview',
  heading: '.qp-page-heading', hero: '.qp-hero', quotas: '.qp-quotas', core: '.qp-core-grid',
  runtime: '.qp-runtime', runway: '.qp-runway', insights: '.qp-insights', activity: '.qp-activity',
};
async function geometry(page: Page) {
  // Remove user-focus/screenshot scrolling as a geometry instrument confound.
  await page.evaluate(() => window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior }));
  await page.waitForFunction(() => scrollX === 0 && scrollY === 0);
  await frames(page);
  return page.evaluate(selectors => Object.fromEntries(Object.entries(selectors).map(([key, selector]) => {
    const element = document.querySelector(selector);
    if (!element) throw new Error('Missing geometry anchor ' + selector);
    const r = element.getBoundingClientRect();
    return [key, { x: r.x, y: r.y, width: r.width, height: r.height, bottom: r.bottom }];
  })), rectSelectors) as Promise<Record<string, { x: number; y: number; width: number; height: number; bottom: number }>>;
}
async function frames(page: Page) { await page.evaluate(() => new Promise<void>(done => requestAnimationFrame(() => requestAnimationFrame(() => done())))); }
async function save(page: Page, name: string) {
  await page.screenshot({ path: resolve(output, name + '.png'), fullPage: true, animations: 'disabled' });
}
async function rememberShell(page: Page) {
  await page.evaluate(() => {
    const nodes = ['[data-testid=production-overview]', '.qp-topbar', '.qp-sidebar', '.qp-sidebar nav', 'main#overview'].map(s => document.querySelector(s));
    if (nodes.some(n => !n)) throw new Error('Shell incomplete');
    (window as any).__loading72Shell = nodes;
  });
}
async function sameShell(page: Page) {
  assert.equal(await page.evaluate(() => {
    const nodes = ['[data-testid=production-overview]', '.qp-topbar', '.qp-sidebar', '.qp-sidebar nav', 'main#overview'].map(s => document.querySelector(s));
    return nodes.every((node, index) => node === (window as any).__loading72Shell[index]);
  }), true, 'Overview/Shell/header/nav/main must retain node identity');
}
async function pendingHonesty(page: Page, lang: 'en' | 'th', kind: 'loading' | 'error') {
  const messages = lang === 'en' ? en : th;
  assert.equal(await page.locator('[data-loading-region]').count(), 6);
  assert.equal(await page.locator('[data-loading-region][data-overview-initial-state=' + kind + ']').count(), 6);
  assert.equal(await page.locator('[data-loading-region][aria-busy=' + (kind === 'loading' ? 'true' : 'false') + ']').count(), 6);
  assert.equal(await page.locator('.qp-sidebar nav a').count(), 9);
  const links = await page.locator('.qp-sidebar nav a').evaluateAll(nodes => nodes.map(n => (n as HTMLAnchorElement).hash.split('?')[0]).sort());
  assert.deepEqual(links, ['#alerts','#cost','#history','#live','#models','#overview','#projects','#providers','#settings'].sort());
  const fabricated = '.qp-metric-rail[data-value],.qp-metric-rail-main,.qp-quota,.qp-model-row,.qp-map-node,.qp-map-edges>path,.qp-map-flow-dot,.qp-core-progress,.qp-insight-card[data-insight],.qp-activity-item';
  assert.equal(await page.locator(fabricated).count(), 0, 'No observed/fake zero facts during pending');
  const mainText = await page.locator('main#overview').innerText();
  for (const key of ['redesign.noRecent', 'redesign.modelsNoData', 'redesign.runwayNoQuota'] as const) assert.ok(!mainText.includes(messages[key]), 'Loading/error is not loaded-empty ' + key);
  const stats = await page.locator('[data-stat]').allTextContents();
  assert.equal(stats.length, 4);
  assert.ok(stats.every(text => text === messages['redesign.unknownValue']), 'Pending scoped QuickStats must be unknown, not machine counts or zero');
  assert.ok(mainText.includes(messages[kind === 'loading' ? 'app.loading' : 'app.couldNotLoad']));
  assert.equal(await page.locator('main#overview [data-overview-initial-state] animateMotion').count(), 0);
  // Connected SSE is independently truthful; do not require its badge to say loading.
}
async function facts(page: Page) {
  return page.evaluate(() => ({
    tokens: document.querySelector('.qp-metric-rail[data-metric=tokens]')?.getAttribute('data-value'),
    models: [...document.querySelectorAll('.qp-model-row')].map(n => ({ text: n.textContent, href: n.getAttribute('href') })),
    quotas: [...document.querySelectorAll('.qp-quota')].map(n => ({ owner: n.getAttribute('data-owner'), window: n.getAttribute('data-window'), text: n.textContent })),
    edges: [...document.querySelectorAll('.qp-map-edges>path')].map(n => ({ from: n.getAttribute('data-from'), to: n.getAttribute('data-to'), tokens: n.getAttribute('data-tokens'), d: n.getAttribute('d') })),
  }));
}
type Config = { id: string; lang: 'en' | 'th'; theme: 'dark' | 'light'; width: number; height: number };
try {
  browser = await chromium.launch({ channel: 'chrome', headless: true, args: rendererArgs });
  const cases: Config[] = [
    { id: 'en-dark-native', lang: 'en', theme: 'dark', width: 1586, height: 992 },
    { id: 'en-dark-narrow', lang: 'en', theme: 'dark', width: 390, height: 900 },
    { id: 'th-light-native', lang: 'th', theme: 'light', width: 1586, height: 992 },
  ];
  const selectedCases = process.env.QUOTAPULSE_LOADING_CASE ? cases.filter(config => config.id === process.env.QUOTAPULSE_LOADING_CASE) : cases;
  assert.ok(selectedCases.length > 0);
  for (const config of selectedCases) for (const scenario of ['deferred', 'cold-error'] as const) {
    // A real manual refresh disables this case's nonexistent sources. Never share
    // that mutated fixture with the next language/width/scenario.
    const db = createLoadingFixture(fixedNow);
    const scheduler = new Scheduler(db, [], { pollMs: 1_000_000, detectMs: 1_000_000 });
    const daemon = buildServer(db, scheduler, { token: 'stable-capture-test', port: 0, webRoot: resolve(root, 'packages/web/dist') });
    activeFixture = { db, scheduler, daemon };
    await daemon.listen({ host: '127.0.0.1', port: 0 });
    const address = daemon.server.address(); assert.ok(address && typeof address !== 'string');
    const origin = 'http://127.0.0.1:' + address.port;
    assert.equal((await daemon.inject({ method: 'GET', url: '/api/overview' })).statusCode, 401);
    const beforeOverview = (await daemon.inject({ method: 'GET', url: '/api/overview', headers: { 'x-quotapulse-token': 'stable-capture-test' } })).json();
    assert.equal(beforeOverview.now, fixedNow);
    assert.ok(beforeOverview.limits.length > 0, 'Every case starts with populated quota facts');
    const beforeSources = db.prepare('SELECT id, enabled, account_state FROM source ORDER BY id').all() as Array<{ id: number; enabled: number; account_state: string }>;
    assert.equal(beforeSources.length, 4);
    assert.ok(beforeSources.every(source => source.enabled === 1), 'Fresh independent case sources must all be enabled');
    const beforeUsageRows = (db.prepare('SELECT COUNT(*) AS n FROM usage_event').get() as { n: number }).n;
    const label = config.id + '-' + scenario;
    const overviewGate = gate(), mapGate = gate();
    const context = await browser.newContext({
      viewport: { width: config.width, height: config.height }, deviceScaleFactor: 1,
      timezoneId: 'Asia/Bangkok', locale: config.lang === 'th' ? 'th-TH' : 'en-US', reducedMotion: 'reduce',
    });
    const page = await context.newPage();
    const errors: string[] = [], forbidden: string[] = [];
    let closing = false;
    let overviewMode: 'defer' | 'ok' | 'error' = scenario === 'deferred' ? 'defer' : 'error';
    let mapMode: 'defer' | 'ok' = scenario === 'deferred' ? 'defer' : 'ok';
    let overviewRequests = 0, mapRequests = 0, summaryRequests = 0, failuresReturned = 0;
    let globalGraph: any = null, scopedGraph: any = null;
    page.on('pageerror', error => errors.push(error.message));
    await context.route('**/*', async route => {
      const request = route.request(), url = new URL(request.url());
      if (url.origin !== origin || (request.method() !== 'GET' && !(request.method() === 'POST' && url.pathname === '/api/refresh'))) {
        forbidden.push(request.method() + ' ' + url.origin + url.pathname); await route.abort(); return;
      }
      try {
        if (url.pathname === '/api/overview') {
          overviewRequests++;
          assert.equal(request.headers()['x-quotapulse-token'], 'stable-capture-test');
          if (overviewMode === 'error') {
            failuresReturned++;
            await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'controlled initial load failure' }) }); return;
          }
          if (overviewMode === 'defer') await overviewGate.promise;
        } else if (url.pathname === '/api/runtime-map') {
          mapRequests++;
          assert.equal(request.headers()['x-quotapulse-token'], 'stable-capture-test');
          if (mapMode === 'defer') await mapGate.promise;
          const response = await route.fetch();
          const graph = await response.json();
          if (url.searchParams.has('project')) scopedGraph = graph; else globalGraph = graph;
          await route.fulfill({ response }); return;
        } else if (url.pathname === '/api/runtime-summary') summaryRequests++;
        await route.continue();
      } catch (cause) { if (!closing) errors.push('Route harness: ' + String(cause)); }
    });
    await page.addInitScript(({ lang, theme }) => {
      (window as any).__QUOTAPULSE_TOKEN__ = 'stable-capture-test';
      localStorage.setItem('quotapulse-prefs', JSON.stringify({ lang, currency: 'USD', rate: 1, hiddenSubscriptions: [] }));
      localStorage.setItem('quotapulse-theme', theme);
      (window as any).__loading72Shifts = [];
      new PerformanceObserver(list => { (window as any).__loading72Shifts.push(...list.getEntries().map((entry: any) => ({ value: entry.value, hadRecentInput: entry.hadRecentInput, sources: entry.sources?.map((s: any) => ({ previous: s.previousRect, current: s.currentRect, tag: s.node?.tagName })) }))); }).observe({ type: 'layout-shift', buffered: true });
    }, { lang: config.lang, theme: config.theme });
    await page.clock.setFixedTime(fixedNow);
    let initialGeometry: Awaited<ReturnType<typeof geometry>> | undefined;
    try {
      await page.goto(origin + '/?loading72=' + label + '#overview', { waitUntil: 'domcontentloaded' });
      await page.locator('[data-loading-region][data-overview-initial-state=' + (scenario === 'deferred' ? 'loading' : 'error') + ']').first().waitFor();
      await page.evaluate(() => document.fonts.ready);
      await frames(page);
      await rememberShell(page);
      await pendingHonesty(page, config.lang, scenario === 'deferred' ? 'loading' : 'error');
      initialGeometry = await geometry(page);
      console.log('Pending layout inputs', JSON.stringify(await page.locator('.qp-core-grid>*').evaluateAll(els => els.map(el => ({ className: el.className, rect: el.getBoundingClientRect().toJSON(), children: [...el.children].map(child => ({ className: child.className, rect: child.getBoundingClientRect().toJSON(), width: getComputedStyle(child).width, aspectRatio: getComputedStyle(child).aspectRatio })) })))));
      assert.equal(summaryRequests, 0, 'No usage QuickStats request before accepted scope');
      await save(page, label + '-initial');
      const messages = config.lang === 'en' ? en : th;
      if (scenario === 'deferred') {
        // Known shell controls stay operational even while API is deferred.
        await page.getByRole('button', { name: messages['redesign.theme'], exact: true }).click();
        assert.equal(await page.getByTestId('production-overview').getAttribute('data-theme'), config.theme === 'dark' ? 'light' : 'dark');
        await page.getByRole('button', { name: messages['redesign.theme'], exact: true }).click();
        await page.getByRole('button', { name: messages['redesign.language'], exact: true }).click();
        const alternate = config.lang === 'en' ? th : en;
        assert.equal(await page.getByTestId('production-overview').getAttribute('lang'), config.lang === 'en' ? 'th' : 'en');
        await page.getByRole('button', { name: alternate['redesign.language'], exact: true }).click();
        await page.locator('.qp-topbar-actions>button[aria-haspopup=dialog]').click();
        await page.getByRole('dialog').waitFor(); await page.keyboard.press('Escape');
        await page.locator('.qp-skip').focus(); await page.keyboard.press('Enter');
        assert.equal(await page.evaluate(() => document.activeElement?.id), 'overview');
        const period = page.locator('.qp-overview-period select'); await period.focus();
        assert.equal(await period.evaluate(node => node === document.activeElement), true);
        if (config.id === 'en-dark-narrow') {
          await period.selectOption('month');
          await page.getByRole('button', { name: messages['redesign.theme'], exact: true }).focus();
        }
        overviewMode = 'ok'; overviewGate.open();
        await assertEventually(() => mapRequests > 0, 'Initial overview released; runtime-map must be deferred next');
        await pendingHonesty(page, config.lang, 'loading');
        assert.equal(summaryRequests, 0);
        const middleGeometry = await geometry(page);
        for (const key of Object.keys(initialGeometry)) for (const axis of ['x','y','width','height'] as const) assert.equal(middleGeometry[key][axis], initialGeometry[key][axis], 'No partial data geometry: ' + key + axis);
        await sameShell(page);
        await save(page, label + '-map-deferred');
        mapMode = 'ok'; mapGate.open();
      } else {
        assert.ok(failuresReturned > 0);
        overviewMode = 'ok';
        await page.getByRole('button', { name: messages['app.refreshNow'], exact: true }).click();
      }
      // Wait for actual rendered graph/metric identity, never assume network-idle means React settled.
      await assertEventually(() => !!globalGraph && !!scopedGraph, 'Actual global and selected-project API graph');
      await page.waitForFunction(expected => Number(document.querySelector('.qp-metric-rail[data-metric=tokens]')?.getAttribute('data-value')) === expected, globalGraph.totals.tokens);
      await page.waitForFunction(expected => {
        const nodes = [...document.querySelectorAll('.qp-map-node[data-dimension=project]')];
        return nodes.length === expected.length && nodes.every((node, index) => node.getAttribute('data-key') === JSON.stringify(expected[index].key) && Number(node.getAttribute('data-tokens')) === expected[index].tokens);
      }, scopedGraph.nodes.project);
      assert.ok(globalGraph.totals.tokens > 0 && globalGraph.totals.records > 0);
      assert.equal(await page.locator('[data-loading-region]').count(), 0);
      await sameShell(page);
      await frames(page);
      await page.evaluate(() => document.fonts.ready); await frames(page);
      const readyGeometry = await geometry(page);
      console.log('Ready layout inputs', JSON.stringify(await page.locator('.qp-core-grid>*').evaluateAll(els => els.map(el => ({ className: el.className, rect: el.getBoundingClientRect().toJSON(), children: [...el.children].map(child => ({ className: child.className, rect: child.getBoundingClientRect().toJSON(), minHeight: getComputedStyle(child).minHeight, padding: getComputedStyle(child).padding })) })))));
      console.log('Ready geometry', JSON.stringify({ config, scenario, initial: initialGeometry, ready: readyGeometry }));
      for (const key of ['header','sidebar','nav','main','heading','hero','quotas']) for (const axis of ['x','y','width'] as const) assert.ok(Math.abs(readyGeometry[key][axis] - initialGeometry[key][axis]) <= 2, 'Stable known geometry ' + key + axis);
      if (config.width >= 1280) {
        assert.ok(Math.abs(readyGeometry.hero.height - initialGeometry.hero.height) <= 2, 'Native hero region reservation');
        assert.ok(Math.abs(readyGeometry.runtime.y - initialGeometry.runtime.y) <= 2, 'Native runtime anchor after hero');
      }
      if (scenario === 'deferred') {
        const target = config.id === 'en-dark-narrow' ? page.getByRole('button', { name: messages['redesign.theme'], exact: true }) : page.locator('.qp-overview-period select');
        assert.equal(await target.evaluate(node => node === document.activeElement), true, 'Preserve the user-selected control when API data arrives');
      } else {
        assert.equal(await page.evaluate(() => document.activeElement?.id), 'overview', 'Retry retains focus on the stable content region');
      }
      const originalFacts = await facts(page);
      assert.equal(Number(originalFacts.tokens), globalGraph.totals.tokens);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      await save(page, label + '-ready');
      let lastGoodRetained = false;
      if (scenario === 'deferred') {
        overviewMode = 'error';
        await page.evaluate(() => window.dispatchEvent(new Event('online')));
        await page.waitForFunction(text => [...document.querySelectorAll('[role=status]')].some(node => node.textContent?.includes(text)), messages['redesign.staleSnapshot']);
        await frames(page);
        assert.equal(await page.locator('[data-loading-region]').count(), 0, 'Same-scope error retains ready data, not initial skeleton');
        assert.deepEqual(await facts(page), originalFacts, 'Same-scope last-good facts preserved');
        await sameShell(page);
        lastGoodRetained = true;
        await save(page, label + '-last-good-error');
        overviewMode = 'ok';
        await page.evaluate(() => window.dispatchEvent(new Event('online')));
        await page.waitForFunction(text => ![...document.querySelectorAll('[role=status]')].some(node => node.textContent?.includes(text)), messages['redesign.staleSnapshot']);
      }
      assert.deepEqual(errors, [], 'No renderer/route harness errors');
      assert.deepEqual(forbidden, [], 'No external or unauthorized mutation requests');
      const afterSources = db.prepare('SELECT id, enabled, account_state FROM source ORDER BY id').all() as typeof beforeSources;
      const afterOverview = (await daemon.inject({ method: 'GET', url: '/api/overview', headers: { 'x-quotapulse-token': 'stable-capture-test' } })).json();
      const afterUsageRows = (db.prepare('SELECT COUNT(*) AS n FROM usage_event').get() as { n: number }).n;
      assert.equal(afterUsageRows, beforeUsageRows, 'Actual refresh preserves recorded usage history');
      assert.deepEqual(afterSources.map(({ id, account_state }) => ({ id, account_state })), beforeSources.map(({ id, account_state }) => ({ id, account_state })), 'Source identities/account metadata remain; availability changes independently');
      assert.ok(afterSources.every(source => source.enabled === (scenario === 'cold-error' ? 0 : 1)), 'Only this case real manual refresh disables its fixture sources');
      if (scenario === 'cold-error') assert.equal(afterOverview.limits.length, 0, 'Retry genuinely changes quota availability, never fake zero windows');
      else assert.ok(afterOverview.limits.length > 0, 'Read-only online refresh retains populated quota readers');
      results.push({ config, scenario, origin, fixtureIsolation: 'fresh DB/Scheduler/Fastify per case', beforeSources, afterSources, beforeQuotaWindows: beforeOverview.limits.length, afterQuotaWindows: afterOverview.limits.length, beforeUsageRows, afterUsageRows, initialGeometry, readyGeometry, numericFacts: { tokens: globalGraph.totals.tokens, records: globalGraph.totals.records }, overviewRequests, mapRequests, summaryRequests, failuresReturned, lastGoodRetained, layoutShifts: await page.evaluate(() => (window as any).__loading72Shifts), noFabricatedFacts: true, shellIdentity: true });
    } catch (cause) {
      await save(page, label + '-failure').catch(() => undefined);
      writeFileSync(resolve(output, label + '-failure.json'), JSON.stringify({ config, scenario, error: String(cause), initialGeometry, overviewRequests, mapRequests, summaryRequests, errors, forbidden }, null, 2));
      throw cause;
    } finally {
      closing = true; overviewGate.open(); mapGate.open();
      const ownedFixture = activeFixture; activeFixture = undefined;
      try { await context.close(); } finally { if (ownedFixture) await closeFixture(ownedFixture); }
    }
  }
  assert.equal(results.length, selectedCases.length * 2);
  writeFileSync(resolve(output, 'verification.json'), JSON.stringify({
    status: 'passed bounded initial API loading/error/last-good lifecycle; not all-page loading or visual acceptance',
    productionIndexSha256: index, browser: browser.version(), rendererArgs, fixedNow, timezone: 'Asia/Bangkok', dpr: 1,
    fixtureSeedSource: 'scripts/check-stable-captures.mts exact seed block', fixtureModuleSha256: hash(readFileSync(resolve(root, 'tmp/loading72-fixture.mts'))),
    captureMatrix: { configs: selectedCases.map(config => config.id), scenarios: ['deferred', 'cold-error'], complete: !process.env.QUOTAPULSE_LOADING_CASE && results.length === 6 },
    cases: results, limitations: ['Success manifest covers only the explicitly selected cases; full matrix requires six cases and complete=true. This bounded gate does not certify full RC.', 'No cold lazy-chunk geometry gate, successful empty/scope-race full matrix, normal motion/desktop lifecycle or approved baseline certification.', 'Unknown dynamic row quantity is not forced to initial skeleton length.', 'Layout shifts are recorded, no invented global CLS target. Ready byte comparisons use existing Overview gate.'],
  }, null, 2));
  console.log(`loading72 probe passed ${results.length} cases; complete matrix=${!process.env.QUOTAPULSE_LOADING_CASE && results.length === 6}; actual API/data, identity/focus/geometry/error retention`);
} catch (cause) {
  writeFileSync(resolve(output, 'failure.json'), JSON.stringify({ status: 'failed', productionIndexSha256: index, error: String(cause), completedCases: results.length }, null, 2));
  throw cause;
} finally {
  try { await browser?.close(); } finally {
    const ownedFixture = activeFixture; activeFixture = undefined;
    try { if (ownedFixture) await closeFixture(ownedFixture); } finally {
      globalThis.Date = RealDate;
      if (previousTZ === undefined) delete process.env.TZ; else process.env.TZ = previousTZ;
    }
  }
}
async function assertEventually(check: () => boolean, message: string) {
  const end = performance.now() + 15_000;
  while (!check()) {
    assert.ok(performance.now() < end, message);
    await new Promise(resolvePromise => setTimeout(resolvePromise, 25));
  }
}
