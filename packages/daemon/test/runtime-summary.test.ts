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

test('runtime summary is authenticated, preserves the legacy response, and validates opt-in scope', async () => {
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
    assert.equal(Object.hasOwn(result.json(), 'scope'), false);
    for (const query of [
      'to=20', 'provider=openai', 'from=20&to=20', 'from=-1&to=20',
      'from=0&to=20&unexpected=1', 'from=0&to=20&from=1',
      'from=0&to=20&provider=a&provider=b', 'from=0&to=20&project_missing=1&project=',
      'from=0&to=20&grain=imaginary', 'from=0&to=20&source_id=0',
    ]) {
      assert.equal((await app.inject({ method: 'GET', url: `/api/runtime-summary?${query}`, headers })).statusCode, 400, query);
    }
    assert.equal((await app.inject({ method: 'GET', url: '/api/runtime-summary?from=0&to=20' })).statusCode, 401);
    const scoped = await app.inject({ method: 'GET', url: '/api/runtime-summary?from=0&to=20&project=%20raw%20&source_id=1&grain=all', headers });
    assert.equal(scoped.statusCode, 200);
    assert.deepEqual(scoped.json().scope, { from: 0, to: 20, sourceId: 1, project: ' raw ', grain: 'all' });
    assert.equal(scoped.json().namedProjects, 0);
  } finally { await app.close(); db.close(); }
});

function scopedFixture() {
  const db = openDb(':memory:');
  const now = 1_000_000;
  const source = db.prepare('INSERT INTO source(id,harness,profile,root_path,display_name,detected_at) VALUES (?, ?, ?, ?, ?, 0)');
  source.run(1, 'codex', 'call', '/call', 'Literal 100%_ source');
  source.run(2, 'hermes', 'aggregate', '/aggregate', 'Aggregate');
  source.run(3, 'future-reader', 'unknown', '/unknown', 'Unknown grain');
  const session = db.prepare('INSERT INTO session(id,source_id,native_session_id,project,last_seen_at) VALUES (?, ?, ?, ?, ?)');
  session.run(1, 1, 'first', ' raw ', now);
  session.run(2, 1, 'second', 'raw', now - 300_000);
  session.run(3, 2, 'stale', 'aggregate', now - 300_001);
  session.run(4, 3, 'future', 'unknown', now + 1);
  session.run(5, 1, 'empty', '', now);
  session.run(6, 1, 'missing', null, now);
  session.run(7, 1, 'metadata-only', 'metadata-only', now);
  const usage = db.prepare('INSERT INTO usage_event(source_id,session_id,dedup_key,ts,model,provider,total_tokens) VALUES (?,?,?,?,?,?,1)');
  usage.run(1, 1, 'a', 100, 'gpt-4', 'gateway');
  usage.run(1, 1, 'duplicate-identities', 100, 'gpt-4', 'gateway');
  usage.run(1, 2, 'lower-boundary', 100, 'gpt-4', 'gateway');
  usage.run(2, 3, 'aggregate', 150, 'deepseek-v4', 'gateway');
  usage.run(3, 4, 'unknown', 150, 'gemini-2', 'google');
  usage.run(1, 5, 'empty', 150, '', '');
  usage.run(1, 6, 'missing', 150, null, null);
  usage.run(1, null, 'sessionless', 150, 'claude-sonnet', 'sessionless-route');
  usage.run(1, 1, 'upper-boundary', 200, 'excluded-upper', 'excluded-upper');
  usage.run(1, 1, 'before-range', 99, 'excluded-lower', 'excluded-lower');
  return { db, now };
}

test('scoped summary counts distinct usage-backed identities across all grains and retains sessionless events', () => {
  const { db, now } = scopedFixture();
  try {
    const scope = { from: 100, to: 200 };
    assert.deepEqual(runtimeSummary(db, now, scope), {
      now, recentFrom: 700_000, scope, namedProjects: 4, models: 4, providers: 3, recentSessions: 4,
    });
    // Historical event time does not replace the daemon-relative recent window.
    // Duplicate/tied events count a matching session once; metadata-only is global only.
    assert.equal(runtimeSummary(db, now).namedProjects, 5);
    assert.equal(runtimeSummary(db, now).recentSessions, 5);
    const empty = { from: 201, to: 300 };
    assert.deepEqual(runtimeSummary(db, now, empty), {
      now, recentFrom: 700_000, scope: empty, namedProjects: 0, models: 0, providers: 0, recentSessions: 0,
    });
  } finally { db.close(); }
});

