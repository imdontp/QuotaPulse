import { copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

/**
 * Shared low-level JSON persistence used by Pet settings and placement
 * (STATE_PERSISTENCE_SPEC.md — Write strategy & Migration).
 *
 * Writes go to a temporary file first and are renamed over the target, so a
 * process killed mid-write can never leave a half-written authoritative file.
 * After every successful write the previous *known-good* file is kept beside
 * it; a load that finds the primary corrupt falls back to that last-known-good
 * copy before resigning to defaults, so an interrupted-but-parsed write (or a
 * bug that truncates the tail) never silently resets the user's choices.
 */

export interface JsonRecoveryDiagnostics {
  /** true when the primary file existed but could not be parsed */
  corrupt: boolean;
  /** true when the primary was corrupt but the last-known-good backup loaded */
  recoveredFromBackup: boolean;
}

/** Atomic JSON write: temp file + rename, creating parent dirs as needed. */
export function writeJsonAtomic(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, JSON.stringify(value, null, 2), 'utf8');
  try {
    // POSIX rename replaces an existing file atomically. Node's Windows implementation can
    // still report EEXIST when the destination is open, so keep the same durable temp-write
    // contract with a narrowly-scoped replacement fallback instead of silently losing a save.
    renameSync(tmp, path);
  } catch (error) {
    if (!existsSync(path)) throw error;
    unlinkSync(path);
    renameSync(tmp, path);
  }
}

/** Read JSON with last-known-good recovery. Returns null only when nothing usable exists. */
export function readJsonWithRecovery<T>(
  path: string,
  backupPath: string,
  parse: (raw: unknown) => { ok: true; value: T } | { ok: false },
  diagnostics?: JsonRecoveryDiagnostics,
): T | null {
  if (existsSync(path)) {
    try {
      const parsed = parse(JSON.parse(readFileSync(path, 'utf8')));
      if (parsed.ok) {
        // Healthy load: refresh the backup so it always shadows a good state.
        try {
          copyFileSync(path, backupPath);
        } catch {
          /* backup refresh is opportunistic */
        }
        return parsed.value;
      }
      // Parsed as JSON but semantically rejected (e.g. unknown future schema):
      // treat like corruption — the backup is the safer known-good state.
      if (diagnostics) diagnostics.corrupt = true;
    } catch {
      if (diagnostics) diagnostics.corrupt = true;
    }
  }
  if (existsSync(backupPath)) {
    try {
      const parsed = parse(JSON.parse(readFileSync(backupPath, 'utf8')));
      if (parsed.ok) {
        if (diagnostics) diagnostics.recoveredFromBackup = true;
        return parsed.value;
      }
    } catch {
      /* fall through */
    }
  }
  return null;
}
