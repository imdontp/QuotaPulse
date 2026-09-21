import { join } from 'node:path';
import {
  readJsonWithRecovery,
  writeJsonAtomic,
  type JsonRecoveryDiagnostics,
} from './persist.js';
import {
  DEFAULT_PET_SETTINGS,
  DEFAULT_QUIET_HOURS,
  type PetQuietHoursConfig,
  type PetSettings,
} from '../presence/types.js';
import { coercePetCharacter } from './characters.js';

/**
 * Pet settings persistence (docs/PET_MODE_V2_SPEC.md §37–§38).
 *
 * Stored as JSON beside the daemon's own state rather than in the database: the tray owns
 * these, the daemon does not, and the tray must keep working while the daemon is down. A
 * malformed or partially-written file falls back to defaults rather than crashing the
 * shell -- losing a pin is trivial, failing to start is not.
 */

const FILE = 'pet-settings.json';
const BACKUP_FILE = 'pet-settings.last-good.json';

/**
 * Persisted-settings schema version (STATE_PERSISTENCE_SPEC.md §Migration).
 * Bump when the stored shape changes; every bump needs a deterministic,
 * idempotent migration and a test. Unknown *newer* versions are never coerced
 * in place — the loader rejects them so last-known-good recovery can engage
 * (UPDATE_COMPATIBILITY_SPEC.md §Downgrade).
 */
const SETTINGS_SCHEMA_VERSION = 4;

const MOVEMENTS = new Set(['minimal', 'companion', 'roaming']);
const FOCUS_MODES = new Set(['auto', 'pinned']);

export function settingsPath(dataDir: string): string {
  return join(dataDir, FILE);
}

export function settingsBackupPath(dataDir: string): string {
  return join(dataDir, BACKUP_FILE);
}

/**
 * Deterministic, idempotent migrations from older file shapes to the current
 * persisted shape. So far every version stores the same coerced fields, so the
 * migration just stamps the current version onto whatever coerces cleanly.
 */
function migratePersisted(raw: Record<string, unknown>): Record<string, unknown> {
  const version = typeof raw.schemaVersion === 'number' ? raw.schemaVersion : 3;
  return { ...raw, schemaVersion: Math.min(Math.max(version, SETTINGS_SCHEMA_VERSION), SETTINGS_SCHEMA_VERSION) };
}

function parsePersisted(raw: unknown): { ok: true; value: PetSettings } | { ok: false } {
  if (raw == null || typeof raw !== 'object') return { ok: false };
  const version = (raw as { schemaVersion?: unknown }).schemaVersion;
  // Never silently read a future schema: prefer last-known-good over guessing.
  if (typeof version === 'number' && version > SETTINGS_SCHEMA_VERSION) return { ok: false };
  return { ok: true, value: coerce(migratePersisted(raw as Record<string, unknown>)) };
}

/** Coerce a persisted quiet-hours object field-by-field; unknown shapes reset to defaults. */
function coerceQuietHours(raw: unknown): PetQuietHoursConfig {
  if (raw == null || typeof raw !== 'object') return { ...DEFAULT_QUIET_HOURS };
  const q = raw as Partial<PetQuietHoursConfig>;
  const bool = (value: unknown, fallback: boolean): boolean => (typeof value === 'boolean' ? value : fallback);
  return {
    enabled: bool(q.enabled, DEFAULT_QUIET_HOURS.enabled),
    startLocal: typeof q.startLocal === 'string' ? q.startLocal : DEFAULT_QUIET_HOURS.startLocal,
    endLocal: typeof q.endLocal === 'string' ? q.endLocal : DEFAULT_QUIET_HOURS.endLocal,
    suppressPetInfo: bool(q.suppressPetInfo, DEFAULT_QUIET_HOURS.suppressPetInfo),
    suppressNativeWarning: bool(q.suppressNativeWarning, DEFAULT_QUIET_HOURS.suppressNativeWarning),
    allowCritical: bool(q.allowCritical, DEFAULT_QUIET_HOURS.allowCritical),
    disableRoaming: bool(q.disableRoaming, DEFAULT_QUIET_HOURS.disableRoaming),
  };
}

