import assert from 'node:assert/strict';
import test from 'node:test';
import { quickStatsLinks } from '../src/redesign/quick-stats-scope';

test('pending usage has no actions; machine-wide pages retain legacy destinations', () => {
  assert.deepEqual(quickStatsLinks(null), { projects: undefined, models: undefined, providers: undefined, live: undefined });
  assert.deepEqual(quickStatsLinks(), { projects: '#projects?range=all', models: '#models?range=all', providers: '#providers', live: '#live' });
});

test('time and source remain exact in supported destinations without inventing Live custom scope', () => {
  const links = quickStatsLinks({ from: 123, to: 456, sourceId: 7 });
  for (const page of ['projects', 'models'] as const) {
    const params = new URLSearchParams(links[page]!.split('?')[1]);
    assert.equal(params.get('range'), 'custom');
    assert.equal(params.get('from'), '123');
    assert.equal(params.get('to'), '456');
    assert.equal(params.get('source'), '7');
  }
  assert.equal(links.live, undefined);
  assert.equal(links.providers, undefined);
});

test('harness Projects and provider/vendor Models keep exact raw filter identities', () => {
  const projects = quickStatsLinks({ from: 0, to: 456, harness: 'a & b' });
  assert.equal(new URLSearchParams(projects.projects!.split('?')[1]).get('harness'), 'a & b');
  assert.equal(projects.models, undefined);
  const models = quickStatsLinks({ from: 0, to: 456, provider: 'unknown / route', vendor: 'maker & one' });
  const params = new URLSearchParams(models.models!.split('?')[1]);
  assert.equal(params.get('provider'), 'unknown / route');
  assert.equal(params.get('vendor'), 'maker & one');
  assert.equal(models.projects, undefined);
});

test('unsupported table filters never create apparently scoped actions', () => {
  for (const restriction of [{ project: 'a' }, { projectMissing: true }, { model: 'm' }, { sessionId: 4 }, { q: 'search' }, { grain: 'call' as const }]) {
    const links = quickStatsLinks({ from: 0, to: 456, ...restriction });
    assert.equal(links.projects, undefined);
    assert.equal(links.models, undefined);
  }
  assert.ok(quickStatsLinks({ from: 0, to: 456, grain: 'all', projectMissing: false }).projects);
});
