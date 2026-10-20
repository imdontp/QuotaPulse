import assert from 'node:assert/strict';
import { test } from 'node:test';
import { LivePresenceLedger, liveSessionMotionKey, liveRecordMotionKey, changedLiveSelection, type LiveRecordBatch } from '../src/redesign/live-record-motion';

const fixture = () => {
  const ledger = new LivePresenceLedger(); ledger.setEligible(true); let serial = 0;
  const batch = (reason: LiveRecordBatch['reason'] = 'sse'): LiveRecordBatch => ({ serial: ++serial, reason, requestEligibility: ledger.snapshot() });
  return { ledger, batch };
};

test('Live presence uses exact internal session identity and observed recorded tuple', () => {
  assert.notEqual(liveSessionMotionKey(1), liveSessionMotionKey(2));
  const row = { event_id: 1, source_id: 2, session_key: null, timestamp_ms: 3 };
  assert.equal(liveRecordMotionKey(row), '[1,2,null,3]');
  for (const change of [{ event_id: 2 }, { source_id: 3 }, { session_key: 0 }, { timestamp_ms: 4 }]) assert.notEqual(liveRecordMotionKey(row), liveRecordMotionKey({ ...row, ...change }));
  assert.notEqual(liveSessionMotionKey(1), liveRecordMotionKey(row));
});

test('initial accepted page seeds; new observed presence enters once; duplicate/reorder has no replay', () => {
  const { ledger, batch } = fixture();
  assert.deepEqual(ledger.accept(batch('initial'), 'context', ['A']), []);
  const fresh = batch(); assert.deepEqual(ledger.accept(fresh, 'context', ['B', 'A', 'B']), ['B']);
  assert.deepEqual(ledger.accept(fresh, 'context', ['B', 'A']), []);
  assert.deepEqual(ledger.accept(batch(), 'context', ['A', 'B']), []);
});

test('cold initial request before IO establishes visible baseline without suppressing the first genuine SSE presence', () => {
  const ledger = new LivePresenceLedger();
  const requestEligibility = ledger.snapshot();
  ledger.setEligible(true);
  assert.deepEqual(ledger.accept({ serial: 1, reason: 'initial', requestEligibility }, 'A', ['old'], true), []);
  assert.deepEqual(ledger.accept({ serial: 2, reason: 'sse', requestEligibility: ledger.snapshot() }, 'A', ['new', 'old']), ['new']);
});

test('visible cold initial accepted before IO has a baseline and needs no duplicate refresh', () => {
  const ledger = new LivePresenceLedger();
  assert.deepEqual(ledger.accept({ serial: 1, reason: 'initial', requestEligibility: ledger.snapshot() }, 'A', ['old'], true), []);
  ledger.setEligible(true);
  assert.deepEqual(ledger.accept({ serial: 2, reason: 'sse', requestEligibility: ledger.snapshot() }, 'A', ['new', 'old']), ['new']);
});

test('initial hidden/reduced/offscreen barrier before first eligible IO cannot masquerade as cold visible startup', () => {
  for (const suspensionBeforeRequest of [true, false]) {
    const ledger = new LivePresenceLedger();
    if (suspensionBeforeRequest) ledger.suspend();
    const requestEligibility = ledger.snapshot();
    if (!suspensionBeforeRequest) ledger.suspend();
    ledger.setEligible(true);
    assert.deepEqual(ledger.accept({ serial: 1, reason: 'initial', requestEligibility }, 'A', ['old'], true), []);
    assert.deepEqual(ledger.accept({ serial: 2, reason: 'sse', requestEligibility: ledger.snapshot() }, 'A', ['old', 'catchup']), []);
    assert.deepEqual(ledger.accept({ serial: 3, reason: 'sse', requestEligibility: ledger.snapshot() }, 'A', ['old', 'catchup', 'fresh']), ['fresh']);
  }
});

test('visible evidence alone cannot promote a held initial request across an eligible loss', () => {
  const ledger = new LivePresenceLedger(); const requestEligibility = ledger.snapshot();
  ledger.setEligible(true); ledger.suspend(); ledger.setEligible(true);
  ledger.accept({ serial: 1, reason: 'initial', requestEligibility }, 'A', ['old'], true);
  assert.deepEqual(ledger.accept({ serial: 2, reason: 'sse', requestEligibility: ledger.snapshot() }, 'A', ['old', 'catchup']), []);
  assert.deepEqual(ledger.accept({ serial: 3, reason: 'sse', requestEligibility: ledger.snapshot() }, 'A', ['old', 'catchup', 'fresh']), ['fresh']);
});

