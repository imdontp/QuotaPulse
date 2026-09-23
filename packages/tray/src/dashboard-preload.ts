import { contextBridge, ipcRenderer } from 'electron';

const api = {
  /** Confirms that React mounted, rather than merely that Chromium loaded the HTML. */
  ready: (): void => ipcRenderer.send('qp-dashboard-ready'),
  /** Sets the dashboard window size (only works in Electron context). Returns success status. */
  setWindowSize: (size: { width: number; height: number }): Promise<boolean> => {
    return ipcRenderer.invoke('qp-dashboard-set-window-size', size);
  },
};

export type QpDashboardApi = typeof api;

contextBridge.exposeInMainWorld('qpDashboard', api);
