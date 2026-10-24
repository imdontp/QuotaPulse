import assert from 'node:assert/strict';
import test from 'node:test';
import { modelTokenDistribution } from '../src/redesign/model-token-distribution.js';

test('input includes all three recorded components and shares use their own total', () => {
  const value = modelTokenDistribution({ inputTokens: 40, cachedInputTokens: 30, cacheWriteTokens: 20, outputTokens: 10, tokens: 100 });
  assert.equal(value.input, 90); assert.equal(value.total, 100); assert.equal(value.reconciles, true);
  assert.deepEqual(value.parts.map(part => [part.share, part.sweep, part.paintedSweep]), [[90, 324, 322], [10, 36, 34]]);
});
test('a differing stored total never invents input, output or an unknown remainder sector', () => {
  const value = modelTokenDistribution({ inputTokens: 11, cachedInputTokens: 13, cacheWriteTokens: 17, outputTokens: 19, tokens: 777 });
  assert.equal(value.input, 41); assert.equal(value.output, 19); assert.equal(value.total, 60);
  assert.equal(value.recordedTotal, 777); assert.equal(value.reconciles, false); assert.equal(value.parts.length, 2);
});
test('known zero stays neutral while missing components of a positive total stay unavailable', () => {
  const zero = { inputTokens: 0, cachedInputTokens: 0, cacheWriteTokens: 0, outputTokens: 0, tokens: 0 };
  const value = modelTokenDistribution(zero); assert.equal(value.available, true); assert.equal(value.reconciles, true);
  assert.deepEqual(value.parts.map(part => [part.share, part.paintedSweep]), [[null, 0], [null, 0]]);
  assert.equal(modelTokenDistribution({ ...zero, tokens: 50 }).available, false);
  for (const inputTokens of [-1, NaN, Infinity]) assert.equal(modelTokenDistribution({ ...zero, inputTokens }).valid, false);
  assert.equal(modelTokenDistribution({ ...zero, inputTokens: Number.MAX_VALUE, cachedInputTokens: Number.MAX_VALUE }).valid, false);
});
test('tiny real components keep a proportional arc without a minimum painted floor', () => {
  const value = modelTokenDistribution({ inputTokens: 1, cachedInputTokens: 0, cacheWriteTokens: 0, outputTokens: 99_999_999, tokens: 100_000_000 });
  assert.ok(Math.abs(value.parts[0].sweep - .0000036) < 1e-18);
  assert.ok(value.parts[0].paintedSweep > 0 && value.parts[0].paintedSweep < .0000036);
  assert.ok(value.gap < .000001);
});
test('single-sided data draws one complete ring and no zero-valued sector', () => {
  for (const [inputTokens, outputTokens] of [[100, 0], [0, 100]]) {
    const value = modelTokenDistribution({ inputTokens, outputTokens, cachedInputTokens: 0, cacheWriteTokens: 0, tokens: 100 });
    assert.equal(value.gap, 0); assert.equal(value.parts.filter(part => part.paintedSweep > 0).length, 1);
    assert.equal(value.parts.find(part => part.value === 100)!.paintedSweep, 360);
  }
});
test('floating arithmetic noise is tolerated but one real token difference is retained', () => {
  assert.equal(modelTokenDistribution({ inputTokens: .1, cachedInputTokens: .2, cacheWriteTokens: 0, outputTokens: 0, tokens: .3 }).reconciles, true);
  assert.equal(modelTokenDistribution({ inputTokens: 274_000_000, cachedInputTokens: 0, cacheWriteTokens: 0, outputTokens: 0, tokens: 274_000_001 }).reconciles, false);
});
