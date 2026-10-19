import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DURATION, EASE } from '../src/lib/motion.ts';
import { nextRunwayPresentation, playRunwayTransition, runwayContextKey, runwayTransition } from '../src/redesign/runway-motion.ts';
import type { QuotaWindow } from '../src/redesign/model.ts';

const now = 1_000_000, resetAt = now + 1_000_000;
const quota = (overrides: Partial<QuotaWindow> = {}): QuotaWindow => ({ id: 'window-id', ownerKey: 'account', sourceId: 1,
  origin: 'native', owner: 'Account', provider: 'vendor', window: '5h', observedAt: now, confirmedAt: now,
  resetAt, freshness: 'live', usedPercent: 20, forecastStatus: 'ready', projectedFullAt: now + 200_000, ...overrides });
const present = (q = quota(), at = now, previous?: ReturnType<typeof nextRunwayPresentation>) => nextRunwayPresentation(previous, q, at, 3_600_000);

test('initial real forecast is static; a new valid same-period derivation settles20 to35percent', () => {
  const first = present();
  assert.equal(first.kind, 'fresh');
  assert.equal(runwayTransition(undefined, first), null);
  const next = present(quota({ observedAt: now + 1, projectedFullAt: now + 350_000 }), now, first);
  assert.deepEqual(runwayTransition(first, next), { from: 20, to: 35 });
});

test('clock-only rerenders and freshness keepalive cannot replay a forecast', () => {
  const first = present();
  const clock = present(quota(), now + 1000, first);
  assert.equal(runwayTransition(first, clock), null);
  assert.equal(runwayTransition(clock, present(quota({ confirmedAt: now + 1000 }), now + 1000, clock)), null);
  if (first.kind === 'fresh' && clock.kind === 'fresh') assert.notEqual(first.display.marker, clock.display.marker, 'clock geometry may update immediately');
});

test('owner/source/origin/provider/window/id and reset contexts replace without interpolation or retention', () => {
  const first = present();
  for (const change of [{ ownerKey: 'other' }, { sourceId: 2 }, { origin: 'other' }, { provider: 'other' },
    { window: 'weekly' }, { id: 'new-id' }, { resetAt: resetAt + 1000 }]) {
    const nextQuota = quota({ ...change, projectedFullAt: now + 350_000 });
    assert.notEqual(runwayContextKey(nextQuota), runwayContextKey(quota()));
    assert.equal(runwayTransition(first, present(nextQuota, now, first)), null);
    const stale = present({ ...nextQuota, freshness: 'stale' }, now, first);
    assert.equal(stale.kind, 'unavailable');
  }
  assert.notEqual(runwayContextKey(quota({ ownerKey: undefined, id: 'account' })), runwayContextKey(quota({ ownerKey: 'account', id: 'account' })));
  assert.notEqual(runwayContextKey(quota({ origin: '' })), runwayContextKey(quota({ origin: undefined })));
});

test('same-context stale reading freezes exact last valid marker, source timestamps and prior forecast', () => {
  const first = present();
  const staleQuota = quota({ freshness: 'stale', projectedFullAt: now + 900_000 });
  const stale = present(staleQuota, now + 100_000, first);
  assert.equal(stale.kind, 'stale');
  if (stale.kind !== 'unavailable' && first.kind !== 'unavailable') {
    assert.deepEqual(stale.display, first.display);
    assert.equal(stale.display.marker, 20);
    assert.equal(stale.display.quota.projectedFullAt, now + 200_000);
  }
  const later = present(staleQuota, now + 200_000, stale);
  assert.deepEqual(later, stale);
  assert.equal(runwayTransition(first, stale), null);
  assert.equal(runwayTransition(stale, present(quota({ observedAt: now + 1, projectedFullAt: now + 350_000 }), now, stale)), null, 'stale recovery snaps');
});

