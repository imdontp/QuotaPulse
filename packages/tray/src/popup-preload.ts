/**
 * Preload bridge for the lightweight quota popup (opened from the pet only).
 *
 * The popup is now the web app itself (`/?mode=popup`), so it reads quota over the same
 * token-authenticated API as the dashboard and shares its preferences -- hiding a
 * subscription in Settings hides it here too. This bridge only carries the actions that
 * need the Electron main process.
 *
 * Same constraint as pet-preload.ts: compiled as CommonJS and kept dependency-free, or
 * the sandbox drops it with a preload-error. `import type` is erased, which is why it is
 * safe to name the state type without shipping a runtime import.
 */

import { contextBridge, ipcRenderer } from 'electron';

const api = {
  /** POST one ingest pass, then let the page refetch. */
  refresh: (): void => {
    ipcRenderer.send('qp-popup-refresh');
  },
  openDashboard: (): void => {
    ipcRenderer.send('qp-popup-open-dashboard');
  },
  hidePet: (): void => {
    ipcRenderer.send('qp-popup-hide-pet');
  },
  showPet: (): void => {
    ipcRenderer.send('qp-popup-show-pet');
  },
  close: (): void => {
    ipcRenderer.send('qp-popup-close');
  },
  /** Ask the tray for the selected mascot's mark once the page has mounted. */
  ready: (): void => {
    ipcRenderer.send('qp-popup-ready');
  },
  /**
   * The tray resolves the selected character's SVG and pushes it here, so the popup mark
   * matches the pet window without duplicating the character renderer in the web app
   * (asset spec §18). `null` means the raster asset set is in use.
   */
  onSprite: (cb: (svg: string | null) => void): (() => void) => {
    const listener = (_event: unknown, svg: string | null): void => cb(svg);
    ipcRenderer.on('qp-popup-sprite', listener);
    return () => ipcRenderer.removeListener('qp-popup-sprite', listener);
  },
};

export type QpPopupApi = typeof api;

contextBridge.exposeInMainWorld('qpPopup', api);
