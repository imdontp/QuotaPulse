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
    await t.test('provider/model minutes preserve exact identities, sparse call values and all-grain window coverage', async () => {
      const from = 600000;
      const to = 780000;
      type Pair = { provider: string | null; model: string | null };
      type Fixture = Pair & { sourceId: number; at: number; tokens: number; calls: number };
      type Row = Pair & { series: string; bucket_ts: number; records: number; calls: number; total_tokens: number;
        input_tokens: number; cached_input_tokens: number; cache_write_tokens: number; output_tokens: number };
      type Group = Pair & { tokens: number; records: number; calls: number; callRecords: number; aggregateRecords: number; unknownRecords: number };
      type Response = { groupBy: string; measurement: string; rows: Row[]; groups: Group[];
        coverage: { includedRecords: number; includedCalls: number; excludedRecords: number; excludedCalls: number;
          excludedSources: Array<{ source_id: number; grain: string; records: number; calls: number; last_observed_tokens: number }> } };
      const pairKey = (pair: Pair) => JSON.stringify([pair.provider, pair.model]);
      const fixtures: Fixture[] = [];
      const add = db.prepare(`INSERT INTO usage_event(source_id,session_id,dedup_key,ts,provider,model,
        input_tokens,output_tokens,total_tokens,call_count) VALUES (?,?,?,?,?,?,?,?,?,?)`);
      const record = (sourceId: number, at: number, provider: string | null, model: string | null, tokens: number, calls = 1) => {
        add.run(sourceId, sourceId, `minute-pair-${fixtures.length}`, at, provider, model,
          Math.floor(tokens / 2), tokens - Math.floor(tokens / 2), tokens, calls);
        fixtures.push({ sourceId, at, provider, model, tokens, calls });
      };
      const identities = [
        [null, null], ['', null], [null, ''], ['', ''], ['(unknown)', '(unknown)'],
        [null, 'x'], ['null', 'x'], ['a/b', 'c'], ['a', 'b/c'], ['a|b', 'c'], ['a', 'b|c'],
        ['route|"quoted"', '模型/ไทย😀\n%_'], [' provider ', ' model '],
        ['openrouter', 'gpt-shared'], ['openai', 'gpt-shared'],
      ] as const;
      identities.forEach(([provider, model], index) => {
        record(1, from + 100 + index, provider, model, index + 1, index % 3 + 1);
        record(2, from + 200 + index, provider, model, 200 + index, 10);
        record(3, from + 300 + index, provider, model, 300 + index, 2);
      });
      record(1, from + 60000, 'zero-provider', 'zero-model', 0);
      record(2, from + 60050, 'aggregate-provider', 'aggregate-model', 1000, 9);
      record(3, from + 60060, 'unknown-provider', 'unknown-model', 500, 3);
      record(1, from + 59999, 'openai', 'gpt-shared', 11);
      record(1, from + 60000, 'openai', 'gpt-shared', 13, 2);
      record(1, from - 1, 'outside-provider', 'outside-before', 10000);
      record(1, to, 'outside-provider', 'outside-after', 10000);
      const scopedFixtures = fixtures.filter(row => row.at >= from && row.at < to);
      const request = (query = '', grouping = 'provider_model') => app.inject({
        url: `/api/trend?bucket=minute&from=${from}&to=${to}&group_by=${grouping}${query}`, headers,
      });
      const scopes = [
        { query: '', matches: (_row: Fixture) => true },
        { query: '&provider=openai', matches: (row: Fixture) => row.provider === 'openai' },
        { query: '&model=gpt-shared', matches: (row: Fixture) => row.model === 'gpt-shared' },
        { query: '&provider=openai&model=gpt-shared', matches: (row: Fixture) => row.provider === 'openai' && row.model === 'gpt-shared' },
        { query: '&q=gpt', matches: (row: Fixture) => row.model?.includes('gpt') === true },
        { query: '&q=%25', matches: (row: Fixture) => row.model?.includes('%') === true || row.sourceId === 1 },
        { query: '&source_id=2', matches: (row: Fixture) => row.sourceId === 2 },
        { query: '&project_missing=1', matches: (row: Fixture) => row.sourceId === 2 },
        { query: '&harness=future-adapter', matches: (row: Fixture) => row.sourceId === 3 },
        { query: '&grain=call', matches: (row: Fixture) => row.sourceId === 1 },
        { query: '&grain=session_aggregate', matches: (row: Fixture) => row.sourceId === 2 },
        { query: '&grain=unknown', matches: (row: Fixture) => row.sourceId === 3 },
        { query: '&provider=openai&grain=session_aggregate', matches: (row: Fixture) => row.provider === 'openai' && row.sourceId === 2 },
        { query: '&model=missing-model', matches: (_row: Fixture) => false },
      ];
      for (const scope of scopes) {
        const response = await request(scope.query);
        assert.equal(response.statusCode, 200, scope.query);
        const body = response.json<Response>();
        assert.equal(body.groupBy, 'provider_model');
        assert.equal(body.measurement, 'recorded_tokens_per_minute');
        const expected = scopedFixtures.filter(scope.matches);
        const calls = expected.filter(row => row.sourceId === 1);
        const excluded = expected.filter(row => row.sourceId !== 1);
        const expectedGroups = new Map<string, Group>();
        const expectedRows = new Map<string, Row>();
        for (const fixture of expected) {
          const key = pairKey(fixture);
          const group = expectedGroups.get(key) ?? { provider: fixture.provider, model: fixture.model,
            tokens: 0, records: 0, calls: 0, callRecords: 0, aggregateRecords: 0, unknownRecords: 0 };
          group.tokens += fixture.tokens; group.records++; group.calls += fixture.calls;
          if (fixture.sourceId === 1) group.callRecords++;
          else if (fixture.sourceId === 2) group.aggregateRecords++;
          else group.unknownRecords++;
          expectedGroups.set(key, group);
          if (fixture.sourceId === 1) {
            const at = Math.floor(fixture.at / 60000) * 60000;
            const cellKey = JSON.stringify([at, fixture.provider, fixture.model]);
            const row = expectedRows.get(cellKey) ?? { provider: fixture.provider, model: fixture.model,
              series: key, bucket_ts: at, records: 0, calls: 0, total_tokens: 0,
              input_tokens: 0, cached_input_tokens: 0, cache_write_tokens: 0, output_tokens: 0 };
            row.records++; row.calls += fixture.calls; row.total_tokens += fixture.tokens;
            row.input_tokens += Math.floor(fixture.tokens / 2);
            row.output_tokens += fixture.tokens - Math.floor(fixture.tokens / 2);
            expectedRows.set(cellKey, row);
          }
        }
        assert.equal(body.groups.length, expectedGroups.size, scope.query);
        assert.equal(new Set(body.groups.map(pairKey)).size, body.groups.length, scope.query);
        for (const group of body.groups) {
          assert.deepEqual(group, expectedGroups.get(pairKey(group)), scope.query);
          assert.equal(group.callRecords + group.aggregateRecords + group.unknownRecords, group.records);
        }
        assert.ok(body.groups.every((group, index) => index === 0 || group.tokens <= body.groups[index - 1]!.tokens));
        assert.equal(body.rows.length, expectedRows.size, scope.query);
        assert.equal(new Set(body.rows.map(row => JSON.stringify([row.bucket_ts, row.provider, row.model]))).size, body.rows.length);
        for (const row of body.rows) assert.deepEqual(row, expectedRows.get(JSON.stringify([row.bucket_ts, row.provider, row.model])), scope.query);
        assert.equal(body.coverage.includedRecords, calls.length, scope.query);
        assert.equal(body.coverage.includedCalls, calls.reduce((sum, row) => sum + row.calls, 0), scope.query);
        assert.equal(body.coverage.excludedRecords, excluded.length, scope.query);
        assert.equal(body.coverage.excludedCalls, excluded.reduce((sum, row) => sum + row.calls, 0), scope.query);
        for (const source of body.coverage.excludedSources) {
          const records = excluded.filter(row => row.sourceId === source.source_id);
          assert.equal(source.grain, source.source_id === 2 ? 'session_aggregate' : 'unknown');
          assert.equal(source.records, records.length);
          assert.equal(source.calls, records.reduce((sum, row) => sum + row.calls, 0));
          assert.equal(source.last_observed_tokens, records.reduce((sum, row) => sum + row.tokens, 0));
        }
        const ungrouped = (await request(scope.query, 'none')).json<Response>();
        assert.deepEqual(body.coverage, ungrouped.coverage, scope.query);
        assert.equal('groups' in ungrouped, false);
        for (const row of ungrouped.rows) {
          const grouped = body.rows.filter(cell => cell.bucket_ts === row.bucket_ts);
          assert.equal(row.total_tokens, grouped.reduce((sum, cell) => sum + cell.total_tokens, 0));
          assert.equal(row.records, grouped.reduce((sum, cell) => sum + cell.records, 0));
          assert.equal(row.calls, grouped.reduce((sum, cell) => sum + cell.calls, 0));
        }
      }
      const full = (await request()).json<Response>();
      assert.equal(full.groups.length, identities.length + 3);
      const zero = full.rows.find(row => row.provider === 'zero-provider')!;
      assert.equal(zero.bucket_ts, from + 60000); assert.equal(zero.records, 1); assert.equal(zero.total_tokens, 0);
      assert.equal(full.rows.some(row => row.bucket_ts === from + 120000), false, 'missing minute stays absent, distinct from observed zero');
      assert.equal(full.rows.some(row => row.provider === 'aggregate-provider' || row.provider === 'unknown-provider'), false);
      assert.equal(full.groups.find(group => group.provider === 'aggregate-provider')!.aggregateRecords, 1);
      assert.equal(full.groups.find(group => group.provider === 'unknown-provider')!.unknownRecords, 1);
      assert.ok(full.rows.some(row => row.provider === null && row.model === null));
      assert.ok(full.rows.some(row => row.provider === '' && row.model === ''));
      assert.ok(full.rows.some(row => row.provider === '(unknown)' && row.model === '(unknown)'));
      const boundary = await app.inject({ url: `/api/trend?bucket=minute&group_by=provider_model&from=${from + 59999}&to=${from + 60001}&provider=openai&model=gpt-shared`, headers });
      assert.equal(boundary.statusCode, 200);
      assert.deepEqual(boundary.json<Response>().rows.map(row => [row.bucket_ts, row.total_tokens]), [[from, 11], [from + 60000, 13]]);
      for (const mode of ['none', 'harness', 'model', 'provider', 'vendor', 'project']) {
        const legacy = (await request('', mode)).json<Response>();
        assert.equal('groups' in legacy, false, mode);
        assert.ok(legacy.rows.every(row => !('provider' in row) && !('model' in row)), mode);
      }
      assert.equal((await app.inject('/api/trend?bucket=minute&group_by=provider_model')).statusCode, 401);
      assert.equal((await app.inject({ url: '/api/trend?bucket=minute&group_by=provider_model&from=0&to=86400001', headers })).statusCode, 400);
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
    await t.test('runtime activity and active-session counts follow the selected project and recorded timestamps', async () => {
      const sampleNow = Date.now(), recentAt = sampleNow - 30_000, idleAt = sampleNow - 10 * 60_000;
      insert.run(1, 1, 'runtime-recent-state', recentAt, 'gpt-runtime-active', 'openrouter', 1);
      insert.run(1, 1, 'runtime-idle-state', idleAt, 'claude-runtime-idle', 'anthropic', 1);
      try {
        const response = await app.inject({
          url: `/api/runtime-map?from=${sampleNow - 15 * 60_000}&to=${sampleNow + 1}&project=project_100%25`, headers,
        });
        assert.equal(response.statusCode, 200);
        const graph = response.json();
        assert.equal(graph.activityWindowMs, 5 * 60_000);
        assert.equal(typeof graph.now, 'number');
        assert.equal(graph.totals.activeSessions, 1, 'A session counts once even when it has both recent and idle records');
        assert.equal(graph.nodes.project[0].activeSessions, 1);
        const activeProvider = graph.nodes.provider.find((node: { key: string }) => node.key === 'openrouter');
        const idleProvider = graph.nodes.provider.find((node: { key: string }) => node.key === 'anthropic');
        assert.equal(activeProvider.lastActivityAt, recentAt);
        assert.equal(activeProvider.activeSessions, 1);
        assert.equal(idleProvider.lastActivityAt, idleAt);
        assert.equal(idleProvider.activeSessions, 0);
        const activeEdge = graph.edges.find((edge: { column: number; to: string }) => edge.column === 2 && edge.to === 'gpt-runtime-active');
        const idleEdge = graph.edges.find((edge: { column: number; to: string }) => edge.column === 2 && edge.to === 'claude-runtime-idle');
        assert.equal(activeEdge.lastActivityAt, recentAt);
        assert.equal(activeEdge.activeSessions, 1);
        assert.equal(idleEdge.lastActivityAt, idleAt);
        assert.equal(idleEdge.activeSessions, 0);
        const otherProject = await app.inject({
          url: `/api/runtime-map?from=${sampleNow - 15 * 60_000}&to=${sampleNow + 1}&project=another-project`, headers,
        });
        assert.equal(otherProject.json().totals.records, 0, 'Project activity does not leak into another project graph');
      } finally {
        db.prepare("DELETE FROM usage_event WHERE dedup_key IN ('runtime-recent-state','runtime-idle-state')").run();
      }
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
