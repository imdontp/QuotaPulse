import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { buildServer } from '../src/api/server.js';
import { openDb } from '../src/db/index.js';
import { Scheduler } from '../src/ingest/scheduler.js';
import { tmpRoot } from './fixtures.js';

test('analysis and notification APIs require auth and reject malformed ranges', async () => {
  const db = openDb(join(tmpRoot(), 'analysis-api.db'));
  const scheduler = new Scheduler(db, []);
  const app = buildServer(db, scheduler, { port: 0, token: 'fixture-token', webRoot: tmpRoot() });
  const auth = { 'x-quotapulse-token': 'fixture-token' };
  try {
    assert.equal((await app.inject('/api/alerts')).statusCode, 401);
    assert.equal((await app.inject({ url: '/api/alerts', headers: auth })).statusCode, 200);
    assert.equal((await app.inject({ url: '/api/compare?from=1&to=3&previous_from=0&previous_to=1', headers: auth })).statusCode, 400);
    assert.equal((await app.inject({ url: '/api/trend?from=3&to=2', headers: auth })).statusCode, 400);
    assert.equal((await app.inject({ url: '/api/projects?from=3&to=2', headers: auth })).statusCode, 400);
    assert.equal((await app.inject({ url: '/api/sessions?from=3&to=2', headers: auth })).statusCode, 400);
    assert.equal((await app.inject({ method: 'PUT', url: '/api/notification-settings', headers: { ...auth, 'content-type': 'application/json' }, payload: [] })).statusCode, 400);

    const compare = await app.inject({ url: '/api/compare?from=1&to=3&previous_from=-1&previous_to=1', headers: auth });
    assert.equal(compare.statusCode, 400, 'negative previous ranges are rejected');
    const validCompare = await app.inject({ url: '/api/compare?from=1&to=3&previous_from=0&previous_to=2', headers: auth });
    assert.equal(validCompare.statusCode, 200);
    assert.equal(validCompare.json().current.calls, 0);

    const initial = await app.inject({ url: '/api/notification-settings', headers: auth });
    assert.equal(initial.statusCode, 200);
    assert.equal(initial.json().enabled, true);
    const updated = await app.inject({ method: 'PUT', url: '/api/notification-settings', headers: { ...auth, 'content-type': 'application/json' }, payload: { enabled: false, quiet_start: 1320, quiet_end: 420 } });
    assert.equal(updated.statusCode, 200);
    const settings = updated.json();
    assert.equal(settings.enabled, false);
    assert.equal(settings.snooze_until, null);
    assert.equal(settings.quiet_start, 1320);
    assert.equal(settings.quiet_end, 420);
    assert.equal(typeof settings.updated_at, 'number');
  } finally {
    await app.close();
    db.close();
  }
});
