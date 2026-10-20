import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DURATION, EASE } from '../src/lib/motion';
import { AlertsEntranceLedger, AlertsEntranceAnimations, alertRiskMotionKey, alertHistoryMotionKey, type AlertsEntranceBatch } from '../src/redesign/alerts-entrance';

const risk = (key: string, level: 'critical' | 'warning' | 'info' | 'stale' = 'warning', reason: 'forecast' | 'threshold' | 'stale' = 'threshold') => alertRiskMotionKey({ key, level, reason });
function fixture() {
  const ledger = new AlertsEntranceLedger(); ledger.setEligible(true);
  let serial = 0;
  const batch = (reason: AlertsEntranceBatch['reason'] = 'sse'): AlertsEntranceBatch => ({ serial: ++serial, reason, requestEligibility: ledger.snapshot() });
  return { ledger, batch };
}

test('initial real risks/history are static; one new accepted derivation enters exactly once', () => {
  const { ledger, batch } = fixture();
  const old = risk(JSON.stringify(['owner', '5h']));
  const added = risk(JSON.stringify(['owner', 'weekly']), 'critical', 'forecast');
  assert.deepEqual(ledger.accept(batch('initial'), [old, alertHistoryMotionKey(1)]), []);
  const accepted = batch();
  assert.deepEqual(ledger.accept(accepted, [added, old, alertHistoryMotionKey(2), alertHistoryMotionKey(1)]), [added, alertHistoryMotionKey(2)]);
  assert.deepEqual(ledger.accept(accepted, [added, old, alertHistoryMotionKey(2)]), []);
  assert.deepEqual(ledger.accept(batch(), [added, old, alertHistoryMotionKey(2), alertHistoryMotionKey(1)]), []);
});

test('exact risk context, level and reason are identities; retained reading/clock metadata is not', () => {
  const keys = [risk(JSON.stringify(['', '5h'])), risk(JSON.stringify([null, '5h'])), risk(JSON.stringify(['A', '5h'])), risk(JSON.stringify(['a', '5h'])), risk(JSON.stringify(['A', 'weekly']))];
  assert.equal(new Set(keys).size, keys.length);
  assert.notEqual(risk('A', 'warning'), risk('A', 'critical'));
  assert.notEqual(risk('A', 'critical', 'threshold'), risk('A', 'critical', 'forecast'));
  assert.notEqual(risk('1'), alertHistoryMotionKey(1));
  const { ledger, batch } = fixture();
  ledger.accept(batch('initial'), [risk('A')]);
  assert.deepEqual(ledger.accept(batch(), [risk('A')]), []);
  assert.deepEqual(ledger.accept(batch(), [risk('A', 'critical')]), [risk('A', 'critical')]);
  assert.deepEqual(ledger.accept(batch(), []), []);
  assert.deepEqual(ledger.accept(batch(), [risk('A', 'critical')]), [risk('A', 'critical')], 'resolved then rederived risk is new');
});

test('full-data baseline prevents filter reveals and reordering from replaying rows', () => {
  const { ledger, batch } = fixture(); const a = risk('A'), b = risk('B');
  ledger.accept(batch('initial'), [a, b]);
  const accepted = batch();
  assert.deepEqual(ledger.accept(accepted, [a, b]), []);
  // Local filter/sort changes only DOM visibility, not full-data identities or serial.
  assert.deepEqual(ledger.accept(accepted, [b, a]), []);
  assert.deepEqual(ledger.accept(batch(), [b, a, a]), []);
  const filteredOutNew = risk('filtered-out');
  assert.deepEqual(ledger.accept(batch(), [a, b, filteredOutNew]), [filteredOutNew]);
  assert.deepEqual(ledger.accept(batch(), [a, b, filteredOutNew]), [], 'absent DOM candidate was consumed, not queued');
});

test('dependency/show-more and visibility/online catch-up seed history without replay', () => {
  for (const reason of ['initial', 'dependency', 'visible', 'online'] as const) {
    const { ledger, batch } = fixture();
    ledger.accept(batch('initial'), [alertHistoryMotionKey(10)]);
    assert.deepEqual(ledger.accept(batch(reason), [alertHistoryMotionKey(1), alertHistoryMotionKey(10), alertHistoryMotionKey(11)]), []);
    assert.deepEqual(ledger.accept(batch(), [alertHistoryMotionKey(1), alertHistoryMotionKey(10), alertHistoryMotionKey(11), alertHistoryMotionKey(12)]), [alertHistoryMotionKey(12)]);
  }
});

