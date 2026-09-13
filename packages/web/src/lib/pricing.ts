export interface ValueTotal {
  calls: number;
  cost_usd: number | null | undefined;
  cost_unknown_calls: number;
  cost_estimated_calls?: number;
}

export function pricingState(total: ValueTotal): 'empty' | 'unknown' | 'partial' | 'complete' {
  if (total.calls === 0) return 'empty';
  if (total.cost_unknown_calls >= total.calls || total.cost_usd == null) return 'unknown';
  return total.cost_unknown_calls > 0 ? 'partial' : 'complete';
}

export function formatValue(total: ValueTotal, money: (usd: number | null | undefined, unknown?: number) => string) {
  const state = pricingState(total);
  return state === 'empty' ? money(0) : state === 'unknown' ? '--' : money(total.cost_usd, total.cost_unknown_calls);
}

/** Missing prices create gaps; an actual priced zero is still a valid chart point. */
export function chartValue(total: ValueTotal): number | null {
  return pricingState(total) === 'unknown' ? null : (total.cost_usd ?? 0);
}

export function sumValues(rows: readonly ValueTotal[]): ValueTotal {
  return rows.reduce<ValueTotal>((total, row) => ({
    calls: total.calls + row.calls,
    cost_usd: (total.cost_usd ?? 0) + (row.cost_usd ?? 0),
    cost_unknown_calls: total.cost_unknown_calls + row.cost_unknown_calls,
    cost_estimated_calls: (total.cost_estimated_calls ?? 0) + (row.cost_estimated_calls ?? 0),
  }), { calls: 0, cost_usd: 0, cost_unknown_calls: 0, cost_estimated_calls: 0 });
}

/** Aggregate coverage along with money when several series fold into Other. */
export function foldPricingPoints(rows: Array<ValueTotal & { bucket_ts: number; series: string }>, rename: (name: string) => string) {
  const points = new Map<number, Record<string, ValueTotal>>();
  for (const row of rows) {
    const point = points.get(row.bucket_ts) ?? Object.create(null) as Record<string, ValueTotal>;
    const key = rename(row.series);
    const total = point[key] ?? { calls: 0, cost_usd: 0, cost_unknown_calls: 0, cost_estimated_calls: 0 };
    total.calls += row.calls;
    total.cost_usd = (total.cost_usd ?? 0) + (row.cost_usd ?? 0);
    total.cost_unknown_calls += row.cost_unknown_calls;
    total.cost_estimated_calls = (total.cost_estimated_calls ?? 0) + (row.cost_estimated_calls ?? 0);
    point[key] = total;
    points.set(row.bucket_ts, point);
  }
  return points;
}
