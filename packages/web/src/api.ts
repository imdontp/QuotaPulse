const TOKEN = (window as unknown as { __QUOTAPULSE_TOKEN__?: string }).__QUOTAPULSE_TOKEN__ ?? '';

async function get<T>(path: string): Promise<T> {
  const res = await fetch(path, { headers: TOKEN ? { 'x-quotapulse-token': TOKEN } : {} });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} on ${path}`);
  return (await res.json()) as T;
}

export interface Totals {
  calls: number;
  input_tokens: number;
  cached_input_tokens: number;
  cache_write_tokens: number;
  output_tokens: number;
  reasoning_tokens: number;
  total_tokens: number;
  cost_usd: number;
  /* The four components of cost_usd, plus what caching saved. Summed from per-call
     figures stored at ingest, so a later catalog change cannot rewrite them. */
  cost_input_usd: number;
  cost_cached_input_usd: number;
  cost_cache_write_usd: number;
  cost_output_usd: number;
  cost_cache_saving_usd: number;
  cost_unknown_calls: number;
  /** Priced from a provider we picked rather than the one the call went through. */
  cost_estimated_calls: number;
}

export interface SourceTotals extends Totals {
  source_id: number;
  harness: string;
  profile: string;
  display_name: string;
  vendor: string;
}

export interface Burn {
  percentPerHour: number;
  projectedFullAt: number | null;
  fromPercent: number;
  fromAt: number;
  samples: number;
}

export interface Limit {
  source_id: number;
  harness: string;
  profile: string;
  display_name: string;
  window_kind: string;
  used_percent: number | null;
  resets_at: number | null;
  severity: string | null;
  observed_at: number;
  source_fetched_at: number | null;
  origin: string;
  /** Since the harness last CONFIRMED this reading -- drives the staleness badge. */
  ageSeconds: number | null;
  /** Since the VALUE itself last changed. */
  valueAgeSeconds: number | null;
  last_seen_at: number;
  burn: Burn | null;
}

export interface SourceStatus {
  source_id: number;
  harness: string;
  profile: string;
  display_name: string;
  root_path: string;
  vendor: string;
  calls: number;
  total_tokens: number;
  last_event_ts: number | null;
  /** 0 means this harness publishes no quota at all -- not that we failed to read it. */
  limit_samples: number;
}

export interface Overview {
  now: number;
  today: Totals;
  week: Totals;
  allTime: Totals;
  bySourceToday: SourceTotals[];
  bySourceAll: SourceTotals[];
  limits: Limit[];
  sources: Array<{ id: number; harness: string; profile: string; display_name: string; root_path: string }>;
  sourceStatus: SourceStatus[];
  lastPass: { newEvents: number; newLimits: number; durationMs: number; trigger: string } | null;
}

export interface TrendRow {
  bucket_ts: number;
  series: string;
  calls: number;
  input_tokens: number;
  cached_input_tokens: number;
  cache_write_tokens: number;
  output_tokens: number;
  total_tokens: number;
  cost_usd: number;
}

export interface ModelRow extends Totals {
  model: string;
  harness: string;
  effort: string;
  /** Who MADE the model, derived server-side -- not the gateway that routed it. */
  vendor: string;
}

/** One (project, source, vendor, model) combination over the requested window. */
export interface ProjectRow {
  project: string;
  source_id: number;
  harness: string;
  display_name: string;
  /** Who MADE the model, derived server-side -- not the gateway that routed it. */
  vendor: string;
  /**
   * Whose product the HARNESS is, which is a different question: a Claude Code session
   * running a Qwen model has `harness_vendor: 'anthropic'` and `vendor: 'qwen'`.
   */
  harness_vendor: string;
  model: string;
  calls: number;
  input_tokens: number;
  cached_input_tokens: number;
  cache_write_tokens: number;
  output_tokens: number;
  reasoning_tokens: number;
  total_tokens: number;
  cost_usd: number;
  cost_unknown_calls: number;
  last_ts: number;
}

export interface SessionRow {
  id: number;
  native_session_id: string;
  project: string | null;
  cwd: string | null;
  git_branch: string | null;
  model_default: string | null;
  agent: string | null;
  started_at: number | null;
  last_seen_at: number | null;
  is_subagent: number;
  native_cost_usd: number | null;
  harness: string;
  profile: string;
  display_name: string;
  vendor: string;
  calls: number;
  total_tokens: number;
  cost_usd: number;
  cost_unknown_calls: number;
}

export interface Health {
  ok: boolean;
  now: number;
  pricedModels: number;
  scheduler: {
    sources: Array<{ harness: string; profile: string; sourceId: number; displayName: string; rootPath: string }>;
    lastPass: { newEvents: number; newLimits: number; durationMs: number; trigger: string } | null;
    running: boolean;
  };
  sources: Array<Record<string, number | string | null>>;
  coverage: Array<{
    harness: string;
    profile: string;
    sessions_with_native: number;
    native_cost: number;
    our_cost: number;
  }>;
  errors: Array<Record<string, unknown>>;
  unpriced: Array<{ model: string; calls: number; vendor: string }>;
  /** Calls priced from a provider we picked rather than the one they went through. */
  estimated: Array<{
    provider: string | null;
    price_provider: string | null;
    model: string;
    calls: number;
  }>;
  /** Where the price catalog came from, and how old it is. Null when there is none. */
  catalogPath: string | null;
  catalogAgeMs: number | null;
  /** True when it is the copy `npm run prices:refresh` writes, not a borrowed one. */
  catalogOwn: boolean;
}

export const api = {
  overview: () => get<Overview>('/api/overview'),
  limits: () => get<{ now: number; limits: Limit[] }>('/api/limits'),
  trend: (p: { bucket: 'hour' | 'day'; from: number; to: number; groupBy: string }) =>
    get<{ bucket: string; from: number; to: number; rows: TrendRow[] }>(
      `/api/trend?bucket=${p.bucket}&from=${p.from}&to=${p.to}&group_by=${p.groupBy}`,
    ),
  models: (since: number) => get<{ models: ModelRow[] }>(`/api/models?since=${since}`),
  projects: (p: { from: number; to: number }) =>
    get<{ from: number; to: number; rows: ProjectRow[] }>(
      `/api/projects?from=${p.from}&to=${p.to}`,
    ),
  sessions: (p: { limit: number; offset: number; vendor?: string }) =>
    get<{
      sessions: SessionRow[];
      total: number;
      vendors: Array<{ vendor: string; sessions: number }>;
      limit: number;
      offset: number;
    }>(
      `/api/sessions?limit=${p.limit}&offset=${p.offset}` +
        (p.vendor ? `&vendor=${encodeURIComponent(p.vendor)}` : ''),
    ),
  health: () => get<Health>('/api/health'),
};

/*
 * One EventSource for the whole page, fanned out to every listener.
 *
 * This used to open a fresh connection per call, which was fine while the shell was the
 * only subscriber. It is not fine now that each section subscribes too: a browser allows
 * about six concurrent connections per origin over HTTP/1.1, and the daemon is HTTP/1.1,
 * so six permanently open streams would leave nothing for the fetches those same sections
 * make and the page would hang rather than fail.
 *
 * Ref counted: the stream opens on the first subscriber and closes on the last, so
 * switching tabs does not leave connections behind.
 */
const listeners = new Set<() => void>();
let stream: EventSource | null = null;

/** Subscribe to daemon pushes. Returns an unsubscribe function. */
export function subscribe(onData: () => void): () => void {
  listeners.add(onData);
  if (stream == null) {
    const url = TOKEN
      ? `/api/events/stream?token=${encodeURIComponent(TOKEN)}`
      : '/api/events/stream';
    stream = new EventSource(url);
    stream.addEventListener('data', () => {
      // Copied before iterating: a listener that unsubscribes itself while we are
      // notifying would otherwise mutate the set mid-loop.
      for (const fn of [...listeners]) fn();
    });
  }
  return () => {
    listeners.delete(onData);
    if (listeners.size === 0 && stream != null) {
      stream.close();
      stream = null;
    }
  };
}
