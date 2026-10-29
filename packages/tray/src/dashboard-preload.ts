import { contextBridge, ipcRenderer } from 'electron';

const api = {
  /** Confirms that React mounted, rather than merely that Chromium loaded the HTML. */
  ready: (): void => ipcRenderer.send('qp-dashboard-ready'),
  /** Read the actual dashboard size without exposing other windows. */
  getWindowSize: (): Promise<{ width: number; height: number } | null> => {
    return ipcRenderer.invoke('qp-dashboard-get-window-size');
  },
  /** Sets the dashboard window size (only works in Electron context). Returns success status. */
  setWindowSize: (size: { width: number; height: number }): Promise<boolean> => {
    return ipcRenderer.invoke('qp-dashboard-set-window-size', size);
  },
};

export type QpDashboardApi = typeof api;

contextBridge.exposeInMainWorld('qpDashboard', api);
