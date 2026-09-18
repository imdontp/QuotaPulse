import { contextBridge, ipcRenderer } from 'electron';

const api = {
  /** Confirms that React mounted, rather than merely that Chromium loaded the HTML. */
  ready: (): void => ipcRenderer.send('qp-dashboard-ready'),
};

export type QpDashboardApi = typeof api;

contextBridge.exposeInMainWorld('qpDashboard', api);
