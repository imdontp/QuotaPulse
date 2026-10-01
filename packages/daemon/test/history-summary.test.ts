import assert from 'node:assert/strict';
import { test } from 'node:test';
import { openDb } from '../src/db/index.js';
import { buildServer } from '../src/api/server.js';
import { Scheduler } from '../src/ingest/scheduler.js';

test('History summary reconciles full filtered records, timeline, effort and separate price bases', async () => {
  const db = openDb(':memory:');
  db.exec(`INSERT INTO source(id,harness,profile,root_path,display_name,detected_at) VALUES
    (1,'codex','test','/private','Call reader',0),(2,'hermes','test','/private','Aggregate reader',0);
    INSERT INTO session(id,source_id,native_session_id,project) VALUES (1,1,'session-1','project_100%'),(2,2,'session-2',NULL);`);
  const insert = db.prepare(`INSERT INTO usage_event(source_id,session_id,dedup_key,ts,model,provider,total_tokens,input_tokens,output_tokens,call_count,cost_usd,cost_source,effort)
    VALUES (?,?,?,?, 'gpt-test','openrouter',10,6,4,?,?,?,?)`);
  for (let i = 0; i < 2101; i++) insert.run(1,1,`call-${i}`,100+i,1,.2,'computed','high');
  insert.run(2,2,'aggregate',200,15,3,'native',null);
  insert.run(1,1,'unpriced',300,1,null,'unknown','low');
  insert.run(1,1,'boundary',4000,1,.5,'estimated','low');
  const app = buildServer(db, new Scheduler(db, []), { token: 'history-summary-test', port: 0 });
  const headers = { 'x-quotapulse-token': 'history-summary-test' };
  const read = (extra = '', to = 4000) => app.inject({ url: `/api/history-summary?from=0&to=${to}${extra}`, headers });
  try {
    const body = (await read()).json();
    assert.equal(body.totals.records,2103);
    assert.equal(body.totals.calls,2117);
    assert.equal(body.totals.sessions,2);
    assert.equal(body.totals.tokens,21030);
    assert.equal(body.totals.reported_native_usd,3);
    assert.ok(Math.abs(body.totals.api_value_usd-420.2)<1e-6);
    assert.equal(body.totals.unknown_calls,1);
    assert.equal(body.timeline.reduce((sum: number,row: { tokens: number })=>sum+row.tokens,0),body.totals.tokens);
    assert.equal(body.effort.reduce((sum: number,row: { calls: number })=>sum+row.calls,0),body.totals.calls);
    for (const extra of ['&source_id=1','&session_id=2','&project_missing=1','&project=project_100%25','&harness=hermes&grain=session_aggregate','&provider=openrouter&vendor=openai&model=gpt-test','&q=%25','&grain=unknown',"&q=%27%20OR%201%3D1--"]) {
      const summary = (await read(extra)).json();
      const records = (await app.inject({ url: '/api/usage-events?from=0&to=4000&limit=1'+extra, headers })).json();
      assert.equal(summary.totals.records,records.total,extra);
      assert.equal(summary.timeline.reduce((sum: number,row: { records: number })=>sum+row.records,0),records.total,extra);
    }
    const all = (await read('',Date.now())).json();
    assert.ok(Math.ceil((all.scope.to-all.scope.from)/all.bucketMs)<=120);
    for (const url of ['/api/history-summary','/api/history-summary?from=5&to=3','/api/history-summary?from=0&to=4000&limit=1','/api/history-summary?from=0&to=4000&source_id=0']) assert.equal((await app.inject({url,headers})).statusCode,400);
    assert.equal((await app.inject('/api/history-summary?from=0&to=4000')).statusCode,401);
    assert.equal(JSON.stringify(body).includes('/private'),false);
  } finally { await app.close(); db.close(); }
});
