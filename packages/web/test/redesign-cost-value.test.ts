import assert from 'node:assert/strict';
import { test } from 'node:test';
import { costValue, recordCostCoverage } from '../src/redesign/cost-value.tsx';
import { fixtureRecords } from '../src/redesign/fixture.ts';

const money = (amount: number) => `$${amount.toFixed(2)}`;
test('money distinguishes no usage, absent prices, known zero and partial weighted coverage', () => {
  assert.equal(costValue(0, 0, 0, money, 'Unknown'), '$0.00');
  assert.equal(costValue(0, 0, 30, money, 'Unknown'), 'Unknown');
  assert.equal(costValue(0, 30, 30, money, 'Unknown'), '$0.00');
  assert.equal(costValue(0, 20, 30, money, 'Unknown'), '$0.00+');
  assert.equal(costValue(12.5, 20, 30, money, 'Unknown'), '$12.50+');
  assert.equal(costValue(12.5, 30, 30, money, 'Unknown'), '$12.50');
});

test('preview uses records, excludes null costs and combines computed and estimated API prices', () => {
  assert.deepEqual(recordCostCoverage(fixtureRecords), { native: 1, api: 3, total: 5 });
  const base = fixtureRecords[0]!;
  assert.deepEqual(recordCostCoverage([
    { ...base, cost: 0, costSource: 'native' },
    { ...base, cost: null, costSource: 'native' },
    { ...base, cost: 0, costSource: 'computed' },
    { ...base, cost: 1, costSource: 'estimated' },
    { ...base, cost: 1, costSource: 'unknown' },
  ]), { native: 1, api: 2, total: 5 });
});
