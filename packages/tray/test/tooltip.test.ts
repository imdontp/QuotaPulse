import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildTooltip, currentLimits, shortWindow, subscriptionLimits, visibleLimits, worst, isUsable, type Limit } from '../src/limits.js';

// Pinned: a wall-clock-dependent test would pass or fail depending on the hour.
const NOW = Date.parse('2026-09-02T12:00:00Z');
const HOUR = 3_600_000;

function limit(p: Partial<Limit> & { display_name: string; window_kind: string }): Limit {
  return {
    source_id: 1,
    used_percent: 50,
    resets_at: NOW + HOUR,
    origin: 'statusline-snapshot',
    ageSeconds: 5,
    burn: null,
    ...p,
  };
}

test('tray hover tooltip contains only app identity and connection state', () => {
  assert.equal(buildTooltip('online'), 'QuotaPulse\nOnline');
  assert.equal(buildTooltip('connecting'), 'QuotaPulse\nConnecting');
  assert.equal(buildTooltip('offline'), 'QuotaPulse\nOffline');
});

test('hidden subscriptions are removed before tray surfaces normalize quota rows', () => {
  const rows = [
    limit({ source_id: 1, subscription_key: 'openai', display_name: 'OpenAI', subscription_display_name: 'OpenAI', window_kind: '5h' }),
    limit({ source_id: 2, subscription_key: 'claude', display_name: 'Claude', subscription_display_name: 'Claude', window_kind: '5h' }),
  ];
  assert.deepEqual(visibleLimits(rows, ['openai']).map((row) => row.subscription_key), ['claude']);
  assert.deepEqual(subscriptionLimits(visibleLimits(rows, ['openai'])).map((row) => row.display_name), ['Claude']);
});

test('the freshest origin wins for a window, and both are not listed twice', () => {
  const rows = [
    limit({ source_id: 1, display_name: 'Claude Code', window_kind: '5h', used_percent: 0, ageSeconds: 56 * 3600, origin: 'claude.json' }),
    limit({ source_id: 1, display_name: 'Claude Code', window_kind: '5h', used_percent: 93, ageSeconds: 2, origin: 'statusline-snapshot' }),
  ];
  const current = currentLimits(rows, NOW);
  assert.equal(current.length, 1);
  assert.equal(current[0]!.used_percent, 93);
  assert.equal(current[0]!.origin, 'statusline-snapshot');
});

test('shared quota readers collapse into one subscription row per window', () => {
  const rows = [
    limit({
      source_id: 1,
      display_name: 'Codex CLI',
      subscription_key: 'openai:subscription',
      subscription_display_name: 'OpenAI Subscription',
      window_kind: '5h',
      used_percent: 18,
      ageSeconds: 60,
    }),
    limit({
      source_id: 2,
      display_name: 'OpenAI Subscription',
      subscription_key: 'openai:subscription',
      subscription_display_name: 'OpenAI Subscription',
      window_kind: '5h',
      used_percent: 18,
      ageSeconds: 15,
    }),
    limit({
      source_id: 1,
      display_name: 'Codex CLI',
      subscription_key: 'openai:subscription',
      subscription_display_name: 'OpenAI Subscription',
      window_kind: 'weekly',
      used_percent: 34,
      ageSeconds: 60,
    }),
    limit({
      source_id: 2,
      display_name: 'OpenAI Subscription',
      subscription_key: 'openai:subscription',
      subscription_display_name: 'OpenAI Subscription',
      window_kind: 'weekly',
      used_percent: 34,
      ageSeconds: 15,
    }),
    limit({
      source_id: 1,
      display_name: 'Codex CLI',
      subscription_key: 'openai:subscription',
      subscription_display_name: 'OpenAI Subscription',
      window_kind: 'monthly',
      used_percent: 81,
      ageSeconds: 60,
    }),
    limit({
      source_id: 2,
      display_name: 'OpenAI Subscription',
      subscription_key: 'openai:subscription',
      subscription_display_name: 'OpenAI Subscription',
      window_kind: 'monthly',
      used_percent: 81,
      ageSeconds: 15,
    }),
  ];

  const current = subscriptionLimits(rows, NOW);
  assert.deepEqual(current.map((row) => row.window_kind), ['5h', 'weekly', 'monthly']);
  assert.deepEqual(current.map((row) => row.display_name), ['OpenAI Subscription', 'OpenAI Subscription', 'OpenAI Subscription']);
  assert.deepEqual(current.map((row) => row.source_id), [2, 2, 2]);
});

