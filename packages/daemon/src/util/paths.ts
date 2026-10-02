import { homedir } from 'node:os';
import { join } from 'node:path';

export const HOME = homedir();

/** Where QuotaPulse keeps its own state. Never inside a tool's directory. */
export const DATA_DIR =
  process.env.QUOTAPULSE_DATA_DIR ??
  join(process.env.LOCALAPPDATA ?? join(HOME, '.local', 'share'), 'quotapulse');

export const DB_PATH = join(DATA_DIR, 'usage.db');
/** Explicit instances must never adopt another installation's data. */
export const HAS_CUSTOM_DATA_DIR = process.env.QUOTAPULSE_DATA_DIR !== undefined;
export const LOCK_PATH = join(DATA_DIR, 'daemon.lock');
/** Optional sanitized quota events emitted by an existing harness invocation. */
export const EVENTS_DIR = join(DATA_DIR, 'events');
export const QUOTA_EVENTS_PATH = join(EVENTS_DIR, 'quota.jsonl');
export const DEFAULT_PORT = Number(process.env.QUOTAPULSE_PORT ?? 7676);

/**
 * Where the project kept its state under earlier names, newest first. This is a list
 * rather than a single path because there have been two renames: usage-trend became
 * plimsoll, and plimsoll became QuotaPulse. A machine that skipped the middle release
 * still has a usage-trend directory and nothing else, so both have to be looked for.
 */
export const LEGACY_DATA_DIRS = ['plimsoll', 'usage-trend'].map((name) =>
  join(process.env.LOCALAPPDATA ?? join(HOME, '.local', 'share'), name),
);

export const home = (...p: string[]) => join(HOME, ...p);

/**
 * Both path separators. Written as an explicit character list rather than an escaped
 * regex literal: an earlier `[\\/]` here lost a backslash in transit and silently
 * degraded to "forward slash only", which stored whole Windows paths as project names
 * for every session. There is a test pinning this.
 */
const PATH_SEPARATORS = ['/', String.fromCharCode(92)];

/**
 * Derive a human-readable project name from a working directory.
 * Claude slugifies cwd into its folder names; we prefer the real cwd when available.
 */
export function projectOf(cwd: string | null | undefined): string | null {
  if (!cwd) return null;
  let parts = [cwd];
  for (const sep of PATH_SEPARATORS) {
    parts = parts.flatMap((p) => p.split(sep));
  }
  const named = parts.filter((p) => p.length > 0);
  return named[named.length - 1] ?? null;
}
