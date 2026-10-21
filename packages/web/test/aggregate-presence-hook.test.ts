import assert from 'node:assert/strict';
import { test } from 'node:test';
import React from 'react';
import { AggregatePresenceLedger } from '../src/redesign/aggregate-presence-motion';
import { useAggregatePresenceMotion } from '../src/redesign/use-aggregate-presence-motion';

/** Isolated hook adapter check, not a browser/React DOM lifecycle acceptance claim. */
function environment(run: (h: ReturnType<typeof harness>) => void) {
  const names = ['window', 'document', 'matchMedia', 'IntersectionObserver', 'getComputedStyle'];
  const originals = new Map(names.map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
  const internals = (React as any).__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED;
  const prior = internals.ReactCurrentDispatcher.current;
  const events = new Map<string, Set<() => void>>();
  const listen = (name: string, fn: () => void) => { const set = events.get(name) ?? new Set(); set.add(fn); events.set(name, set); };
  const unlisten = (name: string, fn: () => void) => events.get(name)?.delete(fn);
  Object.assign(globalThis, { document: { hidden: false, addEventListener: listen, removeEventListener: unlisten },
    window: { innerWidth: 1500, innerHeight: 900, addEventListener: listen, removeEventListener: unlisten },
    matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
    IntersectionObserver: undefined, getComputedStyle: () => ({ backgroundColor: 'black', overflowX: 'visible', overflowY: 'visible' }) });
  const h = harness(internals, events);
  try { run(h); } finally {
    h.unmount(); internals.ReactCurrentDispatcher.current = prior;
    for (const name of names) { const descriptor = originals.get(name); if (descriptor) Object.defineProperty(globalThis, name, descriptor); else Reflect.deleteProperty(globalThis, name); }
  }
}
class NativeEffect {
  playState = 'running'; pending = false; cancelled = 0;
  listeners = new Map<string, EventListener>();
  addEventListener(name: string, fn: EventListener) { this.listeners.set(name, fn); }
  removeEventListener(name: string) { this.listeners.delete(name); }
  cancel() { this.cancelled++; this.playState = 'idle'; this.listeners.get('cancel')?.({ currentTarget: this } as unknown as Event); }
  finish() { this.listeners.get('finish')?.({ currentTarget: this } as unknown as Event); }
}
function harness(internals: any, events: Map<string, Set<() => void>>) {
  const refs: any[] = [], effects: Array<{ deps: unknown[]; cleanup?: () => void }> = [];
  const ledger = new AggregatePresenceLedger();
  const calls: Array<{ key: string; duration: unknown; animation: NativeEffect }> = [];
  const rect = () => ({ top: 100, bottom: 200, left: 100, right: 900, width: 800, height: 100 });
  const targets = new Map<string, HTMLElement>();
  const region = { current: null as HTMLElement | null };
  const container = { getBoundingClientRect: rect, parentElement: null, querySelectorAll: () => [...targets.values()] } as unknown as HTMLElement;
  let serial = 0;
  let options: Parameters<typeof useAggregatePresenceMotion>[2] = { batch: undefined, context: 'A', universe: [], page: [], enabled: false,
    hasSnapshot: false, mounted: false, selectionSerial: 0, selectionKey: null, attribute: 'data-model-pair-key', selector: '[data-model-pair-key]' };
  let cancelTarget: (key: string) => void = () => {};
  const render = (patch: Partial<typeof options> = {}) => {
    options = { ...options, ...patch }; let refIndex = 0, effectIndex = 0;
    const pending: Array<() => void> = [];
    internals.ReactCurrentDispatcher.current = {
      useRef: (value: unknown) => refs[refIndex++] ?? (refs[refIndex - 1] = { current: value }),
      useLayoutEffect: (effect: () => (() => void) | void, deps: unknown[]) => {
        const index = effectIndex++, before = effects[index];
        if (!before || deps.some((value, i) => value !== before.deps[i])) pending.push(() => {
          before?.cleanup?.(); effects[index] = { deps, cleanup: effect() ?? undefined };
        });
      },
    };
    cancelTarget = useAggregatePresenceMotion(region, ledger, options);
    for (const effect of pending) effect();
  };
  const target = (key: string) => {
    const node = { getBoundingClientRect: rect, parentElement: container, getAttribute: () => key,
      getAnimations: () => calls.filter(call => call.key === key && call.animation.playState === 'running').map(call => call.animation),
      animate: (_frames: Keyframe[], timing: KeyframeAnimationOptions) => { const animation = new NativeEffect(); calls.push({ key, duration: timing.duration, animation }); return animation; },
    } as unknown as HTMLElement;
    targets.set(key, node); return node;
  };
  const batch = (reason: 'initial' | 'sse' = 'sse') => ({ serial: ++serial, reason, requestEligibility: ledger.snapshot() });
  const seed = () => {
    render(); const initial = batch('initial'); region.current = container; target('old');
    render({ batch: initial, universe: ['old'], page: ['old'], enabled: true, hasSnapshot: true, mounted: true });
  };
  return { ledger, calls, render, target, batch, seed, cancel: (key: string) => cancelTarget(key),
    hide: () => { (document as any).hidden = true; for (const listener of events.get('visibilitychange') ?? []) listener(); },
    unmount: () => { for (const effect of effects) effect.cleanup?.(); effects.length = 0; },
  };
}

test('actual adapter cold seed then presence180/700 survives duplicate and yields only selected target to user intent', () => environment(h => {
  h.seed(); assert.equal(h.calls.length, 0);
  h.target('new'); h.target('other');
  h.render({ batch: h.batch(), universe: ['old', 'new', 'other'], page: ['old', 'new', 'other'] });
  assert.deepEqual(h.calls.map(call => call.duration), [180, 700, 180, 700]);
  h.render({ batch: h.batch(), universe: ['other', 'new', 'old'], page: ['other', 'new', 'old'] });
  assert.equal(h.calls.length, 4); assert.ok(h.calls.every(call => call.animation.cancelled === 0));
  h.cancel('new');
  assert.ok(h.calls.filter(call => call.key === 'new').every(call => call.animation.cancelled === 1));
  assert.ok(h.calls.filter(call => call.key === 'other').every(call => call.animation.cancelled === 0));
  for (const call of h.calls.filter(call => call.key === 'other')) call.animation.finish();
  assert.ok(h.calls.every(call => call.animation.cancelled === 1));
}));

test('actual adapter consumes hidden held response; active effects cancel on hidden and unmount with no replay', () => environment(h => {
  h.seed(); h.target('new');
  h.render({ batch: h.batch(), universe: ['old', 'new'], page: ['new'] });
  assert.equal(h.calls.length, 2);
  const held = h.batch(); h.hide(); assert.ok(h.calls.every(call => call.animation.cancelled === 1));
  (document as any).hidden = false;
  h.target('held'); h.render({ batch: held, universe: ['old', 'new', 'held'], page: ['held'] });
  assert.equal(h.calls.length, 2);
  h.unmount(); assert.ok(h.calls.every(call => call.animation.cancelled === 1));
}));

test('same commit explicit selection wins over new presence and consumes it without a later replay', () => environment(h => {
  h.seed(); h.target('selected'); h.target('other');
  h.render({ batch: h.batch(), universe: ['old', 'selected', 'other'], page: ['selected', 'other'], selectionSerial: 1, selectionKey: 'selected' });
  assert.deepEqual(h.calls.map(call => call.key), ['other', 'other']);
  h.render({ batch: h.batch() });
  assert.equal(h.calls.length, 2);
}));
