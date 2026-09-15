import type { Limit } from '../limits.js';
import type { PetFrame, PetSettings, PresenceEvent } from './types.js';
import {
  activeOwnerKey as pickActiveOwner,
  buildProviderPresence,
  highestProvider,
  resolveGlobalSeverity,
  type SubscriptionInfo,
} from './normalize.js';
import { EVENT_FOCUS_MS, selectFocus } from './focus-resolver.js';
import { resolvePetMood, shouldShowGlobalAlert } from './mood-resolver.js';
import { eventBubble } from './bubble.js';
import { PET_POINT_WITHIN_MS, shortCountdown } from '../pet-state.js';
import { MOOD_COLORS, SEVERITY_COLORS, SPRITE_INDEX } from '../pet/motion.js';
import { isVectorCharacter, renderPetSvg } from '../pet/characters.js';
import { animationPlayback, baseAnimationForMood } from '../pet/runtime.js';

/**
 * The Presence Engine (docs/PET_MODE_V2_SPEC.md §6, §9, Phase 1).
 *
 * One pure call turns quota rows + settings into the frame the Pet renders. Keeping it
 * pure is what makes "which subscription is the Pet representing, and why" answerable in
 * a test instead of by watching a desktop mascot.
 */

export * from './types.js';
export {
  buildProviderPresence,
  resolveGlobalSeverity,
  highestProvider,
  severityForPercent,
  activeOwnerKey,
  ownerKeyOf,
  severityRank,
  type SubscriptionInfo,
} from './normalize.js';
export { selectFocus, EVENT_FOCUS_MS, DEFAULT_ROTATE_MS, type FocusOptions } from './focus-resolver.js';
export { resolvePetMood, shouldShowGlobalAlert } from './mood-resolver.js';
export { createEventTracker, type EventTracker } from './event-tracker.js';
export { peekBubble, statusBubble, eventBubble, daemonDownBubble, noDataBubble, snoozedBubble } from './bubble.js';
export {
  PET_CHARACTERS,
  isPetCharacter,
  coercePetCharacter,
  isVectorCharacter,
  petCharacterName,
  renderPetSvg,
  type PetCharacterDef,
  type PetSvgOptions,
} from '../pet/characters.js';
export {
  ANIMATION_PLAYBACK,
  ONCE_DURATION_MS,
  animationPlayback,
  baseAnimationForMood,
  isOnce,
  type OnceAnimationId,
} from '../pet/runtime.js';
export {
  DEFAULT_FALLBACK,
  readManifest,
  resolveAnimation,
  validateManifest,
  type ManifestIssue,
  type ManifestValidation,
  type ResolvedAnimation,
} from '../pet/manifest.js';
export {
  IDLE_BEHAVIOR_TIERS,
  WAVE2_EXPRESSION_ASSETS,
  WAVE2_EXTENDED_ASSETS,
  WAVE2_LOCOMOTION_ASSETS,
  idleBehaviorsFor,
  interactionBlocksLocomotion,
  interactionForAnimation,
  locomotionAllowed,
  locomotionRange,
  pickIdleBehavior,
  resolveLayeredState,
  turnFor,
  usesLegWalk,
  wave2ClipSrc,
  type IdleBehavior,
  type LocomotionRange,
  type ResolveLayersInput,
  type Wave2AssetId,
} from '../pet/wave2.js';
export {
  createAnimationResolver,
  toVisualState,
  type AnimationDecision,
  type AnimationEvent,
  type AnimationResolver,
  type PetInteraction,
  type ResolveAnimationInput,
  type VisualStateInput,
} from '../pet/animation-resolver.js';
export {
  CLICK_DRAG_THRESHOLD_PX,
  DEFAULT_SAFE_MARGIN_PX,
  DOCK_SNAP_THRESHOLD_PX,
  MANUAL_MOVE_COOLDOWN_MS,
  MIN_VISIBLE_FRACTION,
  clampPetToRect,
  defaultPlacement,
  desktopOverlayBounds,
  displayForPoint,
  dockPoint,
  dockPointsFor,
  findDisplayById,
  homeAnchor,
  nearestValidPosition,
  overlappingZone,
  petRectAt,
  rectAround,
  recoverPlacement,
  resolvePlacementDisplay,
  safeRegionFor,
  snapToDock,
  validatePlacement,
  visibleFraction,
  type PlacementValidation,
} from '../pet/desktop.js';
export {
  ROAM_MEDIUM_MAX_PX,
  ROAM_MEDIUM_MIN_PX,
  ROAM_SHORT_MAX_PX,
  ROAM_SHORT_MIN_PX,
  canAutonomouslyMove,
  cornerAnchor,
  chooseMoveKind,
  classifyGesture,
  createRoamingController,
  pathClear,
  planTarget,
  setManualCooldown,
  type PetRoamState,
  type PlanTargetInput,
  type PointerGesture,
  type RoamCommand,
  type RoamMoveKind,
  type RoamTarget,
  type RoamingController,
  type RoamingControllerOptions,
} from '../pet/roaming.js';
export {
  isQuietHours,
  parseClock,
  priorityRank,
  resolveScenePolicy,
  sceneDedupeKey,
  sceneForEvent,
  scenesForEvents,
  createSceneQueue,
  type PetNotificationScene,
  type ScenePolicy,
  type ScenePolicyOptions,
  type ScenePriority,
  type SceneQueue,
} from './scenes.js';
export {
  BUILTIN_SKINS,
  DEFAULT_SKIN_ID,
  PROTECTED_MOOD_COLORS,
  PROTECTED_SEVERITY_COLORS,
  SEMANTIC_COLOR_FAMILY,
  defaultSkinFor,
  protectedMoodColor,
  resolveSkin,
  resolveSkinAccessory,
  resolveSkinAsset,
  skinAssetSrc,
  skinsForCharacter,
  validateSkin,
  type PetSkinManifest,
  type PetSkinPalette,
  type SkinAssetResolution,
  type SkinValidation,
} from '../pet/skins.js';

