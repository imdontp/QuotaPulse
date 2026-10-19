import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { SCHEMA_SQL } from '../packages/daemon/src/db/schema.ts';
import { upsertSource } from '../packages/daemon/src/db/index.ts';
import { DbSink } from '../packages/daemon/src/ingest/sink.ts';
import { DbCursorStore } from '../packages/daemon/src/ingest/cursor.ts';
import { PriceResolver } from '../packages/daemon/src/pricing/resolve.ts';
import { claudeCodeAdapter } from '../packages/daemon/src/adapters/claude-code.ts';
import { historySummary } from '../packages/daemon/src/api/history-summary.ts';
import { modelDetail } from '../packages/daemon/src/api/model-detail.ts';
const require = createRequire(resolve('packages/daemon/package.json'));
const Database = require('better-sqlite3');
const root = resolve('tmp/effort85-fixture');
mkdirSync(join(root, 'projects', 'effort-audit'), { recursive: true });
const base = Date.UTC(2026, 9, 1);
const results = [];
for (const categories of [6, 100, 20000]) {
  const db = new Database(':memory:'); db.exec(SCHEMA_SQL);
  const sourceId = upsertSource(db, { harness:'claude-code', profile:'effort-audit', rootPath:root, displayName:'Synthetic only' });
  const values = [null, '', ...Array.from({length:categories - 2}, (_, i) => `custom-effort-${String(i).padStart(5,'0')}`)];
  const lines = values.map((effort, i) => JSON.stringify({type:'assistant', sessionId:'synthetic-session', timestamp:new Date(base+i).toISOString(), cwd:'C:/synthetic/effort-audit', effort, message:{id:`synthetic-${i}`, model:'synthetic-model', usage:{input_tokens:2, output_tokens:1}}}));
  writeFileSync(join(root,'projects','effort-audit','synthetic-session.jsonl'), lines.join('\n')+'\n');
  const sink = new DbSink(db, sourceId, new PriceResolver(db));
  const t0 = performance.now();
  await claudeCodeAdapter.ingest({profile:{profile:'effort-audit',rootPath:root,displayName:'Synthetic only'}, sourceId,cursors:new DbCursorStore(db,sourceId),sink,backfill:true});
  const ingestMs = performance.now() - t0;
  assert.equal(sink.stats.usageInserted, categories);
  const scope = {from:base,to:base+86400000,sourceId};
  const h0 = performance.now(); const history=historySummary(db,scope); const historyMs=performance.now()-h0;
  const m0 = performance.now(); const model=modelDetail(db,{...scope,model:'synthetic-model',provider:'anthropic'}, {modelMissing:false,providerMissing:false,modelEmpty:false,providerEmpty:false}); const modelMs=performance.now()-m0;
  assert.equal(history.effort.length,categories); assert.equal(model.efforts.length,categories);
  for (const effort of values) {
    assert(history.effort.some(row=>row.effort===effort));
    assert(model.efforts.some(row=>row.effort===effort));
  }
  assert.equal(history.totals.calls,categories); assert.equal(history.totals.tokens,categories*3);
  assert.equal(model.efforts.reduce((n,row)=>n+row.tokens,0),categories*3);
  const groupPlan = db.prepare(`EXPLAIN QUERY PLAN SELECT u.effort,COUNT(*),SUM(u.call_count) FROM usage_event u JOIN source s ON s.id=u.source_id LEFT JOIN session sess ON sess.id=u.session_id WHERE u.ts>=@from AND u.ts<@to AND u.source_id=@sourceId GROUP BY u.effort ORDER BY SUM(u.call_count) DESC,u.effort ASC`).all(scope);
  results.push({categories,ingested:sink.stats.usageInserted,ingestMs,historyMs,modelMs,historyEfforts:history.effort.length,modelEfforts:model.efforts.length,historyBytes:Buffer.byteLength(JSON.stringify(history)),modelBytes:Buffer.byteLength(JSON.stringify(model)),historyEffortBytes:Buffer.byteLength(JSON.stringify(history.effort)),modelEffortBytes:Buffer.byteLength(JSON.stringify(model.efforts)),historyCalls:history.totals.calls,historyTokens:history.totals.tokens,historyTimeline:history.timeline.length,modelPoints:model.points.length,groupPlan,renderSourceCounts:{historyListItems:history.effort.length,modelListItems:model.efforts.length,modelDescendantElements:model.efforts.length*5},nullAndEmptyPreserved:true});
  db.close();
}
writeFileSync('tmp/effort85-probe-results.json',JSON.stringify({scope:'Synthetic only, supported Claude reader -> real DbSink -> in-memory schema -> actual API functions. Counts are source-derived render counts, not browser CPU/DOM observations.',results},null,2)+'\n');
console.log(JSON.stringify(results,null,2));
