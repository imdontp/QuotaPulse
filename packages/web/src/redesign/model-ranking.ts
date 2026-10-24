export type ModelMetric = 'tokens' | 'calls' | 'api_value_usd';
export type ModelOrder = 'asc' | 'desc';
interface RankedModel {
  model: string | null;
  provider: string | null;
  tokens: number;
  calls: number;
  api_value_usd: number;
  computed_calls: number;
  estimated_calls: number;
}

/** Unknown prices stay last in either direction; partial values retain their recorded amount. */
export function compareModels(a: RankedModel, b: RankedModel, metric: ModelMetric, order: ModelOrder): number {
  const unknown = (row: RankedModel) => metric === 'api_value_usd' && row.calls > 0 && row.computed_calls + row.estimated_calls === 0;
  const missing = Number(unknown(a)) - Number(unknown(b));
  if (missing) return missing;
  const difference = unknown(a) ? 0 : a[metric] - b[metric];
  if (difference) return order === 'asc' ? difference : -difference;
  const key = (row: RankedModel) => JSON.stringify([row.model, row.provider]);
  return key(a).localeCompare(key(b));
}
