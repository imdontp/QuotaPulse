import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildTooltip, currentLimits, worst, isUsable, type Limit } from '../src/limits.js';

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

/**
 * The regression this file exists for: the tooltip once applied a one-hour freshness
 * cutoff, which silently hid every harness except the one with a live session. Codex
 * only republishes quota when Codex is used, so its reading is routinely hours old and
 * still perfectly valid.
 */
test('a reading hours old still appears, with its age shown', () => {
  const tip = buildTooltip(
    [
      limit({ source_id: 1, display_name: 'Claude Code', window_kind: '5h', used_percent: 93, ageSeconds: 2 }),
      limit({ source_id: 2, display_name: 'Claude Code (company)', window_kind: 'weekly', used_percent: 24, ageSeconds: 1.9 * 3600 }),
      limit({ source_id: 3, display_name: 'Codex CLI', window_kind: 'weekly', used_percent: 4, ageSeconds: 9.4 * 3600, origin: 'rollout-token_count' }),
    ],
    true,
    NOW,
  );
  assert.match(tip, /Claude 5h 93%/);
  assert.match(tip, /Claude company wk 24% 2h/, 'the company profile must not be filtered out');
  assert.match(tip, /Codex wk 4% 9h/, 'Codex must not be filtered out for being hours old');
});

test('a rolled-over window shows a dash, not its last percentage', () => {
  const tip = buildTooltip(
    [limit({ display_name: 'Codex CLI', window_kind: '5h', used_percent: 88, resets_at: NOW - HOUR })],
    true,
    NOW,
  );
  assert.match(tip, /Codex 5h --/);
  assert.doesNotMatch(tip, /88/, 'a percentage for an ended window would be misleading');
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

test('the tooltip stays inside the Windows 127-character cap', () => {
  const many: Limit[] = [];
  for (let i = 0; i < 8; i++) {
    many.push(limit({ source_id: i, display_name: `Some Long Harness Name ${i}`, window_kind: '5h', used_percent: 42 }));
    many.push(limit({ source_id: i, display_name: `Some Long Harness Name ${i}`, window_kind: 'weekly', used_percent: 17 }));
  }
  const tip = buildTooltip(many, true, NOW);
  assert.ok(tip.length <= 127, `tooltip was ${tip.length} chars`);
  assert.match(tip, /more$/, 'dropped sources are accounted for rather than silently lost');
});

test('daemon down and no-data states are distinguishable', () => {
  assert.match(buildTooltip([], false, NOW), /daemon not running/);
  assert.match(buildTooltip([], true, NOW), /no quota data yet/);
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
  assert.match(buildTooltip(rows, true, NOW), /Claude 5h --/);
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
  assert.match(buildTooltip([row], true, NOW), /Codex wk 4% 10h/);
});
