import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pricingState, formatValue, chartValue, foldPricingPoints, sumValues } from '../src/lib/pricing';

const money = (v: number | null | undefined, unknown = 0) => `$${v}${unknown ? '+' : ''}`;
test('value states distinguish no usage, unpriced, partial, priced zero and reference prices', () => {
  for(const [calls,unknown,cost,state,label,point] of [
    [0,0,0,'empty','$0',0], [10,10,0,'unknown','--',null], [10,10,null,'unknown','--',null],
    [10,2,26,'partial','$26+',26], [10,0,0,'complete','$0',0], [10,0,26,'complete','$26',26],
  ] as const) {
    const total = {calls,cost_unknown_calls:unknown,cost_usd:cost,cost_estimated_calls:2};
    assert.equal(pricingState(total),state);
    assert.equal(formatValue(total,money),label);
    assert.equal(chartValue(total),point);
  }
});

test('Other grouping retains weighted call coverage and gaps stay separate by time', () => {
  const rows = [
    {bucket_ts:1,series:'a',calls:100,cost_usd:0,cost_unknown_calls:100},
    {bucket_ts:1,series:'b',calls:2,cost_usd:7,cost_unknown_calls:0,cost_estimated_calls:2},
    {bucket_ts:2,series:'a',calls:30,cost_usd:0,cost_unknown_calls:30},
    {bucket_ts:3,series:'b',calls:1,cost_usd:0,cost_unknown_calls:0},
  ];
  const points = foldPricingPoints(rows,()=> 'other');
  assert.deepEqual(sumValues(rows.slice(0,2)),points.get(1)!.other);
  assert.deepEqual(points.get(1)!.other,{calls:102,cost_usd:7,cost_unknown_calls:100,cost_estimated_calls:2});
  assert.equal(formatValue(points.get(1)!.other!,money),'$7+');
  assert.equal(chartValue(points.get(2)!.other!),null);
  assert.equal(chartValue(points.get(3)!.other!),0);
});
