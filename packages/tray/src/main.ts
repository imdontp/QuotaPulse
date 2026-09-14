import { app, Tray, Menu, BrowserWindow, Notification, nativeImage, shell, screen, ipcMain } from 'electron';
import { readFileSync, existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { join, resolve } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { trayIconFor, trayFrameFor, fpsFor, TRAY_FRAME_COUNT, severityFor, menuGaugeFor } from './icon.js';
import { petWindowBounds, petPopupBounds, roamWindowBounds, roamZones, type Rect } from './pet-state.js';
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
import {
  activeOwnerKey,
  createEventTracker,
  resolvePetFrame,
  statusBubble,
  daemonDownBubble,
  noDataBubble,
  snoozedBubble,
  type PetBubble,
  type PetFrame,
  type PetSettings,
  type PresenceEvent,
  type ProviderPresence,
  type Severity,
  type SubscriptionInfo,
} from './presence/index.js';
import { loadPetSettings, savePetSettings } from './pet/settings.js';
import { loadPetPosition, savePetPosition } from './pet/position.js';

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
let pet: BrowserWindow | null = null;
let quotaPopup: BrowserWindow | null = null;
let lock: Lock | null = null;
let limits: Limit[] = [];
let subscriptions: SubscriptionInfo[] = [];
let alertsEnabled = true;
/** RunCat-style tray animation + taskbar pet, each independently toggleable. */
let trayAnimationEnabled = true;
/** Current frame timer for the tray icon; restarted whenever the rate changes. */
let trayAnimTimer: NodeJS.Timeout | null = null;
let trayAnimFps = 0;
let trayFrame = 0;
/** Epoch ms of the last daemon ingest that actually recorded usage. Drives `working`. */
let lastActivityAt = 0;
/** Centre of the pet inside its strip, in CSS px; where the popup opens (pet-clicked). */
let petCenterX: number | null = null;
/** Aborts the SSE activity reader when the daemon (and so the token) changes. */
let activityAbort: AbortController | null = null;
let activityToken: string | null = null;
let daemonChild: ReturnType<typeof spawn> | null = null;
/** Highest alert step already fired per gauge, reset when its window rolls over. */
const alerted = new Map<string, AlertState>();
/** Pet Mode v2 state: settings, presence events, and the interactive bubble. */
let petSettings: PetSettings = loadPetSettings(DATA_DIR);
let petEnabled = petSettings.enabled;
let petAnchorX: number | null = null;
let petAnchorDisplayId: string | null = null;
/** Last frame rendered, so hover/click can build a bubble without re-resolving everything. */
let lastFrame: PetFrame | null = null;
/** Latest important event; gives temporary focus and the automatic bubble (spec §13, §22). */
let lastEvent: PresenceEvent | null = null;
/** Activity bubbles are throttled: listed in §22, but §3.5 forbids a stream of them. */
const ACTIVITY_BUBBLE_MS = 10 * 60_000;
let lastActivityBubbleAt = 0;
/** The interactive bubble the pet is currently showing, if any (spec §23). */
let interactiveBubble: PetBubble | null = null;
const presenceEvents = createEventTracker();

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
    if (activityAbort) {
      activityAbort.abort();
      activityAbort = null;
      activityToken = null;
    }
    render();
    return;
  }
  // A restarted daemon mints a new token; the old stream would 401 forever.
  if (activityToken !== lock.token) {
    activityAbort?.abort();
    activityAbort = new AbortController();
    activityToken = lock.token;
    void readActivityStream(lock, activityAbort.signal);
  }
  try {
    // /api/overview carries the same limits plus per-subscription telemetry, which is the
    // per-provider activity signal the Pet needs (an account reader polling every 60s
    // makes a small `ageSeconds` look active even when nobody is working).
    const res = await fetch(`http://127.0.0.1:${lock.port}/api/overview`, {
      headers: { 'x-quotapulse-token': lock.token },
    });
    if (!res.ok) throw new Error(String(res.status));
    const body = (await res.json()) as { limits: Limit[]; subscriptions?: SubscriptionInfo[] };
    limits = body.limits;
    subscriptions = body.subscriptions ?? [];
    await refreshNotifSettings(lock);
    runPresenceEvents();
    // New daemons own threshold detection and persist it while the tray is closed. Keep
    // the in-memory helper as a compatibility fallback for an older daemon during upgrade.
    if (!(await deliverPendingAlerts(lock))) checkAlerts();
  } catch {
    limits = [];
    subscriptions = [];
    lastFrame = resolvePetFrame({ limits, subscriptions, settings: petSettings });
  }
  render();
}

