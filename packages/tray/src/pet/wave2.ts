import type {
  MovementMode,
  PetBehaviorContext,
  PetFacing,
  PetInteractionId,
  PetLayeredVisualState,
  PetLocomotionId,
  PetMood,
  PetCharacterId,
} from '../presence/types.js';

/**
 * Wave 2 behavior policy (Next Wave 2 Pack: `04_runtime_layering`,
 * `02_motion_bible`, `06_qa`).
 *
 * Pure decisions only — the tray/renderer executes them. Keeping the policy pure is what
 * makes "may the Pet walk right now, and why" answerable in a test instead of by watching
 * a desktop mascot.
 */

/* --------------------------------------------------------------- Runtime asset paths */

/** Expression/locomotion clips the asset agent delivers under `assets/pets/<id>/locomotion`. */
export const WAVE2_EXPRESSION_ASSETS = [
  'blink',
  'look_left',
  'look_right',
  'idle_variant_1',
  'idle_variant_2',
] as const;

export const WAVE2_LOCOMOTION_ASSETS = [
  'walk_left',
  'walk_right',
  'turn_left',
  'turn_right',
  'stop_left',
  'stop_right',
] as const;

export const WAVE2_EXTENDED_ASSETS = ['sit', 'lie_down', 'sleep_loop', 'wake_up', 'stretch'] as const;

export type Wave2AssetId =
  | (typeof WAVE2_EXPRESSION_ASSETS)[number]
  | (typeof WAVE2_LOCOMOTION_ASSETS)[number]
  | (typeof WAVE2_EXTENDED_ASSETS)[number];

/** The runtime `src` a Wave 2 clip is expected at, even before the file exists. */
export function wave2ClipSrc(characterId: PetCharacterId, asset: Wave2AssetId): string {
  const dir = characterId.replace(/_/g, '-');
  return `/assets/pets/${dir}/locomotion/${asset}.webp`;
}

/* ------------------------------------------------------------------- Motion policy */

/**
 * Autonomous locomotion is only allowed in Companion/Roaming, never under reduced motion,
 * never while the pointer is on the Pet or a bubble is open (WAVE2_LAYERING_RULES.md §5,
 * WAVE2_SCOPE.md §3).
 */
export function locomotionAllowed(ctx: PetBehaviorContext): boolean {
  if (ctx.reducedMotion) return false;
  if (ctx.movementMode === 'minimal') return false;
  if (ctx.userHovering || ctx.userDragging) return false;
  if (ctx.bubbleOpen) return false;
  return true;
}

/** Urgent intros and click acknowledgement suppress locomotion (WAVE2_MOTION_BIBLE.md §2). */
export function interactionBlocksLocomotion(interaction: PetInteractionId): boolean {
  return (
    interaction === 'warning_intro' ||
    interaction === 'critical_intro' ||
    interaction === 'reset_celebrate' ||
    interaction === 'click_react'
  );
}

export interface LocomotionRange {
  min: number;
  max: number;
}

/**
 * Local range relative to the anchor (WAVE2_MOTION_BIBLE.md §4). Roaming is kept for
 * continuity but is explicitly "optional / later" so it is not the default.
 */
export function locomotionRange(mode: MovementMode): LocomotionRange {
  if (mode === 'companion') return { min: 20, max: 150 };
  if (mode === 'roaming') return { min: 120, max: 520 };
  return { min: 0, max: 0 };
}

/** The turn direction needed to face a destination, or null when already facing it. */
export function turnFor(destinationX: number, currentX: number, facing: PetFacing): 'turn_left' | 'turn_right' | null {
  if (destinationX < currentX && facing === 'right') return 'turn_left';
  if (destinationX > currentX && facing === 'left') return 'turn_right';
  return null;
}

/* ---------------------------------------------------------------- Idle scheduler */

