/**
 * Canonical token convention (verified against every v1 harness on 2026-09-02):
 *
 *   input_tokens        fresh input, EXCLUDES anything served from or written to cache
 *   cached_input_tokens input served from cache (cache read)
 *   cache_write_tokens  input written into cache (cache creation)
 *   output_tokens       ALL output, INCLUDING reasoning/thinking
 *   reasoning_tokens    informational subset of output_tokens -- never added to a total
 *   total_tokens        input + cached + cache_write + output
 *
 * Adapters are responsible for converting into this shape; see docs/DATA-SOURCES.md
 * for the per-harness arithmetic proof (Codex folds cache into input, OpenCode keeps
 * reasoning outside output -- both are corrected on ingest).
 */
export const SCHEMA_VERSION = 7;

export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS source (
  id           INTEGER PRIMARY KEY,
  harness      TEXT    NOT NULL,
  profile      TEXT    NOT NULL,
  root_path    TEXT    NOT NULL,
  display_name TEXT    NOT NULL,
  enabled      INTEGER NOT NULL DEFAULT 1,
  detected_at  INTEGER NOT NULL,
  UNIQUE (harness, profile)
);

CREATE TABLE IF NOT EXISTS session (
  id                INTEGER PRIMARY KEY,
  source_id         INTEGER NOT NULL REFERENCES source(id),
  native_session_id TEXT    NOT NULL,
  cwd               TEXT,
  project           TEXT,
  git_branch        TEXT,
  agent             TEXT,
  model_default     TEXT,
  started_at        INTEGER,
  ended_at          INTEGER,
  last_seen_at      INTEGER,
  is_subagent       INTEGER NOT NULL DEFAULT 0,
  parent_session_id TEXT,
  -- Cost/effort the harness computed for itself. Claude's cost-state is strictly more
  -- complete than its transcript (it also covers background title/summary calls that
  -- are never written as assistant records), so we keep it beside our own tally and
  -- report the coverage ratio in /api/health instead of pretending they are the same.
  native_cost_usd    REAL,
  native_cost_at     INTEGER,
  native_lines_added INTEGER,
  native_lines_removed INTEGER,
  native_duration_ms INTEGER,
  UNIQUE (source_id, native_session_id)
);
CREATE INDEX IF NOT EXISTS idx_session_last_seen ON session(last_seen_at DESC);
CREATE INDEX IF NOT EXISTS idx_session_project   ON session(project);

-- Fact table: one row per API call, already deduplicated.
CREATE TABLE IF NOT EXISTS usage_event (
  id                  INTEGER PRIMARY KEY,
  source_id           INTEGER NOT NULL REFERENCES source(id),
  session_id          INTEGER REFERENCES session(id),
  dedup_key           TEXT    NOT NULL,
  ts                  INTEGER NOT NULL,
  model               TEXT,
  provider            TEXT,
  effort              TEXT,
  service_tier        TEXT,
  context_window      INTEGER,
  input_tokens        INTEGER NOT NULL DEFAULT 0,
  cached_input_tokens INTEGER NOT NULL DEFAULT 0,
  cache_write_tokens  INTEGER NOT NULL DEFAULT 0,
  output_tokens       INTEGER NOT NULL DEFAULT 0,
  reasoning_tokens    INTEGER NOT NULL DEFAULT 0,
  total_tokens        INTEGER NOT NULL DEFAULT 0,
  cost_usd            REAL,
  -- The four components of cost_usd, stored rather than derived: a later catalog update
  -- must not silently rewrite what a past call cost. Their sum IS cost_usd.
  cost_input_usd        REAL,
  cost_cached_input_usd REAL,
  cost_cache_write_usd  REAL,
  cost_output_usd       REAL,
  -- What the cache reads would have cost at the full input rate, minus what they did.
  -- Stored because deriving it later needs the rate, which lives only in the catalog and
  -- changes; the saving a call actually earned does not.
  cost_cache_saving_usd REAL,
  -- Whose price was used. Differs from the provider column exactly when cost_source is
  -- 'estimated', which is the whole point of storing it.
  price_provider        TEXT,
  cost_source         TEXT    NOT NULL DEFAULT 'unknown',
  duration_ms         INTEGER,
  request_id          TEXT,
  native_msg_id       TEXT,
  UNIQUE (source_id, dedup_key)
);
CREATE INDEX IF NOT EXISTS idx_usage_ts        ON usage_event(ts DESC);
CREATE INDEX IF NOT EXISTS idx_usage_source_ts ON usage_event(source_id, ts DESC);
CREATE INDEX IF NOT EXISTS idx_usage_model_ts  ON usage_event(model, ts DESC);
CREATE INDEX IF NOT EXISTS idx_usage_session   ON usage_event(session_id);

