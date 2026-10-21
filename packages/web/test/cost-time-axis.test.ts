import assert from 'node:assert/strict';
import { test } from 'node:test';
import { costTimeAxis } from '../src/redesign/cost-time-axis.ts';

const day = 86_400_000;
test('month ticks use real daily boundaries and preserve exact partial-day scope endpoints', () => {
  const from = Date.parse('2025-05-01T00:00:00Z'), to = Date.parse('2025-05-17T20:42:00.001Z');
  const starts = Array.from({ length: 17 }, (_, index) => from + index * day);
  const ticks = costTimeAxis({ from, to, bucketMs: day, starts }, 'en', 'UTC');
  assert.deepEqual(ticks.map(tick => tick.label), ['May 1', 'May 3', 'May 5', 'May 7', 'May 9', 'May 11', 'May 13', 'May 15', 'May 17']);
  assert.equal(ticks[0]!.at, from); assert.equal(ticks.at(-1)!.at, to);
  assert.equal(ticks[0]!.position, 0); assert.equal(ticks.at(-1)!.position, 100);
  assert.ok(ticks.slice(1, -1).every(tick => starts.includes(tick.at)));
});
test('exclusive midnight labels stay within the selected day and cross-year axes include years', () => {
  const from = Date.parse('2024-12-31T00:00:00Z'), to = Date.parse('2025-01-03T00:00:00Z');
  const starts = [from, from + day, from + 2 * day];
  const ticks = costTimeAxis({ from, to, bucketMs: day, starts }, 'en', 'UTC');
  assert.deepEqual(ticks.map(tick => tick.label), ['Dec 31, 2024', 'Jan 1, 2025', 'Jan 2, 2025']);
  assert.equal(ticks.at(-1)!.at, to);
  const singleDay = costTimeAxis({ from, to: from + day, bucketMs: day, starts: [from] }, 'en', 'UTC');
  assert.deepEqual(singleDay.map(tick => tick.at), [from, from + day]);
  assert.deepEqual(singleDay.map(tick => tick.position), [0, 100]);
  assert.deepEqual(singleDay.map(tick => tick.label), ['Dec 31', 'Dec 31']);
});
test('hourly and short scopes retain time labels, locale, and monotonically placed exact instants', () => {
  const from = Date.parse('2025-05-17T00:00:00Z'), to = from + 3_600_000;
  for (const language of ['en', 'th'] as const) {
    const ticks = costTimeAxis({ from, to, bucketMs: 3_600_000, starts: [from, NaN, from - day, to + day] }, language, 'Asia/Bangkok');
    assert.deepEqual(ticks.map(tick => tick.at), [from, to]);
    assert.deepEqual(ticks.map(tick => tick.label), ['07:00', '08:00']);
    assert.deepEqual(ticks.map(tick => tick.position), [0, 100]);
  }
  assert.deepEqual(costTimeAxis({ from, to: from, bucketMs: day, starts: [] }, 'en'), []);
});
