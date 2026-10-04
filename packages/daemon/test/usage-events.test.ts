import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from '../src/db/index.js';
import { buildServer } from '../src/api/server.js';
import { Scheduler } from '../src/ingest/scheduler.js';

test('usage-events and CSV share exact scope, grain and complete pagination', async t => {
  const db = openDb(':memory:');
  for (const [index, harness] of ['codex', 'hermes', 'future-adapter', 'claude-code'].entries()) {
    db.prepare(`INSERT INTO source(id,harness,profile,root_path,display_name,detected_at)
      VALUES (?,?,'default','/private/credentials','Reader_' || ?,0)`).run(index + 1, harness, index + 1);
    db.prepare(`INSERT INTO session(id,source_id,native_session_id,project,cwd)
      VALUES (?,?,'native-' || ?,?,'/private/workspace')`).run(index + 1, index + 1, index + 1, index === 1 ? null : index === 2 ? '' : 'project_100%');
  }
  const insert = db.prepare(`INSERT INTO usage_event(source_id,session_id,dedup_key,ts,model,provider,total_tokens,call_count,request_id,native_msg_id)
    VALUES (?,?,?,?,?,?,10,?, 'private-request', 'private-message')`);
  insert.run(1, 1, 'one', 100, 'gpt-test', 'openrouter', 1);
  insert.run(2, 2, 'two', 100, 'claude-test', 'anthropic', 15);
  insert.run(3, 3, 'three', 100, 'new-model', 'new-provider', 1);
  insert.run(4, 4, 'four', 200, 'claude-test', 'anthropic', 1);
  const app = buildServer(db, new Scheduler(db, [], { pollMs: 1_000_000, detectMs: 1_000_000 }), { port: 0, token: 'test-events', webRoot: '.' });
  const headers = { 'x-quotapulse-token': 'test-events' };
  const get = (query = '') => app.inject({ url: '/api/usage-events?from=0&to=200' + query, headers });
  try {
    await t.test('stable tie order, boundaries, record total, safe allowlist and authentication', async () => {
      const response = await get('&limit=2');
      assert.equal(response.statusCode, 200);
      const body = response.json();
      assert.equal(body.total, 3);
      assert.deepEqual(body.rows.map((row: { event_id: number }) => row.event_id), [3, 2]);
      assert.deepEqual(body.rows.map((row: { grain: string }) => row.grain), ['unknown', 'session_aggregate']);
      assert.equal(body.rows[1].call_count, 15);
      assert.equal(body.scope.from, 0);
      assert.equal(typeof body.now, 'number');
      for (const field of ['root_path', 'cwd', 'request_id', 'native_msg_id', 'dedup_key', 'native_session_id']) assert.equal(field in body.rows[0], false);
      assert.equal(response.body.includes('/private/'), false);
      assert.equal((await app.inject('/api/usage-events')).statusCode, 401);
      assert.deepEqual((await get('&offset=2')).json().rows.map((row: { event_id: number }) => row.event_id), [1]);
      assert.equal((await get('&offset=9')).json().rows.length, 0);
    });
    await t.test('literal substring, missing project, route/provider vs model vendor and shared CSV filters', async () => {
      const cases = [
        ['&q=%25', [1]], ['&q=_', [3, 2, 1]], ['&q=native-2', [2]],
        ['&project=project_100%25', [1]], ['&project_missing=1', [2]],
        ['&provider=openrouter&vendor=openai', [1]], ['&provider=openai', []],
        ['&harness=hermes&grain=session_aggregate', [2]], ['&grain=call', [1]],
        ['&grain=unknown', [3]], ['&source_id=1&model=gpt-test', [1]],
        ['&session_id=1', [1]],
        ['&q=%27%20OR%201%3D1--', []],
      ] as const;
      for (const [scope, ids] of cases) {
        const response = await get(scope);
        assert.equal(response.statusCode, 200, scope);
        assert.deepEqual(response.json().rows.map((row: { event_id: number }) => row.event_id), ids, scope);
        const csv = await app.inject({ url: '/api/export/usage?from=0&to=200&order=desc&include_grain=1' + scope, headers });
        assert.equal(csv.statusCode, 200, scope);
        const lines = csv.body.replace(/^\uFEFF/, '').trimEnd().split('\r\n');
        assert.match(lines[0]!, /,grain$/);
        assert.deepEqual(lines.slice(1).map(line => Number(line.split(',')[0])), ids, scope);
      }
    });
    await t.test('invalid supplied values fail rather than silently changing query meaning', async () => {
      for (const query of ['limit=0', 'limit=501', 'limit=1.1', 'offset=-1', 'source_id=0', 'source_id=', 'session_id=0', 'session_id=x', 'grain=live', 'project_missing=0', 'project_missing=1&project=x', 'unknown=x', 'q=', 'q=a&q=b', 'from=1&from=2', 'from=200&to=100', 'to=999999999999999999']) {
        const response = await app.inject({ url: '/api/usage-events?' + query, headers });
        assert.equal(response.statusCode, 400, query);
      }
      assert.equal((await app.inject({ url: '/api/export/usage?from=0&to=200&order=bad', headers })).statusCode, 400);
    });
    await t.test('aggregate replacement retains event identity and count', async () => {
      db.prepare('UPDATE usage_event SET total_tokens=999, ts=150 WHERE id=2').run();
      const response = (await get('&grain=session_aggregate')).json();
      assert.equal(response.total, 1);
      assert.equal(response.rows[0].event_id, 2);
      assert.equal(response.rows[0].total_tokens, 999);
    });
    await t.test('minute trend includes only declared call adapters and reports exclusions under the same filters', async () => {
      const response = await app.inject({ url: '/api/trend?bucket=minute&from=0&to=200&group_by=provider', headers });
      assert.equal(response.statusCode, 200);
      const body = response.json();
      assert.equal(body.measurement, 'recorded_tokens_per_minute');
      assert.equal(body.rows.length, 1);
      assert.equal(body.rows[0].bucket_ts, 0);
      assert.equal(body.rows[0].series, 'openrouter');
      assert.equal(body.rows[0].total_tokens, 10);
      assert.equal(body.coverage.includedRecords, 1);
      assert.equal(body.coverage.excludedRecords, 2);
      assert.equal(body.coverage.excludedCalls, 16);
      assert.equal(body.coverage.excludedSources[0].last_observed_tokens, 999);
      assert.equal(body.coverage.excludedSources[1].grain, 'unknown');
      const scoped = (await app.inject({ url: '/api/trend?bucket=minute&from=0&to=200&provider=openrouter', headers })).json();
      assert.equal(scoped.coverage.excludedRecords, 0);
      const aggregate = (await app.inject({ url: '/api/trend?bucket=minute&from=0&to=200&grain=session_aggregate', headers })).json();
      assert.equal(aggregate.rows.length, 0);
      assert.equal(aggregate.coverage.excludedRecords, 1);
      for (const query of ['from=0&to=86400001', 'group_by=made-up', 'to=bad', 'from=0&to=200&q=']) {
        assert.equal((await app.inject({ url: '/api/trend?bucket=minute&' + query, headers })).statusCode, 400, query);
      }
      const defaults = (await app.inject({ url: '/api/trend?bucket=minute', headers })).json();
      assert.equal(defaults.to - defaults.from, 30 * 60000);
      insert.run(1, 1, 'boundary-left', 59999, 'boundary-model', 'openai', 1);
      insert.run(1, 1, 'boundary-right', 60000, 'boundary-model', 'openai', 1);
      const boundary = (await app.inject({ url: '/api/trend?bucket=minute&from=59999&to=60001&model=boundary-model', headers })).json();
      assert.deepEqual(boundary.rows.map((row: { bucket_ts: number }) => row.bucket_ts), [0, 60000]);
    });
    await t.test('CSV keeps literal metadata inert when opened in spreadsheet software', async () => {
      db.prepare("UPDATE session SET project='=1+1' WHERE id=1").run();
      const response = await app.inject({ url: '/api/export/usage?from=0&to=200&project=%3D1%2B1', headers });
      assert.equal(response.statusCode, 200);
      assert.match(response.body, /,'=1\+1,/);
      assert.equal((await get('&project=%3D1%2B1')).json().rows[0].project, '=1+1');
      db.prepare("UPDATE session SET project='project_100%' WHERE id=1").run();
    });
    await t.test('runtime nodes and edges conserve scoped tokens and count sessions distinctly', async () => {
      insert.run(1, 1, 'second-model-same-session', 150, 'other-model', 'openrouter', 1);
      db.prepare(`UPDATE usage_event SET input_tokens=4,cached_input_tokens=5,cache_write_tokens=1,
        cost_usd=0.2,cost_source='computed',cost_cache_saving_usd=0.01 WHERE id=1`).run();
      const response = await app.inject({ url: '/api/runtime-map?from=0&to=200', headers });
      assert.equal(response.statusCode, 200);
      const body = response.json();
      assert.equal(body.totals.records, 4);
      assert.equal(body.totals.sessions, 3);
      assert.equal(body.totals.tokens, 1029);
      assert.equal(body.totals.aggregateRecords, 1);
      assert.equal(body.totals.inputTokens + body.totals.cachedInputTokens + body.totals.cacheWriteTokens, 10);
      assert.equal(body.totals.cacheSavingKnownCalls, 1);
      assert.equal(body.totals.cacheSavingKnownUsd, 0.01);
      assert.equal(body.nodes.project.find((node: { key: string }) => node.key === 'project_100%').sessions, 1);
      assert.equal(body.nodes.model.filter((node: { key: string }) => ['gpt-test', 'other-model'].includes(node.key)).reduce((sum: number, node: { sessions: number }) => sum + node.sessions, 0), 2);
      for (const dimension of ['project', 'harness', 'provider', 'model']) {
        assert.equal(body.nodes[dimension].reduce((sum: number, node: { tokens: number }) => sum + node.tokens, 0), body.totals.tokens, dimension);
      }
      for (const column of [0, 1, 2]) assert.equal(body.edges.filter((edge: { column: number }) => edge.column === column).reduce((sum: number, edge: { tokens: number }) => sum + edge.tokens, 0), body.totals.tokens);
      assert.equal((await app.inject({ url: '/api/runtime-map?from=0&to=200&project_missing=1', headers })).json().totals.records, 1);
      assert.equal((await app.inject({ url: '/api/runtime-map?from=0&to=200&provider=openrouter', headers })).json().totals.sessions, 1);
      assert.equal((await app.inject('/api/runtime-map')).statusCode, 401);
      assert.equal((await app.inject({ url: '/api/runtime-map?project_missing=0', headers })).statusCode, 400);
    });
    await t.test('runtime model makers follow names across routes; unknown groups stay unbranded', async () => {
      const cases = [
        ['gpt-test', 'anthropic'], ['gpt-test', 'openrouter'],
        ['claude-test', 'openai'], ['deepseek-test', 'openrouter'],
        ['unidentified-alias', 'openai'], ['unidentified-alias', 'anthropic'],
        [null, 'openai'], ['', 'anthropic'],
      ] as const;
      cases.forEach(([model, provider], index) => insert.run(1, 1, `maker-${index}`, 300000, model, provider, 1));
      const response = await app.inject({ url: '/api/runtime-map?from=300000&to=300001', headers });
      assert.equal(response.statusCode, 200);
      const graph = response.json();
      assert.equal(graph.totals.tokens, 80);
      assert.equal(graph.totals.records, 8);
      assert.equal(graph.totals.sessions, 1);
      assert.deepEqual(graph.nodes.model.map((node: { key: string | null; vendor?: string }) => [node.key, node.vendor ?? null]), [
        ['gpt-test', 'openai'], ['unidentified-alias', null],
        [null, null], ['', null], ['claude-test', 'anthropic'], ['deepseek-test', 'deepseek'],
      ]);
      const filtered = (await app.inject({ url: '/api/runtime-map?from=300000&to=300001&provider=anthropic', headers })).json();
      assert.equal(filtered.nodes.model.find((node: { key: string }) => node.key === 'gpt-test').vendor, 'openai');
      for (const dimension of ['project', 'harness', 'provider', 'model'])
        assert.equal(graph.nodes[dimension].reduce((sum: number, node: { tokens: number }) => sum + node.tokens, 0), 80);
      for (const column of [0, 1, 2]) assert.equal(graph.edges.filter((edge: { column: number }) => edge.column === column).reduce((sum: number, edge: { tokens: number }) => sum + edge.tokens, 0), 80);
      for (const dimension of ['project', 'harness', 'provider']) assert.ok(graph.nodes[dimension].every((node: object) => !('vendor' in node)));
    });
    await t.test('pagination and whole-range export exceed the old 2000-row detail cap', async () => {
      db.transaction(() => { for (let index = 0; index < 2005; index++) insert.run(1, 1, `bulk-${index}`, 101, 'bulk-model', 'openai', 1); })();
      const response = (await get('&model=bulk-model&offset=2000&limit=500')).json();
      assert.equal(response.total, 2005);
      assert.equal(response.rows.length, 5);
      const csv = await app.inject({ url: '/api/export/usage?from=0&to=200&model=bulk-model&order=desc', headers });
      assert.equal(csv.body.trimEnd().split('\r\n').length, 2006);
    });
  } finally { await app.close(); db.close(); }
});
