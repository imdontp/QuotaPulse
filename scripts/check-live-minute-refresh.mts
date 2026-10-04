/** Read-only browser checks against the synthetic production server; no ingest/manual refresh. */
import assert from 'node:assert/strict';
import type { Page, Request, Route } from 'playwright';
import type { ProviderModelMinuteResponse } from '../packages/web/src/api.js';

interface HeldResponse {
  captured: Promise<void>;
  completed: Promise<void>;
  release(): void;
  entered: boolean;
  body?: ProviderModelMinuteResponse;
  status: number;
}

async function bounded<T>(promise: Promise<T>, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([promise, new Promise<T>((_resolve, reject) => {
      timer = setTimeout(() => reject(new Error(`Live refresh gate timed out: ${label}`)), 12000);
    })]);
  } finally { if (timer) clearTimeout(timer); }
}

async function settle(page: Page, pending: Set<Request>) {
  const deadline = performance.now() + 15000;
  let idle = 0;
  while (idle < 8) {
    assert.ok(performance.now() < deadline, 'Live refresh API requests did not settle');
    idle = pending.size === 0 ? idle + 1 : 0;
    await page.waitForTimeout(25);
  }
  await bounded(page.evaluate(() => document.fonts.ready), 'fonts');
  await page.waitForTimeout(75);
}

async function paint(page: Page) {
  await page.waitForTimeout(75);
}

async function view(page: Page) {
  return page.evaluate(() => ({
    matrix: Array.from(document.querySelectorAll('.qp-live-matrix-row')).map(element => ({
      key: element.getAttribute('data-pair-key'),
      total: element.querySelector('.qp-live-matrix-total>span')?.textContent,
      pressed: element.querySelector('button')?.getAttribute('aria-pressed') ?? null,
      counts: ['data-call-records', 'data-aggregate-records', 'data-unknown-records'].map(name => element.getAttribute(name)),
      cells: Array.from(element.querySelectorAll('.qp-live-minute-strip>i')).map(cell =>
        ['data-at', 'data-state', 'data-tokens', 'data-records', 'data-calls', 'data-partial'].map(name => cell.getAttribute(name))),
    })),
    trend: Array.from(document.querySelectorAll('.qp-live-chart circle')).map(element =>
      [element.getAttribute('data-at'), element.getAttribute('data-value')]),
    flow: Array.from(document.querySelectorAll('.qp-live-flow-component circle')).map(element =>
      ['data-series', 'data-at', 'data-value', 'data-state', 'data-partial'].map(name => element.getAttribute(name))),
    flowTable: Array.from(document.querySelectorAll('.qp-live-flow-table tbody tr')).map(element =>
      ['data-at', 'data-start', 'data-end', 'data-input', 'data-output', 'data-total', 'data-fresh-input', 'data-cache-read', 'data-cache-write', 'data-records', 'data-calls', 'data-state', 'data-partial', 'data-partial-breakdown'].map(name => element.getAttribute(name))),
    feed: Array.from(document.querySelectorAll('.qp-live-feed li')).map(element => element.textContent),
    sessions: Array.from(document.querySelectorAll('.qp-live-table tbody tr')).map(element => element.textContent),
    metrics: Array.from(document.querySelectorAll('.qp-live-metrics strong')).map(element => element.textContent),
    query: (document.querySelector('.qp-live-search input') as HTMLInputElement | null)?.value,
    history: document.querySelector('.qp-live-records a')?.getAttribute('href'),
    sessionMode: Array.from(document.querySelectorAll('.qp-live-sessions .qp-live-section-head button')).map(element => element.getAttribute('aria-pressed')),
  }));
}

