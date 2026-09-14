import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { DEFAULT_PET_SETTINGS, type PetSettings } from '../presence/types.js';

/**
 * Pet settings persistence (docs/PET_MODE_V2_SPEC.md §37–§38).
 *
 * Stored as JSON beside the daemon's own state rather than in the database: the tray owns
 * these, the daemon does not, and the tray must keep working while the daemon is down. A
 * malformed or partially-written file falls back to defaults rather than crashing the
 * shell -- losing a pin is trivial, failing to start is not.
 */

const FILE = 'pet-settings.json';

const MOVEMENTS = new Set(['minimal', 'companion', 'roaming']);
const FOCUS_MODES = new Set(['auto', 'pinned']);

export function settingsPath(dataDir: string): string {
  return join(dataDir, FILE);
}

function coerce(raw: unknown): PetSettings {
  if (raw == null || typeof raw !== 'object') return { ...DEFAULT_PET_SETTINGS };
  const p = raw as Partial<PetSettings>;
  const movement = MOVEMENTS.has(String(p.movement)) ? (p.movement as PetSettings['movement']) : DEFAULT_PET_SETTINGS.movement;
  const focusMode = FOCUS_MODES.has(String(p.focusMode)) ? (p.focusMode as PetSettings['focusMode']) : DEFAULT_PET_SETTINGS.focusMode;
  const rotate = Number(p.rotateIntervalMs);
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
  };
}

export function loadPetSettings(dataDir: string): PetSettings {
  const path = settingsPath(dataDir);
  if (!existsSync(path)) return { ...DEFAULT_PET_SETTINGS };
  try {
    return coerce(JSON.parse(readFileSync(path, 'utf8')));
  } catch {
    return { ...DEFAULT_PET_SETTINGS };
  }
}

export function savePetSettings(dataDir: string, settings: PetSettings): void {
  const path = settingsPath(dataDir);
  try {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, JSON.stringify(settings, null, 2), 'utf8');
  } catch {
    /* persistence is a convenience; a failure must not take the tray down */
  }
}
