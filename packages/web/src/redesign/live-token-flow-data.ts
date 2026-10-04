import { liveMinuteBuckets, type LiveMinuteBucket } from './live-minute-data';

/** The optional components support responses recorded before the component fields were exposed. */
export interface LiveTokenFlowResponse {
  from: number;
  to: number;
  rows: readonly {
    bucket_ts: number;
    records: number;
    calls: number;
    total_tokens: number;
    input_tokens?: number | null;
    cached_input_tokens?: number | null;
    cache_write_tokens?: number | null;
    output_tokens?: number | null;
  }[];
}

export interface LiveTokenFlowPoint extends LiveMinuteBucket {
  state: 'missing' | 'zero' | 'recorded';
  records: number;
  calls: number;
  freshInput: number | null;
  cacheRead: number | null;
  cacheWrite: number | null;
  input: number | null;
  output: number | null;
  total: number;
  partialBreakdown: boolean;
}

export type LiveTokenFlowSeries = 'input' | 'output' | 'total';
const known = (value: number | null | undefined): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0;
const sumKnown = (left: number | null, right: number | null | undefined) => left !== null && known(right) ? left + right : null;

/** Recorded sums share one scale. Missing calls and unknown component breakdowns remain distinguishable. */
export function liveTokenFlow(data: LiveTokenFlowResponse) {
  const points: LiveTokenFlowPoint[] = liveMinuteBuckets(data.from, data.to).map(bucket => ({
    ...bucket, state: 'missing', records: 0, calls: 0,
    freshInput: 0, cacheRead: 0, cacheWrite: 0, input: 0, output: 0, total: 0, partialBreakdown: false,
  }));
  const byMinute = new Map(points.map(point => [point.at, point]));
  for (const row of data.rows) {
    const point = byMinute.get(row.bucket_ts);
    if (!point || row.records <= 0) continue;
    point.records += row.records;
    point.calls += row.calls;
    point.total += row.total_tokens;
    point.freshInput = sumKnown(point.freshInput, row.input_tokens);
    point.cacheRead = sumKnown(point.cacheRead, row.cached_input_tokens);
    point.cacheWrite = sumKnown(point.cacheWrite, row.cache_write_tokens);
    point.output = sumKnown(point.output, row.output_tokens);
  }
  let maximum = 0;
  let hasPartialBreakdown = false;
  for (const point of points) {
    point.input = point.freshInput !== null && point.cacheRead !== null && point.cacheWrite !== null
      ? point.freshInput + point.cacheRead + point.cacheWrite : null;
    point.state = point.records === 0 ? 'missing' : point.total === 0 ? 'zero' : 'recorded';
    point.partialBreakdown = point.records > 0 && (point.input === null || point.output === null || point.total !== point.input + point.output);
    hasPartialBreakdown ||= point.partialBreakdown;
    maximum = Math.max(maximum, point.total, point.input ?? 0, point.output ?? 0);
  }
  return { points, maximum, hasPartialBreakdown };
}

export function liveTokenFlowX(index: number, count: number) {
  return 8 + 984 * index / Math.max(1, count - 1);
}

export function liveTokenFlowY(value: number, maximum: number) {
  return 94 - 88 * value / (maximum || 1);
}

/** Unknown components break their line; they never acquire a zero or a back-solved value. */
export function liveTokenFlowSegments(points: readonly LiveTokenFlowPoint[], series: LiveTokenFlowSeries) {
  const segments: Array<Array<{ index: number; at: number; value: number }>> = [];
  let segment: (typeof segments)[number] = [];
  points.forEach((point, index) => {
    const value = point[series];
    if (value === null) {
      if (segment.length) segments.push(segment);
      segment = [];
    } else segment.push({ index, at: point.at, value });
  });
  if (segment.length) segments.push(segment);
  return segments;
}
