import { join } from 'node:path';
import type { PetDockTarget, PetPlacement } from '../presence/types.js';
import { readJsonWithRecovery, writeJsonAtomic, type JsonRecoveryDiagnostics } from './persist.js';

/**
 * Persisted Pet placement (MULTI_MONITOR_SPEC.md §1, DRAG_REPOSITION_SPEC.md §4).
 *
 * The file started life as `{ displayId, x, y }` (v2). Wave 3 widens it to a full placement
 * with dock/home/timestamp; older files load through the migration below rather than being
 * discarded, so upgrading never resets a user's position.
 */

const FILE = 'pet-position.json';
const BACKUP_FILE = 'pet-position.last-good.json';
const PLACEMENT_SCHEMA_VERSION = 1;

/** The pre-Wave-3 shape, still accepted on read. */
export interface PetPosition {
  displayId: string;
  x: number;
  y: number;
}

export function positionPath(dataDir: string): string {
  return join(dataDir, FILE);
}

export function positionBackupPath(dataDir: string): string {
  return join(dataDir, BACKUP_FILE);
}

function parsePlacement(raw: unknown): { ok: true; value: PetPlacement } | { ok: false } {
  if (raw == null || typeof raw !== 'object') return { ok: false };
  const version = (raw as { schemaVersion?: unknown }).schemaVersion;
  if (typeof version === 'number' && version > PLACEMENT_SCHEMA_VERSION) return { ok: false };
  const placement = coercePlacement(raw);
  return placement ? { ok: true, value: placement } : { ok: false };
}

function coercePlacement(raw: unknown): PetPlacement | null {
  if (raw == null || typeof raw !== 'object') return null;
  const p = raw as Partial<PetPlacement>;
  if (typeof p.x !== 'number' || !Number.isFinite(p.x)) return null;
  if (typeof p.y !== 'number' || !Number.isFinite(p.y)) return null;
  const dock = typeof p.dock === 'string' ? (p.dock as PetDockTarget) : null;
  const homeX = typeof p.homeX === 'number' && Number.isFinite(p.homeX) ? p.homeX : null;
  const homeY = typeof p.homeY === 'number' && Number.isFinite(p.homeY) ? p.homeY : null;
  const updatedAt = typeof p.updatedAt === 'number' && Number.isFinite(p.updatedAt) ? p.updatedAt : 0;
  return {
    displayId: typeof p.displayId === 'string' ? p.displayId : null,
    x: p.x,
    y: p.y,
    dock,
    homeX,
    homeY,
    updatedAt,
  };
}

export function loadPlacement(
  dataDir: string,
  diagnostics?: JsonRecoveryDiagnostics,
): PetPlacement | null {
  return readJsonWithRecovery(positionPath(dataDir), positionBackupPath(dataDir), parsePlacement, diagnostics);
}

export function savePlacement(dataDir: string, placement: PetPlacement): void {
  try {
    writeJsonAtomic(positionPath(dataDir), { schemaVersion: PLACEMENT_SCHEMA_VERSION, ...placement });
  } catch {
    /* a lost position is not worth failing over */
  }
}

/** Backwards-compatible accessor: the legacy per-display position view of the placement. */
export function loadPetPosition(dataDir: string, displayId: string): PetPosition | null {
  const placement = loadPlacement(dataDir);
  if (!placement || placement.displayId !== displayId) return null;
  return { displayId, x: placement.x, y: placement.y };
}

/** Backwards-compatible writer used by callers that only know x/y. */
export function savePetPosition(dataDir: string, position: PetPosition): void {
  const existing = loadPlacement(dataDir);
  savePlacement(dataDir, {
    displayId: position.displayId,
    x: position.x,
    y: position.y,
    dock: existing?.dock ?? null,
    homeX: existing?.homeX ?? null,
    homeY: existing?.homeY ?? null,
    updatedAt: Date.now(),
  });
}
