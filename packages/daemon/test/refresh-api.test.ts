import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';

import { buildServer } from '../src/api/server.js';
import { openDb, type DB } from '../src/db/index.js';
import { Scheduler } from '../src/ingest/scheduler.js';
import type { Adapter, Profile } from '../src/adapters/types.js';
import { tmpRoot } from './fixtures.js';

function db(): DB {
  return openDb(join(tmpRoot(), 'usage.db'));
}

const profile: Profile = {
  profile: 'default',
  rootPath: '/fake/default',
  displayName: 'Fake',
};

test('POST /api/refresh requires the daemon token and returns a pass summary', async () => {
  let passes = 0;
  const adapter: Adapter = {
    id: 'fake',
    displayName: 'Fake',
    async detect() {
      return [profile];
    },
    watchTargets() {
      return [];
    },
    async ingest() {
      passes++;
    },
  };
  const database = db();
  const scheduler = new Scheduler(database, [adapter], { pollMs: 1_000_000, detectMs: 1_000_000 });
  await scheduler.start();
  const app = buildServer(database, scheduler, { port: 0, token: 'test-token', webRoot: tmpRoot() });

  try {
    const unauthorized = await app.inject({ method: 'POST', url: '/api/refresh' });
    assert.equal(unauthorized.statusCode, 401);
    const pricingUnauthorized = await app.inject({ method: 'POST', url: '/api/pricing/refresh' });
    assert.equal(pricingUnauthorized.statusCode, 401);
    const diagnosticsUnauthorized = await app.inject({ method: 'GET', url: '/api/diagnostics/runtime' });
    assert.equal(diagnosticsUnauthorized.statusCode, 401);

    const diagnostics = await app.inject({
      method: 'GET',
      url: '/api/diagnostics/runtime',
      headers: { 'x-quotapulse-token': 'test-token' },
    });
    assert.equal(diagnostics.statusCode, 200);
    const runtime = diagnostics.json() as {
      schemaVersion: number;
      pid: number;
      memory: { rssBytes: number };
      scheduler: { running: boolean; sourceCount: number };
    };
    assert.equal(runtime.schemaVersion, 1);
    assert.equal(runtime.pid, process.pid);
    assert.ok(runtime.memory.rssBytes > 0);
    assert.equal(runtime.scheduler.running, false);
    assert.equal(runtime.scheduler.sourceCount, 1);

    const response = await app.inject({
      method: 'POST',
      url: '/api/refresh',
      headers: { 'x-quotapulse-token': 'test-token' },
    });
    assert.equal(response.statusCode, 200);
    const body = response.json() as {
      pass: { trigger: string; newEvents: number; newLimits: number; failedSources: number };
    };
    assert.equal(body.pass.trigger, 'manual');
    assert.equal(body.pass.newEvents, 0);
    assert.equal(body.pass.newLimits, 0);
    assert.equal(body.pass.failedSources, 0);
    assert.equal(passes, 2);
  } finally {
    await app.close();
    scheduler.stop();
  }
});
