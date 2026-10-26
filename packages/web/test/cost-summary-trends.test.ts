import assert from 'node:assert/strict';
import { test } from 'node:test';
import { costSummaryTrends as actualTrends } from '../src/redesign/cost-summary-trends.ts';
import { costValue } from '../src/redesign/cost-value.tsx';

const day = 86_400_000, scope = { from: 0, to: 3.5 * day };
const costSummaryTrends = (points: Parameters<typeof actualTrends>[0], range: Parameters<typeof actualTrends>[1], bucketMs: number) => actualTrends(points, range, bucketMs, range.to);
const point = (start: number, amount: number, pricedTokens: number, pricedCalls: number, allCalls = pricedCalls) => ({ start, amount, pricedTokens, pricedCalls, allCalls, allTokens: pricedTokens });
const fixture = [point(0, 2, 100, 2), point(day, 0, 0, 0, 5), point(2 * day, 6, 300, 3, 7), point(3 * day, 0, 100, 1)];

test('unknown price intervals are gaps while a priced zero and empty reporting interval remain zero', () => {
  const rows = costSummaryTrends([...fixture, point(4 * day, 0, 0, 0)], { from: 0, to: 5 * day }, day).amount;
  assert.deepEqual(rows.map(p => p.value), [2, null, 6, 0, 0]);
  assert.equal(costValue(0, rows[1]!.pricedCalls, rows[1]!.allCalls, String, 'Unknown'), 'Unknown');
  assert.equal(costValue(0, rows[3]!.pricedCalls, rows[3]!.allCalls, String, 'Unknown'), '0');
});
test('cumulative daily average uses elapsed time and clips the final partial bucket to the exact scope', () => {
  const rows = costSummaryTrends(fixture, scope, day).average;
  assert.deepEqual(rows.map(p => p.value), [2, 1, 8 / 3, 8 / 3.5]);
  assert.equal(rows.at(-1)!.at, scope.to);
});
test('per1K uses cumulative priced tokens rather than all tokens or the mean of bucket ratios', () => {
  const rows = costSummaryTrends(fixture.map(p => ({ ...p, allTokens: p.pricedTokens + 1000000 })), scope, day).perThousand;
  assert.deepEqual(rows.map(p => p.value), [20, 20, 20, 16]);
});
test('weighted cumulative coverage preserves unknown and other-basis calls for the known-value suffix', () => {
  const rows = costSummaryTrends(fixture, scope, day).average;
  assert.deepEqual(rows.map(p => [p.pricedCalls, p.allCalls]), [[2, 2], [2, 7], [5, 14], [6, 15]]);
  assert.equal(costValue(rows[1]!.value!, rows[1]!.pricedCalls, rows[1]!.allCalls, String, 'Unknown'), '1+');
});
test('native-only basis receives no API amounts and unknown prefix buckets stay unavailable', () => {
  const native = [point(0, 0, 0, 0, 2), point(day, 0, 0, 0, 5), point(2 * day, 4, 400, 4, 7), point(3 * day, 0, 0, 0, 1)];
  const rows = costSummaryTrends(native, scope, day);
  assert.deepEqual(rows.amount.map(p => p.value), [null, null, 4, null]);
  assert.deepEqual(rows.average.map(p => p.value), [null, null, 4 / 3, 4 / 3.5]);
  assert.deepEqual(rows.perThousand.map(p => p.value), [null, null, 10, 10]);
});
test('less than one elapsed24h has no daily average and a zero priced-token denominator stays unknown', () => {
  const rows = costSummaryTrends([point(0, 3, 0, 1)], { from: 0, to: day / 2 }, day);
  assert.equal(rows.average[0]!.value, null);
  assert.equal(rows.perThousand[0]!.value, null);
});
test('all-unpriced usage and truly priced zero remain distinct in cumulative summaries', () => {
  const unknown = costSummaryTrends([point(0, 0, 0, 0, 9)], { from: 0, to: day }, day);
  assert.equal(unknown.average[0]!.value, null);assert.equal(unknown.perThousand[0]!.value, null);
  const zero = costSummaryTrends([point(0, 0, 200, 9)], { from: 0, to: day }, day);
  assert.equal(zero.average[0]!.value, 0);assert.equal(zero.perThousand[0]!.value, 0);
});
test('DST-length days use elapsed24h rather than an assumed number of calendar labels', () => {
  for (const hours of [23, 25]) {
    const from = Date.parse(hours === 23 ? '2025-03-08T00:00:00-05:00' : '2025-11-01T00:00:00-04:00');
    const to = from + day + hours * 3600000;
    const points = [point(from, 10, 100, 1), point(from + day, 10, 100, 1)];
    if (hours === 25) points.push(point(from + 2 * day, 0, 0, 0));
    const rows = costSummaryTrends(points, { from, to }, day);
    assert.equal(rows.average.at(-1)!.value, 20 / ((to - from) / day));
  }
});

test('a future range cannot claim an elapsed daily average, while the inclusive-now1ms boundary stays valid', () => {
  const future = actualTrends(fixture, scope, day, 3 * day);
  assert.ok(future.average.every(p => p.value === null));
  assert.equal(future.perThousand.at(-1)!.value, 16);
  const boundary = actualTrends(fixture, scope, day, scope.to - 1);
  assert.equal(boundary.average.at(-1)!.value, 8 / 3.5);
});

test('a complete elapsed reporting period with no calls has a zero average and no per-token denominator', () => {
  const rows = actualTrends([point(0, 0, 0, 0)], { from: 0, to: day }, day, day);
  assert.equal(rows.average[0]!.value, 0);
  assert.equal(rows.perThousand[0]!.value, null);
  assert.equal(costValue(rows.average[0]!.value!, 0, 0, String, 'Unknown'), '0');
});
