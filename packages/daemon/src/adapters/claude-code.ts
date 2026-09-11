import { existsSync, readdirSync, statSync } from 'node:fs';
import { basename, join } from 'node:path';
import type { Adapter, IngestCtx, Profile, WatchTarget } from './types.js';
import { readJsonlDelta, readJsonFile } from '../ingest/jsonl.js';
import { fromEpochAuto, fromIso, type Millis } from '../util/time.js';
import { HOME, home, projectOf } from '../util/paths.js';
import { logger } from '../util/log.js';

/** Claude Code's placeholder model on messages it fabricated locally, never an API call. */
const SYNTHETIC_MODEL = '<synthetic>';

const log = logger('claude-code');

/**
 * Claude Code keeps a config dir per profile. This machine has two: the default
 * ~/.claude and a second ~/.claude-company driven by CLAUDE_CONFIG_DIR. They are
 * separate accounts with separate quotas, so they are separate sources.
 */
const KNOWN_ROOTS: Array<{ profile: string; path: string; label: string }> = [
  { profile: 'default', path: home('.claude'), label: 'Claude Code Personal' },
  { profile: 'company', path: home('.claude-company'), label: 'Claude Code Company' },
];

function accountFor(profile: string) {
  if (profile === 'company') {
    return {
      key: 'anthropic:claude:company',
      provider: 'anthropic',
      displayName: 'Claude Company Subscription',
    };
  }
  if (profile === 'default') {
    return {
      key: 'anthropic:claude:personal',
      provider: 'anthropic',
      displayName: 'Claude Personal Subscription',
    };
  }
  const label = profile
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part[0]!.toUpperCase() + part.slice(1))
    .join(' ');
    return {
      key: `anthropic:claude:${profile}`,
      provider: 'anthropic',
      displayName: `Claude ${label || profile} Subscription`,
    };
}

interface ClaudeUsage {
  input_tokens?: number;
  output_tokens?: number;
  cache_read_input_tokens?: number;
  cache_creation_input_tokens?: number;
  output_tokens_details?: { thinking_tokens?: number };
  service_tier?: string;
}

interface AssistantRecord {
  type?: string;
  uuid?: string;
  sessionId?: string;
  session_id?: string;
  cwd?: string;
  gitBranch?: string;
  timestamp?: string;
  requestId?: string;
  apiBlockIndex?: number;
  effort?: string;
  isSidechain?: boolean;
  message?: { id?: string; model?: string; usage?: ClaudeUsage };
}

interface CostStateRecord {
  type?: string;
  sessionId?: string;
  startTime?: number;
  totalCostUSD?: number;
  totalDuration?: number;
  totalLinesAdded?: number;
  totalLinesRemoved?: number;
}

/** Every *.jsonl under projects/, including the subagents/ subfolders. */
function walkTranscripts(projectsDir: string): string[] {
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
      else if (e.isFile() && e.name.endsWith('.jsonl')) out.push(p);
    }
  };
  visit(projectsDir, 0);
  return out;
}

export const claudeCodeAdapter: Adapter = {
  id: 'claude-code',
  displayName: 'Claude Code',

  async detect(): Promise<Profile[]> {
    const found: Profile[] = [];
    const roots = [...KNOWN_ROOTS];
    const envRoot = process.env.CLAUDE_CONFIG_DIR;
    if (envRoot && !roots.some((r) => r.path === envRoot)) {
      roots.push({ profile: basename(envRoot).replace(/^\./, ''), path: envRoot, label: `Claude Code (${basename(envRoot)})` });
    }
    for (const r of roots) {
      // Keep a known profile visible even before its first transcript exists. The
      // account card can then say "inactive" or "waiting" and can become active again
      // as soon as Claude publishes quota, without a code/config change.
      if (existsSync(r.path) || existsSync(configPathFor({ profile: r.profile, rootPath: r.path, displayName: r.label }))) {
        found.push({
          profile: r.profile,
          rootPath: r.path,
          displayName: r.label,
          account: accountFor(r.profile),
        });
      }
    }
    return found;
  },

  watchTargets(p: Profile): WatchTarget[] {
    return [
      { kind: 'dir', path: join(p.rootPath, 'projects'), recursive: true },
      { kind: 'dir', path: join(p.rootPath, 'statusline'), recursive: true },
      { kind: 'file', path: configPathFor(p) },
    ];
  },

  async ingest(ctx: IngestCtx): Promise<void> {
    await ingestTranscripts(ctx);
    ingestLimits(ctx);
  },
};

