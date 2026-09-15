import { app, Tray, Menu, BrowserWindow, Notification, nativeImage, shell, screen, ipcMain } from 'electron';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { join, resolve } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { trayIconFor, trayFrameFor, fpsFor, TRAY_FRAME_COUNT, severityFor, menuGaugeFor } from './icon.js';
import { petPopupBounds, PET_SPRITE_SIZE, type Rect } from './pet-state.js';
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
  peekBubble,
  statusBubble,
  daemonDownBubble,
  noDataBubble,
  snoozedBubble,
  PET_CHARACTERS,
  isVectorCharacter,
  renderPetSvg,
  createAnimationResolver,
  readManifest,
  resolveAnimation,
  validateManifest,
  interactionForAnimation,
  resolveLayeredState,
  clampPetToRect,
  createRoamingController,
  createSceneQueue,
  defaultPlacement,
  desktopOverlayBounds,
  displayForPoint,
  dockPoint,
  homeAnchor,
  rectAround,
  recoverPlacement,
  resolvePlacementDisplay,
  resolveScenePolicy,
  resolveSkin,
  resolveSkinAccessory,
  resolveSkinAsset,
  roamingConfigFor,
  safeRegionFor,
  sceneForEvent,
  scenesForEvents,
  setManualCooldown,
  skinsForCharacter,
  snapToDock,
  DOCK_SNAP_THRESHOLD_PX,
  MANUAL_MOVE_COOLDOWN_MS,
  ONCE_DURATION_MS,
  type AnimationEvent,
  type BubbleMode,
  type PetAnimationId,
  type PetBubble,
  type PetCharacterId,
  type PetCharacterManifest,
  type PetDesktopContext,
  type PetDisplayInfo,
  type PetDockTarget,
  type PetExclusionZone,
  type PetFacing,
  type PetFrame,
  type PetInteraction,
  type PetMood,
  type PetNotificationScene,
  type PetPlacement,
  type PetSettings,
  type PresenceEvent,
  type ProviderPresence,
  type Severity,
  type SubscriptionInfo,
} from './presence/index.js';
import { MOOD_COLORS } from './pet/motion.js';
import { galleryRoster, isExperimentalCharacterId, isSelectableCharacterId } from './pet/catalog.js';
import { DEFAULT_SKIN_ID } from './pet/skins.js';
import { loadPetSettings, savePetSettings } from './pet/settings.js';
import { PetDiagnostics, isCrashLoop } from './pet/diagnostics.js';
import { loadPlacement, savePlacement } from './pet/position.js';

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
/** RunCat-style tray animation + desktop pet, each independently toggleable. */
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
const petSettingsLoadDiag = { corrupt: false, recoveredFromBackup: false };
let petSettings: PetSettings = loadPetSettings(DATA_DIR, petSettingsLoadDiag);
if (petSettingsLoadDiag.corrupt || petSettingsLoadDiag.recoveredFromBackup) {
  console.warn(
    `[pet] settings recovery: primary=${petSettingsLoadDiag.corrupt ? 'corrupt' : 'ok'} ` +
      `backup=${petSettingsLoadDiag.recoveredFromBackup ? 'used' : 'clean'}`,
  );
}
let petEnabled = petSettings.enabled;
/** Wave 3: absolute desktop placement (display/x/y/dock/home) is the position source. */
let petPlacement: PetPlacement | null = null;
/** Wave 3: user-defined no-go rectangles, loaded from `pet-exclusion-zones.json`. */
let petExclusionZones: PetExclusionZone[] = [];
let petDragging = false;
/** True while a warning/critical/reset intro is playing; roaming must stay put. */
let petUrgentInteractionActive = false;
let petUrgentTimer: NodeJS.Timeout | null = null;
/** Wave 3 roaming controller + notification-scene queue (dedupe lives in the queue). */
const roamingController = createRoamingController();
const sceneQueue = createSceneQueue();
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

/** Wave 1 animation runtime (Next Handoff Pack): resolver, manifests, transient queues. */
const animationResolver = createAnimationResolver();
let pendingAnimationEvents: AnimationEvent[] = [];
let pendingInteraction: PetInteraction = null;
const characterManifests = new Map<PetCharacterId, PetCharacterManifest>();
const warnedAnimationKeys = new Set<string>();
const petDiagnostics = new PetDiagnostics();
let rendererCrashes: number[] = [];
let petSafeMode = false;
const ASSETS_DIR = join(REPO_ROOT, 'packages', 'tray', 'assets');
/** Wave 2 behavior inputs: whether the pointer is on the Pet, and last user interaction. */
let petHovering = false;
let lastUserInteractionAt = Date.now();
/** Wave 2 facing (renderer-owned, mirrored here so the engine can reason about turns). */
let petFacing: PetFacing = 'right';
/** Peek on hover, expanded on click (Wave 2 INTERACTION_AND_BUBBLE_SPEC.md §4). */
let bubbleMode: BubbleMode = 'peek';
/** Auto-dismiss for the expanded bubble: it must not linger forever. */
let bubbleDismissTimer: NodeJS.Timeout | null = null;

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

/** Presence event -> the Wave 1 once-animation whose duration bounds the interruption. */
const URGENT_ONCE_KEY = {
  warning: 'warning_intro',
  critical: 'critical_intro',
  reset: 'reset_celebrate',
} as const;

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
    // Transient animation intros (Phase D): a threshold/reset event temporarily overrides
    // the persistent loop in the resolver, then settles back into it.
    if (event.type === 'critical' || event.type === 'warning' || event.type === 'reset') {
      pendingAnimationEvents.push({ type: event.type });
      // An urgent intro is an interruption: roaming pauses until it finishes.
      markUrgent(ONCE_DURATION_MS[URGENT_ONCE_KEY[event.type]]);
      roamingController.onUrgent();
    }
  }

  // Wave 3 scene policy: dedupe by provider/window/kind/step, then apply quiet hours to
  // decide whether the scene may raise a native notification.
  const options = scenePolicyOptions();
  for (const scene of scenesForEvents(events, base.providers)) {
    if (!sceneQueue.enqueue(scene)) continue;
    const policy = resolveScenePolicy(scene, options);
    if (policy.native) notifyScene(scene, base.providers, policy.sound);
  }
}

