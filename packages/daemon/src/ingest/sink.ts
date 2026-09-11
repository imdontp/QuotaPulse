import type { DB } from '../db/index.js';
import type { AccountStateUpdate, LimitSample, SessionDim, Sink, UsageEvent } from '../adapters/types.js';
import type { PriceResolver, CostBreakdown } from '../pricing/resolve.js';
import { projectOf } from '../util/paths.js';

export interface SinkStats {
  usageSeen: number;
  usageInserted: number;
  limitsInserted: number;
  sessionsTouched: number;
  costNative: number;
  costComputed: number;
  costUnknown: number;
  unpricedModels: Set<string>;
  /**
   * Events written with no model at all. Counted separately from `unpricedModels`
   * because they are a different failure: an unpriced model is a gap in the catalog,
   * whereas a missing model means an adapter lost track of what it was reading, and
   * nothing downstream can price, group or attribute the call. This went unnoticed for
   * a day precisely because a null model was skipped by the line below.
   */
  modelless: number;
}

export function newStats(): SinkStats {
  return {
    usageSeen: 0,
    usageInserted: 0,
    limitsInserted: 0,
    sessionsTouched: 0,
    costNative: 0,
    costComputed: 0,
    costUnknown: 0,
    unpricedModels: new Set(),
    modelless: 0,
  };
}

/**
 * Writes normalized records for one source. All inserts are idempotent: usage rows
 * collide on (source_id, dedup_key) and limit samples on their observation identity,
 * so re-ingesting a file can never double-count.
 */
export class DbSink implements Sink {
  readonly stats = newStats();
  private sessionIds = new Map<string, number>();
  private insertUsage;
  private replaceUsage;
  private insertLimit;
  private latestLimit;
  private touchLimit;
  private updateAccountState;
  private upsertSession;
  private selectSession;

