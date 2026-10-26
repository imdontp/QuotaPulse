import assert from 'node:assert/strict';
import {test} from 'node:test';
import {openDb} from '../src/db/index.js';
import {buildServer} from '../src/api/server.js';
import {Scheduler} from '../src/ingest/scheduler.js';

const hour=3600000,from=1000,to=from+3000*hour+1,headers={'x-quotapulse-token':'owned-cost-resolution'};
function fixture(){
 const db=openDb(':memory:');db.exec(`INSERT INTO source(id,harness,profile,root_path,display_name,detected_at) VALUES(1,'codex','qa','/synthetic/one','One',0),(2,'claude-code','qa','/synthetic/two','Two',0);INSERT INTO session(id,source_id,native_session_id,project) VALUES(1,1,'one','A'),(2,2,'two',NULL)`);
 const insert=db.prepare('INSERT INTO usage_event(source_id,session_id,dedup_key,ts,model,provider,total_tokens,call_count,cost_usd,cost_source) VALUES(?,?,?,?,?,?,?,?,?,?)');
 db.transaction(()=>{for(let i=0;i<3000;i++){const kind=i%4,source=i%2+1;insert.run(source,source,'row-'+i,from+i*hour+1,'Model'+i%3,i%3?'anthropic':'openai',(kind+1)*100,kind+2,kind===3?null:kind+1,['native','computed','estimated','unknown'][kind]);}insert.run(1,1,'exclusive-to',to,'Boundary','openai',9999,1,999,'computed');insert.run(1,1,'before-from',from-1,'Boundary','openai',9999,1,999,'computed');})();
 return{db,app:buildServer(db,new Scheduler(db,[]),{token:'owned-cost-resolution'})};
}
const url=(basis:string,extra='')=>`/api/cost-analysis?basis=${basis}&bucket=hour&from=${from}&to=${to}${extra}`;
test('bounded Cost intervals reconcile every fact and ranking across API/native and exact source scopes',async()=>{
 const{db,app}=fixture();try{
  for(const basis of ['api','native'])for(const scope of ['', '&source_id=1','&source_id=2']){
   const legacyResponse=await app.inject({url:url(basis,scope),headers});assert.equal(legacyResponse.statusCode,200);const legacy=legacyResponse.json();assert.equal(legacy.bucketMs,hour);assert.equal('resolution'in legacy,false);
   const response=await app.inject({url:url(basis,scope+'&max_buckets=240'),headers});assert.equal(response.statusCode,200);const bounded=response.json();
   assert.equal(bounded.bucket,'hour');assert.equal(bounded.bucketMs,13*hour);assert.deepEqual(bounded.scope,legacy.scope);assert.deepEqual(bounded.resolution,{requestedBucketMs:hour,maxBuckets:240});assert.ok(Math.ceil((to-from)/bounded.bucketMs)<=240);
   for(const key of ['totals','providers','models','projects','sessions'])assert.deepEqual(bounded[key],legacy[key],key+' changed with chart resolution');
   for(const key of ['amount','pricedTokens','allTokens','pricedCalls','allCalls']){
    assert.equal(bounded.points.reduce((s:number,p:any)=>s+p[key],0),legacy.points.reduce((s:number,p:any)=>s+p[key],0),key);
   }
   assert.ok(bounded.points.every((p:any)=>p.start>=from&&p.start<to));assert.ok(bounded.points.length<=240);
  }
  const api=(await app.inject({url:url('api','&max_buckets=1'),headers})).json();assert.equal(api.points.length,1);assert.equal(api.totals.amount,3750);assert.equal(api.totals.allCalls,10500);assert.equal(api.totals.allTokens,750000);
 }finally{await app.close();db.close();}
});
test('small Cost ranges retain their original intervals, and an exact240-slot boundary is unchanged',async()=>{
 const{db,app}=fixture();try{
  for(const span of [10*hour+1,240*hour]){
   const base=`/api/cost-analysis?basis=api&bucket=hour&from=${from}&to=${from+span}`;
   const old=(await app.inject({url:base,headers})).json(),bounded=(await app.inject({url:base+'&max_buckets=240',headers})).json();
   assert.equal(bounded.bucketMs,hour);assert.deepEqual(bounded.points,old.points);assert.deepEqual(bounded.totals,old.totals);
  }
  const crossed=(await app.inject({url:`/api/cost-analysis?basis=api&bucket=hour&from=${from}&to=${from+240*hour+1}&max_buckets=240`,headers})).json();assert.equal(crossed.bucketMs,2*hour);
 }finally{await app.close();db.close();}
});
test('maximum valid date spans and one-bin requests stay bounded without allocating dense historical slots',async()=>{
 const{db,app}=fixture();try{
  for(const cap of [1,240,1000]){
   const r=await app.inject({url:`/api/cost-analysis?basis=api&bucket=hour&from=0&to=8640000000000000&max_buckets=${cap}`,headers});assert.equal(r.statusCode,200);const data=r.json();
   assert.ok(Math.ceil(data.scope.to/data.bucketMs)<=cap);assert.equal(data.points.length,1);assert.equal(data.totals.amount,5748);assert.equal(data.points[0].amount,data.totals.amount);
  }
 }finally{await app.close();db.close();}
});
test('Cost resolution validates its integer bounds and authentication without accepting unknown parameters',async()=>{
 const{db,app}=fixture();try{
  for(const value of ['','0','-1','1.5','1e2','1001','Infinity','9007199254740992','1&max_buckets=2'])assert.equal((await app.inject({url:url('api','&max_buckets='+value),headers})).statusCode,400,value);
  assert.equal((await app.inject({url:url('api','&maxBuckets=240'),headers})).statusCode,400);
  assert.equal((await app.inject(url('api','&max_buckets=240'))).statusCode,401);
 }finally{await app.close();db.close();}
});
test('auto/day/week bounded requests retain all selected facts and disclose their original interval',async()=>{
 const{db,app}=fixture();try{
  for(const bucket of ['auto','day','week']){
   const base=url('native').replace('bucket=hour','bucket='+bucket);const old=(await app.inject({url:base,headers})).json(),bounded=(await app.inject({url:base+'&max_buckets=7',headers})).json();
   assert.equal(bounded.resolution.requestedBucketMs,old.bucketMs);assert.ok(Math.ceil((to-from)/bounded.bucketMs)<=7);assert.equal(bounded.bucket,bucket);assert.deepEqual(bounded.totals,old.totals);
  }
 }finally{await app.close();db.close();}
});
