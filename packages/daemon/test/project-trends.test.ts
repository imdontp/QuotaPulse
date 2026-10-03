import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from '../src/db/index.js';
import { buildServer } from '../src/api/server.js';
import { Scheduler } from '../src/ingest/scheduler.js';

test('project mini trends preserve scope, half-open range, identities and aggregate totals', async () => {
  const db = openDb(':memory:');
  db.exec(`INSERT INTO source(id,harness,profile,root_path,display_name,detected_at) VALUES
    (1,'codex','test','/synthetic/one','One',0),(2,'hermes','test','/synthetic/two','Two',0);
    INSERT INTO session(id,source_id,native_session_id,project) VALUES
    (1,1,'null',NULL),(2,1,'empty',''),(3,1,'literal','(none)'),(4,2,'other','');`);
  const insert = db.prepare('INSERT INTO usage_event(source_id,session_id,dedup_key,ts,total_tokens,call_count) VALUES (?,?,?,?,?,1)');
  insert.run(1,1,'null',0,1); insert.run(1,null,'sessionless',60_000,2);
  insert.run(1,2,'empty',60_000,3); insert.run(1,3,'literal',90_000,4);
  insert.run(2,4,'other',90_000,5); insert.run(1,2,'upper',120_000,100);
  const app = buildServer(db, new Scheduler(db, [], { pollMs: 1_000_000, detectMs: 1_000_000 }), { port: 0, token: 'project-trends-test', webRoot: '.' });
  const headers = { 'x-quotapulse-token': 'project-trends-test' };
  const get = (extra: string) => app.inject({ url: `/api/projects?detailed=1&from=0&to=120000${extra}`, headers });
  try {
    const legacy = (await get('')).json(); assert.equal(legacy.trends, undefined);
    const enriched = (await get('&trends=1')).json();
    for (const field of ['scope', 'totals', 'groups', 'rows']) assert.deepEqual(enriched[field], legacy[field]);
    assert.equal(enriched.trends.bucketMs, 60_000);
    assert.equal(enriched.trends.points.reduce((sum: number, point: { tokens: number }) => sum + point.tokens, 0), 15);
    for (const group of enriched.groups) {
      assert.equal(enriched.trends.points.filter((point: { project: string | null }) => point.project === group.key)
        .reduce((sum: number, point: { tokens: number }) => sum + point.tokens, 0), group.tokens);
    }
    const scoped = (await get('&trends=1&harness=codex&source_id=1')).json();
    assert.deepEqual(scoped.trends.points, [
      { project: null, start: 0, tokens: 1 }, { project: null, start: 60_000, tokens: 2 },
      { project: '', start: 60_000, tokens: 3 }, { project: '(none)', start: 60_000, tokens: 4 },
    ]);
    const missing = (await get('&trends=1&project_missing=1')).json();
    assert.equal(missing.trends.points.length, 2); assert.ok(missing.trends.points.every((point: { project: unknown }) => point.project === null));
    const empty = (await get('&trends=1&project=')).json();
    assert.deepEqual(empty.trends.points, [{ project: '', start: 60_000, tokens: 8 }]);
    const longRange = (await app.inject({ url: '/api/projects?detailed=1&trends=1&from=0&to=18000000', headers })).json();
    assert.equal(longRange.trends.bucketMs, 600_000);
    assert.equal(Math.ceil((longRange.scope.to - longRange.scope.from) / longRange.trends.bucketMs), 30);
    assert.ok(longRange.trends.points.every((point: { start: number }) => point.start === 0));
    assert.equal(longRange.trends.points.reduce((sum: number, point: { tokens: number }) => sum + point.tokens, 0), 115);
    const noRecords = (await app.inject({ url: '/api/projects?detailed=1&trends=1&from=121000&to=122000', headers })).json();
    assert.deepEqual(noRecords.trends.points, []); assert.equal(noRecords.totals.tokens, 0);
    assert.equal((await get('&trends=invalid')).statusCode, 400);
  } finally { await app.close(); db.close(); }
});
