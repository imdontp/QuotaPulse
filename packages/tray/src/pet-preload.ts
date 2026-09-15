import { contextBridge, ipcRenderer } from 'electron';
import type { PetFrame } from './presence/types.js';

/**
 * Preload bridge for the desktop Pet. The renderer is presentational only: it receives a
 * fully-resolved `PetFrame` from the main process and reports interactions back. All
 * decision-making (focus, mood, bubbles, roaming policy, docking) stays in the main process.
 *
 * Wave 3 adds the desktop context: the sprite is positioned in overlay-local pixel
 * coordinates and the renderer reports drag/roam completion so the main process can persist
 * the placement and start cooldowns.
 *
 * Compiled as CommonJS (tsconfig.preload.json) because sandboxed preloads cannot use ESM
 * imports. Keep this dependency-free apart from `electron` and erased `import type`s.
 */

export interface QpPetPosition {
  x: number;
  y: number;
  originX: number;
  originY: number;
  dock: string | null;
}

export interface QpPetDesktop {
  zones: Array<{ x: number; y: number; width: number; height: number }>;
  /** Enabled exclusion zones, translated into overlay-local coordinates. */
  blocked: Array<{ x: number; y: number; width: number; height: number }>;
  lockPosition: boolean;
  reducedMotion: boolean;
  sprite: number;
}

export interface QpPetRoamTarget {
  x: number;
  y: number;
  kind: string;
}

const api = {
  onState: (cb: (frame: PetFrame) => void): (() => void) => {
    const listener = (_event: unknown, frame: PetFrame): void => cb(frame);
    ipcRenderer.on('qp-pet-state', listener);
    return () => ipcRenderer.removeListener('qp-pet-state', listener);
  },
  /** The persisted placement, in overlay-local px, plus the overlay origin for conversion. */
  onPosition: (cb: (position: QpPetPosition) => void): (() => void) => {
    const listener = (_event: unknown, position: QpPetPosition): void => cb(position);
    ipcRenderer.on('qp-pet-position', listener);
    return () => ipcRenderer.removeListener('qp-pet-position', listener);
  },
  /** Safe regions (work area minus margin) and no-go regions for local movement. */
  onDesktop: (cb: (desktop: QpPetDesktop) => void): (() => void) => {
    const listener = (_event: unknown, desktop: QpPetDesktop): void => cb(desktop);
    ipcRenderer.on('qp-pet-desktop', listener);
    return () => ipcRenderer.removeListener('qp-pet-desktop', listener);
  },
  /** A main-planned roaming burst / Return Home target, in overlay-local px. */
  onRoamTarget: (cb: (target: QpPetRoamTarget) => void): (() => void) => {
    const listener = (_event: unknown, target: QpPetRoamTarget): void => cb(target);
    ipcRenderer.on('qp-pet-roam-target', listener);
    return () => ipcRenderer.removeListener('qp-pet-roam-target', listener);
  },
  hover: (over: boolean): void => ipcRenderer.send('qp-pet-hover', over),
  /** Left click opens the quota panel directly; `centerX` positions it over the pet. */
  click: (centerX: number): void => ipcRenderer.send('qp-pet-click', centerX),
  openDashboard: (): void => ipcRenderer.send('qp-pet-open-dashboard'),
  contextMenu: (): void => ipcRenderer.send('qp-pet-context'),
  /** A bubble button was pressed: `details` | `pin` | `unpin`. */
  action: (action: string, ownerKey: string | null): void =>
    ipcRenderer.send('qp-pet-action', { action, ownerKey }),
  details: (): void => ipcRenderer.send('qp-pet-details'),
  /** Wave 3 drag lifecycle (overlay-local px); the main process clamps/snaps/persists. */
  dragStart: (): void => ipcRenderer.send('qp-pet-drag-start'),
  dragEnd: (x: number, y: number): void => ipcRenderer.send('qp-pet-drag-end', { x, y }),
  /** The Pet reached a locally-chosen resting point (Wave 2 idle reposition). */
  moved: (x: number, y: number): void => ipcRenderer.send('qp-pet-moved', { x, y }),
  /** The Pet reached a main-planned roaming / Return Home target. */
  roamed: (x: number, y: number): void => ipcRenderer.send('qp-pet-roamed', { x, y }),
  /** Mirror the renderer-owned facing direction so the engine can reason about turns. */
  facing: (direction: 'left' | 'right'): void => ipcRenderer.send('qp-pet-facing', direction),
};

export type QpPetApi = typeof api;

contextBridge.exposeInMainWorld('qpPet', api);
