import type { PresenceEvent, PetQuietHoursConfig, ProviderPresence } from './types.js';

/**
 * Wave 3 notification scenes + quiet hours (NOTIFICATION_SCENES_SPEC.md, QUIET_HOURS_SPEC.md).
 *
 * A scene is the Pet's unit of interruption: passive, informational, warning, critical or
 * recovery. The policy decides whether a scene speaks, raises a native notification or makes
 * a sound, and the queue guarantees at most one visible bubble while deduplicating repeated
 * refreshes. Quiet hours never change quota state -- only interruption behavior.
 */

/* ----------------------------------------------------------------------- Quiet hours */

/** Parse `HH:mm` into minutes since local midnight, or null when malformed. */
export function parseClock(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

/**
 * True when `now` falls inside the configured window. The window may wrap past midnight
 * (e.g. 22:00 -> 07:00), and `start === end` means "disabled".
 */
export function isQuietHours(config: PetQuietHoursConfig, now: Date = new Date()): boolean {
  if (!config.enabled) return false;
  const start = parseClock(config.startLocal);
  const end = parseClock(config.endLocal);
  if (start == null || end == null || start === end) return false;
  const minute = now.getHours() * 60 + now.getMinutes();
  return start < end ? minute >= start && minute < end : minute >= start || minute < end;
}

/* -------------------------------------------------------------------- Scene contract */

export type ScenePriority = 'passive' | 'info' | 'warning' | 'critical' | 'recovery';

const PRIORITY_RANK: Record<ScenePriority, number> = {
  passive: 0,
  info: 1,
  warning: 2,
  critical: 3,
  recovery: 4,
};

export function priorityRank(priority: ScenePriority): number {
  return PRIORITY_RANK[priority];
}

export interface PetNotificationScene {
  id: string;
  priority: ScenePriority;
  ownerKey?: string;
  /** Quota window the scene belongs to; part of the dedupe key. */
  windowKind?: string;
  /** Threshold step; part of the dedupe key. */
  step?: number;
  title: string;
  body?: string;
  animationOverride?: string;
  autoDismissMs?: number | null;
  nativeNotification: boolean;
  sound: boolean;
}

/** The animation a scene asks for, never stronger than the priority warrants. */
const ANIMATION_FOR_PRIORITY: Partial<Record<ScenePriority, string>> = {
  warning: 'warning_intro',
  critical: 'critical_intro',
  recovery: 'reset_celebrate',
};

export interface ScenePolicyOptions {
  quietHours: PetQuietHoursConfig;
  /** `Pet alerts on/off` (NOTIFICATION_SCENES_SPEC.md §7). */
  petAlerts: boolean;
  /** `Native alerts on/off`. */
  nativeAlerts: boolean;
  /** `Sounds on/off`. */
  sounds: boolean;
  /** `Critical override during quiet hours`. */
  criticalOverride: boolean;
  now?: Date;
}

export interface ScenePolicy {
  showBubble: boolean;
  native: boolean;
  sound: boolean;
  animation: string | null;
  quiet: boolean;
}

/**
 * Resolve what a scene is allowed to do right now. This is the single place the interruption
 * rules live, so the tray's notifications and the Pet's bubble can never disagree.
 */
export function resolveScenePolicy(scene: PetNotificationScene, options: ScenePolicyOptions): ScenePolicy {
  const quiet = isQuietHours(options.quietHours, options.now);
  const animation = scene.animationOverride ?? ANIMATION_FOR_PRIORITY[scene.priority] ?? null;

  if (!options.petAlerts && !options.nativeAlerts) {
    return { showBubble: false, native: false, sound: false, animation: null, quiet };
  }

  if (!quiet) {
    switch (scene.priority) {
      case 'passive':
        // Passive has no automatic surface; it is visible only through hover/peek.
        return { showBubble: false, native: false, sound: false, animation, quiet };
      case 'info':
        return { showBubble: options.petAlerts, native: false, sound: false, animation, quiet };
      case 'recovery':
        return { showBubble: options.petAlerts, native: false, sound: false, animation, quiet };
      case 'warning':
        return {
          showBubble: options.petAlerts,
          native: options.nativeAlerts && scene.nativeNotification,
          sound: options.sounds && scene.sound,
          animation,
          quiet,
        };
      case 'critical':
      default:
        return {
          showBubble: options.petAlerts,
          native: options.nativeAlerts && scene.nativeNotification,
          sound: options.sounds && scene.sound,
          animation,
          quiet,
        };
    }
  }

  // Quiet hours: no sounds, no passive/info bubbles, critical preserved by policy.
  switch (scene.priority) {
    case 'passive':
    case 'info':
      return {
        showBubble: false,
        native: false,
        sound: false,
        animation: null,
        quiet,
      };
    case 'warning':
      return {
        showBubble: false,
        native: options.nativeAlerts && scene.nativeNotification && !options.quietHours.suppressNativeWarning,
        sound: false,
        animation: null,
        quiet,
      };
    case 'recovery':
      return {
        showBubble: options.petAlerts && !options.quietHours.suppressPetInfo,
        native: false,
        sound: false,
        animation: options.quietHours.suppressPetInfo ? null : animation,
        quiet,
      };
    case 'critical':
    default: {
      const allowed = options.criticalOverride || options.quietHours.allowCritical;
      return {
        showBubble: allowed && options.petAlerts,
        native: allowed && options.nativeAlerts && scene.nativeNotification,
        sound: false,
        animation: allowed ? animation : null,
        quiet,
      };
    }
  }
}

/* ------------------------------------------------------------------------- Dedupe */

/** Dedupe identity: provider/subscription, quota window, event kind and threshold step. */
export function sceneDedupeKey(scene: PetNotificationScene): string {
  return [scene.ownerKey ?? 'global', scene.windowKind ?? '-', scene.id, scene.step ?? '-'].join('|');
}

export interface SceneQueue {
  /** Returns true when the scene was accepted (new) and false when deduped/dropped. */
  enqueue(scene: PetNotificationScene, now?: number): boolean;
  /** The scene that should be visible now, if any (expired scenes are rotated out). */
  current(now?: number): PetNotificationScene | null;
  hasSeen(key: string): boolean;
  /** Drop any pending scenes (used when alerts are switched off). */
  clear(): void;
  readonly queued: number;
  readonly seenCount: number;
}

interface QueuedScene {
  scene: PetNotificationScene;
  until: number;
}

const DEFAULT_AUTO_DISMISS_MS: Partial<Record<ScenePriority, number>> = {
  passive: 0,
  info: 4_000,
  warning: 6_000,
  critical: 9_000,
  recovery: 5_000,
};

function expiryFor(scene: PetNotificationScene, now: number): number {
  if (scene.autoDismissMs === null) return Number.POSITIVE_INFINITY;
  const ms = scene.autoDismissMs ?? DEFAULT_AUTO_DISMISS_MS[scene.priority] ?? 4_000;
  return now + ms;
}

/**
 * At most one visible bubble; critical replaces anything lower, warnings wait behind a
 * critical, and informational scenes are dropped when the queue is busy
 * (NOTIFICATION_SCENES_SPEC.md §5).
 */
export function createSceneQueue(): SceneQueue {
  const seen = new Set<string>();
  let currentScene: QueuedScene | null = null;
  const pending: QueuedScene[] = [];

  function rotate(now: number): void {
    if (currentScene && now < currentScene.until) return;
    currentScene = null;
    if (pending.length === 0) return;
    // Promote the highest-priority pending scene, oldest first among equals.
    pending.sort((a, b) => priorityRank(b.scene.priority) - priorityRank(a.scene.priority));
    currentScene = pending.shift() ?? null;
  }

  return {
    enqueue(scene, now = Date.now()) {
      const key = sceneDedupeKey(scene);
      if (seen.has(key)) return false;
      seen.add(key);
      rotate(now);
      const entry: QueuedScene = { scene, until: expiryFor(scene, now) };
      if (!currentScene) {
        currentScene = entry;
        return true;
      }
      const incoming = priorityRank(scene.priority);
      const active = priorityRank(currentScene.scene.priority);
      if (incoming > active) {
        // Critical (or recovery) replaces a lower scene; the old one is dropped.
        currentScene = entry;
        return true;
      }
      if (scene.priority === 'warning' && currentScene.scene.priority === 'critical') {
        pending.push(entry);
        return true;
      }
      // Equal or lower priority while a bubble is up: informational/passive are dropped.
      if (scene.priority === 'info' || scene.priority === 'passive') return false;
      pending.push(entry);
      return true;
    },

    current(now = Date.now()) {
      rotate(now);
      return currentScene?.scene ?? null;
    },

    hasSeen(key) {
      return seen.has(key);
    },

    clear() {
      currentScene = null;
      pending.length = 0;
    },

    get queued() {
      return pending.length;
    },

    get seenCount() {
      return seen.size;
    },
  };
}

/* --------------------------------------------------------------- Event -> scene */

const STEP_FOR_EVENT: Partial<Record<PresenceEvent['type'], number>> = {
  'usage-half': 50,
  warning: 80,
  critical: 95,
};

const PRIORITY_FOR_EVENT: Record<PresenceEvent['type'], ScenePriority | null> = {
  'usage-half': 'info',
  warning: 'warning',
  critical: 'critical',
  reset: 'recovery',
  'activity-start': 'passive',
  'activity-stop': null,
};

const windowLabel = (kind: string | undefined): string => (kind ? kind.replace(/_/g, ' ') : 'quota');

/**
 * Turn a presence event into a notification scene. `null` means the event has no automatic
 * surface (activity-stop is already expressed by the Pet leaving its working animation).
 */
export function sceneForEvent(event: PresenceEvent, provider: ProviderPresence | undefined): PetNotificationScene | null {
  const priority = PRIORITY_FOR_EVENT[event.type];
  if (!priority) return null;
  const name = provider?.name ?? event.ownerKey;
  const windowKind = provider?.windowKind;
  const pct = event.percent != null ? Math.round(event.percent) : null;
  const step = STEP_FOR_EVENT[event.type];

  let title: string;
  let body: string | undefined;
  switch (event.type) {
    case 'usage-half':
      title = name;
      body = `${name} is halfway through its ${windowLabel(windowKind)} quota.`;
      break;
    case 'warning':
      title = `${name}: ${pct ?? ''}% used`;
      body = `${name} crossed the 80% threshold of its ${windowLabel(windowKind)} quota.`;
      break;
    case 'critical':
      title = `${name}: ${pct ?? ''}% used`;
      body = `${name} is near the limit of its ${windowLabel(windowKind)} quota.`;
      break;
    case 'reset':
      title = `${name} quota has reset`;
      body = 'A new quota window has started.';
      break;
    default:
      title = name;
      body = `${name} is active again.`;
      break;
  }

  return {
    id: `event:${event.type}`,
    priority,
    ownerKey: event.ownerKey,
    windowKind,
    step,
    title,
    body,
    animationOverride: ANIMATION_FOR_PRIORITY[priority] ?? undefined,
    autoDismissMs: priority === 'passive' ? 0 : null,
    nativeNotification: priority === 'critical' || priority === 'warning',
    sound: priority === 'critical',
  };
}

/** Build scenes for a batch of events, dropping any with no automatic surface. */
export function scenesForEvents(
  events: readonly PresenceEvent[],
  providers: readonly ProviderPresence[],
): PetNotificationScene[] {
  const byKey = new Map(providers.map((p) => [p.key, p]));
  const scenes: PetNotificationScene[] = [];
  for (const event of events) {
    const scene = sceneForEvent(event, byKey.get(event.ownerKey));
    if (scene) scenes.push(scene);
  }
  return scenes;
}
