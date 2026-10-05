import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { TrendRow, UsagePeriod } from '../src/api.ts';
import { averageDailyTokenPace, cacheShareTrendSeries, metricTrendSeries } from '../src/redesign/metric-series.ts';

const local = (year: number, month: number, day: number, hour = 0) => new Date(year, month - 1, day, hour).getTime();
const row = (bucket_ts: number, values: Partial<TrendRow> = {}): TrendRow => ({
  bucket_ts, series: 'all', calls: 0, input_tokens: 0, cached_input_tokens: 0, cache_write_tokens: 0,
  output_tokens: 0, total_tokens: 0, cost_usd: 0, cost_unknown_calls: 0, cost_estimated_calls: 0, ...values,
});
const period = (from: number, to: number, bucket: UsagePeriod['bucket']): UsagePeriod => ({ range: 'custom', from, to, timezone: 'local', bucket });

test('metric trends fill missing hourly buckets and keep partial boundary buckets', () => {
  const from = local(2025, 5, 17, 9) + 15 * 60_000;
  const to = local(2025, 5, 17, 12) + 15 * 60_000;
  const values = metricTrendSeries([
    row(local(2025, 5, 17, 9), { total_tokens: 3 }),
    row(local(2025, 5, 17, 11), { total_tokens: 8 }),
  ], period(from, to, 'hour'), 'total_tokens');
  assert.deepEqual(values, [3, 0, 8, 0]);
});

test('metric trends cap long histories to the latest 24 calendar buckets', () => {
  const from = local(2025, 1, 1);
  const to = local(2025, 2, 10);
  const rows = Array.from({ length: 40 }, (_, day) => row(local(2025, 1, day + 1), { total_tokens: day + 1 }));
  const values = metricTrendSeries(rows, period(from, to, 'day'), 'total_tokens');
  assert.equal(values.length, 24);
  assert.deepEqual(values.slice(0, 3), [17, 18, 19]);
  assert.deepEqual(values.slice(-2), [39, 40]);
});

test('month series uses local calendar months and cache ratios preserve unknown buckets', () => {
  const from = local(2025, 1, 12);
  const to = local(2025, 4, 15);
  const monthly = metricTrendSeries([
    row(local(2025, 1, 1), { cost_usd: 2 }), row(local(2025, 3, 1), { cost_usd: 5 }),
  ], period(from, to, 'month'), 'cost_usd');
  assert.deepEqual(monthly, [2, 0, 5, 0]);

  const hourly = period(local(2025, 5, 17), local(2025, 5, 17, 3), 'hour');
  const cache = cacheShareTrendSeries([
    row(local(2025, 5, 17), { input_tokens: 25, cached_input_tokens: 50, cache_write_tokens: 25 }),
    row(local(2025, 5, 17, 2), { input_tokens: 100, cached_input_tokens: 0 }),
  ], hourly);
  assert.deepEqual(cache, [50, null, 0]);
});

test('daily token pace is a selected-period average and rejects invalid ranges', () => {
  const halfDay = 12 * 60 * 60_000;
  assert.equal(averageDailyTokenPace(1_000, 0, halfDay), 2_000);
  assert.equal(averageDailyTokenPace(0, 0, halfDay), 0);
  assert.equal(averageDailyTokenPace(1_000, 10, 10), null);
  assert.equal(averageDailyTokenPace(Number.NaN, 0, halfDay), null);
});
