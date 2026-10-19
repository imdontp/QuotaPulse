import assert from 'node:assert/strict';
import { test } from 'node:test';
import { effortPage, effortPageSelection, EFFORT_PAGE_SIZE } from '../src/redesign/effort-page.ts';

test('all 20,000 exact categories remain reachable in their original order, including NULL and empty', () => {
  const rows = [null, '', ...Array.from({ length: 19_998 }, (_, i) => `custom-${i}`)].map((effort, i) => ({ effort, tokens: i + 1 }));
  const reconstructed = [];
  for (let page = 0; page < rows.length / EFFORT_PAGE_SIZE; page++) {
    const window = effortPage(rows, page);
    assert.equal(window.rows.length, 20);
    assert.equal(window.from, page * 20 + 1);
    assert.equal(window.to, (page + 1) * 20);
    assert.equal(window.total, 20_000);
    assert.equal(window.hasPrevious, page > 0);
    assert.equal(window.hasNext, page < 999);
    reconstructed.push(...window.rows);
  }
  assert.deepEqual(reconstructed, rows);
  assert.equal(reconstructed[0].effort, null);
  assert.equal(reconstructed[1].effort, '');
  assert.equal(reconstructed.reduce((sum, row) => sum + row.tokens, 0), 200_010_000);
});

test('small and empty distributions retain the original array and need no paging controls', () => {
  for (const length of [0, 1, 6, 20]) {
    const rows = Array.from({ length }, (_, i) => i);
    const page = effortPage(rows, 0);
    assert.equal(page.rows, rows);
    assert.equal(page.hasPrevious, false);
    assert.equal(page.hasNext, false);
    assert.equal(page.from, length ? 1 : 0);
    assert.equal(page.to, length);
  }
});

test('21-category boundary and final partial page preserve complete access', () => {
  const rows = Array.from({ length: 21 }, (_, i) => i);
  assert.deepEqual(effortPage(rows, 0).rows, rows.slice(0, 20));
  assert.deepEqual(effortPage(rows, 1).rows, [20]);
  assert.deepEqual(effortPage(rows, 999).rows, [20]);
  assert.deepEqual(effortPage(rows, -1).rows, rows.slice(0, 20));
});

test('refresh preserves page; actual scope changes reset; shrinking counts clamp persistently', () => {
  const selected = { scopeKey: 'month:model-a', page: 8 };
  assert.equal(effortPageSelection(selected, selected.scopeKey, 20000), selected);
  assert.equal(effortPageSelection(selected, selected.scopeKey, undefined), selected, 'pending refresh is not an empty distribution');
  assert.deepEqual(effortPageSelection(selected, 'week:model-a', undefined), { scopeKey: 'week:model-a', page: 0 });
  const shrunk = effortPageSelection(selected, selected.scopeKey, 45);
  assert.deepEqual(shrunk, { scopeKey: selected.scopeKey, page: 2 });
  assert.equal(effortPageSelection(shrunk, shrunk.scopeKey, 20000), shrunk);
  assert.deepEqual(effortPageSelection(shrunk, 'month:model-b', 20000), { scopeKey: 'month:model-b', page: 0 });
  assert.deepEqual(effortPageSelection(shrunk, 'week:model-a', 20000), { scopeKey: 'week:model-a', page: 0 });
  assert.deepEqual(effortPageSelection(shrunk, shrunk.scopeKey, 0), { scopeKey: shrunk.scopeKey, page: 0 });
});
