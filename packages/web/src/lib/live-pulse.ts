import type { Limit, Overview } from '../api';
import { isExpired, severityOf, thresholdLimits, willExhaust } from '../format';
import { quotaSummaries, type Readiness } from './quota-summary';
import { RING_MAX, credibleProjection, windowProgress, type RingWindow } from './quota-ring';

/**
 * The data behind the Live pulse: which quota windows earn an arc, how urgent each one is,
 * where "now" sits inside the busiest one, and how hard the machine is currently working.
 *
 * Pure and separate from the component so the ranking can be tested directly. The order
 * rule is the whole point -- the outermost arc is the one a user should notice first, so
 * anything needing attention has to land on the outside, and a subscription with no reading
 * still gets a slot so its absence is visible rather than implied.
 */

/**
 * Group upcoming resets that land at the same moment.
 *
 * Proportional time layout is the wrong model for this data. Rolling five-hour windows
 * mean several subscriptions routinely reset in the same minute, and a stop list laid out
 * by raw gap then gives three zero-width columns and one enormous one -- the labels
 * collide and the clustering that mattered is destroyed. Simultaneous resets are one
 * event, so they are one stop.
 */
export function groupResets(
  resets: ReadonlyArray<{ at: number }>,
  toleranceMs = 60_000,
): Array<{ at: number; members: number }> {
  const groups: Array<{ at: number; members: number }> = [];
  for (const reset of [...resets].sort((a, b) => a.at - b.at)) {
    const last = groups.at(-1);
    if (last && Math.abs(last.at - reset.at) <= toleranceMs) last.members += 1;
    else groups.push({ at: reset.at, members: 1 });
  }
  return groups;
}

/**
 * Column weights for those groups: how much of the strip each one occupies.
 *
 * Proportional to the time until the next group, then clamped. Without the clamp a
 * 93-hour gap next to three simultaneous resets starves the others of any width at all;
 * with it, a cluster stays visibly tighter than a distant event without any label ever
 * losing enough room to be read.
 */
export function groupWeights(at: readonly number[]): number[] {
  if (at.length === 0) return [];
  const gaps: number[] = [];
  for (let i = 0; i < at.length - 1; i += 1) gaps.push(Math.max(0, at[i + 1]! - at[i]!));
  const mean = gaps.length > 0 ? gaps.reduce((a, b) => a + b, 0) / gaps.length : 0;
  // The final group has no following gap, so it takes the neutral weight.
  return at.map((_, i) => (i === gaps.length ? 1 : mean > 0 ? Math.min(3, Math.max(0.6, gaps[i]! / mean)) : 1));
}

/**
 * Tokens in the last three hourly buckets, taken as the maximum.
 *
 * The peak rather than the mean, deliberately: a single spike is the honest answer to
 * "how hard is this machine working right now", whereas a mean would report a quiet figure
 * for the hour a burst actually happened in. Three buckets so the number does not flicker
 * with every partial hour.
 */
export function recentRate(hourly: readonly number[]): number {
  if (hourly.length === 0) return 0;
  return Math.max(0, ...hourly.slice(-3));
}

/** An hour this busy is treated as a full-intensity field. */
export const BUSY_TOKENS_PER_HOUR = 250_000;

/**
 * Maps a token rate to 0-1 for the backdrop.
 *
 * Exponential rather than a linear divide: a busy coding session is a few hundred thousand
 * tokens an hour, so a linear scale against any realistic ceiling would leave the field
 * permanently dim. This saturates smoothly instead, and never reaches or exceeds 1.
 */
export function intensityOf(rate: number): number {
  if (!Number.isFinite(rate) || rate <= 0) return 0;
  return 1 - Math.exp(-rate / BUSY_TOKENS_PER_HOUR);
}

/**
 * The reading a card or arc should quote: the one that runs out, else the one at the
 * threshold, else the FULLEST window.
 *
 * The last step used to be `limits[0]`, which is whatever order the API returned and has
 * nothing to do with which window matters most. On a real database that hid a weekly
 * window at 55% behind a five-hour window at 0%, and the page opened on "1%" while a
 * majority-full quota was nowhere on screen. It is also the step most often reached, since
 * a healthy install is under the threshold almost everywhere.
 */
export function primaryReading(limits: Limit[], now: number): Limit | undefined {
  const exhausting = limits.find((l) => willExhaust(l, now));
  if (exhausting) return exhausting;
  const atThreshold = thresholdLimits(limits, now)[0];
  if (atThreshold) return atThreshold;
  let best: Limit | undefined;
  for (const limit of limits) {
    if (isExpired(limit, now)) continue;
    if (best == null || (limit.used_percent ?? -1) > (best.used_percent ?? -1)) best = limit;
  }
  return best ?? limits[0];
}

