import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from '../src/db/index.js';
import { runtimeSummary } from '../src/api/runtime-summary.js';
import { buildServer } from '../src/api/server.js';
import { Scheduler } from '../src/ingest/scheduler.js';

test('runtime summary deduplicates recorded identities and excludes unknown/empty and future/stale sessions', () => {
  const db = openDb(':memory:');
  const now = 1_000_000;
  try {
    assert.deepEqual(runtimeSummary(db, now), { now, recentFrom: now - 300_000, namedProjects: 0, models: 0, providers: 0, recentSessions: 0 });
    db.exec("INSERT INTO source(id,harness,profile,root_path,display_name,detected_at) VALUES (1,'codex','test','/synthetic','Test',0)");
    const session = db.prepare('INSERT INTO session(id,source_id,native_session_id,project,last_seen_at) VALUES (?,1,?,?,?)');
    session.run(1, 'a', 'project_100%', now);
    session.run(2, 'b', 'project_100%', now - 300_000);
    session.run(3, 'c', '', now - 300_001);
    session.run(4, 'd', null, now + 1);
    session.run(5, 'e', 'metadata-only', null);
    const usage = db.prepare('INSERT INTO usage_event(source_id,dedup_key,ts,model,provider,total_tokens) VALUES (1,?,?,?,?,1)');
    usage.run('a', now, 'model', 'provider'); usage.run('b', now, 'model', 'provider');
    usage.run('c', now, '', ''); usage.run('d', now, null, null);
    assert.deepEqual(runtimeSummary(db, now), { now, recentFrom: now - 300_000, namedProjects: 2, models: 1, providers: 1, recentSessions: 2 });
  } finally { db.close(); }
});

test('runtime summary is authenticated and rejects scoped query parameters', async () => {
  const db = openDb(':memory:');
  const scheduler = new Scheduler(db, [], { pollMs: 1_000_000, detectMs: 1_000_000 });
  const app = buildServer(db, scheduler, { port: 0, token: 'summary-test', webRoot: '/synthetic/nonexistent' });
  try {
    assert.equal((await app.inject({ method: 'GET', url: '/api/runtime-summary' })).statusCode, 401);
    const headers = { 'x-quotapulse-token': 'summary-test' };
    assert.equal((await app.inject({ method: 'GET', url: '/api/runtime-summary?from=0', headers })).statusCode, 400);
    const result = await app.inject({ method: 'GET', url: '/api/runtime-summary', headers });
    assert.equal(result.statusCode, 200);
    assert.equal(result.json().namedProjects, 0);
    assert.equal(result.json().now - result.json().recentFrom, 300_000);
  } finally { await app.close(); db.close(); }
});
