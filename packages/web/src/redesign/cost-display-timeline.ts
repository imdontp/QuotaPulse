import type { CostAnalysisResponse } from '@/api';

export const COST_DISPLAY_BUCKET_LIMIT = 240;
type TimelineData = Pick<CostAnalysisResponse, 'scope' | 'bucketMs' | 'points' | 'resolution'>;

/** Bound dense materialization even if a response predates server-side limits.
 * All supplied facts are summed into adjacent intervals under the original scope. */
export function costDisplayTimeline(data: TimelineData) {
  const span = data.scope.to - data.scope.from, base = data.bucketMs;
  if (!Number.isFinite(span) || span <= 0 || !Number.isFinite(base) || base <= 0) throw new Error('Invalid Cost chart interval');
  const bucketMs = base * Math.max(1, Math.ceil(span / base / COST_DISPLAY_BUCKET_LIMIT));
  const count = Math.ceil(span / bucketMs);
  const points = Array.from({ length: count }, (_, index) => ({ start: data.scope.from + index * bucketMs, amount: 0, pricedTokens: 0, allTokens: 0, pricedCalls: 0, allCalls: 0 }));
  for (const point of data.points) {
    const row = points[Math.floor((point.start - data.scope.from) / bucketMs)];
    if (!row || point.start >= data.scope.to) throw new Error('Cost chart point outside selected scope');
    row.amount += point.amount;row.pricedTokens += point.pricedTokens;row.allTokens += point.allTokens;row.pricedCalls += point.pricedCalls;row.allCalls += point.allCalls;
  }
  const requestedBucketMs = data.resolution?.requestedBucketMs ?? base;
  return { points, bucketMs, requestedBucketMs, adjusted: bucketMs > requestedBucketMs };
}

export function costIntervalLabel(milliseconds: number, language: 'en' | 'th') {
  const [unit, divisor] = milliseconds % 86400000 === 0 ? ['day', 86400000] as const
    : milliseconds % 3600000 === 0 ? ['hour', 3600000] as const : ['minute', 60000] as const;
  return new Intl.NumberFormat(language === 'th' ? 'th-TH' : 'en-US', { style: 'unit', unit, unitDisplay: 'long', maximumFractionDigits: 3 }).format(milliseconds / divisor);
}
