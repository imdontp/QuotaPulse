import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { cpus, platform, release } from 'node:os';
import { openDb } from '../packages/daemon/src/db/index.js';
import { modelPairTrends, type ModelPair } from '../packages/daemon/src/api/model-pair-trends.js';
import { detailedAggregates } from '../packages/daemon/src/api/detailed-aggregates.js';
import type { UsageScope } from '../packages/daemon/src/api/usage-scope.js';

const db = openDb(':memory:');
const from = 1_700_000_000_000;
const to = from + 30 * 60_000;
const identities: ModelPair[] = Array.from({ length: 1265 }, (_, index) => ({
  model: index === 0 ? null : index === 1 ? '' : `model-${Math.floor(index / 3)}`,
  provider: index === 0 ? '' : index === 1 ? null : index % 3 === 0 ? null : index % 3 === 1 ? '' : `route-${index % 5}`,
}));
const fixtureStart = performance.now();
try {
  db.exec(`INSERT INTO source(id,harness,profile,root_path,display_name,detected_at) VALUES
    (1,'codex','synthetic','/synthetic/call','Call',0),
    (2,'hermes','synthetic','/synthetic/aggregate','Aggregate',0),
    (3,'future','synthetic','/synthetic/unknown','Unknown',0)`);
  const addSession = db.prepare('INSERT INTO session(id,source_id,native_session_id,project) VALUES(?,?,?,?)');
  for (let id = 1; id <= 120; id++) addSession.run(id, (id - 1) % 3 + 1, `session-${id}`, id % 4 === 0 ? null : id % 4 === 1 ? '' : id % 4 === 2 ? 'One' : 'Two');
  const insert = db.prepare(`INSERT INTO usage_event(source_id,session_id,dedup_key,ts,model,provider,total_tokens,call_count,effort,input_tokens,output_tokens)
    VALUES(?,?,?,?,?,?,?,?,?,?,?)`);
  let sequence = 0;
  const add = (pair: ModelPair, ordinal: number, bin: number) => {
    const session = ordinal % 120 + 1;
    const tokens = ordinal % 701;
    insert.run((session - 1) % 3 + 1, session, `event-${sequence++}`, from + bin * 60_000 + ordinal % 500,
      pair.model, pair.provider, tokens, ordinal % 9 + 1, ordinal % 2 ? 'high' : null, tokens, 0);
  };
  db.transaction(() => {
    identities.forEach((pair, index) => { for (let i = 0; i < 80; i++) add(pair, index * 83 + i, i % 3 * 10); });
    identities.slice(0, 20).forEach((pair, index) => { for (let i = 0; i < 3000; i++) add(pair, index * 3001 + i, i % 30); });
  })();
  const fixtureMs = performance.now() - fixtureStart;
  const rowCount = (db.prepare('SELECT COUNT(*) n FROM usage_event').get() as {n:number}).n;
  assert.equal(rowCount, 161200);
  assert.equal((db.prepare('SELECT COUNT(*) n FROM (SELECT model,provider FROM usage_event GROUP BY model,provider)').get() as {n:number}).n, identities.length);
  const changesBefore = db.prepare('SELECT total_changes() n').get();
  if (process.argv.includes('--group-production-after')) {
    const prior=readFileSync('tmp/models88-group-cost-diagnosis.md','utf8');
    const originalSql=[...prior.matchAll(/Original SQL:\s*```sql\n([\s\S]*?)\n```/g)].map(match=>match[1]);
    assert.equal(originalSql.length,3,'frozen original SQL from pre-change measured diagnosis');
    const start=performance.now();
    const current=detailedAggregates(db,{from,to},'model');
    const currentMs=performance.now()-start;
    const originalTimes:number[]=[];
    const originalValues=originalSql.map((sql,index)=>{
      const statement=db.prepare(sql);
      const begin=performance.now();
      const value=index===0?statement.get({from,to}):statement.all({from,to});
      originalTimes.push(performance.now()-begin);
      return value;
    });
    assert.deepEqual(current,{totals:originalValues[0],groups:originalValues[1],rows:originalValues[2]});
    assert.deepEqual(db.prepare('SELECT total_changes() n').get(),changesBefore);
    const json=JSON.stringify(current);
    const resultHash=createHash('sha256').update(json).digest('hex');
    const sourceHash=createHash('sha256').update(readFileSync('packages/daemon/src/api/detailed-aggregates.ts','utf8').replace(/\r\n/g,'\n')).digest('hex');
    writeFileSync('tmp/models88-group-cost-after.md',`# Current production aggregate observation88\n\nActual updated production detailedAggregates(model), one invocation on deterministic161200-row/1265-pair/120-session fixture: **${currentMs.toFixed(3)}ms**. Full result deepEqual against the three frozen original SQL statements extracted from the pre-change diagnosis passed. The original SQL oracle was executed once each afterward, taking ${originalTimes.map(t=>t.toFixed(3)).join(', ')}ms (totals, groups, detailed rows).\n\nResult: ${current.groups.length} groups, ${current.rows.length} detailed rows, ${Buffer.byteLength(json)} JSON bytes (function return only). Tokens ${(current.totals as {tokens:number}).tokens}; records ${(current.totals as {records:number}).records}. Exact result SHA256 ${resultHash}; current production source LF SHA256 ${sourceHash}. Database total_changes unchanged.\n\nPrior measured original whole-call median9187.083ms over five trials and diagnosis original per-query total5297.818ms are historical observations on the same deterministic fixture. Current invocation is one observation, not a controlled speedup ratio or SLO proof. Fixture unknown-family vendor cases exercise many fallback rules. Disk I/O, concurrency, network and browser work excluded. Whole-result 4MB/cardinality and vendor-filter CASE work remain open.\n`);
    console.log(JSON.stringify({status:'passed',currentMs,originalTimes,groups:current.groups.length,rows:current.rows.length,bytes:Buffer.byteLength(json),resultHash,sourceHash}));
    db.close();
    process.exit(0);
  }
  if (process.argv.includes('--group-diagnosis')) {
    const prepare = db.prepare.bind(db);
    const captured: Array<{sql:string;params:unknown;method:'all'|'get';prepareMs:number;executionMs:number;value:unknown;plan:unknown}> = [];
    db.prepare = ((sql:string) => {
      const begin=performance.now();
      const statement=prepare(sql);
      const prepareMs=performance.now()-begin;
      for (const method of ['all','get'] as const) {
        const original=statement[method].bind(statement);
        statement[method]=((params:unknown) => {
          const start=performance.now();
          const value=original(params);
          const executionMs=performance.now()-start;
          captured.push({sql,params,method,prepareMs,executionMs,value,plan:prepare(`EXPLAIN QUERY PLAN ${sql}`).all(params)});
          return value;
        }) as typeof statement[typeof method];
      }
      return statement;
    }) as typeof db.prepare;
    const begin=performance.now();
    let baseline:ReturnType<typeof detailedAggregates>;
    try { baseline=detailedAggregates(db,{from,to},'model'); } finally { db.prepare=prepare; }
    const baselineMs=performance.now()-begin;
    assert.equal(captured.length,3);
    const interventions = captured.map((read,index)=>{
      // The vendor expression is a pure function of already-grouped exact model/provider.
      // Remove only the redundant GROUP BY term; leave selected expression and every FACT untouched.
      const sql=read.sql.replace('GROUP BY u.model, u.provider, vendor','GROUP BY u.model, u.provider')
        .replace('GROUP BY u.model, u.provider, u.source_id, u.effort, vendor','GROUP BY u.model, u.provider, u.source_id, u.effort');
      const statement=prepare(sql);
      const start=performance.now();
      const value=statement[read.method](read.params);
      const executionMs=performance.now()-start;
      assert.deepEqual(value,read.value,`query-${index} exact rewrite result`);
      return {name:['totals','groups','source-effort rows'][index],executionMs,changed:sql!==read.sql,sql,
        plan:prepare(`EXPLAIN QUERY PLAN ${sql}`).all(read.params),bytes:Buffer.byteLength(JSON.stringify(value)),
        resultCount:Array.isArray(value)?value.length:1};
    });
    assert.deepEqual(prepare('SELECT total_changes() n').get(),changesBefore);
    const sourceHash=createHash('sha256').update(readFileSync('packages/daemon/src/api/detailed-aggregates.ts','utf8').replace(/\r\n/g,'\n')).digest('hex');
    const mappingHash=createHash('sha256').update(readFileSync('packages/daemon/src/util/vendor.ts','utf8').replace(/\r\n/g,'\n')).digest('hex');
    const md=`# Whole-group read cost diagnosis88\n\n## Measured facts\n\nActual current detailedAggregates(model) on the same deterministic161200-row/1265-pair/120-session in-memory fixture. One invocation of each original read and one of its local SQL intervention; no app edits. Total original invocation (including EXPLAIN instrumentation) ${baselineMs.toFixed(3)}ms. Rows: ${baseline!.rows.length}; groups: ${baseline!.groups.length}. All synthetic model names are unknown-family fallthroughs for vendor CASE; this deliberately exercises many CASE alternatives and is not claimed representative of the real user's model mix.\n\n| Read | Original execution ms | Without redundant vendor grouping ms | Exact result equality | JSON bytes |\n|---|---:|---:|---|---:|\n${captured.map((read,index)=>`| ${interventions[index].name} | ${read.executionMs.toFixed(3)} | ${interventions[index].executionMs.toFixed(3)} | deepEqual passed | ${interventions[index].bytes} |`).join('\n')}\n\nThe totals read has no vendor GROUP BY term and was intentionally unchanged as a control. Prepare times were ${captured.map(r=>r.prepareMs.toFixed(3)).join(', ')}ms respectively. Timing excludes JavaScript JSON serialization; original executions preceded interventions (warm-cache/order effects remain). No new SLO or comparative release performance claim.\n\n## Causal evidence and limits\n\n- No correlated subquery appears in these three reads or their EXPLAIN plans. They perform three independent same-scope reads of usage_event/source/session. DISTINCT sessions and grouped/order outputs require temporary B-trees.\n- Groups and source/effort rows redundantly GROUP BY vendor, a CASE expression derived solely from model/provider which are already grouped with binary exact identity semantics. SQLite evaluates that GROUP BY expression for incoming observations. Removing just this redundant term retains selected vendor expression and every FACT, and the observed exact equality plus runtime intervention isolates avoidable per-observation vendor classification work on this fixture.\n- This intervention does not eliminate three reads, DISTINCT aggregation, source/effort cardinality, whole-list transport, or vendor-filter predicate evaluation. The expensive expression is still required per observation if scope.vendor is supplied through usageWhere. Large-result growth remains open.\n- Synthetic fixture has null/empty route identities, source/grain mix, varying call_count, known-zero tokens, repeated sessions and effort groups; all cost_source values are unknown. Mixed pricing/negative/null/known-zero monetary cases must be covered before applying an equivalent production rewrite.\n\n## Bounded next change proposal\n\nRemove vendor only from GROUP BY terms where exact model AND provider are already present (model groups and detailed source/effort rows; project detailed rows also qualify, but scope can remain model-only if preferred). Preserve SQL vendorSqlCase in SELECT, all usageWhere predicates, joins, FACTS, ORDER BY, transaction, response schema and full cardinality. This changes neither persisted data nor attribution rules.\n\nWhy equivalent: vendorSqlCase is a deterministic scalar expression of u.model and u.provider, including NULL/empty fallback. Each group already has one exact model/provider tuple, so vendor cannot split it further. Same input rows and FACTS preserve COUNT DISTINCT sessions, call_count, grain filtering, price buckets, nullable sums, zeros and lastObservedAt. Do not derive higher-level totals by adding subgroup session counts; sessions overlap. Do not replace SQL mapping with vendorOf JS, whose implementation is not assumed bit-identical. No cache or persisted vendor migration is needed.\n\nBefore implementation, use focused equivalence cases for null vs empty vs literal Unknown, same model across providers, binary case/whitespace, multiple sources/efforts/projects/sessions, all grains and vendor filters, mixed native/computed/estimated/unknown costs (including zeros/nulls), tie ordering and empty scope. Compare complete responses exactly under the same snapshot.\n\n## Exact query evidence\n\nDetailed source LF SHA256: ${sourceHash}. Vendor mapping LF SHA256: ${mappingHash}. Params: ${JSON.stringify({from,to})}.\n\n${captured.map((read,index)=>`### ${interventions[index].name}\n\nOriginal EXPLAIN:\n\n\`\`\`json\n${JSON.stringify(read.plan,null,2)}\n\`\`\`\n\nIntervention EXPLAIN:\n\n\`\`\`json\n${JSON.stringify(interventions[index].plan,null,2)}\n\`\`\`\n\nOriginal SQL:\n\n\`\`\`sql\n${read.sql}\n\`\`\`\n\nOnly SQL replacement: ${interventions[index].changed?'remove final vendor term from GROUP BY; all other text unchanged':'none (totals control)'}.\n`).join('\n')}\n`;
    writeFileSync('tmp/models88-group-cost-diagnosis.md',md);
    console.log(JSON.stringify({status:'passed',baselineMs,reads:captured.map((r,index)=>({name:interventions[index].name,originalMs:r.executionMs,interventionMs:interventions[index].executionMs,equal:true}))}));
    db.close();
    process.exit(0);
  }
  const distribution = (samples: number[]) => {
    const sorted = [...samples].sort((a,b) => a-b);
    return { trialsMs: samples, minMs: sorted[0], medianMs: sorted[Math.floor(sorted.length/2)], p95Ms: sorted[Math.ceil(sorted.length*.95)-1], maxMs: sorted.at(-1) };
  };
  const observe = <T>(read:()=>T, warmups = 3, trials = 15) => {
    for (let i=0;i<warmups;i++) read();
    const samples: number[] = [];
    let value: T;
    for(let i=0;i<trials;i++) { const start=performance.now(); value=read(); samples.push(performance.now()-start); }
    const jsonStart=performance.now();
    const bytes=Buffer.byteLength(JSON.stringify(value!));
    return {value:value!, warmups, ...distribution(samples), responseJsonBytes:bytes, serializationObservationMs:performance.now()-jsonStart};
  };
  const cases = [
    { name:'dense-20-all-grains', pairs:identities.slice(0,20), scope:{from,to}, extra:'' },
    { name:'sparse-20-all-grains', pairs:identities.slice(-20), scope:{from,to}, extra:'' },
    { name:'dense-20-call', pairs:identities.slice(0,20), scope:{from,to,grain:'call'}, extra:" AND s.harness IN ('codex','claude-code','opencode')" },
    { name:'dense-20-session-aggregate', pairs:identities.slice(0,20), scope:{from,to,grain:'session_aggregate'}, extra:" AND s.harness='hermes'" },
    { name:'dense-20-source-project', pairs:identities.slice(0,20), scope:{from,to,sourceId:1,project:'One'}, extra:" AND u.source_id=1 AND sess.project='One'" },
    { name:'dense-20-unobserved-range', pairs:identities.slice(0,20), scope:{from:to,to:to+30*60_000}, extra:'' },
  ] satisfies Array<{name:string;pairs:ModelPair[];scope:UsageScope;extra:string}>;
  const results = cases.map(c => {
    let captured: {sql:string; params:unknown} | undefined;
    const prepare = db.prepare.bind(db);
    db.prepare = ((sql:string) => {
      const statement=prepare(sql);
      const all=statement.all.bind(statement);
      statement.all=((params:unknown) => { captured={sql,params}; return all(params); }) as typeof statement.all;
      return statement;
    }) as typeof db.prepare;
    try { modelPairTrends(db,c.scope,c.pairs); } finally { db.prepare=prepare; }
    assert.ok(captured);
    const plan=prepare(`EXPLAIN QUERY PLAN ${captured.sql}`).all(captured.params);
    const measured=observe(()=>modelPairTrends(db,c.scope,c.pairs));
    const observed=measured.value;
    const expected = c.pairs.map(pair => {
      // Independent per-pair row read + JS bin accumulation; does not call usageWhere or the grouped query.
      const raw=prepare(`SELECT u.ts,u.total_tokens,u.call_count FROM usage_event u
        JOIN source s ON s.id=u.source_id LEFT JOIN session sess ON sess.id=u.session_id
        WHERE u.ts>=? AND u.ts<? AND u.model IS ? AND u.provider IS ?${c.extra}`)
        .all(c.scope.from,c.scope.to,pair.model,pair.provider) as Array<{ts:number;total_tokens:number;call_count:number}>;
      const bins=new Map<number,{start:number;tokens:number;calls:number;records:number}>();
      for(const row of raw) {
        const start=c.scope.from+Math.floor((row.ts-c.scope.from)/observed.bucketMs)*observed.bucketMs;
        const point=bins.get(start)??{start,tokens:0,calls:0,records:0};
        point.tokens+=row.total_tokens; point.calls+=row.call_count; point.records++;
        bins.set(start,point);
      }
      return {...pair,points:[...bins.values()].sort((a,b)=>a.start-b.start)};
    });
    assert.deepEqual(observed.pairs,expected,c.name);
    const {value,...metrics}=measured;
    return {name:c.name,scope:c.scope,requestedPairs:c.pairs.length,...metrics,
      observedPoints:value.pairs.reduce((n,p)=>n+p.points.length,0),
      matchedRecords:value.pairs.reduce((n,p)=>n+p.points.reduce((a,b)=>a+b.records,0),0),
      correctness:'exact independent per-pair SQL rows plus JavaScript bucket sums', queryCount:1,
      sql:captured.sql,parameters:captured.params,explain:plan};
  });
  const aggregate=observe(()=>detailedAggregates(db,{from,to},'model'),1,5);
  const {value:aggregateValue,...aggregateMetrics}=aggregate;
  assert.equal(aggregateValue.groups.length,1265);
  assert.deepEqual(db.prepare('SELECT total_changes() n').get(),changesBefore);
  const sources=['packages/daemon/src/api/model-pair-trends.ts','packages/daemon/src/api/usage-scope.ts','packages/daemon/src/api/detailed-aggregates.ts','packages/daemon/src/db/schema.ts'];
  const report={createdAt:new Date().toISOString(),environment:{node:process.version,platform:platform(),release:release(),cpu:cpus()[0]?.model,sqlite:db.prepare('SELECT sqlite_version() version').get()},
    sourceHashes:Object.fromEntries(sources.map(path=>[path,createHash('sha256').update(readFileSync(path,'utf8').replace(/\r\n/g,'\n')).digest('hex')])),
    fixture:{database:':memory:',usageRows:rowCount,identities:1265,sources:3,sessions:120,grains:['call','session_aggregate','unknown'],fixtureMs,baseRowsPerPair:80,denseRowsExtraPerPair:3000,densePairs:20,sparseBinPositions:[0,10,20],denseBinPositions:'0..29',rssBytes:process.memoryUsage().rss},
    cases:results,existingWholeGroupRead:{...aggregateMetrics,groups:aggregateValue.groups.length,rows:aggregateValue.rows.length,queryCount:3},
    databaseChangesDuringReads:0,
    limits:['JSON byte measurements serialize the actual read function return; the HTTP now/scope wrapper and headers are excluded.',
      'No performance SLO was supplied; these local warm-cache observations are not a release performance certification.',
      'Synthetic in-memory database excludes real disk I/O, ingestion contention, SSE, network, web parsing and rendering.',
      'The grouped pair read is one SQL statement per request, not constant execution time; it scans matching model/time index entries and performs temporary GROUP BY/ORDER BY work.',
      'The existing detailed aggregate remains three whole-scope reads with O(identity/source/effort) result cardinality; row chart paging does not reduce that cost.',
      'Timings are sequential single-machine trials with fixed case order; no causal comparison to previous builds is claimed.']};
  writeFileSync('tmp/models88-query-benchmark.json',JSON.stringify(report,null,2)+'\n');
  writeFileSync('tmp/models88-query-benchmark.md',`# Models pair query observation88\n\nSynthetic ${rowCount.toLocaleString('en-US')} usage rows, 1265 exact identities, three recorded grains, 120 sessions; actual current query and schema. Each case has three warmups and fifteen timed reads. Every returned point reconciled exactly with independent per-pair SQL row reads and JavaScript sums. Database total_changes remained unchanged.\n\n| Case | Median ms | p95 ms | Points | Records | JSON bytes |\n|---|---:|---:|---:|---:|---:|\n${results.map(r=>`| ${r.name} | ${r.medianMs.toFixed(3)} | ${r.p95Ms.toFixed(3)} | ${r.observedPoints} | ${r.matchedRecords} | ${r.responseJsonBytes} |`).join('\n')}\n\nExisting whole-group detailed aggregate (one warmup, five trials): median ${aggregateMetrics.medianMs.toFixed(3)} ms, ${aggregateMetrics.responseJsonBytes} JSON bytes, ${aggregateValue.groups.length} groups and ${aggregateValue.rows.length} source/effort rows. This is a separate existing whole-scope cost, not a baseline variant of the new pair query.\n\nEXPLAIN and exact query/parameters, raw timing distributions, environment and source hashes are recorded in the JSON.\n\n${report.limits.map(s=>'- '+s).join('\n')}\n`);
  console.log(JSON.stringify({status:'passed',rows:rowCount,cases:results.map(({name,medianMs,p95Ms,responseJsonBytes,observedPoints,matchedRecords})=>({name,medianMs,p95Ms,responseJsonBytes,observedPoints,matchedRecords})),wholeGroup:aggregateMetrics}));
} finally { db.close(); }