/**
 * Presence events (spec §18–§20): the Pet's own threshold/reset/activity detection, on top
 * of which the notification policy is applied. Only meaningful events interrupt; 50% and
 * every activity change are visible in the Pet but never raise a Windows notification.
 */
function runPresenceEvents(): void {
  const base = resolvePetFrame({
    limits,
    subscriptions,
    settings: petSettings,
    event: lastEvent,
    activeOwnerKey: activeOwnerKey(subscriptions),
  });
  const events = presenceEvents.update(base.providers);
  if (events.length === 0) return;

  // The most severe event wins the temporary focus.
  const rank: Record<string, number> = {
    reset: 4,
    critical: 3,
    warning: 2,
    'usage-half': 1,
    'activity-start': 0,
    'activity-stop': 0,
  };
  for (const event of events) {
    if (event.type === 'activity-stop') continue;
    if (event.type === 'activity-start') {
      // Spec §22 lists it, §3.5 warns about fatigue: allow it, but rarely.
      if (Date.now() - lastActivityBubbleAt < ACTIVITY_BUBBLE_MS) continue;
      lastActivityBubbleAt = Date.now();
    }
    if (!lastEvent || rank[event.type]! >= rank[lastEvent.type]!) lastEvent = event;
    notifyEvent(event, base.providers);
  }
}

/** The Windows notification half of the policy (§20): 80% once, 95%, and resets. */
function notifyEvent(event: PresenceEvent, providers: ProviderPresence[]): void {
  if (!petSettings.eventNotifications) return;
  // The Pet's notifications obey the same switch, snooze and quiet hours as the tray's
  // alert ladder. Without this, the bubble's Snooze button would be a lie.
  if (settingsSuppressed()) return;
  const provider = providers.find((p) => p.key === event.ownerKey);
  const name = provider?.name ?? event.ownerKey;
  if (event.type === 'usage-half' || event.type === 'activity-start' || event.type === 'activity-stop') return;
  const when = provider?.resetsAt ? `resets ${new Date(provider.resetsAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'no reset time reported';
  if (event.type === 'reset') {
    new Notification({ title: `${name} quota has reset`, body: 'A new quota window has started.' }).show();
    return;
  }
  new Notification({
    title: `${name}: ${Math.round(event.percent ?? 0)}% used`,
    body: event.type === 'critical' ? `Near the limit — ${when}.` : `Crossed the 80% threshold (${when}).`,
    silent: event.type !== 'critical',
  }).show();
}

/**
 * Follow the daemon's SSE feed purely to learn WHEN it recorded usage. `/api/limits`
 * carries percentages but not activity, and an account reader that polls every 60s makes
 * a small `ageSeconds` a lie about whether anyone is actually working: this event is the
 * honest signal behind the pet's `working` mood.
 */
async function readActivityStream(current: Lock, signal: AbortSignal): Promise<void> {
  while (!signal.aborted && activityToken === current.token) {
    try {
      const res = await fetch(`http://127.0.0.1:${current.port}/api/events/stream`, {
        headers: { 'x-quotapulse-token': current.token },
        signal,
      });
      if (!res.ok || !res.body) throw new Error(String(res.status));
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let cut = buf.indexOf('\n\n');
        while (cut >= 0) {
          const frame = buf.slice(0, cut);
          buf = buf.slice(cut + 2);
          const line = frame.split('\n').find((l) => l.startsWith('data:'));
          if (line) {
            try {
              const payload = JSON.parse(line.slice(5).trim()) as { newEvents?: number };
              if ((payload.newEvents ?? 0) > 0) {
                lastActivityAt = Date.now();
                pushPetState();
              }
            } catch {
              /* a malformed frame must not kill the reader */
            }
          }
          cut = buf.indexOf('\n\n');
        }
      }
    } catch {
      /* the connection dropped; fall through to the retry delay */
    }
    if (signal.aborted || activityToken !== current.token) return;
    await new Promise((r) => setTimeout(r, 3000));
  }
}

