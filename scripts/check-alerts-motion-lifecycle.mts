import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Page, Route } from 'playwright';
import type { DB } from '../packages/daemon/src/db/index.js';
import { recordQuotaAlerts } from '../packages/daemon/src/api/queries.js';

/** Additional actual-renderer cases. Caller owns the synthetic DB, browser and SSE. */
export async function checkAlertsMotionLifecycle({ page, db, notify, fixedNow, output }: {
  page: Page; db: DB; notify: () => unknown; fixedNow: number; output: string;
}) {
  assert.equal(db.name, ':memory:', 'Lifecycle mutations are restricted to the caller synthetic in-memory DB');
  const originalViewport = page.viewportSize();
  assert.ok(originalViewport, 'Lifecycle probe needs a bounded caller viewport');
  const originalHash = new URL(page.url()).hash;
  const originalReduced = await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
  const proof: any = { method: 'Real compiled Alerts, actual IO/viewport changes, actual API responses/SSE and synthetic quota records', stages: [], limitations: ['No operating-system visibility change is simulated; offscreen eligibility uses real layout/IntersectionObserver.', 'No packaged Electron/native tray lifecycle or whole-release claim.'] };
  mkdirSync(output, { recursive: true });
  let releaseHeld: (() => void) | undefined;
  let heldHandler: ((route: Route) => Promise<void>) | undefined;
  let routeComplete: Promise<void> | undefined;
  let heldTimer: ReturnType<typeof setTimeout> | undefined;
  const effects = () => page.evaluate(() => (window as any).__effects.map((effect: any) => ({ key: effect.key, duration: effect.duration, state: effect.animation.playState, time: effect.animation.currentTime, connected: effect.target.isConnected })));
  const clear = () => page.evaluate(() => { (window as any).__effects = []; });
  const twoFrames = () => page.evaluate(() => new Promise<void>(done => requestAnimationFrame(() => requestAnimationFrame(() => done()))));
  async function deadline<T>(promise: Promise<T>, label: string, ms = 12_000): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try { return await Promise.race([promise, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error(label)), ms); })]); }
    finally { clearTimeout(timer); }
  }
  async function refresh() {
    const response = page.waitForResponse(response => new URL(response.url()).pathname === '/api/alerts' && response.request().method() === 'GET');
    notify(); await (await response).finished(); await page.waitForTimeout(400); await twoFrames();
  }
  async function offscreen() {
    await page.setViewportSize({ width: originalViewport!.width, height: 250 });
    await page.evaluate(() => {
      window.scrollTo(0, 0);
      for (const selector of ['.qp-alert-risk', '.qp-alert-history']) {
        let parent = document.querySelector(selector)?.parentElement;
        while (parent) { parent.scrollTop = 0; parent = parent.parentElement; }
      }
    });
    await page.waitForTimeout(200); await twoFrames();
    const bounds = await page.evaluate(() => ['.qp-alert-risk', '.qp-alert-history'].map(selector => {
      const rect = document.querySelector(selector)!.getBoundingClientRect();
      return { selector, top: rect.top, bottom: rect.bottom, viewportHeight: innerHeight, offscreen: rect.top >= innerHeight || rect.bottom <= 0 };
    }));
    assert.ok(bounds.every(region => region.offscreen), 'Both real regions must leave viewport'); return bounds;
  }
  async function restore() {
    await page.setViewportSize(originalViewport!);
    await page.locator('.qp-alert-risk').scrollIntoViewIfNeeded();
    await page.locator('.qp-alert-history').scrollIntoViewIfNeeded();
    await page.waitForTimeout(250); await twoFrames();
    const visible = await page.evaluate(() => ['.qp-alert-risk', '.qp-alert-history'].map(selector => {
      const rect = document.querySelector(selector)!.getBoundingClientRect(); return { selector, visible: rect.top < innerHeight && rect.bottom > 0 };
    }));
    assert.ok(visible.every(region => region.visible), 'Both regions restore actual intersection'); return visible;
  }
  function sample(sourceId: number, window: string, percent: number, age: number) {
    const source = db.prepare('SELECT account_key FROM source WHERE id=?').get(sourceId) as { account_key: string | null };
    const prior = db.prepare('SELECT * FROM limit_sample WHERE source_id=? AND window_kind=? ORDER BY observed_at DESC,id DESC LIMIT 1').get(sourceId, window) as { resets_at: number | null; origin: string; used_percent: number };
    assert.ok(prior); assert.ok(prior.used_percent < percent, 'Probe uses an unused higher threshold');
    db.prepare('INSERT INTO limit_sample(source_id,window_kind,used_percent,resets_at,observed_at,last_seen_at,source_fetched_at,origin) VALUES(?,?,?,?,?,?,?,?)')
      .run(sourceId, window, percent, prior.resets_at, fixedNow - age, fixedNow - age, fixedNow - age, prior.origin);
    const created = recordQuotaAlerts(db, fixedNow);
    const events = created.filter(event => event.source_id === sourceId && event.window_kind === window);
    assert.ok(events.length > 0, 'Real threshold engine must derive at least one new history record');
    return { sourceId, owner: source.account_key ?? `source:${sourceId}`, window, percent, priorPercent: prior.used_percent, events };
  }
  async function waitFacts(change: ReturnType<typeof sample>) {
    await page.waitForFunction(({ owner, window, percent, ids }) => {
      const row = Array.from(document.querySelectorAll<HTMLElement>('.qp-alert-risk li[data-window]')).find(row => row.dataset.owner === owner && row.dataset.window === window);
      return row?.querySelector('.qp-alert-risk-value strong')?.textContent?.includes(String(percent)) && ids.every(id =>
        Array.from(document.querySelectorAll('.qp-alert-history li[data-alert-motion-key]')).some(node => node.getAttribute('data-alert-motion-key') === JSON.stringify(['history', id])));
    }, { owner: change.owner, window: change.window, percent: change.percent, ids: change.events.map(event => event.id) });
    const facts = await page.locator('.qp-alert-risk li[data-window]').evaluateAll((rows, identity) => {
      const row = rows.find(row => (row as HTMLElement).dataset.owner === identity.owner && (row as HTMLElement).dataset.window === identity.window)!;
      return { key: row.getAttribute('data-alert-motion-key'), level: row.getAttribute('data-level'),
        severity: row.querySelector('.qp-alert-level')?.textContent, value: row.querySelector('.qp-alert-risk-value strong')?.textContent, opacity: getComputedStyle(row).opacity };
    }, { owner: change.owner, window: change.window });
    assert.ok(['info', 'warning', 'critical'].includes(facts.level!)); assert.ok(facts.severity?.trim());
    return facts;
  }
  try {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await restore(); await page.waitForTimeout(200); await clear();
    const outside = await offscreen();
    const hiddenChange = sample(1, 'weekly', 82, 2_000);
    notify(); const hiddenFacts = await waitFacts(hiddenChange); await page.waitForTimeout(400);
    assert.deepEqual(await effects(), [], 'Offscreen derivations never animate');
    const returned = await restore();
    assert.deepEqual(await effects(), [], 'Actual intersection restoration has no deferred entrance');
    await refresh(); assert.deepEqual(await effects(), [], 'Duplicate accepted snapshot cannot replay offscreen backlog');
    proof.stages.push({ label: 'actual-offscreen-return-no-backlog', outside, returned, change: hiddenChange, facts: hiddenFacts, effects: await effects() });

    await clear();
    const heldChange = sample(1, 'monthly', 82, 1_500);
    let held!: () => void, completed!: () => void;
    const reached = new Promise<void>(done => { held = done; });
    const released = new Promise<void>(done => { releaseHeld = done; });
    routeComplete = new Promise<void>(done => { completed = done; });
    let once = true;
    heldHandler = async route => {
      if (!once) { await route.continue(); return; } once = false;
      try {
        const response = await route.fetch();
        assert.equal(response.status(), 200);
        const actual = await response.json();
        assert.ok(heldChange.events.every(event => actual.events.some((row: { id: number }) => row.id === event.id)), 'Held body contains actual engine-derived event');
        heldTimer = setTimeout(() => releaseHeld?.(), 20_000); held();
        await released; await route.fulfill({ response });
      } finally { clearTimeout(heldTimer); completed(); }
    };
    await page.route('**/api/alerts?**', heldHandler); notify();
    await deadline(reached, 'Actual /api/alerts response was not held');
    const heldOutside = await offscreen(); const heldReturned = await restore();
    const delivered = page.waitForResponse(response => new URL(response.url()).pathname === '/api/alerts' && response.request().method() === 'GET');
    releaseHeld(); await deadline(routeComplete, 'Held response failed to release'); await (await delivered).finished();
    const heldFacts = await waitFacts(heldChange); await page.waitForTimeout(400);
    assert.deepEqual(await effects(), [], 'Request spanning actual IO epoch loss cannot animate after return');
    await page.unroute('**/api/alerts?**', heldHandler); heldHandler = undefined;
    await refresh(); assert.deepEqual(await effects(), [], 'Accepted held facts cannot replay on duplicate');
    proof.stages.push({ label: 'actual-held-api-response-crosses-io-epoch', outside: heldOutside, returned: heldReturned, change: heldChange, facts: heldFacts, effects: await effects() });

    await clear();
    await page.evaluate(() => {
      (window as any).__alertsLifecyclePriorStartProbe = (window as any).__startProbe;
      (window as any).__alertsLifecycleUnmount = { started: false, before: [], after: [] };
      (window as any).__startProbe = () => {
        const probe = (window as any).__alertsLifecycleUnmount; if (probe.started) return; probe.started = true;
        requestAnimationFrame(() => {
          probe.before = (window as any).__effects.map((effect: any) => ({ key: effect.key, duration: effect.duration, state: effect.animation.playState, time: effect.animation.currentTime }));
          location.hash = '#cost?range=today';
        });
      };
    });
    const fresh = sample(2, 'daily', 55, 1_000); notify();
    await page.waitForFunction(() => (window as any).__alertsLifecycleUnmount?.before.length > 0 && !document.querySelector('[data-testid=production-alerts]'));
    await twoFrames();
    const unmount = await page.evaluate(() => ({ before: (window as any).__alertsLifecycleUnmount.before,
      after: (window as any).__effects.map((effect: any) => ({ key: effect.key, duration: effect.duration, state: effect.animation.playState, connected: effect.target.isConnected, marker: effect.target.getAttribute('data-alert-motion') })) }));
    assert.ok(unmount.before.length >= 1, 'Fresh post-return derivation starts a real native effect');
    assert.ok(unmount.before.every((effect: any) => effect.duration === 180 && effect.state === 'running' && typeof effect.time === 'number' && effect.time >= 0 && effect.time < 180), 'Unmount must happen during the actual180ms entrance');
    assert.ok(unmount.after.every((effect: any) => effect.state === 'idle' && !effect.connected && effect.marker === null), 'Unmount cancels and clears every native effect');
    proof.stages.push({ label: 'fresh-post-return-active180-unmount-cancellation', change: fresh, ...unmount });
    await page.evaluate(hash => { (window as any).__startProbe = (window as any).__alertsLifecyclePriorStartProbe; delete (window as any).__alertsLifecyclePriorStartProbe; (window as any).__effects = []; location.hash = hash; }, originalHash);
    await page.locator('.qp-alert-risk li[data-alert-motion-key]').first().waitFor();
    await page.locator('.qp-alert-history li[data-alert-motion-key]').first().waitFor();
    await restore(); await page.waitForTimeout(300);
    assert.deepEqual(await effects(), [], 'Remounted accepted facts seed without replay');
    proof.remountStatic = true;
    writeFileSync(resolve(output, 'alerts-lifecycle.json'), JSON.stringify(proof, null, 2)); return proof;
  } catch (error) {
    proof.error = String((error as Error).stack ?? error); proof.effects = await effects().catch(() => null);
    writeFileSync(resolve(output, 'alerts-lifecycle-failure.json'), JSON.stringify(proof, null, 2));
    await page.screenshot({ path: resolve(output, 'alerts-lifecycle-failure.png') }).catch(() => {}); throw error;
  } finally {
    releaseHeld?.(); clearTimeout(heldTimer);
    if (routeComplete) await deadline(routeComplete, 'Cleanup held route did not terminate').catch(() => {});
    if (heldHandler) await page.unroute('**/api/alerts?**', heldHandler).catch(() => {});
    await page.evaluate(() => {
      if ('__alertsLifecyclePriorStartProbe' in window) { (window as any).__startProbe = (window as any).__alertsLifecyclePriorStartProbe; delete (window as any).__alertsLifecyclePriorStartProbe; }
    }).catch(() => {});
    await page.setViewportSize(originalViewport).catch(() => {});
    await page.emulateMedia({ reducedMotion: originalReduced ? 'reduce' : 'no-preference' }).catch(() => {});
  }
}
