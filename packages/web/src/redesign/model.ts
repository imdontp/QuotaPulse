/** Read-only presentation contracts. An aggregate record is never a live call. */
export interface UsageRecord {
  id: string;
  project: string | null;
  harness: string;
  provider: string;
  model: string;
  session: string;
  grain: 'call' | 'session_model_aggregate';
  tokens: number;
  cost: number | null;
  costSource: 'native' | 'computed' | 'estimated' | 'unknown';
}

export interface QuotaWindow {
  id: string;
  ownerKey?: string;
  sourceId?: number;
  origin?: string;
  owner: string;
  provider?: string;
  window: string;
  usedPercent: number | null;
  observedAt: number;
  resetAt: number;
  confirmedAt?: number;
  freshness?: 'live' | 'recent' | 'stale' | 'unknown' | 'expired' | 'mixed';
  projectedFullAt?: number | null;
  forecastStatus?: 'ready' | 'insufficient' | 'flat' | 'reset';
}

export function quotaState(quota: QuotaWindow, now: number, staleAfterMs: number) {
  const confirmedAt = quota.confirmedAt ?? quota.observedAt;
  const stale = !Number.isFinite(confirmedAt) || confirmedAt > now ||
    now - confirmedAt > staleAfterMs || !Number.isFinite(quota.resetAt) || quota.resetAt <= now ||
    (quota.freshness != null && !['live', 'recent'].includes(quota.freshness));
  const used = quota.usedPercent;
  const known = used !== null && Number.isFinite(used) && used >= 0;
  return {
    stale,
    remaining: known ? Math.max(0, 100 - used) : null,
    risk: stale || !known ? 'unknown' : used >= 95 ||
      (quota.projectedFullAt != null && quota.projectedFullAt > now && quota.projectedFullAt < quota.resetAt)
      ? 'critical' : used >= 80 ? 'warning' : 'normal',
  } as const;
}

/** Choose the most used currently reliable window; never imply a stale default is live. */
export function defaultQuota(quotas: readonly QuotaWindow[], now: number, staleAfterMs: number) {
  return quotas.filter(quota => !quotaState(quota, now, staleAfterMs).stale &&
    quotaState(quota, now, staleAfterMs).remaining !== null)
    .sort((a, b) => (b.usedPercent ?? 0) - (a.usedPercent ?? 0) ||
      JSON.stringify([a.owner, a.window, a.id]).localeCompare(JSON.stringify([b.owner, b.window, b.id])))[0];
}

export function runwayState(quota: QuotaWindow | undefined, now: number, staleAfterMs: number) {
  if (!quota) return { status: 'unavailable' as const, reason: 'noQuota' as const };
  if (!Number.isFinite(quota.resetAt) || quota.resetAt <= 0) return { status: 'unavailable' as const, reason: 'noReset' as const };
  if (quota.resetAt <= now) return { status: 'unavailable' as const, reason: 'reset' as const };
  const reading = quotaState(quota, now, staleAfterMs);
  if (reading.stale) return { status: 'unavailable' as const, reason: 'stale' as const };
  if (reading.remaining === null) return { status: 'unavailable' as const, reason: 'unknown' as const };
  const hoursUntilReset = (quota.resetAt - now) / 3_600_000;
  const projectedFullAt = quota.forecastStatus === 'ready' && quota.projectedFullAt != null &&
    Number.isFinite(quota.projectedFullAt) && quota.projectedFullAt > now ? quota.projectedFullAt : null;
  return {
    status: 'ready' as const,
    safePace: reading.remaining / hoursUntilReset,
    hoursUntilReset,
    projectedFullAt,
    projectedBeforeReset: projectedFullAt !== null && projectedFullAt < quota.resetAt,
    forecastStatus: quota.forecastStatus ?? 'insufficient',
  };
}

export function summarize(records: readonly UsageRecord[]) {
  return {
    tokens: records.reduce((sum, row) => sum + row.tokens, 0),
    sessions: new Set(records.map(row => row.session)).size,
    callRecords: records.filter(row => row.grain === 'call').length,
    aggregateRecords: records.filter(row => row.grain !== 'call').length,
    reportedCost: records.reduce((sum, row) => sum + (row.costSource === 'native' ? row.cost ?? 0 : 0), 0),
    apiValue: records.reduce((sum, row) => sum + (row.costSource === 'computed' || row.costSource === 'estimated' ? row.cost ?? 0 : 0), 0),
    unknownCostRecords: records.filter(row => row.cost === null || row.costSource === 'unknown').length,
  };
}

export type Dimension = 'project' | 'harness' | 'provider' | 'model';
export const dimensions: readonly Dimension[] = ['project', 'harness', 'provider', 'model'];
export type UsageSummary = ReturnType<typeof summarize> & { records: number };
export type UsageNode = UsageSummary & { key: string | null };
export interface RuntimeCoverage {
  inputTokens: number;
  cachedInputTokens: number;
  cacheWriteTokens: number;
  cacheSavingKnownUsd: number;
  cacheSavingKnownCalls: number;
  nativeCalls: number;
  computedCalls: number;
  estimatedCalls: number;
  unknownCalls: number;
}
export interface RuntimeGraph {
  totals: UsageSummary & RuntimeCoverage;
  nodes: Record<Dimension, Array<UsageNode & RuntimeCoverage>>;
  edges: Array<{ column: number; from: string | null; to: string | null; tokens: number }>;
  now: number;
}

export function groupUsage(records: readonly UsageRecord[], dimension: Dimension) {
  const groups = new Map<string | null, UsageRecord[]>();
  for (const record of records) {
    const key = record[dimension];
    const rows = groups.get(key) ?? [];
    rows.push(record);
    groups.set(key, rows);
  }
  return [...groups].map(([key, rows]) => ({ key, ...summarize(rows), records: rows.length }))
    .sort((a, b) => b.tokens - a.tokens || String(a.key).localeCompare(String(b.key)));
}

/** Only observed adjacent relationships are drawn, never a Cartesian product. */
export function runtimeEdges(records: readonly UsageRecord[]) {
  return dimensions.slice(0, -1).flatMap((dimension, column) => {
    const next = dimensions[column + 1];
    const edges = new Map<string, { column: number; from: string | null; to: string | null; tokens: number }>();
    for (const row of records) {
      const key = JSON.stringify([row[dimension], row[next]]);
      const edge = edges.get(key) ?? { column, from: row[dimension], to: row[next], tokens: 0 };
      edge.tokens += row.tokens;
      edges.set(key, edge);
    }
    return [...edges.values()];
  });
}
