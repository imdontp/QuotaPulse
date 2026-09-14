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
}

interface Window {
  qpPopup?: QpPopupBridge;
}
