import assert from 'node:assert/strict';
import { test } from 'node:test';
import { RuntimeMotionGate, motionContextKey, type MotionFrame } from '../src/redesign/runtime-motion';

type Row = MotionFrame['rows'][number];
const row = (event_id: number, patch: Partial<Row> = {}): Row => ({ event_id, source_id: 7, timestamp_ms: 1000, grain: 'call', project: 'A', harness: 'codex', provider: 'openai', model: 'M', call_count: 1, total_tokens: 10, input_tokens: 4, output_tokens: 6, cached_input_tokens: 0, cache_write_tokens: 0, reasoning_tokens: 0, ...patch });
const frame = (batchSerial: number, rows: Row[], patch: Partial<MotionFrame> = {}): MotionFrame => {
  const f: MotionFrame = { batchSerial, rows, reason: 'sse', scope: { key: 'range=today', project: 'A' }, now: 1100, activityWindowMs: 300000, visible: true, intersecting: true, reduced: false, ...patch };
  f.graph ??= { batchSerial, contextKey: motionContextKey(f.scope), edges: [{ column: 1, from: 'codex', to: 'openai' }], harnesses: ['codex'] }; return f;
};
const started = () => { const gate = new RuntimeMotionGate(); assert.deepEqual(gate.observe(frame(1, [row(1)], { reason: 'initial' })), []); return gate; };

test('existing mount has no particles; one new observed call emits one bounded known edge', () => {
  const gate = started(); const result = gate.observe(frame(2, [row(2)]));
  assert.deepEqual(result, [{ kind: 'edge', eventId: 2, sourceId: 7, column: 1, from: 'codex', to: 'openai', presentation: 'moving', durationMs: 700 }]);
  assert.deepEqual(gate.observe(frame(2, [row(2)])), []);
  assert.deepEqual(gate.observe(frame(3, [row(2, { total_tokens: 999 })])), []);
});
test('initial/dependency/visible/online causes consume history without replay', () => {
  for (const reason of ['initial', 'dependency', 'visible', 'online'] as const) {
    const gate = started(); assert.deepEqual(gate.observe(frame(2, [row(2)], { reason })), []);
    assert.equal(gate.observe(frame(3, [row(3)])).length, 1);
  }
});
test('hidden/offscreen backlog is consumed and the first resumed batch seeds', () => {
  for (const patch of [{ visible: false }, { intersecting: false }]) {
    const gate = started(); assert.deepEqual(gate.observe(frame(2, [row(2)], patch)), []);
    assert.deepEqual(gate.observe(frame(3, [row(3)])), []);
    assert.equal(gate.observe(frame(4, [row(4)])).length, 1);
  }
});
test('aggregate revisions with stable ID cause only an actual harness node highlight', () => {
  const gate = new RuntimeMotionGate(); gate.observe(frame(1, [row(8, { grain: 'session_aggregate' })]));
  const result = gate.observe(frame(2, [row(8, { grain: 'session_aggregate', total_tokens: 20 })]));
  assert.equal(result.length, 1); assert.equal(result[0].kind, 'node'); assert.equal(result[0].presentation, 'static');
  assert.deepEqual(gate.observe(frame(3, [row(8, { grain: 'session_aggregate', total_tokens: 20 })])), []);
});
test('unknown grain and old/future observations never fabricate flow', () => {
  for (const patch of [{ grain: 'unknown' as const }, { timestamp_ms: -500000 }, { timestamp_ms: 999999 }]) {
    const gate = started(); assert.deepEqual(gate.observe(frame(2, [row(2, patch)])), []);
  }
});
test('project/source filters are exact; foreign records cannot pulse selected project', () => {
  const gate = started(); assert.deepEqual(gate.observe(frame(2, [row(2, { project: 'a' }), row(3, { source_id: 8 })], { scope: { key: 'range=today&source=7', project: 'A', sourceId: 7 } })), []);
  gate.observe(frame(3, [row(4)], { scope: { key: 'range=today&source=7', project: 'A', sourceId: 7 } }));
  assert.deepEqual(gate.observe(frame(4, [row(5, { project: 'a' })], { scope: { key: 'range=today&source=7', project: 'A', sourceId: 7 } })), []);
});
test('all-project scope is different from exact NULL and empty project identity', () => {
  assert.notEqual(motionContextKey({ key: 'all' }), motionContextKey({ key: 'all', project: null }));
  assert.notEqual(motionContextKey({ key: 'all', project: null }), motionContextKey({ key: 'all', project: '' }));
  const gate = new RuntimeMotionGate(); gate.observe(frame(1, [row(1, { project: null })], { scope: { key: 'all', project: null } }));
  assert.equal(gate.observe(frame(2, [row(2, { project: null })], { scope: { key: 'all', project: null } })).length, 1);
  assert.deepEqual(gate.observe(frame(3, [row(3, { project: '' })], { scope: { key: 'all', project: null } })), []);
});
test('unknown or invented route edges are not rendered; exact graph route is mandatory', () => {
  const gate = started();const f = frame(2, [row(2, { provider: null, project: null, model: null })]); assert.deepEqual(gate.observe(f), []);
});
test('reduced motion emits static actual-call highlight and never moving presentation', () => {
  const gate = started(); const r = gate.observe(frame(2, [row(2)], { reduced: true })); assert.equal(r[0].presentation, 'static');
});
test('one visible pending batch waits for matching graph serial/context and emits once', () => {
  const gate = started(); const f = frame(2, [row(2)]); f.graph = undefined; assert.deepEqual(gate.observe(f), []); assert.equal(gate.sizes().pending, 1);
  const wrong = frame(2, [row(2)]); wrong.graph!.batchSerial = 1; assert.deepEqual(gate.observe(wrong), []);
  const otherScope = frame(2, [row(2)]); otherScope.graph!.contextKey = motionContextKey({ key: 'range=week', project: 'A' }); assert.deepEqual(gate.observe(otherScope), []);
  assert.equal(gate.observe(frame(2, [row(2)])).length, 1); assert.deepEqual(gate.observe(frame(2, [row(2)])), []);
});
test('visibility loss cancels a pending readygraph wait with no later replay', () => {
  const gate = started(); const f = frame(2, [row(2)]); f.graph = undefined; gate.observe(f);
  gate.observe(frame(2, [row(2)], { intersecting: false })); assert.equal(gate.sizes().pending, 0);
  assert.deepEqual(gate.observe(frame(2, [row(2)])), []); assert.deepEqual(gate.observe(frame(3, [row(3)])), []);
});
test('new batch replaces pending batch; stale graph arrival cannot replay older IDs', () => {
  const gate = started(); const two = frame(2, [row(2)]); two.graph = undefined; gate.observe(two);
  const three = frame(3, [row(3)]); three.graph = undefined; gate.observe(three);
  assert.deepEqual(gate.observe(frame(2, [row(2)])), []); const r = gate.observe(frame(3, [row(3)])); assert.equal(r[0].eventId, 3);
});
test('scope/project change cancels pending and seeds the new view', () => {
  const gate = started(); const f = frame(2, [row(2)]); f.graph = undefined; gate.observe(f);
  assert.deepEqual(gate.observe(frame(3, [row(3, { project: 'B' })], { scope: { key: 'range=week', project: 'B' } })), []);
  assert.equal(gate.sizes().pending, 0);
});
test('bounded source/aggregate ledgers do not replay an evicted source or aggregate version', () => {
  const gate = new RuntimeMotionGate({ observations: 2, pending: 2 }); const scope = { key: 'all' };
  gate.observe(frame(1, [row(1, { source_id: 1 })], { scope }));
  for (let i = 2; i < 10; i++) gate.observe(frame(i, [row(i, { source_id: i, grain: 'session_aggregate' })], { scope }));
  assert.ok(gate.sizes().observations <= 2);
  assert.deepEqual(gate.observe(frame(10, [row(1, { source_id: 1 })], { scope })), []);
});
test('reset releases pure ledger state and next mount seeds instead of replays', () => {
  const gate = started();gate.observe(frame(2, [row(2)]));gate.reset();assert.deepEqual(gate.sizes(), { observations: 0, pending: 0 }); assert.deepEqual(gate.observe(frame(3, [row(3)])), []);
});

