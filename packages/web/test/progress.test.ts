import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BADGE_IDS,
  XP_RULES,
  cacheSharePct,
  currentStreak,
  dayKey,
  evaluateProgress,
  firstActivityHour,
  levelFor,
  orderedBadges,
  type ProgressInput,
  type ProgressTotals,
} from '../src/lib/progress';
import { BADGE_META, badgeShelf } from '../src/lib/badges';

// Local noon, so no assertion depends on the test machine's timezone offset.
const at = (year: number, month: number, day: number, hour = 12) =>
  new Date(year, month - 1, day, hour, 0, 0, 0).getTime();
const NOW = at(2026, 3, 15);
const d = (day: number, hour = 12) => dayKey(at(2026, 3, day, hour));

/** `count` consecutive calendar days ending on 2026-03-15, oldest first. */
const lastNDays = (count: number) => Array.from({ length: count }, (_, i) => {
  const dt = new Date(2026, 2, 15);
  dt.setDate(dt.getDate() - (count - 1 - i));
  return dayKey(dt.getTime());
});

const totals = (patch: Partial<ProgressTotals> = {}): ProgressTotals => ({
  calls: 0,
  cached_input_tokens: 0,
  input_tokens: 0,
  cache_write_tokens: 0,
  ...patch,
});

const input = (patch: Partial<ProgressInput> = {}): ProgressInput => ({
  now: NOW,
  today: totals(),
  quotaHealthy: false,
  days: [],
  unlocked: [],
  firstActivityHour: null,
  ...patch,
});

test('levels ramp quadratically instead of hitting a wall', () => {
  assert.deepEqual(levelFor(0), { level: 1, into: 0, span: 50 });
  assert.deepEqual(levelFor(49), { level: 1, into: 49, span: 50 });
  assert.deepEqual(levelFor(50), { level: 2, into: 0, span: 100 });
  assert.deepEqual(levelFor(149), { level: 2, into: 99, span: 100 });
  assert.deepEqual(levelFor(150), { level: 3, into: 0, span: 150 });
  assert.deepEqual(levelFor(299), { level: 3, into: 149, span: 150 });
  assert.deepEqual(levelFor(300), { level: 4, into: 0, span: 200 });
});

test('a tampered XP value cannot spin or overflow the scale', () => {
  const huge = levelFor(1e12);
  assert.equal(huge.level, 99);
  assert.equal(huge.span, 4950);
  assert.equal(evaluateProgress(input()).level, 1);
  assert.deepEqual(levelFor(-500), { level: 1, into: 0, span: 50 });
});

test('spending more quota must not raise the score', () => {
  // Identical efficiency and headroom, wildly different volume: 120 extra calls are
  // worth nothing, because the per-call award is already capped.
  const atCap = evaluateProgress(input({ today: totals({ calls: XP_RULES.perCallCap }) }));
  const wayOver = evaluateProgress(input({ today: totals({ calls: 20000 }) }));
  assert.equal(atCap.xp, wayOver.xp);
  assert.equal(wayOver.xp, XP_RULES.firstActivity + XP_RULES.perCallCap);
  // Nothing in the award table reads spend at all: uncached input earns no bonus.
  const rich = evaluateProgress(input({ today: totals({ calls: 1, cached_input_tokens: 0, input_tokens: 1 }) }));
  assert.equal(rich.xp, XP_RULES.firstActivity + XP_RULES.perCall);
  assert.equal(rich.cacheShare, 0);
});

test('cache share counts writes against the denominator, not for it', () => {
  assert.equal(cacheSharePct(totals()), 0);
  assert.equal(cacheSharePct(totals({ cached_input_tokens: 800, input_tokens: 200 })), 80);
  // Writing a cache is a cost, so it dilutes the share rather than inflating it.
  assert.equal(cacheSharePct(totals({ cached_input_tokens: 500, input_tokens: 100, cache_write_tokens: 400 })), 50);
  assert.equal(cacheSharePct(totals({ cached_input_tokens: 100, input_tokens: -50 })), 100);
});

test('cache badges stack at their thresholds', () => {
  const half = evaluateProgress(input({ today: totals({ calls: 10, cached_input_tokens: 100, input_tokens: 100 }) }));
  const high = evaluateProgress(input({ today: totals({ calls: 10, cached_input_tokens: 800, input_tokens: 200 }) }));
  assert.equal(half.xp, XP_RULES.firstActivity + 10 + XP_RULES.cacheHalfShare);
  assert.equal(high.xp, half.xp + XP_RULES.cacheHighShare);
  assert.deepEqual(half.fresh, ['first-pulse', 'cache-50']);
  assert.deepEqual(high.fresh, ['first-pulse', 'cache-50', 'cache-80']);
});

