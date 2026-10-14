import assert from 'node:assert/strict';
import test from 'node:test';
import { selectModelGroup } from '../src/redesign/model-selection.js';

const groups = [
  { model: 'Largest unrelated model', provider: 'provider-a', tokens: 100 },
  { model: 'Requested model', provider: 'provider-b', tokens: 80 },
  { model: 'Requested model', provider: 'provider-a', tokens: 40 },
  { model: null, provider: null, tokens: 20 },
  { model: '', provider: '', tokens: 10 },
];

test('model-only Overview drill-down selects the requested model rather than the largest unrelated row', () => {
  assert.equal(selectModelGroup(groups, 'Requested model', undefined), groups[1]);
});

test('an explicit provider keeps the exact recorded pair, including null and empty identities', () => {
  assert.equal(selectModelGroup(groups, 'Requested model', 'provider-a'), groups[2]);
  assert.equal(selectModelGroup(groups, null, null), groups[3]);
  assert.equal(selectModelGroup(groups, '', ''), groups[4]);
  assert.equal(selectModelGroup(groups, null, undefined), groups[3]);
  assert.equal(selectModelGroup(groups, '', undefined), groups[4]);
});

test('default, absent and empty-list selections retain existing fallback behavior without mutating order', () => {
  const before = groups.slice();
  assert.equal(selectModelGroup(groups, undefined, undefined), groups[0]);
  assert.equal(selectModelGroup(groups, 'not recorded', undefined), groups[0]);
  assert.equal(selectModelGroup([], 'Requested model', undefined), undefined);
  assert.deepEqual(groups, before);
});
