import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { ProviderModelMinuteResponse } from '../src/api.ts';
import { liveMinuteBuckets, liveMinutePairKey, liveMinutePairs } from '../src/redesign/live-minute-data.ts';

type Pair = { provider: string | null; model: string | null };
const group = (pair: Pair, tokens = 100, callRecords = 1) => ({ ...pair, tokens, records: callRecords + 1,
  calls: callRecords + 10, callRecords, aggregateRecords: 1, unknownRecords: 0 });
const row = (pair: Pair, at: number, tokens: number) => ({ ...pair, series: liveMinutePairKey(pair), bucket_ts: at,
  records: 1, calls: 1, total_tokens: tokens, input_tokens: tokens, cached_input_tokens: 0, cache_write_tokens: 0, output_tokens: 0 });
const response = (groups: ProviderModelMinuteResponse['groups'], rows: ProviderModelMinuteResponse['rows']): ProviderModelMinuteResponse => ({
  bucket: 'minute', groupBy: 'provider_model', from: 60001, to: 240001,
  measurement: 'recorded_tokens_per_minute', groups, rows,
  coverage: { includedRecords: rows.length, includedCalls: rows.length,
    excludedRecords: groups.length, excludedCalls: groups.length * 10, excludedSources: [] },
});

test('minute buckets preserve the exact half-open interval and both clipped boundary minutes', () => {
  assert.deepEqual(liveMinuteBuckets(60001, 240001), [
    { at: 60000, start: 60001, end: 120000, partial: true },
    { at: 120000, start: 120000, end: 180000, partial: false },
    { at: 180000, start: 180000, end: 240000, partial: false },
    { at: 240000, start: 240000, end: 240001, partial: true },
  ]);
  const live = liveMinuteBuckets(120000, 1920001);
  assert.equal(live.length, 31);
  assert.equal(live[0]!.at, 120000);
  assert.equal(live[30]!.at, 1920000);
  assert.equal(live[30]!.end - live[30]!.start, 1);
  assert.deepEqual(liveMinuteBuckets(0, 60000), [{ at: 0, start: 0, end: 60000, partial: false }]);
  for (const [from, to] of [[1, 1], [-1, 1], [0, 86400001], [0.1, 1], [0, Infinity]]) assert.deepEqual(liveMinuteBuckets(from!, to!), []);
});

test('exact nullable, empty, literal unknown and delimiter identities cannot exchange minute cells', () => {
  const pairs: Pair[] = [
    { provider: null, model: 'x' }, { provider: 'null', model: 'x' },
    { provider: '', model: '' }, { provider: '(unknown)', model: '(unknown)' },
    { provider: 'a/b', model: 'c' }, { provider: 'a', model: 'b/c' },
    { provider: 'route|"quoted"', model: '模型/ไทย😀\n' },
  ];
  const data = response(pairs.map(pair => group(pair)), pairs.map((pair, index) => row(pair, 120000, index + 1)));
  const before = structuredClone(data);
  const matrix = liveMinutePairs(data);
  assert.equal(new Set(matrix.map(pair => pair.key)).size, pairs.length);
  matrix.forEach((pair, index) => {
    assert.equal(pair.key, JSON.stringify([pairs[index]!.provider, pairs[index]!.model]));
    assert.equal(pair.cells[1]!.tokens, index + 1);
    assert.equal(pair.cells[1]!.intensity, (index + 1) / pairs.length);
    assert.equal(pair.cells[0]!.state, 'missing');
  });
  assert.deepEqual(data, before, 'derivation must preserve the API snapshot');
});

test('observed zero differs from absent cells and aggregate-only totals never create minute activity', () => {
  const observed = { provider: 'openai', model: 'gpt' };
  const aggregate = { provider: 'aggregate', model: null };
  const data = response([group(observed, 999, 2), group(aggregate, 500, 0)], [row(observed, 60000, 0), row(observed, 180000, 1)]);
  const [call, excluded] = liveMinutePairs(data);
  assert.equal(call!.tokens, 999, 'all-grain window total must remain independent from minute values');
  assert.deepEqual(call!.cells.map(cell => [cell.state, cell.tokens, cell.records, cell.calls]), [
    ['zero', 0, 1, 1], ['missing', null, null, null], ['recorded', 1, 1, 1], ['missing', null, null, null],
  ]);
  assert.equal(call!.cells[2]!.intensity, 1);
  assert.ok(excluded!.cells.every(cell => cell.state === 'missing' && cell.tokens === null && cell.intensity === 0));
  assert.ok(liveMinutePairs(response([group(observed)], [row(observed, 60000, 0)]))[0]!.cells.every(cell => cell.intensity === 0));
});

test('the visible top twelve keep API rank while sharing the actual scale across all recorded pairs', () => {
  const groups = Array.from({ length: 13 }, (_, index) => group({ provider: 'route', model: `model-${index}` }, 2000 - index));
  const data = response(groups, [row(groups[0]!, 120000, 1), row(groups[12]!, 120000, 1000)]);
  const matrix = liveMinutePairs(data);
  assert.equal(matrix.length, 12);
  assert.deepEqual(matrix.map(pair => pair.model), groups.slice(0, 12).map(pair => pair.model));
  assert.equal(matrix[0]!.cells[1]!.intensity, 0.001);
  assert.equal(matrix[0]!.cells[1]!.tokens, 1);
  assert.ok(matrix.slice(1).every(pair => pair.cells.every(cell => cell.state === 'missing')));
});