test('a live window beats a rolled-over one even when the dead reading is fresher', () => {
  const rows = [
    limit({ source_id: 1, display_name: 'X', window_kind: '5h', used_percent: 99, ageSeconds: 1, resets_at: NOW - 1 }),
    limit({ source_id: 1, display_name: 'X', window_kind: '5h', used_percent: 10, ageSeconds: 900, origin: 'claude.json', resets_at: NOW + HOUR }),
  ];
  const current = currentLimits(rows, NOW);
  assert.equal(current.length, 1);
  assert.equal(current[0]!.used_percent, 10, 'the still-valid window is the useful one');
});

test('the badge tracks the worst LIVE limit, ignoring expired ones', () => {
  const rows = [
    limit({ source_id: 1, display_name: 'A', window_kind: '5h', used_percent: 99, resets_at: NOW - 1 }),
    limit({ source_id: 2, display_name: 'B', window_kind: '5h', used_percent: 61 }),
    limit({ source_id: 3, display_name: 'C', window_kind: 'weekly', used_percent: 12 }),
  ];
  assert.equal(worst(rows, NOW)?.used_percent, 61);
  assert.equal(rows.filter((r) => isUsable(r, NOW)).length, 2);
});

test('a reading older than the window it describes is void, even with no reset time', () => {
  // Claude's cached config fallback publishes a percentage with no reset timestamp.
  // Two days old, it cannot be a statement about a five-hour window.
  const rows = [
    limit({
      source_id: 1,
      display_name: 'Claude Code',
      window_kind: '5h',
      used_percent: 0,
      resets_at: null,
      ageSeconds: 2 * 86400,
      origin: 'claude.json',
    }),
  ];
  assert.equal(isUsable(rows[0]!, NOW), false);
});

test('a weekly reading hours old is still valid for its seven-day window', () => {
  const row = limit({
    display_name: 'Codex CLI',
    window_kind: 'weekly',
    used_percent: 4,
    resets_at: null,
    ageSeconds: 10 * 3600,
  });
  assert.equal(isUsable(row, NOW), true, '10h is well inside a 7-day window');
});

test('a monthly reading has a distinct tray label and month-sized no-reset expiry', () => {
  assert.equal(shortWindow('monthly'), 'mo');
  const row = limit({
    display_name: 'OpenCode Go Subscription',
    window_kind: 'monthly',
    resets_at: null,
    ageSeconds: 30 * 86400,
    used_percent: 64,
  });
  assert.equal(isUsable(row, NOW), true);
  assert.equal(
    isUsable({ ...row, ageSeconds: 32 * 86400 }, NOW),
    false,
    'a no-reset monthly fallback is stale after the safety span',
  );
});

test('OpenCode Go keeps weekly and monthly values attached to the right tray labels', () => {
  const rows = [
    limit({
      display_name: 'OpenCode Go Subscription',
      subscription_key: 'opencode:go',
      subscription_display_name: 'OpenCode Go Subscription',
      window_kind: 'monthly',
      used_percent: 3,
      resets_at: NOW + 30 * 86400_000,
      origin: 'opencode-go-usage',
    }),
    limit({
      display_name: 'OpenCode Go Subscription',
      subscription_key: 'opencode:go',
      subscription_display_name: 'OpenCode Go Subscription',
      window_kind: 'weekly',
      used_percent: 7,
      resets_at: NOW + 2 * 86400_000,
      origin: 'opencode-go-usage',
    }),
    limit({
      display_name: 'OpenCode Go Subscription',
      subscription_key: 'opencode:go',
      subscription_display_name: 'OpenCode Go Subscription',
      window_kind: '5h',
      used_percent: 0,
      resets_at: NOW + 3 * HOUR,
      origin: 'opencode-go-usage',
    }),
  ];

  assert.deepEqual(
    subscriptionLimits(rows, NOW).map((row) => [row.window_kind, row.used_percent]),
    [
      ['5h', 0],
      ['weekly', 7],
      ['monthly', 3],
    ],
  );
});
