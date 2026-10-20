import assert from 'node:assert/strict';
import { test } from 'node:test';
import { historyRailNeedsReveal, restoreHistoryRailFocus } from '../src/redesign/history-rail-focus.ts';

test('a flow detail needs explicit reveal only if its heading/first content lies outside the viewport', () => {
  assert.equal(historyRailNeedsReveal({ top: 100, height: 1500 }, 900), false, 'tall detail need not fit the whole viewport');
  assert.equal(historyRailNeedsReveal({ top: 850, height: 1500 }, 900), true);
  assert.equal(historyRailNeedsReveal({ top: -10, height: 1500 }, 900), true);
  assert.equal(historyRailNeedsReveal({ top: 870, height: 20 }, 900), false);
});

test('explicit close restores only a visible connected row opener; clipping/hidden/removal fall back safely', () => {
  const oldWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const oldStyle = Object.getOwnPropertyDescriptor(globalThis, 'getComputedStyle');
  Object.assign(globalThis, { window: { innerWidth: 1000, innerHeight: 800 },
    getComputedStyle: (element: HTMLElement & { hidden?: boolean }) => ({ visibility: element.hidden ? 'hidden' : 'visible' }) });
  const calls: string[] = [];
  const element = (name: string, top: number, bottom: number, connected = true, hidden = false) => ({
    isConnected: connected, hidden,
    getBoundingClientRect: () => ({ top, bottom, left: 100, right: 900, width: 800, height: bottom - top }),
    focus(options: unknown) { assert.deepEqual(options, { preventScroll: true }); calls.push(name); },
  }) as unknown as HTMLElement;
  const table = element('table', 200, 600), main = element('main', 0, 1500);
  try {
    restoreHistoryRailFocus(element('opener', 250, 280), table, main);
    restoreHistoryRailFocus(element('clipped-row', 610, 640), table, main);
    restoreHistoryRailFocus(element('detached-row', 250, 280, false), table, main);
    restoreHistoryRailFocus(element('hidden-row', 250, 280, true, true), table, main);
    restoreHistoryRailFocus(null, element('offscreen-table', 900, 1000), main);
    restoreHistoryRailFocus(null, null, element('detached-main', 0, 1500, false));
    assert.deepEqual(calls, ['opener', 'table', 'table', 'table', 'main']);
  } finally {
    if (oldWindow) Object.defineProperty(globalThis, 'window', oldWindow); else Reflect.deleteProperty(globalThis, 'window');
    if (oldStyle) Object.defineProperty(globalThis, 'getComputedStyle', oldStyle); else Reflect.deleteProperty(globalThis, 'getComputedStyle');
  }
});
