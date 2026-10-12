import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from '../src/db/index.js';
import { buildServer } from '../src/api/server.js';
import { Scheduler } from '../src/ingest/scheduler.js';

test('model detail exposes only exact catalog capacity, independently of observed usage and monetary basis', async () => {
  const db = openDb(':memory:');
  db.exec(`INSERT INTO source(id,harness,profile,root_path,display_name,detected_at)
    VALUES(1,'codex','test','/private/catalog-test','Test',0);
    INSERT INTO session(id,source_id,native_session_id) VALUES(1,1,'catalog-session');`);
  const event = db.prepare(`INSERT INTO usage_event(source_id,session_id,dedup_key,ts,model,provider,effort,context_window,cost_source)
    VALUES(1,1,?,100,?,?,?,10000,'native')`);
  for (const [i, effort] of [null, '', 'null', ' high ', 'high', 'HIGH'].entries()) event.run(`effort-${i}`, 'same', 'openai', effort);
  event.run('second-route', 'same', 'openrouter', null);
  const price = db.prepare(`INSERT INTO price(model,provider,context_window,origin,updated_at) VALUES(?,?,?,'models.dev',123456)
    ON CONFLICT(provider,model) DO UPDATE SET context_window=excluded.context_window`);
  price.run('same', 'openai', 128000);
  price.run('same', 'openrouter', 64000);
  price.run('', 'openai', 256000);
  price.run('same', '', 256000);
  const app = buildServer(db, new Scheduler(db, [], { pollMs: 1_000_000, detectMs: 1_000_000 }), { port: 0, token: 'catalog-test', webRoot: '.' });
  const headers = { 'x-quotapulse-token': 'catalog-test' };
  const endpoint = '/api/model-detail?from=0&to=200';
  const read = async (identity: string) => {
    const response = await app.inject({ url: `${endpoint}&${identity}`, headers });
    assert.equal(response.statusCode, 200, response.body);
    return response.json();
  };
  try {
    const one = await read('model=same&provider=openai');
    assert.deepEqual(one.catalogContext, { window: 128000, origin: 'models.dev', loadedAt: 123456 });
    assert.deepEqual(one.observedContext, { window: 10000, at: 100, origin: 'recorded usage event' });
    assert.equal(one.efforts.length, 6);
    assert.deepEqual(one.efforts.map((row: { effort: string | null }) => row.effort).sort(), [null, '', 'null', ' high ', 'high', 'HIGH'].sort());
    assert.equal(one.efforts.reduce((sum: number, row: { calls: number }) => sum + row.calls, 0), 6);
    assert.deepEqual((await read('model=same&provider=openrouter')).catalogContext, { window: 64000, origin: 'models.dev', loadedAt: 123456 });
    for (const identity of [
      'model=same&provider=missing', 'model=same&provider=openai-codex',
      'model=same-20260101&provider=openai', 'model=openai%2Fsame&provider=openai',
      'model=Same&provider=openai', 'model=%20same%20&provider=openai',
      'model_missing=1&provider=openai', 'model_empty=1&provider=openai',
      'model=same&provider_missing=1', 'model=same&provider_empty=1',
      'model_missing=1&provider_missing=1', 'model_empty=1&provider_empty=1',
    ]) assert.equal((await read(identity)).catalogContext, null, identity);
    for (const invalid of [null, 0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1, 'invalid']) {
      price.run('same', 'openai', invalid);
      assert.equal((await read('model=same&provider=openai')).catalogContext, null, String(invalid));
    }
    price.run('same', 'openai', 1);
    assert.equal((await read('model=same&provider=openai')).catalogContext.window, 1, 'A positive integer capacity is not an unavailable zero');
    db.prepare(`UPDATE price SET updated_at=-1, origin='' WHERE provider='openai' AND model='same'`).run();
    assert.deepEqual((await read('model=same&provider=openai')).catalogContext, { window: 1, origin: null, loadedAt: null });
    const response = await read('model=same&provider=openrouter');
    assert.equal(JSON.stringify(response).includes('/private/'), false);
    assert.deepEqual(Object.keys(response.catalogContext).sort(), ['loadedAt', 'origin', 'window']);
    assert.equal((await app.inject(`${endpoint}&model=same&provider=openai`)).statusCode, 401);
    assert.equal((await app.inject({ url: `${endpoint}&model=same&provider=openai&provider_missing=1`, headers })).statusCode, 400);
    const legacy = await app.inject({ url: '/api/models?from=0&to=200', headers });
    assert.equal(legacy.statusCode, 200);
    assert.equal('catalogContext' in legacy.json(), false);
    assert.equal('totals' in legacy.json(), false);
  } finally {
    await app.close();
    db.close();
  }
});