-- Quota gauges. Sampled on a different cadence from usage, hence a separate table.
--
-- Two timestamps, because a source republishing an unchanged value is information of a
-- different kind from the value changing. observed_at is when this VALUE first
-- appeared -- it is what the time series and the burn-rate calculation read.
-- last_seen_at is the most recent moment the source confirmed it, which is what the
-- staleness badge reads. Collapsing them into one row per distinct value cuts ~89% of
-- rows (a live statusline rewrites the same percentage every 5s) without making a
-- still-live gauge look stale or compressing the span a burn rate is measured over.
CREATE TABLE IF NOT EXISTS limit_sample (
  id                INTEGER PRIMARY KEY,
  source_id         INTEGER NOT NULL REFERENCES source(id),
  window_kind       TEXT    NOT NULL,
  used_percent      REAL,
  used_dollars      REAL,
  limit_dollars     REAL,
  resets_at         INTEGER,
  severity          TEXT,
  observed_at       INTEGER NOT NULL,
  last_seen_at      INTEGER NOT NULL,
  source_fetched_at INTEGER,
  origin            TEXT    NOT NULL,
  UNIQUE (source_id, window_kind, observed_at, origin)
);
CREATE INDEX IF NOT EXISTS idx_limit_latest ON limit_sample(source_id, window_kind, origin, observed_at DESC);

-- Incremental ingest cursors. This is what makes ~700 MB of transcripts tractable.
CREATE TABLE IF NOT EXISTS ingest_state (
  source_id   INTEGER NOT NULL REFERENCES source(id),
  target_key  TEXT    NOT NULL,
  kind        TEXT    NOT NULL,
  byte_offset INTEGER NOT NULL DEFAULT 0,
  file_size   INTEGER NOT NULL DEFAULT 0,
  file_mtime  INTEGER NOT NULL DEFAULT 0,
  watermark   INTEGER NOT NULL DEFAULT 0,
  -- JSON: adapter state that has to survive between incremental passes. See Cursor.meta.
  meta        TEXT,
  last_ok_at  INTEGER,
  last_error  TEXT,
  error_count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (source_id, target_key)
);

CREATE TABLE IF NOT EXISTS price (
  model               TEXT NOT NULL,
  provider            TEXT NOT NULL,
  input_per_1m        REAL,
  cached_input_per_1m REAL,
  cache_write_per_1m  REAL,
  output_per_1m       REAL,
  context_window      INTEGER,
  origin              TEXT NOT NULL,
  updated_at          INTEGER NOT NULL,
  PRIMARY KEY (provider, model)
);
CREATE INDEX IF NOT EXISTS idx_price_model ON price(model);

CREATE TABLE IF NOT EXISTS rollup_hourly (
  bucket_ts        INTEGER NOT NULL,
  source_id        INTEGER NOT NULL REFERENCES source(id),
  model            TEXT    NOT NULL DEFAULT '',
  project          TEXT    NOT NULL DEFAULT '',
  calls            INTEGER NOT NULL DEFAULT 0,
  input_tokens     INTEGER NOT NULL DEFAULT 0,
  cached_tokens    INTEGER NOT NULL DEFAULT 0,
  cache_write      INTEGER NOT NULL DEFAULT 0,
  output_tokens    INTEGER NOT NULL DEFAULT 0,
  reasoning_tokens INTEGER NOT NULL DEFAULT 0,
  total_tokens     INTEGER NOT NULL DEFAULT 0,
  cost_usd         REAL    NOT NULL DEFAULT 0,
  cost_known_calls INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (bucket_ts, source_id, model, project)
);
CREATE INDEX IF NOT EXISTS idx_rollup_hourly_ts ON rollup_hourly(bucket_ts DESC);
`;
