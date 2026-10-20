/** Additional History lifecycle gates. Called by the root browser owner; no own browser/server. */
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Page, Response, Route } from 'playwright';
import type { DB } from '../packages/daemon/src/db/index.js';

interface Options { page: Page; db: DB; notify: () => unknown; fixedNow: number; output: string }
const historyPattern = '**/api/usage-events?**';
const isHistory = (response: Response) => {
  const url = new URL(response.url());
  return url.pathname === '/api/usage-events' && url.searchParams.get('limit') === '50' && response.request().method() === 'GET';
};

export async function checkHistoryMotionLifecycle({ page, db, notify, fixedNow, output }: Options) {
  mkdirSync(output, { recursive: true });
  const proof: Record<string, unknown> = { scope: 'Actual compiled synthetic API/SSE History lifecycle; observed presence, not ingestion-time proof', stages: [] };
  const stages = proof.stages as unknown[];
  const viewport = page.viewportSize();
  assert.ok(viewport, 'Lifecycle helper requires a normal viewport');
  let serial = 0;
  const prefix = `history-lifecycle-${process.pid}-${performance.now()}-`;
  const inserted: number[] = [];
  const insert = db.prepare("INSERT INTO usage_event(source_id,session_id,dedup_key,ts,model,provider,input_tokens,output_tokens,total_tokens,call_count,cost_source) VALUES(1,1,?,?,'DeepSeek V4.1','deepseek',11,6,17,1,'unknown')");
  const add = () => {
    const id = Number(insert.run(prefix + serial++, fixedNow - 1).lastInsertRowid);
    inserted.push(id);
    return id;
  };
  const row = (id: number) => page.locator(`tr[data-history-record^="[${id},"]`);
  const effects = () => page.evaluate(() => (window as any).__effects.map((effect: any) => ({ key: effect.key,
    duration: effect.duration, state: effect.animation.playState, time: effect.animation.currentTime, connected: effect.target.isConnected })));
  const clear = () => page.evaluate(() => { (window as any).__startProbe = undefined; (window as any).__effects = []; });
  const noEffects = async (label: string) => {
    // Two paints after the accepted DOM appears, then a bounded quiet observation.
    await page.evaluate(() => new Promise<void>(done => requestAnimationFrame(() => requestAnimationFrame(() => done()))));
    await page.waitForTimeout(120);
    assert.deepEqual(await effects(), [], label);
    stages.push({ label, effects: [] });
  };
  const waitAccepted = async (action: () => unknown) => {
    const response = page.waitForResponse(isHistory, { timeout: 12_000 });
    await action();
    const accepted = await response;
    assert.equal(accepted.status(), 200);
    await accepted.finished();
    return accepted;
  };
  const navigate = async (hash: string) => {
    const provider = new URLSearchParams(hash.split('?')[1] ?? '').get('provider');
    const response = page.waitForResponse(candidate => isHistory(candidate) && new URL(candidate.url()).searchParams.get('provider') === provider, { timeout: 12_000 });
    await page.evaluate(value => { location.hash = value; }, hash);
    const accepted = await response; assert.equal(accepted.status(), 200); await accepted.finished();
    await page.locator('.qp-history-table tbody tr').first().waitFor();
  };
  const visibleTable = async () => {
    await page.locator('.qp-history-table').scrollIntoViewIfNeeded();
    await page.locator('.qp-history-table').evaluate(element => { element.scrollTop = 0; });
    await page.waitForFunction(() => { const box = document.querySelector('.qp-history-table')!.getBoundingClientRect(); return box.width > 0 && box.height > 0 && box.bottom > 0 && box.top < innerHeight; });
    await page.waitForTimeout(120);
  };
  let releaseHeld: (() => void) | undefined;
  let handler: ((route: Route) => Promise<void>) | undefined;
  let holdDeadline: ReturnType<typeof setTimeout> | undefined;
  try {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    // Force a distinct same-document route if already on the requested History query.
    if (new URL(page.url()).hash === '#history?range=today') await navigate('#history?range=today&provider=deepseek');
    await navigate('#history?range=today');
    assert.equal(await page.locator('dialog[aria-labelledby=history-detail-title]').count(), 0, 'Redesign lifecycle runs with non-blocking detail rail');
    await visibleTable(); await clear();

    const pause = page.locator('[data-testid=usage-history] .qp-history-view-actions button').first();
    await pause.click();
    assert.equal(await pause.getAttribute('aria-pressed'), 'true');
    const priorPage = await page.locator('[data-history-record]').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-history-record')));
    let pausedRequests = 0;
    const countPaused = (response: Response) => { if (isHistory(response)) pausedRequests++; };
    page.on('response', countPaused);
    const pausedId = add();
    try {
      await notify(); await page.waitForTimeout(1600);
      assert.equal(await row(pausedId).count(), 0, 'Paused accepted page excludes later real DB row');
      assert.deepEqual(await page.locator('[data-history-record]').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-history-record'))), priorPage);
      assert.equal(pausedRequests, 0, 'No History page response consumed during bounded pause interval');
      await noEffects('pause-keeps-exact-accepted-page');
    } finally { page.off('response', countPaused); }
    await waitAccepted(() => pause.click()); await row(pausedId).waitFor();
    await noEffects('resume-seeds-current-page-without-backlog');
    stages.push({ label: 'pause-resume', pausedId, pausedRequests, observedPauseMs: 1600, priorPage });

    // A genuinely unseen row entering a changed filter context is a static baseline.
    await clear(); const queryId = add();
    await navigate('#history?range=today&provider=deepseek'); await row(queryId).waitFor();
    await noEffects('changed-filter-seeds-unseen-row');
    await clear(); await navigate('#history?range=today');
    await noEffects('filter-restoration-seeds-page');

    // Shrink only the real viewport, retaining native CSS/layout and actual observers.
    await clear(); await page.setViewportSize({ width: viewport.width, height: 180 });
    await page.evaluate(() => { window.scrollTo(0, 0); document.querySelector('#history')?.scrollTo(0, 0); });
    await page.waitForFunction(() => { const box = document.querySelector('.qp-history-table')!.getBoundingClientRect(); return box.top >= innerHeight || box.bottom <= 0; });
    await page.waitForTimeout(120);
    const offscreenId = add(); await waitAccepted(() => notify()); await row(offscreenId).waitFor({ state: 'attached' });
    await noEffects('offscreen-accepted-row-is-static');
    await page.setViewportSize(viewport); await visibleTable();
    await noEffects('offscreen-restore-without-request-does-not-replay');
    const restoredId = add(); await waitAccepted(() => notify()); await row(restoredId).waitFor();
    await noEffects('first-visible-accepted-page-seeds-after-offscreen');
    stages.push({ label: 'offscreen-restoration', offscreenId, restoredId });

    // Fetch a real accepted candidate while visible, then lose and restore eligibility
    // before it is delivered. Releasing it must not replay unseen changes.
    await clear();
    let capturedResolve!: () => void;
    const captured = new Promise<void>(done => { capturedResolve = done; });
    let releaseResolve!: () => void;
    const released = new Promise<void>(done => { releaseResolve = done; });
    releaseHeld = releaseResolve;
    let captureOnce = true;
    handler = async route => {
      const url = new URL(route.request().url());
      if (!captureOnce || url.searchParams.get('limit') !== '50') { await route.continue(); return; }
      captureOnce = false;
      const response = await route.fetch();
      capturedResolve();
      await released;
      await route.fulfill({ response });
    };
    await page.route(historyPattern, handler);
    let holdExpired = false;
    holdDeadline = setTimeout(() => { holdExpired = true; releaseResolve(); }, 20_000);
    const heldId = add();
    const delivered = page.waitForResponse(isHistory, { timeout: 12_000 });
    await notify();
    await Promise.race([captured, page.waitForTimeout(12_000).then(() => { throw new Error('Actual History response was not captured'); })]);
    assert.equal(await row(heldId).count(), 0, 'Held API result has not reached accepted DOM');
    await page.setViewportSize({ width: viewport.width, height: 180 });
    await page.evaluate(() => { window.scrollTo(0, 0); document.querySelector('#history')?.scrollTo(0, 0); });
    await page.waitForFunction(() => document.querySelector('.qp-history-table')!.getBoundingClientRect().top >= innerHeight);
    await page.waitForTimeout(120);
    await page.setViewportSize(viewport); await visibleTable();
    assert.equal(holdExpired, false, 'Held response released explicitly before its cleanup deadline');
    releaseResolve();
    const response = await delivered; assert.equal(response.status(), 200); await response.finished();
    await row(heldId).waitFor(); await noEffects('held-candidate-crossing-offscreen-loss-seeds-after-restoration');
    await page.unroute(historyPattern, handler); handler = undefined;
    clearTimeout(holdDeadline); holdDeadline = undefined; releaseHeld = undefined;
    stages.push({ label: 'held-real-response-eligibility-loss', heldId, releasedAfterRestoration: true });

    // The next fresh observed presence moves normally, then route removal must cancel
    // the still-active700ms effect and prevent later unseen History rows from starting.
    await clear(); const unmountId = add(); await notify(); await row(unmountId).waitFor();
    await page.waitForFunction(() => (window as any).__effects.some((effect: any) => effect.duration === 700 && effect.animation.playState === 'running'));
    const beforeUnmount = await page.evaluate(() => {
      const active = (window as any).__effects.map((effect: any) => ({ key: effect.key, duration: effect.duration, state: effect.animation.playState, time: effect.animation.currentTime }));
      location.hash = '#alerts';
      return active;
    });
    assert.ok(beforeUnmount.some((effect: any) => effect.duration === 700 && effect.state === 'running' && effect.time < 700), 'Unmount began during real finite emphasis');
    await page.locator('[data-testid=usage-history]').waitFor({ state: 'detached' });
    await page.waitForFunction(() => (window as any).__effects.filter((effect: any) => typeof effect.key === 'string' && /^\[\d+,/.test(effect.key) || effect.key === 'detail').every((effect: any) => effect.animation.playState === 'idle' && !effect.target.isConnected));
    const unseenAfterUnmount = add(); await notify(); await page.waitForTimeout(1600);
    const final = await effects();
    assert.ok(final.filter((effect: any) => typeof effect.key === 'string' && /^\[\d+,/.test(effect.key) || effect.key === 'detail').every((effect: any) => effect.state === 'idle' && !effect.connected));
    assert.ok(!final.some((effect: any) => effect.key?.startsWith(`[${unseenAfterUnmount},`)), 'No later unmounted History work');
    stages.push({ label: 'active-emphasis-unmount', unmountId, unseenAfterUnmount, beforeUnmount, final });
    proof.inserted = inserted;
    proof.passed = true;
    writeFileSync(resolve(output, 'history-lifecycle.json'), JSON.stringify(proof, null, 2));
    return proof;
  } catch (error) {
    proof.error = String((error as Error).stack ?? error);
    proof.effects = await effects().catch(() => null);
    writeFileSync(resolve(output, 'history-lifecycle-failure.json'), JSON.stringify(proof, null, 2));
    await page.screenshot({ path: resolve(output, 'history-lifecycle-failure.png') }).catch(() => {});
    throw error;
  } finally {
    releaseHeld?.();
    if (holdDeadline !== undefined) clearTimeout(holdDeadline);
    if (handler) await page.unroute(historyPattern, handler).catch(() => {});
    if (!page.isClosed()) await page.setViewportSize(viewport).catch(() => {});
  }
}