function configPathFor(p: Profile): string {
  // The personal profile keeps its config beside the home directory; alternate
  // profiles keep theirs inside their config directory. Never let a missing company
  // config accidentally read the personal account's cached quota.
  return p.profile === 'default' ? join(HOME, '.claude.json') : join(p.rootPath, '.claude.json');
}

async function ingestTranscripts(ctx: IngestCtx): Promise<void> {
  const projectsDir = join(ctx.profile.rootPath, 'projects');
  const files = walkTranscripts(projectsDir);

  for (const file of files) {
    let st;
    try {
      st = statSync(file);
    } catch {
      continue;
    }
    const cursor = ctx.cursors.get(file);
    // Nothing appended since last pass, and the file did not shrink.
    if (st.size === cursor.fileSize && st.size === cursor.byteOffset) continue;

    const isSubagent = file.includes(`${'subagents'}`);
    // A session's last cost-state record wins; keep only the latest per file.
    let latestCost: CostStateRecord | null = null;
    let sessionSeen: string | null = null;
    let lastTs: Millis | null = null;
    let firstTs: Millis | null = null;
    /*
     * Carried across passes, not reset to null. A pass reads only newly-appended bytes,
     * and a delta can easily contain no row bearing a cwd (a summary, or the cost-state
     * record alone). Losing it here was not merely a blank: `project` then fell through
     * to decodeSlug, whose guess OVERWROTE the correct name -- which is how one folder
     * came to appear as both "usage-trend" and "trend".
     */
    let cwd = asText(cursor.meta?.cwd);
    let gitBranch = asText(cursor.meta?.gitBranch);
    let modelDefault = asText(cursor.meta?.modelDefault);

    try {
      const res = await readJsonlDelta(file, cursor.byteOffset, (rec) => {
        const r = rec as AssistantRecord & CostStateRecord;

        if (r.type === 'cost-state') {
          latestCost = r as CostStateRecord;
          if (r.sessionId) sessionSeen = r.sessionId;
          return;
        }
        if (r.type !== 'assistant') return;

        const u = r.message?.usage;
        if (!u) return;

        /*
         * `<synthetic>` is Claude Code's marker for an assistant message it produced
         * itself -- an interrupt notice, an API error surfaced as text -- rather than one
         * the API returned. It arrives WITH a usage block, but every counter in it is
         * zero, so summing was never wrong; counting was. Measured here before this guard
         * existed: 44 such rows across 25 sessions and both profiles, which is 44 API
         * calls that never happened, and 44 of the 1,031 "unpriced calls" the cost page
         * reports. That figure means "a model we saw in use has no published price", and
         * a local placeholder is not a model in use.
         *
         * Dropped rather than stored with a null model: a row that represents no request
         * has nothing to contribute to any question this app answers.
         */
        if (r.message?.model === SYNTHETIC_MODEL) return;

        const ts = fromIso(r.timestamp);
        if (ts == null) return;
        firstTs = firstTs == null ? ts : Math.min(firstTs, ts);
        lastTs = lastTs == null ? ts : Math.max(lastTs, ts);

        const sid = r.sessionId ?? r.session_id ?? null;
        if (sid) sessionSeen = sid;
        if (r.cwd) cwd = r.cwd;
        if (r.gitBranch) gitBranch = r.gitBranch;
        if (r.message?.model) modelDefault = r.message.model;

        /*
         * THE dedup rule. One API response is written as several `assistant` rows,
         * one per content block (apiBlockIndex 0,1,2...), and every one of them
         * carries a full copy of the SAME usage object. Measured on this machine:
         * 10,029 rows carry usage but only 4,739 distinct message ids, so summing
         * rows naively inflates every token count by ~2.4x.
         *
         * Keying on message.id collapses them back to one row per real API call.
         * The unique index makes this hold across restarts and re-ingests too.
         */
        const dedupKey = r.message?.id
          ? `msg:${r.message.id}`
          : r.requestId
            ? `req:${r.requestId}:${r.apiBlockIndex ?? 0}`
            : `uuid:${r.uuid ?? `${file}:${ts}`}`;

        ctx.sink.usage({
          dedupKey,
          ts,
          nativeSessionId: sid,
          model: r.message?.model ?? null,
          provider: 'anthropic',
          effort: r.effort ?? null,
          serviceTier: u.service_tier ?? null,
          // Claude's counters are already mutually exclusive; no correction needed.
          inputTokens: u.input_tokens ?? 0,
          cachedInputTokens: u.cache_read_input_tokens ?? 0,
          cacheWriteTokens: u.cache_creation_input_tokens ?? 0,
          outputTokens: u.output_tokens ?? 0,
          reasoningTokens: u.output_tokens_details?.thinking_tokens ?? 0,
          requestId: r.requestId ?? null,
          nativeMsgId: r.message?.id ?? null,
        });
      });

      if (sessionSeen) {
        /*
         * cost-state is Claude Code's own per-session tally: already deduplicated,
         * already priced, and MORE complete than the transcript -- it also covers the
         * background haiku calls (titles, summaries) that are never written as
         * assistant records. Measured against it, our transcript-derived tokens come
         * to 0.92-1.00x per session, always under and never over. So we keep both:
         * per-event rows drive trends, and this native figure is the reference the
         * health endpoint reports coverage against.
         */
        const cost = latestCost as CostStateRecord | null;
        ctx.sink.session({
          nativeSessionId: sessionSeen,
          cwd,
          project: projectOf(cwd) ?? decodeSlug(file, projectsDir),
          gitBranch,
          modelDefault,
          startedAt: cost?.startTime ?? firstTs,
          lastSeenAt: lastTs,
          isSubagent,
          nativeCostUsd: cost?.totalCostUSD ?? null,
          nativeCostAt: cost ? (lastTs ?? Math.round(st.mtimeMs)) : null,
          nativeLinesAdded: cost?.totalLinesAdded ?? null,
          nativeLinesRemoved: cost?.totalLinesRemoved ?? null,
          nativeDurationMs: cost?.totalDuration ?? null,
        });
      }

      ctx.cursors.set(file, {
        meta: { cwd, gitBranch, modelDefault },
        byteOffset: res.nextOffset,
        fileSize: res.fileSize,
        fileMtime: res.fileMtime,
      });
      if (res.restarted) log.warn(`file shrank, re-read from start: ${basename(file)}`);
    } catch (err) {
      const message = (err as Error).message;
      log.warn(`failed reading ${basename(file)}`, message);
      ctx.cursors.recordError(file, message);
    }
  }
}

