import type { TrendRow, UsagePeriod } from '@/api';

const MAX_POINTS = 24;

function floorBucket(value: number, bucket: UsagePeriod['bucket']) {
  const date = new Date(value);
  if (bucket === 'hour') date.setMinutes(0, 0, 0);
  else {
    date.setHours(0, 0, 0, 0);
    if (bucket === 'week') date.setDate(date.getDate() - (date.getDay() + 6) % 7);
    if (bucket === 'month') date.setDate(1);
  }
  return date.getTime();
}

function shiftBucket(value: number, bucket: UsagePeriod['bucket'], amount: number) {
  const date = new Date(value);
  if (bucket === 'hour') date.setHours(date.getHours() + amount);
  else if (bucket === 'day') date.setDate(date.getDate() + amount);
  else if (bucket === 'week') date.setDate(date.getDate() + amount * 7);
  else date.setMonth(date.getMonth() + amount);
  return date.getTime();
}

function groupRecentBuckets(rows: readonly TrendRow[], period: UsagePeriod) {
  if (!Number.isFinite(period.from) || !Number.isFinite(period.to) || period.to <= period.from) return [];
  const first = floorBucket(period.from, period.bucket);
  let bucket = floorBucket(period.to - 1, period.bucket);
  const grouped = new Map<number, TrendRow[]>();
  for (const row of rows) {
    if (!Number.isFinite(row.bucket_ts) || row.bucket_ts < first || row.bucket_ts >= period.to) continue;
    const group = grouped.get(row.bucket_ts) ?? [];
    group.push(row);
    grouped.set(row.bucket_ts, group);
  }
  const points: TrendRow[][] = [];
  for (let count = 0; count < MAX_POINTS && bucket >= first; count++) {
    points.unshift(grouped.get(bucket) ?? []);
    const prior = shiftBucket(bucket, period.bucket, -1);
    if (prior >= bucket) break;
    bucket = prior;
  }
  return points;
}

/** Returns the latest calendar buckets, preserving empty periods as measured zeroes. */
export function metricTrendSeries(rows: readonly TrendRow[], period: UsagePeriod, metric: 'total_tokens' | 'cost_usd') {
  return groupRecentBuckets(rows, period).map(group => group.reduce((sum, row) => sum + (Number.isFinite(row[metric]) ? row[metric] : 0), 0));
}

/** Cache share stays unknown for a bucket with no input-token observations. */
export function cacheShareTrendSeries(rows: readonly TrendRow[], period: UsagePeriod): Array<number | null> {
  return groupRecentBuckets(rows, period).map(group => {
    const cached = group.reduce((sum, row) => sum + (Number.isFinite(row.cached_input_tokens) ? row.cached_input_tokens : 0), 0);
    const input = group.reduce((sum, row) => sum + (Number.isFinite(row.input_tokens) ? row.input_tokens : 0) +
      (Number.isFinite(row.cached_input_tokens) ? row.cached_input_tokens : 0) +
      (Number.isFinite(row.cache_write_tokens) ? row.cache_write_tokens : 0), 0);
    return input > 0 ? cached / input * 100 : null;
  });
}

/** A selected-period daily average, not a short-term forecast. */
export function averageDailyTokenPace(tokens: number, from: number, to: number) {
  const span = to - from;
  if (!Number.isFinite(tokens) || tokens < 0 || !Number.isFinite(span) || span <= 0) return null;
  return tokens * 86_400_000 / span;
}
