import { test } from 'node:test';
import assert from 'node:assert/strict';
import { request, maxHeaderSize } from 'node:http';
import { openDb } from '../src/db/index.js';
import { buildServer } from '../src/api/server.js';
import { Scheduler } from '../src/ingest/scheduler.js';
import { modelPairTrends, parseModelPairs, type ModelPair } from '../src/api/model-pair-trends.js';

const pairs: ModelPair[] = [
  { model: 'gpt-a', provider: 'route-a' }, { model: 'gpt-a', provider: 'route-b' },
  { model: null, provider: null }, { model: '', provider: '' },
  { model: 'Unknown', provider: 'Unknown' }, { model: "x'); DROP TABLE usage_event;--", provider: ' route ' },
  { model: 'Gpt-a', provider: 'route-a' }, { model: null, provider: '' }, { model: '', provider: null },
];
function fixture() {
  const db = openDb(':memory:');
  db.exec(`INSERT INTO source(id,harness,profile,root_path,display_name,detected_at) VALUES
    (1,'codex','test','/synthetic/one','One',0),(2,'hermes','test','/synthetic/two','Two',0),
    (3,'future','test','/synthetic/three','Three',0);
    INSERT INTO session(id,source_id,native_session_id,project) VALUES
    (1,1,'shared','One'),(2,2,'aggregate','Two'),(3,3,'unknown',NULL),(4,1,'empty','');`);
  const insert = db.prepare(`INSERT INTO usage_event(source_id,session_id,dedup_key,ts,model,provider,total_tokens,call_count)
    VALUES (?,?,?,?,?,?,?,?)`);
  insert.run(1,1,'before',99,'gpt-a','route-a',1000,1);
  insert.run(1,1,'lower',100,'gpt-a','route-a',10,2);
  insert.run(1,1,'next-bin',60_100,'gpt-a','route-a',20,3);
  insert.run(2,2,'aggregate',60_110,'gpt-a','route-a',30,7);
  insert.run(3,3,'unknown-grain',120_100,'gpt-a','route-a',40,5);
  insert.run(1,null,'sessionless',120_110,'gpt-a','route-a',0,1);
  insert.run(1,4,'empty-project',120_120,'gpt-a','route-a',50,1);
  insert.run(1,1,'upper',180_100,'gpt-a','route-a',2000,1);
  pairs.slice(1).forEach((pair, i) => insert.run(1,1,`identity-${i}`,100,pair.model,pair.provider,i+1,i+2));
  const app = buildServer(db, new Scheduler(db, [], { pollMs: 1_000_000, detectMs: 1_000_000 }), { port: 0, token: 'pair-test', webRoot: '.' });
  const headers = { 'x-quotapulse-token': 'pair-test' };
  const get = async (selected = pairs, extra = '', from = 100, to = 180_100) => {
    const response = await app.inject({ url: `/api/model-trends?from=${from}&to=${to}&pairs=${encodeURIComponent(JSON.stringify(selected))}${extra}`, headers });
    assert.equal(response.statusCode, 200, response.body);
    return response.json();
  };
  return { db, app, headers, get, close: async () => { await app.close(); db.close(); } };
}

test('exact model/provider batch preserves requested order, NULL, empty, case and malicious text', async () => {
  const f = fixture();
  try {
    const data = await f.get([...pairs].reverse().concat(pairs[0]));
    assert.deepEqual(data.pairs.map(({ model, provider }: ModelPair) => ({ model, provider })), [...pairs].reverse());
    assert.deepEqual(data.scope, { from: 100, to: 180_100 });
    assert.equal(typeof data.now, 'number');
    assert.equal(data.bucketMs, 60_000);
    const rows = (await f.get()).pairs;
    assert.deepEqual(rows[0].points, [
      { start: 100, tokens: 10, calls: 2, records: 1 },
      { start: 60_100, tokens: 50, calls: 10, records: 2 },
      { start: 120_100, tokens: 90, calls: 7, records: 3 },
    ]);
    rows.slice(1).forEach((row: { points: unknown }, i: number) => assert.deepEqual(row.points, [{ start: 100, tokens: i+1, calls: i+2, records: 1 }]));
    assert.equal((f.db.prepare('SELECT COUNT(*) AS n FROM usage_event').get() as { n: number }).n, 16);
    const unknown = await f.get([{ model: 'absent', provider: null }]);
    assert.deepEqual(unknown.pairs[0].points, []);
    assert.deepEqual((await f.get(pairs, '', 180_101, 180_102)).pairs.map((row: { points: unknown }) => row.points), pairs.map(() => []));
    assert.deepEqual((await f.get([pairs[0]], '', 120_110, 120_111)).pairs[0].points, [{ start: 120_110, tokens: 0, calls: 1, records: 1 }]);
  } finally { await f.close(); }
});

