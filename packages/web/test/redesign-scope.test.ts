import assert from 'node:assert/strict';
import { test } from 'node:test';
import { rangeScope, readScope, selectedScope, writeScope } from '../src/redesign/scope.ts';

test('redesign week and month use local calendar boundaries', () => {
  const now = new Date(2026, 9, 1, 12, 30).getTime(); // Thursday, October 1
  assert.equal(rangeScope('today', now).from, new Date(2026, 9, 1).getTime());
  assert.equal(rangeScope('week', now).from, new Date(2026, 8, 28).getTime());
  assert.equal(rangeScope('month', now).from, new Date(2026, 9, 1).getTime());
  assert.equal(rangeScope('all', now).from, 0);
  assert.equal(rangeScope('last30', now).from, now - 30 * 86_400_000);
  assert.equal(rangeScope('month', now).to, now + 1);
});

test('imported custom ranges and source filters survive UI changes and API binding', () => {
  const scope = readScope(new URLSearchParams('range=custom&from=0&to=10000&source=2&bucket=hour'), 'month');
  assert.deepEqual(selectedScope(scope, 20000), { from: 0, to: 10000, sourceId: 2 });
  const params = writeScope(new URLSearchParams(), scope);
  assert.equal(params.get('source'), '2');
  assert.equal(params.get('from'), '0');
  assert.equal(params.get('bucket'), 'hour');
  const changed = writeScope(params, { ...scope, range: 'month' });
  assert.equal(changed.has('from'), false);
  assert.equal(changed.has('to'), false);
  assert.equal(changed.get('source'), '2');
});

test('invalid custom ranges and filters fall back instead of issuing invalid reads', () => {
  for (const query of ['range=custom&to=100', 'range=custom&from=100&to=100', 'range=custom&from=-1&to=100', 'range=custom&from=0&to=9000000000000000']) {
    assert.equal(readScope(new URLSearchParams(query), 'month').range, 'month');
  }
  assert.deepEqual(readScope(new URLSearchParams('source=NaN&bucket=invalid'), 'all'), { range: 'all' });
  assert.equal(readScope(new URLSearchParams('range=last30'), 'all', true).range, 'last30');
});
