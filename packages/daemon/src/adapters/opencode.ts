import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { Adapter, IngestCtx, Profile, WatchTarget } from './types.js';
import { openForeignRo } from '../db/index.js';
import { fromEpochMillis } from '../util/time.js';
import { home, projectOf } from '../util/paths.js';
import { logger } from '../util/log.js';

const log = logger('opencode');

const ROOT = home('.local', 'share', 'opencode');
const DB_FILE = join(ROOT, 'opencode.db');

interface MessageRow {
  id: string;
  session_id: string;
  time_created: number;
  time_updated: number;
  data: string;
}

interface AssistantData {
  role?: string;
  agent?: string;
  modelID?: string;
  providerID?: string;
  cost?: number;
  tokens?: {
    total?: number;
    input?: number;
    output?: number;
    reasoning?: number;
    cache?: { read?: number; write?: number };
  };
  time?: { created?: number; completed?: number };
  finish?: string;
}

interface SessionRow {
  id: string;
  directory: string | null;
  title: string | null;
  agent: string | null;
  model: string | null;
  time_created: number | null;
  time_updated: number | null;
  parent_id: string | null;
}

/** Small overlap so a row updated in the same millisecond as the watermark is not skipped. */
const WATERMARK_OVERLAP_MS = 5 * 60 * 1000;

export const opencodeAdapter: Adapter = {
  id: 'opencode',
  displayName: 'OpenCode',

  async detect(): Promise<Profile[]> {
    if (!existsSync(DB_FILE)) return [];
    return [{ profile: 'default', rootPath: ROOT, displayName: 'OpenCode' }];
  },

  watchTargets(): WatchTarget[] {
    // The main db file barely changes; the -wal sidecar is what actually moves.
    return [
      { kind: 'sqlite', path: DB_FILE },
      { kind: 'file', path: `${DB_FILE}-wal` },
    ];
  },

  async ingest(ctx: IngestCtx): Promise<void> {
    let db;
    try {
      db = openForeignRo(DB_FILE);
    } catch (err) {
      const message = (err as Error).message;
      log.warn('cannot open opencode.db read-only', message);
      ctx.cursors.recordError(DB_FILE, message);
      return;
    }

    try {
      const cursor = ctx.cursors.get('table:message');
      const since = Math.max(0, cursor.watermark - WATERMARK_OVERLAP_MS);

      // Session dimension first, so usage events can attach to a real row.
      const sessions = db
        .prepare(
          `SELECT id, directory, title, agent, model, time_created, time_updated, parent_id
             FROM session WHERE COALESCE(time_updated, time_created, 0) >= ?`,
        )
        .all(since) as SessionRow[];

      for (const s of sessions) {
        // session.model is a JSON string: {"id":...,"providerID":...,"variant":...}
        let modelDefault: string | null = null;
        if (s.model) {
          try {
            modelDefault = (JSON.parse(s.model) as { id?: string }).id ?? null;
          } catch {
            modelDefault = s.model;
          }
        }
        ctx.sink.session({
          nativeSessionId: s.id,
          cwd: s.directory,
          project: projectOf(s.directory) ?? s.title ?? null,
          agent: s.agent,
          modelDefault,
          startedAt: fromEpochMillis(s.time_created),
          lastSeenAt: fromEpochMillis(s.time_updated),
          isSubagent: Boolean(s.parent_id),
          parentSessionId: s.parent_id,
        });
      }

      let maxWatermark = cursor.watermark;
      const rows = db
        .prepare(
          `SELECT id, session_id, time_created, time_updated, data
             FROM message WHERE time_updated >= ? ORDER BY time_updated ASC`,
        )
        .all(since) as MessageRow[];

      for (const row of rows) {
        maxWatermark = Math.max(maxWatermark, row.time_updated ?? 0);
        let d: AssistantData;
        try {
          d = JSON.parse(row.data) as AssistantData;
        } catch {
          continue;
        }
        if (d.role !== 'assistant') continue;
        // Skip turns still streaming: their token counts are not final yet, and a
        // per-call row must never be revised after the fact.
        if (d.time?.completed == null) continue;

        const t = d.tokens;
        if (!t) continue;

        /*
         * OpenCode is the one harness whose reasoning tokens sit OUTSIDE output:
         * verified exactly, total = input + output + reasoning + cache.read + cache.write
         * on every sampled row. Our convention puts reasoning inside output, so fold it
         * in here rather than losing it or double counting it in the total.
         */
        const reasoning = t.reasoning ?? 0;

        ctx.sink.usage({
          dedupKey: `msg:${row.id}`,
          ts: fromEpochMillis(d.time.completed) ?? row.time_created,
          nativeSessionId: row.session_id,
          model: d.modelID ?? null,
          provider: d.providerID ?? null,
          inputTokens: t.input ?? 0,
          cachedInputTokens: t.cache?.read ?? 0,
          cacheWriteTokens: t.cache?.write ?? 0,
          outputTokens: (t.output ?? 0) + reasoning,
          reasoningTokens: reasoning,
          // OpenCode prices the call itself; trust it rather than re-deriving.
          ...(typeof d.cost === 'number' ? { costUsd: d.cost, costSource: 'native' as const } : {}),
          durationMs:
            d.time.completed != null && d.time.created != null
              ? d.time.completed - d.time.created
              : null,
          nativeMsgId: row.id,
        });
      }

      ctx.cursors.set('table:message', { watermark: maxWatermark });
    } finally {
      db.close();
    }
  },
};
