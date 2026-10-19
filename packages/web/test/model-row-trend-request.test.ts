import assert from 'node:assert/strict';
import { test } from 'node:test';
import { modelRowTrendRequest } from '../src/lib/model-row-trend-request.ts';

test('short exact identities use one GET with all scope and pair fields', () => {
  const scope = new URLSearchParams({ from: '1', to: '2', source: '3', vendor: 'maker' });
  const pairs = [{ model: null, provider: '' }, { model: 'Unknown', provider: 'a&b' }];
  const result = modelRowTrendRequest(scope, pairs);
  assert.equal(result.body, undefined);
  const parsed = new URL(result.path, 'http://localhost');
  for (const [key, value] of scope) assert.equal(parsed.searchParams.get(key), value);
  assert.deepEqual(JSON.parse(parsed.searchParams.get('pairs')!), pairs);
  assert.equal(scope.has('pairs'), false);
});

test('twenty maximal Unicode pairs use one read POST with exact identities and unchanged scope', () => {
  const scope = new URLSearchParams({ from: '1', to: '2', provider: 'exact route', grain: 'call' });
  const pairs = Array.from({ length: 20 }, (_, i) => ({ model: '\u0e01'.repeat(4095) + i % 10, provider: '\u4e2d'.repeat(4095) + i % 10 }));
  const result = modelRowTrendRequest(scope, pairs);
  assert.ok(result.body);
  assert.deepEqual(JSON.parse(result.body), { pairs });
  assert.equal(new URL(result.path, 'http://localhost').searchParams.toString(), scope.toString());
  assert.ok(new TextEncoder().encode(result.path).byteLength < 8_000);
});

test('GET threshold is inclusive and crossing it changes only transport', () => {
  const pairs = [{ model: 'a', provider: null }];
  const base = modelRowTrendRequest(new URLSearchParams({ q: '' }), pairs).path.length;
  const atLimit = modelRowTrendRequest(new URLSearchParams({ q: 'x'.repeat(8_000 - base) }), pairs);
  assert.equal(atLimit.path.length, 8_000);
  assert.equal(atLimit.body, undefined);
  const above = modelRowTrendRequest(new URLSearchParams({ q: 'x'.repeat(8_001 - base) }), pairs);
  assert.deepEqual(JSON.parse(above.body!), { pairs });
  assert.equal(new URL(above.path, 'http://localhost').searchParams.get('q')!.length, 8_001 - base);
});
