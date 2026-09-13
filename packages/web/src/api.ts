const TOKEN =
  typeof window === 'undefined'
    ? ''
    : (window as unknown as { __QUOTAPULSE_TOKEN__?: string }).__QUOTAPULSE_TOKEN__ ?? '';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly path: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

const REQUEST_TIMEOUT_MS = 30_000;

async function request(path: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(path, {
      ...init,
      signal: init?.signal ?? controller.signal,
    });
    if (!res.ok) {
      throw new ApiError(res.status, path, `${res.status} ${res.statusText} on ${path}`);
    }
    return res;
  } finally {
    clearTimeout(timeout);
  }
}

async function get<T>(path: string): Promise<T> {
  const res = await request(path, { headers: TOKEN ? { 'x-quotapulse-token': TOKEN } : {} });
  return (await res.json()) as T;
}

async function post<T>(path: string): Promise<T> {
  const res = await request(path, {
    method: 'POST',
    headers: TOKEN ? { 'x-quotapulse-token': TOKEN } : {},
  });
  return (await res.json()) as T;
}

async function put<T>(path: string, body: unknown): Promise<T> {
  const res = await request(path, {
    method: 'PUT',
    headers: { 'content-type': 'application/json', ...(TOKEN ? { 'x-quotapulse-token': TOKEN } : {}) },
    body: JSON.stringify(body),
  });
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

export interface QuotaForecast {
  status: 'ready' | 'insufficient' | 'flat' | 'reset';
  samples: number;
  fromAt: number | null;
  toAt: number | null;
  percentPerHour: number | null;
  projectedFullAt: number | null;
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
  /** The quota entitlement shared by one or more auth-owned readers. */
  account_key: string | null;
  account_provider: string | null;
  account_display_name: string | null;
  subscription_key: string | null;
  subscription_provider: string | null;
  subscription_display_name: string | null;
  /** Since the harness last CONFIRMED this reading -- drives the staleness badge. */
  ageSeconds: number | null;
  /** Since the VALUE itself last changed. */
  valueAgeSeconds: number | null;
  last_seen_at: number;
  burn: Burn | null;
  forecast?: QuotaForecast;
}

export type AccountState = 'active' | 'stale' | 'inactive' | 'unavailable' | 'waiting';

export type QuotaFreshness = 'live' | 'recent' | 'stale' | 'unknown' | 'expired' | 'mixed';

export type QuotaTelemetryReason =
  | 'usage_newer_than_quota'
  | 'no_quota_observed'
  | 'cached_only'
  | 'reader_error'
  | null;

export interface QuotaWindowTelemetry {
  window_kind: string;
  freshness: QuotaFreshness;
  latest_quota_at: number | null;
  latest_source_fetched_at: number | null;
  latest_usage_at: number | null;
  gap: boolean;
  reason: QuotaTelemetryReason;
  origins: string[];
}

export interface QuotaTelemetry {
  freshness: QuotaFreshness;
  latest_quota_at: number | null;
  latest_source_fetched_at: number | null;
  latest_usage_at: number | null;
  gap: boolean;
  reason: QuotaTelemetryReason;
  origins: string[];
  windows: QuotaWindowTelemetry[];
}

export interface AccountStatus {
  account_key: string;
  provider: string;
  display_name: string;
  state: AccountState;
  reason: string | null;
  last_success_at: number | null;
  owners: Array<{ harness: string; profile: string }>;
}

/** Canonical subscription view; account fields remain on the API for compatibility. */
export interface SubscriptionStatus extends AccountStatus {
  subscription_key: string;
  subscription_display_name: string;
  linked_harness_keys: string[];
  telemetry: QuotaTelemetry;
}

export interface HarnessStatus {
  harness_key: string;
  parent_harness_key: string | null;
  harness: string;
  profile: string | null;
  display_name: string;
  vendor: string;
  source_ids: number[];
  subscription_keys: string[];
  delegate_keys: string[];
  detected: boolean;
  usage_attributed: boolean;
  calls: number;
  total_tokens: number;
  last_event_ts: number | null;
  limit_samples: number;
}

export interface SourceStatus {
  source_id: number;
  harness: string;
  profile: string;
  display_name: string;
  root_path: string;
  vendor: string;
  account_state: AccountState;
  calls: number;
  total_tokens: number;
  last_event_ts: number | null;
  last_limit_at: number | null;
  last_limit_source_fetched_at: number | null;
  last_limit_reset_at: number | null;
  limit_origins: string | null;
  /** 0 means no quota reading is available -- the harness may publish none or auth may be unavailable. */
  limit_samples: number;
  telemetry: QuotaTelemetry;
}

export interface Overview {
  now: number;
  today: Totals;
  week: Totals;
  allTime: Totals;
  bySourceToday: SourceTotals[];
  bySourceAll: SourceTotals[];
  limits: Limit[];
  subscriptions: SubscriptionStatus[];
  harnesses: HarnessStatus[];
  /** Legacy alias for clients that still call this Account quota. */
  accounts: AccountStatus[];
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
  cost_unknown_calls: number;
  cost_estimated_calls: number;
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
  cost_estimated_calls: number;
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
  cost_estimated_calls: number;
}

export interface CompareResult {
  current: Totals;
  previous: Totals;
  series: Array<{ series: string; current: Totals | null; previous: Totals | null }>;
}

export interface SessionEvent {
  ts: number;
  model: string | null;
  effort: string | null;
  input_tokens: number;
  cached_input_tokens: number;
  cache_write_tokens: number;
  output_tokens: number;
  reasoning_tokens: number;
  total_tokens: number;
  cost_usd: number | null;
  cost_source: 'known' | 'unknown' | 'estimated' | string;
  duration_ms: number | null;
}

export interface SessionDetail {
  session: SessionRow & Record<string, unknown>;
  events: SessionEvent[];
}

export interface AlertEvent {
  id: number;
  kind: 'threshold' | string;
  source_id: number;
  owner_key: string;
  window_kind: string;
  threshold: number;
  used_percent: number;
  resets_at: number | null;
  detected_at: number;
  delivered_at: number | null;
  display_name: string;
  subscription_display_name: string | null;
  origin: string;
}

export interface NotificationSettings {
  enabled: boolean;
  snooze_until: number | null;
  quiet_start: number | null;
  quiet_end: number | null;
  updated_at: number;
}

export interface PricingScope { from: number; to: number; sourceId?: number }
export interface PricingCoverage {
  from: number;
  to: number;
  source_id: number | null;
  sourceName: string | null;
  totals: Totals;
  models: Array<Totals & { model: string | null; provider: string | null; price_provider: string | null }>;
  hasHermes: boolean;
  catalog: { pricedModels: number; loadedAt: number | null; catalogAgeMs: number | null; catalogOwn: boolean; catalogPresent: boolean };
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

export interface ManualRefresh {
  now: number;
  pass: {
    newEvents: number;
    newLimits: number;
    durationMs: number;
    failedSources: number;
    trigger: 'manual';
  };
}

export const api = {
  pricingCoverage: (p: PricingScope) => get<PricingCoverage>(
    `/api/pricing/coverage?from=${p.from}&to=${p.to}` + (p.sourceId == null ? '' : `&source_id=${p.sourceId}`),
  ),
  overview: () => get<Overview>('/api/overview'),
  limits: () =>
    get<{
      now: number;
      limits: Limit[];
      subscriptions: SubscriptionStatus[];
      harnesses: HarnessStatus[];
      accounts: AccountStatus[];
    }>('/api/limits'),
  trend: (p: { bucket: 'hour' | 'day'; from: number; to: number; groupBy: string; sourceId?: number }) =>
    get<{ bucket: string; from: number; to: number; rows: TrendRow[] }>(
      `/api/trend?bucket=${p.bucket}&from=${p.from}&to=${p.to}&group_by=${p.groupBy}` +
        (p.sourceId == null ? '' : `&source_id=${p.sourceId}`),
    ),
  models: (since: number) => get<{ models: ModelRow[] }>(`/api/models?since=${since}`),
  projects: (p: { from: number; to: number; sourceId?: number }) =>
    get<{ from: number; to: number; rows: ProjectRow[] }>(
      `/api/projects?from=${p.from}&to=${p.to}` + (p.sourceId == null ? '' : `&source_id=${p.sourceId}`),
    ),
  sessions: (p: { limit: number; offset: number; vendor?: string; sourceId?: number; from?: number; to?: number }) =>
    get<{
      sessions: SessionRow[];
      total: number;
      vendors: Array<{ vendor: string; sessions: number }>;
      limit: number;
      offset: number;
    }>(
        `/api/sessions?limit=${p.limit}&offset=${p.offset}` +
        (p.vendor ? `&vendor=${encodeURIComponent(p.vendor)}` : '') +
        (p.sourceId == null ? '' : `&source_id=${p.sourceId}`) +
        (p.from == null ? '' : `&from=${p.from}`) +
        (p.to == null ? '' : `&to=${p.to}`),
  ),
  sessionDetail: (id: number) => get<SessionDetail>(`/api/sessions/${id}`),
  alerts: (p: { from?: number; to?: number; limit?: number; pending?: boolean } = {}) =>
    get<{ events: AlertEvent[] }>(
      `/api/alerts?limit=${p.limit ?? 100}` +
        (p.from == null ? '' : `&from=${p.from}`) +
        (p.to == null ? '' : `&to=${p.to}`) +
        (p.pending ? '&pending=1' : ''),
    ),
  notificationSettings: () => get<NotificationSettings>('/api/notification-settings'),
  updateNotificationSettings: (patch: Partial<NotificationSettings>) => put<NotificationSettings>('/api/notification-settings', patch),
  compare: (p: { from: number; to: number; previousFrom: number; previousTo: number; groupBy: string; sourceId?: number }) =>
    get<CompareResult>(
      `/api/compare?from=${p.from}&to=${p.to}&previous_from=${p.previousFrom}&previous_to=${p.previousTo}&group_by=${p.groupBy}` +
        (p.sourceId == null ? '' : `&source_id=${p.sourceId}`),
    ),
  health: () => get<Health>('/api/health'),
  refresh: () => post<ManualRefresh>('/api/refresh'),
};

/*
 * One EventSource for the whole page, fanned out to the refresh coordinator.
 *
 * This used to open a fresh connection per call, which was fine while the shell was the
 * only subscriber. It is not fine now that each section subscribes too: a browser allows
 * about six concurrent connections per origin over HTTP/1.1, and the daemon is HTTP/1.1,
 * so six permanently open streams would leave nothing for the fetches those same sections
 * make and the page would hang rather than fail.
 *
 * Ref counted: the stream opens on the first subscriber and closes on the last, so
 * switching tabs does not leave connections behind. State listeners expose the browser's
 * reconnect lifecycle without creating a second stream.
 */
const listeners = new Set<() => void>();
export type StreamState = 'connecting' | 'connected' | 'reconnecting';
const streamStateListeners = new Set<(state: StreamState) => void>();
let stream: EventSource | null = null;
let streamState: StreamState = 'connecting';

function setStreamState(next: StreamState): void {
  if (streamState === next) return;
  streamState = next;
  for (const listener of [...streamStateListeners]) listener(next);
}

function openStream(): void {
  const url = TOKEN
    ? `/api/events/stream?token=${encodeURIComponent(TOKEN)}`
    : '/api/events/stream';
  stream = new EventSource(url);
  setStreamState('connecting');
  stream.addEventListener('open', () => setStreamState('connected'));
  stream.addEventListener('error', () => setStreamState('reconnecting'));
  stream.addEventListener('data', () => {
    // Copied before iterating: a listener that unsubscribes itself while we are
    // notifying would otherwise mutate the set mid-loop.
    for (const fn of [...listeners]) fn();
  });
}

/** Subscribe to daemon pushes. Returns an unsubscribe function. */
export function subscribe(onData: () => void): () => void {
  listeners.add(onData);
  if (stream == null) {
    openStream();
  }
  return () => {
    listeners.delete(onData);
    if (listeners.size === 0 && stream != null) {
      stream.close();
      stream = null;
      setStreamState('connecting');
    }
  };
}

/** Subscribe to the transport state of the page-wide SSE stream. */
export function subscribeStreamStatus(onStatus: (state: StreamState) => void): () => void {
  streamStateListeners.add(onStatus);
  onStatus(streamState);
  return () => streamStateListeners.delete(onStatus);
}
