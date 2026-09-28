import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Limit, Overview, SubscriptionStatus, TrendRow } from '../src/api';
import { quotaSummaries, upcomingResets, statSeries } from '../src/lib/quota-summary';

const now = 1_800_000_000_000;
const subscription = (key = 'a'): SubscriptionStatus => ({
  account_key: key, subscription_key: key, provider: 'openai', display_name: key,
  subscription_display_name: key, state: 'active', reason: null, last_success_at: now,
  owners: [], linked_harness_keys: [], telemetry: { freshness: 'live', latest_quota_at: now,
    latest_source_fetched_at: now, latest_usage_at: now, gap: false, reason: null, origins: [], windows: [] },
});
const limit = (patch: Partial<Limit> = {}): Limit => ({ source_id: 1, harness: 'codex',
  profile: 'default', display_name: 'a', window_kind: '5h', used_percent: 20, resets_at: now + 3600000,
  severity: null, observed_at: now, source_fetched_at: now, origin: 'live', account_key: 'a',
  account_provider: 'openai', account_display_name: 'a', subscription_key: 'a', subscription_provider: 'openai',
  subscription_display_name: 'a', ageSeconds: 30, valueAgeSeconds: 30, last_seen_at: now, burn: null, ...patch });
const overview = (limits = [limit()], subscriptions = [subscription()]) => ({ now, limits, subscriptions }) as Overview;

test('availability requires a fresh, complete reading; zero use is valid but unknown is not', () => {
  assert.equal(quotaSummaries(overview([limit({ used_percent: 0 })]))[0]!.status, 'available');
  for (const patch of [{ used_percent: null }, { ageSeconds: null }, { ageSeconds: 3600 }, { resets_at: now }]) {
    assert.equal(quotaSummaries(overview([limit(patch)]))[0]!.status, 'check');
  }
  assert.equal(quotaSummaries(overview([]))[0]!.status, 'check');
});

test('one unknown window prevents an available classification', () => {
  assert.equal(quotaSummaries(overview([limit(), limit({ window_kind: 'weekly', used_percent: null })]))[0]!.status, 'check');
});

test('account state and telemetry uncertainty cannot advertise availability', () => {
  for (const state of ['waiting', 'stale', 'unavailable'] as const) {
    assert.equal(quotaSummaries(overview([limit()], [{ ...subscription(), state }]))[0]!.status, 'check');
  }
  const s = subscription(); s.telemetry.gap = true;
  assert.equal(quotaSummaries(overview([limit()], [s]))[0]!.status, 'check');
  s.state = 'inactive';
  assert.equal(quotaSummaries(overview([limit({ used_percent: 99 })], [s]))[0]!.status, 'inactive');
});

test('threshold and projected exhaustion retain the existing alert semantics', () => {
  assert.equal(quotaSummaries(overview([limit({ used_percent: 79 })]))[0]!.status, 'available');
  assert.equal(quotaSummaries(overview([limit({ used_percent: 80 })]))[0]!.status, 'attention');
  // 20% used in a window that resets in an hour: 90%/h reaches full in 53 minutes, so the
  // projection is corroborated and the window genuinely does run out. The old fixture
  // claimed full in one second at 10%/h, which no rate could honour and which `willExhaust`
  // now rightly refuses.
  assert.equal(quotaSummaries(overview([limit({ burn: { percentPerHour: 90, projectedFullAt: now + 0.8 * 3_600_000, fromPercent: 20, fromAt: now - 3_600_000, samples: 3 } })]))[0]!.status, 'attention');
});

test('duplicate readers produce one reset; the freshest canonical reading wins', () => {
  const items = quotaSummaries(overview([limit({ ageSeconds: 500, origin: 'cache', used_percent: 99 }), limit()]));
  assert.equal(items[0]!.status, 'available');
  assert.equal(upcomingResets(items, now).length, 1);
  assert.equal(items[0]!.limits[0]!.origin, 'live');
});

test('hidden and inactive subscriptions do not contribute upcoming resets', () => {
  const ov = overview();
  assert.deepEqual(quotaSummaries(ov, ['a']), []);
  assert.equal(ov.subscriptions.length, 1);
  ov.subscriptions[0]!.state = 'inactive';
  assert.deepEqual(upcomingResets(quotaSummaries(ov), now), []);
});

test('resets exclude unknown and elapsed timestamps and preserve simultaneous windows', () => {
  const items = quotaSummaries(overview([limit({ resets_at: null }),
    limit({ window_kind: 'weekly', resets_at: now }),
    limit({ window_kind: 'weekly_opus', resets_at: now + 5000 }),
    limit({ window_kind: 'monthly', resets_at: now + 1000 }),
    limit({ window_kind: 'weekly_sonnet', resets_at: now + 1000 })]));
  assert.deepEqual(upcomingResets(items, now).map(l => l.resets_at), [now + 1000, now + 1000, now + 5000]);
});

test('stat series uses tokens rather than calls and fills empty API buckets', () => {
  const day = 86_400_000, from = 10 * day + 1000, to = 13 * day;
  const rows = [{ bucket_ts: 10 * day, total_tokens: 100, calls: 7, cost_usd: 2 },
    { bucket_ts: 12 * day, total_tokens: 300, calls: 1, cost_usd: 4 }] as TrendRow[];
  assert.deepEqual(statSeries(rows, from, to, 'day', 'total_tokens'), [100, 0, 300]);
  assert.deepEqual(statSeries(rows, from, to, 'day', 'cost_usd'), [2, 0, 4]);
});