/** Cached daemon notification settings: shared by the alert ladder and the Pet's own
 *  notifications, so a Snooze or quiet-hours window silences both. */
let notifSettings: NotificationSettings | null = null;

async function refreshNotifSettings(current: Lock): Promise<void> {
  try {
    const res = await fetch(`http://127.0.0.1:${current.port}/api/notification-settings`, {
      headers: { 'x-quotapulse-token': current.token },
    });
    notifSettings = res.ok ? ((await res.json()) as NotificationSettings) : null;
  } catch {
    notifSettings = null;
  }
}

/** True when notifications are switched off, snoozed, or inside quiet hours. */
function settingsSuppressed(now = Date.now()): boolean {
  const s = notifSettings;
  if (!s) return false;
  return !s.enabled || (s.snooze_until != null && s.snooze_until > now) || inQuietHours(s);
}

/** Return false only when talking to an older daemon; a successful empty list is handled. */
async function deliverPendingAlerts(current: Lock): Promise<boolean> {
  if (!alertsEnabled) return true;
  try {
    const settings = notifSettings;
    if (!settings) return false;
    if (settingsSuppressed()) return true;
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
  driveTrayAnimation(pct);
  pushPetState();

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

  // Global summary above the per-provider rows (spec §39): the tray answers
  // "is anything at risk?", so the count by severity belongs on top.
  const summary = severitySummary(menuLimits);
  tray.setContextMenu(
    Menu.buildFromTemplate([
      {
        label: menuWorst
          ? `Worst: ${shortSource(menuWorst.display_name)} ${shortWindow(menuWorst.window_kind)} ${Math.round(menuWorst.used_percent!)}%`
          : 'No live limits',
        enabled: false,
      },
      { label: summary, enabled: false },
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
      {
        label: 'Tray animation',
        type: 'checkbox',
        checked: trayAnimationEnabled,
        click: (item) => {
          trayAnimationEnabled = item.checked;
          trayAnimFps = -1; // force the driver to restart the timer
          render();
        },
      },
      {
        label: 'Taskbar pet',
        type: 'checkbox',
        checked: petEnabled,
        click: (item) => setPetEnabled(item.checked),
      },
      { type: 'separator' },
      { label: 'Quit tray (daemon keeps running)', click: () => app.quit() },
    ]),
  );
}

/** "1 warning · 2 healthy" over the collapsed subscription rows (spec §39). */
function severitySummary(shown: Limit[]): string {
  const providers = lastFrame?.providers ?? [];
  const counts = providers.reduce<Record<Severity, number>>(
    (acc, p) => ({ ...acc, [p.severity]: acc[p.severity] + 1 }),
    { ok: 0, warn: 0, crit: 0, unknown: 0 },
  );
  const parts: string[] = [];
  if (counts.crit > 0) parts.push(`${counts.crit} critical`);
  if (counts.warn > 0) parts.push(`${counts.warn} warning`);
  if (counts.ok > 0) parts.push(`${counts.ok} healthy`);
  if (counts.unknown > 0) parts.push(`${counts.unknown} unknown`);
  if (parts.length === 0) return shown.length === 0 ? 'no quota data yet' : 'no live reading';
  return parts.join(' · ');
}

/**
 * RunCat-style tray animation: cycle 4 icon frames at a quota-derived rate.
 * The timer restarts only when the rate changes, so a steady reading costs one
 * interval; a static (null/disabled) reading shows the canonical still.
 */
function driveTrayAnimation(pct: number | null): void {
  const wantFps = trayAnimationEnabled ? fpsFor(pct) : 0;
  if (wantFps !== trayAnimFps) {
    trayAnimFps = wantFps;
    trayFrame = 0;
    if (trayAnimTimer) {
      clearInterval(trayAnimTimer);
      trayAnimTimer = null;
    }
    if (wantFps > 0 && tray) {
      trayAnimTimer = setInterval(() => {
        if (!tray) return;
        trayFrame = (trayFrame + 1) % TRAY_FRAME_COUNT;
        const menuWorst = worst(subscriptionLimits(limits));
        tray.setImage(
          nativeImage.createFromBuffer(trayFrameFor(menuWorst?.used_percent ?? null, trayFrame)),
        );
      }, 1000 / wantFps);
    }
  }
  if (wantFps === 0 && tray) {
    tray.setImage(nativeImage.createFromBuffer(trayIconFor(pct)));
  }
}

/** Primary display only for the fixed modes; Roaming uses every display (spec §34). */
function petBounds(): Rect {
  const displays = screen.getAllDisplays().map((d) => ({ id: String(d.id), ...d.workArea }));
  if (petSettings.movement === 'roaming' && displays.length > 1) {
    return roamWindowBounds(displays, screen.getPrimaryDisplay().workArea);
  }
  return petWindowBounds(screen.getPrimaryDisplay().workArea);
}

/** The pet's window rect, kept so absolute positions can be converted both ways. */
let petWindowRect: Rect | null = null;

function petHtmlPath(): string {
  return join(REPO_ROOT, 'packages', 'tray', 'src', 'pet.html');
}

function petPreloadPath(): string {
  // dist-preload, not dist: the bridges compile as CommonJS for the sandbox
  // while everything else stays ESM (see tsconfig.preload.json).
  return join(REPO_ROOT, 'packages', 'tray', 'dist-preload', 'pet-preload.js');
}

function popupPreloadPath(): string {
  return join(REPO_ROOT, 'packages', 'tray', 'dist-preload', 'popup-preload.js');
}

/**
 * The taskbar pet: a full-width, transparent, always-on-top strip pinned to the
 * bottom of the primary work area (never over the taskbar itself). The window
 * starts click-through; the renderer reports hover over the sprite so only the
 * pet itself becomes clickable -- the Shimeji-in-Electron pattern.
 */
function ensurePet(): void {
  if (pet && !pet.isDestroyed()) {
    applyPetBounds();
    return;
  }
  if (!petEnabled || !existsSync(petHtmlPath()) || !existsSync(petPreloadPath())) {
    if (petEnabled && (!existsSync(petHtmlPath()) || !existsSync(petPreloadPath()))) {
      console.error('pet assets missing; run: npm run build -w @quotapulse/tray');
    }
    return;
  }
  const bounds = petBounds();
  petWindowRect = bounds;
  pet = new BrowserWindow({
    ...bounds,
    show: true,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    focusable: false,
    hasShadow: false,
    title: 'QuotaPulse pet',
    webPreferences: {
      preload: petPreloadPath(),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });
  pet.setIgnoreMouseEvents(true, { forward: true });
  // All virtual desktops, but never above a fullscreen app.
  pet.setVisibleOnAllWorkspaces(true);
  // A dead bridge is invisible: the pet still walks (plain HTML/CSS) while every
  // click silently does nothing. Surface preload failures in the terminal instead.
  pet.webContents.on('preload-error', (_event, _path, err) => {
    console.error(`pet preload failed, clicks will not work: ${String(err)}`);
  });
  void pet.loadFile(petHtmlPath());
  pet.once('ready-to-show', () => pet?.showInactive());
  pet.webContents.on('did-finish-load', () => {
    sendPetPosition();
    pushPetState();
  });
  pet.on('closed', () => {
    pet = null;
  });
  sendPetPosition();
  pushPetState();
}

function destroyPet(): void {
  if (pet && !pet.isDestroyed()) pet.close();
  pet = null;
  petWindowRect = null;
  interactiveBubble = null;
  closeQuotaPopup();
}

/**
 * Re-apply the window rect for the current movement mode and tell the renderer where the
 * walkable zones are. Roaming changes the window from "primary strip" to "union of every
 * display", so this runs on mode changes and on display-metrics-changed.
 */
function applyPetBounds(): void {
  if (!pet || pet.isDestroyed()) return;
  const bounds = petBounds();
  petWindowRect = bounds;
  pet.setBounds(bounds);
  sendRoamZones();
}

function sendRoamZones(): void {
  if (!pet || pet.isDestroyed() || pet.webContents.isLoading()) return;
  const displays = screen.getAllDisplays().map((d) => ({ id: String(d.id), ...d.workArea }));
  const window: Rect = petWindowRect ?? petBounds();
  const zones = petSettings.movement === 'roaming' ? roamZones(displays, window) : null;
  pet.webContents.send('qp-pet-zones', zones);
}

/** Anchor as an absolute screen x, so switching modes keeps the Pet on the same pixel. */
function absolutePetX(): number {
  const window = petWindowRect ?? petBounds();
  const display = screen.getPrimaryDisplay();
  if (petAnchorDisplayId !== String(display.id)) {
    petAnchorDisplayId = String(display.id);
    petAnchorX = loadPetPosition(DATA_DIR, petAnchorDisplayId)?.x ?? null;
  }
  return petAnchorX ?? Math.round(display.workArea.x + display.workArea.width / 2 - 32);
}

/** The persisted anchor, restored so the Pet reappears where it was left (spec §36). */
function sendPetPosition(): void {
  if (!pet || pet.isDestroyed() || pet.webContents.isLoading()) return;
  const window = petWindowRect ?? petBounds();
  pet.webContents.send('qp-pet-position', absolutePetX() - window.x);
  sendRoamZones();
}

function pushPetState(): void {
  if (!pet || pet.isDestroyed() || pet.webContents.isLoading()) return;
  lastFrame = resolvePetFrame({
    limits,
    subscriptions,
    settings: petSettings,
    event: lastEvent,
    activeOwnerKey: activeOwnerKey(subscriptions),
  });
  // An interactive bubble wins over the automatic one: the user is asking, so answer.
  if (interactiveBubble) lastFrame = { ...lastFrame, bubble: interactiveBubble };
  pet.webContents.send('qp-pet-state', lastFrame);
}

/** Build the hover/click status bubble for whatever the Pet is focused on (spec §23). */
function showStatusBubble(): void {
  if (!lastFrame) pushPetState();
  const frame = lastFrame;
  if (!frame) return;
  if (frame.focus) {
    const pinned = petSettings.focusMode === 'pinned' && petSettings.pinnedOwnerKey === frame.focus.key;
    interactiveBubble = statusBubble(frame.focus, Date.now(), pinned);
  } else {
    // No provider to describe: say why. A daemon that is down and a daemon with no reading
    // yet are different problems and must not read the same (spec §45–§46).
    interactiveBubble = lock ? noDataBubble(Date.now()) : daemonDownBubble(Date.now());
  }
  pushPetState();
}

function clearStatusBubble(): void {
  if (!interactiveBubble) return;
  interactiveBubble = null;
  pushPetState();
}

/**
 * The popup anchors above the Pet. `petCenterX` is window-local, so it is converted to the
 * primary work area's coordinates first -- otherwise roaming (whose window starts at the
 * left-most monitor) would place the popup on the wrong screen.
 */
function popupBoundsForPet(): Rect {
  const workArea = screen.getPrimaryDisplay().workArea;
  const window = petWindowRect ?? petBounds();
  const absolute = petCenterX == null ? null : window.x + petCenterX;
  return petPopupBounds(workArea, absolute == null ? null : absolute - workArea.x);
}

/**
 * Lightweight quota popup, opened from the pet ONLY -- the tray keeps opening the full
 * dashboard panel (togglePopup). It is the web dashboard itself in a small frameless
 * window (`/?mode=popup`), so it uses the same shadcn styling and, crucially, the same
 * origin: a subscription hidden in Settings is hidden here too, with no sync code.
 *
 * It opens directly above the pet rather than in a screen corner (PET_MODE_SPEC).
 */
function openQuotaPopup(): void {
  if (!lock) return;
  // The popup shows the same numbers as the bubble, so the bubble would only be in the way.
  interactiveBubble = null;
  if (quotaPopup && !quotaPopup.isDestroyed()) {
    quotaPopup.setBounds(popupBoundsForPet());
    quotaPopup.reload();
    quotaPopup.show();
    quotaPopup.focus();
    return;
  }
  if (!existsSync(popupPreloadPath())) {
    console.error('popup preload missing; run: npm run build -w @quotapulse/tray');
    return;
  }
  const bounds = popupBoundsForPet();
  quotaPopup = new BrowserWindow({
    ...bounds,
    show: false,
    frame: false,
    transparent: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    roundedCorners: true,
    title: 'QuotaPulse quotas',
    webPreferences: {
      preload: popupPreloadPath(),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });
  quotaPopup.webContents.on('preload-error', (_event, _path, err) => {
    console.error(`quota popup preload failed, buttons will not work: ${String(err)}`);
  });
  void quotaPopup.loadURL(`http://127.0.0.1:${lock.port}/?mode=popup`);
  quotaPopup.once('ready-to-show', () => {
    if (!quotaPopup || quotaPopup.isDestroyed()) return;
    quotaPopup.show();
    quotaPopup.focus();
  });
  quotaPopup.on('closed', () => {
    quotaPopup = null;
  });
}

function closeQuotaPopup(): void {
  if (quotaPopup && !quotaPopup.isDestroyed()) quotaPopup.close();
  quotaPopup = null;
}

function registerCompanionIpc(): void {
  ipcMain.on('qp-pet-hover', (event, over: boolean) => {
    const sender = BrowserWindow.fromWebContents(event.sender);
    if (sender !== pet || !pet || pet.isDestroyed()) return;
    pet.setIgnoreMouseEvents(!over, { forward: true });
    if (over) showStatusBubble();
    else clearStatusBubble();
  });
  // Left click opens the details popup. Hovering already answers "how is this provider
  // doing?", so a click asking the same question would be redundant -- it opens the
  // full quota popup instead, and the double click goes straight to the dashboard.
  ipcMain.on('qp-pet-click', (_event, centerX: number) => {
    if (typeof centerX === 'number' && Number.isFinite(centerX)) petCenterX = centerX;
    openQuotaPopup();
  });
  ipcMain.on('qp-pet-open-dashboard', () => openBrowser());
  ipcMain.on('qp-pet-details', () => openQuotaPopup());
  ipcMain.on('qp-pet-context', () => openPetMenu());
  ipcMain.on('qp-pet-moved', (_event, x: number) => {
    if (typeof x !== 'number' || !Number.isFinite(x)) return;
    const window = petWindowRect ?? petBounds();
    // Stored as an absolute screen x so the same anchor survives a movement-mode switch
    // between a primary-only strip and the union window.
    petAnchorX = window.x + x;
    if (petAnchorDisplayId) savePetPosition(DATA_DIR, { displayId: petAnchorDisplayId, x: petAnchorX, y: 0 });
  });
  ipcMain.on('qp-pet-action', (_event, payload: { action?: string; ownerKey?: string | null }) => {
    const action = payload?.action;
    const ownerKey = payload?.ownerKey ?? lastFrame?.focus?.key ?? null;
    if (action === 'details') openQuotaPopup();
    if (action === 'open-dashboard') openBrowser();
    if (action === 'snooze') void snoozeNotifications(60);
    if ((action === 'pin' || action === 'unpin') && ownerKey) {
      petSettings = {
        ...petSettings,
        focusMode: action === 'pin' ? 'pinned' : 'auto',
        pinnedOwnerKey: action === 'pin' ? ownerKey : null,
      };
      savePetSettings(DATA_DIR, petSettings);
      lastEvent = null; // a pin takes effect immediately, not after the event window
      render();
    }
  });
  ipcMain.on('qp-popup-refresh', () => void fetchLimits());
  ipcMain.on('qp-popup-open-dashboard', () => openBrowser());
  ipcMain.on('qp-popup-hide-pet', () => setPetEnabled(false));
  ipcMain.on('qp-popup-show-pet', () => setPetEnabled(true));
  ipcMain.on('qp-popup-close', () => closeQuotaPopup());
}

/** Enable/disable the Pet and remember the choice (spec §37). */
function setPetEnabled(enabled: boolean): void {
  petEnabled = enabled;
  petSettings = { ...petSettings, enabled };
  savePetSettings(DATA_DIR, petSettings);
  if (enabled) ensurePet();
  else destroyPet();
  render();
}

/**
 * Snooze notification delivery for a while (spec §25 bubble action). Reuses the daemon's
 * existing setting, so it is the same snooze the dashboard offers -- one state, two places
 * to reach it.
 */
async function snoozeNotifications(minutes: number): Promise<void> {
  if (!lock) return;
  const until = Date.now() + minutes * 60_000;
  try {
    const res = await fetch(`http://127.0.0.1:${lock.port}/api/notification-settings`, {
      method: 'PUT',
      headers: { 'x-quotapulse-token': lock.token, 'content-type': 'application/json' },
      body: JSON.stringify({ snooze_until: until }),
    });
    if (!res.ok) throw new Error(String(res.status));
  } catch {
    return; // the confirmation bubble would be a lie if the write failed
  }
  interactiveBubble = snoozedBubble(minutes, Date.now());
  pushPetState();
}

/**
 * Right-click menu (spec §26): Focus, Movement, mute, hide. Built fresh each time so the
 * checked provider always matches the current presence list.
 */
function openPetMenu(): void {
  if (!pet || pet.isDestroyed()) return;
  const providers = lastFrame?.providers ?? [];
  const focusItems: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'Auto',
      type: 'radio',
      checked: petSettings.focusMode === 'auto',
      click: () => {
        petSettings = { ...petSettings, focusMode: 'auto', pinnedOwnerKey: null };
        savePetSettings(DATA_DIR, petSettings);
        lastEvent = null;
        render();
      },
    },
    ...providers.map((p) => ({
      label: p.name,
      type: 'radio' as const,
      checked: petSettings.focusMode === 'pinned' && petSettings.pinnedOwnerKey === p.key,
      click: () => {
        petSettings = { ...petSettings, focusMode: 'pinned', pinnedOwnerKey: p.key };
        savePetSettings(DATA_DIR, petSettings);
        lastEvent = null;
        render();
      },
    })),
  ];
  const movementItems: Electron.MenuItemConstructorOptions[] = (['minimal', 'companion', 'roaming'] as const).map(
    (mode) => ({
      label: mode[0]!.toUpperCase() + mode.slice(1),
      type: 'radio',
      checked: petSettings.movement === mode,
      click: () => {
        petSettings = { ...petSettings, movement: mode };
        savePetSettings(DATA_DIR, petSettings);
        // Roaming swaps the window to the union of every display; the others go back to
        // the primary strip. Re-anchor first so the Pet does not jump screens.
        applyPetBounds();
        sendPetPosition();
        pushPetState();
      },
    }),
  );
  // Spec §37: rotateIntervalMs is a setting, so it needs a way to be set.
  const rotateItems: Electron.MenuItemConstructorOptions[] = [8_000, 16_000, 30_000, 60_000].map((ms) => ({
    label: `${ms / 1000}s`,
    type: 'radio',
    checked: petSettings.rotateIntervalMs === ms,
    click: () => {
      petSettings = { ...petSettings, rotateIntervalMs: ms };
      savePetSettings(DATA_DIR, petSettings);
      pushPetState();
    },
  }));
  Menu.buildFromTemplate([
    { label: 'Open dashboard', click: openBrowser },
    { type: 'separator' },
    { label: 'Focus', submenu: focusItems },
    { label: 'Movement', submenu: movementItems },
    { label: 'Rotate every', submenu: rotateItems },
    { type: 'separator' },
    {
      label: 'Speech bubbles',
      type: 'checkbox',
      checked: petSettings.speechBubbles,
      click: (item) => {
        petSettings = { ...petSettings, speechBubbles: item.checked };
        savePetSettings(DATA_DIR, petSettings);
        if (!item.checked) clearStatusBubble();
      },
    },
    {
      label: 'Mute notifications',
      type: 'checkbox',
      checked: !petSettings.eventNotifications,
      click: (item) => {
        petSettings = { ...petSettings, eventNotifications: !item.checked };
        savePetSettings(DATA_DIR, petSettings);
      },
    },
    {
      label: 'Reduce motion',
      type: 'checkbox',
      checked: petSettings.reducedMotion,
      click: (item) => {
        petSettings = { ...petSettings, reducedMotion: item.checked };
        savePetSettings(DATA_DIR, petSettings);
        pushPetState();
      },
    },
    { type: 'separator' },
    { label: 'Hide Pet', click: () => setPetEnabled(false) },
  ]).popup({ window: pet });
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
  registerCompanionIpc();

  tray = new Tray(nativeImage.createFromBuffer(trayIconFor(null)));
  tray.on('click', togglePopup);
  render();
  ensurePet();

  // Taskbar edge / DPI / resolution changes move the work area: re-pin the pet.
  screen.on('display-metrics-changed', () => {
    if (petEnabled) applyPetBounds();
  });
  screen.on('display-added', () => {
    if (petEnabled) applyPetBounds();
  });
  screen.on('display-removed', () => {
    if (petEnabled) applyPetBounds();
  });

  void fetchLimits();
  const timer = setInterval(() => void fetchLimits(), POLL_MS);
  app.on('before-quit', () => {
    clearInterval(timer);
    if (trayAnimTimer) clearInterval(trayAnimTimer);
  });
});
