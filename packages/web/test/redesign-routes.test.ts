import assert from 'node:assert/strict';
import { test } from 'node:test';
import { canonicalHash } from '../src/redesign/routes.ts';

test('legacy destinations migrate to canonical pages', () => {
  for (const [incoming, expected] of [
    ['', '#overview'], ['#unknown', '#overview'], ['#usage', '#overview'],
    ['#usage?view=cost', '#cost?range=all'], ['#usage?view=projects', '#projects?range=month'],
    ['#usage?view=models', '#models?range=month'], ['#today', '#overview?range=today'],
    ['#trend', '#overview?range=month'], ['#sessions', '#history'], ['#sources', '#providers'],
    ['#limits', '#providers?section=quotas'], ['#health', '#settings?section=diagnostics'],
    ['#live', '#live'], ['#alerts', '#alerts'], ['#settings', '#settings'],
  ]) assert.equal(canonicalHash(incoming), expected);
});

test('migration preserves explicit scope and entity keys and consumes legacy view', () => {
  const hash = canonicalHash('#usage?view=models&range=custom&from=0&to=1000&source=2&bucket=hour&model=gpt%2Ftest&provider=local');
  assert.equal(hash.split('?')[0], '#models');
  const params = new URLSearchParams(hash.split('?')[1]);
  assert.equal(params.has('view'), false);
  assert.equal(params.get('from'), '0');
  assert.equal(params.get('to'), '1000');
  assert.equal(params.get('source'), '2');
  assert.equal(params.get('bucket'), 'hour');
  assert.equal(params.get('model'), 'gpt/test');
  assert.equal(params.get('provider'), 'local');
  assert.equal(canonicalHash('#trend?range=week'), '#overview?range=week');
  assert.equal(canonicalHash(canonicalHash('#health?source_id=2')), '#settings?source_id=2&section=diagnostics');
});

test('invalid legacy scopes use valid destination defaults', () => {
  const params = new URLSearchParams(canonicalHash('#usage?view=cost&range=custom&from=20&to=10&source=-2&bucket=invalid').split('?')[1]);
  assert.equal(params.get('range'), 'all');
  for (const field of ['from', 'to', 'source', 'bucket']) assert.equal(params.has(field), false);
});
