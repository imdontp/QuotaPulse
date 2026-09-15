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

/* ------------------------------------------------ Wave 2 layered behavior contract */

/** Expression micro-behaviors (WAVE2_MOTION_BIBLE.md §1). */
export type PetExpressionId =
  | 'none'
  | 'blink'
  | 'look_left'
  | 'look_right'
  | 'curious'
  | 'focused'
  | 'tired';

/** Locomotion + long-idle states (WAVE2_MOTION_BIBLE.md §1, WAVE2_EXECUTION_PLAN.md B/C). */
export type PetLocomotionId =
  | 'stationary'
  | 'turn_left'
  | 'turn_right'
  | 'walk_left'
  | 'walk_right'
  | 'stop_left'
  | 'stop_right'
  | 'sit'
  | 'lie_down'
  | 'sleep_loop'
  | 'wake_up'
  | 'stretch';

/** Interaction override layer (WAVE2_MOTION_BIBLE.md §1). */
export type PetInteractionId =
  | 'none'
  | 'hover_react'
  | 'click_react'
  | 'talk_loop'
  | 'warning_intro'
  | 'critical_intro'
  | 'reset_celebrate';

export type PetFacing = 'left' | 'right';

/**
 * The four layers are resolved independently and combined, rather than enumerating every
 * combination as a bespoke state (WAVE2_LAYERING_RULES.md §1).
 */
export interface PetLayeredVisualState {
  mood: PetMood;
  expression: PetExpressionId;
  locomotion: PetLocomotionId;
  interaction: PetInteractionId;
  facing: PetFacing;
}

/** Inputs the behavior policy needs; keeps provider/quota logic out of the renderer. */
export interface PetBehaviorContext {
  movementMode: MovementMode;
  reducedMotion: boolean;
  bubbleOpen: boolean;
  userHovering: boolean;
  userDragging: boolean;
  elapsedIdleMs: number;
  facing: PetFacing;
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

/**
 * Interactive bubble states (Wave 2 INTERACTION_AND_BUBBLE_SPEC.md §4): `peek` on hover,
 * `expanded` on click. Automatic event bubbles are always expanded.
 */
export type BubbleMode = 'peek' | 'expanded';

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
  /** Peek has no buttons and a short line; expanded adds reset time and the action row. */
  mode: BubbleMode;
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
  /** Wave 2 layered behavior state (mood + expression + locomotion + interaction). */
  layers: PetLayeredVisualState;
  /**
   * Inline SVG for the selected mascot, when it renders as vector art. `null` means the
   * character ships raster art and the renderer should use its sprite/WebP asset set.
   */
  spriteSvg: string | null;
  /**
   * Wave 3 skin: the active skin's accessory overlay src (already localized to a URL the
   * renderer can load), or null for the default skin. Accessories are non-semantic
   * overlays (SKIN_THEME_ARCHITECTURE.md §4).
   */
  skinAccessory: string | null;
  /**
   * Wave 3 skin: decorative accent (palette.primary) for trims only; status colors are
   * never derived from it (SKIN_THEME_ARCHITECTURE.md §3).
   */
  skinAccentCss: string | null;
  hasData: boolean;
  updatedAt: number;
}

/* ------------------------------------------------ Wave 3 desktop & roaming contract */

/** A logical rectangle in display coordinates (DIP, not device pixels). */
export interface PetRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** A display as the desktop layer needs it (Wave 3 runtime contract). */
export interface PetDisplayInfo {
  id: string;
  primary: boolean;
  bounds: PetRect;
  workArea: PetRect;
  scaleFactor: number;
}

/** A user/config-defined region the Pet must not roam into (SAFE_ZONE_SPEC.md §3). */
export interface PetExclusionZone extends PetRect {
  id: string;
  displayId: string;
  enabled: boolean;
}

/** The nine dock targets (DOCK_AND_SNAP_SPEC.md §1); `custom` is the user home point. */
export type PetDockTarget =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'middle-left'
  | 'middle-right'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right'
  | 'custom';

export const PET_DOCK_TARGETS: readonly PetDockTarget[] = [
  'top-left',
  'top-center',
  'top-right',
  'middle-left',
  'middle-right',
  'bottom-left',
  'bottom-center',
  'bottom-right',
  'custom',
];

/**
 * Where the Pet lives on the desktop (MULTI_MONITOR_SPEC.md §1, DRAG_REPOSITION_SPEC.md §4).
 * `x`/`y` are the Pet window's top-left in absolute display coordinates, not the sprite's.
 */
