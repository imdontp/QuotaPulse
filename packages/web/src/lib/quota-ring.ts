import type { Limit } from '../api';
import { credibleProjection, WINDOW_SPAN_MS } from '../format';

/**
 * Geometry for the Live quota ring.
 *
 * Kept apart from the component so the arithmetic is testable on its own: these are the
 * numbers a user will judge the whole page by, and an off-by-one in a projected-exhaustion
 * marker is a wrong claim about their quota, not a cosmetic slip.
 */

export const RING_MAX = 4;

/** Innermost arc radius, chosen so the centre stays wide enough for the numerals. */
const INNER = 78;
const OUTER = 168;

export interface RingArc {
  index: number;
  radius: number;
  strokeWidth: number;
}

/**
 * Shortest value arc the ring will draw, as a fraction of the circumference.
 *
 * A window at 0% or 1% is the normal case on a healthy install, and a true-to-scale arc
 * there is a sub-pixel nub: three tracked accounts and one dark empty ring, which reads as
 * a broken gauge rather than a quiet one. The floor keeps every arc visible without making
 * a small number look like a large one.
 */
export const MIN_ARC_FRACTION = 1.5;

/**
 * Spreads up to `RING_MAX` arcs across one fixed band, so the ring occupies the same
 * footprint with two subscriptions or four. Beyond that the inner radius would collapse
 * into the centre readout, so the caller folds the remainder into a count.
 */
export function ringArcs(count: number): RingArc[] {
  const n = Math.max(0, Math.min(RING_MAX, Math.floor(Number.isFinite(count) ? count : 0)));
  const span = n > 1 ? OUTER - INNER : 0;
  return Array.from({ length: n }, (_, index) => ({
    index,
    radius: n > 1 ? OUTER - (span * index) / (n - 1) : OUTER,
    strokeWidth: n >= 4 ? 13 : 15,
  }));
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

// Re-exported so callers of this module have one import for everything about the ring,
// while the judgement itself stays in `format.ts` beside `willExhaust` and `isExpired` --
// it is a semantic rule, not geometry, and duplicating it is how the ring and the attention
// panel came to disagree about the same window.
export { MIN_BURN_SAMPLES, PROJECTION_RATE_MULTIPLE, credibleProjection } from '../format';

export interface RingWindow {
  /** 0-1 through the current window, or null with no reset time to measure against. */
  elapsed: number | null;
  /** 0-1 position of the projected 100% point, or null with no projection. */
  projected: number | null;
  /** True when that projection lands before the reset, i.e. the window runs out first. */
  willRunOut: boolean;
}

const NO_WINDOW: RingWindow = { elapsed: null, projected: null, willRunOut: false };

/**
 * Where "now" sits inside a quota window, and where the burn rate says 100% will land.
 *
 * The two together are the point of the marker: 88% used reads as a number, while "88%, and
 * at the current rate it is full at 05:44" reads as a decision. Derived from the same span
 * table the daemon uses so the ring cannot disagree with the tray about a window's length.
 */
export function windowProgress(limit: Limit, now: number): RingWindow {
  const span = WINDOW_SPAN_MS[limit.window_kind];
  const reset = limit.resets_at;
  if (span == null || span <= 0 || reset == null) return NO_WINDOW;
  const start = reset - span;
  // The credible projection, not the stored one: an unbelievable record must not be able
  // to paint a warning on the ring.
  const fullAt = credibleProjection(limit, now);
  return {
    elapsed: clamp01((now - start) / span),
    projected: fullAt == null ? null : clamp01((fullAt - start) / span),
    willRunOut: fullAt != null,
  };
}

/** Degrees clockwise from twelve o'clock for a 0-1 fraction of a sweep. */
export function fractionToAngle(fraction: number): number {
  return clamp01(fraction) * 360 - 90;
}