export async function checkLiveMinuteRefresh(
  page: Page, pending: Set<Request>, baseline: ProviderModelMinuteResponse, lang: string, theme: string,
) {
  const home = new URL(page.url()); home.hash = '#live';
  const origin = home.origin;
  const pattern = (url: URL) => url.origin === origin && url.pathname === '/api/trend' && url.searchParams.get('group_by') === 'provider_model';
  const queued: Array<HeldResponse & { capture(): void; finish(): void; wait: Promise<void> }> = [];
  const all: typeof queued = [];
  const requests: Array<{ method: string; path: string; query: URLSearchParams }> = [];
  const observeRequest = (request: Request) => {
    const url = new URL(request.url());
    if (url.origin === origin && url.pathname.startsWith('/api/')) requests.push({ method: request.method(), path: url.pathname, query: url.searchParams });
  };
  const handler = async (route: Route) => {
    const hold = queued.shift();
    if (!hold) return route.fallback();
    hold.entered = true; hold.capture();
    try {
      await hold.wait;
      if (hold.status !== 200) await route.fulfill({ status: hold.status, contentType: 'application/json', body: JSON.stringify({ error: 'synthetic refresh failure' }) });
      else if (hold.body) await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(hold.body) });
      else await route.fallback();
    } finally { hold.finish(); }
  };
  const arm = (body?: ProviderModelMinuteResponse, status = 200): HeldResponse => {
    let capture!: () => void; let finish!: () => void; let release!: () => void;
    const hold = {
      captured: new Promise<void>(resolve => { capture = resolve; }),
      completed: new Promise<void>(resolve => { finish = resolve; }),
      wait: new Promise<void>(resolve => { release = resolve; }),
      release: () => release(), capture: () => capture(), finish: () => finish(), entered: false, body, status,
    };
    queued.push(hold); all.push(hold); return hold;
  };
  const online = () => page.evaluate(() => window.dispatchEvent(new Event('online')));
  const hash = async (value: string, expectedQuery: string) => {
    await page.evaluate(value => { location.hash = value; }, value);
    await page.waitForFunction(query => (document.querySelector('.qp-live-search input') as HTMLInputElement | null)?.value === query, expectedQuery, { timeout: 12000 });
  };
  const pause = page.locator('.qp-live-actions>button').first();
  const formatter = new Intl.NumberFormat(lang === 'th' ? 'th-TH' : 'en-US');
  const markers = [937654321, 937654322].map(value => formatter.format(value));
  const poisoned = (tokens: number) => {
    const payload = structuredClone(baseline);
    payload.groups[0]!.tokens = tokens;
    return payload;
  };
  const named = baseline.groups.slice(0, 12).filter(group => group.provider !== null && group.provider !== '' && group.model !== null && group.model !== '');
  assert.ok(named.length >= 2, 'Refresh checks need two exact named synthetic pairs');
  const routeFor = (group: (typeof named)[number], query: string) => `#live?${new URLSearchParams({ provider: group.provider!, model: group.model!, q: query })}`;
  const hitCount = () => page.evaluate(() => (window as unknown as { __qpLiveMinuteObserver?: { hits: string[] } }).__qpLiveMinuteObserver?.hits.length ?? 0);
  let installed = false;
  try {
    console.log(`Live refresh gate ${lang}/${theme}: initial document`);
    await page.goto(home.href, { waitUntil: 'domcontentloaded' });
    await page.locator('.qp-live-matrix-row').first().waitFor(); await settle(page, pending);
    console.log(`Live refresh gate ${lang}/${theme}: initial settled`);
    await page.evaluate(markers => {
      const state: { hits: string[]; observer?: MutationObserver } = { hits: [] };
      state.observer = new MutationObserver(records => {
        if (markers.some(marker => Array.from(document.querySelectorAll('.qp-live-matrix-total>span')).some(element => element.textContent?.includes(marker))
          || records.some(record => record.oldValue?.includes(marker)
            || Array.from(record.addedNodes).some(node => node.textContent?.includes(marker))
            || Array.from(record.removedNodes).some(node => node.textContent?.includes(marker))))) state.hits.push('obsolete grouped response rendered');
      });
      state.observer.observe(document.querySelector('[data-testid=production-live]')!, { childList: true, subtree: true, characterData: true, characterDataOldValue: true });
      (window as unknown as { __qpLiveMinuteObserver: typeof state }).__qpLiveMinuteObserver = state;
    }, markers);
    page.on('request', observeRequest);
    await page.route(pattern, handler); installed = true;
    const canonical = await view(page);

    // The fresh response stays held while obsolete success could commit: replacement cannot hide it.
    const stalePause = arm(poisoned(937654321)); await online(); await bounded(stalePause.captured, 'old pause request');
    await pause.click(); await page.locator('.qp-live-note').waitFor();
    assert.deepEqual(await view(page), canonical, 'pausing must freeze the complete snapshot');
    const freshPause = arm(); await pause.click(); await page.locator('.qp-live-note').waitFor({ state: 'hidden' });
    stalePause.release(); await bounded(freshPause.captured, 'fresh request after resume');
    await paint(page);
    assert.equal(await hitCount(), 0, 'pause/resume with the same key admitted an obsolete success');
    assert.deepEqual(await view(page), canonical, 'obsolete success changed the snapshot before fresh completion');
    freshPause.release(); await settle(page, pending);
    console.log(`Live refresh gate ${lang}/${theme}: pause/resume success discarded`);

    const staleRoute = arm(poisoned(937654322)); await online(); await bounded(staleRoute.captured, 'old route request');
    const freshRoute = arm();
    await page.evaluate(() => { location.hash = '#live?q=fixture-session-0'; });
    await page.locator('.qp-live-matrix-row').first().waitFor({ state: 'hidden' });
    await hash('#live', '');
    staleRoute.release(); await bounded(freshRoute.captured, 'fresh request after A/B/A');
    await paint(page);
    assert.equal(await hitCount(), 0, 'A/B/A route changes admitted an obsolete success');
    assert.deepEqual(await view(page), canonical, 'A/B/A obsolete result changed the returned A snapshot');
    freshRoute.release(); await settle(page, pending);
    console.log(`Live refresh gate ${lang}/${theme}: A/B/A success discarded`);

    const obsoleteError = arm(undefined, 500); await online(); await bounded(obsoleteError.captured, 'obsolete failure request');
    await pause.click(); await page.locator('.qp-live-note').waitFor();
    const afterError = arm(); await pause.click(); await page.locator('.qp-live-note').waitFor({ state: 'hidden' });
    obsoleteError.release(); await bounded(afterError.captured, 'fresh request after obsolete failure');
    await paint(page);
    assert.equal(await page.locator('.qp-live-error').count(), 0, 'obsolete failure appeared on the new view');
    assert.equal(await page.locator('.qp-daemon-badge[data-state=stale]').count(), 0, 'obsolete failure poisoned refresh status');
    assert.deepEqual(await view(page), canonical);
    afterError.release(); await settle(page, pending);
    console.log(`Live refresh gate ${lang}/${theme}: obsolete failure discarded`);

    const beforeFailure = await view(page);
    const currentError = arm(undefined, 500); await online(); await bounded(currentError.captured, 'current failure request'); currentError.release();
    await page.locator('.qp-live-error').waitFor(); await settle(page, pending);
    assert.match(await page.locator('.qp-live-error').innerText(), /500/);
    assert.deepEqual(await view(page), beforeFailure, 'current failure must retain matrix, trend, feed, sessions and scope as one snapshot');
    const recovery = arm(); await online(); await bounded(recovery.captured, 'recovery request'); recovery.release();
    await settle(page, pending); assert.equal(await page.locator('.qp-live-error').count(), 0);
    console.log(`Live refresh gate ${lang}/${theme}: current failure retained and recovered`);

    const selectedHash = routeFor(named[0]!, 'fixture');
    await hash(selectedHash, 'fixture'); await settle(page, pending);
    const selected = await view(page);
    const selectedKey = JSON.stringify([named[0]!.provider, named[0]!.model]);
    assert.equal(selected.matrix.find(row => row.key === selectedKey)?.pressed, 'true');
    assert.equal(new URL(selected.history!, origin).hash.includes('provider='), true);
    await pause.click(); await page.locator('.qp-live-note').waitFor();
    const pausedRequestCount = requests.length;
    const externalHash = routeFor(named[1]!, 'fixture-session-0');
    await page.evaluate(value => { location.hash = value; }, externalHash);
    await paint(page);
    assert.equal(new URL(page.url()).hash, externalHash);
    assert.deepEqual(await view(page), selected, 'external hash changed paused selection, draft or history scope');
    assert.equal(requests.length, pausedRequestCount, 'paused hash changes started a query');
    const resumeStart = requests.length;
    const resumed = arm(); await pause.click(); await bounded(resumed.captured, 'resumed external scope'); resumed.release();
    await settle(page, pending);
    const resumedView = await view(page);
    assert.equal(resumedView.query, 'fixture-session-0');
    const resumedKey = JSON.stringify([named[1]!.provider, named[1]!.model]);
    assert.equal(resumedView.matrix.find(row => row.key === resumedKey)?.pressed, 'true');
    const history = new URLSearchParams(new URL(resumedView.history!, origin).hash.split('?')[1]);
    assert.equal(history.get('provider'), named[1]!.provider); assert.equal(history.get('model'), named[1]!.model); assert.equal(history.get('q'), 'fixture-session-0');
    for (const path of ['/api/trend', '/api/usage-events', '/api/live-sessions']) {
      assert.ok(requests.slice(resumeStart).some(request => request.path === path
        && request.query.get('provider') === named[1]!.provider && request.query.get('model') === named[1]!.model
        && request.query.get('q') === 'fixture-session-0'), `Resumed ${path} ignored the new exact scope`);
    }
    assert.equal(await hitCount(), 0);
    assert.ok(requests.every(request => request.method === 'GET'), 'Refresh checks must issue read-only GETs');
    assert.equal(requests.filter(request => request.path === '/api/models').length, 0, 'Live must not query per-pair or aggregate model endpoints');
    assert.ok(requests.filter(request => request.path === '/api/trend' && request.query.get('group_by') === 'provider_model').every(request => ['provider', 'model', 'q'].every(key => !request.query.has(key))), 'Matrix context must retain all provider/model routes');
    return { lang, theme, sameKeyPauseSuccessDiscarded: true, routeABASuccessDiscarded: true,
      obsoleteFailureDiscarded: true, completeSnapshotRetainedOnFailure: true,
      pausedExternalRouteFrozen: true, resumedExactScope: true, staleSuccessCommits: 0,
      groupedRequests: requests.filter(request => request.path === '/api/trend' && request.query.get('group_by') === 'provider_model').length,
      writeRequests: 0 };
  } finally {
    for (const hold of all) { hold.body = undefined; hold.status = 200; hold.release(); }
    if (installed) await page.unroute(pattern, handler);
    await Promise.allSettled(all.filter(hold => hold.entered).map(hold => bounded(hold.completed, 'held route cleanup')));
    page.off('request', observeRequest);
    await page.evaluate(() => {
      (window as unknown as { __qpLiveMinuteObserver?: { observer?: MutationObserver } }).__qpLiveMinuteObserver?.observer?.disconnect();
      delete (window as unknown as { __qpLiveMinuteObserver?: unknown }).__qpLiveMinuteObserver;
    });
    await page.goto(home.href, { waitUntil: 'domcontentloaded' });
    await page.locator('.qp-live-matrix-row').first().waitFor(); await settle(page, pending);
  }
}