test('a streak survives midnight: an inactive today anchors on yesterday', () => {
  assert.equal(currentStreak([], NOW), 0);
  assert.equal(currentStreak([d(14)], NOW), 1);
  assert.equal(currentStreak([d(13), d(14)], NOW), 2);
  // A real gap still breaks it.
  assert.equal(currentStreak([d(10), d(14)], NOW), 1);
  assert.equal(currentStreak([d(15)], NOW), 1);
  assert.equal(currentStreak(['not-a-date', ''], NOW), 0);
});

test('streak counting walks real calendar days, not 24-hour spans', () => {
  // A month boundary and a leap day are exactly where fixed 86_400_000 ms steps drift.
  assert.notEqual(dayKey(at(2026, 1, 31, 12)), dayKey(at(2026, 2, 1, 12)));
  const leap = [at(2028, 2, 28, 12), at(2028, 2, 29, 12), at(2028, 3, 1, 12)].map(dayKey);
  assert.equal(new Set(leap).size, 3);
  assert.equal(currentStreak(leap, at(2028, 3, 1, 12)), 3);
  const month = [at(2026, 1, 30, 12), at(2026, 1, 31, 12), at(2026, 2, 1, 12)].map(dayKey);
  assert.equal(currentStreak(month, at(2026, 2, 1, 12)), 3);
});

test('streak XP is capped so a long run cannot run away with the scale', () => {
  const a = evaluateProgress(input({ today: totals({ calls: 1 }), days: lastNDays(3) }));
  const b = evaluateProgress(input({ today: totals({ calls: 1 }), days: lastNDays(40) }));
  assert.equal(a.streak, 3);
  assert.equal(b.streak, 40);
  assert.equal(a.xp, XP_RULES.firstActivity + XP_RULES.perCall + 3 * XP_RULES.streakStep);
  assert.equal(b.xp, XP_RULES.firstActivity + XP_RULES.perCall + XP_RULES.streakCap * XP_RULES.streakStep);
});

test('badges are granted once and always render in catalogue order', () => {
  const first = evaluateProgress(input({
    today: totals({ calls: 10, cached_input_tokens: 800, input_tokens: 200 }),
    quotaHealthy: true,
    days: [d(13), d(14), d(15)],
  }));
  assert.deepEqual(first.fresh, ['first-pulse', 'streak-3', 'cache-50', 'cache-80', 'thrifty', 'guardian']);
  // Re-evaluating the same day must not re-grant, so the shelf cannot farm itself.
  const again = evaluateProgress(input({
    today: totals({ calls: 10, cached_input_tokens: 800, input_tokens: 200 }),
    quotaHealthy: true,
    days: [d(13), d(14), d(15)],
    unlocked: first.unlocked,
  }));
  assert.deepEqual(again.fresh, []);
  assert.deepEqual(again.unlocked, first.unlocked);
  // Grant order must not become render order.
  assert.deepEqual(orderedBadges(['cache-80', 'first-pulse', 'nonsense']), ['first-pulse', 'cache-80']);
  assert.equal(orderedBadges([]).length, 0);
});

test('restraint badges need both efficiency and headroom', () => {
  const cached = totals({ calls: 10, cached_input_tokens: 800, input_tokens: 200 });
  const thrifty = evaluateProgress(input({ today: cached, quotaHealthy: true, days: [d(13), d(14), d(15)] }));
  const reckless = evaluateProgress(input({ today: cached, quotaHealthy: false, days: [d(13), d(14), d(15)] }));
  assert.ok(thrifty.unlocked.includes('thrifty'));
  assert.ok(thrifty.unlocked.includes('guardian'));
  assert.ok(!reckless.unlocked.includes('thrifty'));
  assert.ok(!reckless.unlocked.includes('guardian'));
  // Caching alone is not restraint if the quota is nearly gone.
  assert.ok(evaluateProgress(input({ today: cached, quotaHealthy: false, days: [d(15)] })).unlocked.includes('cache-80'));
});

