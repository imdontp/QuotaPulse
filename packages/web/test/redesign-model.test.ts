import assert from 'node:assert/strict';
import { test } from 'node:test';
import { defaultQuota, groupUsage, quotaState, runtimeActivityState, runtimeEdges, runwayState, summarize } from '../src/redesign/model.ts';
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

test('runtime activity reflects recorded use within the API window and keeps future or missing time unknown', () => {
  assert.equal(runtimeActivityState(fixtureNow - 300000, fixtureNow), 'active');
  assert.equal(runtimeActivityState(fixtureNow - 300001, fixtureNow), 'idle');
  assert.equal(runtimeActivityState(fixtureNow + 1, fixtureNow), 'unknown');
  assert.equal(runtimeActivityState(null, fixtureNow), 'unknown');
  assert.equal(runtimeActivityState(Number.NaN, fixtureNow), 'unknown');
});

test('quota risk belongs to one fresh owner/window, invalid values are not normalized into healthy readings', () => {
  const quota = fixtureQuotas[0];
  assert.deepEqual(quotaState(quota, fixtureNow, 300000), { stale: false, remaining: 62, risk: 'normal' });
  assert.equal(quotaState(fixtureQuotas[1], fixtureNow, 300000).risk, 'warning');
  assert.equal(quotaState({ ...quota, usedPercent: 95 }, fixtureNow, 300000).risk, 'critical');
  assert.equal(quotaState({ ...quota, usedPercent: 101 }, fixtureNow, 300000).remaining, 0);
  assert.equal(quotaState({ ...quota, usedPercent: 101 }, fixtureNow, 300000).risk, 'critical');
  assert.equal(quotaState({ ...quota, usedPercent: 60, projectedFullAt: fixtureNow + 60000 }, fixtureNow, 300000).risk, 'critical');
  assert.equal(quotaState({ ...quota, freshness: 'stale' }, fixtureNow, 300000).risk, 'unknown');
  assert.equal(quotaState({ ...quota, observedAt: fixtureNow - 600000, confirmedAt: fixtureNow - 60000 }, fixtureNow, 300000).risk, 'normal');
  assert.equal(quotaState({ ...quota, observedAt: fixtureNow - 300001 }, fixtureNow, 300000).risk, 'unknown');
  assert.equal(quotaState({ ...quota, resetAt: fixtureNow }, fixtureNow, 300000).risk, 'unknown');
  assert.equal(quotaState({ ...quota, observedAt: fixtureNow + 1 }, fixtureNow, 300000).risk, 'unknown');
  for (const usedPercent of [null, -1, NaN, Infinity]) {
    assert.equal(quotaState({ ...quota, usedPercent }, fixtureNow, 300000).remaining, null);
    assert.equal(quotaState({ ...quota, usedPercent }, fixtureNow, 300000).risk, 'unknown');
  }
});

test('default core picks the most used fresh window and stays unavailable when all are stale', () => {
  assert.equal(defaultQuota(fixtureQuotas, fixtureNow, 300000)?.id, 'anthropic-weekly');
  const stale = fixtureQuotas.map(quota => ({ ...quota, confirmedAt: fixtureNow - 600000 }));
  assert.equal(defaultQuota(stale, fixtureNow, 300000), undefined);
  assert.equal(defaultQuota([{ ...fixtureQuotas[0]!, usedPercent: null }], fixtureNow, 300000), undefined);
});

test('runway uses percentage points of the selected window and suppresses stale projections', () => {
  const quota = { ...fixtureQuotas[0]!, forecastStatus: 'ready' as const, projectedFullAt: fixtureNow + 3_600_000 };
  assert.deepEqual(runwayState(quota, fixtureNow, 300000), {
    status: 'ready', safePace: 31, hoursUntilReset: 2,
    projectedFullAt: fixtureNow + 3_600_000, projectedBeforeReset: true, forecastStatus: 'ready',
  });
  assert.equal(runwayState({ ...quota, confirmedAt: fixtureNow - 600000 }, fixtureNow, 300000).reason, 'stale');
  assert.equal(runwayState({ ...quota, resetAt: fixtureNow }, fixtureNow, 300000).reason, 'reset');
  assert.equal(runwayState({ ...quota, resetAt: 0 }, fixtureNow, 300000).reason, 'noReset');
  assert.equal(runwayState({ ...quota, usedPercent: null }, fixtureNow, 300000).reason, 'unknown');
  assert.equal(runwayState(undefined, fixtureNow, 300000).reason, 'noQuota');
  assert.equal(runwayState({ ...quota, forecastStatus: 'insufficient' }, fixtureNow, 300000).projectedFullAt, null);
});
