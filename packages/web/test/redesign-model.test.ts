import assert from 'node:assert/strict';
import { test } from 'node:test';
import { groupUsage, quotaState, runtimeEdges, summarize } from '../src/redesign/model.ts';
import { fixtureNow, fixtureQuotas, fixtureRecords } from '../src/redesign/fixture.ts';

test('usage preserves distinct sessions, record grain and separate money bases', () => {
  assert.deepEqual(summarize(fixtureRecords), { tokens: 1000000, sessions: 4, callRecords: 4, aggregateRecords: 1, reportedCost: 2.4, apiValue: 2.6500000000000004, unknownCostRecords: 1 });
  assert.equal(groupUsage(fixtureRecords, 'project').find(row => row.key === 'QuotaPulse')?.sessions, 1);
  for (const dimension of ['project', 'harness', 'provider', 'model'] as const) {
    assert.equal(groupUsage(fixtureRecords, dimension).reduce((sum, row) => sum + row.tokens, 0), 1000000);
  }
  assert.equal(groupUsage(fixtureRecords, 'project').find(row => row.key === null)?.tokens, 150000);
});

test('runtime edges contain only observed relationships and conserve each column total', () => {
  const edges = runtimeEdges(fixtureRecords);
  for (const column of [0, 1, 2]) assert.equal(edges.filter(edge => edge.column === column).reduce((sum, edge) => sum + edge.tokens, 0), 1000000);
  assert.equal(edges.some(edge => edge.from === 'Codex' && edge.to === 'Anthropic'), false);
  assert.equal(runtimeEdges([]).length, 0);
});

test('quota risk belongs to one fresh owner/window, invalid values are not normalized into healthy readings', () => {
  const quota = fixtureQuotas[0];
  assert.deepEqual(quotaState(quota, fixtureNow, 300000), { stale: false, remaining: 62, risk: 'normal' });
  assert.equal(quotaState(fixtureQuotas[1], fixtureNow, 300000).risk, 'warning');
  assert.equal(quotaState({ ...quota, usedPercent: 95 }, fixtureNow, 300000).risk, 'critical');
  assert.equal(quotaState({ ...quota, observedAt: fixtureNow - 300001 }, fixtureNow, 300000).risk, 'unknown');
  assert.equal(quotaState({ ...quota, resetAt: fixtureNow }, fixtureNow, 300000).risk, 'unknown');
  assert.equal(quotaState({ ...quota, observedAt: fixtureNow + 1 }, fixtureNow, 300000).risk, 'unknown');
  for (const usedPercent of [null, -1, 101, NaN, Infinity]) {
    assert.equal(quotaState({ ...quota, usedPercent }, fixtureNow, 300000).remaining, null);
    assert.equal(quotaState({ ...quota, usedPercent }, fixtureNow, 300000).risk, 'unknown');
  }
});
