import type { DB } from '../db/index.js';
import { upsertSource } from '../db/index.js';
import { ADAPTER_TARGET, type Adapter, type Profile } from '../adapters/types.js';
import { DbCursorStore } from './cursor.js';
import { DbSink, type SinkStats } from './sink.js';
import { PriceResolver } from '../pricing/resolve.js';
import { logger } from '../util/log.js';

const log = logger('ingest');

export interface RunResult {
  adapterId: string;
  profile: string;
  sourceId: number;
  displayName: string;
  stats: SinkStats;
  durationMs: number;
  error?: string;
}

export interface ResolvedSource {
  adapter: Adapter;
  profile: Profile;
  sourceId: number;
}

/** Detect every profile of every adapter and register it as a source. */
export async function resolveSources(db: DB, adapters: Adapter[]): Promise<ResolvedSource[]> {
  const out: ResolvedSource[] = [];
  for (const adapter of adapters) {
    let profiles: Profile[] = [];
    try {
      profiles = await adapter.detect();
    } catch (err) {
      log.warn(`${adapter.id}: detect failed`, (err as Error).message);
      continue;
    }
    if (profiles.length === 0) {
      log.debug(`${adapter.id}: not installed`);
      continue;
    }
    for (const profile of profiles) {
      const sourceId = upsertSource(db, {
        harness: adapter.id,
        profile: profile.profile,
        rootPath: profile.rootPath,
        displayName: profile.displayName,
        account: profile.account,
        sourceKind: profile.sourceKind,
      });
      out.push({ adapter, profile, sourceId });
      log.info(`${adapter.id}/${profile.profile} -> ${profile.rootPath}`);
    }
  }
  disableMissingSources(db, out);
  return out;
}

/**
 * A harness that is no longer on disk stops being an active source: we must not keep trying
 * to read it, and it must not sit on the Live page as though it were installed.
 *
 * Its rows in `usage_event` are untouched, so every total it contributed to Trend, Cost and
 * Sessions stays exactly as it was -- deleting history because a tool was uninstalled would
 * silently change numbers the user already read. `sourceStatus` keeps showing a disabled
 * source that has usage for the same reason; only one with nothing recorded disappears
 * completely, because there is nothing about it to report.
 */
function disableMissingSources(db: DB, present: ResolvedSource[]): void {
  const keep = new Set(present.map((p) => p.sourceId));
  const rows = db.prepare(`SELECT id, harness, profile FROM source WHERE enabled = 1`).all() as
    Array<{ id: number; harness: string; profile: string }>;
  const disable = db.prepare(`UPDATE source SET enabled = 0 WHERE id = ?`);
  for (const row of rows) {
    if (keep.has(row.id)) continue;
    disable.run(row.id);
    log.info(`${row.harness}/${row.profile} is gone; its history is kept`);
  }
}

/** Last failure logged per source, so an unchanging one is not repeated every pass. */
const lastError = new Map<string, string>();

/**
 * Run one ingest pass. Each source is independent: a failure in one adapter must not
 * stop the others, because a harness can change its on-disk format at any upgrade.
 */
export async function runPass(
  db: DB,
  sources: ResolvedSource[],
  opts: { backfill?: boolean } = {},
): Promise<RunResult[]> {
  const prices = new PriceResolver(db);
  const results: RunResult[] = [];

  for (const { adapter, profile, sourceId } of sources) {
    const started = Date.now();
    const cursors = new DbCursorStore(db, sourceId);
    const sink = new DbSink(db, sourceId, prices);
    let error: string | undefined;

    try {
      // No wrapping transaction: better-sqlite3 transactions are synchronous and
      // adapters do async file IO, so one could not span a whole pass. Correctness
      // comes from every write being idempotent (unique dedup keys) and from the
      // cursor only advancing past lines already handed to the sink.
      await adapter.ingest({
        profile,
        sourceId,
        cursors,
        sink,
        backfill: opts.backfill ?? false,
      });
    } catch (err) {
      error = (err as Error).message;
      /*
       * A source that is broken is broken on every pass, and a pass runs every five
       * seconds -- a corrupt database would otherwise write the same line ~17k times a
       * day and bury everything else. So the LOG is deduplicated: a given failure is
       * printed once and again only when it changes.
       *
       * The count is not lost, because `recordError` below increments `error_count` on
       * every pass regardless. That distinction matters: an earlier version of this
       * comment claimed the health tab kept the true rate while nothing whatsoever
       * wrote to it, which made "no read errors" mean "we never looked".
       */
      const key = `${adapter.id}/${profile.profile}`;
      if (lastError.get(key) !== error) {
        log.error(`${key} failed`, error);
        lastError.set(key, error);
      }
      /*
       * A failure that escaped the adapter entirely belongs to no single file, so it is
       * recorded against the source itself. The parenthesised key cannot collide with a
       * real target, which is always a path or a `table:` name.
       */
      cursors.recordError(ADAPTER_TARGET, error);
    }

    if (!error && lastError.delete(`${adapter.id}/${profile.profile}`)) {
      log.info(`${adapter.id}/${profile.profile} recovered`);
      cursors.clearError(ADAPTER_TARGET);
    }

    results.push({
      adapterId: adapter.id,
      profile: profile.profile,
      sourceId,
      displayName: profile.displayName,
      stats: sink.stats,
      durationMs: Date.now() - started,
      ...(error ? { error } : {}),
    });
  }
  return results;
}

export function summarize(r: RunResult): string {
  const s = r.stats;
  return (
    `${r.adapterId}/${r.profile}: ` +
    `${s.usageInserted} new / ${s.usageSeen} seen events, ` +
    `${s.limitsInserted} limit samples, ` +
    `cost(native ${s.costNative}, computed ${s.costComputed}, unknown ${s.costUnknown}) ` +
    `in ${r.durationMs}ms` +
    (r.error ? ` [ERROR: ${r.error}]` : '')
  );
}