/** Cursor meta is JSON from disk, so nothing about its shape is guaranteed. */
function asText(v: unknown): string | null {
  return typeof v === 'string' && v.length > 0 ? v : null;
}

/**
 * projects/<slugified-cwd>/<session>.jsonl -- recover a readable project name.
 *
 * LAST RESORT ONLY, for a transcript that never records a cwd. The slug replaces both
 * path separators and drive colons with '-', so a folder whose own name contains a
 * hyphen is genuinely ambiguous: "usage-trend" arrives as "...-Projects-usage-trend"
 * and cannot be told apart from a directory "usage" holding a directory "trend". The
 * real cwd, carried across passes above, is the answer whenever we have it -- and the
 * `session.project` repair re-derives from cwd on every start, so a guess made before
 * the cwd was known never persists.
 */
function decodeSlug(file: string, projectsDir: string): string | null {
  const rel = file.slice(projectsDir.length + 1);
  const slug = rel.split(/[\\/]/)[0];
  if (!slug) return null;
  const parts = slug.split('-').filter(Boolean);
  return parts[parts.length - 1] ?? null;
}

interface Snapshot {
  updated_at?: string;
  five_hour?: { used_percentage?: number | null; resets_at?: number | null };
  seven_day?: { used_percentage?: number | null; resets_at?: number | null };
  status?: string;
}

interface UtilWindow {
  utilization?: number | null;
  resets_at?: string | null;
  used_dollars?: number | null;
  limit_dollars?: number | null;
}

interface ClaudeConfig {
  oauthAccount?: { organizationType?: string | null } | null;
  cachedUsageUtilization?: {
    fetchedAtMs?: number;
    utilization?: Record<string, UtilWindow | unknown> & {
      limits?: Array<{ kind?: string; group?: string; percent?: number; severity?: string; resets_at?: string | null; is_active?: boolean }>;
    };
  };
}

