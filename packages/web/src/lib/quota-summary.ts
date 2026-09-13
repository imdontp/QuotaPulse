import type { Limit, Overview, SubscriptionStatus, TrendRow } from '../api';
import { isExpired, primaryLimits, thresholdLimits, willExhaust } from '../format';

export type Readiness = 'attention' | 'check' | 'available' | 'inactive';
export interface SubscriptionSummary {
  subscription: SubscriptionStatus;
  limits: Limit[];
  status: Readiness;
}

export function quotaSummaries(ov: Overview, hidden: string[] = []): SubscriptionSummary[] {
  const windows = primaryLimits(ov.limits, ov.now).map(({ primary }) => primary);
  const rank: Record<Readiness, number> = { attention: 0, check: 1, available: 2, inactive: 3 };
  return ov.subscriptions.filter(s => !hidden.includes(s.subscription_key)).map(subscription => {
    const limits = windows.filter(l => (l.subscription_key ?? l.account_key) === subscription.subscription_key);
    const attention = thresholdLimits(limits, ov.now).length > 0 || limits.some(l => willExhaust(l, ov.now));
    const reliable = subscription.state === 'active' && !subscription.telemetry.gap &&
      ['live', 'recent'].includes(subscription.telemetry.freshness) && limits.length > 0 &&
      limits.every(l => !isExpired(l, ov.now) && l.used_percent != null &&
        l.ageSeconds != null && l.ageSeconds < 3600);
    const status: Readiness = subscription.state === 'inactive' ? 'inactive' :
      attention ? 'attention' : reliable ? 'available' : 'check';
    return { subscription, limits, status };
  }).sort((a, b) => rank[a.status] - rank[b.status] ||
    a.subscription.subscription_display_name.localeCompare(b.subscription.subscription_display_name));
}

export function upcomingResets(summaries: SubscriptionSummary[], now: number) {
  return summaries.filter(s => s.status !== 'inactive').flatMap(s => s.limits)
    .filter((l): l is Limit & { resets_at: number } => l.resets_at != null && l.resets_at > now)
    .sort((a, b) => a.resets_at - b.resets_at ||
      (a.subscription_key ?? '').localeCompare(b.subscription_key ?? '') || a.window_kind.localeCompare(b.window_kind));
}

/** The API buckets Unix timestamps; the query bounds still select the exact period. */
export function statSeries(rows: TrendRow[], from: number, to: number, bucket: 'hour' | 'day', metric: 'total_tokens' | 'cost_usd') {
  const size = bucket === 'day' ? 86_400_000 : 3_600_000;
  const values = new Map<number, number>();
  for (const row of rows) values.set(row.bucket_ts, (values.get(row.bucket_ts) ?? 0) + row[metric]);
  const points: number[] = [];
  for (let ts = Math.floor(from / size) * size; ts < to; ts += size) {
    points.push(values.get(ts) ?? 0);
  }
  return points;
}
