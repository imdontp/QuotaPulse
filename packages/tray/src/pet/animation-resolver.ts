import type {
  AnimationPlayback,
  PetAnimationId,
  PetCharacterId,
  PetGlobalStatus,
  PetFocusStatus,
  PetMood,
  PetVisualState,
} from '../presence/types.js';
import {
  animationPlayback,
  baseAnimationForMood,
  isOnce,
  ONCE_DURATION_MS,
  type OnceAnimationId,
} from './runtime.js';

/**
 * Transient-vs-persistent animation resolution (Next Handoff Pack
 * `04_runtime_contract/ANIMATION_RESOLVER_RULES.md`).
 *
 * The resolver is stateful on purpose: it owns restart suppression, so a fresh quota
 * reading every poll does not restart the same loop (the visible stutter the rules call
 * out). It never touches provider/focus/mood — switching characters changes `characterId`
 * here and nothing else in the engine.
 */

export interface AnimationEvent {
  type: 'warning' | 'critical' | 'reset';
}

export type PetInteraction = 'hover' | 'click' | null;

export interface ResolveAnimationInput {
  characterId: PetCharacterId;
  assetVersion?: number;
  mood: PetMood;
  bubbleOpen: boolean;
  reducedMotion: boolean;
  now: number;
  /** New threshold/reset events from this tick's event tracker. */
  events?: AnimationEvent[];
  /** Interaction captured since the previous resolve (at most one per entry). */
  interaction?: PetInteraction;
}

export interface AnimationDecision {
  animation: PetAnimationId;
  playback: AnimationPlayback;
  /**
   * True when the renderer should (re)start the clip. False means keep the current clip
   * playing, which is what suppresses restart storms on every quota refresh.
   */
  restart: boolean;
}

/** Higher wins. Base animation is 0. Mirrors the resolver rules' priority list. */
const PRIORITY: Record<OnceAnimationId, number> = {
  critical_intro: 5,
  warning_intro: 4,
  reset_celebrate: 3,
  click_react: 2,
  hover_react: 1,
};

function pickTransient(input: ResolveAnimationInput): OnceAnimationId | null {
  const candidates: OnceAnimationId[] = [];
  for (const event of input.events ?? []) {
    if (event.type === 'critical') candidates.push('critical_intro');
    if (event.type === 'warning') candidates.push('warning_intro');
    if (event.type === 'reset') candidates.push('reset_celebrate');
  }
  if (input.interaction === 'click') candidates.push('click_react');
  if (input.interaction === 'hover') candidates.push('hover_react');
  if (candidates.length === 0) return null;
  return candidates.reduce((a, b) => (PRIORITY[b] > PRIORITY[a] ? b : a));
}

export interface AnimationResolver {
  resolve(input: ResolveAnimationInput): AnimationDecision;
  /** Forget local animation history, e.g. when Pet Mode is toggled off and back on. */
  reset(): void;
  /** The animation currently held, for tests and diagnostics. */
  current(): PetAnimationId | null;
}

export function createAnimationResolver(): AnimationResolver {
  let override: { id: OnceAnimationId; until: number } | null = null;
  let current: PetAnimationId | null = null;
  let currentCharacter: PetCharacterId | null = null;
  let currentVersion: number | null = null;

  return {
    current: () => current,
    reset(): void {
      override = null;
      current = null;
      currentCharacter = null;
      currentVersion = null;
    },
    resolve(input: ResolveAnimationInput): AnimationDecision {
      const { now } = input;
      const version = input.assetVersion ?? 1;

      if (override && now >= override.until) override = null;

      const candidate = pickTransient(input);
      let startedTransient = false;
      if (candidate && (!override || PRIORITY[candidate] > PRIORITY[override.id])) {
        override = { id: candidate, until: now + ONCE_DURATION_MS[candidate] };
        startedTransient = true;
      }

      const animation: PetAnimationId = override ? override.id : baseAnimationForMood(input.mood, input.bubbleOpen);

      // Restart only when the clip actually changes, the character changes, a new
      // transient fires, or the asset set is bumped. Never merely because data arrived.
      const restart =
        startedTransient ||
        animation !== current ||
        input.characterId !== currentCharacter ||
        version !== currentVersion;

      current = animation;
      currentCharacter = input.characterId;
      currentVersion = version;
      return { animation, playback: animationPlayback(animation), restart };
    },
  };
}

export interface VisualStateInput {
  characterId: PetCharacterId;
  mood: PetMood;
  decision: AnimationDecision;
  global: PetGlobalStatus;
  focus: PetFocusStatus;
  bubbleOpen: boolean;
  reducedMotion: boolean;
}

/** Compose the renderer-facing state from an animation decision (Phase C data flow). */
export function toVisualState(input: VisualStateInput): PetVisualState {
  return {
    characterId: input.characterId,
    mood: input.mood,
    animation: input.decision.animation,
    global: input.global,
    focus: input.focus,
    bubbleOpen: input.bubbleOpen,
    reducedMotion: input.reducedMotion,
  };
}

export { isOnce };
