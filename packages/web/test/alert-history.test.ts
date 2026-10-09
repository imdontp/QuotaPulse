import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Limit, QuotaHistoryResponse } from '../src/api.js';
import { AlertHistoryCache, currentQuotaForecast, observedQuotaSeries } from '../src/redesign/alert-history.js';

const reading = (owner: string, value = 80) => ({ subscription_key: owner, window_kind: '5h', source_id: 1, origin: 'fixture', last_seen_at: 1000, resets_at: 9000, used_percent: value }) as Limit;
const response = (owner: string): QuotaHistoryResponse => ({ now: 1000, from: 0, to: 1001, subscriptionKey: owner, windowKind: '5h', available: false, reader: null, segments: [] });

test('deduplicates owners and caps every history batch at six, including selected first', async () => {
  const scopes: Array<{ subscriptionKey: string; from: number; to: number }> = [];
  const cache = new AlertHistoryCache(async scope => { scopes.push(scope); return response(scope.subscriptionKey); });
  const data = await cache.load([reading('selected'), reading('selected'), ...Array.from({ length: 20 }, (_, i) => reading(String(i)))], 1000);
  assert.equal(scopes.length, 6);
  assert.equal(data.size, 6);
  assert.equal(scopes[0].subscriptionKey, 'selected');
  assert.ok(scopes.every(scope => scope.from === 0 && scope.to === 1001));
});

test('reuses unchanged histories until TTL; actual changed reading and manual refresh fetch again', async () => {
  let clock = 0, reads = 0;
  const cache = new AlertHistoryCache(async scope => { reads++; return response(scope.subscriptionKey); }, () => clock);
  await cache.load([reading('a')], 1000);
  await cache.load([reading('a')], 2000);
  assert.equal(reads, 1);
  clock = 60_000;
  await cache.load([reading('a')], 3000);
  assert.equal(reads, 2);
  await cache.load([reading('a', 81)], 3000);
  assert.equal(reads, 3);
  await cache.load([reading('a', 81)], 3000, true);
  assert.equal(reads, 4);
});

test('shares in-flight reads and rejects owner/window mismatch without assigning unrelated data', async () => {
  let reads = 0;
  let resolve!: (value: QuotaHistoryResponse) => void;
  const cache = new AlertHistoryCache(() => { reads++; return new Promise(done => { resolve = done; }); });
  const first = cache.load([reading('a')], 1000);
  const second = cache.load([reading('a')], 1000);
  resolve(response('wrong'));
  const results = await Promise.all([first, second]);
  assert.equal(reads, 1);
  for (const result of results) {
    const value = result.get(JSON.stringify(['a', '5h']))!;
    assert.equal(value.data, null);
    assert.match(value.error!, /owner\/window mismatch/);
  }
});

test('observed series breaks on null and reset; zero is a real point at its real timestamp', () => {
  const history = response('a');
  const sample = (at: number, value: number | null) => ({ observedAt: at, lastSeenAt: at, usedPercent: value, resetAt: null });
  history.segments = [{ resetAt: null, samples: [sample(100, 0), sample(200, null), sample(400, 80), sample(500, 90)] }, { resetAt: 600, samples: [sample(600, 5)] }];
  const series = observedQuotaSeries(history);
  assert.equal(series.points.length, 4);
  assert.equal(series.lines.length, 1);
  assert.deepEqual(series.points[0], { x: 3, y: 29, at: 100, percent: 0 });
  assert.equal(series.points.at(-1)!.x, 97);
  assert.equal(series.lines[0].x1, series.points[1].x);
  history.segments = [{ resetAt: null, samples: [sample(100, null)] }];
  assert.equal(observedQuotaSeries(history).points.length, 0);
});

test('time alone invalidates cached history at reset and one-hour freshness boundaries', async () => {
  let reads = 0;
  const cache = new AlertHistoryCache(async scope => { reads++; return response(scope.subscriptionKey); }, () => 0);
  await cache.load([reading('a')], 8999);
  await cache.load([reading('a')], 9000);
  assert.equal(reads, 2);
  const noReset = { ...reading('b'), resets_at: null };
  await cache.load([noReset], 3_600_999);
  await cache.load([noReset], 3_601_000);
  assert.equal(reads, 4);
});

test('cached ready forecasts require a current fresh reading and matching reader metadata', () => {
  const history = response('a');
  history.reader = { sourceId: 1, origin: 'fixture', observedAt: 1000, lastSeenAt: 1000, sourceFetchedAt: 1000, resetAt: 9000, ageSeconds: 0, freshness: 'live', forecast: { status: 'ready', samples: 3, fromAt: 0, toAt: 1000, percentPerHour: 1, projectedFullAt: 8000 } };
  assert.equal(currentQuotaForecast(history, reading('a'), 8999)?.status, 'ready');
  assert.equal(currentQuotaForecast(history, reading('a'), 9000), null);
  assert.equal(currentQuotaForecast(history, { ...reading('a'), source_id: 2 }, 8999), null);
  assert.equal(currentQuotaForecast(history, { ...reading('a'), last_seen_at: 2000 }, 8999), null);
  history.reader.freshness = 'stale';
  assert.equal(currentQuotaForecast(history, reading('a'), 8999), null);
});

test('large observed histories render at most256 actual latest samples without bridging omitted/reset/null gaps', () => {
  const history = response('a');
  history.segments = [{ resetAt: null, samples: Array.from({ length: 200_000 }, (_, i) => ({ observedAt: i, lastSeenAt: i, usedPercent: i % 2 ? null : 50, resetAt: null })) }];
  const series = observedQuotaSeries(history);
  assert.equal(series.totalSamples, 200_000);
  assert.equal(series.displayedSamples, 256);
  assert.equal(series.first, 199_744);
  assert.equal(series.last, 199_999);
  assert.equal(series.points.length, 128);
  assert.equal(series.lines.length, 0);
});

test('unknown-only recent suffix still discloses actual samples rather than an empty history', () => {
  const history = response('a');
  history.segments = [{ resetAt: null, samples: Array.from({ length: 257 }, (_, i) => ({ observedAt: i, lastSeenAt: i, usedPercent: i === 0 ? 50 : null, resetAt: null })) }];
  const series = observedQuotaSeries(history);
  assert.equal(series.totalSamples, 257);
  assert.equal(series.displayedSamples, 256);
  assert.equal(series.points.length, 0);
  assert.equal(series.first, 1);
  assert.equal(series.last, 256);
});
