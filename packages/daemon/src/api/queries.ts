import type { DB } from '../db/index.js';
import { harnessVendorSqlCase, vendorSqlCase } from '../util/vendor.js';
import { statSync } from 'node:fs';
import { findCatalog } from '../pricing/loader.js';
import { DATA_DIR } from '../util/paths.js';

export interface SourceRow {
  id: number;
  harness: string;
  profile: string;
  display_name: string;
  root_path: string;
}

export const listSources = (db: DB): SourceRow[] =>
  db
    .prepare(`SELECT id, harness, profile, display_name, root_path FROM source WHERE enabled = 1`)
    .all() as SourceRow[];

export interface Totals {
  calls: number;
  input_tokens: number;
  cached_input_tokens: number;
  cache_write_tokens: number;
  output_tokens: number;
  reasoning_tokens: number;
  total_tokens: number;
  cost_usd: number;
  /* The four components of cost_usd, plus what caching saved. Summed from stored
     per-call figures, never re-derived from a rate that may since have changed. */
  cost_input_usd: number;
  cost_cached_input_usd: number;
  cost_cache_write_usd: number;
  cost_output_usd: number;
  cost_cache_saving_usd: number;
  cost_unknown_calls: number;
  /** Priced from a provider we picked rather than the one the call went through. */
  cost_estimated_calls: number;
}

/**
 * The one measure list every rollup shares. Generated with an optional table alias
 * because a query that joins `session` has to qualify these columns, and a hand-copied
 * second version is exactly how two rollups of "the same" numbers drift apart.
 */
const totalsSelect = (a = '') => `
  COUNT(*)                                             AS calls,
  COALESCE(SUM(${a}input_tokens),0)                        AS input_tokens,
  COALESCE(SUM(${a}cached_input_tokens),0)                 AS cached_input_tokens,
  COALESCE(SUM(${a}cache_write_tokens),0)                  AS cache_write_tokens,
  COALESCE(SUM(${a}output_tokens),0)                       AS output_tokens,
  COALESCE(SUM(${a}reasoning_tokens),0)                    AS reasoning_tokens,
  COALESCE(SUM(${a}total_tokens),0)                        AS total_tokens,
  COALESCE(SUM(${a}cost_usd),0)                            AS cost_usd,
  COALESCE(SUM(${a}cost_input_usd),0)                      AS cost_input_usd,
  COALESCE(SUM(${a}cost_cached_input_usd),0)               AS cost_cached_input_usd,
  COALESCE(SUM(${a}cost_cache_write_usd),0)                AS cost_cache_write_usd,
  COALESCE(SUM(${a}cost_output_usd),0)                     AS cost_output_usd,
  COALESCE(SUM(${a}cost_cache_saving_usd),0)               AS cost_cache_saving_usd,
  COALESCE(SUM(CASE WHEN ${a}cost_source='unknown' THEN 1 ELSE 0 END),0) AS cost_unknown_calls,
  COALESCE(SUM(CASE WHEN ${a}cost_source='estimated' THEN 1 ELSE 0 END),0) AS cost_estimated_calls`;

const TOTALS_SELECT = totalsSelect();

export const totalsSince = (db: DB, sinceMs: number, sourceId?: number): Totals =>
  db
    .prepare(
      `SELECT ${TOTALS_SELECT} FROM usage_event
        WHERE ts >= ? ${sourceId ? 'AND source_id = ?' : ''}`,
    )
    .get(...(sourceId ? [sinceMs, sourceId] : [sinceMs])) as Totals;

export const totalsBySource = (db: DB, sinceMs: number) =>
  db
    .prepare(
      `SELECT s.id AS source_id, s.harness, s.profile, s.display_name,
              ${harnessVendorSqlCase('s.harness')} AS vendor,
              ${TOTALS_SELECT}
         FROM usage_event u JOIN source s ON s.id = u.source_id
        WHERE u.ts >= ?
        GROUP BY s.id ORDER BY total_tokens DESC`,
    )
    .all(sinceMs) as Array<
      Totals & { source_id: number; harness: string; profile: string; display_name: string; vendor: string }
    >;

/**
 * Every source worth a card on Live with its lifetime footprint, whether or not it publishes
 * quota: the ones detected on this machine right now, plus any that once recorded usage and
 * still contribute to every total elsewhere. A source that is gone AND never recorded
 * anything is dropped -- there is nothing true to say about it.
 * The Live page needs this to prove a harness is being tracked: OpenCode and Hermes
 * publish no quota at all, so a quota-driven list leaves them invisible.
 */
