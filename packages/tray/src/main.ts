import { app, Tray, Menu, BrowserWindow, Notification, nativeImage, shell } from 'electron';
import { readFileSync, existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { join, resolve } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { trayIconFor, severityFor, menuGaugeFor } from './icon.js';
import { thresholdAlerts, type AlertState } from './alerts.js';
import {
  buildTooltip,
  subscriptionLimits,
  worst,
  isExpired,
  shortSource,
  shortWindow,
  shortAge,
  clockAt,
  type Limit,
} from './limits.js';

interface Lock {
  pid: number;
  port: number;
  token: string;
  startedAt: number;
}

interface ServerAlert {
  id: number;
  display_name: string;
  subscription_display_name: string | null;
  threshold: number;
  used_percent: number;
  window_kind: string;
  resets_at: number | null;
  detected_at: number;
}

interface NotificationSettings {
  enabled: boolean;
  snooze_until: number | null;
  quiet_start: number | null;
  quiet_end: number | null;
}

const DATA_DIR =
  process.env.QUOTAPULSE_DATA_DIR ??
  join(process.env.LOCALAPPDATA ?? join(homedir(), '.local', 'share'), 'quotapulse');
const LOCK_PATH = join(DATA_DIR, 'daemon.lock');
const REPO_ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '..', '..', '..');

const POLL_MS = 15_000;
const PANEL_WIDTH = 1280;
const PANEL_HEIGHT = 800;
const PANEL_MIN_WIDTH = 900;
const PANEL_MIN_HEIGHT = 600;

let tray: Tray | null = null;
let popup: BrowserWindow | null = null;
let lock: Lock | null = null;
let limits: Limit[] = [];
let alertsEnabled = true;
let daemonChild: ReturnType<typeof spawn> | null = null;
/** Highest alert step already fired per gauge, reset when its window rolls over. */
const alerted = new Map<string, AlertState>();

function readLock(): Lock | null {
  if (!existsSync(LOCK_PATH)) return null;
  try {
    const l = JSON.parse(readFileSync(LOCK_PATH, 'utf8')) as Lock;
    process.kill(l.pid, 0); // confirm the pid is alive
    return l;
  } catch {
    return null;
  }
}

/**
 * The daemon is deliberately a separate process: closing the tray must not stop
 * collection. We only start one if nothing is already listening, and we never kill it
 * on exit -- whoever started it owns its lifetime.
 */
function ensureDaemon(): void {
  if (readLock()) return;
  if (daemonChild) return;
  const entry = join(REPO_ROOT, 'packages', 'daemon', 'dist', 'index.js');
  if (!existsSync(entry)) {
    console.error(`daemon build not found at ${entry}; run: npm run daemon:build`);
    return;
  }
  daemonChild = spawn(process.execPath, [entry], {
    detached: true,
    stdio: 'ignore',
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
  });
  daemonChild.unref();
}

async function fetchLimits(): Promise<void> {
  lock = readLock();
  if (!lock) {
    limits = [];
    render();
    return;
  }
  try {
    const res = await fetch(`http://127.0.0.1:${lock.port}/api/limits`, {
      headers: { 'x-quotapulse-token': lock.token },
    });
    if (!res.ok) throw new Error(String(res.status));
    const body = (await res.json()) as { limits: Limit[] };
    limits = body.limits;
    // New daemons own threshold detection and persist it while the tray is closed. Keep
    // the in-memory helper as a compatibility fallback for an older daemon during upgrade.
    if (!(await deliverPendingAlerts(lock))) checkAlerts();
  } catch {
    limits = [];
  }
  render();
}

/** Return false only when talking to an older daemon; a successful empty list is handled. */
async function deliverPendingAlerts(current: Lock): Promise<boolean> {
  if (!alertsEnabled) return true;
  try {
    const settingsRes = await fetch(`http://127.0.0.1:${current.port}/api/notification-settings`, {
      headers: { 'x-quotapulse-token': current.token },
    });
    if (!settingsRes.ok) return false;
    const settings = (await settingsRes.json()) as NotificationSettings;
    if (!settings.enabled || (settings.snooze_until != null && settings.snooze_until > Date.now()) || inQuietHours(settings)) return true;
    const res = await fetch(`http://127.0.0.1:${current.port}/api/alerts?pending=1&limit=20`, {
      headers: { 'x-quotapulse-token': current.token },
    });
    if (!res.ok) return false;
    const body = (await res.json()) as { events?: ServerAlert[] };
    for (const event of body.events ?? []) {
      if (event.detected_at != null && Date.now() - event.detected_at > 15 * 60_000) {
        void fetch(`http://127.0.0.1:${current.port}/api/alerts/${event.id}/delivered`, { method: 'POST', headers: { 'x-quotapulse-token': current.token } }).catch(() => undefined);
        continue;
      }
      const when = event.resets_at
        ? `resets ${new Date(event.resets_at).toLocaleString([], { hour: '2-digit', minute: '2-digit' })}`
        : 'no reset time reported';
      new Notification({
        title: `${event.subscription_display_name ?? event.display_name}: ${Math.round(event.used_percent)}% of ${shortWindow(event.window_kind)}`,
        body: `Crossed the ${event.threshold}% threshold (${when}).`,
        silent: event.threshold < 95,
      }).show();
      void fetch(`http://127.0.0.1:${current.port}/api/alerts/${event.id}/delivered`, {
        method: 'POST',
        headers: { 'x-quotapulse-token': current.token },
      }).catch(() => undefined);
    }
    return true;
  } catch {
    return false;
  }
}

