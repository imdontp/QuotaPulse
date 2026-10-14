import assert from 'node:assert/strict';
import { test } from 'node:test';
import { recentRuntimeExpiry } from '../src/redesign/runtime-activity';

test('Pulse recency requires an actual known observation, never totals or unknown grain', () => {
  assert.equal(recentRuntimeExpiry([], 1000, 300), null);
  assert.equal(recentRuntimeExpiry([{ timestamp_ms: 990, grain: 'unknown' }], 1000, 300), null);
  assert.equal(recentRuntimeExpiry([{ timestamp_ms: 990, grain: 'call' }], 1000, 300), 1290);
  assert.equal(recentRuntimeExpiry([{ timestamp_ms: 990, grain: 'session_aggregate' }], 1000, 300), 1290);
});
test('idle boundary, future timestamps and invalid inputs stop the orbit signal', () => {
  assert.equal(recentRuntimeExpiry([{ timestamp_ms: 700, grain: 'call' }], 1000, 300), null);
  assert.equal(recentRuntimeExpiry([{ timestamp_ms: 1001, grain: 'call' }], 1000, 300), null);
  assert.equal(recentRuntimeExpiry([{ timestamp_ms: NaN, grain: 'call' }], 1000, 300), null);
  assert.equal(recentRuntimeExpiry([{ timestamp_ms: 990, grain: 'call' }], 1000, 0), null);
});
test('only the latest eligible real observation sets the bounded expiry', () => {
  assert.equal(recentRuntimeExpiry([{ timestamp_ms: 701, grain: 'call' }, { timestamp_ms: 900, grain: 'session_aggregate' }, { timestamp_ms: 999, grain: 'unknown' }], 1000, 300), 1200);
});