export const sourceStatus = (db: DB) =>
  db
    .prepare(
      `SELECT s.id AS source_id, s.harness, s.profile, s.display_name, s.root_path,
              ${harnessVendorSqlCase('s.harness')} AS vendor,
              (SELECT COUNT(*)      FROM usage_event u WHERE u.source_id = s.id) AS calls,
              (SELECT COALESCE(SUM(u.total_tokens),0) FROM usage_event u WHERE u.source_id = s.id) AS total_tokens,
              (SELECT MAX(u.ts)     FROM usage_event u WHERE u.source_id = s.id) AS last_event_ts,
              (SELECT COUNT(*)      FROM limit_sample l WHERE l.source_id = s.id) AS limit_samples
         FROM source s
        WHERE s.enabled = 1
           OR EXISTS (SELECT 1 FROM usage_event u WHERE u.source_id = s.id)
        ORDER BY total_tokens DESC`,
    )
    .all() as Array<{
      source_id: number;
      harness: string;
      profile: string;
      display_name: string;
      root_path: string;
      vendor: string;
      calls: number;
      total_tokens: number;
      last_event_ts: number | null;
      limit_samples: number;
    }>;

export interface LimitRow {
  source_id: number;
  harness: string;
  profile: string;
  display_name: string;
  window_kind: string;
  used_percent: number | null;
  resets_at: number | null;
  severity: string | null;
  observed_at: number;
  last_seen_at: number;
  source_fetched_at: number | null;
  origin: string;
}

/**
 * Latest sample per (source, window, origin). Origin is part of the key on purpose:
 * a source can publish the same window through a live feed and a stale fallback, and
 * collapsing them would hide which number the reader is actually looking at.
 */
export const latestLimits = (db: DB): LimitRow[] =>
  db
    .prepare(
      `SELECT l.source_id, s.harness, s.profile, s.display_name, l.window_kind,
              l.used_percent, l.resets_at, l.severity, l.observed_at, l.last_seen_at,
              l.source_fetched_at, l.origin
         FROM limit_sample l
         JOIN source s ON s.id = l.source_id
         JOIN (SELECT source_id, window_kind, origin, MAX(observed_at) AS mx
                 FROM limit_sample GROUP BY source_id, window_kind, origin) t
           ON t.source_id = l.source_id AND t.window_kind = l.window_kind
          AND t.origin = l.origin AND t.mx = l.observed_at
        ORDER BY s.harness, s.profile, l.window_kind`,
    )
    .all() as LimitRow[];

export interface BurnRate {
  percentPerHour: number;
  projectedFullAt: number | null;
  fromPercent: number;
  fromAt: number;
  samples: number;
}

/**
 * Burn rate from the provider's OWN percentage deltas, measured only within the
 * current window period (same resets_at). Comparing across a reset would read the
 * drop back to zero as negative burn.
 */
export function burnRate(db: DB, sourceId: number, windowKind: string, origin: string): BurnRate | null {
  // Both endpoints use observed_at (when the VALUE appeared). Using last_seen_at would
  // compress the measured span whenever a source keeps confirming an unchanged reading.
  const latest = db
    .prepare(
      `SELECT used_percent, resets_at, observed_at FROM limit_sample
        WHERE source_id = ? AND window_kind = ? AND origin = ? AND used_percent IS NOT NULL
        ORDER BY observed_at DESC LIMIT 1`,
    )
    .get(sourceId, windowKind, origin) as
    | { used_percent: number; resets_at: number | null; observed_at: number }
    | undefined;
  if (!latest) return null;

  const earlier = db
    .prepare(
      `SELECT used_percent, observed_at, COUNT(*) OVER () AS n FROM limit_sample
        WHERE source_id = ? AND window_kind = ? AND origin = ? AND used_percent IS NOT NULL
          AND observed_at < ?
          AND ((resets_at IS NULL AND ? IS NULL) OR resets_at = ?)
        ORDER BY observed_at ASC LIMIT 1`,
    )
    .get(sourceId, windowKind, origin, latest.observed_at, latest.resets_at, latest.resets_at) as
    | { used_percent: number; observed_at: number; n: number }
    | undefined;
  if (!earlier) return null;

  const hours = (latest.observed_at - earlier.observed_at) / 3_600_000;
  if (hours <= 0.01) return null;

  const percentPerHour = (latest.used_percent - earlier.used_percent) / hours;
  const remaining = 100 - latest.used_percent;
  const projectedFullAt =
    percentPerHour > 0.01 ? Date.now() + (remaining / percentPerHour) * 3_600_000 : null;

  return {
    percentPerHour,
    projectedFullAt,
    fromPercent: earlier.used_percent,
    fromAt: earlier.observed_at,
    samples: earlier.n,
  };
}

