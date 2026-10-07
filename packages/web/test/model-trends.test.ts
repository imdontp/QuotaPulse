import assert from 'node:assert/strict';
import { test } from 'node:test';
import { modelProviderTrends, modelTrendBuckets } from '../src/redesign/model-trends.ts';

const scope = { from: 1000, to: 4000 };
const point = (start: number, changes: Partial<{ tokens: number; calls: number; sessions: number; pairs: number; api_value_usd: number; api_priced_calls: number }> = {}) => ({ start, tokens: 0, calls: 0, sessions: 0, pairs: 0, api_value_usd: 0, api_priced_calls: 0, ...changes });

test('summary histories retain scope boundaries, zero count bins, and per-bin distinct sessions', () => {
  const buckets = modelTrendBuckets({ scope, trends: { bucketMs: 1000, providers: [], points: [point(1000, { tokens: 7, sessions: 2, pairs: 3 }), point(3000, { tokens: 9, sessions: 2, pairs: 3 })] } });
  assert.deepEqual(buckets.map(bin => [bin.start, bin.tokens, bin.sessions, bin.pairs]), [[1000, 7, 2, 3], [2000, 0, 0, 0], [3000, 9, 2, 3]]);
  assert.deepEqual(modelTrendBuckets({ scope }), []);
});

test('price samples distinguish known zero, unpriced calls, and partial known value', () => {
  const buckets = modelTrendBuckets({ scope, trends: { bucketMs: 1000, providers: [], points: [point(1000, { calls: 1, api_priced_calls: 1 }), point(2000, { calls: 2 }), point(3000, { calls: 4, api_priced_calls: 2, api_value_usd: .44 })] } });
  assert.deepEqual(buckets.map(bin => bin.apiValue), [0, null, .44]);
  assert.equal(buckets[2].api_priced_calls, 2);
  assert.equal(buckets[2].calls, 4);
});

test('provider history keeps null and empty identities separate and uses only displayed scoped groups', () => {
  const data = { scope, groups: [{ provider: null, tokens: 5 }, { provider: '', tokens: 7 }, { provider: 'route', tokens: 9 }, { provider: 'route', tokens: 10 }], trends: { bucketMs: 1000, points: [], providers: [{ provider: null, start: 1000, tokens: 2 }, { provider: null, start: 3000, tokens: 3 }, { provider: '', start: 2000, tokens: 7 }, { provider: 'route', start: 3000, tokens: 19 }] } };
  const rows = modelProviderTrends(data);
  assert.equal(rows.length, 3);
  assert.deepEqual(rows.find(row => row.provider === null)?.points.map(point => point.value), [2, 0, 3]);
  assert.deepEqual(rows.find(row => row.provider === '')?.points.map(point => point.value), [0, 7, 0]);
  assert.equal(rows.find(row => row.provider === 'route')?.pairs, 2);
  assert.deepEqual(modelProviderTrends({ ...data, groups: [data.groups[0]] }).map(row => row.provider), [null]);
});