/**
 * Claude exposes quota two ways, and they differ sharply in freshness:
 *
 *  1. statusline/<sessionId>/snapshot.json -- written every ~5s BY A LIVE SESSION,
 *     carries real percentages. This is the only genuinely live Claude gauge.
 *  2. .claude.json -> cachedUsageUtilization -- always present but refreshed rarely
 *     (measured 2 days stale on this machine), so it is a labelled fallback only.
 *
 * Both are recorded with their own origin so the UI can show how old a number is.
 */
function ingestLimits(ctx: IngestCtx): void {
  const now = Date.now();
  let published = false;

  const statuslineDir = join(ctx.profile.rootPath, 'statusline');
  if (existsSync(statuslineDir)) {
    let best: { snap: Snapshot; at: Millis } | null = null;
    for (const entry of readdirSync(statuslineDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const snap = readJsonFile<Snapshot>(join(statuslineDir, entry.name, 'snapshot.json'));
      if (!snap) continue;
      const at = fromIso(snap.updated_at);
      if (at == null) continue;
      // Prefer the newest snapshot that actually carries a percentage; idle sessions
      // write nulls and would otherwise mask a live reading.
      const hasPct = snap.five_hour?.used_percentage != null || snap.seven_day?.used_percentage != null;
      if (!hasPct) continue;
      if (!best || at > best.at) best = { snap, at };
    }
    if (best) {
      const { snap, at } = best;
      if (snap.five_hour?.used_percentage != null || snap.five_hour?.resets_at != null) {
        published = true;
        ctx.sink.limit({
          windowKind: '5h',
          usedPercent: snap.five_hour?.used_percentage ?? null,
          resetsAt: fromEpochAuto(snap.five_hour?.resets_at),
          severity: snap.status ?? null,
          observedAt: at,
          sourceFetchedAt: at,
          origin: 'statusline-snapshot',
        });
      }
      if (snap.seven_day?.used_percentage != null || snap.seven_day?.resets_at != null) {
        published = true;
        ctx.sink.limit({
          windowKind: 'weekly',
          usedPercent: snap.seven_day?.used_percentage ?? null,
          resetsAt: fromEpochAuto(snap.seven_day?.resets_at),
          severity: snap.status ?? null,
          observedAt: at,
          sourceFetchedAt: at,
          origin: 'statusline-snapshot',
        });
      }
    }
  }

  const cfg = readJsonFile<ClaudeConfig>(configPathFor(ctx.profile));
  const cached = cfg?.cachedUsageUtilization;
  if (cached?.utilization) {
    const fetchedAt = cached.fetchedAtMs ?? null;
    const util = cached.utilization;

    const windows: Array<[string, string]> = [
      ['five_hour', '5h'],
      ['seven_day', 'weekly'],
      ['seven_day_opus', 'weekly_opus'],
      ['seven_day_sonnet', 'weekly_sonnet'],
    ];
    for (const [key, kind] of windows) {
      const w = util[key] as UtilWindow | null | undefined;
      if (!w || typeof w !== 'object') continue;
      if (w.utilization == null && w.resets_at == null) continue;
      published = true;
      ctx.sink.limit({
        windowKind: kind as never,
        usedPercent: w.utilization ?? null,
        usedDollars: w.used_dollars ?? null,
        limitDollars: w.limit_dollars ?? null,
        resetsAt: fromIso(w.resets_at),
        observedAt: fetchedAt ?? now,
        sourceFetchedAt: fetchedAt,
        origin: 'claude.json',
      });
    }
  }

  if (published) return;

  // A readable config with no OAuth organization is the durable local indication
  // that this profile is no longer subscribed. Missing/malformed config is left in
  // waiting, because it cannot distinguish a transient read problem from logout.
  if (cfg && !cfg.oauthAccount?.organizationType) {
    ctx.sink.accountState({ state: 'inactive', reason: 'no-subscription', observedAt: now });
    return;
  }

  if (cfg?.oauthAccount?.organizationType) {
    ctx.sink.accountState({ state: 'waiting', reason: 'quota-not-published', observedAt: now });
  }
}
