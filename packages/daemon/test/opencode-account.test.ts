import { test } from 'node:test';
import assert from 'node:assert/strict';

import { parseOpenCodeGoUsageOutput } from '../src/adapters/opencode-account.js';
import { extractOpenCodeGoApiKey } from '../../../scripts/opencode-go-usage.mjs';

const NOW = 1_800_000_000_000;

test('OpenCode Go helper selects the opencode-go credential', () => {
  assert.equal(
    extractOpenCodeGoApiKey({
      'opencode-go': { type: 'api', key: ' go-secret ' },
      opencode: { type: 'api', key: 'zen-secret' },
    }),
    'go-secret',
  );
  assert.equal(
    extractOpenCodeGoApiKey({ opencode: { type: 'api', key: 'legacy-secret' } }),
    'legacy-secret',
  );
  assert.equal(extractOpenCodeGoApiKey({}), null);
});

test('OpenCode Go helper output maps rolling, weekly, and monthly windows', () => {
  const result = parseOpenCodeGoUsageOutput(
    [
      'helper diagnostic noise',
      JSON.stringify({
        ok: true,
        fetchedAt: NOW - 2_000,
        usage: {
          rolling: { status: 'ok', percent: 12.9, resetsAt: NOW + 4 * 3_600_000 + 2 * 60_000 },
          weekly: { status: 'ok', percent: 38.4, resetsAt: '2026-09-15T12:00:00Z' },
          monthly: { status: 'ok', percent: 81, resetsAt: NOW + 20 * 86_400_000 },
        },
      }),
    ].join('\n'),
    NOW,
  );

  assert.deepEqual(result, {
    available: true,
    snapshot: {
      fetchedAt: NOW - 2_000,
      readings: [
        { windowKind: '5h', usedPercent: 12.9, resetsAt: NOW + 4 * 3_600_000 + 2 * 60_000 },
        { windowKind: 'weekly', usedPercent: 38.4, resetsAt: Date.parse('2026-09-15T12:00:00Z') },
        { windowKind: 'monthly', usedPercent: 81, resetsAt: NOW + 20 * 86_400_000 },
      ],
    },
  });
});

test('OpenCode Go parser preserves provider percentages, including over-limit values', () => {
  const result = parseOpenCodeGoUsageOutput(
    JSON.stringify({
      ok: true,
      usage: {
        rolling: { percent: 104.5, resetsAt: NOW + 1_000 },
        weekly: { percent: 0, resetsAt: NOW + 2_000 },
        monthly: { percent: 64, resetsAt: null },
      },
    }),
    NOW,
  );

  assert.equal(result.available, true);
  if (result.available) {
    assert.equal(result.snapshot.readings[0]!.usedPercent, 104.5);
    assert.equal(result.snapshot.readings[2]!.resetsAt, null);
  }
});

test('OpenCode Go parser keeps credential and entitlement failures sanitized', () => {
  assert.deepEqual(
    parseOpenCodeGoUsageOutput('{"ok":false,"reason":"no-subscription","key":"secret"}', NOW),
    { available: false, reason: 'no-subscription' },
  );
  assert.deepEqual(
    parseOpenCodeGoUsageOutput('{"ok":false,"reason":"invalid-credential"}', NOW),
    { available: false, reason: 'invalid-credential' },
  );
  assert.deepEqual(
    parseOpenCodeGoUsageOutput('{"ok":false,"reason":"provider-secret"}', NOW),
    { available: false, reason: 'unavailable' },
  );
});

test('OpenCode Go parser rejects incomplete or malformed quota snapshots', () => {
  assert.deepEqual(
    parseOpenCodeGoUsageOutput(
      JSON.stringify({
        ok: true,
        usage: {
          rolling: { percent: 10 },
          weekly: { percent: 20 },
        },
      }),
      NOW,
    ),
    { available: false, reason: 'invalid-response' },
  );
  assert.deepEqual(
    parseOpenCodeGoUsageOutput(
      JSON.stringify({
        ok: true,
        usage: {
          rolling: { percent: -1 },
          weekly: { percent: 20 },
          monthly: { percent: 30 },
        },
      }),
      NOW,
    ),
    { available: false, reason: 'invalid-response' },
  );
});
