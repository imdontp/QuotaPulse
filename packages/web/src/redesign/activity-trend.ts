import type { MinuteTrendResponse } from '../api';
import type { UsageEventRow, UsageEventScope } from '../lib/usage-events';

const ACTIVITY_WINDOW_MS = 30 * 60_000;
const CONCEPT_HARNESS_ORDER = ['hermes', 'codex', 'claude-code', 'opencode'];
const CONCEPT_HARNESS_RANK = new Map(CONCEPT_HARNESS_ORDER.map((harness, index) => [harness, index]));

/** The Overview activity rail is scoped to observed records in its trailing visible interval. */
export function recentActivityScope(scope: UsageEventScope, now: number): UsageEventScope | null {
  const to = Math.min(scope.to, now + 1);
  if (!Number.isFinite(scope.from) || !Number.isFinite(to) || to <= scope.from) return null;
  const from = Math.max(scope.from, to - ACTIVITY_WINDOW_MS);
  if (to <= from) return null;
  const activityScope = { ...scope, from, to };
  delete activityScope.grain;
  return activityScope;
}

/** Minute rates and sparklines represent per-call records only. */
export function recentActivityCallScope(scope: UsageEventScope, now: number): UsageEventScope | null {
  const activityScope = recentActivityScope(scope, now);
  return activityScope ? { ...activityScope, grain: 'call' } : null;
}

/** Usage-event rows are newest-first; keep only the newest observed route per harness. */
export function latestActivityByHarness(rows: readonly UsageEventRow[], limit = 4): UsageEventRow[] {
  const seen = new Set<string>();
  const result: UsageEventRow[] = [];
  const newestFirst = [...rows].sort((a, b) => b.timestamp_ms - a.timestamp_ms || b.event_id - a.event_id);
  for (const row of newestFirst) {
    const key = row.harness.trim().toLocaleLowerCase('en-US');
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(row);
    if (result.length >= limit) break;
  }
  return result.sort((a, b) => {
    const first = a.harness.trim().toLocaleLowerCase('en-US');
    const second = b.harness.trim().toLocaleLowerCase('en-US');
    return (CONCEPT_HARNESS_RANK.get(first) ?? CONCEPT_HARNESS_ORDER.length) -
      (CONCEPT_HARNESS_RANK.get(second) ?? CONCEPT_HARNESS_ORDER.length) ||
      b.timestamp_ms - a.timestamp_ms || b.event_id - a.event_id;
  });
}

/** A bounded route identity; a source filter applies only when the outer scope selected one. */
export function activityTrendScope(scope: UsageEventScope | null, row: UsageEventRow, now: number): UsageEventScope | null {
  if (!scope) return null;
  const to = Math.min(scope.to, now + 1);
  const from = Math.max(scope.from, to - 30 * 60_000);
  if (to <= from || row.grain !== 'call' || row.model === null || row.provider === null) return null;
  // The displayed identity is harness + provider + model. Aggregate matching routes
  // across profiles unless the selected workspace scope already restricts a source.
  return { ...scope, from, to, harness: row.harness, model: row.model, provider: row.provider, grain: 'call' };
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

/** Average observed call tokens over the exact queried interval; never infer a rate from event totals. */
export function activityTokensPerMinute(trend: MinuteTrendResponse | null | undefined): number | null {
  if (!trend || trend.bucket !== 'minute' || trend.measurement !== 'recorded_tokens_per_minute' ||
      trend.to <= trend.from || trend.to - trend.from > ACTIVITY_WINDOW_MS || trend.coverage.includedRecords <= 0) return null;
  const first = Math.floor(trend.from / 60_000) * 60_000;
  const total = trend.rows.reduce((sum, row) => row.bucket_ts >= first && row.bucket_ts < trend.to &&
    Number.isFinite(row.total_tokens) && row.total_tokens > 0 ? sum + row.total_tokens : sum, 0);
  return Number.isFinite(total) ? total / ((trend.to - trend.from) / 60_000) : null;
}
