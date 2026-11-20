import assert from 'node:assert/strict';
import { test } from 'node:test';
import { dashboardHidden, onDashboardVisibilityChange } from '../src/lib/dashboard-visibility.ts';

test('overlapping browser and native visibility changes trigger one hide and one resume', () => {
  let nativeHidden = false;
  const doc = Object.assign(new EventTarget(), {
    hidden: false,
    visibilityState: 'visible',
    documentElement: { hasAttribute: () => nativeHidden },
  });
  const original = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', { configurable: true, value: doc });
  try {
    const transitions: boolean[] = [];
    const stop = onDashboardVisibilityChange(() => transitions.push(dashboardHidden()));
    nativeHidden = true;
    doc.dispatchEvent(new Event('qp-dashboard-visibility'));
    doc.hidden = true;
    doc.dispatchEvent(new Event('visibilitychange'));
    nativeHidden = false;
    doc.dispatchEvent(new Event('qp-dashboard-visibility'));
    assert.deepEqual(transitions, [true]);
    doc.hidden = false;
    doc.dispatchEvent(new Event('visibilitychange'));
    assert.deepEqual(transitions, [true, false]);
    stop();
    nativeHidden = true;
    doc.dispatchEvent(new Event('qp-dashboard-visibility'));
    assert.deepEqual(transitions, [true, false]);
  } finally {
    if (original) Object.defineProperty(globalThis, 'document', original);
    else Reflect.deleteProperty(globalThis, 'document');
  }
});
