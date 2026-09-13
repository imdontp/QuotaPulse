import { test } from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { SCHEMA_SQL } from '../src/db/schema.js';
import { pricingCoverage, pricingCatalog, trend, sessionList } from '../src/api/queries.js';
import { buildServer } from '../src/api/server.js';
import { Scheduler } from '../src/ingest/scheduler.js';

function fixture() {
  const db = new Database(':memory:');
  db.exec(SCHEMA_SQL);
  db.exec(`INSERT INTO source (id,harness,profile,root_path,display_name,detected_at) VALUES
    (1,'hermes','default','/private-path','Hermes',0), (2,'codex','default','/private-path','Codex',0);
    INSERT INTO session (id,source_id,native_session_id,last_seen_at) VALUES (1,1,'fixture',1500),(2,2,'fixture-2',1500)`);
  const insert = db.prepare(`INSERT INTO usage_event (source_id,session_id,dedup_key,ts,call_count,model,provider,price_provider,cost_source,cost_usd)
    VALUES (@source,@source,@key,@ts,@calls,@model,'gateway',@reference,@kind,@usd)`);
  for (const [key, source, ts, calls, model, kind, usd, reference] of [
    ['before',1,999,8,'missing','unknown',null,null],
    ['aggregate',1,1000,100,'missing','unknown',null,null],
    ['reference',1,1500,4,'reference','estimated',12,'openai'],
    ['free',1,1999,7,'free','native',0,null],
    ['end',1,2000,90,'missing','unknown',null,null],
    ['another',2,1000,3,'other-source','unknown',null,null],
  ]) insert.run({key,source,ts,calls,model,kind,usd,reference});
  return db;
}

test('coverage uses call_count, inclusive start/exclusive end and source filtering without writes', () => {
  const db = fixture();
  try {
    db.pragma('query_only = ON');
    const result = pricingCoverage(db, { from: 1000, to: 2000, sourceId: 1 });
    assert.equal(result.totals.calls, 111);
    assert.equal(result.totals.cost_unknown_calls, 100);
    assert.equal(result.totals.cost_estimated_calls, 4);
    assert.equal(result.totals.cost_usd, 12);
    assert.equal(result.sourceName, 'Hermes');
    assert.equal(result.hasHermes, true);
    const models = result.models as Array<{model:string; calls:number; price_provider:string|null}>;
    assert.deepEqual(models.map(m => [m.model,m.calls]), [['missing',100],['reference',4]]);
    assert.equal(models[1]!.price_provider, 'openai');
    assert.equal(pricingCoverage(db, {from:1000,to:2000}).totals.calls, 114);
    assert.equal(pricingCoverage(db, {from:1000,to:2000,sourceId:2}).hasHermes, false);
    assert.equal(JSON.stringify(result).includes('/private-path'), false);
    assert.deepEqual(pricingCoverage(db, {from:2000,to:2000}).models, []);
    assert.equal(pricingCoverage(db, {from:1999,to:2000}).totals.cost_unknown_calls, 0);
  } finally { db.close(); }
});

test('missing catalog metadata is explicit; trend and sessions carry estimated and unknown counts', () => {
  const db = fixture();
  try {
    assert.deepEqual(pricingCatalog(db, null), {pricedModels:0,loadedAt:null,catalogAgeMs:null,catalogOwn:false,catalogPresent:false});
    const point = trend(db, {from:1000,to:2000,bucket:'hour',groupBy:'none',sourceId:1})[0]!;
    assert.equal(point.cost_unknown_calls,100);
    assert.equal(point.cost_estimated_calls,4);
    const sessions = sessionList(db, {limit:50,offset:0,sourceId:1}) as Array<{cost_estimated_calls:number}>;
    assert.equal(sessions[0]!.cost_estimated_calls,4);
  } finally { db.close(); }
});

test('coverage endpoint requires authentication and validates every scope parameter', async () => {
  const db = fixture();
  const scheduler = new Scheduler(db, []);
  const app = buildServer(db, scheduler, {port:0,token:'fixture-token',webRoot:'.'});
  try {
    assert.equal((await app.inject('/api/pricing/coverage?from=1000&to=2000')).statusCode,401);
    for (const query of ['', 'from=1', 'from=NaN&to=2', 'from=-1&to=2', 'from=3&to=2',
      'from=1.5&to=3', 'from=1&to=8640000000000001', 'from=1&to=2&source_id=0',
      'from=1&to=2&source_id=1.2', 'from=1&to=2&source_id=x']) {
      const response = await app.inject({url:`/api/pricing/coverage?${query}`,headers:{'x-quotapulse-token':'fixture-token'}});
      assert.equal(response.statusCode,400,query);
    }
    db.pragma('query_only = ON');
    const response = await app.inject({url:'/api/pricing/coverage?from=1000&to=2000&source_id=1',headers:{'x-quotapulse-token':'fixture-token'}});
    assert.equal(response.statusCode,200);
    assert.equal(response.json().totals.calls,111);
    assert.equal(response.body.includes('fixture-token'),false);
  } finally { await app.close(); db.close(); }
});