export type IdleBehavior =
  | 'blink'
  | 'look_left'
  | 'look_right'
  | 'idle_variant_1'
  | 'idle_variant_2'
  | 'stretch'
  | 'sit'
  | 'lie_down'
  | 'sleep_loop'
  | 'reposition';

/**
 * Weighted actions available after a stable-idle threshold (WAVE2_MOTION_BIBLE.md §3). The
 * scheduler must randomize within these, not fire on a fixed cadence, so the Pet never
 * reads as a metronome.
 */
export const IDLE_BEHAVIOR_TIERS: ReadonlyArray<{ afterMs: number; behaviors: readonly IdleBehavior[] }> = [
  { afterMs: 10_000, behaviors: ['blink', 'look_left', 'look_right'] },
  { afterMs: 18_000, behaviors: ['blink', 'look_left', 'look_right', 'idle_variant_1', 'idle_variant_2'] },
  { afterMs: 35_000, behaviors: ['idle_variant_1', 'idle_variant_2', 'look_left', 'look_right', 'stretch'] },
  { afterMs: 60_000, behaviors: ['sit', 'lie_down', 'stretch', 'idle_variant_1'] },
  { afterMs: 120_000, behaviors: ['sleep_loop', 'lie_down'] },
];

/** The behaviors unlocked at a given idle duration (most recent tier only). */
export function idleBehaviorsFor(elapsedIdleMs: number): readonly IdleBehavior[] {
  let behaviors: readonly IdleBehavior[] = [];
  for (const tier of IDLE_BEHAVIOR_TIERS) {
    if (elapsedIdleMs >= tier.afterMs) behaviors = tier.behaviors;
  }
  return behaviors;
}

/**
 * Pick an idle behavior, or null when nothing is allowed yet. `reposition` is only in the
 * pool when locomotion is permitted, so Minimal/reduced-motion/bubble never walk.
 */
export function pickIdleBehavior(
  ctx: PetBehaviorContext,
  rng: () => number = Math.random,
): IdleBehavior | null {
  const base = idleBehaviorsFor(ctx.elapsedIdleMs);
  if (base.length === 0) return null;
  const pool = locomotionAllowed(ctx) ? [...base, 'reposition' as const] : base;
  return pool[Math.floor(rng() * pool.length)] ?? null;
}

/* ---------------------------------------------------------------- Layer resolver */

export interface ResolveLayersInput {
  mood: PetMood;
  interaction: PetInteractionId;
  facing: PetFacing;
  /** Locomotion the renderer currently intends; suppressed if the policy forbids it. */
  locomotion?: PetLocomotionId;
  expression?: PetLayeredVisualState['expression'];
  context: PetBehaviorContext;
}

/**
 * Combine the four layers, clamping locomotion when the policy or an interaction override
 * forbids it (WAVE2_LAYERING_RULES.md §1, WAVE2_MOTION_BIBLE.md §2).
 */
export function resolveLayeredState(input: ResolveLayersInput): PetLayeredVisualState {
  let locomotion: PetLocomotionId = input.locomotion ?? 'stationary';
  if (!locomotionAllowed(input.context) || interactionBlocksLocomotion(input.interaction)) {
    locomotion = 'stationary';
  }
  return {
    mood: input.mood,
    expression: input.expression ?? 'none',
    locomotion,
    interaction: input.interaction,
    facing: input.facing,
  };
}

/** Map a resolved Wave 1 interaction animation onto the interaction layer id. */
export function interactionForAnimation(animation: string): PetInteractionId {
  switch (animation) {
    case 'warning_intro':
    case 'critical_intro':
    case 'reset_celebrate':
    case 'hover_react':
    case 'click_react':
    case 'talk_loop':
      return animation;
    default:
      return 'none';
  }
}

/** Flux Blob glides/morphs instead of faking leg steps (AI_AGENT_WAVE2_HANDOFF_PROMPT.md). */
export function usesLegWalk(characterId: PetCharacterId): boolean {
  return characterId !== 'flux_blob';
}