export interface PetPlacement {
  /** null when the saved display is gone; recovery then targets the primary display. */
  displayId: string | null;
  x: number;
  y: number;
  dock: PetDockTarget | null;
  homeX: number | null;
  homeY: number | null;
  updatedAt: number;
}

/** Autonomous-movement policy (ROAMING_ENGINE_SPEC.md §2, SAFE_ZONE_SPEC.md corner mode). */
export interface PetRoamingConfig {
  mode: MovementMode;
  /** Companion travel radius around the anchor. */
  localRadiusPx: number;
  /** Idle window a roaming burst is sampled from. */
  minIdleBeforeMoveMs: number;
  maxIdleBeforeMoveMs: number;
  allowCrossMonitor: boolean;
  lockPosition: boolean;
  /** Bias roaming targets toward the docked/nearest corner. */
  stayNearCorner: boolean;
}

/** Quiet-hours / do-not-disturb policy (QUIET_HOURS_SPEC.md). */
export interface PetQuietHoursConfig {
  enabled: boolean;
  /** `HH:mm` local. */
  startLocal: string;
  /** `HH:mm` local; may wrap past midnight. */
  endLocal: string;
  suppressPetInfo: boolean;
  suppressNativeWarning: boolean;
  allowCritical: boolean;
  disableRoaming: boolean;
}

export const DEFAULT_QUIET_HOURS: PetQuietHoursConfig = {
  enabled: false,
  startLocal: '22:00',
  endLocal: '07:00',
  suppressPetInfo: true,
  suppressNativeWarning: true,
  allowCritical: true,
  disableRoaming: true,
};

/** Everything the roaming controller needs to decide whether and where to move. */
export interface PetDesktopContext {
  displays: PetDisplayInfo[];
  exclusionZones: PetExclusionZone[];
  placement: PetPlacement;
  roaming: PetRoamingConfig;
  quietHours: PetQuietHoursConfig;
  reducedMotion: boolean;
  userHovering: boolean;
  userDragging: boolean;
  bubbleExpanded: boolean;
  urgentInteractionActive: boolean;
  /** The Pet window is hidden or occluded; roaming must stay put. */
  petVisible: boolean;
}

/** Runtime defaults (wave3-package-manifest.json). Roaming is never enabled by default. */
export const DEFAULT_PET_ROAMING: PetRoamingConfig = {
  mode: 'minimal',
  localRadiusPx: 150,
  minIdleBeforeMoveMs: 45_000,
  maxIdleBeforeMoveMs: 180_000,
  allowCrossMonitor: false,
  lockPosition: false,
  stayNearCorner: false,
};

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
  /** Wave 3: freeze placement, disables drag and roaming (DOCK_AND_SNAP_SPEC.md §5). */
  lockPosition: boolean;
  /** Wave 3: opt-in cross-monitor roaming; off by default (MULTI_MONITOR_SPEC.md §4). */
  allowCrossMonitor: boolean;
  /** Wave 3: bias roaming toward the docked/nearest corner (SAFE_ZONE_SPEC.md corner mode). */
  stayNearCorner: boolean;
  /** Wave 3: autonomous-movement pause after a manual placement. */
  manualMoveCooldownMs: number;
  /** Wave 3: inset from work-area edges where roaming is allowed. */
  safeMarginPx: number;
  /** Wave 3: quiet hours / DND behavior. */
  quietHours: PetQuietHoursConfig;
  /** Wave 3: selected skin id for the current character (`default` is always available). */
  skin: string;
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
  lockPosition: false,
  allowCrossMonitor: false,
  stayNearCorner: false,
  manualMoveCooldownMs: 300_000,
  safeMarginPx: 16,
  quietHours: { ...DEFAULT_QUIET_HOURS },
  skin: 'default',
};

/** Build the roaming policy from flat settings so callers never assemble it by hand. */
export function roamingConfigFor(settings: PetSettings): PetRoamingConfig {
  return {
    mode: settings.movement,
    localRadiusPx: 150,
    minIdleBeforeMoveMs: DEFAULT_PET_ROAMING.minIdleBeforeMoveMs,
    maxIdleBeforeMoveMs: DEFAULT_PET_ROAMING.maxIdleBeforeMoveMs,
    allowCrossMonitor: settings.allowCrossMonitor,
    lockPosition: settings.lockPosition,
    stayNearCorner: settings.stayNearCorner,
  };
}

/** Severity bands, shared with the tray icon (`severityFor`). Kept here as the one source. */
export const SEVERITY_WARN_AT = 60;
export const SEVERITY_CRIT_AT = 85;

/** Notification ladder from the tray (`ALERT_STEPS`); events map onto it (spec §20). */
export const NOTIFY_STEPS = [50, 80, 95] as const;