export interface PulseItem {
  key: string;
  name: string;
  windowKind: string;
  /** 0-100, or null when there is no current reading to quote. */
  used: number | null;
  expired: boolean;
  /** Projected to hit 100% before this window resets. */
  urgent: boolean;
  resetsAt: number | null;
  ageSeconds: number | null;
  /** Percentage points per hour, when the daemon has enough samples to say. */
  burnRate: number | null;
  projectedFullAt: number | null;
  tone: 'ok' | 'warn' | 'crit';
}

export interface PulseModel {
  /** Ranked most urgent first; already capped to the arcs the ring can actually draw. */
  items: PulseItem[];
  /**
   * Tracked subscriptions with a real reading that the cap pushed off the ring.
   *
   * Counted, not dropped: an account that is at 60% and does not appear anywhere because
   * four quieter ones took the slots is a worse failure than a busy ring.
   */
  folded: number;
  /**
   * Subscriptions being tracked with no current reading. They are counted separately
   * instead of being given an arc, because a dashed ring showing "--" is not information.
   */
  unmeasured: number;
  /** The outermost arc's subscription. Always `items[0]`, so headline and ring agree. */
  primary: PulseItem | null;
  /** Time position of the primary window, for the outer track. */
  window: RingWindow | null;
}

const EMPTY: PulseModel = { items: [], folded: 0, unmeasured: 0, primary: null, window: null };

/** Mirrors the ordering `quotaSummaries` already applies, as a number this module can sort on. */
const STATUS_RANK: Record<Readiness, number> = { attention: 0, check: 1, available: 2, inactive: 3 };

export function pulseModel(ov: Overview, hidden: string[] = [], max = RING_MAX): PulseModel {
  const now = ov.now;
  const summaries = quotaSummaries(ov, hidden).filter((s) => s.status !== 'inactive');
  if (summaries.length === 0) return EMPTY;

  const entries = summaries.map(({ subscription, limits, status }) => {
    const limit = primaryReading(limits, now);
    const expired = limit ? isExpired(limit, now) : true;
    const used = limit && !expired && limit.used_percent != null
      ? Math.min(100, Math.max(0, limit.used_percent))
      : null;
    const item: PulseItem = {
      key: subscription.subscription_key,
      name: subscription.subscription_display_name,
      windowKind: limit?.window_kind ?? '',
      used,
      expired: expired || used == null,
      urgent: limit ? willExhaust(limit, now) : false,
      resetsAt: limit?.resets_at ?? null,
      ageSeconds: limit?.ageSeconds ?? null,
      // Same credibility rule as the ring, so the headline and the arc cannot disagree
      // about whether a projection counts. The rate itself still needs a positive slope.
      burnRate:
        limit?.burn && credibleProjection(limit, now) != null && limit.burn.percentPerHour > 0
          ? limit.burn.percentPerHour
          : null,
      projectedFullAt: limit ? credibleProjection(limit, now) : null,
      tone: severityOf(used),
    };
    // The reading travels with its own item, so the time track is always computed from the
    // same `now` as the arc and never re-resolved against the wall clock.
    return { item, limit, rank: STATUS_RANK[status] };
  });

  /*
   * The urgency band wins outright; only inside a band does fullness decide. Sorting on
   * usage alone would put a 60% window that is projected to run out *below* a healthy 79%
   * one, which is exactly backwards for the one comparison the outermost arc exists to make.
   * The band has to be the status, not the position in the list: quotaSummaries already
   * broke ties by name, so an index would alphabetise the arcs instead of ranking them.
   */
  const ranked = [...entries].sort((a, b) =>
    a.rank - b.rank || (b.item.used ?? -1) - (a.item.used ?? -1));

  /*
   * Arcs are only worth spending on a number. A subscription with no reading used to take
   * a slot and render a dashed circle with "--" in it, which is not information and on a
   * four-arc ring is a quarter of the picture spent on nothing -- the real database had one
   * such account called `claude-code (company) quota events` with a NULL percentage.
   *
   * If NOTHING is measurable, the unmeasured ones take the ring after all: an empty dial
   * would be worse than a dial that admits it has no numbers yet.
   */
  const measurable = ranked.filter((e) => e.item.used != null);
  const blind = ranked.filter((e) => e.item.used == null);
  const pool = measurable.length > 0 ? measurable : blind;
  const shown = pool.slice(0, max);
  const leader = shown[0];

  return {
    items: shown.map((entry) => entry.item),
    folded: Math.max(0, pool.length - shown.length),
    unmeasured: measurable.length > 0 ? blind.length : 0,
    // Taken from the arc pool, not from every tracked account: the headline has to describe
    // the outermost arc, and a leader that is not on the ring would be a second answer.
    primary: leader?.item ?? null,
    window: leader?.limit ? windowProgress(leader.limit, now) : null,
  };
}
