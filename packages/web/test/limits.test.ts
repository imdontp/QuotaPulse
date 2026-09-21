import { test } from 'node:test';
import assert from 'node:assert/strict';

import { primaryLimits, thresholdLimits, willExhaust } from '../src/format.js';

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
  usedPercent?: number | null;
  ageSeconds?: number | null;
  resets_at?: number | null;
  full?: number | null;
}) => ({
  source_id: o.source ?? 1,
  window_kind: o.window ?? '5h',
  origin: o.origin,
  used_percent: o.usedPercent ?? null,
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

test('readers with the same account key collapse to one account window', () => {
  const rows = [
    { ...reading({ origin: 'codex', source: 1, ageSeconds: 90 }), account_key: 'openai:subscription' },
    { ...reading({ origin: 'openai-codex-usage', source: 2, ageSeconds: 30 }), account_key: 'openai:subscription' },
  ];
  const out = primaryLimits(rows, now);
  assert.equal(out.length, 1);
  assert.equal(out[0]!.primary.origin, 'openai-codex-usage');
  assert.equal(out[0]!.superseded[0]!.origin, 'codex');
});

test('subscription key is the canonical owner when account compatibility fields are absent', () => {
  const rows = [
    { ...reading({ origin: 'codex', source: 1 }), subscription_key: 'openai:subscription' },
    { ...reading({ origin: 'hermes', source: 2 }), subscription_key: 'openai:subscription' },
  ];
  const out = primaryLimits(rows, now);
  assert.equal(out.length, 1);
  assert.equal(out[0]!.superseded.length, 1);
});

test('OpenCode Go monthly readings stay separate from its 5-hour and weekly windows', () => {
  const rows = [
    {
      ...reading({ origin: 'opencode-go', window: 'monthly', usedPercent: 81, resets_at: now + 30 * 86400_000 }),
      subscription_key: 'opencode:go',
    },
    {
      ...reading({ origin: 'opencode-go', window: 'weekly', usedPercent: 38, resets_at: now + 6 * 86400_000 }),
      subscription_key: 'opencode:go',
    },
    {
      ...reading({ origin: 'opencode-go', window: '5h', usedPercent: 12, resets_at: now + 4 * HOUR }),
      subscription_key: 'opencode:go',
    },
  ];
  const out = primaryLimits(rows, now);
  assert.deepEqual(
    out.map((entry) => entry.primary.window_kind),
    ['5h', 'weekly', 'monthly'],
  );
  assert.deepEqual(
    out.map(({ primary }) => [primary.window_kind, primary.used_percent, primary.resets_at]),
    [
      ['5h', 12, now + 4 * HOUR],
      ['weekly', 38, now + 6 * 86400_000],
      ['monthly', 81, now + 30 * 86400_000],
    ],
  );
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

test('threshold alerts collapse reader duplicates and ignore projected burn duplicates', () => {
  const rows = [
    { ...reading({ origin: 'cached', usedPercent: 95, ageSeconds: 600 }), subscription_key: 'openai:subscription' },
    { ...reading({ origin: 'live', usedPercent: 82, ageSeconds: 30 }), subscription_key: 'openai:subscription' },
  ];
  const alerts = thresholdLimits(rows, now);
  assert.equal(alerts.length, 1);
  assert.equal(alerts[0]!.origin, 'live');
});