export type Bucket = 'hour' | 'day';
export type GroupBy = 'harness' | 'model' | 'vendor' | 'project' | 'none';

/**
 * Bucketed time series straight off the fact table. No pre-aggregation: SQLite groups
 * tens of thousands of indexed rows in single-digit milliseconds, and a materialized
 * rollup would be one more thing to keep correct for no measurable gain at this size.
 */
export function trend(
  db: DB,
  opts: { from: number; to: number; bucket: Bucket; groupBy: GroupBy; sourceId?: number },
) {
  const size = opts.bucket === 'hour' ? 3_600_000 : 86_400_000;
  const groupExpr =
    opts.groupBy === 'harness'
      ? `s.harness || '/' || s.profile`
      : opts.groupBy === 'model'
        ? `COALESCE(u.model,'(unknown)')`
        : opts.groupBy === 'vendor'
        ? vendorSqlCase('u.model', 'u.provider')
        : opts.groupBy === 'project'
          ? `COALESCE(sess.project,'(none)')`
          // A named series, not '': an empty name renders as a legend chip with no
          // label and an unlabelled tooltip row, which reads as broken data even
          // though the totals are identical to every other grouping.
          : `'all'`;

  return db
    .prepare(
      `SELECT (u.ts / ${size}) * ${size} AS bucket_ts,
              ${groupExpr}                AS series,
              COUNT(*)                    AS calls,
              COALESCE(SUM(u.input_tokens),0)        AS input_tokens,
              COALESCE(SUM(u.cached_input_tokens),0) AS cached_input_tokens,
              COALESCE(SUM(u.cache_write_tokens),0)  AS cache_write_tokens,
              COALESCE(SUM(u.output_tokens),0)       AS output_tokens,
              COALESCE(SUM(u.total_tokens),0)        AS total_tokens,
              COALESCE(SUM(u.cost_usd),0)            AS cost_usd
         FROM usage_event u
         JOIN source s ON s.id = u.source_id
         LEFT JOIN session sess ON sess.id = u.session_id
        WHERE u.ts >= @from AND u.ts < @to
          ${opts.sourceId ? 'AND u.source_id = @sourceId' : ''}
        GROUP BY bucket_ts, series
        ORDER BY bucket_ts ASC`,
    )
    .all({ from: opts.from, to: opts.to, sourceId: opts.sourceId ?? null }) as Array<{
    bucket_ts: number;
    series: string;
    calls: number;
    input_tokens: number;
    cached_input_tokens: number;
    cache_write_tokens: number;
    output_tokens: number;
    total_tokens: number;
    cost_usd: number;
  }>;
}

export const modelBreakdown = (db: DB, sinceMs: number) =>
  db
    .prepare(
      `SELECT COALESCE(u.model,'(unknown)') AS model,
              s.harness, COALESCE(u.effort,'') AS effort,
              ${vendorSqlCase('u.model', 'u.provider')} AS vendor,
              ${TOTALS_SELECT}
         FROM usage_event u JOIN source s ON s.id = u.source_id
        WHERE u.ts >= ?
        GROUP BY u.model, s.harness, u.effort, vendor
        ORDER BY total_tokens DESC`,
    )
    .all(sinceMs) as Array<Totals & { model: string; harness: string; effort: string; vendor: string }>;

export interface ProjectRow extends Totals {
  project: string;
  source_id: number;
  harness: string;
  display_name: string;
  vendor: string;
  model: string;
  last_ts: number;
}

/**
 * Usage cut by (project, source, vendor, model) over a window.
 *
 * `project` lives on `session`, never on `usage_event`, so this is the only rollup that
 * has to reach across the join -- and `session_id` is nullable (an event can arrive
 * before the record that describes its session), hence LEFT JOIN and a named bucket
 * rather than dropping those rows silently. Both sides of the join are indexed
 * (`idx_usage_session`, `idx_session_project`).
 *
 * Four dimensions in one result rather than four endpoints: the client folds it into
 * whichever cut is on screen, the same way the Models page folds `modelBreakdown`. The
 * row count is bounded by the combinations actually observed, which is in the hundreds
 * here, not the product of the cardinalities.
 *
 * `cost_unknown_calls` rides along because a page that shows money must be able to tell
 * "nothing was spent" from "we have no price for this", and print a dash for the second.
 */
