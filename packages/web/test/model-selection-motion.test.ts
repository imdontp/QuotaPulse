import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cancelModelSelectionMotion, initialModelSelectionMotion, observeModelSelectionMotion, type ModelSelectionMotionState, type ModelSelectionObservation } from '../src/redesign/model-selection-motion.ts';
const A = JSON.stringify(['model', null]), B = JSON.stringify(['model', '']), C = JSON.stringify(['model', 'recorded-provider']);
const observation = (overrides: Partial<ModelSelectionObservation> = {}): ModelSelectionObservation => ({
  contextKey: 'scope-page0', selectedKey: A, detailKey: 'detail-A', acceptedDetailKey: 'detail-A', intent: null,
  enabled: true, failed: false, rowVisible: true, detailVisible: true, ...overrides });
const baseline = () => observeModelSelectionMotion(initialModelSelectionMotion(), observation()).state;
const choose = (state: ModelSelectionMotionState, serial = 1, key = B, overrides: Partial<ModelSelectionObservation> = {}) => observeModelSelectionMotion(state,
  observation({ selectedKey: key, detailKey: `detail-${key}`, acceptedDetailKey: null,
    intent: { serial, key, contextKey: 'scope-page0' }, ...overrides }));

test('initial/deep-linked selected detail is a static baseline, including exact null/empty provider pairs', () => {
  for (const key of [A, B, C]) {
    const result = observeModelSelectionMotion(initialModelSelectionMotion(), observation({ selectedKey: key }));
    assert.equal(result.row, false); assert.equal(result.detail, false); assert.equal(result.state.pending, null);
  }
  assert.notEqual(A, B); assert.notEqual(B, C);
});

test('changed explicit row responds once, but actual selected detail waits for its exact accepted key', () => {
  const chosen = choose(baseline());
  assert.equal(chosen.row, true); assert.equal(chosen.detail, false);
  assert.equal(chosen.state.pending?.key, B);
  const pending = observation({ selectedKey: B, detailKey: `detail-${B}`, acceptedDetailKey: null,
    intent: { serial: 1, key: B, contextKey: 'scope-page0' } });
  const duplicatePending = observeModelSelectionMotion(chosen.state, pending);
  assert.equal(duplicatePending.row, false); assert.equal(duplicatePending.detail, false); assert.equal(duplicatePending.cancel, false);
  const accepted = observeModelSelectionMotion(duplicatePending.state, { ...pending, acceptedDetailKey: `detail-${B}` });
  assert.equal(accepted.row, false); assert.equal(accepted.detail, true); assert.equal(accepted.cancel, false);
  const duplicateAccepted = observeModelSelectionMotion(accepted.state, { ...pending, acceptedDetailKey: `detail-${B}` });
  assert.equal(duplicateAccepted.row, false); assert.equal(duplicateAccepted.detail, false); assert.equal(duplicateAccepted.cancel, false);
});

test('foreign/late A detail cannot animate pending B; rapid next choice retires the prior pending selection', () => {
  const chosenB = choose(baseline());
  const foreign = choose(chosenB.state, 1, B, { acceptedDetailKey: 'detail-A' });
  assert.equal(foreign.detail, false);
  assert.equal(foreign.state.pending?.key, B);
  const chosenC = choose(foreign.state, 2, C);
  assert.equal(chosenC.row, true); assert.equal(chosenC.state.pending?.key, C);
  const lateB = choose(chosenC.state, 2, C, { acceptedDetailKey: `detail-${B}` });
  assert.equal(lateB.detail, false);
  const acceptedC = choose(lateB.state, 2, C, { acceptedDetailKey: `detail-${C}` });
  assert.equal(acceptedC.detail, true);
});

test('same selected row/no-op intent and automatic fallback never masquerade as a user selection', () => {
  const unchanged = choose(baseline(), 1, A, { detailKey: 'detail-A', acceptedDetailKey: 'detail-A' });
  assert.equal(unchanged.row, false); assert.equal(unchanged.detail, false);
  const fallback = observeModelSelectionMotion(unchanged.state, observation({ selectedKey: B, detailKey: 'detail-B', acceptedDetailKey: 'detail-B' }));
  assert.equal(fallback.row, false); assert.equal(fallback.detail, false); assert.equal(fallback.state.pending, null);
});