test('late graph completion cannot play a pending observation after its recent window expires', () => {
  const gate = started(); const f = frame(2, [row(2)]); f.graph = undefined; gate.observe(f);
  assert.deepEqual(gate.observe(frame(2, [row(2)], { now: 400001 })), []);
  assert.equal(gate.sizes().pending, 0);
});


test('empty initial snapshot and new profile sources accept their first returned eligible call', () => {
 const gate = new RuntimeMotionGate();gate.observe(frame(1, [], {reason:'initial'}));
 assert.equal(gate.observe(frame(2,[row(1)])).length,1);
 assert.equal(gate.observe(frame(3,[row(2,{source_id:8})])).length,1);
});
test('a new lower numeric identity is observed, not treated as an insertion sequence',()=>{
 const gate=new RuntimeMotionGate();gate.observe(frame(1,[row(100)]));assert.equal(gate.observe(frame(2,[row(50)])).length,1);
});
test('more than 32 distinct profiles do not cyclically disable new observations',()=>{
 const gate=new RuntimeMotionGate();gate.observe(frame(1,[]));for(let i=2;i<50;i++)assert.equal(gate.observe(frame(i,[row(i,{source_id:i})])).length,1);
});
test('aggregate reasoning component revisions are node-only even if total is unchanged',()=>{
 const gate=new RuntimeMotionGate();gate.observe(frame(1,[row(1,{grain:'session_aggregate'})]));const result=gate.observe(frame(2,[row(1,{grain:'session_aggregate',reasoning_tokens:4})]));assert.equal(result[0].kind,'node');
});
test('pending overflow is consumed and cannot replay on subsequent frames',()=>{
 const gate=new RuntimeMotionGate({observations:512,pending:2});gate.observe(frame(1,[]));const rows=[row(1),row(2),row(3)];assert.equal(gate.observe(frame(2,rows)).length,2);assert.deepEqual(gate.observe(frame(3,rows)),[]);
});


test('same-serial reentry cannot replay a query that started while offscreen',()=>{
 const gate=started();gate.observe(frame(1,[row(1)],{intersecting:false}));assert.deepEqual(gate.observe(frame(1,[row(1)])),[]);assert.deepEqual(gate.observe(frame(2,[row(2)])),[]);assert.equal(gate.observe(frame(3,[row(3)])).length,1);
});
