import type { ModelRowTrendsResponse } from '@/api';

export const modelPairKey = (pair: { model: string | null; provider: string | null }) => JSON.stringify([pair.model, pair.provider]);
/** An absent pair is unavailable; a present pair with no records is no history, never invented zero. */
export function modelRowTrend(data: ModelRowTrendsResponse | null, pair: { model: string | null; provider: string | null }) {
  const series = data?.pairs?.find(value => modelPairKey(value) === modelPairKey(pair));
  if (!data || !series || !Number.isFinite(data.bucketMs) || data.bucketMs <= 0) return null;
  if (!series.points.some(point => point.records > 0)) return [];
  const recorded = new Map(series.points.map(point => [point.start, point.tokens]));
  return Array.from({ length: Math.ceil((data.scope.to - data.scope.from) / data.bucketMs) }, (_, index) => {
    const at = data.scope.from + index * data.bucketMs;
    return { at, value: recorded.get(at) ?? 0 };
  });
}
