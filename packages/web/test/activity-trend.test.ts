import assert from 'node:assert/strict';
import { test } from 'node:test';
import { activityMinutePoints, activityTrendScope } from '../src/redesign/activity-trend.ts';
import type { MinuteTrendResponse } from '../src/api.ts';
import type { UsageEventRow } from '../src/lib/usage-events.ts';

const row = { source_id: 9, harness: 'codex', model: 'model/a', provider: 'openrouter' } as UsageEventRow;
test('activity queries preserve scope and isolate actual source/model/provider, with at most thirty minutes', () => {
  const scope = activityTrendScope({ from: 0, to: 9_000_001 }, row, 9_000_000)!;
  assert.equal(scope.to - scope.from, 30 * 60_000);
  assert.equal(scope.sourceId, 9);
  assert.equal(scope.model, 'model/a');
  assert.equal(scope.provider, 'openrouter');
  assert.equal(scope.grain, 'call');
  assert.deepEqual(activityTrendScope({ from: 600_000, to: 660_000, project: 'actual' }, row, 9_000_000), {
    from: 600_000, to: 660_000, project: 'actual', sourceId: 9, harness: 'codex', model: 'model/a', provider: 'openrouter', grain: 'call',
  });
  assert.equal(activityTrendScope({ from: 10_000_000, to: 11_000_000 }, row, 9_000_000), null);
  assert.equal(activityTrendScope({ from: 0, to: 100 }, { ...row, model: null }, 100), null);
  assert.equal(activityTrendScope({ from: 0, to: 100 }, { ...row, provider: null }, 100), null);
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