test('batch sparse bins match existing detail for every exact identity, grain and bucket span', async () => {
  const f = fixture();
  try {
    for (const to of [180_100, 18_000_100]) {
      for (const grain of ['all', 'call', 'session_aggregate', 'unknown']) {
        const data = await f.get(pairs, `&grain=${grain}`, 100, to);
        assert.equal(data.bucketMs, to === 180_100 ? 60_000 : 600_000);
        for (const pair of data.pairs) {
          const query = new URLSearchParams({ from: '100', to: String(to), grain });
          for (const key of ['model', 'provider'] as const) {
            if (pair[key] === null) query.set(`${key}_missing`, '1');
            else if (pair[key] === '') query.set(`${key}_empty`, '1');
            else query.set(key, pair[key]);
          }
          const detail = await f.app.inject({ url: `/api/model-detail?${query}`, headers: f.headers });
          assert.equal(detail.statusCode, 200, detail.body);
          assert.equal(detail.json().bucketMs, data.bucketMs);
          assert.deepEqual(pair.points, detail.json().points);
        }
      }
    }
  } finally { await f.close(); }
});

test('batch shares source, session, project, search, provider, vendor, model and grain scope predicates', async () => {
  const f = fixture();
  try {
    for (const [filter, tokens] of [
      ['source_id=1',80], ['session_id=1',30], ['project=One',30], ['project=Two',30],
      ['project=',50], ['project_missing=1',40], ['harness=hermes',30], ['provider=route-a',150],
      ['vendor=openai',150], ['model=gpt-a',150], ['q=aggregate',30], ['grain=call',80],
      ['grain=session_aggregate',30], ['grain=unknown',40], ['source_id=1&project=One&model=gpt-a',30],
    ] as const) {
      const data = await f.get([pairs[0]], `&${filter}`);
      assert.equal(data.pairs[0].points.reduce((sum: number, point: { tokens: number }) => sum + point.tokens, 0), tokens, filter);
    }
  } finally { await f.close(); }
});

test('batch authenticates and rejects malformed, missing, excessive and ambiguous query input', async () => {
  const f = fixture();
  try {
    const valid = encodeURIComponent(JSON.stringify([pairs[0]]));
    assert.equal((await f.app.inject(`/api/model-trends?from=100&to=200&pairs=${valid}`)).statusCode, 401);
    for (const raw of ['{', 'null', '{}', '[]', '[null]', '[[]]', '[{}]', '[{"model":"a"}]',
      '[{"model":"a","provider":1}]', '[{"model":false,"provider":null}]',
      '[{"model":"a","provider":null,"extra":1}]',
      JSON.stringify([{ model: 'a'.repeat(4097), provider: null }]), JSON.stringify(Array(21).fill(pairs[0])),
      JSON.stringify(Array(20).fill({ model: '界'.repeat(4096), provider: '界'.repeat(4096) })),
    ]) {
      const response = await f.app.inject({ url: `/api/model-trends?from=100&to=200&pairs=${encodeURIComponent(raw)}`, headers: f.headers });
      assert.equal(response.statusCode, 400, raw.slice(0,100));
    }
    for (const query of ['from=100&to=200', `pairs=${valid}`, `from=200&to=100&pairs=${valid}`,
      `from=100&to=200&pairs=${valid}&unexpected=1`, `from=100&to=200&pairs=${valid}&pairs=${valid}`,
      `from=100&to=200&pairs=${valid}&grain=invalid`, `from=100&to=200&pairs=${valid}&source_id=0`,
    ]) assert.equal((await f.app.inject({ url: `/api/model-trends?${query}`, headers: f.headers })).statusCode, 400, query);
    assert.equal((await f.get(Array.from({ length: 20 }, (_, i) => ({ model: `absent${i}`, provider: null })))).pairs.length, 20);
    assert.deepEqual(parseModelPairs(JSON.stringify([pairs[0], pairs[0]])), [pairs[0]]);
  } finally { await f.close(); }
});

