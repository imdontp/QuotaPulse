import type { AnimationPlayback, PetAnimationId, PetMood } from '../presence/types.js';

/**
 * Wave 1 animation runtime contract (Next Handoff Pack Phase A / C).
 *
 * Pure logic: no Electron, no filesystem. The persistent base animation comes from the
 * mood; transient reactions (threshold intros, reset, hover, click) temporarily override
 * it. The stateful priority + restart-suppression live in `animation-resolver.ts`.
 */

/** Playback mode per animation id (WAVE1_PRODUCTION_ASSET_BIBLE.md §1). */
export const ANIMATION_PLAYBACK: Record<PetAnimationId, AnimationPlayback> = {
  healthy_idle: 'loop',
  working_loop: 'loop',
  warning_intro: 'once',
  warning_loop: 'loop',
  critical_intro: 'once',
  critical_loop: 'loop',
  reset_celebrate: 'once',
  talk_loop: 'loop',
  hover_react: 'once',
  click_react: 'once',
};

/**
 * How long a `once` animation holds before control returns to the base loop. Midpoints of
 * the bible's timing bands, so a missing completion callback can never wedge the Pet.
 */
export type OnceAnimationId =
  | 'warning_intro'
  | 'critical_intro'
  | 'reset_celebrate'
  | 'hover_react'
  | 'click_react';

export const ONCE_DURATION_MS: Record<OnceAnimationId, number> = {
  warning_intro: 1_100,
  critical_intro: 1_000,
  reset_celebrate: 2_800,
  hover_react: 600,
  click_react: 750,
};

export function animationPlayback(id: PetAnimationId): AnimationPlayback {
  return ANIMATION_PLAYBACK[id];
}

export function isOnce(id: PetAnimationId): boolean {
  return ANIMATION_PLAYBACK[id] === 'once';
}

/**
 * The persistent base animation for a mood, with the bubble rule applied
 * (ANIMATION_RESOLVER_RULES.md §Talk behavior):
 *
 * - `talk_loop` may replace `healthy_idle` / `working_loop` while a bubble is open;
 * - it must NOT replace warning/critical/reset — those stay legible during a bubble;
 * - `unknown` falls back to `healthy_idle` (neutral placeholder).
 */
export function baseAnimationForMood(mood: PetMood, bubbleOpen: boolean): PetAnimationId {
  switch (mood) {
    case 'working':
      return bubbleOpen ? 'talk_loop' : 'working_loop';
    case 'warning':
      return 'warning_loop';
    case 'critical':
      return 'critical_loop';
    case 'reset':
      return 'reset_celebrate';
    case 'unknown':
    case 'healthy':
    default:
      return bubbleOpen ? 'talk_loop' : 'healthy_idle';
  }
}
