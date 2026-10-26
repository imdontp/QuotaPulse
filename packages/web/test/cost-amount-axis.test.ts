import assert from 'node:assert/strict';
import {test} from 'node:test';
import {costAmountAxis} from '../src/redesign/cost-amount-axis.ts';
const ticks=[1,.75,.5,.25,0];

test('sub-cent monetary ticks remain distinct in both languages and currencies',()=>{
 for(const language of ['en','th']as const)for(const currency of ['USD','THB']as const)for(const maximum of [.0123,.0000123,.0000000123,1e-28]){
  const axis=costAmountAxis(maximum,language,currency,37.25);
  assert.equal(new Set(ticks.map(t=>axis.format(maximum*t))).size,5);
 }
 assert.deepEqual(ticks.map(t=>costAmountAxis(.0123,'en','USD',37.25).format(t*.0123)),['$0.012','$0.009','$0.006','$0.003','$0.00']);
});
test('precision uses the converted quarter-step rather than the source currency',()=>{
 const usd=costAmountAxis(.0123,'en','USD',37.25),thb=costAmountAxis(.0123,'en','THB',37.25);
 assert.equal(usd.precise,true);assert.equal(thb.precise,false);
 const expected=new Intl.NumberFormat('en-US',{style:'currency',currency:'THB'});
 assert.deepEqual(ticks.map(t=>thb.format(t*.0123)),ticks.map(t=>expected.format(t*.0123*37.25)));
});
test('ordinary ranges retain exact existing currency formatting',()=>{
 for(const language of ['en','th']as const)for(const currency of ['USD','THB']as const)for(const maximum of [.04,12.3,1842.36,1e9]){
  const axis=costAmountAxis(maximum,language,currency,37.25),expected=new Intl.NumberFormat(language==='th'?'th-TH':'en-US',{style:'currency',currency});
  assert.equal(axis.precise,false);
  assert.deepEqual(ticks.map(t=>axis.format(maximum*t)),ticks.map(t=>expected.format(maximum*t*(currency==='THB'?37.25:1))));
 }
});
test('zero remains zero and tiny ranges use compact scientific currency labels',()=>{
 const zero=costAmountAxis(0,'en','USD',1);assert.equal(zero.precise,false);assert.equal(zero.format(0),'$0.00');
 const tiny=costAmountAxis(.0000000123,'en','USD',1);assert.equal(tiny.precise,true);assert.match(tiny.format(.0000000123),/^\$1\.23E-8$/);assert.equal(tiny.format(0),'$0.00');
});
