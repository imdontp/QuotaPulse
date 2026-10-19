import assert from 'node:assert/strict';
import { test } from 'node:test';
import { openDb } from '../src/db/index.js';
import { buildServer } from '../src/api/server.js';
import { Scheduler } from '../src/ingest/scheduler.js';
import { readRuntimeObservations, runtimeObservationContext } from '../../web/src/redesign/runtime-observations.js';
import { RuntimeMotionGate, RuntimeMotionEligibility, motionContextKey, type MotionFrame } from '../../web/src/redesign/runtime-motion.js';
import { usageEventParams, type UsageEventScope, type UsageEventsResponse } from '../../web/src/lib/usage-events.js';
import type { RuntimeGraph } from '../../web/src/redesign/model.js';

async function fixture() {
  const now = Date.now();
  const db = openDb(':memory:');
  db.exec(`INSERT INTO source(id,harness,profile,root_path,display_name,detected_at) VALUES
    (1,'codex','synthetic','/synthetic','Reader',0), (2,'codex','other','/other','Other',0);
    INSERT INTO session(id,source_id,native_session_id,project) VALUES
    (1,1,'A','A'), (2,1,'B','B'), (3,1,'empty',''), (4,1,'missing',NULL), (5,2,'foreign-source','A')`);
  const insert = db.prepare(`INSERT INTO usage_event(source_id,session_id,dedup_key,ts,model,provider,total_tokens,call_count)
    VALUES(?,?,?,?,'gpt-a','openai',10,1)`);
  let sequence = 0;
  const add = (session: number, timestamp: number) => Number(insert.run(session === 5 ? 2 : 1, session, `row-${++sequence}`, timestamp).lastInsertRowid);
  for (const session of [1, 2, 3, 4]) add(session, now - 5000 - session);
  const app = buildServer(db, new Scheduler(db, [], { pollMs: 1_000_000, detectMs: 1_000_000 }), { port: 0, token: 'runtime-project-test', webRoot: '.' });
  const get = async <T>(url: string): Promise<T> => {
    const response = await app.inject({ url, headers: { 'x-quotapulse-token': 'runtime-project-test' } });
    assert.equal(response.statusCode, 200, response.body);
    return response.json();
  };
  const requests: Array<{ scope: UsageEventScope; limit: number; offset: number }> = [];
  const read = async (scope: UsageEventScope, pagination: { limit: number; offset: number }) => {
    requests.push({ scope, ...pagination });
    const params = usageEventParams(scope);
    params.set('limit', String(pagination.limit)); params.set('offset', String(pagination.offset));
    return get<UsageEventsResponse>(`/api/usage-events?${params}`);
  };
  const scope: UsageEventScope = { from: now - 60_000, to: now + 1, sourceId: 1 };
  const fetch = async (selected: UsageEventScope) => {
    const graph = await get<RuntimeGraph>(`/api/runtime-map?${usageEventParams(selected)}`);
    return { graph, rows: await readRuntimeObservations(graph, selected, now, read) };
  };
  const provenance = new RuntimeMotionEligibility().update(true, now - 10_000);
  const frame = (serial: number, batch: Awaited<ReturnType<typeof fetch>>, project: string | null | undefined, reason: MotionFrame['reason'] = 'sse'): MotionFrame => {
    const motionScope = { key: 'synthetic-range', sourceId: 1, project };
    return { batchSerial: serial, reason, scope: motionScope, now, activityWindowMs: batch.graph.activityWindowMs!,
      visible: true, intersecting: true, reduced: false, eligibility: provenance, requestEligibility: provenance,
      rows: batch.rows, graph: { batchSerial: serial, contextKey: motionContextKey(motionScope), edges: batch.graph.edges, harnesses: batch.graph.nodes.harness.map(node => node.key) } };
  };
  return { now, add, scope, fetch, read, requests, frame, close: async () => { await app.close(); db.close(); } };
}

