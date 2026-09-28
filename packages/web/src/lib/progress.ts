/**
 * Progression for the Live page. Everything here is a pure function of data the daemon
 * already sends, plus a short list of the days the user has been active.
 *
 * That restriction is not a shortcut. `scripts/check-ui.mjs` asserts that every request
 * the dashboard makes is a GET, except PUT on the two settings endpoints, so progression
 * may not be server state. It is a local convenience layer, which is also why it must
 * never be load-bearing for anything the user cannot reconstruct.
 *
 * THE ONE RULE THAT SHAPES EVERY NUMBER BELOW: this app must not pay you for spending
 * more quota. A quota monitor that rewards burn trains the exact behaviour it exists to
 * prevent, and the user would be right to distrust the score. So nothing in this file
 * reads `total_tokens` or `cost_usd` at all. Call volume is capped and worth almost
 * nothing; the multipliers are cache efficiency and remaining quota headroom, and the
 * streak rewards showing up rather than showing up big.
 */

/** The subset of `Totals` progression reads. Structural, so `Overview['today']` fits. */
export interface ProgressTotals {
  calls: number;
  cached_input_tokens: number;
  input_tokens: number;
  cache_write_tokens: number;
}

export const XP_RULES = {
  /** Any activity at all today. */
  firstActivity: 20,
  /**
   * Per API call, heavily capped. 200 calls today must not out-earn 80, otherwise the
   * only winning strategy is to spam requests, which is the thing the score is meant to
   * discourage.
   */
  perCall: 1,
  perCallCap: 80,
  /** Share of input served from cache at 50% and again at 80%. These stack. */
  cacheHalfShare: 30,
  cacheHighShare: 30,
  /** No tracked window is near its ceiling. */
  quotaHealthy: 25,
  /** Per consecutive active day, capped so a long streak cannot run away with the scale. */
  streakStep: 15,
  streakCap: 10,
} as const;

export const BADGE_IDS = [
  'first-pulse',
  'streak-3',
  'streak-7',
  'streak-30',
  'cache-50',
  'cache-80',
  'early-bird',
  'night-owl',
  'steady',
  'thrifty',
  'guardian',
] as const;

export type BadgeId = (typeof BADGE_IDS)[number];

/**
 * Stable render order, independent of when each badge was earned. The shelf shows all of
 * them, locked ones included, so the order is a design choice rather than a history.
 */
export function orderedBadges(ids: Iterable<string>): BadgeId[] {
  const seen = new Set<string>(ids);
  return BADGE_IDS.filter((id) => seen.has(id));
}

export function isBadgeId(value: unknown): value is BadgeId {
  return typeof value === 'string' && (BADGE_IDS as readonly string[]).includes(value);
}

/** SQL aggregates can arrive as null or NaN through a bad row; never let that into XP. */
function num(value: number | null | undefined): number {
  return Number.isFinite(value) ? (value as number) : 0;
}

/**
 * Cache share as a percentage of all input tokens. This mirrors the figure the old stat
 * card showed, so the badge thresholds mean what the user already saw on that card.
 * Cache writes count against the denominator: writing a cache is a cost, not a saving.
 */
export function cacheSharePct(totals: ProgressTotals): number {
  const cached = num(totals.cached_input_tokens);
  const total = cached + num(totals.input_tokens) + num(totals.cache_write_tokens);
  if (total <= 0) return 0;
  return Math.min(100, Math.max(0, (cached / total) * 100));
}