test('new presence is not treated as ingestion recency or monotonically increasing event id', () => {
  const { ledger, batch } = fixture();
  const old = liveRecordMotionKey({ event_id: 99, source_id: 1, session_key: 1, timestamp_ms: 3000 });
  const late = liveRecordMotionKey({ event_id: 4, source_id: 2, session_key: 2, timestamp_ms: 1000 });
  ledger.accept(batch('initial'), 'context', [old]);
  assert.deepEqual(ledger.accept(batch(), 'context', [late, old]), [late]);
  ledger.accept(batch(), 'context', [old]);
  assert.deepEqual(ledger.accept(batch(), 'context', [late, old]), [late], 'bounded preceding page, not an unbounded lifetime event ledger');
});

test('query/provider/model/page contexts seed exact null/empty/case identities', () => {
  const { ledger, batch } = fixture();
  const contexts = [JSON.stringify([null, '', 0]), JSON.stringify(['', '', 0]), JSON.stringify(['A', '', 0]), JSON.stringify(['a', '', 0]), JSON.stringify(['a', '', 8])];
  for (const context of contexts) assert.deepEqual(ledger.accept(batch(), context, ['different:' + context]), []);
  assert.deepEqual(ledger.accept(batch(), contexts.at(-1)!, ['fresh']), ['fresh']);
});

test('dependency/pause-resume, visible and online snapshots seed rather than replay a catch-up page', () => {
  for (const reason of ['initial', 'dependency', 'visible', 'online'] as const) {
    const { ledger, batch } = fixture(); ledger.accept(batch('initial'), 'A', ['old']);
    assert.deepEqual(ledger.accept(batch(reason), 'A', ['backlog']), []);
    assert.deepEqual(ledger.accept(batch(), 'A', ['fresh', 'backlog']), ['fresh']);
  }
});

test('hidden/offscreen/reduced/error loss cancels eligibility and first valid returned page seeds', () => {
  const { ledger, batch } = fixture(); ledger.accept(batch('initial'), 'A', ['old']);
  ledger.setEligible(false); assert.deepEqual(ledger.accept(batch(), 'A', ['hidden']), []);
  ledger.setEligible(true);
  assert.deepEqual(ledger.accept(batch(), 'A', ['hidden', 'catchup']), []);
  assert.deepEqual(ledger.accept(batch(), 'A', ['hidden', 'catchup', 'fresh']), ['fresh']);
});

test('late held response crossing loss/return cannot animate or arm a replay', () => {
  const { ledger, batch } = fixture(); ledger.accept(batch('initial'), 'A', ['old']);
  const held = batch(); ledger.setEligible(false); ledger.setEligible(true);
  assert.deepEqual(ledger.accept(held, 'A', ['held']), []);
  assert.deepEqual(ledger.accept(batch(), 'A', ['held', 'returned-baseline']), []);
  assert.deepEqual(ledger.accept(batch(), 'A', ['held', 'returned-baseline', 'fresh']), ['fresh']);
});

test('stale serial cannot replace bounded accepted baseline or foreign context', () => {
  const { ledger, batch } = fixture(); const initial = batch('initial'); ledger.accept(initial, 'A', ['old']);
  const newer = batch(); assert.deepEqual(ledger.accept(newer, 'A', ['new']), ['new']);
  assert.deepEqual(ledger.accept(initial, 'foreign', []), []);
  assert.deepEqual(ledger.accept(batch(), 'A', ['new']), []);
  const provenance = ledger.snapshot(); provenance.eligible = false;
  assert.equal(ledger.snapshot().eligible, true);
});

test('explicit changed selection has its own serial; duplicate response cannot truncate or replay it', () => {
  const empty = { key: null, serial: 0, context: 'A' };
  const first = { key: liveSessionMotionKey(1), serial: 1, context: 'A' };
  assert.equal(changedLiveSelection(empty, first), true);
  assert.equal(changedLiveSelection(first, first), false);
  assert.equal(changedLiveSelection(first, { ...first, serial: 2 }), false);
  assert.equal(changedLiveSelection(first, { ...first, key: liveSessionMotionKey(2) }), false);
  assert.equal(changedLiveSelection(first, { key: liveSessionMotionKey(2), serial: 2, context: 'A' }), true);
  assert.equal(changedLiveSelection(first, { ...first, key: null, serial: 2 }), false);
  assert.equal(changedLiveSelection(first, { ...first, key: liveSessionMotionKey(2), serial: 2, context: 'B' }), false);
  assert.equal(changedLiveSelection({ key: null, serial: 1, context: 'A' }, { ...first, serial: 2 }), true, 'close then reopen is a new explicit selection');
});