export interface ResolvePetFrameInput {
  limits: Limit[];
  subscriptions: SubscriptionInfo[];
  settings: PetSettings;
  now?: number;
  /** The most recent important event, if any; drives temporary focus and the bubble. */
  event?: PresenceEvent | null;
  /** Override the derived activity signal (tests, or an explicit user action). */
  activeOwnerKey?: string | null;
  /**
   * Wave 3: the event allowed to raise an automatic bubble, when the scene policy suppresses
   * one (quiet hours) that focus/animation should still reflect. Defaults to `event`, so the
   * pre-Wave-3 behavior is unchanged.
   */
  bubbleEvent?: PresenceEvent | null;
}

/** A reset this close raises the countdown badge above the Pet. */
export const RESET_BADGE_WITHIN_MS = PET_POINT_WITHIN_MS;

export function resolvePetFrame(input: ResolvePetFrameInput): PetFrame {
  const now = input.now ?? Date.now();
  const settings = input.settings;
  const activity = input.activeOwnerKey ?? pickActiveOwner(input.subscriptions, now);
  const activeKeys = activity ? new Set([activity]) : new Set<string>();

  const providers = buildProviderPresence(input.limits, input.subscriptions, now, activeKeys);
  const global = { severity: resolveGlobalSeverity(providers), highest: highestProvider(providers) };

  const focus = selectFocus(providers, {
    now,
    pinnedOwnerKey: settings.focusMode === 'pinned' ? settings.pinnedOwnerKey : null,
    activeOwnerKey: activity,
    event: input.event ?? null,
    rotateIntervalMs: settings.rotateIntervalMs,
  });

  const mood = resolvePetMood(focus, input.event ?? null);
  const showGlobalAlert = shouldShowGlobalAlert(global.severity, focus);

  const badge =
    focus?.resetsAt != null && focus.resetsAt > now && focus.resetsAt - now <= RESET_BADGE_WITHIN_MS
      ? shortCountdown(focus.resetsAt - now)
      : null;

  // An event bubble only lives for its own short window; after that the focus reverts.
  // `bubbleEvent` lets the caller suppress the interruption (quiet hours) while the focus
  // and animation still follow the event itself.
  const bubbleSource = input.bubbleEvent !== undefined ? input.bubbleEvent : (input.event ?? null);
  const freshEvent =
    bubbleSource && now - bubbleSource.at <= EVENT_FOCUS_MS ? bubbleSource : null;
  const bubble =
    settings.speechBubbles && freshEvent
      ? eventBubble(freshEvent, providers.find((p) => p.key === freshEvent.ownerKey), now)
      : null;

  const baseAnimation = baseAnimationForMood(mood, !!bubble);

  return {
    mood,
    spriteIndex: SPRITE_INDEX[mood],
    colorCss: MOOD_COLORS[mood],
    focus,
    providers,
    global,
    showGlobalAlert,
    alertColorCss: SEVERITY_COLORS[global.severity],
    badge,
    bubble,
    movement: settings.movement,
    reducedMotion: settings.reducedMotion,
    character: settings.character,
    // Persistent base animation. `main.ts` layers transient overrides (intros/reset/
    // hover/click) on top via the stateful resolver, which also suppresses restarts.
    animation: baseAnimation,
    animationPlayback: animationPlayback(baseAnimation),
    // Filled by the main process from the character manifest when a raster clip exists.
    animationSrc: null,
    motion: null,
    // Wave 2 layers; main fills interaction/facing and clamps locomotion via the policy.
    layers: { mood, expression: 'none', locomotion: 'stationary', interaction: 'none', facing: 'right' },
    // Vector mascots are drawn from the frame's own mood/colour/percentage, so the art is
    // resolved here where those values already exist. Raster mascots keep their asset set.
    spriteSvg: isVectorCharacter(settings.character)
      ? renderPetSvg(settings.character, mood, {
          color: MOOD_COLORS[mood],
          percent: focus?.usedPercent ?? null,
        })
      : null,
    // Skins are presentation-only; main.ts fills these from the skin manifest.
    skinAccessory: null,
    skinAccentCss: null,
    hasData: providers.some((p) => p.usedPercent != null),
    updatedAt: now,
  };
}
