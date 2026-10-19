import assert from 'node:assert/strict';
import { readFileSync,writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { openDb } from '../packages/daemon/src/db/index.js';
import { buildServer } from '../packages/daemon/src/api/server.js';
import { Scheduler } from '../packages/daemon/src/ingest/scheduler.js';
import { RuntimeMotionGate,RuntimeMotionEligibility,motionContextKey,type MotionFrame } from '../packages/web/src/redesign/runtime-motion.js';
import { recentActivityScope } from '../packages/web/src/redesign/activity-trend.js';
import { selectedScope } from '../packages/web/src/redesign/scope.js';
import { usageEventParams,type UsageEventRow } from '../packages/web/src/lib/usage-events.js';

const now=Date.now();
const route={range:'custom' as const,from:now-60_000,to:now+1};
const scopeKey=JSON.stringify(route);
const motionScope={key:scopeKey,project:'A'};
const cases=[];
for (const scenario of ['A-only','A-then-newer-B','B-then-newer-A','two-new-A-coalesced']) {
  const db=openDb(':memory:');
  db.exec(`INSERT INTO source(id,harness,profile,root_path,display_name,detected_at) VALUES(1,'codex','synthetic','/synthetic','Reader',0);
    INSERT INTO session(id,source_id,native_session_id,project) VALUES(1,1,'session-A','A'),(2,1,'session-B','B')`);
  const insert=db.prepare(`INSERT INTO usage_event(source_id,session_id,dedup_key,ts,model,provider,total_tokens,call_count)
    VALUES(1,?,?,?,'gpt-a','openai',10,1)`);
  insert.run(1,'known-A',now-5000);
  insert.run(2,'known-B',now-6000);
  const app=buildServer(db,new Scheduler(db,[],{pollMs:1_000_000,detectMs:1_000_000}),{port:0,token:'synthetic-runtime89',webRoot:'.'});
  const requests:Array<{url:string;status:number;response:unknown}>=[];
  const get=async(url:string)=>{
    const response=await app.inject({url,headers:{'x-quotapulse-token':'synthetic-runtime89'}});
    assert.equal(response.statusCode,200,response.body);
    const result=response.json();requests.push({url,status:response.statusCode,response:result});return result;
  };
  try {
    const scope=selectedScope(route,now);
    const activityScope=recentActivityScope(scope,now)!;
    const fetchBatch=async()=>{
      const graph=await get(`/api/runtime-map?${usageEventParams(scope)}`);
      // Exact current production.tsx collection: one newest event/harness, before project graph filtering.
      const harnesses=[...new Set(graph.nodes.harness.map((node:{key:string|null})=>node.key)
        .filter((h:string|null):h is string=>h!==null&&h.trim().length>0))] as string[];
      const rows=(await Promise.all(harnesses.map(async harness=>{
        const params=usageEventParams({...activityScope,harness});params.set('limit','1');params.set('offset','0');
        return (await get(`/api/usage-events?${params}`)).rows[0]??null;
      }))).filter((row):row is UsageEventRow=>row!==null);
      const selectedGraph=await get(`/api/runtime-map?${usageEventParams({...scope,project:'A'})}`);
      return {graph,rows,selectedGraph};
    };
    const eligibility=new RuntimeMotionEligibility();
    const provenance=eligibility.update(true,now-10000);
    const gate=new RuntimeMotionGate();
    const baseline=await fetchBatch();
    const frame=(serial:number,rows:UsageEventRow[],graph:any,reason:'initial'|'sse'):MotionFrame=>({
      batchSerial:serial,reason,scope:motionScope,now,activityWindowMs:graph.activityWindowMs,
      visible:true,intersecting:true,reduced:false,rows,eligibility:provenance,requestEligibility:provenance,
      graph:{batchSerial:serial,contextKey:motionContextKey(motionScope),edges:graph.edges,harnesses:graph.nodes.harness.map((n:{key:string|null})=>n.key)},
    });
    assert.deepEqual(gate.observe(frame(1,baseline.rows,baseline.selectedGraph,'initial')),[]);
    const inserted:Array<{id:number;project:string;timestamp:number}>=[];
    const add=(project:'A'|'B',timestamp:number)=>{
      const result=insert.run(project==='A'?1:2,`new-${inserted.length}-${project}`,timestamp);
      inserted.push({id:Number(result.lastInsertRowid),project,timestamp});
    };
    if(scenario==='A-only') add('A',now-1000);
    if(scenario==='A-then-newer-B'){add('A',now-1000);add('B',now-999);}
    if(scenario==='B-then-newer-A'){add('B',now-1000);add('A',now-999);}
    if(scenario==='two-new-A-coalesced'){add('A',now-1000);add('A',now-999);}
    const accepted=await fetchBatch();
    const pending=frame(2,accepted.rows,accepted.selectedGraph,'sse');pending.graph=undefined;
    const beforeGraph=gate.observe(pending);
    const signals=gate.observe(frame(2,accepted.rows,accepted.selectedGraph,'sse'));
    const repeat=gate.observe(frame(2,accepted.rows,accepted.selectedGraph,'sse'));
    assert.deepEqual(beforeGraph,[]);assert.deepEqual(repeat,[]);
    const exactParams=usageEventParams({...activityScope,harness:'codex',project:'A'});exactParams.set('limit','1');exactParams.set('offset','0');
    const selectedObservation=await get(`/api/usage-events?${exactParams}`);
    // Counterfactual evidence uses the SAME shared gate with an exact-project API row; no app change.
    const scopedGate=new RuntimeMotionGate();scopedGate.observe(frame(1,baseline.rows,baseline.selectedGraph,'initial'));
    const scopedSignals=scopedGate.observe(frame(2,selectedObservation.rows,accepted.selectedGraph,'sse'));
    assert.equal(signals.length,scenario==='A-then-newer-B'?0:1);
    assert.equal(scopedSignals.length,1);
    assert.equal(accepted.selectedGraph.totals.records,scenario==='two-new-A-coalesced'?3:2);
    assert.ok(accepted.selectedGraph.edges.some((edge:{column:number;from:string;to:string})=>edge.column===1&&edge.from==='codex'&&edge.to==='openai'));
    cases.push({scenario,inserted,eligibility:provenance,scope,activityScope,motionScope,
      initialRows:baseline.rows,acceptedRows:accepted.rows,selectedGraph:accepted.selectedGraph,
      beforeGraph,signals,repeatedSerialSignals:repeat,exactProjectApiRows:selectedObservation.rows,exactProjectGateSignals:scopedSignals,requests});
  } finally {await app.close();db.close();}
}
const sources=['packages/web/src/redesign/production.tsx','packages/web/src/redesign/use-runtime-motion.ts','packages/web/src/redesign/runtime-motion.ts','packages/web/src/redesign/activity-trend.ts','packages/web/src/redesign/scope.ts','packages/daemon/src/api/runtime-map.ts'];
const report={createdAt:new Date().toISOString(),now,node:process.version,method:'real buildServer API handlers via Fastify.inject + actual shared pure RuntimeMotionGate/helper functions; accepted refresh boundary simulated, no React/browser/SSE transport',
 sourceHashes:Object.fromEntries(sources.map(path=>[path,createHash('sha256').update(readFileSync(path,'utf8').replace(/\r\n/g,'\n')).digest('hex')])),cases,
 conclusion:'Current globally newest-per-harness observation collection can omit the newest selected-project call when another project has a newer same-harness call before an accepted refresh. Gate correctly rejects the foreign row and emits no selected-project signal; exact-project read returns the eligible A call and the same gate emits one signal.',
 limits:['Authority says new observed call on a known edge, not every ingested record. This demonstrates a scoped observation omission, not proof that every record must animate.',
 'No production React lifecycle, visual paint, SSE transport, timer expiry or native behavior was executed. Actual handlers, request encoders, scope helpers, eligibility class and gate were used.',
 'Production collection logic in this script is copied from inspected production.tsx because it is embedded in a React component, not exported. Source hashes bind the inspected implementation; no app module was changed.',
 'One newest row per harness intentionally coalesces multiple same-project calls; two-new-A case confirms one observed signal for the latest row, not a per-ingested-record queue.']};
writeFileSync('tmp/runtime89-project-observation.json',JSON.stringify(report,null,2)+'\n');
writeFileSync('tmp/runtime89-project-observation.md',`# Selected-project Runtime observation89\n\n## Verified behavior\n\nActual synthetic in-memory daemon API handlers, shared request/scope helpers and actual RuntimeMotionGate were used. Exact-source hashes and all request/response rows are in the JSON. No browser or app source changes.\n\n| Scenario before one accepted refresh | Production observed project | Selected A graph records | Selected A signals | Exact-A API row + same gate |\n|---|---|---:|---:|---:|\n${cases.map(c=>`| ${c.scenario} | ${c.acceptedRows.map((r:UsageEventRow)=>r.project).join(',')} | ${c.selectedGraph.totals.records} | ${c.signals.length} | ${c.exactProjectGateSignals.length} |`).join('\n')}\n\nBaseline includes known A and B calls through the same codex/openai/gpt-a edge. Initial frame seeds without replay. Every case uses identical visibility, intersection, reduced=false, eligibility epoch/since, graph-ready serial/context and logical now. Accepted rows are observed first with graph unavailable and then with matching ready A graph; repeated serial emits nothing.\n\n## Interpretation\n\n${report.conclusion}\n\nThis is a concrete scoped-observation mismatch worth fixing if map activity is intended to observe its selected project. It is not evidence that the gate should animate a foreign B call or that every ingested call needs presentation. The selected A graph includes the new A facts, yet observation sampling used for its motion was global. A bounded exact-project newest-per-harness read can retain the existing coalescing/no-replay contract while matching the visible graph scope. Keep global recent-activity rail sampling independent. Project switches must seed their observation baseline rather than replay prior project history. Exact empty string project must remain distinct from All.\n\n## Limits\n\n${report.limits.map(s=>'- '+s).join('\n')}\n`);
console.log(JSON.stringify({status:'passed',cases:cases.map(c=>({scenario:c.scenario,observedProjects:c.acceptedRows.map((r:UsageEventRow)=>r.project),selectedSignals:c.signals.length,exactProjectSignals:c.exactProjectGateSignals.length}))}));
