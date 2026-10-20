import assert from 'node:assert/strict';
import { test } from 'node:test';
import { providerSelectionMotionKey as key } from '../src/redesign/provider-selection-motion';
import { initialModelSelectionMotion, observeModelSelectionMotion, type ModelSelectionObservation } from '../src/redesign/model-selection-motion';
const observation = (owner: string | undefined, open: boolean, overrides: Partial<ModelSelectionObservation> = {}): ModelSelectionObservation => ({
  contextKey: 'monthly', selectedKey: key(owner, open), detailKey: open ? key(owner, open) : null, acceptedDetailKey: open ? key(owner, open) : null,
  intent: null, enabled: true, failed: false, rowVisible: true, detailVisible: open, ...overrides,
});
test('provider identity preserves exact owner and native inspector state', () => {
  assert.notEqual(key('', false), key(undefined, false));
  assert.notEqual(key('owner', true), key('Owner', true));
  assert.notEqual(key('source:1', true), key('source:2', true));
  assert.notEqual(key('owner', false), key('owner', true));
});
test('default owner opens on explicit card action, while initial/deep-linked open is static', () => {
  const before = observeModelSelectionMotion(initialModelSelectionMotion(), observation('owner', false)).state;
  const intent = { serial: 1, key: key('owner', true)!, contextKey: 'monthly' };
  const result = observeModelSelectionMotion(before, observation('owner', true, { intent }));
  assert.equal(result.row, true); assert.equal(result.detail, true); assert.equal(result.state.pending, null);
  const duplicate = observeModelSelectionMotion(result.state, observation('owner', true, { intent }));
  assert.equal(duplicate.row, false); assert.equal(duplicate.detail, false); assert.equal(duplicate.cancel, false);
  const deep = observeModelSelectionMotion(initialModelSelectionMotion(), observation('owner', true));
  assert.equal(deep.row, false); assert.equal(deep.detail, false);
});
test('comparison selection changes actual owner, native close/reopen alone never replays selection', () => {
  const before = observeModelSelectionMotion(initialModelSelectionMotion(), observation('source:1', true)).state;
  const intent = { serial: 1, key: key('source:2', true)!, contextKey: 'monthly' };
  const chosen = observeModelSelectionMotion(before, observation('source:2', true, { intent }));
  assert.equal(chosen.row, true); assert.equal(chosen.detail, true);
  const closed = observeModelSelectionMotion(chosen.state, observation('source:2', false, { intent }));
  assert.equal(closed.row, false); assert.equal(closed.detail, false); assert.equal(closed.cancel, true);
  const reopened = observeModelSelectionMotion(closed.state, observation('source:2', true, { intent }));
  assert.equal(reopened.row, false); assert.equal(reopened.detail, false);
});
test('filtered window, reduced/error loss and offscreen detail do not queue owner emphasis', () => {
  for (const overrides of [{ contextKey: 'weekly' }, { enabled: false }, { detailVisible: false }]) {
    const before = observeModelSelectionMotion(initialModelSelectionMotion(), observation('one', true)).state;
    const intent = { serial: 1, key: key('two', true)!, contextKey: 'monthly' };
    const result = observeModelSelectionMotion(before, observation('two', true, { intent, ...overrides }));
    assert.equal(result.detail, false); assert.equal(result.state.pending, null);
    const restored = observeModelSelectionMotion(result.state, observation('two', true, { intent }));
    assert.equal(restored.detail, false);
  }
});
