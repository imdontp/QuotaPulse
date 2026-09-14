/**
 * Pet Mode v2 domain model (docs/PET_MODE_V2_SPEC.md §7–§17).
 *
 * Pure types only: no Electron, no I/O. See `index.ts` for the resolver that turns quota
 * rows into a `PetFrame`, and `packages/tray/src/pet/` for the presentation side.
 */

/** Global quota severity. `unknown` is a first-class state, never a synonym for `ok`. */
export type Severity = 'ok' | 'warn' | 'crit' | 'unknown';

/** The five mascot states. `pulsepet_states_sprite.png` holds them in this order. */
export type PetMood = 'healthy' | 'working' | 'warning' | 'critical' | 'reset';

export type MovementMode = 'minimal' | 'companion' | 'roaming';
export type FocusMode = 'auto' | 'pinned';

/** One quota window of a provider, as shown when the user asks about that provider. */
export interface ProviderWindow {
  windowKind: string;
  usedPercent: number;
  resetsAt: number | null;
  ageSeconds: number | null;
}

/**
 * One subscription's presence, deduplicated across readers.
 *
 * `usedPercent` is nullable, which the spec's draft interface did not show. It has to be:
 * QuotaPulse's whole stance is that a rolled-over or missing window shows a dash rather
 * than its last percentage, and a provider with no readable window is `unknown`, not 0%.
 */
export interface ProviderPresence {
  /** Canonical ownership: subscription_key -> account_key -> source:<id>. */
  key: string;
  name: string;
  /** The WORST live window: the one the Pet's mood follows. */
  usedPercent: number | null;
  windowKind: string;
  resetsAt: number | null;
  severity: Severity;
  active: boolean;
  /** Age of the reading behind `usedPercent`; the dashboard's honesty rule applies here too. */
  ageSeconds: number | null;
  /**
   * Every live window this subscription owns (5-hour, weekly, monthly...), worst first.
   * The Pet's mood only needs the worst, but a user asking "what about this provider?"
   * wants the whole picture, not one number.
   */
  windows: ProviderWindow[];
}

export type PresenceEventType =
  | 'usage-half'
  | 'warning'
  | 'critical'
  | 'reset'
  | 'activity-start'
  | 'activity-stop';

export interface PresenceEvent {
  type: PresenceEventType;
  ownerKey: string;
  at: number;
  /** Used percentage at the moment of the event, when it applies. */
  percent?: number;
}

export interface GlobalPresence {
  severity: Severity;
  highest: ProviderPresence | null;
}

export type BubbleKind = 'event' | 'status';
export type BubbleTone = 'info' | 'warn' | 'crit';
/** Spec §25: Details and Pin are the minimum; Open Dashboard and Snooze are the extras. */
export type BubbleAction = 'details' | 'pin' | 'unpin' | 'open-dashboard' | 'snooze';

/** A speech bubble, auto (event) or interactive (hover/click status). */
export interface PetBubble {
  kind: BubbleKind;
  ownerKey: string | null;
  tone: BubbleTone;
  title: string;
  lines: string[];
  /** Absolute auto-dismiss time; null means it lives until replaced or dismissed. */
  until: number | null;
  actions: BubbleAction[];
}

/** Everything the pet renderer needs for one frame. */
export interface PetFrame {
  mood: PetMood;
  spriteIndex: number;
  colorCss: string;
  focus: ProviderPresence | null;
  providers: ProviderPresence[];
  global: GlobalPresence;
  /** True when global risk is higher than the focused provider (spec §16). */
  showGlobalAlert: boolean;
  /** Colour for the global halo/badge when `showGlobalAlert`. */
  alertColorCss: string;
  /** Short reset countdown shown above the pet, when a reset is close. */
  badge: string | null;
  /** Auto event bubble, when one is live and bubbles are enabled. */
  bubble: PetBubble | null;
  movement: MovementMode;
  /** User-forced reduced motion, layered on top of the OS `prefers-reduced-motion`. */
  reducedMotion: boolean;
  hasData: boolean;
  updatedAt: number;
}

export interface PetSettings {
  enabled: boolean;
  movement: MovementMode;
  focusMode: FocusMode;
  pinnedOwnerKey: string | null;
  rotateIntervalMs: number;
  speechBubbles: boolean;
  eventNotifications: boolean;
  reducedMotion: boolean;
}

/** The spec's defaults (§38). Minimal motion is deliberate: motion is the last priority. */
export const DEFAULT_PET_SETTINGS: PetSettings = {
  enabled: true,
  movement: 'minimal',
  focusMode: 'auto',
  pinnedOwnerKey: null,
  rotateIntervalMs: 8_000,
  speechBubbles: true,
  eventNotifications: true,
  reducedMotion: false,
};

/** Severity bands, shared with the tray icon (`severityFor`). Kept here as the one source. */
export const SEVERITY_WARN_AT = 60;
export const SEVERITY_CRIT_AT = 85;

/** Notification ladder from the tray (`ALERT_STEPS`); events map onto it (spec §20). */
export const NOTIFY_STEPS = [50, 80, 95] as const;
