import assert from 'node:assert/strict';
import { test } from 'node:test';
import { modelDrilldownHref } from '../src/redesign/model-drilldown.ts';

const params = (href: string) => {
  assert.ok(href.startsWith('#models?'));
  return new URLSearchParams(href.slice('#models?'.length));
};

test('Overview model drilldown carries the custom period/source/bucket independently of runtime project', () => {
  const p = params(modelDrilldownHref('#history?range=custom&from=1700000000000&to=1700000010000&source=7&bucket=hour&project=Map+project&harness=codex', 'Outside project'));
  assert.deepEqual(Object.fromEntries(p), {
    range: 'custom', from: '1700000000000', to: '1700000010000', source: '7', bucket: 'hour', model: 'Outside project',
  });
});

test('calendar period choices remain calendar choices and cannot carry stale custom bounds', () => {
  for (const range of ['today', 'week', 'month', 'all']) {
    const p = params(modelDrilldownHref(`#history?range=${range}&from=1&to=2`, 'M'));
    assert.equal(p.get('range'), range);
    assert.equal(p.has('from'), false);
    assert.equal(p.has('to'), false);
  }
});

test('model identities preserve Unicode, whitespace and query/hash characters without adding filters', () => {
  const model = ' โมเดล +/A&B?#=  ';
  const p = params(modelDrilldownHref('#history?range=week', model));
  assert.equal(p.get('model'), model);
  assert.deepEqual([...p.keys()], ['range', 'model']);
});

test('NULL, empty and literal null are distinct model identities', () => {
  const missing = params(modelDrilldownHref('#history?range=all', null));
  const empty = params(modelDrilldownHref('#history?range=all', ''));
  const literal = params(modelDrilldownHref('#history?range=all', 'null'));
  assert.equal(missing.get('model_missing'), '1');
  assert.equal(missing.has('model'), false);
  assert.equal(empty.has('model'), true);
  assert.equal(empty.get('model'), '');
  assert.equal(empty.has('model_missing'), false);
  assert.equal(literal.get('model'), 'null');
  assert.equal(literal.has('model_missing'), false);
});

test('stale model/provider selection, metric and unsupported filters do not leak into a global model destination', () => {
  const p = params(modelDrilldownHref('#history?range=today&model=Old&model_missing=1&selected_provider=wrong&selected_provider_missing=1&metric=api_value_usd&q=secret&project_missing=1&grain=call', 'New'));
  assert.deepEqual(Object.fromEntries(p), { range: 'today', model: 'New' });
});

test('an explicit supported provider scope selects that exact route, without normalizing provider/vendor strings', () => {
  const before = new URLSearchParams({ range: 'month', provider: ' Route+/x ', vendor: ' Maker A ', selected_provider: 'stale', selected_provider_missing: '1' });
  const p = params(modelDrilldownHref(`#history?${before}`, 'M'));
  assert.equal(p.get('provider'), ' Route+/x ');
  assert.equal(p.get('selected_provider'), ' Route+/x ');
  assert.equal(p.get('vendor'), ' Maker A ');
  assert.equal(p.has('selected_provider_missing'), false);
});

test('vendor-only scope does not invent a recorded provider and invalid scope falls back to today', () => {
  const p = params(modelDrilldownHref('#history?range=custom&from=9&to=2&source=-1&bucket=invalid&provider=&vendor=anthropic', 'M'));
  assert.deepEqual(Object.fromEntries(p), { range: 'today', vendor: 'anthropic', model: 'M' });
  assert.equal(p.has('selected_provider'), false);
});
