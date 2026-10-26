import type { CostAnalysisResponse } from '@/api';

type Point = CostAnalysisResponse['points'][number];
export interface CostSummaryPoint {
  at: number;
  value: number | null;
  pricedCalls: number;
  allCalls: number;
}

/** The caller supplies the selected basis and resolved, zero-filled reporting scope.
 * Unknown price intervals break the amount line. Cumulative values remain known
 * lower bounds with their original call-weighted coverage; never mix in other bases. */
export function costSummaryTrends(points: readonly Point[], scope: { from: number; to: number }, bucketMs: number, asOf: number) {
  const amount: CostSummaryPoint[] = [], average: CostSummaryPoint[] = [], perThousand: CostSummaryPoint[] = [];
  let value = 0, tokens = 0, pricedCalls = 0, allCalls = 0;
  for (const point of points) {
    value += point.amount;
    tokens += point.pricedTokens;
    pricedCalls += point.pricedCalls;
    allCalls += point.allCalls;
    const at = Math.min(scope.to, point.start + bucketMs);
    const days = (at - scope.from) / 86_400_000;
    const coverage = { at, pricedCalls, allCalls };
    const known = pricedCalls > 0 || allCalls === 0;
    amount.push({ at: point.start, value: point.pricedCalls > 0 || point.allCalls === 0 ? point.amount : null, pricedCalls: point.pricedCalls, allCalls: point.allCalls });
    average.push({ ...coverage, value: known && days >= 1 && scope.to <= asOf + 1 ? value / days : null });
    perThousand.push({ ...coverage, value: tokens > 0 ? value / tokens * 1000 : null });
  }
  return { amount, average, perThousand };
}