test('twenty exact pairs use one parameterized grouped read and existing model/time index', () => {
  const db = openDb(':memory:');
  const original = db.prepare.bind(db);
  const statements: string[] = [];
  let plan: Array<{ detail: string }> = [];
  db.prepare = ((sql: string) => {
    statements.push(sql);
    const statement = original(sql);
    const all = statement.all.bind(statement);
    statement.all = ((params: unknown) => {
      plan = original(`EXPLAIN QUERY PLAN ${sql}`).all(params) as Array<{ detail: string }>;
      return all(params);
    }) as typeof statement.all;
    return statement;
  }) as typeof db.prepare;
  try {
    const selected = Array.from({ length: 20 }, (_, i) => ({ model: `m${i}`, provider: i === 0 ? "');--" : null }));
    const result = modelPairTrends(db, { from: 100, to: 180_100 }, selected);
    assert.equal(statements.length, 1);
    assert.ok(!statements[0].includes("');--"));
    assert.equal(result.pairs.length, 20);
    assert.ok(result.pairs.every(pair => pair.points.length === 0));
    assert.ok(plan.some(row => row.detail.includes('idx_usage_model_ts')), JSON.stringify(plan));
    assert.ok(plan.some(row => row.detail.includes('GROUP BY')), JSON.stringify(plan)); // Grouping still needs temporary work.
  } finally { db.close(); }
});


test('maximum visible window returns every observed bin for twenty pairs without leaking an unrequested pair', () => {
  const db = openDb(':memory:');
  try {
    db.exec(`INSERT INTO source(id,harness,profile,root_path,display_name,detected_at)
      VALUES (1,'codex','test','/synthetic/window','Window',0)`);
    const selected = Array.from({ length: 20 }, (_, index) => ({ model: `model-${index}`, provider: index % 2 ? null : '' }));
    const insert = db.prepare(`INSERT INTO usage_event(source_id,dedup_key,ts,model,provider,total_tokens,call_count)
      VALUES (1,?,?,?,?,?,?)`);
    db.transaction(() => {
      for (const [index, pair] of selected.entries()) {
        for (let bin = 0; bin < 30; bin++) {
          insert.run(`${index}-${bin}`, 100 + bin * 60_000, pair.model, pair.provider, index + bin, 2);
        }
      }
      insert.run('not-requested', 100, 'not-requested', null, 99999, 99999);
    })();
    const result = modelPairTrends(db, { from: 100, to: 1_800_100 }, selected);
    assert.equal(result.bucketMs, 60_000);
    assert.equal(result.pairs.length, 20);
    for (const [index, pair] of result.pairs.entries()) {
      assert.deepEqual({ model: pair.model, provider: pair.provider }, selected[index]);
      assert.deepEqual(pair.points, Array.from({ length: 30 }, (_, bin) => ({
        start: 100 + bin * 60_000, tokens: index + bin, calls: 2, records: 1,
      })));
    }
  } finally { db.close(); }
});


