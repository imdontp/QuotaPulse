import type { Limit, Overview } from '../api';
import { isExpired, severityOf, thresholdLimits, willExhaust } from '../format';
import { quotaSummaries, type Readiness } from './quota-summary';
import { RING_MAX, windowProgress, type RingWindow } from './quota-ring';

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

/** The reading a card or arc should quote: the one that runs out, else the highest, else any. */
export function primaryReading(limits: Limit[], now: number): Limit | undefined {
  return limits.find((l) => willExhaust(l, now)) ?? thresholdLimits(limits, now)[0] ?? limits[0];
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
  /** Tracked subscriptions with nowhere to go on the ring. */
  overflow: number;
  primary: PulseItem | null;
  /** Time position of the primary window, for the outer track. */
  window: RingWindow | null;
}

const EMPTY: PulseModel = { items: [], overflow: 0, primary: null, window: null };

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
    // The burn figure is only quoted once there are real samples behind it; below that a
    // projection is arithmetic on noise, and a confident wrong ETA is worse than none.
    const burnRate = limit?.burn && limit.burn.samples >= 3 && limit.burn.percentPerHour > 0
      ? limit.burn.percentPerHour
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
      burnRate,
      projectedFullAt: burnRate != null ? (limit?.burn?.projectedFullAt ?? null) : null,
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
  const leader = ranked[0];
  return {
    items: ranked.slice(0, max).map((entry) => entry.item),
    overflow: Math.max(0, ranked.length - max),
    primary: leader?.item ?? null,
    window: leader?.limit ? windowProgress(leader.limit, now) : null,
  };
}
