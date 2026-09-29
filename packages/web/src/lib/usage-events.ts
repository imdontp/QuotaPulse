export type UsageGrain = 'all' | 'call' | 'session_aggregate' | 'unknown';
export interface UsageEventScope {
  from: number;
  to: number;
  sourceId?: number;
  project?: string;
  projectMissing?: boolean;
  harness?: string;
  provider?: string;
  vendor?: string;
  model?: string;
  q?: string;
  grain?: UsageGrain;
}

/** One encoder for display and whole-range export; pagination is deliberately separate. */
export function usageEventParams(scope: UsageEventScope): URLSearchParams {
  const params = new URLSearchParams({ from: String(scope.from), to: String(scope.to) });
  if (scope.sourceId !== undefined) params.set('source_id', String(scope.sourceId));
  if (scope.projectMissing) params.set('project_missing', '1');
  for (const key of ['project', 'harness', 'provider', 'vendor', 'model', 'q', 'grain'] as const) {
    if (scope[key] !== undefined) params.set(key, scope[key]!);
  }
  return params;
}

export interface UsageEventRow {
  event_id: number;
  timestamp_ms: number;
  call_count: number;
  source_id: number;
  harness: string;
  profile: string;
  source_name: string;
  provider: string | null;
  vendor: string;
  model: string | null;
  effort: string | null;
  service_tier: string | null;
  project: string | null;
  session_key: number | null;
  is_subagent: number | null;
  input_tokens: number;
  cached_input_tokens: number;
  cache_write_tokens: number;
  output_tokens: number;
  reasoning_tokens: number;
  total_tokens: number;
  duration_ms: number | null;
  cost_usd: number | null;
  cost_input_usd: number | null;
  cost_cached_input_usd: number | null;
  cost_cache_write_usd: number | null;
  cost_output_usd: number | null;
  cost_cache_saving_usd: number | null;
  cost_source: string;
  price_provider: string | null;
  grain: Exclude<UsageGrain, 'all'>;
}

export interface UsageEventsResponse {
  rows: UsageEventRow[];
  total: number;
  limit: number;
  offset: number;
  scope: UsageEventScope;
  now: number;
}
