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
  owner: string;
  window: string;
  usedPercent: number | null;
  observedAt: number;
  resetAt: number;
}

export function quotaState(quota: QuotaWindow, now: number, staleAfterMs: number) {
  const stale = !Number.isFinite(quota.observedAt) || quota.observedAt > now ||
    now - quota.observedAt > staleAfterMs || !Number.isFinite(quota.resetAt) || quota.resetAt <= now;
  const used = quota.usedPercent;
  const known = used !== null && Number.isFinite(used) && used >= 0 && used <= 100;
  return {
    stale,
    remaining: known ? 100 - used : null,
    risk: stale || !known ? 'unknown' : used >= 95 ? 'critical' : used >= 80 ? 'warning' : 'normal',
  } as const;
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

export function groupUsage(records: readonly UsageRecord[], dimension: Dimension) {
  const groups = new Map<string | null, UsageRecord[]>();
  for (const record of records) {
    const key = record[dimension];
    const rows = groups.get(key) ?? [];
    rows.push(record);
    groups.set(key, rows);
  }
  return [...groups].map(([key, rows]) => ({ key, ...summarize(rows) }))
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
