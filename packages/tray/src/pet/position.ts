import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Persisted Pet anchor (docs/PET_MODE_V2_SPEC.md §36).
 *
 * `displayId` is recorded so a position measured on a monitor that is no longer connected
 * can be discarded rather than restoring the Pet off-screen. Multi-monitor is still out of
 * scope, so only the primary display's id is ever written.
 */
export interface PetPosition {
  displayId: string;
  x: number;
  y: number;
}

const FILE = 'pet-position.json';

export function positionPath(dataDir: string): string {
  return join(dataDir, FILE);
}

export function loadPetPosition(dataDir: string, displayId: string): PetPosition | null {
  const path = positionPath(dataDir);
  if (!existsSync(path)) return null;
  try {
    const raw = JSON.parse(readFileSync(path, 'utf8')) as Partial<PetPosition>;
    if (raw.displayId !== displayId) return null;
    if (typeof raw.x !== 'number' || !Number.isFinite(raw.x)) return null;
    if (typeof raw.y !== 'number' || !Number.isFinite(raw.y)) return null;
    return { displayId, x: raw.x, y: raw.y };
  } catch {
    return null;
  }
}

export function savePetPosition(dataDir: string, position: PetPosition): void {
  try {
    writeFileSync(positionPath(dataDir), JSON.stringify(position), 'utf8');
  } catch {
    /* a lost position is not worth failing over */
  }
}
