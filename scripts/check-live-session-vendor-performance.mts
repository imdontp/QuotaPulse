import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { openDb } from '../packages/daemon/src/db/index.js';
import { liveSessions } from '../packages/daemon/src/api/live-sessions.js';
import { usageWhere } from '../packages/daemon/src/api/usage-scope.js';
import { vendorSqlCase } from '../packages/daemon/src/util/vendor.js';
const db = openDb(':memory:');
try {
  db.exec("INSERT INTO source(id,harness,profile,root_path,display_name,detected_at) VALUES(1,'codex','synthetic','/fixture','Fixture',0)");
  const session = db.prepare('INSERT INTO session(id,source_id,native_session_id,last_seen_at) VALUES(?,1,?,1000000)');
  const event = db.prepare('INSERT INTO usage_event(source_id,session_id,dedup_key,ts,model,provider,total_tokens,call_count) VALUES(1,?,?,?,?,?,1,1)');
  db.transaction(() => {
    for (let id = 1; id <= 500; id++) {
      session.run(id, `session-${id}`);
      for (let index = 0; index < 100; index++) event.run(id, `${id}-${index}`, 900000 + index, index % 2 ? 'claude-3-7-sonnet' : 'gpt-4o', index % 2 ? 'openrouter' : 'openai');
    }
  })();
  const scope = { from: 800000, to: 1000001 };
  const where = usageWhere(scope);
  const query = `SELECT u.session_id AS sessionKey, ${vendorSqlCase('u.model', 'u.provider')} AS vendor
    FROM usage_event u JOIN source s ON s.id=u.source_id JOIN session sess ON sess.id=u.session_id
    WHERE ${where.sql} AND u.session_id IN (@session0,@session1,@session2,@session3,@session4,@session5,@session6,@session7,@session8,@session9)
      AND u.model IS NOT NULL AND TRIM(u.model) <> '' GROUP BY u.session_id, u.model, u.provider`;
  const params = { ...where.params, ...Object.fromEntries(Array.from({length:10}, (_, index) => [`session${index}`, index + 1])) };
  const plan = db.prepare(`EXPLAIN QUERY PLAN ${query}`).all(params) as Array<{ detail: string }>;
  assert.ok(plan.some(row => row.detail.includes('idx_usage_session')), JSON.stringify(plan));
  const statement = db.prepare(query);
  const durations: number[] = [], fullDurations: number[] = [];
  for (let index = 0; index < 25; index++) {
    let started = performance.now(); const rows = statement.all(params); const elapsed = performance.now() - started;
    assert.equal(rows.length, 20);
    started = performance.now(); const result = liveSessions(db, scope, 1000001, 'recent', { limit: 10, offset: 0 }); const full = performance.now() - started;
    assert.equal(result.total, 500); assert.equal(result.rows.length, 10);
    if (index >= 5) { durations.push(elapsed); fullDurations.push(full); }
  }
  const maximumPage = liveSessions(db, scope, 1000001, 'all', { limit: 500, offset: 0 });
  assert.equal(maximumPage.rows.length, 500, 'Maximum API page must fit SQLite parameters');
  const describe = (values: number[]) => { values.sort((a,b)=>a-b); return { p50Ms: values[Math.floor(values.length * .5)], p95Ms: values[Math.floor(values.length * .95)], maxMs: values.at(-1) }; };
  console.log(JSON.stringify({ syntheticEvents: 50000, syntheticSessions: 500, requestedPage: 10, repetitions: 20, plan: plan.map(row => row.detail), addedMakerQuery: describe(durations), fullLiveSessions: describe(fullDurations), limitation: 'local in-memory synthetic benchmark; not production CPU or disk performance' }, null, 2));
} finally { db.close(); }