test('time-of-day badges need a reported hour', () => {
  assert.ok(evaluateProgress(input({ today: totals({ calls: 1 }), firstActivityHour: 6 })).unlocked.includes('early-bird'));
  assert.ok(evaluateProgress(input({ today: totals({ calls: 1 }), firstActivityHour: 23 })).unlocked.includes('night-owl'));
  const unknown = evaluateProgress(input({ today: totals({ calls: 1 }), firstActivityHour: null }));
  assert.ok(!unknown.unlocked.includes('early-bird'));
  assert.ok(!unknown.unlocked.includes('night-owl'));
  // 07:00 is the first hour that is not early; 22:00 is the first that is night.
  assert.ok(!evaluateProgress(input({ today: totals({ calls: 1 }), firstActivityHour: 7 })).unlocked.includes('early-bird'));
  assert.ok(!evaluateProgress(input({ today: totals({ calls: 1 }), firstActivityHour: 21 })).unlocked.includes('night-owl'));
});

test('missing, negative and non-finite counters contribute nothing', () => {
  const junk = evaluateProgress(input({
    today: { calls: NaN, cached_input_tokens: undefined as never, input_tokens: -50, cache_write_tokens: NaN },
    days: ['not-a-date', ''],
  }));
  assert.equal(junk.xp, 0);
  assert.equal(junk.streak, 0);
  assert.deepEqual(junk.fresh, []);
  // A negative aggregate contributes nothing and cannot cancel the cache award.
  const negative = evaluateProgress(input({ today: totals({ calls: -1000, cached_input_tokens: 500, input_tokens: 500 }) }));
  assert.equal(negative.cacheShare, 50);
  assert.equal(negative.activeToday, false);
  assert.equal(negative.xp, XP_RULES.cacheHalfShare);
});

test('an idle day scores nothing and breaks nothing that was already earned', () => {
  const idle = evaluateProgress(input({ days: [d(14)], unlocked: ['first-pulse', 'streak-3'] }));
  assert.equal(idle.xp, XP_RULES.streakStep);
  assert.equal(idle.activeToday, false);
  assert.deepEqual(idle.unlocked, ['first-pulse', 'streak-3']);
  assert.deepEqual(idle.fresh, []);
});

test('the first active hour of the day drives the time-of-day badges', () => {
  const series = (values: number[]) => values;
  assert.equal(firstActivityHour(series([0, 0, 0, 0, 0, 0, 40_000, 12_000])), 6);
  assert.equal(firstActivityHour(series(Array.from({ length: 24 }, () => 0))), null);
  assert.equal(firstActivityHour(series([])), null);
  // An hour that spans midnight still reports a valid hour of the day.
  assert.equal(firstActivityHour(Array.from({ length: 30 }, (_, i) => (i === 27 ? 5 : 0))), 3);
  // A non-finite bucket is not activity, so it must not stop the search.
  assert.equal(firstActivityHour([0, Number.NaN, 0, Number.POSITIVE_INFINITY]), null);
  assert.equal(firstActivityHour([0, Number.NaN, 9, 0]), 2);
});

test('every badge id is reachable from the predicates', () => {
  /*
   * Reached per badge rather than in one state, because early-bird and night-owl are
   * mutually exclusive by construction: a single day's first-activity hour cannot be both
   * before 07:00 and after 22:00. The invariant worth guarding is that no entry in the
   * roster is dead, not that one lucky state holds all eleven.
   */
  const busy = {
    today: totals({ calls: XP_RULES.perCallCap, cached_input_tokens: 10_000, input_tokens: 1 }),
    quotaHealthy: true,
    days: lastNDays(40),
  };
  const reachable = new Set(
    [input({ ...busy, firstActivityHour: 5 }), input({ ...busy, firstActivityHour: 23 })]
      .flatMap((state) => evaluateProgress(state).unlocked),
  );
  assert.deepEqual([...BADGE_IDS].filter((id) => !reachable.has(id)), []);
});

test('the shelf lists every badge, locked ones included, in catalogue order', () => {
  const shelf = badgeShelf(['cache-80', 'first-pulse']);
  assert.deepEqual(shelf.map((b) => b.id), [...BADGE_IDS]);
  assert.deepEqual(shelf.filter((b) => b.earned).map((b) => b.id), ['first-pulse', 'cache-80']);
  // Every id has a name and an explanation, so no tile can render blank.
  for (const id of BADGE_IDS) {
    assert.ok(BADGE_META[id].name.startsWith('badge.'), `${id} needs a name`);
    assert.ok(BADGE_META[id].hint.endsWith('Hint'), `${id} needs an explanation`);
  }
});
