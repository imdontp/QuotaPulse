export interface ComparisonUsage {
  total_tokens: number;
  input_tokens: number;
  cached_input_tokens: number;
  cache_write_tokens: number;
}

export function relativeChangePercent(current: number | null | undefined, previous: number | null | undefined): number | null {
  if (current == null || previous == null || !Number.isFinite(current) || !Number.isFinite(previous) || current < 0 || previous <= 0) return null;
  return (current - previous) / previous * 100;
}

export function cacheSharePercent(usage: Pick<ComparisonUsage, 'input_tokens' | 'cached_input_tokens' | 'cache_write_tokens'>): number | null {
  const { input_tokens: input, cached_input_tokens: cached, cache_write_tokens: writes } = usage;
  if (![input, cached, writes].every(Number.isFinite) || input < 0 || cached < 0 || writes < 0) return null;
  const total = input + cached + writes;
  return total > 0 ? cached / total * 100 : null;
}

export function percentagePointChange(current: number | null, previous: number | null): number | null {
  return current == null || previous == null || !Number.isFinite(current) || !Number.isFinite(previous)
    ? null : current - previous;
}

export function paceAboveSafePercent(measured: number | null, safe: number | null): number | null {
  return relativeChangePercent(measured, safe);
}

export function supportedForecastPace(
  status: 'ready' | 'insufficient' | 'flat' | 'reset' | null | undefined,
  pace: number | null | undefined,
): number | null {
  if ((status !== 'ready' && status !== 'flat') || pace == null || !Number.isFinite(pace) || pace < 0) return null;
  return pace;
}

export type RecommendationKind = 'fresh-reading' | 'reduce-load' | 'slow-down' | 'use-cache' | 'check-pricing' | 'monitor';

export function recommendationKind(input: {
  stale: boolean;
  projectedBeforeReset: boolean;
  risk: 'normal' | 'warning' | 'critical' | 'unknown';
  cacheShare: number | null;
  pricingState: 'unavailable' | 'partial' | 'complete';
}): RecommendationKind {
  if (input.stale || input.risk === 'unknown') return 'fresh-reading';
  if (input.projectedBeforeReset) return 'reduce-load';
  if (input.risk === 'critical' || input.risk === 'warning') return 'slow-down';
  if (input.cacheShare !== null && input.cacheShare < 20) return 'use-cache';
  if (input.pricingState === 'partial') return 'check-pricing';
  return 'monitor';
}
