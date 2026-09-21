import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createEventTracker } from '../src/presence/event-tracker.js';
import type { ProviderPresence } from '../src/presence/types.js';

const NOW = Date.parse('2026-09-02T12:00:00Z');
const DAY = 86_400_000;

function p(over: Partial<ProviderPresence> = {}): ProviderPresence {
  return {
    key: 'claude',
    name: 'Claude',
    usedPercent: 20,
    windowKind: 'weekly',
    resetsAt: NOW + DAY,
    severity: 'ok',
    active: false,
    ageSeconds: 5,
    windows: [],
    ...over,
  };
}

const types = (events: Array<{ type: string }>) => events.map((e) => e.type);

test('80% warns once, not on every subsequent reading', () => {
  const t = createEventTracker();
  assert.deepEqual(t.update([p({ usedPercent: 79 })], NOW), [], 'first sighting is a baseline');
  assert.deepEqual(types(t.update([p({ usedPercent: 81 })], NOW + 1_000)), ['warning']);
  assert.deepEqual(t.update([p({ usedPercent: 82 })], NOW + 2_000), []);
  assert.deepEqual(t.update([p({ usedPercent: 83 })], NOW + 3_000), []);
  assert.deepEqual(types(t.update([p({ usedPercent: 95 })], NOW + 4_000)), ['critical']);
});

test('a fresh start above a threshold announces nothing (tray restart)', () => {
  const t = createEventTracker();
  assert.deepEqual(t.update([p({ usedPercent: 96 })], NOW), []);
  assert.deepEqual(t.update([p({ usedPercent: 97 })], NOW + 1_000), []);
});

test('a rolled-over window emits reset and restarts the ladder', () => {
  const t = createEventTracker();
  t.update([p({ usedPercent: 80, resetsAt: NOW - 500 })], NOW);
  // The old window has now passed and the reader publishes the next one.
  const rolled = t.update([p({ usedPercent: 3, resetsAt: NOW + DAY })], NOW + 1_000);
  assert.deepEqual(types(rolled), ['reset']);
  // The new window starts clean, so crossing 80 again is a real event.
  assert.deepEqual(types(t.update([p({ usedPercent: 85, resetsAt: NOW + DAY })], NOW + 2_000)), ['warning']);
});

test('a 28ms reset jitter is not a reset', () => {
  const t = createEventTracker();
  t.update([p({ usedPercent: 80, resetsAt: NOW + 1_000 })], NOW);
  assert.deepEqual(t.update([p({ usedPercent: 80, resetsAt: NOW + 1_028 })], NOW + 500), []);
});

test('activity transitions emit once per change', () => {
  const t = createEventTracker();
  t.update([p({ active: false })], NOW);
  assert.deepEqual(types(t.update([p({ active: true })], NOW + 1_000)), ['activity-start']);
  assert.deepEqual(t.update([p({ active: true })], NOW + 2_000), []);
  assert.deepEqual(types(t.update([p({ active: false })], NOW + 3_000)), ['activity-stop']);
});

test('a provider that disappears forgets its ladder', () => {
  const t = createEventTracker();
  t.update([p({ usedPercent: 80 })], NOW);
  t.update([], NOW + 1_000);
  // Reappearing at 80 is a baseline again, not a fresh warning.
  assert.deepEqual(t.update([p({ usedPercent: 80 })], NOW + 2_000), []);
});