function inQuietHours(settings: NotificationSettings, now = new Date()): boolean {
  if (settings.quiet_start == null || settings.quiet_end == null || settings.quiet_start === settings.quiet_end) return false;
  const minute = now.getHours() * 60 + now.getMinutes();
  return settings.quiet_start < settings.quiet_end
    ? minute >= settings.quiet_start && minute < settings.quiet_end
    : minute >= settings.quiet_start || minute < settings.quiet_end;
}

function render(): void {
  if (!tray) return;
  const menuLimits = subscriptionLimits(limits);
  const menuWorst = worst(menuLimits);
  const pct = menuWorst?.used_percent ?? null;

  tray.setImage(nativeImage.createFromBuffer(trayIconFor(pct)));
  tray.setToolTip(buildTooltip(limits, lock != null));

  // Keep this at subscription/window grain: Codex and Hermes can be two readers of one
  // OpenAI quota, and a right-click menu should not repeat the same numbers per reader.
  const detail: Electron.MenuItemConstructorOptions[] = menuLimits.map((l) => {
    const expired = isExpired(l);
    const value = expired ? '--' : `${Math.round(l.used_percent!)}%`;
    const when = expired
      ? 'window reset, awaiting a fresh reading'
      : l.resets_at
        ? `resets ${clockAt(l.resets_at)}`
        : 'no reset time reported';
    const agePart = l.ageSeconds != null && l.ageSeconds >= 120 ? `, ${shortAge(l.ageSeconds).trim()} old` : '';
    return {
      label: `${shortSource(l.display_name)} · ${shortWindow(l.window_kind)} ${value} — ${when}${agePart}`,
      /*
       * The row's own reading as a ring, so the shape carries the number and the colour
       * carries the severity without reading the sentence. An expired window has no
       * percentage to draw, and gets the empty grey ring that matches its `--`.
       *
       * Rendered at 32px and declared scaleFactor 2, so Windows lays it out at the 16px a
       * menu icon wants while a 200% display still gets real pixels.
       */
      icon: nativeImage.createFromBuffer(menuGaugeFor(expired ? null : l.used_percent), {
        scaleFactor: 2,
      }),
      enabled: false,
    };
  });

  tray.setContextMenu(
    Menu.buildFromTemplate([
      {
        label: menuWorst
          ? `Worst: ${shortSource(menuWorst.display_name)} ${shortWindow(menuWorst.window_kind)} ${Math.round(menuWorst.used_percent!)}%`
          : 'No live limits',
        enabled: false,
      },
      { type: 'separator' },
      ...(detail.length > 0 ? detail : [{ label: 'no quota data yet', enabled: false }]),
      { type: 'separator' },
      { label: 'Open dashboard in browser', click: openBrowser },
      { label: 'Show panel', click: togglePopup },
      { label: 'Refresh now', click: () => void fetchLimits() },
      { type: 'separator' },
      {
        label: 'Threshold alerts',
        type: 'checkbox',
        checked: alertsEnabled,
        click: (item) => {
          alertsEnabled = item.checked;
        },
      },
      { type: 'separator' },
      { label: 'Quit tray (daemon keeps running)', click: () => app.quit() },
    ]),
  );
}

function checkAlerts(): void {
  if (!alertsEnabled) return;
  for (const { limit: l, step } of thresholdAlerts(limits, alerted)) {
    const pct = l.used_percent!;
    const when = l.resets_at
      ? `resets ${new Date(l.resets_at).toLocaleString([], { hour: '2-digit', minute: '2-digit' })}`
      : 'no reset time reported';
    new Notification({
      title: `${l.display_name}: ${Math.round(pct)}% of ${shortWindow(l.window_kind)}`,
      body: l.burn?.projectedFullAt && l.resets_at && l.burn.projectedFullAt < l.resets_at
        ? `At the current rate this runs out before it resets (${when}).`
        : when,
      silent: step < 95,
    }).show();
  }
}

function openBrowser(): void {
  if (!lock) return;
  void shell.openExternal(`http://127.0.0.1:${lock.port}/#live`);
}

function togglePopup(): void {
  if (popup && !popup.isDestroyed()) {
    if (popup.isVisible()) popup.hide();
    else if (lock) {
      // Returning to the panel is an intentional shortcut to the live view. Reloading
      // the existing window also lets the dashboard initialise its tab from the hash.
      void popup.loadURL(`http://127.0.0.1:${lock.port}/#live`).then(() => {
        if (!popup || popup.isDestroyed()) return;
        if (!popup.isMaximized()) popup.maximize();
        popup.show();
        popup.focus();
      });
    }
    return;
  }
  if (!lock) return;
  popup = new BrowserWindow({
    width: PANEL_WIDTH,
    height: PANEL_HEIGHT,
    minWidth: PANEL_MIN_WIDTH,
    minHeight: PANEL_MIN_HEIGHT,
    show: false,
    frame: true,
    resizable: true,
    maximizable: true,
    skipTaskbar: true,
    title: 'QuotaPulse',
    webPreferences: { nodeIntegration: false, contextIsolation: true },
  });
  // Reuses the dashboard rather than maintaining a second UI for the same numbers.
  void popup.loadURL(`http://127.0.0.1:${lock.port}/#live`);
  popup.once('ready-to-show', () => {
    if (!popup || popup.isDestroyed()) return;
    popup.maximize();
    popup.show();
    popup.focus();
  });
  popup.on('closed', () => {
    popup = null;
  });
}

app.on('window-all-closed', () => {
  // Tray app: closing the panel must not quit.
});

void app.whenReady().then(() => {
  app.setAppUserModelId('dev.quotapulse.tray');
  ensureDaemon();

  tray = new Tray(nativeImage.createFromBuffer(trayIconFor(null)));
  tray.on('click', togglePopup);
  render();

  void fetchLimits();
  const timer = setInterval(() => void fetchLimits(), POLL_MS);
  app.on('before-quit', () => clearInterval(timer));
});
