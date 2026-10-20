import assert from 'node:assert/strict';
import { test } from 'node:test';
import { historyElementVisible, historyRecordMotionKey, newHistoryPresences, playHistoryTransitions } from '../src/redesign/history-motion.ts';
import { DURATION, EASE } from '../src/lib/motion.ts';
const identity = (id: number, timestamp = 1000, source = 1, session: number | null = null) => historyRecordMotionKey({ event_id: id, source_id: source, session_key: session, timestamp_ms: timestamp });
const page = (ids: string[], context = 'today-page0') => ({ context, identities: ids });

test('first accepted page and any query/filter/page dependency change establish a static baseline', () => {
  assert.deepEqual(newHistoryPresences(undefined, page([identity(1)])), []);
  for (const context of ['today-page1', 'today-filter', 'all-page0'])
    assert.deepEqual(newHistoryPresences(page([identity(1)]), page([identity(2)], context)), []);
});

test('retained/reordered/duplicate refresh rows do not replay; unchanged-page new actual presence enters once', () => {
  const before = page([identity(1), identity(2)]);
  assert.deepEqual(newHistoryPresences(before, page([identity(2), identity(1), identity(1)])), []);
  const next = page([identity(3), identity(1)]);
  assert.deepEqual(newHistoryPresences(before, next), [identity(3)]);
  assert.deepEqual(newHistoryPresences(next, structuredClone(next)), []);
});

test('late imported historic data may be newly observed without inventing recent timestamps or a live call', () => {
  const before = page([identity(8, 1_000_000)]);
  assert.deepEqual(newHistoryPresences(before, page([identity(8, 1_000_000), identity(2, 100)])), [identity(2, 100)]);
  assert.equal(identity(2, 100), '[2,1,null,100]');
});

test('identity preserves exact source/session/time and does not depend on mutable totals or locale', () => {
  assert.notEqual(identity(1, 1000, 1, null), identity(1, 1000, 1, 0));
  assert.notEqual(identity(1, 1000), identity(1, 1001));
  assert.notEqual(identity(1, 1000), identity(1, 1000, 2));
  const row = { event_id: 1, source_id: 1, session_key: null, timestamp_ms: 1000, total_tokens: 20 };
  assert.equal(historyRecordMotionKey(row), historyRecordMotionKey({ ...row, total_tokens: 40 }));
});

test('bounded preceding-page semantics allow an absent presence to enter again without a lifetime ledger', () => {
  const first = page([identity(1)]), absent = page([]), restored = page([identity(1)]);
  assert.deepEqual(newHistoryPresences(first, absent), []);
  assert.deepEqual(newHistoryPresences(absent, restored), [identity(1)]);
  const many = page(Array.from({ length: 50 }, (_, index) => identity(index)));
  assert.deepEqual(newHistoryPresences(many, page([...many.identities].reverse())), []);
});

class FakeAnimation {
  listeners = new Map<string, EventListener>();
  cancelled = 0;
  addEventListener(name: string, listener: EventListener) { this.listeners.set(name, listener); }
  removeEventListener(name: string, listener: EventListener) { if (this.listeners.get(name) === listener) this.listeners.delete(name); }
  cancel() { this.cancelled++; this.dispatch('cancel'); }
  dispatch(name: string) { this.listeners.get(name)?.({ currentTarget: this } as unknown as Event); }
}
function fixture() {
  const calls: Array<{ frames: Keyframe[]; options: KeyframeAnimationOptions; animation: FakeAnimation }> = [];
  const node = { animate(frames: Keyframe[], options: KeyframeAnimationOptions) {
    const animation = new FakeAnimation(); calls.push({ frames, options, animation }); return animation;
  } } as unknown as HTMLElement;
  return { calls, node };
}
type ObserverRecord = { callback: IntersectionObserverCallback; disconnected: number; observed: Set<Element> };
function environment(run: (observers: ObserverRecord[]) => void) {
  const original = Object.getOwnPropertyDescriptors(globalThis);
  const observers: ObserverRecord[] = [];
  Object.assign(globalThis, { getComputedStyle: () => ({ backgroundColor: 'rgb(0, 0, 0)' }),
    window: { innerHeight: 900, innerWidth: 1500 },
    IntersectionObserver: class {
      record: (typeof observers)[number];
      constructor(callback: IntersectionObserverCallback) { this.record = { callback, disconnected: 0, observed: new Set() }; observers.push(this.record); }
      observe(target: Element) { this.record.observed.add(target); }
      unobserve(target: Element) { this.record.observed.delete(target); }
      disconnect() { this.record.disconnected++; this.record.observed.clear(); }
    } });
  try { run(observers); } finally {
    for (const name of ['getComputedStyle', 'window', 'IntersectionObserver']) {
      if (original[name]) Object.defineProperty(globalThis, name, original[name]!);
      else Reflect.deleteProperty(globalThis, name);
    }
  }
  return observers;
}

