import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from '../src/db/index.js';
import { buildServer } from '../src/api/server.js';
import { Scheduler } from '../src/ingest/scheduler.js';

test('quota history follows one selected reader and keeps reset periods separate', async () => {
  const db = openDb(':memory:');
  const now = Date.now();
  db.exec(`INSERT INTO source(id,harness,profile,root_path,display_name,detected_at)
    VALUES (1,'codex','test','/private/path','Live reader',0),
           (2,'hermes','test','/private/path','Cached reader',0);`);
  db.prepare(`UPDATE source SET account_key='shared:subscription', account_provider='test',
    account_display_name='Shared quota', account_state='active' WHERE id IN (1,2)`).run();
  const insert = db.prepare(`INSERT INTO limit_sample(source_id,window_kind,used_percent,resets_at,
    observed_at,last_seen_at,source_fetched_at,origin) VALUES (?,?,?,?,?,?,?,?)`);
  insert.run(1, '5h', 90, now - 3_600_000, now - 7_200_000, now - 7_200_000, now - 7_200_000, 'live');
  insert.run(1, '5h', 20, now + 14_400_000, now - 2_700_000, now - 2_700_000, now - 2_700_000, 'live');
  insert.run(1, '5h', 40, now + 14_400_000, now - 1_200_000, now - 1_200_000, now - 1_200_000, 'live');
  insert.run(1, '5h', 60, now + 14_400_000, now - 60_000, now - 60_000, now - 60_000, 'live');
  insert.run(2, '5h', 99, now + 14_400_000, now - 28_800_000, now - 28_800_000, now - 28_800_000, 'cached');
  insert.run(1, 'weekly', 88, now + 6 * 86_400_000, now - 60_000, now - 60_000, now - 60_000, 'live');
  const app = buildServer(db, new Scheduler(db, [], { pollMs: 1_000_000, detectMs: 1_000_000 }), { port: 0, token: 'quota-test', webRoot: '.' });
  const headers = { 'x-quotapulse-token': 'quota-test' };
  const path = `/api/quota-history?subscription_key=shared%3Asubscription&window_kind=5h&from=${now - 7_300_000}&to=${now + 1}`;
  try {
    const response = await app.inject({ url: path, headers });
    assert.equal(response.statusCode, 200);
    const body = response.json();
    assert.equal(body.available, true);
    assert.equal(body.reader.sourceId, 1);
    assert.equal(body.reader.origin, 'live');
    assert.equal(body.reader.freshness, 'live');
    assert.equal(body.reader.forecast.status, 'ready');
    assert.deepEqual(body.segments.map((segment: { samples: unknown[] }) => segment.samples.length), [1, 3]);
    assert.deepEqual(body.segments.flatMap((segment: { samples: Array<{ usedPercent: number }> }) => segment.samples.map(sample => sample.usedPercent)), [90, 20, 40, 60]);
    assert.equal(response.body.includes('/private/path'), false);
    const missing = (await app.inject({ url: '/api/quota-history?subscription_key=missing&window_kind=5h', headers })).json();
    assert.equal(missing.available, false);
    assert.deepEqual(missing.segments, []);
    assert.equal((await app.inject(path)).statusCode, 401);
    for (const query of ['subscription_key=&window_kind=5h', 'subscription_key=shared&window_kind=',
      'subscription_key=shared&window_kind=5h&from=-1', 'subscription_key=shared&window_kind=5h&from=0&to=7776000001',
      'subscription_key=shared&window_kind=5h&from=8640000000000000&to=8640000000000001',
      'subscription_key=shared&window_kind=5h&extra=1', 'subscription_key=a&subscription_key=b&window_kind=5h']) {
      assert.equal((await app.inject({ url: '/api/quota-history?' + query, headers })).statusCode, 400, query);
    }
  } finally {
    await app.close();
    db.close();
  }
});
