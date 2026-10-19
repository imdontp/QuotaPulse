import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDb, type DB } from '../src/db/index.js';
import { detailedAggregates, type AggregateDimension } from '../src/api/detailed-aggregates.js';
import { usageWhere, type UsageScope } from '../src/api/usage-scope.js';
import { vendorSqlCase } from '../src/util/vendor.js';

// Frozen pre-optimization implementation (LF SHA256 2fc9334a65f912db4b34a473b14c4684f8b3be7c9ddf934d226ca9048cde19c1), not reconstructed from the optimized SQL.
const LEGACY_FACTS = `COUNT(*) AS records,
  COALESCE(SUM(u.call_count),0) AS calls,
  COUNT(DISTINCT sess.id) AS sessions,
  COALESCE(SUM(u.input_tokens),0) AS inputTokens,
  COALESCE(SUM(u.cached_input_tokens),0) AS cachedInputTokens,
  COALESCE(SUM(u.cache_write_tokens),0) AS cacheWriteTokens,
  COALESCE(SUM(u.output_tokens),0) AS outputTokens,
  COALESCE(SUM(u.total_tokens),0) AS tokens,
  COALESCE(SUM(CASE WHEN u.cost_source='native' THEN u.cost_usd ELSE 0 END),0) AS reported_native_usd,
  COALESCE(SUM(CASE WHEN u.cost_source IN ('computed','estimated') THEN u.cost_usd ELSE 0 END),0) AS api_value_usd,
  COALESCE(SUM(CASE WHEN u.cost_source='native' AND u.cost_usd IS NOT NULL THEN u.call_count ELSE 0 END),0) AS native_calls,
  COALESCE(SUM(CASE WHEN u.cost_source='computed' AND u.cost_usd IS NOT NULL THEN u.call_count ELSE 0 END),0) AS computed_calls,
  COALESCE(SUM(CASE WHEN u.cost_source='estimated' AND u.cost_usd IS NOT NULL THEN u.call_count ELSE 0 END),0) AS estimated_calls,
  COALESCE(SUM(CASE WHEN u.cost_usd IS NULL OR u.cost_source NOT IN ('native','computed','estimated') THEN u.call_count ELSE 0 END),0) AS unknown_calls,
  COALESCE(SUM(CASE WHEN u.cost_cache_saving_usd IS NOT NULL THEN u.cost_cache_saving_usd ELSE 0 END),0) AS cache_saving_known_usd,
  COALESCE(SUM(CASE WHEN u.cost_cache_saving_usd IS NOT NULL THEN u.call_count ELSE 0 END),0) AS cache_saving_known_calls,
  MAX(u.ts) AS lastObservedAt`;

/** Opt-in aggregate; legacy project/model response cardinality is unchanged. */
function legacyDetailedAggregates(db: DB, scope: UsageScope, dimension: AggregateDimension) {
  const where = usageWhere(scope);
  const from = `FROM usage_event u JOIN source s ON s.id=u.source_id
    LEFT JOIN session sess ON sess.id=u.session_id WHERE ${where.sql}`;
  const vendor = vendorSqlCase('u.model', 'u.provider');
  const identity = dimension === 'project'
    ? `sess.project AS project, u.source_id AS sourceId, s.harness, s.display_name AS sourceName,
       u.provider, u.model, ${vendor} AS vendor`
    : `u.model, u.provider, ${vendor} AS vendor, u.source_id AS sourceId,
       s.harness, s.display_name AS sourceName, u.effort`;
  const group = dimension === 'project'
    ? 'sess.project, u.source_id, u.provider, u.model, vendor'
    : 'u.model, u.provider, u.source_id, u.effort, vendor';
  const tie = dimension === 'project' ? 'project ASC, sourceId ASC, provider ASC, model ASC' : 'model ASC, provider ASC, sourceId ASC, effort ASC';
  const groupIdentity = dimension === 'project' ? 'sess.project AS key' : `u.model, u.provider, ${vendor} AS vendor`;
  const groupBy = dimension === 'project' ? 'sess.project' : 'u.model, u.provider, vendor';
  const groupTie = dimension === 'project' ? 'key ASC' : 'model ASC, provider ASC';
  return db.transaction(() => {
    const totals = db.prepare(`SELECT ${LEGACY_FACTS} ${from}`).get(where.params);
    const groups = db.prepare(`SELECT ${groupIdentity}, ${LEGACY_FACTS} ${from}
      GROUP BY ${groupBy} ORDER BY tokens DESC, ${groupTie}`).all(where.params);
    const rows = db.prepare(`SELECT ${identity}, ${LEGACY_FACTS} ${from}
      GROUP BY ${group} ORDER BY tokens DESC, ${tie}`).all(where.params);
    return { totals, groups, rows };
  })();
}


