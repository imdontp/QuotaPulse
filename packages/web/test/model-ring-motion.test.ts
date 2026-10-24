import assert from 'node:assert/strict';
import test from 'node:test';
import { initialModelRingMotion, observeModelRingMotion, ringFrame } from '../src/redesign/model-ring-motion.js';
import { modelTokenDistribution } from '../src/redesign/model-token-distribution.js';

const distribution = (input: number, output: number, tokens = input + output) => modelTokenDistribution({ inputTokens: input, cachedInputTokens: 0, cacheWriteTokens: 0, outputTokens: output, tokens });
const observation = (pairKey = 'a', value = distribution(70, 30)) => ({ contextKey: 'scope', pairKey, value, intent: null as null | {serial:number;key:string;contextKey:string}, eligible: true });
const baseline = () => observeModelRingMotion(initialModelRingMotion(), observation()).state;
const selected = () => ({ ...observation('b', distribution(40, 60)), intent: { serial: 1, key: 'b', contextKey: 'scope' } });

test('only explicit in-scope selection interpolates; mount, refresh and fallback are static', () => {
  assert.equal(observeModelRingMotion(initialModelRingMotion(), observation()).animate, false);
  assert.equal(observeModelRingMotion(baseline(), observation('a', distribution(40,60))).animate, false);
  assert.equal(observeModelRingMotion(baseline(), observation('b', distribution(40,60))).animate, false);
  const value = observeModelRingMotion(baseline(), selected());assert.equal(value.animate, true);
  assert.equal(observeModelRingMotion(value.state, selected()).animate, false);
});
test('disabled or mismatched scope/identity consumes selection and cannot replay', () => {
  for (const next of [{...selected(),eligible:false},{...selected(),contextKey:'other'},{...selected(),intent:{serial:1,key:'wrong',contextKey:'scope'}}]) {
    const decision=observeModelRingMotion(baseline(),next);assert.equal(decision.animate,false);
    assert.equal(observeModelRingMotion(decision.state,selected()).animate,false);
  }
});
test('zero, unavailable and invalid components settle immediately', () => {
  for (const value of [distribution(0,0),distribution(0,0,50),distribution(-1,4)]) {
    assert.equal(observeModelRingMotion(baseline(),{...selected(),value}).animate,false);
    const prior=observeModelRingMotion(initialModelRingMotion(),observation('a',value)).state;
    assert.equal(observeModelRingMotion(prior,selected()).animate,false);
  }
});
test('equal ratios do not animate even when totals and the explicit identity change', () => {
  assert.equal(observeModelRingMotion(baseline(),{...selected(),value:distribution(140,60)}).animate,false);
});
test('single-component targets have a true zero arc and partial totals never invent a remainder', () => {
  const value=distribution(0,50,777);
  assert.deepEqual(ringFrame(value,'input'),{strokeDasharray:'0 360',strokeDashoffset:'0'});
  assert.deepEqual(ringFrame(value,'output'),{strokeDasharray:'360 0',strokeDashoffset:'0'});
  assert.equal(observeModelRingMotion(baseline(),{...selected(),value}).animate,true);
});
