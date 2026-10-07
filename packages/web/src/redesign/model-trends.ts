import type { DetailedModelResponse } from '@/api';

/** Fill unobserved count bins, but never turn missing price coverage into known zero. */
export function modelTrendBuckets(data: Pick<DetailedModelResponse, 'scope' | 'trends'>) {
  if (!data.trends || data.trends.bucketMs <= 0) return [];
  const { bucketMs, points } = data.trends;
  const recorded = new Map(points.map(point => [point.start, point]));
  return Array.from({ length: Math.ceil((data.scope.to - data.scope.from) / bucketMs) }, (_, index) => {
    const start = data.scope.from + index * bucketMs;
    const point = recorded.get(start) ?? { start, tokens: 0, calls: 0, sessions: 0, pairs: 0, api_value_usd: 0, api_priced_calls: 0 };
    return { ...point, apiValue: point.api_priced_calls > 0 ? point.api_value_usd : null };
  });
}

/** The displayed provider facts and histories use the same currently filtered scope. */
export function modelProviderTrends(data: Pick<DetailedModelResponse, 'scope' | 'trends'> & { groups: ReadonlyArray<Pick<DetailedModelResponse['groups'][number], 'provider' | 'tokens'>> }) {
  const usage = new Map<string | null, { tokens: number; pairs: number }>();
  for (const group of data.groups) {
    const value = usage.get(group.provider) ?? { tokens: 0, pairs: 0 };
    value.tokens += group.tokens;
    value.pairs++;
    usage.set(group.provider, value);
  }
  const buckets = modelTrendBuckets(data);
  return [...usage.entries()].sort((a, b) => b[1].tokens - a[1].tokens || JSON.stringify(a[0]).localeCompare(JSON.stringify(b[0])))
    .map(([provider, facts]) => {
      const recorded = new Map(data.trends?.providers.filter(point => point.provider === provider).map(point => [point.start, point.tokens]) ?? []);
      return { provider, ...facts, points: buckets.map(point => ({ at: point.start, value: recorded.get(point.start) ?? 0 })) };
    });
}
