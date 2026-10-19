import type { ModelRowTrendsResponse } from '@/api';

export const modelPairKey = (pair: { model: string | null; provider: string | null }) => JSON.stringify([pair.model, pair.provider]);
/** Decorative series identity only: never a quality, health or capability category.
 * Hash the typed tuple rather than rank so sorting, paging and accepted refreshes retain its tone. */
export function modelRowTrendTone(pair: { model: string | null; provider: string | null }) {
  const identity = modelPairKey(pair);
  let hash = 0x811c9dc5;
  for (let index = 0; index < identity.length; index++) {
    hash = Math.imul(hash ^ identity.charCodeAt(index), 0x01000193) >>> 0;
  }
  return (['blue', 'violet', 'orange', 'cyan', 'rose'] as const)[hash % 5];
}

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
