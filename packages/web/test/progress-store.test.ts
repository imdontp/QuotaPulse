import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MAX_DAYS, normalizeStore } from '../src/lib/progress-store';

test('a missing or unusable stored value degrades to a clean store', () => {
  const empty = { version: 1, days: [], unlocked: [] };
  for (const value of [null, undefined, 0, 'nope', [], true]) {
    assert.deepEqual(normalizeStore(value), empty);
  }
  assert.deepEqual(normalizeStore({}), empty);
  assert.deepEqual(normalizeStore({ days: '2026-03-15', unlocked: 'first-pulse' }), empty);
});

test('days are de-duplicated, sorted chronologically and pruned to the window', () => {
  const many = Array.from({ length: MAX_DAYS + 20 }, (_, i) => {
    const dt = new Date(2026, 0, 1);
    dt.setDate(dt.getDate() + i);
    return dt.toISOString().slice(0, 10);
  });
  const store = normalizeStore({ days: [...many, many[0], 'garbage', '', null, 20260315] });
  assert.equal(store.days.length, MAX_DAYS);
  assert.equal(new Set(store.days).size, MAX_DAYS);
  // Pruning keeps the newest days, so the streak survives a long absence.
  assert.equal(store.days.at(-1), many.at(-1));
  assert.ok(store.days.every((day) => /^\d{4}-\d{2}-\d{2}$/.test(day)));
  assert.deepEqual(store.days, [...store.days].sort());
  assert.deepEqual(normalizeStore({ days: ['2026-03-15', '2026-03-14', '2026-03-15'] }).days,
    ['2026-03-14', '2026-03-15']);
});

test('unknown badge ids are dropped and the survivors keep catalogue order', () => {
  const store = normalizeStore({
    unlocked: ['cache-80', 'not-a-badge', 'first-pulse', 'first-pulse', 42, null, 'guardian'],
  });
  assert.deepEqual(store.unlocked, ['first-pulse', 'cache-80', 'guardian']);
});

test('the stored version is forced forward so an old shape cannot leak through', () => {
  assert.equal(normalizeStore({ version: 0, days: ['2026-03-15'] }).version, 1);
  assert.equal(normalizeStore({ version: 99 }).version, 1);
});
