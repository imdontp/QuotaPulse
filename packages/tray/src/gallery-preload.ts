import { contextBridge, ipcRenderer } from 'electron';

/**
 * Preload bridge for the Pet Gallery settings window (PET_GALLERY_SPEC.md).
 *
 * Same sandbox constraint as pet-preload.ts: compiled as CommonJS, dependency-free
 * apart from `electron`. The renderer is pure UI; every mutation goes through an
 * invoke channel validated in the main process, so previewing states can never
 * touch quota state, event history or native notifications.
 */

const api = {
  /** The full gallery roster: stable characters + experimental preview-only entries. */
  roster: (): Promise<unknown> => ipcRenderer.invoke('qp-gallery:roster'),
  /** Current pet settings snapshot. */
  settings: (): Promise<unknown> => ipcRenderer.invoke('qp-gallery:settings'),
  /** Apply a validated partial update; returns the resulting settings. */
  update: (patch: unknown): Promise<unknown> => ipcRenderer.invoke('qp-gallery:update', patch),
  /** Ask for a preview-resolution of one preview state; never mutates live state. */
  preview: (state: string): Promise<unknown> => ipcRenderer.invoke('qp-gallery:preview', state),
  /** Placement helpers. */
  returnHome: (): Promise<void> => ipcRenderer.invoke('qp-gallery:return-home'),
  close: (): void => ipcRenderer.send('qp-gallery:close'),
};

export type QpGalleryApi = typeof api;

contextBridge.exposeInMainWorld('qpGallery', api);
