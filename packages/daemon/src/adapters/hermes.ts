import { existsSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { Adapter, IngestCtx, Profile, WatchTarget } from './types.js';
import { openForeignRo } from '../db/index.js';
import { fromEpochAuto } from '../util/time.js';
import { home, projectOf } from '../util/paths.js';
import { logger } from '../util/log.js';

const log = logger('hermes');

const BASE = home('AppData', 'Local', 'hermes');

interface UsageRow {
  session_id: string;
  model: string | null;
  billing_provider: string | null;
  billing_base_url: string | null;
  billing_mode: string | null;
  task: string | null;
  api_call_count: number | null;
  input_tokens: number | null;
  output_tokens: number | null;
  cache_read_tokens: number | null;
  cache_write_tokens: number | null;
  reasoning_tokens: number | null;
  estimated_cost_usd: number | null;
  actual_cost_usd: number | null;
  cost_status: string | null;
  first_seen: number | null;
  last_seen: number | null;
}

interface SessionRow {
  id: string;
  cwd: string | null;
  git_branch: string | null;
  model: string | null;
  title: string | null;
  started_at: number | null;
  ended_at: number | null;
  last_activity_at: number | null;
  parent_session_id: string | null;
}

/** Hermes supports named profiles, each with its own state.db and its own account. */
function profileDbs(): Array<{ profile: string; file: string; label: string }> {
  const out: Array<{ profile: string; file: string; label: string }> = [];
  const main = join(BASE, 'state.db');
  if (existsSync(main)) out.push({ profile: 'default', file: main, label: 'Hermes Agent' });

  const profilesDir = join(BASE, 'profiles');
  if (existsSync(profilesDir)) {
    for (const e of readdirSync(profilesDir, { withFileTypes: true })) {
      if (!e.isDirectory()) continue;
      const file = join(profilesDir, e.name, 'state.db');
      if (existsSync(file)) {
        out.push({ profile: e.name, file, label: `Hermes Agent (${e.name})` });
      }
    }
  }
  return out;
}

/** The Hermes home that owns a detected state database, including named profiles. */
export function hermesHomeForProfile(p: Profile): string {
  return dirname(p.rootPath);
}

export const hermesAdapter: Adapter = {
  id: 'hermes',
  displayName: 'Hermes Agent',

  async detect(): Promise<Profile[]> {
    return profileDbs().map((p) => ({
      profile: p.profile,
      rootPath: p.file,
      displayName: p.label,
    }));
  },

  watchTargets(p: Profile): WatchTarget[] {
    return [
      { kind: 'sqlite', path: p.rootPath },
      { kind: 'file', path: `${p.rootPath}-wal` },
    ];
  },

  async ingest(ctx: IngestCtx): Promise<void> {
    const file = ctx.profile.rootPath;
    let db;
    try {
      db = openForeignRo(file);
    } catch (err) {
      const message = (err as Error).message;
      log.warn(`cannot open ${file} read-only`, message);
      ctx.cursors.recordError(file, message);
      return;
    }

    try {
      const sessions = db
        .prepare(
          `SELECT id, cwd, git_branch, model, title, started_at, ended_at,
                  last_activity_at, parent_session_id
             FROM sessions`,
        )
        .all() as SessionRow[];

      for (const s of sessions) {
        ctx.sink.session({
          nativeSessionId: s.id,
          cwd: s.cwd,
          project: projectOf(s.cwd) ?? s.title ?? null,
          gitBranch: s.git_branch,
          modelDefault: s.model,
          startedAt: fromEpochAuto(s.started_at),
          endedAt: fromEpochAuto(s.ended_at),
          lastSeenAt: fromEpochAuto(s.last_activity_at ?? s.ended_at ?? s.started_at),
          isSubagent: Boolean(s.parent_session_id),
          parentSessionId: s.parent_session_id,
        });
      }

      /*
       * Hermes does not publish per-call records at all -- session_model_usage is a
       * RUNNING TOTAL per (session, model, provider, base_url, mode, task) that grows
       * while a session is alive. So these rows are emitted with replaceOnConflict and
       * timestamped at last_seen. Consequence worth knowing when reading a chart: a
       * Hermes session's whole usage lands on one point in time, not spread across the
       * turns that produced it. No finer grain exists on disk.
       */
      const rows = db
        .prepare(
          `SELECT session_id, model, billing_provider, billing_base_url, billing_mode, task,
                  api_call_count, input_tokens, output_tokens, cache_read_tokens,
                  cache_write_tokens, reasoning_tokens, estimated_cost_usd, actual_cost_usd,
                  cost_status, first_seen, last_seen
             FROM session_model_usage`,
        )
        .all() as UsageRow[];

      for (const r of rows) {
        const ts = fromEpochAuto(r.last_seen ?? r.first_seen);
        if (ts == null) continue;

        const key = [
          r.session_id,
          r.model ?? '',
          r.billing_provider ?? '',
          r.billing_base_url ?? '',
          r.billing_mode ?? '',
          r.task ?? '',
        ].join('|');

        /*
         * Every cost column here is 0 with cost_status 'included' or 'unknown', i.e.
         * "covered by a subscription" rather than "actually free". Reporting 0 would
         * hide real consumption, so a zero native cost is discarded and the value is
         * priced from tokens instead; only a positive actual cost is trusted.
         */
        const native = r.actual_cost_usd && r.actual_cost_usd > 0 ? r.actual_cost_usd : null;

        ctx.sink.usage({
          dedupKey: `agg:${key}`,
          ts,
          callCount: r.api_call_count ?? 1,
          nativeSessionId: r.session_id,
          model: r.model,
          provider: r.billing_provider,
          inputTokens: r.input_tokens ?? 0,
          cachedInputTokens: r.cache_read_tokens ?? 0,
          cacheWriteTokens: r.cache_write_tokens ?? 0,
          outputTokens: r.output_tokens ?? 0,
          reasoningTokens: r.reasoning_tokens ?? 0,
          ...(native != null ? { costUsd: native, costSource: 'native' as const } : {}),
          replaceOnConflict: true,
        });
      }
    } finally {
      db.close();
    }
  },
};