test('hidden/offscreen/reduced batches are consumed; return has no deferred backlog', () => {
  const { ledger, batch } = fixture();
  ledger.accept(batch('initial'), [risk('old')]);
  ledger.setEligible(false);
  assert.deepEqual(ledger.accept(batch(), [risk('old'), risk('hidden')]), []);
  ledger.setEligible(true);
  assert.deepEqual(ledger.accept(batch(), [risk('old'), risk('hidden')]), []);
  assert.deepEqual(ledger.accept(batch(), [risk('old'), risk('hidden'), risk('fresh')]), [risk('fresh')]);
});

test('held request across eligibility loss cannot animate after return; later fresh request can', () => {
  const { ledger, batch } = fixture();
  ledger.accept(batch('initial'), [risk('old')]);
  const held = batch();
  ledger.setEligible(false); ledger.setEligible(true);
  assert.deepEqual(ledger.accept(held, [risk('old'), risk('held')]), []);
  assert.deepEqual(ledger.accept(batch(), [risk('old'), risk('held'), risk('fresh')]), [risk('fresh')]);
  const wrong = batch(); wrong.requestEligibility.eligible = false;
  assert.deepEqual(ledger.accept(wrong, [risk('old'), risk('held'), risk('fresh'), risk('ineligible')]), []);
});

test('stale accepted serial cannot replace baseline; duplicate event delivery updates do not enter', () => {
  const { ledger, batch } = fixture();
  const first = batch('initial'); ledger.accept(first, [alertHistoryMotionKey(1)]);
  assert.deepEqual(ledger.accept(batch(), [alertHistoryMotionKey(1), alertHistoryMotionKey(2)]), [alertHistoryMotionKey(2)]);
  assert.deepEqual(ledger.accept(first, []), []);
  assert.deepEqual(ledger.accept(batch(), [alertHistoryMotionKey(2), alertHistoryMotionKey(1)]), []);
  const snapshot = ledger.snapshot(); snapshot.eligible = false;
  assert.equal(ledger.snapshot().eligible, true, 'request provenance is an immutable copy');
});

function animatedNode() {
  const effects: Array<{ frames: Keyframe[]; options: KeyframeAnimationOptions; cancelled: number; finish: () => void }> = [];
  const node = {
    dataset: {} as Record<string, string>, isConnected: true,
    animate(frames: Keyframe[], options: KeyframeAnimationOptions) {
      let resolve!: () => void;
      const finished = new Promise<void>(done => { resolve = done; });
      const effect = { frames, options, cancelled: 0, finish: resolve }; effects.push(effect);
      return { finished, cancel: () => { effect.cancelled++; resolve(); } } as unknown as Animation;
    },
  } as unknown as HTMLElement;
  return { node, effects };
}

test('native entrance uses shared180ms and entrance easing once, restoring readable base style', async () => {
  const { node, effects } = animatedNode(); const animations = new AlertsEntranceAnimations();
  animations.play(node);
  assert.equal(node.dataset.alertMotion, 'entering'); assert.equal(animations.size(), 1);
  assert.deepEqual(effects[0].frames, [{ opacity: 0, transform: 'translateY(5px)' }, { opacity: 1, transform: 'translateY(0)' }]);
  assert.deepEqual(effects[0].options, { duration: DURATION.fast, easing: `cubic-bezier(${EASE.entrance.join(',')})`, iterations: 1, fill: 'none' });
  assert.equal(effects[0].options.duration, 180);
  effects[0].finish(); await Promise.resolve();
  assert.equal(animations.size(), 0); assert.equal(node.dataset.alertMotion, undefined);
});

test('native effects cancel on offscreen/removal/unmount and never leave queued work or markers', async () => {
  const first = animatedNode(), second = animatedNode(); const animations = new AlertsEntranceAnimations();
  animations.play(first.node); animations.play(second.node);
  animations.prune(node => node !== first.node);
  assert.equal(first.effects[0].cancelled, 1); assert.equal(first.node.dataset.alertMotion, undefined);
  assert.equal(animations.size(), 1);
  Object.defineProperty(second.node, 'isConnected', { value: false });
  animations.prune(() => true);
  assert.equal(animations.size(), 0); assert.equal(second.node.dataset.alertMotion, undefined);
  const third = animatedNode(); animations.play(third.node); animations.cancelAll();
  await Promise.resolve();
  assert.equal(animations.size(), 0); assert.equal(third.node.dataset.alertMotion, undefined);
});

test('old completion cannot cancel a replacement entrance on the same actual row', async () => {
  const { node, effects } = animatedNode(); const animations = new AlertsEntranceAnimations();
  animations.play(node); animations.play(node);
  await Promise.resolve();
  assert.equal(effects.length, 2); assert.equal(effects[1].cancelled, 0);
  assert.equal(node.dataset.alertMotion, 'entering'); assert.equal(animations.size(), 1);
  animations.cancelAll(); await Promise.resolve();
  assert.equal(animations.size(), 0);
});
