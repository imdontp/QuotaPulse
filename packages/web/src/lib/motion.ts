import type { TargetAndTransition, Transition, VariantLabels } from 'motion/react';
import { useReducedMotion } from 'motion/react';

/**
 * The app's motion vocabulary, in one place.
 *
 * Why this exists. Motion was previously expressed three different ways at eleven call
 * sites -- `initial={reduced ? false : {...}}`, `duration: reduced ? 0 : X`, and
 * `animate={reduced ? undefined : {...}}` -- with no shared duration or easing token
 * anywhere. The house curve `[0.22, 1, 0.36, 1]` was spelled out as a literal five times,
 * and sixteen `transition-colors` sat at Tailwind's unnamed 150ms default because nothing
 * said how long a hover was supposed to be. Two consequences: a new animation had no
 * guidance to follow, and a revised duration had eleven places to be found in.
 *
 * The shape of the fix is that a caller names an *intent* (`reveal`, `settle`, `draw`,
 * `acknowledge`) rather than a number, so the same word produces the same motion everywhere
 * and a change to the scale is one edit. `prefers-reduced-motion` is then handled by the
 * token itself: `dur()` returns 0 and the springs collapse, so no call site can forget.
 *
 * The CSS half of the same scale lives in `index.css` as `--motion-*` and `--ease-*`.
 * `test/motion-tokens.test.ts` asserts the two agree, because a CSS token that drifts from
 * its TypeScript twin is exactly the kind of quiet split nobody notices until the two
 * halves stop matching on screen.
 */

/** The house curve. Everything that moves into place uses this. */
export const EASE = {
  /** Standard reveal and settle. The default, and correct most of the time. */
  motion: [0.22, 1, 0.36, 1],
  /** Arriving. Slightly more eager than `motion`, for elements that did not exist before. */
  entrance: [0.16, 1, 0.3, 1],
  /** Leaving. Faster and decelerating: it has already been read. */
  exit: [0.4, 0, 1, 1],
} as const;

/** Named durations, in milliseconds. Five steps and nothing between them. */
export const DURATION = {
  /** Hover and press feedback. Below the threshold where motion reads as animation. */
  instant: 120,
  /** A small state change: a row tinting, a disclosure opening. */
  fast: 180,
  /** The default for anything a user is waiting on. */
  base: 260,
  /** A larger surface moving: a panel, a card, a section. */
  slow: 420,
  /** A one-time reveal that is meant to be watched: a bar filling in, a chart drawing. */
  deliberate: 700,
} as const;

export type MotionIntent = keyof typeof DURATION;
export type EasingName = keyof typeof EASE;

/**
 * Springs, for values that should arrive rather than travel.
 *
 * Two, and they are not interchangeable. `read` is for a number a person is comparing
 * against another number, so it is damped hard enough to settle without overshooting into
 * a value that was never true. `snap` is for a control that should feel attached to the
 * cursor or the finger. A spring that overshoots a *reading* is a lie about the reading for
 * about a third of a second, which is why these are named by what they promise.
 */
export const SPRING = {
  read: { type: 'spring', stiffness: 90, damping: 22, mass: 0.6 },
  snap: { type: 'spring', stiffness: 420, damping: 34 },
} as const;

export interface MotionPref {
  /** True when the reader has asked the system for less movement. */
  reduced: boolean;
  /** Duration in ms, forced to 0 under reduced motion. */
  dur: (intent: MotionIntent) => number;
  /** Easing curve, by name. */
  ease: (name?: EasingName) => number[];
  /** A transition for a reveal: named duration and the house curve. */
  reveal: (intent?: MotionIntent, name?: EasingName, delay?: number) => Transition;
  /** A spring for a value that should arrive rather than travel. */
  spring: (kind?: keyof typeof SPRING) => Transition;
  /**
   * `initial` for an entrance. `false` under reduced motion, which is what tells `motion`
   * to skip the enter phase entirely instead of running it at zero duration.
   */
  enter: (from: TargetAndTransition | VariantLabels) => TargetAndTransition | VariantLabels | false;
}

/**
 * The whole motion vocabulary, already reduced.
 *
 * One hook rather than `useReducedMotion` plus a helper at every call site, because the
 * thing that kept being got wrong was not the check -- it was that each site then had to
 * remember what to do about it, and four of them did not (the sparkline, both bar
 * components and the nav pill still animated under `prefers-reduced-motion`, below the
 * reach of the global CSS clamp because they are JS-driven).
 */
export function useMotionPref(): MotionPref {
  const reduced = useReducedMotion() === true;
  return {
    reduced,
    dur: (intent) => (reduced ? 0 : DURATION[intent]),
    ease: (name = 'motion') => [...EASE[name]],
    reveal: (intent = 'base', name = 'motion', delay = 0) => ({
      duration: reduced ? 0 : DURATION[intent],
      ease: [...EASE[name]],
      // A stagger is motion too. Under reduced motion the delay is dropped as well as the
      // duration, because holding each item back and then snapping it is not a quieter
      // version of a stagger -- it is the same waiting, with the movement taken out.
      ...(delay > 0 && !reduced ? { delay } : {}),
    }),
    spring: (kind = 'read') => (reduced ? { duration: 0 } : { ...SPRING[kind] }),
    enter: (from) => (reduced ? false : from),
  };
}
