import assert from 'node:assert/strict';
import {test} from 'node:test';
import {costDisplayTimeline,costIntervalLabel} from '../src/redesign/cost-display-timeline.ts';
import {costSummaryTrends} from '../src/redesign/cost-summary-trends.ts';

const hour=3600000;
const point=(start:number,amount=1)=>({start,amount,pricedTokens:100,allTokens:200,pricedCalls:2,allCalls:5});
test('a prior unbounded response is summed into complete adjacent intervals with exact scope anchoring',()=>{
 const scope={from:67,to:67+481*hour+1},points=[point(67,2),point(67+hour,3),point(67+3*hour,4),point(67+480*hour,5)],original=JSON.stringify(points);
 const data=costDisplayTimeline({scope,bucketMs:hour,points});assert.equal(data.bucketMs,3*hour);assert.equal(data.points.length,161);assert.equal(data.adjusted,true);
 assert.equal(data.points[0]!.start,67);assert.equal(data.points[0]!.amount,5);assert.equal(data.points[1]!.amount,4);assert.equal(data.points.at(-1)!.amount,5);
 assert.equal(data.points.reduce((s,p)=>s+p.amount,0),14);assert.equal(data.points.reduce((s,p)=>s+p.pricedCalls,0),8);assert.equal(data.points.reduce((s,p)=>s+p.allCalls,0),20);assert.equal(JSON.stringify(points),original);
});
test('the exact240-interval limit does not change values or resolution; crossing by1ms does',()=>{
 const points=[point(0),point(239*hour,2)];const exact=costDisplayTimeline({scope:{from:0,to:240*hour},bucketMs:hour,points});assert.equal(exact.points.length,240);assert.equal(exact.bucketMs,hour);assert.equal(exact.adjusted,false);
 const crossed=costDisplayTimeline({scope:{from:0,to:240*hour+1},bucketMs:hour,points});assert.equal(crossed.points.length,121);assert.equal(crossed.bucketMs,2*hour);
});
test('server-coarsened metadata remains visible even when no further browser aggregation is needed',()=>{
 const data=costDisplayTimeline({scope:{from:0,to:3000*hour},bucketMs:13*hour,resolution:{requestedBucketMs:hour,maxBuckets:240},points:[point(0),point(2990*hour)]});assert.equal(data.bucketMs,13*hour);assert.equal(data.requestedBucketMs,hour);assert.equal(data.adjusted,true);assert.ok(data.points.length<=240);
});
test('the maximum date-bound response creates only240 slots and retains all supplied facts',()=>{
 const data=costDisplayTimeline({scope:{from:0,to:8640000000000000},bucketMs:hour,points:[point(0,4),point(8640000000000000-hour,8)]});assert.equal(data.points.length,240);assert.equal(data.points.reduce((s,p)=>s+p.amount,0),12);assert.ok(Number.isFinite(data.bucketMs));
});
test('coarsened cumulative summaries preserve the final known average and priced-token quotient',()=>{
 const scope={from:0,to:481*hour},data=costDisplayTimeline({scope,bucketMs:hour,points:[point(0,2),point(480*hour,6)]});const summary=costSummaryTrends(data.points,scope,data.bucketMs,scope.to);assert.equal(summary.average.at(-1)!.value,8/(481/24));assert.equal(summary.perThousand.at(-1)!.value,40);
});
test('invalid scope or intervals fail before materialization rather than constructing an unbounded array',()=>{
 for(const bucketMs of [0,-1,NaN,Infinity])assert.throws(()=>costDisplayTimeline({scope:{from:0,to:100},bucketMs,points:[]}));assert.throws(()=>costDisplayTimeline({scope:{from:100,to:100},bucketMs:hour,points:[]}));
});
test('out-of-scope samples are rejected instead of silently dropping facts',()=>{
 for(const start of [-1,10*hour])assert.throws(()=>costDisplayTimeline({scope:{from:0,to:10*hour},bucketMs:hour,points:[point(start)]}));
});
test('displayed interval duration uses the real interval and localized units',()=>{
 assert.equal(costIntervalLabel(3*hour,'en'),'3 hours');assert.equal(costIntervalLabel(48*hour,'en'),'2 days');assert.ok(costIntervalLabel(3*hour,'th').includes('ชั่วโมง'));
});