  constructor(
    private db: DB,
    private sourceId: number,
    private prices: PriceResolver,
  ) {
    this.insertUsage = db.prepare(
      `INSERT INTO usage_event (
         source_id, session_id, dedup_key, ts, call_count, model, provider, effort, service_tier,
         context_window, input_tokens, cached_input_tokens, cache_write_tokens,
         output_tokens, reasoning_tokens, total_tokens, cost_usd, cost_source,
         cost_input_usd, cost_cached_input_usd, cost_cache_write_usd, cost_output_usd,
         cost_cache_saving_usd, price_provider, duration_ms, request_id, native_msg_id
       ) VALUES (
         @sourceId, @sessionId, @dedupKey, @ts, @callCount, @model, @provider, @effort, @serviceTier,
         @contextWindow, @inputTokens, @cachedInputTokens, @cacheWriteTokens,
         @outputTokens, @reasoningTokens, @totalTokens, @costUsd, @costSource,
         @costInputUsd, @costCachedInputUsd, @costCacheWriteUsd, @costOutputUsd,
         @costCacheSavingUsd, @priceProvider, @durationMs, @requestId, @nativeMsgId
       )
       ON CONFLICT (source_id, dedup_key) DO NOTHING`,
    );

    // Aggregate-grain rows (see UsageEvent.replaceOnConflict) revise themselves.
    this.replaceUsage = db.prepare(
      `INSERT INTO usage_event (
         source_id, session_id, dedup_key, ts, call_count, model, provider, effort, service_tier,
         context_window, input_tokens, cached_input_tokens, cache_write_tokens,
         output_tokens, reasoning_tokens, total_tokens, cost_usd, cost_source,
         cost_input_usd, cost_cached_input_usd, cost_cache_write_usd, cost_output_usd,
         cost_cache_saving_usd, price_provider, duration_ms, request_id, native_msg_id
       ) VALUES (
         @sourceId, @sessionId, @dedupKey, @ts, @callCount, @model, @provider, @effort, @serviceTier,
         @contextWindow, @inputTokens, @cachedInputTokens, @cacheWriteTokens,
         @outputTokens, @reasoningTokens, @totalTokens, @costUsd, @costSource,
         @costInputUsd, @costCachedInputUsd, @costCacheWriteUsd, @costOutputUsd,
         @costCacheSavingUsd, @priceProvider, @durationMs, @requestId, @nativeMsgId
       )
       ON CONFLICT (source_id, dedup_key) DO UPDATE SET
         ts                  = excluded.ts,
         call_count          = excluded.call_count,
         model               = excluded.model,
         input_tokens        = excluded.input_tokens,
         cached_input_tokens = excluded.cached_input_tokens,
         cache_write_tokens  = excluded.cache_write_tokens,
         output_tokens       = excluded.output_tokens,
         reasoning_tokens    = excluded.reasoning_tokens,
         total_tokens        = excluded.total_tokens,
         cost_usd            = excluded.cost_usd,
         cost_source         = excluded.cost_source,
         cost_input_usd        = excluded.cost_input_usd,
         cost_cached_input_usd = excluded.cost_cached_input_usd,
         cost_cache_write_usd  = excluded.cost_cache_write_usd,
         cost_output_usd       = excluded.cost_output_usd,
         cost_cache_saving_usd = excluded.cost_cache_saving_usd,
         price_provider        = excluded.price_provider
       WHERE usage_event.total_tokens IS NOT excluded.total_tokens
          OR usage_event.output_tokens IS NOT excluded.output_tokens
          OR usage_event.call_count   IS NOT excluded.call_count
          OR usage_event.cost_usd     IS NOT excluded.cost_usd
          OR usage_event.ts           IS NOT excluded.ts`,
    );

    this.insertLimit = db.prepare(
      `INSERT INTO limit_sample (
         source_id, window_kind, used_percent, used_dollars, limit_dollars,
         resets_at, severity, observed_at, last_seen_at, source_fetched_at, origin
       ) VALUES (
         @sourceId, @windowKind, @usedPercent, @usedDollars, @limitDollars,
         @resetsAt, @severity, @observedAt, @observedAt, @sourceFetchedAt, @origin
       )
       ON CONFLICT (source_id, window_kind, observed_at, origin) DO NOTHING`,
    );

    // Latest recorded value for a gauge, used to decide insert-vs-heartbeat.
    this.latestLimit = db.prepare(
      `SELECT id, used_percent, used_dollars, resets_at FROM limit_sample
        WHERE source_id = ? AND window_kind = ? AND origin = ?
        ORDER BY observed_at DESC LIMIT 1`,
    );

    // The value has not moved: just record that the source is still reporting it.
    this.touchLimit = db.prepare(
      `UPDATE limit_sample SET last_seen_at = MAX(last_seen_at, @seenAt),
                               source_fetched_at = @sourceFetchedAt
        WHERE id = @id`,
    );

    this.updateAccountState = db.prepare(
      `UPDATE source
          SET account_state = @state,
              account_state_reason = @reason,
              account_last_success_at = CASE
                WHEN @state = 'active'
                  THEN MAX(COALESCE(account_last_success_at, 0), COALESCE(@observedAt, 0))
                ELSE account_last_success_at
              END
        WHERE id = @sourceId`,
    );

    this.upsertSession = db.prepare(
      `INSERT INTO session (
         source_id, native_session_id, cwd, project, git_branch, agent, model_default,
         started_at, ended_at, last_seen_at, is_subagent, parent_session_id,
         native_cost_usd, native_cost_at, native_lines_added, native_lines_removed, native_duration_ms
       ) VALUES (
         @sourceId, @nativeSessionId, @cwd, @project, @gitBranch, @agent, @modelDefault,
         @startedAt, @endedAt, @lastSeenAt, @isSubagent, @parentSessionId,
         @nativeCostUsd, @nativeCostAt, @nativeLinesAdded, @nativeLinesRemoved, @nativeDurationMs
       )
       ON CONFLICT (source_id, native_session_id) DO UPDATE SET
         cwd           = COALESCE(excluded.cwd, session.cwd),
         project       = COALESCE(excluded.project, session.project),
         git_branch    = COALESCE(excluded.git_branch, session.git_branch),
         agent         = COALESCE(excluded.agent, session.agent),
         model_default = COALESCE(excluded.model_default, session.model_default),
         started_at    = MIN(COALESCE(excluded.started_at, session.started_at),
                             COALESCE(session.started_at, excluded.started_at)),
         ended_at      = MAX(COALESCE(excluded.ended_at, session.ended_at),
                             COALESCE(session.ended_at, excluded.ended_at)),
         last_seen_at  = MAX(COALESCE(excluded.last_seen_at, session.last_seen_at),
                             COALESCE(session.last_seen_at, excluded.last_seen_at)),
         is_subagent   = MAX(session.is_subagent, excluded.is_subagent),
         -- keep the newest native cost snapshot; cost-state is appended repeatedly
         native_cost_usd      = CASE WHEN excluded.native_cost_at IS NOT NULL
                                      AND (session.native_cost_at IS NULL
                                           OR excluded.native_cost_at >= session.native_cost_at)
                                     THEN excluded.native_cost_usd ELSE session.native_cost_usd END,
         native_cost_at       = MAX(COALESCE(excluded.native_cost_at, session.native_cost_at),
                                    COALESCE(session.native_cost_at, excluded.native_cost_at)),
         native_lines_added   = COALESCE(excluded.native_lines_added, session.native_lines_added),
         native_lines_removed = COALESCE(excluded.native_lines_removed, session.native_lines_removed),
         native_duration_ms   = COALESCE(excluded.native_duration_ms, session.native_duration_ms)`,
    );

    this.selectSession = db.prepare(
      `SELECT id FROM session WHERE source_id = ? AND native_session_id = ?`,
    );
  }