/** The Windows notification half of the scene policy (§20, §2). */
function notifyScene(scene: PetNotificationScene, providers: ProviderPresence[], sound: boolean): void {
  const provider = providers.find((p) => p.key === scene.ownerKey);
  const when = provider?.resetsAt
    ? ` (resets ${new Date(provider.resetsAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`
    : '';
  new Notification({ title: scene.title, body: `${scene.body ?? ''}${when}`.trim(), silent: !sound }).show();
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
        label: 'Desktop pet',
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

/** The current display layout as the desktop layer needs it (logical DIP coordinates). */
function currentDisplays(): PetDisplayInfo[] {
  const primaryId = String(screen.getPrimaryDisplay().id);
  return screen.getAllDisplays().map((d) => ({
    id: String(d.id),
    primary: String(d.id) === primaryId,
    bounds: { x: d.bounds.x, y: d.bounds.y, width: d.bounds.width, height: d.bounds.height },
    workArea: { x: d.workArea.x, y: d.workArea.y, width: d.workArea.width, height: d.workArea.height },
    scaleFactor: d.scaleFactor,
  }));
}

function primaryDisplayOf(displays: readonly PetDisplayInfo[]): PetDisplayInfo {
  return displays.find((d) => d.primary) ?? displays[0]!;
}

/**
 * The Pet window is one transparent overlay over the union of every display's work area
 * (MULTI_MONITOR_SPEC.md §5). The sprite is positioned inside it in absolute desktop
 * coordinates, which is what makes drag, docking and multi-monitor roaming one mechanism.
 */
function petBounds(): Rect {
  const displays = currentDisplays();
  const fallback = primaryDisplayOf(displays).workArea;
  return desktopOverlayBounds(displays, fallback, 'workArea');
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

function galleryHtmlPath(): string {
  return join(REPO_ROOT, 'packages', 'tray', 'src', 'gallery.html');
}

function galleryPreloadPath(): string {
  return join(REPO_ROOT, 'packages', 'tray', 'dist-preload', 'gallery-preload.js');
}

/** Load and revalidate the saved placement, repairing it after a monitor/DPI change. */
function ensurePlacement(): PetPlacement {
  const displays = currentDisplays();
  const primary = primaryDisplayOf(displays);
  if (!petPlacement) {
    const saved = loadPlacement(DATA_DIR);
    petPlacement = saved
      ? recoverPlacement(saved, displays, PET_SPRITE_SIZE, petExclusionZones, petSettings.safeMarginPx)
      : defaultPlacement(primary, PET_SPRITE_SIZE, petSettings.safeMarginPx);
  } else {
    petPlacement = recoverPlacement(
      petPlacement,
      displays,
      PET_SPRITE_SIZE,
      petExclusionZones,
      petSettings.safeMarginPx,
    );
  }
  return petPlacement;
}

/** The full desktop context the roaming controller reasons about (Wave 3 runtime contract). */
function petDesktopContext(): PetDesktopContext {
  return {
    displays: currentDisplays(),
    exclusionZones: petExclusionZones,
    placement: ensurePlacement(),
    roaming: roamingConfigFor(petSettings),
    quietHours: petSettings.quietHours,
    reducedMotion: petSettings.reducedMotion,
    userHovering: petHovering,
    userDragging: petDragging,
    bubbleExpanded: bubbleMode === 'expanded' && !!interactiveBubble,
    urgentInteractionActive: petUrgentInteractionActive,
    petVisible: !!pet && !pet.isDestroyed() && pet.isVisible(),
  };
}

/** User-defined no-go zones, if the user configured any (SAFE_ZONE_SPEC.md §3). */
function loadExclusionZones(): void {
  const path = join(DATA_DIR, 'pet-exclusion-zones.json');
  if (!existsSync(path)) return;
  try {
    const raw = JSON.parse(readFileSync(path, 'utf8')) as unknown;
    if (!Array.isArray(raw)) return;
    petExclusionZones = raw.filter(
      (z): z is PetExclusionZone =>
        !!z &&
        typeof z === 'object' &&
        typeof (z as PetExclusionZone).id === 'string' &&
        typeof (z as PetExclusionZone).displayId === 'string' &&
        ['x', 'y', 'width', 'height'].every((k) => Number.isFinite((z as Record<string, unknown>)[k])),
    );
  } catch {
    /* a malformed zone file must not take the pet down */
  }
}

/** Persist the user's exclusion zones (SAFE_ZONE_SPEC.md §3). */
function saveExclusionZones(): void {
  try {
    writeFileSync(join(DATA_DIR, 'pet-exclusion-zones.json'), JSON.stringify(petExclusionZones, null, 2), 'utf8');
  } catch {
    /* a lost zone list is annoying, not fatal */
  }
}

/** Revalidate the placement (it may now sit inside a zone) and refresh the renderer. */
function revalidatePlacementAfterZoneChange(): void {
  petPlacement = ensurePlacement();
  savePlacement(DATA_DIR, petPlacement);
  roamingController.onGeometryChanged();
  sendPetPosition();
  pushPetState();
}

/** Freeze the Pet's current footprint (plus bubble headroom) as a no-go region. */
function addExclusionZoneAroundPet(): void {
  const placement = ensurePlacement();
  const displays = currentDisplays();
  const display =
    displayForPoint(
      displays,
      placement.x + PET_SPRITE_SIZE / 2,
      placement.y + PET_SPRITE_SIZE / 2,
    ) ?? primaryDisplayOf(displays);
  petExclusionZones = [
    ...petExclusionZones,
    {
      id: `zone-${Date.now()}-${petExclusionZones.length + 1}`,
      displayId: display.id,
      ...rectAround(placement.x, placement.y, PET_SPRITE_SIZE, 8),
      enabled: true,
    },
  ];
  saveExclusionZones();
  revalidatePlacementAfterZoneChange();
}

function toggleExclusionZone(id: string, enabled: boolean): void {
  petExclusionZones = petExclusionZones.map((zone) => (zone.id === id ? { ...zone, enabled } : zone));
  saveExclusionZones();
  revalidatePlacementAfterZoneChange();
}

function clearExclusionZones(): void {
  petExclusionZones = [];
  saveExclusionZones();
  revalidatePlacementAfterZoneChange();
}

/**
 * The desktop pet: one transparent, always-on-top, click-through overlay covering the union
 * of every display's work area (never the taskbar itself). The sprite is placed at absolute
 * coordinates inside it, which is what makes drag, docking and multi-monitor roaming work.
 * The window starts click-through; the renderer reports hover over the sprite so only the
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
    sendDesktop();
    sendPetPosition();
    pushPetState();
  });
  // Wave 4 crash-loop protection (CRASH_RECOVERY_SPEC.md §6): three renderer
  // crashes inside ten minutes puts the pet into safe mode (minimal motion,
  // static-friendly) and stops silent reboots; diagnostics note it.
  pet.webContents.on('render-process-gone', (_event, details) => {
    petDiagnostics.count('rendererRestarts');
    const now = Date.now();
    rendererCrashes = rendererCrashes.filter((t) => now - t <= 600_000);
    rendererCrashes.push(now);
    if (!isCrashLoop(rendererCrashes, now)) return;
    rendererCrashes = [];
    if (petSafeMode) return; // already degraded; stay down rather than flapping
    petSafeMode = true;
    console.warn('[pet] renderer crash loop detected; entering safe mode (minimal motion)');
    petSettings = {
      ...petSettings,
      movement: 'minimal',
      allowCrossMonitor: false,
      reducedMotion: true,
      skin: DEFAULT_SKIN_ID,
    };
    savePetSettings(DATA_DIR, petSettings);
  });
  pet.on('closed', () => {
    pet = null;
  });
  sendDesktop();
  sendPetPosition();
  pushPetState();
}

function destroyPet(): void {
  if (pet && !pet.isDestroyed()) pet.close();
  pet = null;
  petWindowRect = null;
  interactiveBubble = null;
  petDragging = false;
  roamingController.reset();
  closeQuotaPopup();
}

/**
 * Re-apply the overlay rectangle after a movement-mode or display change, and tell the
 * renderer where the safe regions are. The overlay itself never moves -- only the sprite
 * inside it does.
 */
function applyPetBounds(): void {
  if (!pet || pet.isDestroyed()) return;
  const bounds = petBounds();
  petWindowRect = bounds;
  pet.setBounds(bounds);
  sendDesktop();
  sendPetPosition();
}

/** Safe regions (work area minus margin) in overlay-local coordinates, for renderer clamps. */
function sendDesktop(): void {
  if (!pet || pet.isDestroyed() || pet.webContents.isLoading()) return;
  const overlay = petWindowRect ?? petBounds();
  const zones = currentDisplays()
    .map((d) => safeRegionFor(d, petSettings.safeMarginPx))
    .filter((region): region is NonNullable<typeof region> => region != null)
    .map((region) => ({
      x: region.x - overlay.x,
      y: region.y - overlay.y,
      width: region.width,
      height: region.height,
    }));
  pet.webContents.send('qp-pet-desktop', {
    zones,
    lockPosition: petSettings.lockPosition,
    reducedMotion: petSettings.reducedMotion,
    sprite: PET_SPRITE_SIZE,
  });
}

/** The persisted placement, restored so the Pet reappears where it was left (spec §36). */
function sendPetPosition(): void {
  if (!pet || pet.isDestroyed() || pet.webContents.isLoading()) return;
  const overlay = petWindowRect ?? petBounds();
  const placement = ensurePlacement();
  pet.webContents.send('qp-pet-position', {
    x: placement.x - overlay.x,
    y: placement.y - overlay.y,
    originX: overlay.x,
    originY: overlay.y,
    dock: placement.dock,
  });
}

/** Ask the renderer to walk/glide to an absolute target; `kind` only labels the intent. */
function sendRoamTarget(target: { x: number; y: number }, kind: string): void {
  if (!pet || pet.isDestroyed() || pet.webContents.isLoading()) return;
  const overlay = petWindowRect ?? petBounds();
  pet.webContents.send('qp-pet-roam-target', {
    x: target.x - overlay.x,
    y: target.y - overlay.y,
    kind,
  });
}

function isPoint(value: unknown): value is { x: number; y: number } {
  return (
    !!value &&
    typeof value === 'object' &&
    Number.isFinite((value as { x?: unknown }).x) &&
    Number.isFinite((value as { y?: unknown }).y)
  );
}

/** Persist an overlay-local sprite position as the new absolute placement. */
function persistLocalPosition(local: { x: number; y: number }): void {
  const overlay = petWindowRect ?? petBounds();
  const absX = overlay.x + local.x;
  const absY = overlay.y + local.y;
  const displays = currentDisplays();
  const display =
    displayForPoint(displays, absX + PET_SPRITE_SIZE / 2, absY + PET_SPRITE_SIZE / 2) ??
    primaryDisplayOf(displays);
  const current = petPlacement ?? ensurePlacement();
  petPlacement = {
    displayId: display.id,
    x: Math.round(absX),
    y: Math.round(absY),
    dock: current.dock,
    homeX: current.homeX,
    homeY: current.homeY,
    updatedAt: Date.now(),
  };
  savePlacement(DATA_DIR, petPlacement);
}

/**
 * Finish a user drag (DRAG_REPOSITION_SPEC.md §1): clamp into the work area, snap to a dock
 * when close, persist the placement, and start the manual-placement cooldown.
 */
function finishDrag(local: { x: number; y: number }): void {
  petDragging = false;
  if (petSettings.lockPosition) return;
  const overlay = petWindowRect ?? petBounds();
  const displays = currentDisplays();
  const absX = overlay.x + local.x;
  const absY = overlay.y + local.y;
  const display =
    displayForPoint(displays, absX + PET_SPRITE_SIZE / 2, absY + PET_SPRITE_SIZE / 2) ??
    primaryDisplayOf(displays);
  const current = petPlacement ?? ensurePlacement();
  const home = homeAnchor(current, display, PET_SPRITE_SIZE, petSettings.safeMarginPx);
  const snapped = snapToDock(
    absX,
    absY,
    PET_SPRITE_SIZE,
    display,
    petSettings.safeMarginPx,
    DOCK_SNAP_THRESHOLD_PX,
    home,
  );
  let x: number;
  let y: number;
  let dock: PetDockTarget | null;
  if (snapped) {
    x = snapped.x;
    y = snapped.y;
    dock = snapped.dock;
  } else {
    const clamped = clampPetToRect(absX, absY, PET_SPRITE_SIZE, display.workArea);
    x = clamped.x;
    y = clamped.y;
    dock = null;
  }
  // A manual drag becomes the new home anchor (DRAG_REPOSITION_SPEC.md §5).
  petPlacement = { displayId: display.id, x, y, dock, homeX: x, homeY: y, updatedAt: Date.now() };
  savePlacement(DATA_DIR, petPlacement);
  roamingController.onDragEnd(petDesktopContext(), Date.now());
  sendPetPosition();
  sendDesktop();
  pushPetState();
}

/** Context menu "Return Home" (DOCK_AND_SNAP_SPEC.md §4). */
function returnHome(): void {
  const displays = currentDisplays();
  const current = ensurePlacement();
  const display = resolvePlacementDisplay(current, displays) ?? primaryDisplayOf(displays);
  const home = homeAnchor(current, display, PET_SPRITE_SIZE, petSettings.safeMarginPx);
  const canTravel = pet && !pet.isDestroyed() && !pet.webContents.isLoading();
  if (!petSettings.reducedMotion && canTravel) {
    // A short travel animation is optional; reduced motion moves immediately (spec §4).
    sendRoamTarget(home, 'home');
    return;
  }
  petPlacement = { ...current, displayId: display.id, x: home.x, y: home.y, updatedAt: Date.now() };
  savePlacement(DATA_DIR, petPlacement);
  sendPetPosition();
  pushPetState();
}

/** Move the Pet to one of the named dock points (DOCK_AND_SNAP_SPEC.md §1). */
function applyDock(dock: PetDockTarget): void {
  const displays = currentDisplays();
  const current = ensurePlacement();
  const display = resolvePlacementDisplay(current, displays) ?? primaryDisplayOf(displays);
  const home = homeAnchor(current, display, PET_SPRITE_SIZE, petSettings.safeMarginPx);
  const point = dockPoint(display, dock, PET_SPRITE_SIZE, petSettings.safeMarginPx, home);
  if (!point) return;
  // Docking is an intentional placement, so it also becomes the Return Home anchor.
  petPlacement = {
    ...current,
    displayId: display.id,
    x: point.x,
    y: point.y,
    dock,
    homeX: point.x,
    homeY: point.y,
    updatedAt: Date.now(),
  };
  savePlacement(DATA_DIR, petPlacement);
  sendPetPosition();
  pushPetState();
}

/** Patch one quiet-hours field and persist (NOTIFICATION_SCENES_SPEC.md §7). */
function updateQuietHours(patch: Partial<PetSettings['quietHours']>): void {
  petSettings = { ...petSettings, quietHours: { ...petSettings.quietHours, ...patch } };
  savePetSettings(DATA_DIR, petSettings);
  sceneQueue.clear();
  pushPetState();
}

/** Mark an urgent interaction (warning/critical/reset intro) so roaming pauses meanwhile. */
function markUrgent(ms: number): void {
  petUrgentInteractionActive = true;
  if (petUrgentTimer) clearTimeout(petUrgentTimer);
  petUrgentTimer = setTimeout(() => {
    petUrgentTimer = null;
    petUrgentInteractionActive = false;
  }, ms);
}

/** The interruption policy inputs shared by the scene queue and the notification path. */
function scenePolicyOptions(): {
  quietHours: PetSettings['quietHours'];
  petAlerts: boolean;
  nativeAlerts: boolean;
  sounds: boolean;
  criticalOverride: boolean;
} {
  const suppressed = settingsSuppressed();
  return {
    quietHours: petSettings.quietHours,
    petAlerts: petSettings.speechBubbles,
    nativeAlerts: petSettings.eventNotifications && !suppressed,
    sounds: petSettings.eventNotifications && !suppressed,
    criticalOverride: petSettings.quietHours.allowCritical,
  };
}

/**
 * The event allowed to raise an automatic bubble, after the scene policy. Focus and
 * animation still follow `lastEvent`; only the interruption is suppressed (quiet hours).
 */
function bubbleEventForCurrent(): PresenceEvent | null {
  if (!lastEvent) return null;
  const provider = lastFrame?.providers.find((p) => p.key === lastEvent!.ownerKey);
  const scene = sceneForEvent(lastEvent, provider);
  if (!scene) return null;
  return resolveScenePolicy(scene, scenePolicyOptions()).showBubble ? lastEvent : null;
}

/**
 * Wave 3 roaming tick: ask the controller whether a burst is due, and if so send the target
 * to the renderer. It runs on a slow timer, so the 45-180s cadence costs almost nothing.
 */
function driveRoaming(): void {
  if (!pet || pet.isDestroyed() || !petEnabled || pet.webContents.isLoading()) return;
  const ctx = petDesktopContext();
  const display =
    displayForPoint(ctx.displays, ctx.placement.x, ctx.placement.y) ?? primaryDisplayOf(ctx.displays);
  const command = roamingController.update(ctx, display, PET_SPRITE_SIZE, petSettings.safeMarginPx);
  if (!command) return;
  sendRoamTarget(command.target, command.target.kind);
}

/** Revalidate placement and pause roaming after any display layout change. */
function onDisplayChange(): void {
  if (!petEnabled) return;
  const before = petPlacement;
  const after = ensurePlacement();
  roamingController.onGeometryChanged();
  applyPetBounds();
  sendPetPosition();
  pushPetState();
  if (before && (before.displayId !== after.displayId || before.x !== after.x || before.y !== after.y)) {
    savePlacement(DATA_DIR, after);
  }
}

function pushPetState(): void {
  // Resolve regardless of whether the pet window is open: the tray menu summary, the
  // status bubble and the quota popup's mascot all read `lastFrame`.
  lastFrame = resolvePetFrame({
    limits,
    subscriptions,
    settings: petSettings,
    event: lastEvent,
    activeOwnerKey: activeOwnerKey(subscriptions),
    // Quiet hours suppresses the automatic bubble but not the mood/focus it represents.
    bubbleEvent: bubbleEventForCurrent(),
  });
  // An interactive bubble wins over the automatic one: the user is asking, so answer.
  if (interactiveBubble) lastFrame = { ...lastFrame, bubble: interactiveBubble };
  lastFrame = applyAnimation(lastFrame);
  if (pet && !pet.isDestroyed() && !pet.webContents.isLoading()) {
    pet.webContents.send('qp-pet-state', lastFrame);
  }
  sendPopupSprite();
}

/**
 * The quota popup shows the same mascot as the Pet (asset spec §18). The tray already
 * resolved the character, so it sends the mark rather than making the web app duplicate
 * the renderer; `null` tells the popup to fall back to the raster asset set.
 */
function sendPopupSprite(): void {
  if (!quotaPopup || quotaPopup.isDestroyed() || quotaPopup.webContents.isLoading()) return;
  const frame = lastFrame;
  if (!frame) return;
  const mood: PetMood =
    frame.global.severity === 'crit' ? 'critical' : frame.global.severity === 'warn' ? 'warning' : 'healthy';
  quotaPopup.webContents.send(
    'qp-popup-sprite',
    isVectorCharacter(frame.character)
      ? renderPetSvg(frame.character, mood, {
          color: MOOD_COLORS[mood],
          percent: frame.global.highest?.usedPercent ?? null,
        })
      : null,
  );
}

/** Load + validate the four character manifests (Next Handoff Pack Phase A). */
function loadCharacterManifests(): void {
  for (const c of PET_CHARACTERS) {
    // Manifest ids are underscore (`orbit_bot`); asset folders are hyphen (`orbit-bot`).
    const path = join(ASSETS_DIR, 'pets', c.id.replace(/_/g, '-'), 'manifest.json');
    if (!existsSync(path)) {
      console.error(`[pet] manifest missing for ${c.id}: ${path}`);
      continue;
    }
    try {
      const { manifest, validation } = readManifest(path);
      // Wave 4 (CRASH_RECOVERY_SPEC.md §Manifest corruption): an invalid or
      // incompatible manifest is never partially activated. The character is
      // simply absent from the runtime map and the renderer falls back to the
      // vector placeholder / known-good default chain.
      if (!validation.ok) {
        for (const issue of validation.issues) {
          console.error(`[pet] manifest ${c.id} invalid at ${issue.path}: ${issue.message}`);
        }
        continue;
      }
      characterManifests.set(c.id, manifest);
    } catch (err) {
      console.error(`[pet] manifest ${c.id} unreadable: ${String(err)}`);
    }
  }
}

/** `/assets/pets/x/y.webp` -> a URL the pet window can load, when the file exists on disk. */
function localAssetUrl(src: string): string | null {
  const rel = src.replace(/^\/?assets\//, '');
  return existsSync(join(ASSETS_DIR, rel)) ? `../assets/${rel}` : null;
}

// ---------------------------------------------------------------------------
// Pet Gallery (PET_GALLERY_SPEC.md) — one predictable place to configure Pet
// Mode. The gallery window is pure UI: roster data is served by the main
// process, every mutation is validated here, and preview states are resolved
// against manifests without ever touching quota state, event history, native
// notifications or roaming.
// ---------------------------------------------------------------------------

let galleryWindow: Electron.BrowserWindow | null = null;

const GALLERY_PREVIEW_ANIMATIONS: Record<string, PetAnimationId> = {
  healthy: 'healthy_idle',
  working: 'working_loop',
  warning: 'warning_loop',
  critical: 'critical_loop',
  reset: 'reset_celebrate',
};

function showGallery(): void {
  if (galleryWindow && !galleryWindow.isDestroyed()) {
    galleryWindow.focus();
    return;
  }
  galleryWindow = new BrowserWindow({
    width: 560,
    height: 720,
    autoHideMenuBar: true,
    title: 'QuotaPulse Pet Gallery',
    webPreferences: { preload: galleryPreloadPath(), contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  galleryWindow.on('closed', () => {
    galleryWindow = null;
  });
  void galleryWindow.loadFile(galleryHtmlPath());
}

interface GalleryUpdateResult {
  settings: unknown;
  error?: string;
}

/**
 * Validate + apply a gallery patch. Experimental character ids are always
 * rejected here — concept art never flips a pet to selectable — and unknown
 * fields are ignored rather than trusted (CUSTOMIZATION_STATE_MODEL.md §Rules).
 */
function applyGalleryPatch(patch: unknown): GalleryUpdateResult {
  if (patch == null || typeof patch !== 'object' || Array.isArray(patch)) {
    return { settings: petSettings, error: 'invalid patch' };
  }
  const p = patch as Record<string, unknown>;
  const next: PetSettings = { ...petSettings };
  let characterError: string | undefined;

  if (typeof p.character === 'string') {
    if (!isSelectableCharacterId(p.character)) {
      characterError = isExperimentalCharacterId(p.character)
        ? 'Experimental characters cannot be activated until promoted'
        : 'Unknown character';
    } else {
      next.character = p.character;
      next.skin = DEFAULT_SKIN_ID; // new character -> its default skin
    }
  }
  if (typeof p.skin === 'string' && p.skin) {
    const compatible = skinsForCharacter(next.character).some((skin) => skin.id === p.skin);
    if (!compatible) {
      return { settings: petSettings, error: 'skin is not compatible with this character' };
    }
    next.skin = p.skin;
  }
  if (typeof p.movement === 'string' && p.movement !== next.movement) {
    if (p.movement === 'minimal' || p.movement === 'companion' || p.movement === 'roaming') {
      next.movement = p.movement;
    }
  }
  if (p.flags != null && typeof p.flags === 'object' && !Array.isArray(p.flags)) {
    for (const [key, value] of Object.entries(p.flags as Record<string, unknown>)) {
      if (typeof value !== 'boolean') continue;
      if (key === 'speechBubbles' || key === 'eventNotifications' || key === 'reducedMotion' || key === 'lockPosition' || key === 'allowCrossMonitor' || key === 'stayNearCorner') {
        (next as unknown as Record<string, unknown>)[key] = value;
      }
    }
  }
  if (p.quiet != null && typeof p.quiet === 'object' && !Array.isArray(p.quiet)) {
    const q = p.quiet as Record<string, unknown>;
    if (typeof q.allowCritical === 'boolean') next.quietHours.allowCritical = q.allowCritical;
    if (typeof q.suppressPetInfo === 'boolean') next.quietHours.suppressPetInfo = q.suppressPetInfo;
    if (typeof q.disableRoaming === 'boolean') next.quietHours.disableRoaming = q.disableRoaming;
  }

  petSettings = next;
  savePetSettings(DATA_DIR, petSettings);
  pushPetState();
  return { settings: petSettings, error: characterError };
}

/** Serialize the live settings for the gallery, including nested quiet hours. */
function gallerySettingsPayload(): PetSettings {
  return { ...petSettings, quietHours: { ...petSettings.quietHours } };
}

/** Resolve a preview state against the current manifest; read-only (spec §5). */
function galleryPreviewPayload(state: string): { src: string | null; animation: string; fellBack: boolean } {
  const animation = GALLERY_PREVIEW_ANIMATIONS[state];
  const manifest = characterManifests.get(petSettings.character);
  if (!animation || !manifest) return { src: null, animation: String(animation ?? state), fellBack: false };
  const resolved = resolveAnimation(manifest, animation, { reducedMotion: false });
  return { src: resolved.src, animation: resolved.animation, fellBack: resolved.fellBack };
}

function registerGalleryIpc(): void {
  ipcMain.handle('qp-gallery:roster', () => ({
    entries: galleryRoster(),
    skins: skinsForCharacter(petSettings.character),
    movementModes: ['minimal', 'companion', 'roaming'],
  }));
  ipcMain.handle('qp-gallery:settings', () => gallerySettingsPayload());
  ipcMain.handle('qp-gallery:update', (_event, patch: unknown): GalleryUpdateResult => applyGalleryPatch(patch));
  ipcMain.handle('qp-gallery:preview', (_event, state: string) => galleryPreviewPayload(String(state)));
  ipcMain.handle('qp-gallery:return-home', () => {
    returnHome();
  });
  ipcMain.on('qp-gallery:close', () => galleryWindow?.close());
}

/**
 * Layer the Wave 1 animation decision onto a frame: transient intros/reactions override
 * the persistent base, restart suppression lives in the resolver, and a manifest asset is
 * used only when it actually exists (otherwise the renderer draws the vector placeholder).
 */
function applyAnimation(frame: PetFrame): PetFrame {
  const events = pendingAnimationEvents;
  const interaction = pendingInteraction;
  pendingAnimationEvents = [];
  pendingInteraction = null;

  const manifest = characterManifests.get(frame.character);
  const decision = animationResolver.resolve({
    characterId: frame.character,
    assetVersion: manifest?.assetVersion ?? 1,
    mood: frame.mood,
    bubbleOpen: !!frame.bubble,
    reducedMotion: frame.reducedMotion,
    now: Date.now(),
    events,
    interaction,
  });

  const resolved = manifest
    ? resolveAnimation(manifest, decision.animation, {
        reducedMotion: frame.reducedMotion,
        warn: (message) => console.warn(message),
        warned: warnedAnimationKeys,
      })
    : null;

  // Under reduced motion a looping clip without a supplied still variant must not play:
  // drop the raster source so the renderer uses its safe static fallback instead
  // (ACCEPTANCE_TEST_MATRIX.md — Reduced motion).
  const allowRaster = resolved != null && !(frame.reducedMotion && resolved.static && !resolved.reducedVariant);

  // Local runtime diagnostics (LOCAL_RUNTIME_DIAGNOSTICS_SPEC.md): fallbacks and
  // animation identity changes are counted, swaps on unchanged state are not.
  if (resolved?.fellBack) petDiagnostics.count('fallbackCount');
  if (resolved?.src == null && !isVectorCharacter(frame.character)) petDiagnostics.count('decodeFailures');
  petDiagnostics.observeAnimation(resolved?.animation ?? null);

  // Wave 3 skins layer on top of the manifest: prefer the active skin's clip, fall back to
  // the character default skin, then the manifest asset (SKIN_THEME_ARCHITECTURE.md §5).
  // Semantic colors never come from here -- the vector renderer owns those.
  const skinAsset = resolveSkinAsset(
    frame.character,
    petSettings.skin,
    decision.animation,
    manifest ? manifestAnimationSources(manifest) : null,
  );
  const preferredSrc = skinAsset.src ?? resolved?.src ?? null;

  // The accessory overlay is real art on disk; a missing file falls back gracefully, and
  // the default skin ships none. The accent colors decorative trims only -- never status.
  const skin = resolveSkin(frame.character, petSettings.skin);
  const accessoryRaw = skin ? resolveSkinAccessory(frame.character, skin.id) : null;
  const skinAccessorySrc = accessoryRaw ? localAssetUrl(accessoryRaw) : null;
  const skinAccentCss = skin?.palette?.primary ?? null;

  // Wave 2 layered state: the interaction layer clamps locomotion during urgent intros,
  // hover/bubble, Minimal mode and reduced motion (WAVE2_LAYERING_RULES.md).
  const layers = resolveLayeredState({
    mood: frame.mood,
    interaction: interactionForAnimation(decision.animation),
    facing: petFacing,
    context: {
      movementMode: petSettings.movement,
      reducedMotion: frame.reducedMotion,
      bubbleOpen: !!frame.bubble,
      userHovering: petHovering,
      userDragging: petDragging,
      elapsedIdleMs: Date.now() - lastUserInteractionAt,
      facing: petFacing,
    },
  });

  return {
    ...frame,
    animation: decision.animation,
    animationPlayback: decision.playback,
    animationSrc: allowRaster && preferredSrc ? localAssetUrl(preferredSrc) : null,
    layers,
    skinAccessory: skinAccessorySrc,
    skinAccentCss,
  };
}

/** Animation id -> manifest asset src, used as the skin fallback chain's last link. */
function manifestAnimationSources(manifest: PetCharacterManifest): Partial<Record<PetAnimationId, string>> {
  const sources: Partial<Record<PetAnimationId, string>> = {};
  for (const [id, asset] of Object.entries(manifest.animations)) {
    if (asset?.src) sources[id as PetAnimationId] = asset.src;
  }
  return sources;
}

/**
 * Build the interactive bubble for whatever the Pet is focused on (spec §23). Hover shows
 * the lightweight `peek`; click escalates to `expanded` with reset time and actions
 * (Wave 2 INTERACTION_AND_BUBBLE_SPEC.md §4).
 */
function showStatusBubble(mode: BubbleMode = 'peek'): void {
  if (!lastFrame) pushPetState();
  const frame = lastFrame;
  if (!frame) return;
  bubbleMode = mode;
  if (frame.focus) {
    const pinned = petSettings.focusMode === 'pinned' && petSettings.pinnedOwnerKey === frame.focus.key;
    interactiveBubble = mode === 'peek' ? peekBubble(frame.focus, Date.now()) : statusBubble(frame.focus, Date.now(), pinned);
  } else {
    // No provider to describe: say why. A daemon that is down and a daemon with no reading
    // yet are different problems and must not read the same (spec §45–§46).
    interactiveBubble = lock ? noDataBubble(Date.now()) : daemonDownBubble(Date.now());
  }
  scheduleBubbleDismiss(mode);
  pushPetState();
}

/** Expanded bubbles auto-dismiss; peek bubbles are owned by the hover state. */
function scheduleBubbleDismiss(mode: BubbleMode): void {
  if (bubbleDismissTimer) {
    clearTimeout(bubbleDismissTimer);
    bubbleDismissTimer = null;
  }
  if (mode !== 'expanded') return;
  bubbleDismissTimer = setTimeout(() => {
    bubbleDismissTimer = null;
    if (bubbleMode !== 'expanded') return;
    interactiveBubble = null;
    bubbleMode = 'peek';
    pushPetState();
  }, 12_000);
}

function clearStatusBubble(): void {
  if (!interactiveBubble) return;
  // An expanded bubble the user opened stays until they click again or it times out.
  if (bubbleMode === 'expanded') return;
  interactiveBubble = null;
  pushPetState();
}

/**
 * The popup anchors above the Pet. `petCenterX` is window-local, so it is converted to the
 * primary work area's coordinates first -- otherwise roaming (whose window starts at the
 * left-most monitor) would place the popup on the wrong screen.
 */
function popupBoundsForPet(): Rect {
  const overlay = petWindowRect ?? petBounds();
  const absolute =
    petCenterX != null
      ? overlay.x + petCenterX
      : petPlacement
        ? petPlacement.x + PET_SPRITE_SIZE / 2
        : null;
  const displays = currentDisplays();
  const display =
    displayForPoint(displays, absolute ?? 0, petPlacement?.y ?? 0) ?? primaryDisplayOf(displays);
  const workArea = display.workArea;
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
  bubbleMode = 'peek';
  if (bubbleDismissTimer) {
    clearTimeout(bubbleDismissTimer);
    bubbleDismissTimer = null;
  }
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
    petHovering = over;
    lastUserInteractionAt = Date.now();
    if (over) {
      // At most one hover_react per hover entry (ACCEPTANCE_TEST_MATRIX.md — Interaction).
      pendingInteraction = 'hover';
      // Hover shows the peek; it must not collapse an expanded bubble the user clicked.
      if (bubbleMode !== 'expanded') showStatusBubble('peek');
    } else {
      clearStatusBubble();
    }
  });
  // Left click opens the details popup. Hovering already answers "how is this provider
  // doing?", so a click asking the same question would be redundant -- it opens the
  // full quota popup instead, and the double click goes straight to the dashboard.
  ipcMain.on('qp-pet-click', (_event, centerX: number) => {
    if (typeof centerX === 'number' && Number.isFinite(centerX)) petCenterX = centerX;
    // Wave 2: click_react once, then toggle the expanded details bubble. The full quota
    // popup is reached from that bubble's Details action (and double-click -> dashboard).
    pendingInteraction = 'click';
    lastUserInteractionAt = Date.now();
    if (bubbleMode === 'expanded' && interactiveBubble) {
      interactiveBubble = null;
      bubbleMode = 'peek';
      if (bubbleDismissTimer) {
        clearTimeout(bubbleDismissTimer);
        bubbleDismissTimer = null;
      }
      pushPetState();
    } else {
      showStatusBubble('expanded');
    }
  });
  ipcMain.on('qp-pet-facing', (_event, facing: string) => {
    // The renderer owns smooth movement; it mirrors facing so turns can be reasoned about.
    if (facing === 'left' || facing === 'right') petFacing = facing;
  });
  ipcMain.on('qp-pet-open-dashboard', () => openBrowser());
  ipcMain.on('qp-pet-details', () => openQuotaPopup());
  ipcMain.on('qp-pet-context', () => openPetMenu());
  // Wave 3: a drag is user intent. Cancel roaming immediately, close a peek bubble, and
  // only persist on release (DRAG_REPOSITION_SPEC.md §1).
  ipcMain.on('qp-pet-drag-start', () => {
    if (petSettings.lockPosition) return;
    if (bubbleMode !== 'expanded') clearStatusBubble();
    petDragging = true;
    roamingController.onDragStart();
  });
  ipcMain.on('qp-pet-drag-end', (_event, local: unknown) => {
    if (!isPoint(local)) return;
    finishDrag(local);
  });
  // The renderer finished a main-planned roaming burst (or Return Home travel).
  ipcMain.on('qp-pet-roamed', (_event, local: unknown) => {
    if (!isPoint(local)) return;
    persistLocalPosition(local);
    roamingController.onMoveComplete();
    sendPetPosition();
  });
  // The renderer finished a local (renderer-driven) idle reposition.
  ipcMain.on('qp-pet-moved', (_event, local: unknown) => {
    if (isPoint(local)) persistLocalPosition(local);
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
  ipcMain.on('qp-popup-ready', () => sendPopupSprite());
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
        // Switching modes must not leave a stale burst pending; the Pet stays put until the
        // next eligible decision. (WAVE3_SCOPE.md §4: Minimal stays the default.)
        roamingController.reset();
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
  // Asset spec §18: switching the mascot changes presentation only, so focus, pin,
  // thresholds and notification history are all deliberately left untouched here.
  const characterItems: Electron.MenuItemConstructorOptions[] = PET_CHARACTERS.map((c) => ({
    label: c.name,
    type: 'radio',
    checked: petSettings.character === c.id,
    click: () => {
      if (petSettings.character === c.id) return;
      petSettings = { ...petSettings, character: c.id };
      savePetSettings(DATA_DIR, petSettings);
      pushPetState();
    },
  }));
  // Wave 3 skins are per-character presentation only: switching one preserves focus, mood
  // and notification history (SKIN_THEME_ARCHITECTURE.md §6).
  const skinItems: Electron.MenuItemConstructorOptions[] = skinsForCharacter(petSettings.character).map((skin) => ({
    label: skin.displayName,
    type: 'radio',
    checked: petSettings.skin === skin.id,
    click: () => {
      if (petSettings.skin === skin.id) return;
      petSettings = { ...petSettings, skin: skin.id };
      savePetSettings(DATA_DIR, petSettings);
      pushPetState();
    },
  }));
  const dockTargets: PetDockTarget[] = [
    'top-left',
    'top-center',
    'top-right',
    'middle-left',
    'middle-right',
    'bottom-left',
    'bottom-center',
    'bottom-right',
  ];
  const dockItems: Electron.MenuItemConstructorOptions[] = dockTargets.map((dock) => ({
    label: dock.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    type: 'radio',
    checked: petPlacement?.dock === dock,
    click: () => applyDock(dock),
  }));
  const quiet = petSettings.quietHours;
  const quietItems: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'Enable quiet hours',
      type: 'checkbox',
      checked: quiet.enabled,
      click: (item) => updateQuietHours({ enabled: item.checked }),
    },
    {
      label: `Window ${quiet.startLocal} - ${quiet.endLocal}`,
      enabled: false,
    },
    { type: 'separator' },
    {
      label: 'Keep critical notifications',
      type: 'checkbox',
      checked: quiet.allowCritical,
      click: (item) => updateQuietHours({ allowCritical: item.checked }),
    },
    {
      label: 'Suppress native warnings',
      type: 'checkbox',
      checked: quiet.suppressNativeWarning,
      click: (item) => updateQuietHours({ suppressNativeWarning: item.checked }),
    },
    {
      label: 'Suppress informational bubbles',
      type: 'checkbox',
      checked: quiet.suppressPetInfo,
      click: (item) => updateQuietHours({ suppressPetInfo: item.checked }),
    },
    {
      label: 'Disable roaming',
      type: 'checkbox',
      checked: quiet.disableRoaming,
      click: (item) => updateQuietHours({ disableRoaming: item.checked }),
    },
  ];
  // Exclusion zones (SAFE_ZONE_SPEC.md §3): freeze the Pet's current spot as a no-go area
  // or toggle/remove existing ones. Zones live beside the other pet state files.
  const exclusionItems: Electron.MenuItemConstructorOptions[] = [
    { label: 'Exclude area around Pet', click: addExclusionZoneAroundPet },
    { type: 'separator' },
    ...petExclusionZones.map(
      (zone): Electron.MenuItemConstructorOptions => ({
        label: `${zone.id} (${Math.round(zone.width)}×${Math.round(zone.height)})`,
        type: 'checkbox',
        checked: zone.enabled,
        click: (item) => toggleExclusionZone(zone.id, item.checked),
      }),
    ),
    {
      label: 'Clear exclusion zones',
      enabled: petExclusionZones.length > 0,
      click: () => clearExclusionZones(),
    },
  ];
  Menu.buildFromTemplate([
    { label: 'Open dashboard', click: openBrowser },
    { label: 'Pet Gallery…', click: showGallery },
    { type: 'separator' },
    { label: 'Focus', submenu: focusItems },
    { label: 'Movement', submenu: movementItems },
    { label: 'Pet character', submenu: characterItems },
    { label: 'Skin', submenu: skinItems },
    { label: 'Rotate every', submenu: rotateItems },
    { type: 'separator' },
    { label: 'Return Home', click: returnHome },
    { label: 'Dock to', submenu: dockItems },
    {
      label: 'Stay near corner',
      type: 'checkbox',
      checked: petSettings.stayNearCorner,
      click: (item) => {
        petSettings = { ...petSettings, stayNearCorner: item.checked };
        savePetSettings(DATA_DIR, petSettings);
        roamingController.reset();
        pushPetState();
      },
    },
    { label: 'Exclusion zones', submenu: exclusionItems },
    {
      label: 'Lock Pet Position',
      type: 'checkbox',
      checked: petSettings.lockPosition,
      click: (item) => {
        petSettings = { ...petSettings, lockPosition: item.checked };
        savePetSettings(DATA_DIR, petSettings);
        roamingController.reset();
        sendDesktop();
        pushPetState();
      },
    },
    {
      label: 'Allow cross-monitor roaming',
      type: 'checkbox',
      checked: petSettings.allowCrossMonitor,
      enabled: petSettings.movement === 'roaming',
      click: (item) => {
        petSettings = { ...petSettings, allowCrossMonitor: item.checked };
        savePetSettings(DATA_DIR, petSettings);
      },
    },
    { label: 'Quiet hours', submenu: quietItems },
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
  loadCharacterManifests();
  loadExclusionZones();
  setManualCooldown(petSettings.manualMoveCooldownMs || MANUAL_MOVE_COOLDOWN_MS);
  registerCompanionIpc();
  registerGalleryIpc();

  tray = new Tray(nativeImage.createFromBuffer(trayIconFor(null)));
  tray.on('click', togglePopup);
  render();
  ensurePet();

  // Taskbar edge / DPI / resolution / monitor changes: revalidate the placement and resize
  // the overlay. A disconnected monitor must never orphan the Pet (spec §5).
  screen.on('display-metrics-changed', onDisplayChange);
  screen.on('display-added', onDisplayChange);
  screen.on('display-removed', onDisplayChange);

  void fetchLimits();
  const timer = setInterval(() => void fetchLimits(), POLL_MS);
  // The roaming decision is slow by design; the renderer animates the actual walk.
  const roamTimer = setInterval(driveRoaming, 4_000);
  app.on('before-quit', () => {
    clearInterval(timer);
    clearInterval(roamTimer);
    if (trayAnimTimer) clearInterval(trayAnimTimer);
    if (petUrgentTimer) clearTimeout(petUrgentTimer);
  });
});
