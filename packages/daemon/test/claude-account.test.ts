import { test } from 'node:test';
import assert from 'node:assert/strict';

import { parseClaudeOAuthUsageOutput } from '../src/adapters/claude-account.js';
import { extractClaudeAccessToken, normalizeClaudeUsage } from '../../../scripts/claude-oauth-usage.mjs';

const NOW = 1_800_000_000_000;

test('Claude helper selects only the OAuth access token', () => {
  assert.equal(
    extractClaudeAccessToken({
      claudeAiOauth: {
        accessToken: ' claude-access-secret ',
        refreshToken: 'claude-refresh-secret',
      },
    }),
    'claude-access-secret',
  );
  assert.equal(extractClaudeAccessToken({ claudeAiOauth: { refreshToken: 'refresh-only' } }), null);
  assert.equal(extractClaudeAccessToken({}), null);
});

test('Claude helper normalizes provider windows and ignores unrelated fields', () => {
  assert.deepEqual(
    normalizeClaudeUsage({
      five_hour: {
        utilization: 24,
        resets_at: '2026-09-11T21:40:00.021573+00:00',
        accountUuid: 'must-not-pass-through',
      },
      seven_day: {
        utilization: 71,
        resets_at: '2026-09-14T17:00:00.021599+00:00',
      },
      limits: [{ kind: 'session', percent: 24 }],
      extra_usage: { secret: 'must-not-pass-through' },
    }),
    {
      five_hour: { percent: 24, resetsAt: '2026-09-11T21:40:00.021Z' },
      seven_day: { percent: 71, resetsAt: '2026-09-14T17:00:00.021Z' },
    },
  );
});

test('Claude quota parser maps the sanitized helper output to 5h and weekly', () => {
  const result = parseClaudeOAuthUsageOutput(
    [
      'helper diagnostic noise',
      JSON.stringify({
        ok: true,
        fetchedAt: NOW - 2_000,
        usage: {
          five_hour: { percent: 24, resetsAt: '2026-09-11T21:40:00.021Z' },
          seven_day: { percent: 71, resetsAt: NOW + 3 * 86_400_000 },
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
        { windowKind: '5h', usedPercent: 24, resetsAt: Date.parse('2026-09-11T21:40:00.021Z') },
        { windowKind: 'weekly', usedPercent: 71, resetsAt: NOW + 3 * 86_400_000 },
      ],
    },
  });
});

test('Claude quota parser fails closed for incomplete or secret-bearing failures', () => {
  assert.deepEqual(
    parseClaudeOAuthUsageOutput('{"ok":false,"reason":"invalid-credential","accessToken":"secret"}', NOW),
    { available: false, reason: 'invalid-credential' },
  );
  assert.deepEqual(
    parseClaudeOAuthUsageOutput(JSON.stringify({ ok: true, usage: { five_hour: { percent: -1 } } }), NOW),
    { available: false, reason: 'invalid-response' },
  );
});