  session(d: SessionDim): void {
    this.stats.sessionsTouched++;
    this.upsertSession.run({
      sourceId: this.sourceId,
      nativeSessionId: d.nativeSessionId,
      cwd: d.cwd ?? null,
      project: d.project ?? projectOf(d.cwd) ?? null,
      gitBranch: d.gitBranch ?? null,
      agent: d.agent ?? null,
      modelDefault: d.modelDefault ?? null,
      startedAt: d.startedAt ?? null,
      endedAt: d.endedAt ?? null,
      lastSeenAt: d.lastSeenAt ?? null,
      isSubagent: d.isSubagent ? 1 : 0,
      parentSessionId: d.parentSessionId ?? null,
      nativeCostUsd: d.nativeCostUsd ?? null,
      nativeCostAt: d.nativeCostAt ?? null,
      nativeLinesAdded: d.nativeLinesAdded ?? null,
      nativeLinesRemoved: d.nativeLinesRemoved ?? null,
      nativeDurationMs: d.nativeDurationMs ?? null,
    });
    this.sessionIds.delete(d.nativeSessionId);
  }

  private resolveSessionId(nativeId: string | null | undefined): number | null {
    if (!nativeId) return null;
    const cached = this.sessionIds.get(nativeId);
    if (cached !== undefined) return cached;

    let row = this.selectSession.get(this.sourceId, nativeId) as { id: number } | undefined;
    if (!row) {
      // A usage event can arrive before its session record; create a stub to hang it on.
      this.upsertSession.run({
        sourceId: this.sourceId,
        nativeSessionId: nativeId,
        cwd: null,
        project: null,
        gitBranch: null,
        agent: null,
        modelDefault: null,
        startedAt: null,
        endedAt: null,
        lastSeenAt: null,
        isSubagent: 0,
        parentSessionId: null,
        nativeCostUsd: null,
        nativeCostAt: null,
        nativeLinesAdded: null,
        nativeLinesRemoved: null,
        nativeDurationMs: null,
      });
      row = this.selectSession.get(this.sourceId, nativeId) as { id: number };
    }
    this.sessionIds.set(nativeId, row.id);
    return row.id;
  }

