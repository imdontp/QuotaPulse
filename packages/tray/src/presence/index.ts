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
export { statusBubble, eventBubble, daemonDownBubble, noDataBubble, snoozedBubble } from './bubble.js';
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
  createAnimationResolver,
  toVisualState,
  type AnimationDecision,
  type AnimationEvent,
  type AnimationResolver,
  type PetInteraction,
  type ResolveAnimationInput,
  type VisualStateInput,
} from '../pet/animation-resolver.js';

export interface ResolvePetFrameInput {
  limits: Limit[];
  subscriptions: SubscriptionInfo[];
  settings: PetSettings;
  now?: number;
  /** The most recent important event, if any; drives temporary focus and the bubble. */
  event?: PresenceEvent | null;
  /** Override the derived activity signal (tests, or an explicit user action). */
  activeOwnerKey?: string | null;
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
  const freshEvent =
    input.event && now - input.event.at <= EVENT_FOCUS_MS ? input.event : null;
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
    // Vector mascots are drawn from the frame's own mood/colour/percentage, so the art is
    // resolved here where those values already exist. Raster mascots keep their asset set.
    spriteSvg: isVectorCharacter(settings.character)
      ? renderPetSvg(settings.character, mood, {
          color: MOOD_COLORS[mood],
          percent: focus?.usedPercent ?? null,
        })
      : null,
    hasData: providers.some((p) => p.usedPercent != null),
    updatedAt: now,
  };
}
