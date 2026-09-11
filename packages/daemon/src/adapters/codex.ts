import { existsSync, readdirSync, statSync } from 'node:fs';
import { basename, join } from 'node:path';
import type { Adapter, IngestCtx, Profile, WatchTarget } from './types.js';
import { readJsonlDelta } from '../ingest/jsonl.js';
import { fromEpochSeconds, fromIso, type Millis } from '../util/time.js';
import { home, projectOf } from '../util/paths.js';
import { logger } from '../util/log.js';

const log = logger('codex');

const ROOT = home('.codex');

interface TokenUsage {
  input_tokens?: number;
  cached_input_tokens?: number;
  /** Absent on the older schema generation; treat as 0. */
  cache_write_input_tokens?: number;
  output_tokens?: number;
  reasoning_output_tokens?: number;
  total_tokens?: number;
}

interface RateWindow {
  used_percent?: number;
  window_minutes?: number;
  resets_at?: number;
}

interface RolloutLine {
  timestamp?: string;
  ordinal?: number;
  type?: string;
  payload?: {
    type?: string;
    // token_count
    info?: {
      total_token_usage?: TokenUsage;
      last_token_usage?: TokenUsage;
      model_context_window?: number;
    } | null;
    rate_limits?: {
      primary?: RateWindow | null;
      secondary?: RateWindow | null;
      plan_type?: string | null;
      rate_limit_reached_type?: string | null;
    } | null;
    // session_meta
    session_id?: string;
    id?: string;
    cwd?: string;
    git?: { branch?: string | null };
    // turn_context / thread_settings_applied
    model?: string;
    effort?: string;
    thread_settings?: { model?: string; reasoning_effort?: string };
    // task_complete
    turn_id?: string;
    duration_ms?: number;
  };
}

/** sessions/YYYY/MM/DD/rollout-<iso>-<uuid>.jsonl */
function walkRollouts(sessionsDir: string): string[] {
  const out: string[] = [];
  const visit = (dir: string, depth: number) => {
    if (depth > 4) return;
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const p = join(dir, e.name);
      if (e.isDirectory()) visit(p, depth + 1);
      else if (e.isFile() && e.name.startsWith('rollout-') && e.name.endsWith('.jsonl')) out.push(p);
    }
  };
  visit(sessionsDir, 0);
  return out;
}

/** The uuid tail of a rollout filename, used when a session_meta has not been seen yet. */
function sessionIdFromName(file: string): string {
  const m = /rollout-.*?-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.jsonl$/i.exec(
    basename(file),
  );
  return m?.[1] ?? basename(file, '.jsonl');
}

/** Cursor meta is JSON from disk, so nothing about its shape is guaranteed. */
function asText(v: unknown): string | null {
  return typeof v === 'string' && v.length > 0 ? v : null;
}