test('missing/default-loss, reset, unknown and no-reset clear retained forecasts; no cross-gap resurrection', () => {
  const first = present();
  const missing = nextRunwayPresentation(first, undefined, now, 3_600_000);
  assert.deepEqual(missing, { kind: 'unavailable', contextKey: null, reason: 'noQuota' });
  assert.equal(present(quota({ freshness: 'stale' }), now, missing).kind, 'unavailable');
  assert.equal(present(quota({ resetAt: 0 }), now, first).kind, 'unavailable');
  assert.equal(present(quota({ resetAt: now }), now, first).kind, 'unavailable');
  assert.equal(present(quota({ usedPercent: null }), now, first).kind, 'unavailable');
});

test('unknown/flat/after-reset forecast has no invented marker and cannot become a frozen prior forecast', () => {
  for (const q of [quota({ forecastStatus: 'flat' }), quota({ projectedFullAt: null }), quota({ projectedFullAt: resetAt + 1000 }),
    quota({ projectedFullAt: now }), quota({ projectedFullAt: Number.NaN })]) {
    const first = present(q);
    assert.equal(first.kind, 'fresh');
    if (first.kind !== 'unavailable') assert.equal(first.display.marker, null);
    assert.equal(present({ ...q, freshness: 'stale' }, now + 1, first).kind, 'unavailable');
  }
});

test('projection never mutates input and keeps a prior committed reading independent of input mutation', () => {
  const q = quota();
  const before = structuredClone(q);
  const first = present(q);
  assert.deepEqual(q, before);
  q.projectedFullAt = now + 900_000;
  if (first.kind !== 'unavailable') assert.equal(first.display.quota.projectedFullAt, now + 200_000);
});

class FakeAnimation {
  listeners = new Map<string, EventListener>();
  cancelled = 0;
  addEventListener(name: string, listener: EventListener) { this.listeners.set(name, listener); }
  removeEventListener(name: string, listener: EventListener) { if (this.listeners.get(name) === listener) this.listeners.delete(name); }
  cancel() { this.cancelled++; this.dispatch('cancel'); }
  dispatch(name: string) { this.listeners.get(name)?.({ currentTarget: this } as unknown as Event); }
}
function regionFixture() {
  const calls: Array<{ selector: string; frames: Keyframe[]; options: KeyframeAnimationOptions; animation: FakeAnimation }> = [];
  const region = { querySelector(selector: string) { return { animate(frames: Keyframe[], options: KeyframeAnimationOptions) {
    const animation = new FakeAnimation(); calls.push({ selector, frames, options, animation }); return animation;
  } }; } } as unknown as HTMLElement;
  return { region, calls };
}

test('actual three property-animation calls synchronize shared420ms/easing without persisting animation fills', () => {
  const fixture = regionFixture();
  const cancel = playRunwayTransition(fixture.region, 20, 35);
  assert.equal(fixture.calls.length, 3);
  for (const call of fixture.calls) {
    assert.equal(call.options.duration, DURATION.slow);
    assert.equal(call.options.easing, `cubic-bezier(${EASE.motion.join(',')})`);
    assert.equal(call.options.iterations, 1);
    assert.equal(call.options.fill, 'none');
    assert.deepEqual(call.frames, call.selector === '.qp-runway-fill' ? [{ width: '20%' }, { width: '35%' }] : [{ left: '20%' }, { left: '35%' }]);
    call.animation.dispatch('finish');
    assert.equal(call.animation.cancelled, 1);
    assert.equal(call.animation.listeners.size, 0);
  }
  cancel();
  assert.ok(fixture.calls.every(call => call.animation.cancelled === 1));
});

test('replacement/hidden/unmount cancellation clears each handle/listener exactly once; reduced immediate creates none', () => {
  const fixture = regionFixture();
  const cancel = playRunwayTransition(fixture.region, 20, 35);
  cancel(); cancel();
  assert.ok(fixture.calls.every(call => call.animation.cancelled === 1 && call.animation.listeners.size === 0));
  const reduced = regionFixture();
  playRunwayTransition(reduced.region, 20, 35, 0)();
  playRunwayTransition(reduced.region, 20, 20)();
  assert.equal(reduced.calls.length, 0);
});
