import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from '../src/db/index.js';
import { buildServer } from '../src/api/server.js';
import { Scheduler } from '../src/ingest/scheduler.js';
import { liveSessions } from '../src/api/live-sessions.js';

test('live session identities and token splits reflect only scoped recorded facts, including mixed and unknown identities', () => {
  const db = openDb(':memory:');
  try {
    db.exec(`INSERT INTO source(id,harness,profile,root_path,display_name,detected_at) VALUES
      (1,'codex','test','/fixture','Fixture',0);
      INSERT INTO session(id,source_id,native_session_id,last_seen_at) VALUES (1,1,'mixed',900),(2,1,'unknown',900);`);
    const add = db.prepare(`INSERT INTO usage_event(source_id,session_id,dedup_key,ts,provider,model,input_tokens,output_tokens,total_tokens,call_count)
      VALUES (1,?,?,?,?,?,?,?,?,?)`);
    add.run(1,'one',800,'openai','first',10,2,12,1);
    add.run(1,'two',810,'anthropic','second',20,3,23,2);
    add.run(1,'partial',820,null,'second',30,4,34,0);
    add.run(1,'outside',2000,'excluded','outside',1000,1000,2000,20);
    add.run(2,'unknown',830,null,null,0,0,0,0);
    db.exec("UPDATE usage_event SET cached_input_tokens=5,cache_write_tokens=7,total_tokens=total_tokens+12 WHERE dedup_key='one'");
    const scope = { from:700,to:1000 };
    const rows = liveSessions(db,scope,1000,'all',{limit:10,offset:0}).rows as any[];
    const mixed = rows.find(row=>row.sessionKey===1)!;
    assert.equal(mixed.provider,null); assert.equal(mixed.providerCount,2); assert.equal(mixed.unknownProviderRecords,1);
    assert.equal(mixed.model,null); assert.equal(mixed.modelCount,2); assert.equal(mixed.unknownModelRecords,0);
    assert.equal(mixed.inputTokens,72); assert.equal(mixed.outputTokens,9); assert.equal(mixed.tokens,81); assert.equal(mixed.calls,3);
    const unknown = rows.find(row=>row.sessionKey===2)!;
    assert.equal(unknown.providerCount,0); assert.equal(unknown.provider,null); assert.equal(unknown.unknownProviderRecords,1);
    assert.equal(unknown.modelCount,0); assert.equal(unknown.model,null); assert.equal(unknown.unknownModelRecords,1);
    const filtered = liveSessions(db,{...scope,model:'second'},1000,'all',{limit:1,offset:0}).rows[0] as any;
    assert.equal(filtered.model,'second'); assert.equal(filtered.modelCount,1);
    assert.equal(filtered.provider,'anthropic'); assert.equal(filtered.providerCount,1); assert.equal(filtered.unknownProviderRecords,1);
    assert.equal(filtered.inputTokens,50); assert.equal(filtered.outputTokens,7); assert.equal(filtered.tokens,57);
    assert.equal(liveSessions(db,scope,1000,'all',{limit:1,offset:1}).rows.length,1);
    assert.equal(liveSessions(db,{from:1001,to:1999},2000,'all',{limit:10,offset:0}).rows.length,0);
  } finally { db.close(); }
});

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

test('live session model maker follows scoped classifications and never guesses across conflicts', () => {
  const db = openDb(':memory:');
  try {
    db.exec(`INSERT INTO source(id,harness,profile,root_path,display_name,detected_at) VALUES (1,'codex','test','/fixture','Fixture',0);`);
    const session = db.prepare('INSERT INTO session(id,source_id,native_session_id,last_seen_at) VALUES (?,1,?,900)');
    for (let id = 1; id <= 6; id++) session.run(id, `model-${id}`);
    const add = db.prepare('INSERT INTO usage_event(source_id,session_id,dedup_key,ts,provider,model,total_tokens,call_count) VALUES (1,?,?,?,?,?,1,1)');
    add.run(1,'known-direct',800,'anthropic','claude-3-7-sonnet');
    add.run(1,'known-gateway',801,'openrouter','claude-3-7-sonnet');
    add.run(2,'unknown-via-gateway',802,'openrouter','mystery-model');
    add.run(3,'conflict-openai',803,'openai','mystery-model');
    add.run(3,'conflict-anthropic',804,'anthropic','mystery-model');
    add.run(4,'multiple-one',805,'openai','gpt-4o');
    add.run(4,'multiple-two',806,'openai','gpt-4.1');
    add.run(5,'missing-model',807,'openai',null);
    add.run(6,'known-partial',808,null,'gpt-4o');
    add.run(6,'unknown-partial',809,'openai',null);
    const scope = { from:700, to:1000 };
    const rows = liveSessions(db, scope, 1000, 'all', {limit:10,offset:0}).rows;
    const vendor = (id: number) => rows.find(row => row.sessionKey === id)!.modelVendor;
    assert.equal(vendor(1), 'anthropic', 'Model family takes precedence over gateway route');
    assert.equal(vendor(2), 'unknown');
    assert.equal(vendor(3), 'unknown', 'Conflicting maker classifications remain unknown');
    assert.equal(vendor(4), 'unknown', 'Multiple models do not receive a single maker');
    assert.equal(vendor(5), 'unknown', 'A provider alone does not badge a missing model');
    assert.equal(vendor(6), 'openai', 'A known model with additional missing records retains its maker and unknown count');
    const partial = rows.find(row => row.sessionKey === 6)!;
    assert.equal(partial.model, 'gpt-4o');
    const filtered = liveSessions(db, {...scope, provider:'openai'}, 1000, 'all', {limit:10,offset:0}).rows;
    assert.equal(filtered.find(row => row.sessionKey === 3)!.modelVendor, 'openai', 'Only records inside the requested scope determine the classification');
    assert.equal(liveSessions(db, scope, 1000, 'all', {limit:2,offset:1}).rows.length, 2);
  } finally { db.close(); }
});
