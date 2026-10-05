import assert from 'node:assert/strict';
import { test } from 'node:test';
import { activityMinutePoints, activityTokensPerMinute, activityTrendScope, latestActivityByHarness, recentActivityCallScope, recentActivityScope } from '../src/redesign/activity-trend.ts';
import type { MinuteTrendResponse } from '../src/api.ts';
import type { UsageEventRow } from '../src/lib/usage-events.ts';

const row = { source_id: 9, harness: 'codex', model: 'model/a', provider: 'openrouter', grain: 'call' } as UsageEventRow;
test('activity queries preserve scope and isolate actual source/model/provider, with at most thirty minutes', () => {
  const scope = activityTrendScope({ from: 0, to: 9_000_001 }, row, 9_000_000)!;
  assert.equal(scope.to - scope.from, 30 * 60_000);
  assert.equal(scope.sourceId, undefined, 'harness route rate includes matching profiles by default');
  assert.equal(scope.model, 'model/a');
  assert.equal(scope.provider, 'openrouter');
  assert.equal(scope.grain, 'call');
  assert.deepEqual(activityTrendScope({ from: 600_000, to: 660_000, project: 'actual' }, row, 9_000_000), {
    from: 600_000, to: 660_000, project: 'actual', harness: 'codex', model: 'model/a', provider: 'openrouter', grain: 'call',
  });
  assert.equal(activityTrendScope({ from: 10_000_000, to: 11_000_000 }, row, 9_000_000), null);
  assert.equal(activityTrendScope({ from: 0, to: 100 }, { ...row, model: null }, 100), null);
  assert.equal(activityTrendScope({ from: 0, to: 100 }, { ...row, provider: null }, 100), null);
  assert.equal(activityTrendScope({ from: 0, to: 100 }, { ...row, grain: 'session_aggregate' }, 100), null);
  assert.equal(activityTrendScope(null, row, 100), null);
  assert.equal(activityTrendScope({ from: 0, to: 100, sourceId: 2 }, row, 100)?.sourceId, 2, 'an explicitly selected source remains scoped');
});

test('minute points retain observed values, zero gaps and partial boundary minutes without interpolation', () => {
  const trend = { from: 60_001, to: 240_001, rows: [
    { bucket_ts: 60_000, total_tokens: 1 }, { bucket_ts: 180_000, total_tokens: 100 },
    { bucket_ts: 240_000, total_tokens: 0 }, { bucket_ts: 300_000, total_tokens: 999 },
  ] } as MinuteTrendResponse;
  assert.deepEqual(activityMinutePoints(trend), [
    { at: 60_000, value: 1 }, { at: 120_000, value: 0 }, { at: 180_000, value: 100 }, { at: 240_000, value: 0 },
  ]);
  assert.deepEqual(activityMinutePoints({ ...trend, from: 0, to: 31 * 60_000 }), []);
  assert.deepEqual(activityMinutePoints({ ...trend, to: trend.from }), []);
});

test('recent activity is limited to the trailing range and newest call per distinct harness', () => {
  const scope = recentActivityScope({ from: 0, to: 9_000_001, sourceId: 3, project: 'actual' }, 9_000_000);
  assert.deepEqual(scope, { from: 7_200_001, to: 9_000_001, sourceId: 3, project: 'actual' });
  assert.deepEqual(recentActivityCallScope({ from: 0, to: 9_000_001, grain: 'session_aggregate' }, 9_000_000), { from: 7_200_001, to: 9_000_001, grain: 'call' });
  assert.equal(recentActivityScope({ from: 9_000_002, to: 9_000_003 }, 9_000_000), null, 'future-only ranges have no activity interval');
  assert.equal(recentActivityCallScope({ from: 9_000_002, to: 9_000_003 }, 9_000_000), null);
  const rows = [
    { event_id: 4, timestamp_ms: 400, harness: 'codex' },
    { event_id: 3, timestamp_ms: 300, harness: 'hermes' },
    { event_id: 2, timestamp_ms: 200, harness: 'CODEX' },
    { event_id: 1, timestamp_ms: 100, harness: 'claude-code' },
  ] as UsageEventRow[];
  assert.deepEqual(latestActivityByHarness(rows, 3).map(item => item.event_id), [3, 4, 1]);
  const busyHarness = Array.from({ length: 150 }, (_, index) => ({ ...rows[0], event_id: 1000 + index, timestamp_ms: 1000 + index })) as UsageEventRow[];
  assert.deepEqual(latestActivityByHarness([...busyHarness, rows[1]], 4).map(item => item.harness), ['hermes', 'codex']);
});

test('activity rate uses only recorded call tokens inside the exact minute interval', () => {
  const trend = { bucket: 'minute', from: 1_000, to: 121_000, groupBy: 'none', measurement: 'recorded_tokens_per_minute', rows: [
    { bucket_ts: 0, total_tokens: 120 }, { bucket_ts: 60_000, total_tokens: 180 },
    { bucket_ts: 180_000, total_tokens: 90 }, { bucket_ts: 60_000, total_tokens: -1 },
  ], coverage: { includedRecords: 3, includedCalls: 3, excludedRecords: 0, excludedCalls: 0, excludedSources: [] } } as MinuteTrendResponse;
  assert.equal(activityTokensPerMinute(trend), 150);
  assert.equal(activityTokensPerMinute({ ...trend, coverage: { ...trend.coverage, includedRecords: 0 } }), null);
  assert.equal(activityTokensPerMinute({ ...trend, to: trend.from + 31 * 60_000 }), null);
});