test('search/sort/filter/page context replacement seeds and consumes any old intent', () => {
  const chosen = choose(baseline());
  for (const contextKey of ['scope-search', 'scope-sort', 'scope-filter', 'scope-page1']) {
    const next = choose(chosen.state, 1, B, { contextKey, acceptedDetailKey: `detail-${B}` });
    assert.equal(next.row, false); assert.equal(next.detail, false); assert.equal(next.cancel, true);
    assert.equal(next.state.pending, null);
  }
});

test('a new accepted request scope retires the old pending detail without replaying user intent', () => {
  const chosen = choose(baseline());
  const changed = choose(chosen.state, 1, B, { detailKey: 'new-scope-B', acceptedDetailKey: null });
  assert.equal(changed.state.pending, null); assert.equal(changed.row, false); assert.equal(changed.detail, false);
  const accepted = choose(changed.state, 1, B, { detailKey: 'new-scope-B', acceptedDetailKey: 'new-scope-B' });
  assert.equal(accepted.detail, false);
});

test('error/reduced/hidden cancellation consumes delayed detail and retry/restoration cannot resurrect it', () => {
  for (const overrides of [{ failed: true }, { enabled: false }, { detailVisible: false }]) {
    const chosen = choose(baseline());
    const lost = choose(chosen.state, 1, B, overrides);
    assert.equal(lost.state.pending, null); assert.equal(lost.row, false); assert.equal(lost.detail, false);
    const restored = choose(lost.state, 1, B, { acceptedDetailKey: `detail-${B}` });
    assert.equal(restored.row, false); assert.equal(restored.detail, false);
    const nextUser = choose(restored.state, 2, C);
    assert.equal(nextUser.row, true);
  }
});

test('native eligibility loss also consumes a newly committed but not yet observed intent serial', () => {
  const cancelled = cancelModelSelectionMotion(baseline(), 1);
  const delayed = choose(cancelled, 1, B, { acceptedDetailKey: `detail-${B}` });
  assert.equal(delayed.row, false); assert.equal(delayed.detail, false); assert.equal(delayed.state.pending, null);
  assert.equal(cancelModelSelectionMotion(delayed.state, 0).consumedSerial, 1);
});

test('offscreen detail is never queued; visible row can respond while final detail remains factual/static', () => {
  const chosen = choose(baseline(), 1, B, { detailVisible: false });
  assert.equal(chosen.row, true); assert.equal(chosen.detail, false); assert.equal(chosen.state.pending, null);
  const restored = choose(chosen.state, 1, B, { acceptedDetailKey: `detail-${B}` });
  assert.equal(restored.detail, false);
});


test('opaque Models targets request the existing finite runner outline mode with no geometry-changing frames', async () => {
  const { playHistoryTransitions } = await import('../src/redesign/history-motion.ts');
  const originalStyle = Object.getOwnPropertyDescriptor(globalThis, 'getComputedStyle');
  const calls: Array<{ frames: Keyframe[]; options: KeyframeAnimationOptions; cancelled: number }> = [];
  const target = { animate(frames: Keyframe[], options: KeyframeAnimationOptions) {
    const call = { frames, options, cancelled: 0 }; calls.push(call);
    return { addEventListener() {}, removeEventListener() {}, cancel() { call.cancelled++; } };
  } } as unknown as HTMLElement;
  Object.assign(globalThis, { getComputedStyle: () => ({ backgroundColor: 'rgb(0,0,0)' }) });
  try {
    const cancel = playHistoryTransitions([target], false, 'outline');
    assert.deepEqual(calls.map(call => call.options.duration), [180, 700]);
    const emphasis = calls[1]!;
    assert.ok(emphasis.frames[0]!.outlineColor);
    assert.equal(emphasis.frames[0]!.outlineOffset, '-2px');
    assert.equal(emphasis.frames[0]!.outlineWidth, '2px');
    assert.equal(emphasis.frames[1]!.outlineColor, 'transparent');
    assert.ok(emphasis.frames.every(frame => frame.width === undefined && frame.height === undefined && frame.transform === undefined && frame.backgroundColor === undefined));
    assert.equal(emphasis.options.fill, 'none');
    assert.equal(emphasis.options.iterations, 1);
    cancel(); cancel();
    assert.ok(calls.every(call => call.cancelled === 1));
  } finally {
    if (originalStyle) Object.defineProperty(globalThis, 'getComputedStyle', originalStyle);
    else Reflect.deleteProperty(globalThis, 'getComputedStyle');
  }
});
