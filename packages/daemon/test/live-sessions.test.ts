import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from '../src/db/index.js';
import { buildServer } from '../src/api/server.js';
import { Scheduler } from '../src/ingest/scheduler.js';

test('live sessions count valid source timestamps and page exact scoped metadata', async () => {
  const db = openDb(':memory:');
  const now = Date.now();
  db.exec(`INSERT INTO source(id,harness,profile,root_path,display_name,detected_at) VALUES
    (1,'codex','test','/fixture/one','Codex test',0),(2,'hermes','test','/fixture/two','Hermes test',0);`);
  const session = db.prepare(`INSERT INTO session(id,source_id,native_session_id,project,last_seen_at)
    VALUES (?,?,?,?,?)`);
  session.run(1, 1, 'recent', 'alpha_100%', now - 1000);
  session.run(2, 1, 'future', 'alpha_100%', now + 60_000);
  session.run(3, 2, 'unknown', null, null);
  session.run(4, 1, 'old', 'other', now - 3600_000);
  const event = db.prepare(`INSERT INTO usage_event(source_id,session_id,dedup_key,ts,total_tokens,call_count)
    VALUES (?,?,?,?,?,1)`);
  for (const [id, sourceId, projectTokens] of [[1, 1, 100], [2, 1, 200], [3, 2, 300], [4, 1, 400]]) {
    event.run(sourceId, id, `event-${id}`, now - 2000, projectTokens);
  }
  const app = buildServer(db, new Scheduler(db, [], { pollMs: 1_000_000, detectMs: 1_000_000 }), { port: 0, token: 'live-test', webRoot: '.' });
  const headers = { 'x-quotapulse-token': 'live-test' };
  const url = `/api/live-sessions?from=${now - 30 * 60_000}&to=${now + 1}`;
  try {
    const recent = await app.inject({ url, headers });
    assert.equal(recent.statusCode, 200, recent.body);
    assert.equal(recent.json().allCount, 4);
    assert.equal(recent.json().recentCount, 1);
    assert.equal(recent.json().rows[0].nativeSessionId, 'recent');
    assert.equal(recent.json().rows[0].tokens, 100);
    const all = await app.inject({ url: `${url}&mode=all&limit=2&offset=2`, headers });
    assert.equal(all.json().total, 4);
    assert.equal(all.json().rows.length, 2);
    const literal = await app.inject({ url: `${url}&mode=all&q=%25`, headers });
    assert.equal(literal.json().total, 2);
    const missing = await app.inject({ url: `${url}&mode=all&project_missing=1`, headers });
    assert.equal(missing.json().total, 1);
    assert.equal((await app.inject({ url: `${url}&mode=queued`, headers })).statusCode, 400);
    assert.equal((await app.inject({ url: `${url}&limit=501`, headers })).statusCode, 400);
    assert.equal((await app.inject({ url: '/api/live-sessions?mode=all', headers })).statusCode, 400);
    assert.equal((await app.inject(url)).statusCode, 401);
  } finally { await app.close(); db.close(); }
});
