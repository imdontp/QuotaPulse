/// <reference types="vite/client" />

/**
 * The PulsePet popup's Electron bridge (packages/tray/src/popup-preload.ts). Absent when
 * the page is opened in a plain browser, so every call site guards on it. The popup gets
 * its data from the normal authenticated API over the same origin; only these four
 * actions need the Electron main process.
 */
interface QpPopupBridge {
  refresh(): void;
  openDashboard(): void;
  hidePet(): void;
  showPet(): void;
  close(): void;
  /** Ask the tray for the selected mascot's SVG mark. */
  ready(): void;
  /** Receives the selected character's SVG mark, or null for the raster asset set. */
  onSprite(cb: (svg: string | null) => void): () => void;
}

interface QpDashboardBridge {
  ready(): void;
}

interface Window {
  qpPopup?: QpPopupBridge;
  qpDashboard?: QpDashboardBridge;
}