test('scoped summary shares exact project, source, session, vendor, grain and literal search predicates', () => {
  const { db, now } = scopedFixture();
  try {
    const base = { from: 100, to: 200 };
    const counts = (filters: Parameters<typeof runtimeSummary>[2]) => {
      const { namedProjects, models, providers, recentSessions } = runtimeSummary(db, now, { ...base, ...filters });
      return { namedProjects, models, providers, recentSessions };
    };
    const oneRecent = { namedProjects: 1, models: 1, providers: 1, recentSessions: 1 };
    assert.deepEqual(counts({ ...base, project: ' raw ' }), oneRecent);
    assert.deepEqual(counts({ ...base, project: 'raw' }), oneRecent);
    assert.deepEqual(counts({ ...base, sessionId: 2 }), oneRecent);
    assert.deepEqual(counts({ ...base, provider: 'gateway', vendor: 'openai' }), { ...oneRecent, namedProjects: 2, recentSessions: 2 });
    assert.deepEqual(counts({ ...base, sourceId: 2, harness: 'hermes', grain: 'session_aggregate' }), { ...oneRecent, recentSessions: 0 });
    assert.deepEqual(counts({ ...base, grain: 'unknown' }), { ...oneRecent, recentSessions: 0 });
    assert.deepEqual(counts({ ...base, grain: 'call' }), { namedProjects: 2, models: 2, providers: 2, recentSessions: 4 });
    assert.deepEqual(counts({ ...base, project: '' }), { namedProjects: 0, models: 0, providers: 0, recentSessions: 1 });
    assert.deepEqual(counts({ ...base, projectMissing: true }), { namedProjects: 0, models: 1, providers: 1, recentSessions: 1 });
    assert.deepEqual(counts({ ...base, provider: 'sessionless-route', model: 'claude-sonnet' }), { namedProjects: 0, models: 1, providers: 1, recentSessions: 0 });
    assert.deepEqual(counts({ ...base, q: '100%_' }), { namedProjects: 2, models: 2, providers: 2, recentSessions: 4 });
    assert.deepEqual(counts({ ...base, q: '100%_ absent' }), { namedProjects: 0, models: 0, providers: 0, recentSessions: 0 });
    assert.deepEqual(counts({ ...base, grain: 'all' }), counts(base));
  } finally { db.close(); }
});

test('scoped summary preserves whitespace identities instead of normalizing them into empty metadata', () => {
  const { db, now } = scopedFixture();
  try {
    db.prepare('INSERT INTO session(id,source_id,native_session_id,project,last_seen_at) VALUES (8,1,?,?,?)').run('spaces', ' ', now);
    db.prepare('INSERT INTO usage_event(source_id,session_id,dedup_key,ts,model,provider) VALUES (1,8,?,?,?,?)').run('spaces', 150, ' ', ' ');
    const scope = { from: 100, to: 200, project: ' ', model: ' ', provider: ' ' };
    assert.deepEqual(runtimeSummary(db, now, scope), {
      now, recentFrom: 700_000, scope, namedProjects: 1, models: 1, providers: 1, recentSessions: 1,
    });
  } finally { db.close(); }
});

test('authenticated scoped route returns usage-backed counts with the parsed scope and daemon clock', async () => {
  const { db } = scopedFixture();
  const scheduler = new Scheduler(db, [], { pollMs: 1_000_000, detectMs: 1_000_000 });
  const app = buildServer(db, scheduler, { port: 0, token: 'summary-test', webRoot: '/synthetic/nonexistent' });
  try {
    const headers = { 'x-quotapulse-token': 'summary-test' };
    for (const [query, scope] of [
      ['from=100&to=200', { from: 100, to: 200 }],
      ['from=100&to=200&provider=gateway&vendor=openai', { from: 100, to: 200, provider: 'gateway', vendor: 'openai' }],
      ['from=100&to=200&project_missing=1', { from: 100, to: 200, projectMissing: true }],
      ['from=100&to=200&source_id=2&grain=session_aggregate', { from: 100, to: 200, sourceId: 2, grain: 'session_aggregate' }],
    ] as const) {
      const result = await app.inject({ method: 'GET', url: `/api/runtime-summary?${query}`, headers });
      assert.equal(result.statusCode, 200, query);
      const body = result.json();
      assert.deepEqual(body, runtimeSummary(db, body.now, scope));
      assert.equal(body.now - body.recentFrom, 300_000);
    }
  } finally { await app.close(); db.close(); }
});