test('actual settle/emphasis calls use shared180/700ms and once-only final-base cleanup', () => environment(() => {
  const f = fixture();
  const cancel = playHistoryTransitions([f.node, f.node]);
  assert.equal(f.calls.length, 2, 'one pair per actual target despite duplicate selection/presence');
  assert.deepEqual(f.calls.map(call => call.options.duration), [DURATION.fast, DURATION.deliberate]);
  for (const call of f.calls) {
    assert.equal(call.options.easing, `cubic-bezier(${EASE.motion.join(',')})`);
    assert.equal(call.options.iterations, 1);
    assert.equal(call.options.fill, 'none');
    call.animation.dispatch('finish');
    assert.equal(call.animation.cancelled, 1);
    assert.equal(call.animation.listeners.size, 0);
  }
  cancel();
  assert.ok(f.calls.every(call => call.animation.cancelled === 1));
}));

test('hidden/unmount/replacement cancellation releases all handles and observer targets once; reduced is static', () => {
  const observers = environment(() => {
    const f = fixture();
    const cancel = playHistoryTransitions([f.node]);
    cancel(); cancel();
    assert.ok(f.calls.every(call => call.animation.cancelled === 1 && call.animation.listeners.size === 0));
    const reduced = fixture();
    playHistoryTransitions([reduced.node], true)();
    assert.equal(reduced.calls.length, 0);
  });
  assert.equal(observers.length, 1);
  assert.equal(observers[0]!.observed.size, 0);
  assert.ok(observers[0]!.disconnected > 0);
});

test('visibility checks respect viewport and actual scrolling table clipping', () => environment(() => {
  const element = (left: number, top: number, right: number, bottom: number) => ({ getBoundingClientRect: () => ({ left, top, right, bottom, width: right - left, height: bottom - top }) }) as HTMLElement;
  const clip = element(100, 200, 1000, 500);
  assert.equal(historyElementVisible(element(200, 250, 500, 280), clip), true);
  assert.equal(historyElementVisible(element(200, 510, 500, 540), clip), false);
  assert.equal(historyElementVisible(element(200, 100, 500, 150), clip), false);
  assert.equal(historyElementVisible(element(0, 1000, 100, 1050)), false);
}));


test('actual offscreen observer callback cancels only that target and keeps the other finite batch alive', () => environment(observers => {
  const first = fixture(), second = fixture();
  const cancel = playHistoryTransitions([first.node, second.node]);
  const observer = observers[0]!;
  observer.callback([{ target: first.node, isIntersecting: false } as IntersectionObserverEntry], {} as IntersectionObserver);
  assert.ok(first.calls.every(call => call.animation.cancelled === 1 && call.animation.listeners.size === 0));
  assert.ok(second.calls.every(call => call.animation.cancelled === 0));
  assert.equal(observer.observed.has(first.node), false);
  assert.equal(observer.observed.has(second.node), true);
  cancel();
  assert.ok(second.calls.every(call => call.animation.cancelled === 1));
}));
