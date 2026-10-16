import assert from 'node:assert/strict';
import { test } from 'node:test';
import { usageRouteHash } from '../src/lib/usage-route.ts';
import { refreshedHistorySelection, historyRelatedSessionHref } from '../src/redesign/history-selection.ts';
import type { UsageEventRow, UsageEventScope, UsageEventsResponse } from '../src/lib/usage-events.ts';

const params = (hash: string) => new URLSearchParams(hash.split('?')[1]);

test('History range/source edits preserve the related-session constraint', () => {
  const p = params(usageRouteHash('history', { selection: { range: 'custom', from: 100, to: 200, sourceId: 7, bucket: 'day' }, view: 'summary' }, 23));
  assert.deepEqual(Object.fromEntries(p), { range: 'custom', from: '100', to: '200', bucket: 'day', source: '7', session_id: '23' });
  const changed = params(usageRouteHash('history', { selection: { range: 'all', sourceId: 2 }, view: 'summary' }, 23));
  assert.deepEqual(Object.fromEntries(changed), { range: 'all', source: '2', session_id: '23' });
});

test('invalid or cleared History session constraints never become route parameters', () => {
  for (const sessionId of [undefined, 0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    const p = params(usageRouteHash('history', { selection: { range: 'last30' }, view: 'summary' }, sessionId));
    assert.equal(p.has('session_id'), false);
  }
});

test('other usage routes retain their existing hash and do not acquire History session scope', () => {
  assert.equal(usageRouteHash('usage', { selection: { range: 'today', bucket: 'hour', sourceId: 2 }, view: 'cost' }, 23), '#usage?range=today&bucket=hour&source=2&view=cost');
  assert.equal(usageRouteHash('sessions', { selection: { range: 'all' }, view: 'summary' }, 23), '#sessions?range=all');
  assert.equal(usageRouteHash('history', { selection: { range: 'last30' }, view: 'summary' }), '#history?range=last30');
});

const record = (event_id: number, total_tokens: number, cost_usd: number | null): UsageEventRow => ({ event_id, total_tokens, cost_usd, grain: 'session_aggregate' } as UsageEventRow);

const origin: UsageEventScope = { from: 100, to: 200, sourceId: 2, project: 'Exact+/Project', grain: 'session_aggregate' };
const snapshot = (rows: UsageEventRow[], scope: UsageEventScope = origin): UsageEventsResponse => ({ rows, scope, total: rows.length, limit: 50, offset: 0, now: 200 });

test('selected aggregate details follow the accepted row by stable event_id despite reordered page rows', () => {
  const row = record(19, 100, null);
  const selected = { row, scope: origin };
  const updated = { ...row, total_tokens: 250, reasoning_tokens: 45, cost_usd: 0.7, cost_source: 'computed' };
  const scope = { ...origin, from: 120, to: 220 };
  const refreshed = refreshedHistorySelection(selected, snapshot([record(20, 900, 4), updated], scope));
  assert.equal(refreshed?.row, updated);
  assert.equal(refreshed?.row.total_tokens, 250);
  assert.equal(refreshed?.row.cost_usd, 0.7);
  assert.equal(refreshed?.scope, scope);
});

test('retained selection keeps its original related-record scope when absent from a new page/query', () => {
  const selected = { row: record(19, 100, null), scope: origin };
  const newScope = { from: 500, to: 600, sourceId: 7, model: 'Unrelated' };
  const retained = refreshedHistorySelection(selected, snapshot([record(20, 900, 4)], newScope));
  assert.equal(retained, selected);
  assert.deepEqual(retained?.scope, origin);
  assert.equal(refreshedHistorySelection(selected, snapshot([], newScope)), selected);
});

test('live snapshots never reopen a closed detail rail or replace its selection with another event', () => {
  assert.equal(refreshedHistorySelection(null, snapshot([record(19, 100, null)])), null);
});

test('related-session navigation uses retained origin range/source/filters and the actual selected session', () => {
  const selected = { row: { ...record(19, 100, null), session_key: 23 }, scope: { ...origin, sessionId: 8, q: 'metadata +/%', provider: 'Exact Route' } };
  const retained = refreshedHistorySelection(selected, snapshot([record(20, 900, 4)], { from: 500, to: 600, sourceId: 7 }));
  assert.deepEqual(Object.fromEntries(params(historyRelatedSessionHref(retained)!)), {
    from: '100', to: '200', session_id: '23', project: 'Exact+/Project', provider: 'Exact Route', q: 'metadata +/%', grain: 'session_aggregate', range: 'custom', source: '2',
  });
  assert.equal(historyRelatedSessionHref(null), null);
  assert.equal(historyRelatedSessionHref({ row: { ...selected.row, session_key: null }, scope: origin }), null);
});
