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

/** Degrees of the overflow marker, centred on six o'clock. */
export const OVERFLOW_SWEEP = 46;
const OVERFLOW_STROKE = 5;
const OVERFLOW_INSET = 11;

/**
 * Where the "and N more" marker sits.
 *
 * A PARTIAL arc rather than a fifth full circle. A full thin ring inside four data arcs
 * reads as a fifth subscription, and on a single-arc ring it would sit so close to the one
 * real arc that the two look like one thick line. A short segment low on the dial cannot be
 * mistaken for a reading, and it leaves the middle of the ring -- where the numerals are --
 * completely clear at every arc count.
 *
 * Returns null when there is nothing to indicate, or no room for a marker inside the
 * innermost arc.
 */
export function overflowSlot(arcs: RingArc[]): { radius: number; strokeWidth: number } | null {
  const inner = arcs.at(-1);
  if (!inner) return null;
  const radius = inner.radius - OVERFLOW_INSET;
  // The numerals are about 50 units of radius; a marker inside that would cross the text.
  if (radius < 58) return null;
  return { radius, strokeWidth: OVERFLOW_STROKE };
}

/** An SVG path for a clockwise arc between two degrees, zero being twelve o'clock. */
export function arcPath(cx: number, cy: number, radius: number, fromDeg: number, toDeg: number): string {
  const at = (deg: number) => {
    const rad = (deg * Math.PI) / 180;
    return { x: cx + radius * Math.cos(rad), y: cy + radius * Math.sin(rad) };
  };
  const a = at(fromDeg);
  const b = at(toDeg);
  const large = Math.abs(toDeg - fromDeg) > 180 ? 1 : 0;
  return `M ${a.x.toFixed(2)} ${a.y.toFixed(2)} A ${radius} ${radius} 0 ${large} 1 ${b.x.toFixed(2)} ${b.y.toFixed(2)}`;
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
