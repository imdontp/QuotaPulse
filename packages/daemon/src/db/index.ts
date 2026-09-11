import Database from 'better-sqlite3';
import { copyFileSync, existsSync, mkdirSync, renameSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { DATA_DIR, DB_PATH, LEGACY_DATA_DIRS, projectOf } from '../util/paths.js';
import { SCHEMA_SQL, SCHEMA_VERSION } from './schema.js';
import { logger } from '../util/log.js';
import type { AccountIdentity } from '../adapters/types.js';

const log = logger('db');
export type DB = Database.Database;

let handle: DB | null = null;

/**
 * The project has been renamed twice (usage-trend to plimsoll to QuotaPulse), and each
 * rename moves the state directory. Carry the existing database across rather than
 * starting empty: months of history is not re-derivable once a harness has pruned its own
 * transcripts, and silently showing an empty dashboard would look exactly like a bug in
 * the collector.
 *
 * LEGACY_DATA_DIRS is ordered newest first and the first hit wins, so a machine that has
 * both directories adopts the plimsoll one and leaves the older usage-trend copy alone.
 */
function adoptLegacyDataDir(): void {
  if (existsSync(DATA_DIR)) return;
  const legacy = LEGACY_DATA_DIRS.find((dir) => existsSync(dir));
  if (!legacy) return;
  try {
    renameSync(legacy, DATA_DIR);
    log.info(`moved existing data from ${legacy} to ${DATA_DIR}`);
  } catch (err) {
    // A cross-volume move (or a lock) fails the rename; copy the database instead.
    log.warn(`could not move ${legacy}, copying instead`, (err as Error).message);
    mkdirSync(DATA_DIR, { recursive: true });
    for (const f of ['usage.db', 'usage.db-wal', 'usage.db-shm']) {
      const from = join(legacy, f);
      if (existsSync(from)) copyFileSync(from, join(DATA_DIR, f));
    }
    log.info(`copied existing data to ${DATA_DIR}; ${legacy} left in place`);
  }
}

/**
 * The default database is memoized so the whole daemon shares one connection. An
 * explicit path always opens a fresh handle, which is what tests and one-off tools need.
 */
export function openDb(path = DB_PATH): DB {
  const isDefault = path === DB_PATH;
  if (isDefault && handle) return handle;
  if (isDefault) adoptLegacyDataDir();
  mkdirSync(dirname(path), { recursive: true });
  const db = new Database(path);
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  // The daemon and the CLI tools are separate writers on the same file. Without this a
  // concurrent write fails instantly with SQLITE_BUSY instead of waiting its turn.
  db.pragma('busy_timeout = 8000');
  db.pragma('foreign_keys = ON');
  db.exec(SCHEMA_SQL);

  migrate(db);

  if (isDefault) handle = db;
  log.info(`opened ${path}`);
  return db;
}

/*
 * Schema evolution is split in two on purpose.
 *
 * REPAIRS are cheap, structural, and run on EVERY startup. They inspect the real schema
 * rather than trusting the version stamp, because the stamp can run ahead of reality --
 * a hot reload picking up a bumped constant before the code that earns it will record a
 * version the database has not actually reached. Repairs make that self-healing.
 *
 * MIGRATIONS are one-time data transformations and are version-gated, because they are
 * expensive and re-running them every start would be both slow and a source of lock
 * contention at exactly the moment another process may hold the database.
 *
 * Neither rebuilds from scratch: the harnesses prune their own history (Gemini at 30
 * days, Claude drops old transcripts), so anything discarded may be unrecoverable.
 */
const REPAIRS: Array<{ name: string; run: (db: DB) => void }> = [
  {
    name: 'source.account_metadata',
    run: (db) => {
      const cols = new Set(
        (db.prepare(`PRAGMA table_info(source)`).all() as Array<{ name: string }>).map(
          (c) => c.name,
        ),
      );
      const wanted: Array<[string, string]> = [
        ['source_kind', "TEXT NOT NULL DEFAULT 'harness'"],
        ['account_key', 'TEXT'],
        ['account_provider', 'TEXT'],
        ['account_display_name', 'TEXT'],
        ['account_state', "TEXT NOT NULL DEFAULT 'waiting'"],
        ['account_state_reason', 'TEXT'],
        ['account_last_success_at', 'INTEGER'],
      ];
      for (const [name, type] of wanted) {
        if (!cols.has(name)) db.exec(`ALTER TABLE source ADD COLUMN ${name} ${type}`);
      }
      db.exec(`CREATE INDEX IF NOT EXISTS idx_source_account_key ON source(account_key)`);
    },
  },
  {
    /*
     * The cost breakdown columns and the provider a price came from.
     *
     * A repair rather than a migration on purpose: migrations run once and are then
     * skipped forever, so adding a column to one that has already been applied is a
     * no-op that surfaces later as "no such column" at runtime. Repairs run every open
     * and check first, which is what an additive column actually needs.
     *
     * Filling them needs the catalog, so that lives in `reclassifyCosts`, which runs
     * after prices are loaded.
     */
    name: 'usage_event.cost_breakdown',
    run: (db) => {
      const cols = new Set(
        (db.prepare(`PRAGMA table_info(usage_event)`).all() as Array<{ name: string }>).map(
          (c) => c.name,
        ),
      );
      const wanted: Array<[string, string]> = [
        ['cost_input_usd', 'REAL'],
        ['cost_cached_input_usd', 'REAL'],
        ['cost_cache_write_usd', 'REAL'],
        ['cost_output_usd', 'REAL'],
        ['cost_cache_saving_usd', 'REAL'],
        ['price_provider', 'TEXT'],
      ];
      for (const [name, type] of wanted) {
        if (!cols.has(name)) db.exec(`ALTER TABLE usage_event ADD COLUMN ${name} ${type}`);
      }
    },
  },
  {
    name: 'usage_event.call_count',
    run: (db) => {
      const cols = new Set(
        (db.prepare(`PRAGMA table_info(usage_event)`).all() as Array<{ name: string }>).map(
          (c) => c.name,
        ),
      );
      if (!cols.has('call_count')) {
        db.exec(`ALTER TABLE usage_event ADD COLUMN call_count INTEGER NOT NULL DEFAULT 1`);
        log.info('repaired: added usage_event.call_count');
      }
    },
  },
  {
    name: 'limit_sample.last_seen_at',
    run: (db) => {
      const cols = db.prepare(`PRAGMA table_info(limit_sample)`).all() as Array<{ name: string }>;
      if (!cols.some((c) => c.name === 'last_seen_at')) {
        db.exec(`ALTER TABLE limit_sample ADD COLUMN last_seen_at INTEGER NOT NULL DEFAULT 0`);
        log.info('repaired: added limit_sample.last_seen_at');
      }
      // Rows written before the column existed had one row per observation,
      // so first-seen and last-seen are the same instant.
      db.exec(`UPDATE limit_sample SET last_seen_at = observed_at WHERE last_seen_at = 0`);
    },
  },
  {
    name: 'ingest_state.meta',
    run: (db) => {
      const cols = db.prepare(`PRAGMA table_info(ingest_state)`).all() as Array<{ name: string }>;
      if (!cols.some((c) => c.name === 'meta')) {
        db.exec(`ALTER TABLE ingest_state ADD COLUMN meta TEXT`);
        log.info('repaired: added ingest_state.meta');
      }
      // A null meta is the correct starting state: the adapter simply re-learns the
      // carried-over fields from the next line that publishes them.
    },
  },
  {
    name: 'session.project',
    /*
     * The cwd is authoritative for the project name; anything else is a guess.
     *
     * Claude's per-session folder is the cwd with separators AND literal characters both
     * flattened to '-', so decoding it splits "usage-trend" into "trend". That guess is
     * only meant to cover a transcript with no cwd at all, but a pass that happened to
     * carry no cwd used to fall through to it and overwrite a correct name. A repair
     * rather than a migration because it must undo any such write, not just the ones
     * that existed at one version -- and it is cheap: it only touches rows that disagree.
     */
    run: (db) => {
      const rows = db
        .prepare(`SELECT id, cwd, project FROM session WHERE cwd IS NOT NULL`)
        .all() as Array<{ id: number; cwd: string; project: string | null }>;
      const update = db.prepare(`UPDATE session SET project = ? WHERE id = ?`);
      let fixed = 0;
      for (const r of rows) {
        const derived = projectOf(r.cwd);
        if (derived && derived !== r.project) {
          update.run(derived, r.id);
          fixed++;
        }
      }
      if (fixed > 0) log.info(`repaired: project name re-derived from cwd for ${fixed} sessions`);
    },
  },
];

const MIGRATIONS: Array<{ to: number; run: (db: DB) => void }> = [
  {
    to: 3,
    // Collapse runs of an unchanged reading into a single row spanning first-seen to
    // last-seen. Pre-v2 rows were written once per observation, so a live statusline
    // rewriting the same percentage every 5s left ~83% redundant rows. A value that
    // changes away and later returns stays a separate run: that is a real event.
    run: (db) => {
      const before = (db.prepare(`SELECT COUNT(*) c FROM limit_sample`).get() as { c: number }).c;
      if (before === 0) return;
      db.exec(`
        CREATE TEMP TABLE IF NOT EXISTS keepers AS
        WITH marked AS (
          SELECT id, source_id, window_kind, origin, observed_at, last_seen_at,
                 CASE WHEN LAG(used_percent) OVER w IS NOT used_percent
                        OR LAG(used_dollars) OVER w IS NOT used_dollars
                        OR LAG(resets_at)    OVER w IS NOT resets_at
                      THEN 1 ELSE 0 END AS is_new
            FROM limit_sample
          WINDOW w AS (PARTITION BY source_id, window_kind, origin ORDER BY observed_at, id)
        ), grouped AS (
          SELECT *, SUM(is_new) OVER (PARTITION BY source_id, window_kind, origin
                                      ORDER BY observed_at, id) AS run_id
            FROM marked
        )
        SELECT (SELECT g2.id FROM grouped g2
                 WHERE g2.source_id = g.source_id AND g2.window_kind = g.window_kind
                   AND g2.origin = g.origin AND g2.run_id = g.run_id
                 ORDER BY g2.observed_at, g2.id LIMIT 1) AS keep_id,
               MAX(g.last_seen_at) AS last_at
          FROM grouped g
         GROUP BY g.source_id, g.window_kind, g.origin, g.run_id;

        UPDATE limit_sample
           SET last_seen_at = (SELECT last_at FROM keepers k WHERE k.keep_id = limit_sample.id)
         WHERE id IN (SELECT keep_id FROM keepers);

        DELETE FROM limit_sample WHERE id NOT IN (SELECT keep_id FROM keepers);
        DROP TABLE keepers;
      `);
      const after = (db.prepare(`SELECT COUNT(*) c FROM limit_sample`).get() as { c: number }).c;
      if (after < before) {
        log.info(`compacted limit_sample ${before} -> ${after} rows`);
      }
    },
  },
  {
    to: 4,
    /*
     * Re-derive session.project from cwd. `projectOf` used to split on forward slashes
     * only, so every Windows cwd stored its FULL PATH as the project name -- which then
     * showed up as an unreadable label in the Sessions table and as one series per
     * directory when grouping a trend by project. Recomputed here rather than left for
     * new rows, because these sessions are historical and will never be rewritten.
     */
    run: (db) => {
      const rows = db
        .prepare(`SELECT id, cwd, project FROM session WHERE cwd IS NOT NULL`)
        .all() as Array<{ id: number; cwd: string; project: string | null }>;
      const update = db.prepare(`UPDATE session SET project = ? WHERE id = ?`);
      let fixed = 0;
      for (const r of rows) {
        const derived = projectOf(r.cwd);
        if (derived && derived !== r.project) {
          update.run(derived, r.id);
          fixed++;
        }
      }
      if (fixed > 0) log.info(`re-derived project name for ${fixed} sessions`);
    },
  },
  {
    to: 5,
    /*
     * Recover the model on events the Codex adapter wrote without one.
     *
     * `model` was a per-pass variable set only when a delta happened to contain the
     * `turn_context` line that names it, so every call ingested by a tail-only pass
     * landed with model NULL -- and a null model short-circuits pricing, so those calls
     * were also left unpriced. The adapter now carries the value across passes; this
     * repairs what it already lost.
     *
     * The session dimension survived, because its upsert COALESCEs each field: a pass
     * that knew no model wrote NULL and kept whatever was there. So the owning session
     * still holds the answer, and for a Codex session the model in force is a property
     * of the session's current turn -- exactly what these events ran on.
     *
     * Cost is deliberately NOT recomputed here: migrations run before the price catalog
     * is loaded. `repriceUnknown` picks these up once it is.
     */
    run: (db) => {
      const fixed = db
        .prepare(
          `UPDATE usage_event
              SET model = (SELECT s.model_default FROM session s WHERE s.id = usage_event.session_id)
            WHERE model IS NULL
              AND session_id IS NOT NULL
              AND (SELECT s.model_default FROM session s WHERE s.id = usage_event.session_id) IS NOT NULL`,
        )
        .run().changes;
      if (fixed > 0) log.info(`recovered the model on ${fixed} events that had none`);
    },
  },
  {
    to: 6,
    /*
     * Drop the rows Claude Code wrote for messages it fabricated locally.
     *
     * `<synthetic>` is its marker for an assistant message it produced itself -- an
     * interrupt notice, an API error rendered as text -- and it carries a usage block
     * whose every counter is zero. No token or cost total was ever wrong. What was wrong
     * is everything that counts rows: these appeared as API calls that never happened, as
     * a "model" in the models list, and inside the unpriced-calls figure, which is meant
     * to read "a model we saw in use has no published price".
     *
     * The adapter now skips them on the way in; this clears what it already stored.
     * Narrowed to zero-token rows so that if Claude ever attaches real usage to a
     * synthetic message, this deletes nothing of value.
     */
    run: (db) => {
      const gone = db
        .prepare(
          `DELETE FROM usage_event
            WHERE model = '<synthetic>'
              AND COALESCE(total_tokens, 0) = 0
              AND COALESCE(input_tokens, 0) = 0
              AND COALESCE(output_tokens, 0) = 0
              AND COALESCE(cached_input_tokens, 0) = 0
              AND COALESCE(cache_write_tokens, 0) = 0`,
        )
        .run().changes;
      if (gone > 0) log.info(`removed ${gone} synthetic rows that were never API calls`);
    },
  },
];

function migrate(db: DB) {
  for (const r of REPAIRS) {
    try {
      db.transaction(() => r.run(db))();
    } catch (err) {
      log.error(`repair ${r.name} failed`, (err as Error).message);
      throw err;
    }
  }

  const row = db.prepare(`SELECT value FROM meta WHERE key = 'schema_version'`).get() as
    | { value: string }
    | undefined;
  if (!row) {
    db.prepare(`INSERT INTO meta (key, value) VALUES ('schema_version', ?)`).run(String(SCHEMA_VERSION));
    return;
  }

  let current = Number(row.value);
  for (const m of MIGRATIONS) {
    if (m.to <= current) continue;
    log.info(`migrating schema ${current} -> ${m.to}`);
    try {
      db.transaction(() => m.run(db))();
    } catch (err) {
      log.error(`migration to v${m.to} failed`, (err as Error).message);
      throw err;
    }
    current = m.to;
    db.prepare(`UPDATE meta SET value = ? WHERE key = 'schema_version'`).run(String(current));
  }

  if (current !== SCHEMA_VERSION) {
    db.prepare(`UPDATE meta SET value = ? WHERE key = 'schema_version'`).run(String(SCHEMA_VERSION));
  }
}

export function closeDb() {
  handle?.close();
  handle = null;
}

/**
 * Read another tool's SQLite file without ever writing to it.
 * better-sqlite3 does NOT accept `file:...?mode=ro` URIs -- the readonly flag is the
 * supported form, and it still reads uncheckpointed -wal content (verified on all
 * four v1 harnesses, including the Hermes profile DBs whose rows live only in WAL).
 */
export function openForeignRo(path: string): DB {
  return new Database(path, { readonly: true, fileMustExist: true });
}

/** Resolve (or create) the source row for an adapter profile. */
export function upsertSource(
  db: DB,
  s: {
    harness: string;
    profile: string;
    rootPath: string;
    displayName: string;
    account?: AccountIdentity;
    sourceKind?: 'harness' | 'account';
  },
): number {
  db.prepare(
    `INSERT INTO source (
       harness, profile, root_path, display_name, source_kind,
       account_key, account_provider, account_display_name, detected_at
     )
     VALUES (
       @harness, @profile, @rootPath, @displayName, @sourceKind,
       @accountKey, @accountProvider, @accountDisplayName, @now
     )
     ON CONFLICT (harness, profile)
     DO UPDATE SET root_path = excluded.root_path, display_name = excluded.display_name,
                   source_kind = excluded.source_kind,
                   account_key = excluded.account_key,
                   account_provider = excluded.account_provider,
                   account_display_name = excluded.account_display_name,
                   -- A source we can see again is active again, whatever disableMissingSources
                   -- concluded when it was last absent.
                   enabled = 1`,
  ).run({
    ...s,
    sourceKind: s.sourceKind ?? 'harness',
    accountKey: s.account?.key ?? null,
    accountProvider: s.account?.provider ?? null,
    accountDisplayName: s.account?.displayName ?? null,
    now: Date.now(),
  });
  const row = db
    .prepare(`SELECT id FROM source WHERE harness = ? AND profile = ?`)
    .get(s.harness, s.profile) as { id: number };
  return row.id;
}
