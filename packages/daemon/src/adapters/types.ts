import type { Millis } from '../util/time.js';

export interface Profile {
  /** Stable key within a harness. Claude Code has two on this machine: 'default' and 'company'. */
  profile: string;
  rootPath: string;
  displayName: string;
}

export type WindowKind =
  | '5h'
  | 'weekly'
  | 'weekly_opus'
  | 'weekly_sonnet'
  | 'credits'
  | 'session';

/**
 * A single API call, already converted to the canonical token convention
 * documented in db/schema.ts. Adapters must not emit prompt or response content.
 */
export interface UsageEvent {
  /** Unique and STABLE within a source. Re-ingesting the same call must produce the same key. */
  dedupKey: string;
  ts: Millis;
  nativeSessionId?: string | null;
  model?: string | null;
  provider?: string | null;
  effort?: string | null;
  serviceTier?: string | null;
  contextWindow?: number | null;
  inputTokens?: number;
  cachedInputTokens?: number;
  cacheWriteTokens?: number;
  outputTokens?: number;
  reasoningTokens?: number;
  /** Only set when the harness itself reports a trustworthy cost. Otherwise leave undefined. */
  costUsd?: number | null;
  costSource?: 'native';
  durationMs?: number | null;
  requestId?: string | null;
  nativeMsgId?: string | null;
  /**
   * Set when the row is a RUNNING AGGREGATE the harness keeps mutating rather than an
   * immutable per-call record (Hermes publishes only per-session-per-model totals that
   * grow as a session continues). Such rows must overwrite on conflict; append-only
   * per-call rows must not, or a re-read could revise settled history.
   */
  replaceOnConflict?: boolean;
}

export interface LimitSample {
  windowKind: WindowKind;
  usedPercent?: number | null;
  usedDollars?: number | null;
  limitDollars?: number | null;
  resetsAt?: Millis | null;
  severity?: string | null;
  /** When we read it. */
  observedAt: Millis;
  /** When the HARNESS last refreshed the underlying value. Drives the staleness badge. */
  sourceFetchedAt?: Millis | null;
  /** Which file/table it came from, so the UI can explain a stale gauge. */
  origin: string;
}

export interface SessionDim {
  nativeSessionId: string;
  cwd?: string | null;
  project?: string | null;
  gitBranch?: string | null;
  agent?: string | null;
  modelDefault?: string | null;
  startedAt?: Millis | null;
  endedAt?: Millis | null;
  lastSeenAt?: Millis | null;
  isSubagent?: boolean;
  parentSessionId?: string | null;
  /** Cost the harness computed for itself, when it publishes one (Claude cost-state). */
  nativeCostUsd?: number | null;
  nativeCostAt?: Millis | null;
  nativeLinesAdded?: number | null;
  nativeLinesRemoved?: number | null;
  nativeDurationMs?: number | null;
}

export interface Sink {
  usage(e: UsageEvent): void;
  limit(s: LimitSample): void;
  session(d: SessionDim): void;
}

/** Per-target incremental position. `targetKey` is a file path or a table name. */
export interface Cursor {
  byteOffset: number;
  fileSize: number;
  fileMtime: number;
  watermark: number;
  /**
   * Adapter state that must survive between passes.
   *
   * A pass reads only the bytes appended since the last one, so anything an adapter
   * learns from a line it has already consumed is gone by the next pass. Codex writes
   * the model and reasoning effort once per turn in a `turn_context` line and then
   * emits many `token_count` lines against it; a pass whose delta contains only the
   * latter would otherwise record every one of those calls with no model -- which is
   * exactly how 59 calls came to be unpriced. Values kept here are the ones in force
   * at `byteOffset`, so resuming reproduces what a full read would have seen.
   */
  meta?: Record<string, string | number | null>;
}

export interface CursorStore {
  get(targetKey: string): Cursor;
  set(targetKey: string, c: Partial<Cursor>): void;
  /**
   * Record that this target could not be read.
   *
   * An adapter that swallows a failure into a log line makes the Health page lie: it
   * reports zero errors because nothing ever wrote one, not because nothing failed.
   * Call this wherever you catch a read error, alongside the log. `set()` clears the
   * record on the next successful read, so what is stored is "failing right now, this
   * many times running" rather than a lifetime tally.
   */
  recordError(targetKey: string, message: string): void;
  /** Drop a recorded failure once the target reads cleanly again. */
  clearError(targetKey: string): void;
}

/**
 * The target a whole-adapter failure is filed under, when the error escaped before any
 * one file could be blamed. Parenthesised so it can never collide with a real target,
 * which is always a path or a `table:` name.
 */
export const ADAPTER_TARGET = '(adapter)';

export interface WatchTarget {
  kind: 'dir' | 'file' | 'sqlite';
  path: string;
  /** For sqlite targets we watch the -wal sidecar, which is what actually changes. */
  recursive?: boolean;
}

export interface IngestCtx {
  profile: Profile;
  sourceId: number;
  cursors: CursorStore;
  sink: Sink;
  /** True on the very first pass, when we may take a cheaper pre-aggregated path. */
  backfill: boolean;
}

export interface Adapter {
  id: string;
  displayName: string;
  /** Locate every profile of this harness on disk. Returns [] when the tool is absent. */
  detect(): Promise<Profile[]>;
  watchTargets(p: Profile): WatchTarget[];
  ingest(ctx: IngestCtx): Promise<void>;
}

export const EMPTY_CURSOR: Cursor = { byteOffset: 0, fileSize: 0, fileMtime: 0, watermark: 0, meta: {} };
