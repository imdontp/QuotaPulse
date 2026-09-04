import { test } from 'node:test';
import assert from 'node:assert/strict';

import { primaryLimits, willExhaust } from '../src/format.js';

/**
 * `/api/limits` returns one row per (source, window, ORIGIN). Every surface that shows a
 * window has to collapse those, and for a while only two of five did. These pin the rule
 * itself, in the package where three copies of it used to drift.
 */

const HOUR = 3_600_000;
const now = 1_800_000_000_000;

/** A reading, with the fields the collapse rule actually looks at. */
const reading = (o: {
  origin: string;
  window?: string;
  source?: number;
  ageSeconds?: number | null;
  resets_at?: number | null;
  full?: number | null;
}) => ({
  source_id: o.source ?? 1,
  window_kind: o.window ?? '5h',
  origin: o.origin,
  resets_at: o.resets_at === undefined ? now + 2 * HOUR : o.resets_at,
  ageSeconds: o.ageSeconds ?? 60,
  burn: o.full === undefined ? null : { projectedFullAt: o.full },
});

test('a window reported by two origins collapses to one, freshest first', () => {
  const live = reading({ origin: 'statusline-snapshot', ageSeconds: 60 });
  const cached = reading({ origin: 'claude.json', ageSeconds: 8 * 3600 });

  const out = primaryLimits([cached, live], now);
  assert.equal(out.length, 1, 'two origins, one window');
  assert.equal(out[0]!.primary.origin, 'statusline-snapshot');
  assert.deepEqual(
    out[0]!.superseded.map((s) => s.origin),
    ['claude.json'],
    'the loser is kept, not discarded -- the page still discloses it',
  );
});

test('a reading that still describes the window beats a fresher one that rolled over', () => {
  // The stale-but-valid reading is TWENTY times older, and still wins: a percentage for
  // a window that has already ended is not a statement about the current one.
  const rolledOver = reading({ origin: 'fresh-but-dead', ageSeconds: 10, resets_at: now - 1 });
  const valid = reading({ origin: 'older-but-alive', ageSeconds: 200 });

  const out = primaryLimits([rolledOver, valid], now);
  assert.equal(out[0]!.primary.origin, 'older-but-alive');
});

test('different sources and windows are never merged', () => {
  const rows = [
    reading({ origin: 'a', source: 1, window: '5h' }),
    reading({ origin: 'b', source: 1, window: '5h' }),
    reading({ origin: 'a', source: 1, window: 'weekly' }),
    reading({ origin: 'a', source: 2, window: '5h' }),
    reading({ origin: 'a', source: 2, window: 'weekly' }),
  ];
  const out = primaryLimits(rows, now);
  assert.equal(out.length, 4, 'four distinct (source, window) pairs');
});

/*
 * The bug this was written for. Both origins of one window projected a full-up before
 * reset, so filtering the raw list alerted twice on the same window -- two rows reading
 * the same source and window name, at different percentages. Nothing had triggered it
 * only because the cached origin lacked the samples to compute a burn rate.
 */
test('a window whose every origin is burning still raises exactly one alert', () => {
  const soon = now + HOUR;
  // WEEKLY, matching the real case: a seven-day span makes a two-day-old cached reading
  // still valid, so both origins pass the expiry check and both can carry a burn rate.
  // On a 5h window the stale origin would simply expire and the collision could not
  // arise -- which is why this went unnoticed.
  const both = [
    reading({ origin: 'statusline-snapshot', window: 'weekly', ageSeconds: 60, full: soon }),
    reading({ origin: 'claude.json', window: 'weekly', ageSeconds: 2.3 * 86400, full: soon }),
  ];

  const naive = both.filter((l) => willExhaust(l, now));
  assert.equal(naive.length, 2, 'the old approach really would have listed it twice');

  const alerts = primaryLimits(both, now)
    .map((w) => w.primary)
    .filter((l) => willExhaust(l, now));
  assert.equal(alerts.length, 1);
  assert.equal(alerts[0]!.origin, 'statusline-snapshot');
});

test('willExhaust needs a projection that lands before the reset, on a live window', () => {
  const resets = now + 2 * HOUR;
  assert.equal(willExhaust(reading({ origin: 'a', full: now + HOUR, resets_at: resets }), now), true);
  assert.equal(
    willExhaust(reading({ origin: 'a', full: now + 3 * HOUR, resets_at: resets }), now),
    false,
    'full after the reset is not urgent -- the window clears first',
  );
  assert.equal(willExhaust(reading({ origin: 'a', full: null }), now), false, 'no burn, no alert');
  assert.equal(
    willExhaust(reading({ origin: 'a', full: now + HOUR, resets_at: now - 1 }), now),
    false,
    'an expired window cannot be projected forward',
  );
});