function startOfDay(ts: number): Date {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Calendar-day arithmetic, so a DST transition cannot skip or repeat a day key. */
function shiftDay(day: Date, delta: number): Date {
  const next = new Date(day);
  next.setDate(next.getDate() + delta);
  return next;
}

/** Local calendar day as `YYYY-MM-DD`. Local, because the streak a person feels is theirs. */
export function dayKey(ts: number): string {
  const d = new Date(ts);
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const date = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${month}-${date}`;
}

/**
 * Consecutive active days counting back from today.
 *
 * Anchors on yesterday when today has no activity yet. Without that, opening the app at
 * 09:00 would show a broken streak for a user who worked all of yesterday -- the streak
 * would die every midnight and come back on the first call. It only breaks on a real gap.
 */
export function currentStreak(days: readonly string[], now: number): number {
  if (days.length === 0) return 0;
  const active = new Set(days);
  let cursor = startOfDay(now);
  if (!active.has(dayKey(cursor.getTime()))) {
    cursor = shiftDay(cursor, -1);
    if (!active.has(dayKey(cursor.getTime()))) return 0;
  }
  let streak = 0;
  while (active.has(dayKey(cursor.getTime()))) {
    streak += 1;
    cursor = shiftDay(cursor, -1);
  }
  return streak;
}

/**
 * Hour-of-day 0-23 of the day's first recorded activity, or null for a quiet day.
 *
 * Takes the dense hourly series produced by `statSeries(..., 'hour', 'total_tokens')`,
 * which starts at local midnight, so the index is the hour. Uses token volume rather than
 * calls because a cached call can record no fresh input at all.
 */
export function firstActivityHour(hourly: readonly number[]): number | null {
  for (let i = 0; i < hourly.length; i += 1) {
    if (num(hourly[i]) > 0) return i % 24;
  }
  return null;
}

/** XP required to clear the given level, so spans grow linearly: 50, 100, 150, 200... */function levelSpan(level: number): number {
  return 50 * level;
}

/** Cumulative XP at which the given level begins: 0, 50, 150, 300, 500... */
function levelStart(level: number): number {
  return 25 * level * (level - 1);
}

/** Quadratic ramp rather than a flat target: later levels stay interesting without a wall. */
export function levelFor(xp: number): { level: number; into: number; span: number } {
  const total = Math.max(0, num(xp));
  // Bounded so a tampered localStorage value cannot spin here.
  let level = 1;
  while (level < 99 && total >= levelStart(level + 1)) level += 1;
  const start = levelStart(level);
  return { level, into: total - start, span: levelSpan(level) };
}

export interface ProgressInput {
  now: number;
  today: ProgressTotals;
  /** Nothing tracked is at or above the attention threshold. */
  quotaHealthy: boolean;
  /** Every day the user has been active, in any order. */
  days: readonly string[];
  /** Badges already granted and persisted. */
  unlocked: readonly string[];
  /** Local hour 0-23 of the day's first activity, or null when unknown. */
  firstActivityHour?: number | null;
}

export interface Progress {
  xp: number;
  level: number;
  /** XP earned inside the current level, and the span it has to fill. */
  into: number;
  span: number;
  /** Absolute XP at which the next level begins. */
  nextAt: number;
  levelPct: number;
  streak: number;
  activeToday: boolean;
  cacheShare: number;
  unlocked: BadgeId[];
  /** Granted by this evaluation and not already persisted. */
  fresh: BadgeId[];
}

function earnedBadges(state: {
  activeToday: boolean;
  share: number;
  streak: number;
  quotaHealthy: boolean;
  firstActivityHour: number | null;
}): BadgeId[] {
  const { activeToday, share, streak, quotaHealthy, firstActivityHour } = state;
  const earned: BadgeId[] = [];
  const grant = (id: BadgeId, condition: boolean) => {
    if (condition) earned.push(id);
  };
  grant('first-pulse', activeToday);
  grant('streak-3', streak >= 3);
  grant('streak-7', streak >= 7);
  grant('streak-30', streak >= 30);
  grant('cache-50', share >= 50);
  grant('cache-80', share >= 80);
  grant('early-bird', firstActivityHour != null && firstActivityHour < 7);
  grant('night-owl', firstActivityHour != null && firstActivityHour >= 22);
  grant('steady', streak >= 7);
  // Cached heavily AND nowhere near the ceiling: efficiency with restraint, the two
  // things this app is actually for.
  grant('thrifty', share >= 80 && quotaHealthy);
  grant('guardian', quotaHealthy && streak >= 3);
  return earned;
}

export function evaluateProgress(input: ProgressInput): Progress {
  const { now, today, quotaHealthy, days, unlocked } = input;
  const activeToday = num(today.calls) > 0;
  const share = cacheSharePct(today);
  const streak = currentStreak(days, now);

  let xp = 0;
  if (activeToday) xp += XP_RULES.firstActivity;
  // Clamped at both ends: a negative aggregate from a bad row must subtract nothing.
  xp += Math.min(XP_RULES.perCallCap, Math.max(0, Math.floor(num(today.calls)))) * XP_RULES.perCall;
  if (share >= 50) xp += XP_RULES.cacheHalfShare;
  if (share >= 80) xp += XP_RULES.cacheHighShare;
  if (quotaHealthy) xp += XP_RULES.quotaHealthy;
  xp += Math.min(streak, XP_RULES.streakCap) * XP_RULES.streakStep;

  const { level, into, span } = levelFor(xp);

  const seen = new Set(unlocked.filter(isBadgeId));
  const fresh = earnedBadges({
    activeToday,
    share,
    streak,
    quotaHealthy,
    firstActivityHour: input.firstActivityHour ?? null,
  }).filter((id) => !seen.has(id));
  for (const id of fresh) seen.add(id);

  return {
    xp,
    level,
    into,
    span,
    nextAt: levelStart(level + 1),
    levelPct: Math.min(100, span > 0 ? (into / span) * 100 : 0),
    streak,
    activeToday,
    cacheShare: share,
    unlocked: orderedBadges(seen),
    fresh,
  };
}
