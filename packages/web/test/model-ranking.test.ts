import assert from 'node:assert/strict';
import test from 'node:test';
import { compareModels, type ModelMetric, type ModelOrder } from '../src/redesign/model-ranking.js';

const row = (model: string | null, provider: string | null, value: number, priced = 1, calls = 1) =>
  ({ model, provider, tokens: value, calls, api_value_usd: value, computed_calls: priced, estimated_calls: 0 });
const rank = <T extends ReturnType<typeof row>>(rows: T[], metric: ModelMetric, order: ModelOrder) =>
  [...rows].sort((a, b) => compareModels(a, b, metric, order));

test('numeric ranking switches direction without mutating source groups', () => {
  const rows = [row('b', 'p', 20, 1, 2), row('a', 'p', 10, 1, 3)];
  assert.deepEqual(rank(rows, 'tokens', 'asc').map(r => r.model), ['a', 'b']);
  assert.deepEqual(rank(rows, 'tokens', 'desc').map(r => r.model), ['b', 'a']);
  assert.deepEqual(rank(rows, 'calls', 'asc').map(r => r.model), ['b', 'a']);
  assert.equal(rows[0].model, 'b');
});
test('unknown prices stay last, while real zero and partial known values sort numerically', () => {
  const rows = [row('unknown', 'p', 0, 0), row('partial', 'p', 2, 1, 3), row('zero', 'p', 0), row('no-calls', 'p', 0, 0, 0)];
  for (const order of ['asc', 'desc'] as const) {
    const ranked = rank(rows, 'api_value_usd', order);
    assert.equal(ranked.at(-1)?.model, 'unknown');
    assert.equal(ranked.findIndex(r => r.model === 'partial'), order === 'asc' ? 2 : 0);
  }
});
test('tied model/provider identities remain distinct and stable across both directions', () => {
  const rows = [row(null, null, 4), row('', '', 4), row('same', null, 4), row('same', '', 4), row('same', 'p', 4)];
  const identities = (values: typeof rows) => values.map(r => JSON.stringify([r.model, r.provider]));
  assert.equal(new Set(identities(rank(rows, 'tokens', 'asc'))).size, 5);
  assert.deepEqual(identities(rank(rows, 'tokens', 'asc')), identities(rank([...rows].reverse(), 'tokens', 'desc')));
});