function coerce(raw: unknown): PetSettings {
  if (raw == null || typeof raw !== 'object') return { ...DEFAULT_PET_SETTINGS, quietHours: { ...DEFAULT_QUIET_HOURS } };
  const p = raw as Partial<PetSettings>;
  const movement = MOVEMENTS.has(String(p.movement)) ? (p.movement as PetSettings['movement']) : DEFAULT_PET_SETTINGS.movement;
  const focusMode = FOCUS_MODES.has(String(p.focusMode)) ? (p.focusMode as PetSettings['focusMode']) : DEFAULT_PET_SETTINGS.focusMode;
  const rotate = Number(p.rotateIntervalMs);
  const cooldown = Number(p.manualMoveCooldownMs);
  const margin = Number(p.safeMarginPx);
  return {
    enabled: typeof p.enabled === 'boolean' ? p.enabled : DEFAULT_PET_SETTINGS.enabled,
    movement,
    focusMode,
    pinnedOwnerKey: typeof p.pinnedOwnerKey === 'string' && p.pinnedOwnerKey ? p.pinnedOwnerKey : null,
    rotateIntervalMs: Number.isFinite(rotate) && rotate >= 1_000 ? rotate : DEFAULT_PET_SETTINGS.rotateIntervalMs,
    speechBubbles: typeof p.speechBubbles === 'boolean' ? p.speechBubbles : DEFAULT_PET_SETTINGS.speechBubbles,
    eventNotifications:
      typeof p.eventNotifications === 'boolean' ? p.eventNotifications : DEFAULT_PET_SETTINGS.eventNotifications,
    reducedMotion: typeof p.reducedMotion === 'boolean' ? p.reducedMotion : DEFAULT_PET_SETTINGS.reducedMotion,
    // A file written before v2 has no character at all; an unknown slug falls back too,
    // and the pre-Wave-1 hyphen form (`pulse-fox`) migrates to `pulse_fox`.
    character: coercePetCharacter(p.character) ?? DEFAULT_PET_SETTINGS.character,
    lockPosition: typeof p.lockPosition === 'boolean' ? p.lockPosition : DEFAULT_PET_SETTINGS.lockPosition,
    allowCrossMonitor:
      typeof p.allowCrossMonitor === 'boolean' ? p.allowCrossMonitor : DEFAULT_PET_SETTINGS.allowCrossMonitor,
    stayNearCorner:
      typeof p.stayNearCorner === 'boolean' ? p.stayNearCorner : DEFAULT_PET_SETTINGS.stayNearCorner,
    manualMoveCooldownMs:
      Number.isFinite(cooldown) && cooldown >= 0 ? cooldown : DEFAULT_PET_SETTINGS.manualMoveCooldownMs,
    safeMarginPx:
      Number.isFinite(margin) && margin >= 0 && margin <= 200 ? margin : DEFAULT_PET_SETTINGS.safeMarginPx,
    quietHours: coerceQuietHours(p.quietHours),
    skin: typeof p.skin === 'string' && p.skin ? p.skin : DEFAULT_PET_SETTINGS.skin,
  };
}

/** A fresh copy of the defaults; nested objects are cloned so callers cannot mutate them. */
export function defaultPetSettings(): PetSettings {
  return { ...DEFAULT_PET_SETTINGS, quietHours: { ...DEFAULT_QUIET_HOURS } };
}

export function loadPetSettings(dataDir: string, diagnostics?: JsonRecoveryDiagnostics): PetSettings {
  return (
    readJsonWithRecovery(settingsPath(dataDir), settingsBackupPath(dataDir), parsePersisted, diagnostics) ??
    defaultPetSettings()
  );
}

export function savePetSettings(dataDir: string, settings: PetSettings): void {
  try {
    // The last-known-good copy is refreshed by the next healthy load, so the
    // write stays a single atomic rename.
    writeJsonAtomic(settingsPath(dataDir), { schemaVersion: SETTINGS_SCHEMA_VERSION, ...settings });
  } catch {
    /* persistence is a convenience; a failure must not take the tray down */
  }
}
