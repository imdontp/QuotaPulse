import type { MinuteTrendResponse } from '../api';
import type { UsageEventRow, UsageEventScope } from '../lib/usage-events';

/** A bounded, source-specific route; unknown identities cannot be filtered exactly. */
export function activityTrendScope(scope: UsageEventScope, row: UsageEventRow, now: number): UsageEventScope | null {
  const to = Math.min(scope.to, now + 1);
  const from = Math.max(scope.from, to - 30 * 60_000);
  if (to <= from || row.model === null || row.provider === null) return null;
  return { ...scope, from, to, sourceId: row.source_id, harness: row.harness, model: row.model, provider: row.provider, grain: 'call' };
}

export function activityMinutePoints(trend: MinuteTrendResponse): Array<{ at: number; value: number }> {
  if (trend.to <= trend.from || trend.to - trend.from > 30 * 60_000) return [];
  const start = Math.floor(trend.from / 60_000) * 60_000;
  const values = new Map<number, number>();
  for (const row of trend.rows) {
    if (row.bucket_ts >= start && row.bucket_ts < trend.to) {
      values.set(row.bucket_ts, (values.get(row.bucket_ts) ?? 0) + row.total_tokens);
    }
  }
  return Array.from({ length: Math.ceil(trend.to / 60_000) - start / 60_000 }, (_, index) => {
    const at = start + index * 60_000;
    return { at, value: values.get(at) ?? 0 };
  });
}
