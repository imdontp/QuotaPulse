import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createModelSummaryLoader } from '../src/lib/model-summary-request';

test('modern summary is one scoped read; all returned facts are retained without mutating the response', async () => {
  const paths: string[] = [];
  const response = { totals: { tokens: 123 }, groups: [null, '', 'same'], breakdown: 'omitted' };
  const load = createModelSummaryLoader(async path => { paths.push(path); return response; });
  assert.deepEqual(await load('/api/models?detailed=1&project=a%26b'), response);
  assert.deepEqual(paths, ['/api/models?detailed=1&project=a%26b&breakdown=0']);
  assert.equal(response.groups.length, 3);
});

test('older daemon fallback retains exact scope and caches only a successful full read', async () => {
  const paths: string[] = [];
  const response = { groups: [1, 2], totals: { calls: 9 }, rows: ['unused'] };
  const load = createModelSummaryLoader(async path => {
    paths.push(path);
    if (path.includes('breakdown=')) throw { status: 400 };
    return response;
  });
  assert.deepEqual(await load('/api/models?detailed=1&from=1&to=2'), { groups: [1, 2], totals: { calls: 9 } });
  await load('/api/models?detailed=1&from=3&to=4');
  assert.deepEqual(paths, ['/api/models?detailed=1&from=1&to=2&breakdown=0', '/api/models?detailed=1&from=1&to=2', '/api/models?detailed=1&from=3&to=4']);
  assert.deepEqual(response.rows, ['unused']);
});

test('auth, network and server failures do not retry or disable modern mode', async () => {
  for (const failure of [{ status: 401 }, { status: 403 }, { status: 500 }, new TypeError('offline')]) {
    const paths: string[] = [];
    let rejected = true;
    const load = createModelSummaryLoader(async path => { paths.push(path); if (rejected) throw failure; return { groups: [] }; });
    await assert.rejects(load('/api/models?detailed=1'), error => error === failure);
    assert.equal(paths.length, 1);
    rejected = false;
    await load('/api/models?detailed=1');
    assert.ok(paths.every(path => path.endsWith('&breakdown=0')));
  }
});

test('invalid scope does not establish fallback capability; ignored opt-in cannot leak rows into UI state', async () => {
  const paths: string[] = [];
  const load = createModelSummaryLoader(async path => {
    paths.push(path);
    if (path.includes('from=bad')) throw { status: 400 };
    return { groups: ['all'], rows: ['legacy breakdown'] };
  });
  await assert.rejects(load('/api/models?detailed=1&from=bad'));
  assert.deepEqual(await load('/api/models?detailed=1&from=1'), { groups: ['all'] });
  assert.equal(paths[2], '/api/models?detailed=1&from=1&breakdown=0');
});
