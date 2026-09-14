import { contextBridge, ipcRenderer } from 'electron';
import type { PetFrame } from './presence/types.js';

/**
 * Preload bridge for the taskbar Pet. The renderer is presentational only: it receives a
 * fully-resolved `PetFrame` from the main process and reports interactions back. All
 * decision-making (focus, mood, bubbles) stays in the presence engine.
 *
 * Compiled as CommonJS (tsconfig.preload.json) because sandboxed preloads cannot use ESM
 * imports. Keep this dependency-free apart from `electron` and erased `import type`s.
 */

const api = {
  onState: (cb: (frame: PetFrame) => void): (() => void) => {
    const listener = (_event: unknown, frame: PetFrame): void => cb(frame);
    ipcRenderer.on('qp-pet-state', listener);
    return () => ipcRenderer.removeListener('qp-pet-state', listener);
  },
  /** The persisted anchor x, sent once the window is ready (spec §36). */
  onPosition: (cb: (x: number) => void): (() => void) => {
    const listener = (_event: unknown, x: number): void => cb(x);
    ipcRenderer.on('qp-pet-position', listener);
    return () => ipcRenderer.removeListener('qp-pet-position', listener);
  },
  /**
   * Walkable x segments for Roaming, in window-local px; `null` in the other modes.
   * A display that does not reach the taskbar line is not a zone (spec §34).
   */
  onZones: (cb: (zones: Array<{ x0: number; x1: number }> | null) => void): (() => void) => {
    const listener = (_event: unknown, zones: Array<{ x0: number; x1: number }> | null): void => cb(zones);
    ipcRenderer.on('qp-pet-zones', listener);
    return () => ipcRenderer.removeListener('qp-pet-zones', listener);
  },
  hover: (over: boolean): void => ipcRenderer.send('qp-pet-hover', over),
  /** Left click toggles the detailed bubble; `centerX` positions the popup over the pet. */
  click: (centerX: number): void => ipcRenderer.send('qp-pet-click', centerX),
  openDashboard: (): void => ipcRenderer.send('qp-pet-open-dashboard'),
  contextMenu: (): void => ipcRenderer.send('qp-pet-context'),
  /** A bubble button was pressed: `details` | `pin` | `unpin`. */
  action: (action: string, ownerKey: string | null): void =>
    ipcRenderer.send('qp-pet-action', { action, ownerKey }),
  details: (): void => ipcRenderer.send('qp-pet-details'),
  /** The pet stopped walking; persist the resting x (spec §36). */
  moved: (x: number): void => ipcRenderer.send('qp-pet-moved', x),
};

export type QpPetApi = typeof api;

contextBridge.exposeInMainWorld('qpPet', api);
