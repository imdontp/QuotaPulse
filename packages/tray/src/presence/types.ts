/**
 * Pet Mode v2 domain model (docs/PET_MODE_V2_SPEC.md §7–§17).
 *
 * Pure types only: no Electron, no I/O. See `index.ts` for the resolver that turns quota
 * rows into a `PetFrame`, and `packages/tray/src/pet/` for the presentation side.
 */

/** Global quota severity. `unknown` is a first-class state, never a synonym for `ok`. */
export type Severity = 'ok' | 'warn' | 'crit' | 'unknown';

/**
 * Mascot moods. `unknown` is a first-class state (Next Handoff Pack DECISIONS.md): it means
 * insufficient or untrusted data, never a synonym for `healthy` and never 0%.
 */
export type PetMood = 'healthy' | 'working' | 'warning' | 'critical' | 'reset' | 'unknown';

export type MovementMode = 'minimal' | 'companion' | 'roaming';
export type FocusMode = 'auto' | 'pinned';

/**
 * Selectable mascots. IDs use the frozen underscore form from the Next Handoff Pack
 * (`04_runtime_contract/pet-runtime-contract.ts`). The state engine is shared; only the
 * renderer/asset set behind each id changes, so switching a character must never affect
 * focus, thresholds, notification history or the pin.
 */
export type PetCharacterId = 'orbit_bot' | 'pulse_fox' | 'flux_blob' | 'capsule_cat';

/** Manifest order; also the order the settings radio group is built in. */
export const PET_CHARACTER_IDS: readonly PetCharacterId[] = [
  'orbit_bot',
  'pulse_fox',
  'flux_blob',
  'capsule_cat',
];

/** Default recommendation (DECISIONS.md — Character model). */
export const DEFAULT_PET_CHARACTER: PetCharacterId = 'orbit_bot';

/* ---------------------------------------------- Wave 1 animation runtime contract */

/** The ten Wave 1 runtime animation IDs (WAVE1_PRODUCTION_ASSET_BIBLE.md §1). */
export type PetAnimationId =
  | 'healthy_idle'
  | 'working_loop'
  | 'warning_intro'
  | 'warning_loop'
  | 'critical_intro'
  | 'critical_loop'
  | 'reset_celebrate'
  | 'talk_loop'
  | 'hover_react'
  | 'click_react';

export const PET_ANIMATION_IDS: readonly PetAnimationId[] = [
  'healthy_idle',
  'working_loop',
  'warning_intro',
  'warning_loop',
  'critical_intro',
  'critical_loop',
  'reset_celebrate',
  'talk_loop',
  'hover_react',
  'click_react',
];

export type AnimationPlayback = 'loop' | 'once';

/** `healthy_static` is the terminal fallback: the first frame of `healthy_idle`. */
export type AnimationFallback = PetAnimationId | 'healthy_static';

export interface PetAnimationAsset {
  playback: AnimationPlayback;
  src: string;
  fallback: AnimationFallback;
  /** Static/low-motion variant for reduced-motion mode, when the asset agent supplied one. */
  reducedMotionSrc: string | null;
}

export interface PetManifestPivot {
  x: number;
  y: number;
}

/** One character manifest (schema: 04_runtime_contract/pet-manifest.schema.json). */
export interface PetCharacterManifest {
  id: PetCharacterId;
  displayName: string;
  assetVersion: number;
  default?: boolean;
  personality?: string[];
  motionStyle?: string;
  brandAnchors?: string[];
  pivot: PetManifestPivot;
  supportedSizes: number[];
  animations: Partial<Record<PetAnimationId, PetAnimationAsset>>;
}

export type GlobalStatusSeverity = Severity;

export interface PetGlobalStatus {
  severity: GlobalStatusSeverity;
  ownerKey: string | null;
  usedPercent: number | null;
}

export interface PetFocusStatus {
  ownerKey: string | null;
  displayName: string | null;
  usedPercent: number | null;
  windowKind: string | null;
  active: boolean;
}

/**
 * Everything the renderer needs to pick an animation, resolved away from the character
 * asset set (Next Handoff Pack Phase C). Provider/harness stay replaceable: this carries
 * only normalized state.
 */
export interface PetVisualState {
  characterId: PetCharacterId;
  mood: PetMood;
  animation: PetAnimationId;
  global: PetGlobalStatus;
  focus: PetFocusStatus;
  bubbleOpen: boolean;
  reducedMotion: boolean;
}

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
  /** The selected mascot (asset spec §18). Presentation only; never affects focus/mood. */
  character: PetCharacterId;
  /** Resolved Wave 1 animation (Next Handoff Pack). Base by default; main may override. */
  animation: PetAnimationId;
  animationPlayback: AnimationPlayback;
  /** Raster clip URL for the resolved animation, when one exists on disk; else null. */
  animationSrc: string | null;
  /**
   * Inline SVG for the selected mascot, when it renders as vector art. `null` means the
   * character ships raster art and the renderer should use its sprite/WebP asset set.
   */
  spriteSvg: string | null;
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
  /** Selected mascot (asset spec §18). Added in v2; older files fall back to the default. */
  character: PetCharacterId;
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
  character: DEFAULT_PET_CHARACTER,
};

/** Severity bands, shared with the tray icon (`severityFor`). Kept here as the one source. */
export const SEVERITY_WARN_AT = 60;
export const SEVERITY_CRIT_AT = 85;

/** Notification ladder from the tray (`ALERT_STEPS`); events map onto it (spec §20). */
export const NOTIFY_STEPS = [50, 80, 95] as const;
