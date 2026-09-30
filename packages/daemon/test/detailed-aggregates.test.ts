import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from '../src/db/index.js';
import { buildServer } from '../src/api/server.js';
import { Scheduler } from '../src/ingest/scheduler.js';

test('opt-in project/model aggregates preserve identity, sessions and money coverage', async () => {
  const db = openDb(':memory:');
  db.exec(`INSERT INTO source(id,harness,profile,root_path,display_name,detected_at) VALUES
    (1,'codex','test','/private/one','Codex test',0),(2,'claude-code','test','/private/two','Claude test',0);
    INSERT INTO session(id,source_id,native_session_id,project) VALUES
    (1,1,'one','Alpha/Project'),(2,2,'two','Alpha/Project'),(3,1,'three',NULL),(4,1,'four','(none)');`);
  const insert = db.prepare(`INSERT INTO usage_event(source_id,session_id,dedup_key,ts,model,provider,total_tokens,call_count,cost_usd,cost_source,cost_cache_saving_usd)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)`);
  insert.run(1, 1, 'one', 100, 'gpt-a', 'openrouter', 100, 1, 0.2, 'computed', 0.03);
  insert.run(1, 1, 'two', 110, 'claude-b', 'anthropic', 200, 2, 0.4, 'native', null);
  insert.run(2, 2, 'three', 120, 'gpt-a', 'openai', 300, 1, 0.6, 'estimated', null);
  insert.run(1, 3, 'four', 130, null, null, 400, 1, null, 'unknown', null);
  insert.run(1, 4, 'five', 140, 'gpt-a', 'openrouter', 50, 1, 0.1, 'computed', null);
  insert.run(1, 1, 'six', 150, 'gpt-a', 'openrouter', 70, 1, null, 'native', null);
  const app = buildServer(db, new Scheduler(db, [], { pollMs: 1_000_000, detectMs: 1_000_000 }), { port: 0, token: 'details-test', webRoot: '.' });
  const headers = { 'x-quotapulse-token': 'details-test' };
  const get = async (dimension: 'projects' | 'models', extra = '') => {
    const response = await app.inject({ url: `/api/${dimension}?detailed=1&from=0&to=200${extra}`, headers });
    assert.equal(response.statusCode, 200, `${dimension}${extra}: ${response.body}`);
    return response.json();
  };
  try {
    const projects = await get('projects');
    assert.equal(projects.totals.records, 6);
    assert.equal(projects.totals.calls, 7);
    assert.equal(projects.totals.sessions, 4);
    assert.equal(projects.totals.tokens, 1120);
    assert.equal(projects.totals.reported_native_usd, 0.4);
    assert.equal(projects.totals.api_value_usd, 0.9);
    assert.deepEqual([projects.totals.native_calls, projects.totals.computed_calls, projects.totals.estimated_calls, projects.totals.unknown_calls], [2, 2, 1, 2]);
    assert.equal(projects.totals.cache_saving_known_calls, 1);
    assert.equal(projects.totals.cache_saving_known_usd, 0.03);
    assert.equal(projects.rows.reduce((sum: number, row: { tokens: number }) => sum + row.tokens, 0), 1120);
    assert.equal(projects.groups.reduce((sum: number, group: { tokens: number }) => sum + group.tokens, 0), 1120);
    assert.equal(projects.groups.find((group: { key: string }) => group.key === 'Alpha/Project').sessions, 2);
    assert.equal(projects.rows.some((row: { project: string | null }) => row.project === null), true);
    assert.equal(projects.rows.some((row: { project: string | null }) => row.project === '(none)'), true);
    assert.equal(JSON.stringify(projects).includes('/private/'), false);

    const alpha = await get('projects', '&project=Alpha%2FProject');
    assert.equal(alpha.totals.tokens, 670);
    assert.equal(alpha.totals.sessions, 2);
    assert.equal(alpha.rows.reduce((sum: number, row: { sessions: number }) => sum + row.sessions, 0), 3);
    const missing = await get('projects', '&project_missing=1');
    assert.equal(missing.rows.length, 1);
    assert.equal(missing.rows[0].project, null);
    assert.equal(missing.totals.tokens, 400);
    const literal = await get('projects', '&project=%28none%29');
    assert.equal(literal.totals.tokens, 50);
    const detail = await app.inject({ url: '/api/project-detail?from=0&to=200&project=Alpha%2FProject&limit=1', headers });
    assert.equal(detail.statusCode, 200);
    assert.equal(detail.json().points.reduce((sum: number, point: { tokens: number }) => sum + point.tokens, 0), 670);
    assert.equal(detail.json().sessions.total, 2);
    assert.equal(detail.json().sessions.rows.length, 1);
    assert.equal(detail.json().recent.length, 4);
    const nullDetail = await app.inject({ url: '/api/project-detail?from=0&to=200&project_missing=1', headers });
    assert.equal(nullDetail.json().sessions.total, 1);
    assert.equal(nullDetail.json().points[0].tokens, 400);
    assert.equal((await app.inject({ url: '/api/project-detail?from=0&to=200', headers })).statusCode, 400);
    assert.equal((await app.inject({ url: '/api/project-detail?from=0&to=200&project=x&project_missing=1', headers })).statusCode, 400);
    assert.equal((await app.inject('/api/project-detail?from=0&to=200&project=x')).statusCode, 401);

    const models = await get('models', '&model=gpt-a');
    assert.equal(models.totals.tokens, 520);
    assert.equal(models.totals.sessions, 3);
    assert.deepEqual(models.rows.map((row: { provider: string }) => row.provider).sort(), ['openai', 'openrouter']);
    assert.equal(models.rows.find((row: { provider: string }) => row.provider === 'openrouter').sessions, 2);
    assert.equal(models.groups.find((group: { provider: string }) => group.provider === 'openrouter').sessions, 2);
    assert.equal((await get('models', '&provider=anthropic')).totals.tokens, 200);
    assert.equal((await get('projects', '&source_id=2')).totals.tokens, 300);
    assert.equal((await get('projects', '&session_id=1')).totals.sessions, 1);

    for (const dimension of ['projects', 'models'] as const) {
      const legacy = await app.inject({ url: `/api/${dimension}?from=0&to=200`, headers });
      assert.equal(legacy.statusCode, 200);
      assert.equal('totals' in legacy.json(), false);
      assert.equal((await app.inject({ url: `/api/${dimension}?detailed=0`, headers })).statusCode, 400);
      assert.equal((await app.inject({ url: `/api/${dimension}?detailed=1&from=-1`, headers })).statusCode, 400);
      assert.equal((await app.inject({ url: `/api/${dimension}?detailed=1&unexpected=1`, headers })).statusCode, 400);
      assert.equal((await app.inject(`/api/${dimension}?detailed=1`)).statusCode, 401);
    }
    db.prepare("UPDATE session SET project='' WHERE id=4").run();
    assert.equal((await get('projects', '&project=')).totals.tokens, 50);
    assert.equal((await app.inject({ url: '/api/project-detail?from=0&to=200&project=', headers })).json().sessions.total, 1);
  } finally {
    await app.close();
    db.close();
  }
});
