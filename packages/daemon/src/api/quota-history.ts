import type { DB } from '../db/index.js';
import { freshnessFor, latestLimits, quotaForecast, type LimitRow } from './queries.js';

const DAY = 86_400_000;
const MAX_RANGE = 90 * DAY;
const RESET_TOLERANCE = 2_000;
// Keep these spans aligned with the current-window reader in packages/web/src/format.ts.
const WINDOW_SPAN: Record<string, number> = {
  '5h': 5 * 3_600_000, weekly: 7 * DAY, weekly_opus: 7 * DAY,
  weekly_sonnet: 7 * DAY, monthly: 31 * DAY, session: 5 * 3_600_000,
};

export interface QuotaHistoryScope {
  subscriptionKey: string;
  windowKind: string;
  from: number;
  to: number;
}

export function parseQuotaHistoryScope(query: Record<string, unknown>, now: number): QuotaHistoryScope {
  for (const key of Object.keys(query)) {
    if (!['subscription_key', 'window_kind', 'from', 'to'].includes(key)) throw new Error(`Unknown quota-history parameter: ${key}`);
  }
  const exact = (key: string) => {
    const value = query[key];
    if (typeof value !== 'string' || value.length === 0 || value.length > 512 || value.trim() !== value) throw new Error(`Invalid ${key}`);
    return value;
  };
  const epoch = (key: 'from' | 'to', fallback: number) => {
    const value = query[key];
    if (value === undefined) return fallback;
    if (typeof value !== 'string' || !/^(0|[1-9]\d*)$/.test(value)) throw new Error(`Invalid ${key}`);
    const parsed = Number(value);
    if (!Number.isSafeInteger(parsed) || parsed > 8_640_000_000_000_000) throw new Error(`Invalid ${key}`);
    return parsed;
  };
  const from = epoch('from', now - 30 * DAY);
  const to = epoch('to', now + 1);
  if (from >= to || to - from > MAX_RANGE) throw new Error('Quota-history range must be positive and at most 90 days');
  return { subscriptionKey: exact('subscription_key'), windowKind: exact('window_kind'), from, to };
}

function ageSeconds(row: LimitRow, now: number) {
  return Math.round((now - Math.max(row.last_seen_at, row.source_fetched_at ?? 0)) / 1_000);
}

function expired(row: LimitRow, now: number) {
  const span = WINDOW_SPAN[row.window_kind];
  return (row.resets_at != null && row.resets_at <= now) || (span != null && ageSeconds(row, now) * 1_000 > span);
}

/** Select the same owner/window and freshness-first reader as the current limits view. */
export function quotaHistory(db: DB, scope: QuotaHistoryScope, now: number) {
  return db.transaction(() => {
    const candidates = latestLimits(db).filter(row =>
      (row.subscription_key ?? row.account_key ?? `source:${row.source_id}`) === scope.subscriptionKey &&
      row.window_kind === scope.windowKind);
    // Array.sort is stable: equal-ranked readers preserve the order in latestLimits.
    const selected = candidates.sort((a, b) => Number(expired(a, now)) - Number(expired(b, now)) ||
      ageSeconds(a, now) - ageSeconds(b, now))[0];
    const base = { now, from: scope.from, to: scope.to, subscriptionKey: scope.subscriptionKey, windowKind: scope.windowKind };
    if (!selected) return { ...base, available: false, reader: null, segments: [] };
    const staleBySpan = expired(selected, now);
    const freshness = selected.last_seen_at > now ? 'unknown' : staleBySpan ? 'expired' : freshnessFor(selected.last_seen_at, now, selected.resets_at);
    const forecast = quotaForecast(db, selected.source_id, selected.window_kind, selected.origin, now);
    const samples = db.prepare(`SELECT observed_at AS observedAt, last_seen_at AS lastSeenAt,
      used_percent AS usedPercent, resets_at AS resetAt FROM limit_sample
      WHERE source_id=? AND window_kind=? AND origin=? AND observed_at>=? AND observed_at<?
      ORDER BY observed_at ASC, id ASC`).all(selected.source_id, selected.window_kind, selected.origin, scope.from, scope.to) as
      Array<{ observedAt: number; lastSeenAt: number; usedPercent: number | null; resetAt: number | null }>;
    const segments: Array<{ resetAt: number | null; samples: typeof samples }> = [];
    for (const sample of samples) {
      const current = segments.at(-1);
      const prior = current?.samples.at(-1);
      const sameReset = current && (current.resetAt == null || sample.resetAt == null
        ? current.resetAt === sample.resetAt
        : Math.abs(current.resetAt - sample.resetAt) <= RESET_TOLERANCE);
      const monotone = !prior || prior.usedPercent == null || sample.usedPercent == null || sample.usedPercent >= prior.usedPercent;
      if (!sameReset || !monotone) segments.push({ resetAt: sample.resetAt, samples: [] });
      segments.at(-1)!.samples.push(sample);
    }
    return {
      ...base, available: true,
      reader: {
        sourceId: selected.source_id, origin: selected.origin,
        observedAt: selected.observed_at, lastSeenAt: selected.last_seen_at,
        sourceFetchedAt: selected.source_fetched_at, resetAt: selected.resets_at,
        ageSeconds: ageSeconds(selected, now), freshness,
        forecast: freshness === 'live' || freshness === 'recent' ? forecast : { ...forecast, status: 'stale', projectedFullAt: null },
      },
      segments,
    };
  })();
}