export const projectBreakdown = (db: DB, opts: { from: number; to: number }) =>
  db
    .prepare(
      `SELECT COALESCE(sess.project,'(none)') AS project,
              u.source_id, s.harness, s.display_name,
              ${vendorSqlCase('u.model', 'u.provider')} AS vendor,
              ${harnessVendorSqlCase('s.harness')} AS harness_vendor,
              COALESCE(u.model,'(unknown)') AS model,
              ${totalsSelect('u.')},
              MAX(u.ts) AS last_ts
         FROM usage_event u
         JOIN source s ON s.id = u.source_id
         LEFT JOIN session sess ON sess.id = u.session_id
        WHERE u.ts >= @from AND u.ts < @to
        GROUP BY project, u.source_id, vendor, model
        ORDER BY total_tokens DESC`,
    )
    .all({ from: opts.from, to: opts.to }) as ProjectRow[];

export interface SessionQuery {
  limit: number;
  offset: number;
  sourceId?: number;
  /** Vendor ids to keep. Empty or omitted means every vendor. */
  vendors?: string[];
}

/**
 * Vendor filtering keys off `session.model_default`, which is the model the session
 * mostly ran on -- and is exactly the model whose logo the row displays, so the filter
 * always agrees with what the reader sees. A session that switched models mid-way is
 * therefore judged by its main one.
 */
function sessionWhere(opts: SessionQuery): string {
  const parts = ['1=1'];
  if (opts.sourceId) parts.push('sess.source_id = @sourceId');
  if (opts.vendors?.length) {
    const list = opts.vendors.map((v) => `'${v.replace(/'/g, "''")}'`).join(', ');
    parts.push(`${vendorSqlCase('sess.model_default', "''")} IN (${list})`);
  }
  return parts.join(' AND ');
}

export const sessionList = (db: DB, opts: SessionQuery) =>
  db
    .prepare(
      `SELECT sess.id, sess.native_session_id, sess.project, sess.cwd, sess.git_branch,
              sess.model_default, sess.agent, sess.started_at, sess.last_seen_at,
              sess.is_subagent, sess.native_cost_usd,
              s.harness, s.profile, s.display_name,
              ${vendorSqlCase('sess.model_default', "''")} AS vendor,
              COUNT(u.id)                            AS calls,
              COALESCE(SUM(u.total_tokens),0)        AS total_tokens,
              COALESCE(SUM(u.cost_usd),0)            AS cost_usd,
              COALESCE(SUM(CASE WHEN u.cost_source='unknown' THEN 1 ELSE 0 END),0) AS cost_unknown_calls
         FROM session sess
         JOIN source s ON s.id = sess.source_id
         LEFT JOIN usage_event u ON u.session_id = sess.id
        WHERE ${sessionWhere(opts)}
        GROUP BY sess.id
       HAVING calls > 0
        ORDER BY sess.last_seen_at DESC
        LIMIT @limit OFFSET @offset`,
    )
    .all({ limit: opts.limit, offset: opts.offset, sourceId: opts.sourceId ?? null });

/**
 * How many sessions the same filter matches, so the page control can say "1-50 of 457"
 * instead of leaving the reader to guess whether there is a next page.
 * Mirrors sessionList's WHERE and its `HAVING calls > 0`.
 */
export const sessionCount = (db: DB, opts: Omit<SessionQuery, 'limit' | 'offset'>): number =>
  Number(
    (
      db
        .prepare(
          `SELECT COUNT(*) AS n FROM (
             SELECT sess.id
               FROM session sess
               JOIN source s ON s.id = sess.source_id
               LEFT JOIN usage_event u ON u.session_id = sess.id
              WHERE ${sessionWhere({ ...opts, limit: 0, offset: 0 })}
              GROUP BY sess.id
             HAVING COUNT(u.id) > 0
           )`,
        )
        .get({ sourceId: opts.sourceId ?? null }) as { n: number }
    ).n,
  );

/** Vendors present across sessions, for the filter chips. */
export const sessionVendors = (db: DB) =>
  db
    .prepare(
      `SELECT ${vendorSqlCase('sess.model_default', "''")} AS vendor,
              COUNT(DISTINCT sess.id) AS sessions
         FROM session sess
         JOIN usage_event u ON u.session_id = sess.id
        GROUP BY vendor ORDER BY sessions DESC`,
    )
    .all() as Array<{ vendor: string; sessions: number }>;

