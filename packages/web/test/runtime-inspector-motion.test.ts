import assert from 'node:assert/strict';
import { test } from 'node:test';
import { currentRuntimeInspection, runtimeInspectorContext, runtimeInspectorDecision, runtimeInspectorKey, restoreRuntimeInspectorFocus } from '../src/redesign/runtime-inspector-motion';

test('Runtime inspector identity preserves dimension and exact null/empty/case metadata', () => {
  const identities = [runtimeInspectorKey('project', null), runtimeInspectorKey('project', ''), runtimeInspectorKey('project', 'A'), runtimeInspectorKey('project', 'a'), runtimeInspectorKey('model', 'A')];
  assert.equal(new Set(identities).size, identities.length);
  assert.equal(runtimeInspectorKey('model', null), '["model",null]');
});

test('canonical inspector scope excludes rolling clocks and distinguishes exact project from All', () => {
  assert.equal(runtimeInspectorContext('route', null), runtimeInspectorContext('route', undefined));
  assert.notEqual(runtimeInspectorContext('route', null), runtimeInspectorContext('route', ''));
  assert.notEqual(runtimeInspectorContext('route', 'A'), runtimeInspectorContext('route', 'a'));
  assert.notEqual(runtimeInspectorContext('route', 'A'), runtimeInspectorContext('other-route', 'A'));
});

test('foreign/pending selection is unavailable before rendering detail; same-context retained selection stays exact', () => {
  const context = runtimeInspectorContext('route', 'A');
  const selection = { dimension: 'model' as const, key: '', contextKey: context, serial: 1 };
  assert.equal(currentRuntimeInspection(selection, context, true), selection);
  assert.equal(currentRuntimeInspection(selection, context, false), null);
  assert.equal(currentRuntimeInspection(selection, runtimeInspectorContext('route', 'B'), true), null);
  assert.equal(currentRuntimeInspection(selection, runtimeInspectorContext('other-route', 'A'), true), null);
  assert.equal(currentRuntimeInspection(null, context, true), null);
});

test('only an explicit changed selected identity enters once; duplicate graphs do not truncate native effects', () => {
  const contextKey = 'route-project';
  const initial = { contextKey, key: null, serial: 0 };
  const first = { contextKey, key: runtimeInspectorKey('provider', 'openai'), serial: 1 };
  assert.equal(runtimeInspectorDecision(initial, initial, true).animate, false);
  const chosen = runtimeInspectorDecision(initial, first, true);
  assert.equal(chosen.animate, true); assert.equal(chosen.cancel, true);
  const duplicate = runtimeInspectorDecision(chosen.state, first, true);
  assert.equal(duplicate.animate, false); assert.equal(duplicate.cancel, false);
  const sameIdentity = runtimeInspectorDecision(duplicate.state, { ...first, serial: 2 }, true);
  assert.equal(sameIdentity.animate, false); assert.equal(sameIdentity.cancel, false);
  const second = runtimeInspectorDecision(sameIdentity.state, { ...first, key: runtimeInspectorKey('model', 'openai'), serial: 3 }, true);
  assert.equal(second.animate, true);
});

test('same-context refreshing keeps running effects but consumes a new static intent without delayed replay', () => {
  const selected = { contextKey: 'A', key: runtimeInspectorKey('model', 'M'), serial: 1 };
  const duplicate = runtimeInspectorDecision(selected, selected, true, false);
  assert.equal(duplicate.cancel, false); assert.equal(duplicate.animate, false);
  const requested = { ...selected, key: runtimeInspectorKey('model', 'other'), serial: 2 };
  const staticSelection = runtimeInspectorDecision(selected, requested, true, false);
  assert.equal(staticSelection.animate, false);
  assert.equal(runtimeInspectorDecision(staticSelection.state, requested, true, true).animate, false);
});

test('context/hidden/reduced/error losses consume selection and cannot replay after restoration', () => {
  const initial = { contextKey: 'A', key: null, serial: 0 };
  const requested = { contextKey: 'A', key: runtimeInspectorKey('project', null), serial: 1 };
  const hidden = runtimeInspectorDecision(initial, requested, false);
  assert.equal(hidden.animate, false); assert.equal(hidden.cancel, true);
  assert.equal(runtimeInspectorDecision(hidden.state, requested, true).animate, false);
  const changed = runtimeInspectorDecision(requested, { ...requested, contextKey: 'B', serial: 2 }, true);
  assert.equal(changed.animate, false); assert.equal(changed.cancel, true);
  const closed = runtimeInspectorDecision(requested, { ...requested, key: null }, true);
  assert.equal(closed.cancel, true);
  assert.equal(runtimeInspectorDecision(closed.state, { ...requested, serial: 2 }, true).animate, true, 'close then user reopen is a fresh explicit selection');
});

test('native focus restoration chooses exact visible opener or connected fallback, with no effect dependency', () => {
  const calls: string[] = [];
  const node = (name: string, connected = true, visible = true) => ({ isConnected: connected, getClientRects: () => visible ? [{}] : [], focus: (options: unknown) => { assert.deepEqual(options, { preventScroll: true }); calls.push(name); } }) as unknown as HTMLElement;
  const fallback = node('fallback');
  restoreRuntimeInspectorFocus(node('exact'), fallback);
  restoreRuntimeInspectorFocus(node('detached', false), fallback);
  restoreRuntimeInspectorFocus(node('hidden', true, false), fallback);
  restoreRuntimeInspectorFocus(null, node('also-detached', false));
  assert.deepEqual(calls, ['exact', 'fallback', 'fallback']);
});