test('read-only POST transports twenty maximum-length exact pairs over actual HTTP without changing header limits or stored facts', async () => {
  const f = fixture();
  try {
    const selected = Array.from({ length: 20 }, (_, index) => ({
      model: `m${index.toString().padStart(2, '0')}${'a'.repeat(4093)}`,
      provider: `p${index.toString().padStart(2, '0')}${'b'.repeat(4093)}`,
    }));
    const insert = f.db.prepare(`INSERT INTO usage_event(source_id,session_id,dedup_key,ts,model,provider,total_tokens,call_count)
      VALUES (1,1,?,100,?,?,?,?)`);
    selected.forEach((pair, index) => insert.run(`long-${index}`, pair.model, pair.provider, index + 1, index + 2));
    const snapshot = () => ({
      changes: f.db.prepare('SELECT total_changes() AS n').get(),
      rows: f.db.prepare('SELECT * FROM usage_event ORDER BY id').all(),
    });
    const before = snapshot();
    const address = await f.app.listen({ port: 0, host: '127.0.0.1' });
    const send = (method: 'GET' | 'POST', path: string, body?: string, authenticated = true, isolatedConnection = false) => new Promise<{ status: number; body: string }>((resolve, reject) => {
      const call = request(`${address}${path}`, { method, agent: isolatedConnection ? false : undefined, headers: {
        ...(authenticated ? f.headers : {}),
        ...(body === undefined ? {} : { 'content-type': 'application/json', 'content-length': Buffer.byteLength(body) }),
      } }, response => {
        const chunks: Buffer[] = [];
        response.on('data', chunk => chunks.push(Buffer.from(chunk)));
        response.on('error', error => {
          error.message = `${method} URI-bytes=${Buffer.byteLength(path)} body-bytes=${body === undefined ? 0 : Buffer.byteLength(body)} response reusedSocket=${call.reusedSocket}: ${error.message}`;
          reject(error);
        });
        response.on('end', () => resolve({ status: response.statusCode!, body: Buffer.concat(chunks).toString('utf8') }));
      });
      call.on('error', error => {
        error.message = `${method} URI-bytes=${Buffer.byteLength(path)} body-bytes=${body === undefined ? 0 : Buffer.byteLength(body)} request reusedSocket=${call.reusedSocket}: ${error.message}`;
        reject(error);
      });
      call.end(body);
    });
    const base = '/api/model-trends?from=100&to=180100';
    const oversizedGet = `${base}&pairs=${encodeURIComponent(JSON.stringify(selected))}`;
    assert.ok(Buffer.byteLength(oversizedGet) > maxHeaderSize);
    // Windows may close the socket while Node is still writing the oversized header;
    // either the parser's 431 or that transport rejection proves it cannot reach this route.
    let oversizedResult: { status: number; body: string } | undefined;
    // Keep the deliberately parser-rejected connection out of the normal keep-alive pool:
    // its closing socket can otherwise be reused by the first valid POST before close arrives.
    // Successful POST/GET requests below still use the normal persistent agent and must succeed.
    try { oversizedResult = await send('GET', oversizedGet, undefined, true, true); }
    catch (error) { assert.ok(['ECONNABORTED', 'ECONNRESET', 'EPIPE'].includes((error as NodeJS.ErrnoException).code ?? ''), String(error)); }
    if (oversizedResult) assert.equal(oversizedResult.status, 431);
    const posted = await send('POST', base, JSON.stringify({ pairs: selected }));
    assert.equal(posted.status, 200, posted.body);
    const data = JSON.parse(posted.body);
    assert.deepEqual(data.scope, { from: 100, to: 180100 });
    assert.equal(data.bucketMs, 60000);
    assert.deepEqual(data.pairs, selected.map((pair, index) => ({ ...pair,
      points: [{ start: 100, tokens: index + 1, calls: index + 2, records: 1 }],
    })));
    const smallGet = await send('GET', `${base}&pairs=${encodeURIComponent(JSON.stringify(pairs))}`);
    const smallPost = await send('POST', base, JSON.stringify({ pairs }));
    assert.equal(smallGet.status, 200);
    assert.equal(smallPost.status, 200);
    const { now: getNow, ...got } = JSON.parse(smallGet.body);
    const { now: postNow, ...post } = JSON.parse(smallPost.body);
    assert.equal(typeof getNow, 'number');
    assert.equal(typeof postNow, 'number');
    assert.deepEqual(post, got);
    assert.equal((await send('POST', base, JSON.stringify({ pairs }), false)).status, 401);
    for (const bad of ['null', '[]', '{}', '{', JSON.stringify({ pairs, from: 100 }),
      JSON.stringify({ pairs: [] }), JSON.stringify({ pairs: Array(21).fill(pairs[0]) }),
      JSON.stringify({ pairs: [{ model: 1, provider: null }] }),
      JSON.stringify({ pairs: [{ model: 'a'.repeat(4097), provider: null }] }),
      JSON.stringify({ pairs: Array(20).fill({ model: '\u4e00'.repeat(4096), provider: '\u4e00'.repeat(4096) }) }),
    ]) assert.equal((await send('POST', base, bad)).status, 400, bad.slice(0,100));
    for (const query of ['', '?from=200&to=100', '?from=100&to=200&pairs=[]', '?from=100&to=200&extra=1']) {
      assert.equal((await send('POST', `/api/model-trends${query}`, JSON.stringify({ pairs }))).status, 400, query);
    }
    assert.deepEqual(snapshot(), before);
  } finally { await f.close(); }
});
