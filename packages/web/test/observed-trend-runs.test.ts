import assert from 'node:assert/strict';
import { test } from 'node:test';
import { observedTrendRuns } from '../src/redesign/observed-trend-runs.ts';

const series = (values: Array<number | null>) => values.map((value, index) => ({ at: 1000 + index * 1000, value }));

test('unknown samples break lines while keeping the full time-domain indices', () => {
  const runs = observedTrendRuns(series([null, 4, 8, null, 3, null, 7, 9, null]));
  assert.deepEqual(runs.map(run => run.map(point => point.index)), [[1, 2], [4], [6, 7]]);
  assert.deepEqual(runs.map(run => run.map(point => point.value)), [[4, 8], [3], [7, 9]]);
});

test('known zero and equal values remain recorded samples', () => {
  assert.deepEqual(observedTrendRuns(series([0, 0, 0]))[0].map(point => point.value), [0, 0, 0]);
  assert.deepEqual(observedTrendRuns(series([5, 5]))[0].map(point => point.index), [0, 1]);
});

test('all unknown and nonfinite samples produce no drawable run', () => {
  assert.deepEqual(observedTrendRuns(series([null, null])), []);
  assert.deepEqual(observedTrendRuns(series([NaN, Infinity])), []);
  assert.deepEqual(observedTrendRuns([]), []);
});