export const sessionDetail = (db: DB, id: number) => {
  const head = db
    .prepare(
      `SELECT sess.*, s.harness, s.profile, s.display_name
         FROM session sess JOIN source s ON s.id = sess.source_id WHERE sess.id = ?`,
    )
    .get(id);
  if (!head) return null;
  const events = db
    .prepare(
      `SELECT ts, model, effort, input_tokens, cached_input_tokens, cache_write_tokens,
              output_tokens, reasoning_tokens, total_tokens, cost_usd, cost_source, duration_ms
         FROM usage_event WHERE session_id = ? ORDER BY ts ASC LIMIT 2000`,
    )
    .all(id);
  return { session: head, events };
};

/** Per-source ingest health: cursors, errors, lag, and coverage against native cost. */
export const health = (db: DB) => {
  const sources = db
    .prepare(
      `SELECT s.id AS source_id, s.harness, s.profile, s.display_name, s.root_path,
              (SELECT COUNT(*) FROM ingest_state i WHERE i.source_id = s.id)  AS targets,
              (SELECT COUNT(*) FROM ingest_state i WHERE i.source_id = s.id
                 AND i.last_error IS NOT NULL)                                AS targets_with_error,
              (SELECT MAX(i.last_ok_at) FROM ingest_state i WHERE i.source_id = s.id) AS last_ok_at,
              (SELECT COUNT(*) FROM usage_event u WHERE u.source_id = s.id)   AS events,
              (SELECT MAX(u.ts) FROM usage_event u WHERE u.source_id = s.id)  AS newest_event_ts,
              (SELECT MIN(u.ts) FROM usage_event u WHERE u.source_id = s.id)  AS oldest_event_ts
         FROM source s WHERE s.enabled = 1 ORDER BY s.harness, s.profile`,
    )
    .all() as Array<Record<string, number | string | null>>;

  // Coverage: our transcript-derived cost vs the harness's own figure, for the
  // sessions where the harness publishes one. Below ~90% means we are missing calls.
  const coverage = db
    .prepare(
      `SELECT s.harness, s.profile,
              COUNT(*)                          AS sessions_with_native,
              COALESCE(SUM(sess.native_cost_usd),0) AS native_cost,
              COALESCE(SUM((SELECT COALESCE(SUM(u.cost_usd),0)
                              FROM usage_event u WHERE u.session_id = sess.id)),0) AS our_cost
         FROM session sess JOIN source s ON s.id = sess.source_id
        WHERE sess.native_cost_usd IS NOT NULL
        GROUP BY s.id`,
    )
    .all() as Array<{ harness: string; profile: string; sessions_with_native: number; native_cost: number; our_cost: number }>;

  const errors = db
    .prepare(
      /*
       * Active sources only, matching the adapters table above. A harness that has been
       * uninstalled is disabled rather than deleted, and its last failure would
       * otherwise sit on this card forever -- an error about something that is no
       * longer being read, next to an adapters table that no longer lists it.
       */
      `SELECT s.harness, s.profile, i.target_key, i.last_error, i.error_count
         FROM ingest_state i JOIN source s ON s.id = i.source_id
        WHERE i.last_error IS NOT NULL AND s.enabled = 1
        ORDER BY i.error_count DESC LIMIT 20`,
    )
    .all();

  const priced = db.prepare(`SELECT COUNT(*) AS n FROM price`).get() as { n: number };
  const unpriced = db
    .prepare(
      `SELECT COALESCE(model,'(null)') AS model, COUNT(*) AS calls,
              ${vendorSqlCase('model', 'provider')} AS vendor
         FROM usage_event WHERE cost_source = 'unknown'
        GROUP BY model, vendor ORDER BY calls DESC LIMIT 15`,
    )
    .all();

  /*
   * Where the prices came from and how old they are. Every quota reading on this
   * dashboard carries its age; the catalog behind every money figure should too, and a
   * second-hand copy that stopped being refreshed is otherwise invisible.
   */
  const catalogPath = findCatalog();
  let catalogAgeMs: number | null = null;
  let catalogOwn = false;
  if (catalogPath) {
    catalogOwn = catalogPath.startsWith(DATA_DIR);
    try {
      catalogAgeMs = Date.now() - statSync(catalogPath).mtimeMs;
    } catch {
      /* the file went away between the find and the stat; age stays unknown */
    }
  }

  const estimated = db
    .prepare(
      `SELECT provider, price_provider, COALESCE(model,'(null)') AS model, COUNT(*) AS calls
         FROM usage_event WHERE cost_source = 'estimated'
        GROUP BY provider, price_provider, model ORDER BY calls DESC LIMIT 15`,
    )
    .all();

  return {
    sources,
    coverage,
    errors,
    pricedModels: priced.n,
    unpriced,
    estimated,
    catalogPath,
    catalogAgeMs,
    catalogOwn,
  };
};
