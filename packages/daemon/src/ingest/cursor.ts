import type { DB } from '../db/index.js';
import { ADAPTER_TARGET, EMPTY_CURSOR, type Cursor, type CursorStore } from '../adapters/types.js';

/**
 * Malformed stored state must never stop ingestion: the cursor is a cache of what the
 * adapter already knew, and starting a pass without it costs at most one turn's worth of
 * carried-over fields, whereas throwing here would stall the whole source.
 */
/** A target is a file path, a `table:` name inside a foreign database, or the source itself. */
function kindOf(targetKey: string): string {
  if (targetKey === ADAPTER_TARGET) return 'adapter';
  return targetKey.includes('://') || targetKey.startsWith('table:') ? 'sqlite' : 'file';
}

function parseMeta(raw: string | null): Record<string, string | number | null> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, string | number | null>)
      : {};
  } catch {
    return {};
  }
}

/**
 * Per-target ingest position, persisted so a restart resumes instead of rescanning.
 * `targetKey` is a file path for JSONL sources and a table name for SQLite sources.
 */
export class DbCursorStore implements CursorStore {
  private cache = new Map<string, Cursor>();
  private select;
  private upsert;

  constructor(
    private db: DB,
    private sourceId: number,
  ) {
    this.select = db.prepare(
      `SELECT byte_offset, file_size, file_mtime, watermark, meta
         FROM ingest_state WHERE source_id = ? AND target_key = ?`,
    );
    this.upsert = db.prepare(
      `INSERT INTO ingest_state (source_id, target_key, kind, byte_offset, file_size, file_mtime, watermark, meta, last_ok_at)
       VALUES (@sourceId, @targetKey, @kind, @byteOffset, @fileSize, @fileMtime, @watermark, @meta, @lastOkAt)
       ON CONFLICT (source_id, target_key) DO UPDATE SET
         byte_offset = excluded.byte_offset,
         file_size   = excluded.file_size,
         file_mtime  = excluded.file_mtime,
         watermark   = excluded.watermark,
         meta        = excluded.meta,
         last_ok_at  = excluded.last_ok_at,
         last_error  = NULL,
         error_count = 0`,
    );
  }

  get(targetKey: string): Cursor {
    const cached = this.cache.get(targetKey);
    if (cached) return cached;
    const row = this.select.get(this.sourceId, targetKey) as
      | {
          byte_offset: number;
          file_size: number;
          file_mtime: number;
          watermark: number;
          meta: string | null;
        }
      | undefined;
    const cursor: Cursor = row
      ? {
          byteOffset: row.byte_offset,
          fileSize: row.file_size,
          fileMtime: row.file_mtime,
          watermark: row.watermark,
          meta: parseMeta(row.meta),
        }
      : { ...EMPTY_CURSOR, meta: {} };
    this.cache.set(targetKey, cursor);
    return cursor;
  }

  set(targetKey: string, patch: Partial<Cursor>): void {
    const next = { ...this.get(targetKey), ...patch };
    this.cache.set(targetKey, next);
    this.upsert.run({
      sourceId: this.sourceId,
      targetKey,
      kind: kindOf(targetKey),
      byteOffset: next.byteOffset,
      fileSize: next.fileSize,
      fileMtime: next.fileMtime,
      watermark: next.watermark,
      meta: next.meta && Object.keys(next.meta).length > 0 ? JSON.stringify(next.meta) : null,
      lastOkAt: Date.now(),
    });
  }

  recordError(targetKey: string, message: string): void {
    this.db
      .prepare(
        `INSERT INTO ingest_state (source_id, target_key, kind, last_error, error_count)
         VALUES (?, ?, ?, ?, 1)
         ON CONFLICT (source_id, target_key) DO UPDATE SET
           last_error  = excluded.last_error,
           error_count = ingest_state.error_count + 1`,
      )
      .run(this.sourceId, targetKey, kindOf(targetKey), message.slice(0, 500));
  }

  /**
   * Clear a recorded failure without advancing any cursor.
   *
   * `set()` already clears the error for a target that was read successfully, so this
   * is for the ones that have no cursor of their own -- notably a whole-adapter failure,
   * which belongs to no file. Such a row exists only to carry the error, so once the
   * error is gone the row is too; leaving it behind would inflate the target count the
   * Health page reports.
   */
  clearError(targetKey: string): void {
    this.db
      .prepare(
        `DELETE FROM ingest_state
          WHERE source_id = ? AND target_key = ? AND byte_offset = 0 AND watermark = 0`,
      )
      .run(this.sourceId, targetKey);
    this.db
      .prepare(
        `UPDATE ingest_state SET last_error = NULL, error_count = 0
          WHERE source_id = ? AND target_key = ?`,
      )
      .run(this.sourceId, targetKey);
  }
}