export const codexAdapter: Adapter = {
  id: 'codex',
  displayName: 'Codex CLI',

  async detect(): Promise<Profile[]> {
    if (!existsSync(join(ROOT, 'sessions'))) return [];
    return [
      {
        profile: 'default',
        rootPath: ROOT,
        displayName: 'Codex CLI',
        account: {
          key: 'openai:subscription',
          provider: 'openai',
          displayName: 'OpenAI Subscription',
        },
      },
    ];
  },

  watchTargets(p: Profile): WatchTarget[] {
    return [{ kind: 'dir', path: join(p.rootPath, 'sessions'), recursive: true }];
  },

  async ingest(ctx: IngestCtx): Promise<void> {
    const sessionsDir = join(ctx.profile.rootPath, 'sessions');
    const files = walkRollouts(sessionsDir);

    for (const file of files) {
      let st;
      try {
        st = statSync(file);
      } catch {
        continue;
      }
      const cursor = ctx.cursors.get(file);
      if (st.size === cursor.fileSize && st.size === cursor.byteOffset) continue;

      const fallbackSid = sessionIdFromName(file);
      let sid: string | null = null;
      let cwd: string | null = null;
      let gitBranch: string | null = null;
      /*
       * Seeded from the cursor, not from null: a pass reads only the bytes appended
       * since the last one, and Codex names the model and effort once per turn in a
       * `turn_context` line that an earlier pass has usually already consumed. Starting
       * these at null recorded every call in such a pass with no model, which in turn
       * left it unpriced.
       */
      let model = asText(cursor.meta?.model);
      let effort = asText(cursor.meta?.effort);
      let contextWindow: number | null = null;
      let firstTs: Millis | null = null;
      let lastTs: Millis | null = null;

      /*
       * total_token_usage is CUMULATIVE for the whole session and keeps accumulating
       * across context compaction, so summing it would multiply the session by its
       * number of turns. last_token_usage is the per-call delta and is what a fact
       * table wants. Verified: total = input + output, with cached_input_tokens a
       * SUBSET of input_tokens (the reverse of Claude, where they are disjoint).
       */
      try {
        const res = await readJsonlDelta(file, cursor.byteOffset, (rec) => {
          const r = rec as RolloutLine;
          const p = r.payload;
          if (!p) return;
          const ts = fromIso(r.timestamp);

          if (r.type === 'session_meta') {
            sid = p.session_id ?? p.id ?? sid;
            if (p.cwd) cwd = p.cwd;
            if (p.git?.branch) gitBranch = p.git.branch;
            return;
          }

          if (r.type === 'turn_context') {
            if (p.model) model = p.model;
            if (p.effort) effort = p.effort;
            if (p.cwd) cwd = p.cwd;
            return;
          }

          if (p.type === 'thread_settings_applied') {
            if (p.thread_settings?.model) model = p.thread_settings.model;
            if (p.thread_settings?.reasoning_effort) effort = p.thread_settings.reasoning_effort;
            return;
          }

          if (p.type !== 'token_count') return;
          if (ts == null) return;
          firstTs = firstTs == null ? ts : Math.min(firstTs, ts);
          lastTs = lastTs == null ? ts : Math.max(lastTs, ts);

          // Every token_count carries the CURRENT quota state. This is the only
          // genuinely near-real-time rate-limit feed of any harness on this machine.
          const rl = p.rate_limits;
          if (rl) {
            for (const [w, kind] of [
              [rl.primary, '5h'],
              [rl.secondary, 'weekly'],
            ] as const) {
              if (!w || w.used_percent == null) continue;
              ctx.sink.limit({
                windowKind: kind,
                usedPercent: w.used_percent,
                resetsAt: fromEpochSeconds(w.resets_at),
                severity: rl.rate_limit_reached_type ?? null,
                observedAt: ts,
                sourceFetchedAt: ts,
                origin: 'rollout-token_count',
              });
            }
          }

          const info = p.info;
          if (!info) return; // `info` is null on many events; only quota moved.
          const last = info.last_token_usage;
          if (!last) return;
          if (info.model_context_window) contextWindow = info.model_context_window;

          const rawInput = last.input_tokens ?? 0;
          const cached = last.cached_input_tokens ?? 0;
          // Codex folds cache reads into input_tokens; our convention keeps them
          // disjoint so the two can be priced at their different rates.
          const freshInput = Math.max(0, rawInput - cached);

          if (rawInput === 0 && (last.output_tokens ?? 0) === 0) return;

          ctx.sink.usage({
            // ordinal is unique and monotonic within a rollout file.
            dedupKey: `${basename(file)}:${r.ordinal ?? `${ts}`}`,
            ts,
            nativeSessionId: sid ?? fallbackSid,
            model,
            provider: 'openai',
            effort,
            contextWindow,
            inputTokens: freshInput,
            cachedInputTokens: cached,
            cacheWriteTokens: last.cache_write_input_tokens ?? 0,
            outputTokens: last.output_tokens ?? 0,
            reasoningTokens: last.reasoning_output_tokens ?? 0,
          });
        });

        ctx.sink.session({
          nativeSessionId: sid ?? fallbackSid,
          cwd,
          project: projectOf(cwd),
          gitBranch,
          modelDefault: model,
          startedAt: firstTs,
          lastSeenAt: lastTs,
        });

        ctx.cursors.set(file, {
          byteOffset: res.nextOffset,
          fileSize: res.fileSize,
          fileMtime: res.fileMtime,
          // What is in force at nextOffset, so the next pass resumes knowing it.
          meta: { model, effort },
        });
        if (res.restarted) log.warn(`file shrank, re-read from start: ${basename(file)}`);
      } catch (err) {
        const message = (err as Error).message;
        log.warn(`failed reading ${basename(file)}`, message);
        ctx.cursors.recordError(file, message);
      }
    }
  },
};
