import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';

import { buildServer } from '../src/api/server.js';
import { openDb, type DB } from '../src/db/index.js';
import { Scheduler } from '../src/ingest/scheduler.js';
import { tmpRoot } from './fixtures.js';

function seedUsage(db: DB, now: number): void {
  db.prepare(`INSERT INTO source (
    harness, profile, root_path, display_name, detected_at
  ) VALUES ('codex', 'default', '/fake/codex', 'Codex', ?)`)
    .run(now);
  const sourceId = Number((db.prepare('SELECT id FROM source LIMIT 1').get() as { id: number }).id);
  const insert = db.prepare(`INSERT INTO usage_event (
    source_id, dedup_key, ts, model, provider, input_tokens, cached_input_tokens,
    cache_write_tokens, output_tokens, reasoning_tokens, total_tokens
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  insert.run(sourceId, 'today-1', now - 1_000, 'gpt-today', 'openai', 10, 20, 3, 40, 5, 73);
  insert.run(sourceId, 'today-2', now - 500, 'gpt-today', 'openai', 7, 0, 0, 11, 2, 18);
}

test('application settings persist, validate, and emit a settings event', async () => {
  const path = join(tmpRoot(), 'usage.db');
  const database = openDb(path);
  const scheduler = new Scheduler(database, [], { pollMs: 1_000_000, detectMs: 1_000_000 });
  const app = buildServer(database, scheduler, { port: 0, token: 'settings-token', webRoot: tmpRoot() });
  let emitted: unknown = null;
  let databaseClosed = false;
  scheduler.on('settings', (settings) => { emitted = settings; });

  try {
    const initial = await app.inject({
      method: 'GET',
      url: '/api/settings',
      headers: { 'x-quotapulse-token': 'settings-token' },
    });
    assert.equal(initial.statusCode, 200);
    assert.deepEqual(initial.json(), {
      pet_enabled: true,
      tray_animation_enabled: true,
      hidden_subscriptions: [],
      updated_at: 0,
    });

    const invalid = await app.inject({
      method: 'PUT',
      url: '/api/settings',
      headers: { 'x-quotapulse-token': 'settings-token' },
      payload: { hidden_subscriptions: ['ok', 42] },
    });
    assert.equal(invalid.statusCode, 400);

    const updated = await app.inject({
      method: 'PUT',
      url: '/api/settings',
      headers: { 'x-quotapulse-token': 'settings-token' },
      payload: {
        pet_enabled: false,
        tray_animation_enabled: false,
        hidden_subscriptions: [' openai:subscription ', 'openai:subscription'],
      },
    });
    assert.equal(updated.statusCode, 200);
    const settings = updated.json() as { pet_enabled: boolean; tray_animation_enabled: boolean; hidden_subscriptions: string[]; updated_at: number };
    assert.equal(settings.pet_enabled, false);
    assert.equal(settings.tray_animation_enabled, false);
    assert.deepEqual(settings.hidden_subscriptions, ['openai:subscription']);
    assert.ok(settings.updated_at > 0);
    assert.deepEqual(emitted, settings);

    await app.close();
    database.close();
    databaseClosed = true;
    const reopened = openDb(path);
    assert.deepEqual(
      reopened.prepare('SELECT pet_enabled, tray_animation_enabled, hidden_subscriptions FROM app_setting').all(),
      [{ pet_enabled: 0, tray_animation_enabled: 0, hidden_subscriptions: '["openai:subscription"]' }],
    );
    reopened.close();
  } finally {
    await app.close().catch(() => undefined);
    if (!databaseClosed && database.open) database.close();
  }
});

test('Today endpoint returns only the current local calendar day and groups by harness/model', async () => {
  const dir = tmpRoot();
  const path = join(dir, 'usage.db');
  const database = openDb(path);
  const now = Date.now();
  seedUsage(database, now);
  const scheduler = new Scheduler(database, [], { pollMs: 1_000_000, detectMs: 1_000_000 });
  const app = buildServer(database, scheduler, { port: 0, token: 'today-token', webRoot: dir });

  try {
    const response = await app.inject({
      method: 'GET',
      url: '/api/today',
      headers: { 'x-quotapulse-token': 'today-token' },
    });
    assert.equal(response.statusCode, 200);
    const body = response.json() as {
      from: number;
      to: number;
      totals: { calls: number; total_tokens: number; cached_input_tokens: number; cache_write_tokens: number };
      rows: Array<{ harness: string; model: string; calls: number; total_tokens: number; cached_input_tokens: number; cache_write_tokens: number }>;
    };
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    assert.equal(body.from, today.getTime());
    assert.ok(body.to >= now);
    assert.equal(body.totals.calls, 2);
    assert.equal(body.totals.total_tokens, 91);
    assert.equal(body.totals.cached_input_tokens, 20);
    assert.equal(body.totals.cache_write_tokens, 3);
    assert.deepEqual(body.rows.map((row) => ({
      harness: row.harness,
      model: row.model,
      calls: row.calls,
      total_tokens: row.total_tokens,
      cached_input_tokens: row.cached_input_tokens,
      cache_write_tokens: row.cache_write_tokens,
    })), [{
      harness: 'codex',
      model: 'gpt-today',
      calls: 2,
      total_tokens: 91,
      cached_input_tokens: 20,
      cache_write_tokens: 3,
    }]);
  } finally {
    await app.close();
    database.close();
  }
});