test('optimized detail aggregates exactly preserve original complete responses and ordering across model/project scopes', () => {
  const db = openDb(':memory:');
  try {
    const harnesses = ['codex', 'hermes', 'future'];
    const projects = ['One', '', null, ' Two '];
    for (let source = 1; source <= 3; source++) {
      db.prepare(`INSERT INTO source(id,harness,profile,root_path,display_name,detected_at) VALUES(?,?,'fixture','/synthetic','Reader',0)`)
        .run(source, harnesses[source - 1]);
      for (let slot = 0; slot < 4; slot++) db.prepare(`INSERT INTO session(id,source_id,native_session_id,project) VALUES(?,?,?,?)`)
        .run((source - 1) * 4 + slot + 1, source, `session-${source}-${slot}`, projects[slot]);
    }
    const pairs = [[null,null],['',''],[null,''],['',null],['Unknown','Unknown'],
      ['gpt-a','route-a'],['gpt-a','route-b'],['GPT-a','route-a'],[' gpt-a ',' route-a '],
      ['claude-a','anthropic'],['novel-model','openai'],['novel-model','custom']] as const;
    const costs = [['native',null],['native',0],['native',0.125],['computed',0],['computed',1.25],
      ['estimated',0.375],['estimated',null],['unknown',9],['unknown',null],['custom',-0.25]] as const;
    const insert = db.prepare(`INSERT INTO usage_event(source_id,session_id,dedup_key,ts,model,provider,effort,
      total_tokens,input_tokens,cached_input_tokens,cache_write_tokens,output_tokens,call_count,cost_source,cost_usd,cost_cache_saving_usd)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
    let id = 0;
    db.transaction(() => {
      pairs.forEach(([model,provider],pair) => {
        for(let source = 1; source <= 3; source++) costs.forEach(([costSource,cost],slot) => {
          const sequence = id++;
          const session = slot === 9 ? null : (source - 1) * 4 + slot % 4 + 1;
          insert.run(source,session,`event-${sequence}`,100 + slot,model,provider,[null,'','high','Unknown'][slot % 4],
            pair % 3 === 0 ? 0 : 100,20,30,10,40,slot + 1,costSource,cost,slot % 3 === 0 ? null : slot % 3 === 1 ? 0 : 0.5);
        });
      });
      insert.run(1,1,'before',99,'gpt-a','route-a',null,1000,0,0,0,0,1,'computed',999,null);
      insert.run(1,1,'upper',200,'gpt-a','route-a',null,1000,0,0,0,0,1,'computed',999,null);
    })();
    const originalRows = db.prepare('SELECT * FROM usage_event ORDER BY id').all();
    const originalChanges = db.prepare('SELECT total_changes() n').get();
    const base = { from:100,to:200 };
    const scopes: UsageScope[] = [base,{from:99,to:201},{from:100,to:101},{from:111,to:200},
      ...(['all','call','session_aggregate','unknown'] as const).map(grain=>({...base,grain})),
      ...[1,2,3].map(sourceId=>({...base,sourceId})),
      ...[1,2,7,12].map(sessionId=>({...base,sessionId})),
      ...['One','',' Two ','missing'].map(project=>({...base,project})),
      {...base,projectMissing:true},
      ...['openai','anthropic','unknown'].map(vendor=>({...base,vendor})),
      ...['route-a','route-b','openai','custom'].map(provider=>({...base,provider})),
      ...['gpt-a','GPT-a',' gpt-a ','Unknown'].map(model=>({...base,model})),
      {...base,q:'session-1'}, {...base,q:'novel'}, {...base,harness:'hermes'},
      {...base,sourceId:2,project:'One',vendor:'openai',grain:'session_aggregate'},
    ];
    for (const dimension of ['model','project'] as const) {
      for(const scope of scopes) {
        const original = legacyDetailedAggregates(db,scope,dimension);
        const actual = detailedAggregates(db,scope,dimension);
        assert.deepEqual(actual,original,`${dimension}: ${JSON.stringify(scope)}`);
      }
    }
    const actual = detailedAggregates(db,base,'model');
    assert.equal(actual.groups.length,pairs.length);
    assert.equal(actual.totals.sessions,12); // Sessions recur across model/effort groups: never sum their distinct counts.
    assert.ok(actual.groups.reduce((sum,row)=>sum+row.sessions,0)>actual.totals.sessions);
    assert.deepEqual(db.prepare('SELECT * FROM usage_event ORDER BY id').all(),originalRows);
    assert.deepEqual(db.prepare('SELECT total_changes() n').get(),originalChanges);
  } finally { db.close(); }
});
