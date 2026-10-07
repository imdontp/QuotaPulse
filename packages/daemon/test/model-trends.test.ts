import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from '../src/db/index.js';
import { buildServer } from '../src/api/server.js';
import { Scheduler } from '../src/ingest/scheduler.js';

test('model histories reconcile full-grain filtered facts without merging provider identities', async () => {
  const db = openDb(':memory:');
  db.exec(`INSERT INTO source(id,harness,profile,root_path,display_name,detected_at) VALUES
    (1,'codex','test','/synthetic/one','One',0),(2,'hermes','test','/synthetic/two','Two',0),
    (3,'future','test','/synthetic/three','Three',0);
    INSERT INTO session(id,source_id,native_session_id,project) VALUES
    (1,1,'shared','One'),(2,2,'aggregate','Two'),(3,3,'unknown','Three');`);
  const insert = db.prepare(`INSERT INTO usage_event(source_id,session_id,dedup_key,ts,model,provider,total_tokens,call_count,cost_usd,cost_source)
    VALUES (?,?,?,?,?,?,?,?,?,?)`);
  insert.run(1,1,'before',99,'gpt-a','openrouter',1000,1,10,'computed');
  insert.run(1,1,'lower',100,'gpt-a','openrouter',10,1,0.2,'computed');
  insert.run(1,1,'same-session-other-provider',110,'claude-a','anthropic',20,2,5,'native');
  insert.run(1,1,'empty-provider',60_100,'gpt-a','',30,3,0,'estimated');
  insert.run(2,2,'aggregate',60_110,'gpt-a','openrouter',40,4,0.8,'estimated');
  insert.run(3,3,'unknown-grain',60_120,null,null,50,5,null,'unknown');
  insert.run(1,null,'sessionless',120_100,'gpt-a','openrouter',60,6,null,'computed');
  insert.run(1,1,'known-zero',120_110,'gpt-a','openrouter',0,1,0,'computed');
  insert.run(1,1,'upper',180_100,'gpt-a','openrouter',2000,1,20,'computed');
  const app = buildServer(db, new Scheduler(db, [], { pollMs: 1_000_000, detectMs: 1_000_000 }), { port: 0, token: 'model-trends-test', webRoot: '.' });
  const headers = { 'x-quotapulse-token': 'model-trends-test' };
  const get = async (extra = '', from = 100, to = 180_100) => {
    const response = await app.inject({ url: `/api/models?detailed=1&from=${from}&to=${to}${extra}`, headers });
    assert.equal(response.statusCode, 200, response.body);
    return response.json();
  };
  const sum = (rows: Array<Record<string, number>>, key: string) => rows.reduce((total, row) => total + row[key], 0);
  const reconcile = (data: Awaited<ReturnType<typeof get>>) => {
    assert.equal(sum(data.trends.points, 'tokens'), data.totals.tokens);
    assert.equal(sum(data.trends.points, 'calls'), data.totals.calls);
    assert.ok(Math.abs(sum(data.trends.points, 'api_value_usd') - data.totals.api_value_usd) < 1e-12);
    assert.equal(sum(data.trends.points, 'api_priced_calls'), data.totals.computed_calls + data.totals.estimated_calls);
    assert.equal(sum(data.trends.providers, 'tokens'), data.totals.tokens);
    for (const provider of new Set(data.groups.map((group: { provider: string | null }) => group.provider))) {
      assert.equal(sum(data.trends.providers.filter((point: { provider: string | null }) => point.provider === provider), 'tokens'),
        sum(data.groups.filter((group: { provider: string | null }) => group.provider === provider), 'tokens'));
    }
  };
  try {
    const original = await get();
    assert.equal(original.trends, undefined);
    const enriched = await get('&trends=1');
    for (const field of ['scope', 'totals', 'groups', 'rows']) assert.deepEqual(enriched[field], original[field]);
    assert.equal(enriched.trends.bucketMs, 60_000);
    assert.deepEqual(enriched.trends.points, [
      { start: 100, tokens: 30, calls: 3, sessions: 1, pairs: 2, api_value_usd: 0.2, api_priced_calls: 1 },
      { start: 60_100, tokens: 120, calls: 12, sessions: 3, pairs: 3, api_value_usd: 0.8, api_priced_calls: 7 },
      { start: 120_100, tokens: 60, calls: 7, sessions: 1, pairs: 1, api_value_usd: 0, api_priced_calls: 1 },
    ]);
    assert.equal(enriched.totals.sessions, 3);
    assert.equal(sum(enriched.trends.points, 'sessions'), 5); // Sessions span bins/providers.
    assert.equal(enriched.groups.length, 4);
    assert.equal(sum(enriched.trends.points, 'pairs'), 6); // Pairs also recur across bins.
    assert.deepEqual(enriched.trends.providers.filter((point: { provider: unknown }) => point.provider === null), [{ start: 60_100, provider: null, tokens: 50 }]);
    assert.deepEqual(enriched.trends.providers.filter((point: { provider: unknown }) => point.provider === ''), [{ start: 60_100, provider: '', tokens: 30 }]);
    reconcile(enriched);
    for (const [filter, tokens] of [
      ['&source_id=1',120], ['&provider=openrouter',110], ['&vendor=openai',140],
      ['&provider=openrouter&vendor=openai&source_id=1',70],
      ['&grain=call',120], ['&grain=session_aggregate',40], ['&grain=unknown',50],
    ] as const) {
      const scoped = await get(`&trends=1${filter}`);
      assert.equal(scoped.totals.tokens, tokens, filter);
      reconcile(scoped);
    }
    const long = await get('&trends=1', 100, 18_000_100);
    assert.equal(long.trends.bucketMs, 600_000);
    assert.equal(Math.ceil((long.scope.to - long.scope.from) / long.trends.bucketMs), 30);
    reconcile(long);
    const gap = await get('&trends=1&provider=anthropic');
    assert.equal(gap.trends.points.length, 1); // No manufactured observations in later bins.
    const none = await get('&trends=1', 180_101, 180_102);
    assert.deepEqual(none.trends.points, []);
    assert.deepEqual(none.trends.providers, []);
    reconcile(none);
    const zero = await get('&trends=1', 120_110, 120_111);
    assert.equal(zero.trends.points[0].tokens, 0);
    assert.equal(zero.trends.points[0].api_priced_calls, 1);
    assert.equal((await app.inject({ url: '/api/models?detailed=1&trends=invalid', headers })).statusCode, 400);
    assert.equal((await app.inject({ url: '/api/models?detailed=1&trends=1&unexpected=1', headers })).statusCode, 400);
    assert.equal((await app.inject('/api/models?detailed=1&trends=1')).statusCode, 401);
    const legacy = (await app.inject({ url: '/api/models?from=100&to=180100', headers })).json();
    assert.equal(legacy.trends, undefined);
    assert.equal(legacy.totals, undefined);
  } finally { await app.close(); db.close(); }
});
