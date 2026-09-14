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
    hasData: providers.some((p) => p.usedPercent != null),
    updatedAt: now,
  };
}