  usage(e: UsageEvent): void {
    this.stats.usageSeen++;

    const inputTokens = e.inputTokens ?? 0;
    const cachedInputTokens = e.cachedInputTokens ?? 0;
    const cacheWriteTokens = e.cacheWriteTokens ?? 0;
    const outputTokens = e.outputTokens ?? 0;
    const reasoningTokens = e.reasoningTokens ?? 0;
    // reasoning is a subset of output and is deliberately NOT added again.
    const totalTokens = inputTokens + cachedInputTokens + cacheWriteTokens + outputTokens;

    let costUsd: number | null;
    let costSource: 'native' | 'computed' | 'estimated' | 'unknown';
    let breakdown: CostBreakdown | null = null;

    if (e.costSource === 'native' && e.costUsd != null) {
      costUsd = e.costUsd;
      costSource = 'native';
      this.stats.costNative++;
    } else {
      const computed = this.prices.cost(e.model, e.provider, {
        inputTokens,
        cachedInputTokens,
        cacheWriteTokens,
        outputTokens,
      });
      if (computed == null) {
        costUsd = null;
        costSource = 'unknown';
        this.stats.costUnknown++;
        if (e.model) this.stats.unpricedModels.add(e.model);
        else this.stats.modelless++;
      } else {
        costUsd = computed.usd;
        breakdown = computed;
        /*
         * `estimated` when the price belongs to a provider this resolver picked rather
         * than the one the call actually went through. Same arithmetic, weaker claim --
         * and the dashboard says so, instead of letting a guess pass for a measurement.
         */
        costSource = computed.match === 'exact' ? 'computed' : 'estimated';
        this.stats.costComputed++;
      }
    }

    const stmt = e.replaceOnConflict ? this.replaceUsage : this.insertUsage;
    const info = stmt.run({
      sourceId: this.sourceId,
      sessionId: this.resolveSessionId(e.nativeSessionId),
      dedupKey: e.dedupKey,
      ts: e.ts,
      callCount: Math.max(1, Math.round(e.callCount ?? 1)),
      model: e.model ?? null,
      provider: e.provider ?? null,
      costInputUsd: breakdown?.inputUsd ?? null,
      costCachedInputUsd: breakdown?.cachedInputUsd ?? null,
      costCacheWriteUsd: breakdown?.cacheWriteUsd ?? null,
      costOutputUsd: breakdown?.outputUsd ?? null,
      costCacheSavingUsd:
        breakdown == null
          ? null
          : this.prices.cacheSaving(e.model, e.provider, cachedInputTokens),
      priceProvider: breakdown?.priceProvider ?? null,
      effort: e.effort ?? null,
      serviceTier: e.serviceTier ?? null,
      contextWindow: e.contextWindow ?? null,
      inputTokens,
      cachedInputTokens,
      cacheWriteTokens,
      outputTokens,
      reasoningTokens,
      totalTokens,
      costUsd,
      costSource,
      durationMs: e.durationMs ?? null,
      requestId: e.requestId ?? null,
      nativeMsgId: e.nativeMsgId ?? null,
    });
    if (info.changes > 0) this.stats.usageInserted++;
  }

  accountState(s: AccountStateUpdate): void {
    this.updateAccountState.run({
      sourceId: this.sourceId,
      state: s.state,
      reason: s.reason ?? null,
      observedAt: s.observedAt ?? null,
    });
  }

  limit(s: LimitSample): void {
    // A successfully read quota sample is the strongest evidence that the account is
    // currently usable. This also lets account readers and harness readers converge on
    // one state without each adapter having to repeat the same bookkeeping.
    this.accountState({
      state: 'active',
      reason: null,
      observedAt: s.sourceFetchedAt ?? s.observedAt,
    });

    const prev = this.latestLimit.get(this.sourceId, s.windowKind, s.origin) as
      | { id: number; used_percent: number | null; used_dollars: number | null; resets_at: number | null }
      | undefined;

    const same =
      prev != null &&
      (prev.used_percent ?? null) === (s.usedPercent ?? null) &&
      (prev.used_dollars ?? null) === (s.usedDollars ?? null) &&
      (prev.resets_at ?? null) === (s.resetsAt ?? null);

    if (same) {
      // Unchanged reading: refresh liveness only. Not counted as new data, so a
      // statusline rewriting the same percentage every 5s does not wake the dashboard.
      this.touchLimit.run({
        id: prev.id,
        seenAt: s.observedAt,
        sourceFetchedAt: s.sourceFetchedAt ?? s.observedAt,
      });
      return;
    }

    const info = this.insertLimit.run({
      sourceId: this.sourceId,
      windowKind: s.windowKind,
      usedPercent: s.usedPercent ?? null,
      usedDollars: s.usedDollars ?? null,
      limitDollars: s.limitDollars ?? null,
      resetsAt: s.resetsAt ?? null,
      severity: s.severity ?? null,
      observedAt: s.observedAt,
      sourceFetchedAt: s.sourceFetchedAt ?? null,
      origin: s.origin,
    });
    if (info.changes > 0) this.stats.limitsInserted++;
  }
}
