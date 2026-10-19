import assert from 'node:assert/strict';
import { test } from 'node:test';
import { comparisonPageSelection } from '../src/redesign/model-comparison-page.ts';
import { modelPairKey, modelRowTrend } from '../src/redesign/model-row-trends.ts';
import { effortPage } from '../src/redesign/effort-page.ts';

test('exact model/provider keys preserve null, empty and literal Unknown identities', () => {
  const pairs = [null, '', 'Unknown'].flatMap(model => [null, '', 'Unknown'].map(provider => ({ model, provider })));
  assert.equal(new Set(pairs.map(modelPairKey)).size, 9);
});

test('real sparse row buckets fill only valid scope gaps and never borrow provider curves', () => {
  const data = { now: 1, scope: { from: 100, to: 400 }, bucketMs: 100, pairs: [
    { model: 'a', provider: null, points: [{ start: 200, tokens: 7, records: 1, calls: 12 }] },
    { model: 'a', provider: '', points: [{ start: 100, tokens: 0, records: 1, calls: 1 }] },
    { model: 'b', provider: null, points: [] },
  ] };
  assert.deepEqual(modelRowTrend(data, { model: 'a', provider: null }), [{ at: 100, value: 0 }, { at: 200, value: 7 }, { at: 300, value: 0 }]);
  assert.deepEqual(modelRowTrend(data, { model: 'a', provider: '' }), [{ at: 100, value: 0 }, { at: 200, value: 0 }, { at: 300, value: 0 }]);
  assert.deepEqual(modelRowTrend(data, { model: 'b', provider: null }), []);
  assert.equal(modelRowTrend(data, { model: 'a', provider: 'Unknown' }), null);
  assert.equal(modelRowTrend(null, { model: 'a', provider: null }), null);
  assert.equal(modelRowTrend({ ...data, bucketMs: 0 }, { model: 'a', provider: null }), null);
});

test('deep-link selection waits for accepted list then reveals its page once', () => {
  const initial = { scopeKey: '', selectionKey: '', page: 0 };
  const pending = comparisonPageSelection(initial, 'scope', 'selected-a', undefined, -1);
  assert.equal(pending.selectionKey, '');
  const accepted = comparisonPageSelection(pending, 'scope', 'selected-a', 1240, 53);
  assert.equal(accepted.page, 2);
  const manual = { ...accepted, page: 5 };
  assert.equal(comparisonPageSelection(manual, 'scope', 'selected-a', 1240, 53), manual);
  assert.equal(comparisonPageSelection(manual, 'scope', 'selected-b', 1240, 83).page, 4);
});

test('comparison refresh preserves manual page, shrink clamps persistently and scope changes reset', () => {
  const selected = { scopeKey: 'a', selectionKey: 'selected', page: 5 };
  assert.equal(comparisonPageSelection(selected, 'a', 'selected', undefined, -1), selected);
  const shrunk = comparisonPageSelection(selected, 'a', 'selected', 21, 0);
  assert.equal(shrunk.page, 1);
  assert.equal(comparisonPageSelection(shrunk, 'a', 'selected', 1240, 0), shrunk);
  assert.equal(comparisonPageSelection(shrunk, 'b', 'selected', 1240, -1).page, 0);
});

test('20-row comparison pages expose every ranked pair without changing full list or totals', () => {
  const pairs = Array.from({ length: 1240 }, (_, i) => ({ model: String(i), provider: null, tokens: 1240 - i }));
  const rows = Array.from({ length: 62 }, (_, page) => effortPage(pairs, page).rows).flat();
  assert.deepEqual(rows, pairs);
  assert.equal(effortPage(pairs, 0).total, 1240);
  for (const count of [0, 1, 20]) {
    const result = effortPage(pairs.slice(0, count), 0);
    assert.equal(result.hasNext, false);
    assert.equal(result.hasPrevious, false);
  }
});
