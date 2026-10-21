import assert from 'node:assert/strict';
import { test } from 'node:test';
import { openDb } from '../src/db/index.js';
import { buildServer } from '../src/api/server.js';
import { Scheduler } from '../src/ingest/scheduler.js';

test('model summary omits breakdown explicitly while preserving full scoped groups, totals and trends', async () => {
  const db = openDb(':memory:');
  db.exec(`INSERT INTO source(id,harness,profile,root_path,display_name,detected_at) VALUES
    (1,'codex','test','/synthetic/one','One',0),(2,'hermes','test','/synthetic/two','Two',0);
    INSERT INTO session(id,source_id,native_session_id,project) VALUES(1,1,'one',''),(2,2,'two',NULL);`);
  const insert = db.prepare(`INSERT INTO usage_event(source_id,session_id,dedup_key,ts,model,provider,effort,total_tokens,call_count,cost_usd,cost_source)
    VALUES(?,?,?,?,?,?,?,?,?,?,?)`);
  const identities = [[null,null],['',''],['Unknown','Unknown'],['gpt-a','openai'],['GPT-a','openai'],['gpt-a','route-b'],["x'); DROP TABLE usage_event;--",' route ']];
  for (let i = 0; i < 42; i++) {
    const [model, provider] = identities[i % identities.length];
    insert.run(i % 2 + 1, i % 2 + 1, `event-${i}`, 100 + i, model, provider, i % 2 ? null : `effort-${i}`, i + 1, i % 3 + 1,
      i % 3 === 2 ? null : i / 100, ['native','computed','unknown'][i % 3]);
  }
  const app = buildServer(db, new Scheduler(db, [], { pollMs: 1_000_000, detectMs: 1_000_000 }), { port: 0, token: 'summary-test', webRoot: '.' });
  const headers = { 'x-quotapulse-token': 'summary-test' };
  const changes = db.prepare('SELECT total_changes() n').get();
  try {
    for (const extra of ['', '&provider=openai', '&model=gpt-a', '&source_id=2', '&session_id=1', '&project=', '&project_missing=1', '&grain=call', '&grain=session_aggregate', '&vendor=openai', '&q=route-b', '&from=130&to=142']) {
      const range = extra.startsWith('&from=') ? extra.slice(1) : `from=100&to=142${extra}`;
      const path = `/api/models?detailed=1&trends=1&${range}`;
      const full = await app.inject({ url: path, headers });
      const compact = await app.inject({ url: path + '&breakdown=0', headers });
      assert.equal(full.statusCode, 200, full.body); assert.equal(compact.statusCode, 200, compact.body);
      const { now: _fullNow, rows, ...expected } = full.json();
      const { now: _summaryNow, breakdown, ...actual } = compact.json();
      assert.deepEqual(actual, expected, extra);
      assert.equal(breakdown, 'omitted'); assert.equal(Object.hasOwn(actual, 'rows'), false);
      assert.ok(Array.isArray(rows)); assert.equal(Object.hasOwn(expected, 'breakdown'), false);
      const explicitFull = await app.inject({ url: path + '&breakdown=1', headers });
      const { now: _now, ...explicit } = explicitFull.json();
      assert.deepEqual(explicit, { ...expected, rows });
    }
    const legacy = await app.inject({ url: '/api/models?from=100&to=142', headers });
    assert.deepEqual(Object.keys(legacy.json()).sort(), ['from','models','since','to']);
    for (const query of ['detailed=1&breakdown=2','detailed=1&breakdown=','detailed=1&breakdown=true','detailed=1&breakdown=0&breakdown=1','breakdown=0','detailed=0&breakdown=0','detailed=1&breakdown=0&source_id=0']) {
      assert.equal((await app.inject({ url: '/api/models?from=100&to=142&' + query, headers })).statusCode, 400, query);
    }
    assert.equal((await app.inject('/api/models?detailed=1&breakdown=0&from=100&to=142')).statusCode, 401);
    assert.deepEqual(db.prepare('SELECT total_changes() n').get(), changes);
  } finally { await app.close(); db.close(); }
});