for (const scenario of ['A-only', 'A-then-newer-B', 'B-then-newer-A', 'two-new-A'] as const) {
  test(`selected Runtime observations: ${scenario} samples exact A while rail stays global`, async () => {
    const f = await fixture();
    try {
      const selected = { ...f.scope, project: 'A' };
      const baseline = await f.fetch(selected);
      const gate = new RuntimeMotionGate();
      assert.deepEqual(gate.observe(f.frame(1, baseline, 'A', 'initial')), []);
      let newestA: number;
      if (scenario === 'B-then-newer-A') f.add(2, f.now - 1001);
      newestA = f.add(1, f.now - 1000);
      if (scenario === 'A-then-newer-B') f.add(2, f.now - 999);
      if (scenario === 'two-new-A') newestA = f.add(1, f.now - 999);
      // A newer foreign source must not override the selected source either.
      f.add(5, f.now - 998);
      const accepted = await f.fetch(selected);
      const rail = await f.fetch(f.scope);
      assert.equal(accepted.rows.length, 1); assert.equal(accepted.rows[0].event_id, newestA);
      assert.equal(rail.rows[0].project, scenario === 'A-then-newer-B' ? 'B' : 'A');
      const waiting = f.frame(2, accepted, 'A'); waiting.graph = undefined;
      assert.deepEqual(gate.observe(waiting), []);
      const signals = gate.observe(f.frame(2, accepted, 'A'));
      assert.equal(signals.length, 1); assert.equal(signals[0].eventId, newestA);
      assert.equal(signals[0].kind, 'edge'); assert.equal(signals[0].durationMs, 700);
      assert.deepEqual(gate.observe(f.frame(2, accepted, 'A')), []);
      assert.ok(f.requests.every(request => request.limit === 1 && request.offset === 0 && request.scope.sourceId === 1));
    } finally { await f.close(); }
  });
}

test('exact empty, missing and All scopes remain distinct; switches seed without replay', async () => {
  const f = await fixture();
  try {
    const gate = new RuntimeMotionGate();
    const a = await f.fetch({ ...f.scope, project: 'A' });
    gate.observe(f.frame(1, a, 'A', 'initial'));
    let serial = 1;
    for (const [scope, project, session] of [
      [{ ...f.scope, project: '' }, '', 3],
      [{ ...f.scope, projectMissing: true }, null, 4],
      [f.scope, undefined, 2],
      [{ ...f.scope, project: 'A' }, 'A', 1],
    ] as const) {
      const baseline = await f.fetch(scope);
      assert.equal(baseline.rows[0].project, project === undefined ? null : project);
      assert.deepEqual(gate.observe(f.frame(++serial, baseline, project)), []);
      const id = f.add(session, f.now - 1000 + serial);
      const accepted = await f.fetch(scope);
      assert.equal(gate.observe(f.frame(++serial, accepted, project))[0].eventId, id);
    }
    assert.notEqual(runtimeObservationContext('route', ''), runtimeObservationContext('route', null));
    assert.notEqual(runtimeObservationContext('route', 'A'), runtimeObservationContext('other-route', 'A'));
  } finally { await f.close(); }
});

test('stale accepted serial and wrong graph context cannot release a selected-project batch', async () => {
  const f = await fixture();
  try {
    const scope = { ...f.scope, project: 'A' };
    const gate = new RuntimeMotionGate();
    gate.observe(f.frame(1, await f.fetch(scope), 'A', 'initial'));
    f.add(1, f.now - 1000);
    const old = await f.fetch(scope);
    const pendingOld = f.frame(2, old, 'A'); pendingOld.graph = undefined; gate.observe(pendingOld);
    const latestId = f.add(1, f.now - 999);
    const latest = await f.fetch(scope);
    const pendingNew = f.frame(3, latest, 'A'); pendingNew.graph = undefined; gate.observe(pendingNew);
    assert.deepEqual(gate.observe(f.frame(2, old, 'A')), []);
    const wrongContext = f.frame(3, latest, 'A'); wrongContext.graph!.contextKey = motionContextKey({ key: 'different', project: 'A' });
    assert.deepEqual(gate.observe(wrongContext), []);
    assert.equal(gate.observe(f.frame(3, latest, 'A'))[0].eventId, latestId);
  } finally { await f.close(); }
});

test('observation reads retain range/filter identity, remove only grain, and skip invalid intervals', async () => {
  const f = await fixture();
  try {
    const graph = (await f.fetch(f.scope)).graph;
    const scope: UsageEventScope = { ...f.scope, project: '', grain: 'call', provider: 'openai', model: 'gpt-a', q: 'gpt', sessionId: 3 };
    const rows = await readRuntimeObservations(graph, scope, f.now, f.read);
    assert.equal(rows[0].project, '');
    const request = f.requests.at(-1)!;
    const expected = { ...scope, harness: 'codex' }; delete expected.grain;
    assert.deepEqual(request.scope, expected);
    const count = f.requests.length;
    assert.deepEqual(await readRuntimeObservations(graph, { ...scope, to: scope.from }, f.now, f.read), []);
    assert.equal(f.requests.length, count);
    assert.deepEqual(await readRuntimeObservations(graph, scope, f.now, async () => { throw new Error('unavailable'); }), []);
  } finally { await f.close(); }
});
