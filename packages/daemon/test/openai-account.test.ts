import { test } from 'node:test';
import assert from 'node:assert/strict';

import { parseAccountQuotaOutput } from '../src/adapters/openai-account.js';

const NOW = 1_800_000_000_000;

test('OpenAI provider usage output maps primary and secondary windows', () => {
  const snapshot = parseAccountQuotaOutput(
    JSON.stringify({
      available: true,
      fetchedAt: NOW - 2_000,
      windows: [
        { windowKind: '5h', usedPercent: 12.5, resetAt: 1_800_018_000 },
        { windowKind: 'weekly', usedPercent: 4, resetAt: '2026-09-15T12:00:00Z' },
      ],
    }),
    NOW,
  );

  assert.deepEqual(snapshot, {
    fetchedAt: NOW - 2_000,
    readings: [
      { windowKind: '5h', usedPercent: 12.5, resetsAt: 1_800_018_000_000 },
      { windowKind: 'weekly', usedPercent: 4, resetsAt: Date.parse('2026-09-15T12:00:00Z') },
    ],
  });
});

test('OpenAI account parser rejects unavailable data and unknown windows', () => {
  assert.equal(parseAccountQuotaOutput('{"available":false}', NOW), null);

  const snapshot = parseAccountQuotaOutput(
    JSON.stringify({
      available: true,
      windows: [
        { windowKind: '5h', usedPercent: 150 },
        { windowKind: 'weekly', usedPercent: -5, resetAt: null },
        { windowKind: 'monthly', usedPercent: 20 },
      ],
    }),
    NOW,
  );

  assert.deepEqual(snapshot, {
    fetchedAt: NOW,
    readings: [
      { windowKind: '5h', usedPercent: 100, resetsAt: null },
      { windowKind: 'weekly', usedPercent: 0, resetsAt: null },
    ],
  });
});

test('OpenAI account parser ignores helper noise and malformed readings', () => {
  const snapshot = parseAccountQuotaOutput(
    [
      'Hermes plugin log line',
      JSON.stringify({
        available: true,
        windows: [{ windowKind: '5h', usedPercent: '12' }, null, { windowKind: 'weekly' }],
      }),
    ].join('\n'),
    NOW,
  );

  assert.equal(snapshot, null);
});
