import assert from 'node:assert/strict';
import { test } from 'node:test';
import { liveTokenFlow, liveTokenFlowSegments, liveTokenFlowX, liveTokenFlowY, type LiveTokenFlowResponse } from '../src/redesign/live-token-flow-data.ts';

type Row = LiveTokenFlowResponse['rows'][number];
const row = (bucket_ts: number, overrides: Partial<Row> = {}): Row => ({ bucket_ts, records: 1, calls: 1,
  input_tokens: 20, cached_input_tokens: 30, cache_write_tokens: 10, output_tokens: 40, total_tokens: 100, ...overrides });
const response = (rows: readonly Row[], from = 60001, to = 240001): LiveTokenFlowResponse => ({ from, to, rows });

test('input includes disjoint fresh/read-cache/write-cache fields; output already includes reasoning', () => {
  const recorded = { ...row(120000), reasoning_tokens: 30 };
  const data = response([recorded]);
  const before = structuredClone(data);
  const flow = liveTokenFlow(data);
  assert.deepEqual([flow.points[1]!.freshInput, flow.points[1]!.cacheRead, flow.points[1]!.cacheWrite, flow.points[1]!.input, flow.points[1]!.output, flow.points[1]!.total], [20, 30, 10, 60, 40, 100]);
  assert.equal(flow.hasPartialBreakdown, false);
  assert.equal(flow.maximum, 100);
  assert.deepEqual(data, before, 'derivation preserves the immutable API snapshot');
});

test('stored totals stay exact despite component mismatches and all curves share their actual maximum', () => {
  const flow = liveTokenFlow(response([row(120000, { total_tokens: 7, input_tokens: 100, cached_input_tokens: 50, cache_write_tokens: 10 })]));
  const point = flow.points[1]!;
  assert.equal(point.input, 160);
  assert.equal(point.output, 40);
  assert.equal(point.total, 7, 'do not back-solve or repair stored totals');
  assert.equal(point.partialBreakdown, true);
  assert.equal(flow.hasPartialBreakdown, true);
  assert.equal(flow.maximum, 160);
  assert.equal(liveTokenFlowY(point.input, flow.maximum), 6);
  assert.equal(liveTokenFlowY(point.output, flow.maximum), 72);
  assert.equal(liveTokenFlowY(point.total, flow.maximum), 90.15);
});

test('legacy missing components remain unknown and break only the affected curve', () => {
  const legacy = { bucket_ts: 120000, records: 1, calls: 1, total_tokens: 100 };
  const flow = liveTokenFlow(response([row(60000), legacy, row(180000, { cache_write_tokens: undefined, output_tokens: 5 })]));
  assert.equal(flow.points[1]!.input, null);
  assert.equal(flow.points[1]!.output, null);
  assert.equal(flow.points[1]!.total, 100);
  assert.equal(flow.points[2]!.input, null, 'one omitted cache component leaves combined input unknown');
  assert.equal(flow.points[2]!.output, 5);
  assert.deepEqual(liveTokenFlowSegments(flow.points, 'input').map(segment => segment.map(point => point.index)), [[0], [3]]);
  assert.deepEqual(liveTokenFlowSegments(flow.points, 'output').map(segment => segment.map(point => point.index)), [[0], [2, 3]]);
  assert.equal(liveTokenFlowSegments(flow.points, 'total')[0]!.length, 4);
  assert.equal(flow.hasPartialBreakdown, true);
});

test('recorded zero and known zero breakdowns remain distinct from absent minute records', () => {
  const flow = liveTokenFlow(response([row(120000, { input_tokens: 0, cached_input_tokens: 0, cache_write_tokens: 0, output_tokens: 0, total_tokens: 0, calls: 2 })]));
  assert.deepEqual(flow.points.map(point => [point.state, point.records, point.calls, point.input, point.output, point.total]), [
    ['missing', 0, 0, 0, 0, 0], ['zero', 1, 2, 0, 0, 0], ['missing', 0, 0, 0, 0, 0], ['missing', 0, 0, 0, 0, 0],
  ]);
  assert.equal(flow.maximum, 0);
  assert.equal(flow.hasPartialBreakdown, false);
  assert.equal(liveTokenFlowY(0, flow.maximum), 94);
});

test('multiple rows in one minute conserve each component and unknowns propagate without dropping known output', () => {
  const flow = liveTokenFlow(response([row(120000), row(120000, { records: 2, calls: 5, total_tokens: 102, input_tokens: undefined, output_tokens: 2 })]));
  const point = flow.points[1]!;
  assert.deepEqual([point.records, point.calls, point.freshInput, point.cacheRead, point.cacheWrite, point.input, point.output, point.total], [3, 6, null, 60, 20, null, 42, 202]);
  assert.equal(flow.maximum, 202);
  assert.equal(point.partialBreakdown, true);
  const reversed = liveTokenFlow(response([row(120000, { records: 2, calls: 5, total_tokens: 102, input_tokens: undefined, output_tokens: 2 }), row(120000)]));
  assert.deepEqual(reversed, flow, 'unknown composition and sums do not depend on row order');
});

test('the exact half-open scope retains clipped endpoints and ignores rows outside its minute bins', () => {
  const flow = liveTokenFlow(response([row(0, { total_tokens: 999999 }), row(60000), row(240000), row(300000, { total_tokens: 999999 })]));
  assert.deepEqual(flow.points.map(point => [point.at, point.start, point.end, point.partial]), [
    [60000, 60001, 120000, true], [120000, 120000, 180000, false], [180000, 180000, 240000, false], [240000, 240000, 240001, true],
  ]);
  assert.equal(flow.maximum, 100);
  assert.equal(flow.points.reduce((sum, point) => sum + point.total, 0), 200);
  const live = liveTokenFlow(response([], 120000, 1920001));
  assert.equal(live.points.length, 31);
  assert.equal(live.points[30]!.end - live.points[30]!.start, 1);
  assert.equal(liveTokenFlowX(0, 31), 8);
  assert.equal(liveTokenFlowX(30, 31), 992);
  assert.equal(liveTokenFlowX(0, 1), 8);
  assert.deepEqual(liveTokenFlow(response([], 1, 1)), { points: [], maximum: 0, hasPartialBreakdown: false });
});
