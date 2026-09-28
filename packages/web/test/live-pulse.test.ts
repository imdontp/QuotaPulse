import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Limit, Overview, SubscriptionStatus } from '../src/api';
import { groupResets, groupWeights, intensityOf, primaryReading, pulseModel, recentRate } from '../src/lib/live-pulse';
import { RING_MAX } from '../src/lib/quota-ring';

const now = 1_800_000_000_000;
const hour = 3_600_000;

const subscription = (key: string, state: SubscriptionStatus['state'] = 'active'): SubscriptionStatus => ({
  account_key: key, subscription_key: key, provider: 'openai', display_name: key,
  subscription_display_name: key, state, reason: null, last_success_at: now - 15_000, owners: [],
  linked_harness_keys: [],
  telemetry: {
    freshness: 'live', latest_quota_at: now - 15_000, latest_source_fetched_at: now - 15_000,
    latest_usage_at: now, gap: false, reason: null, origins: ['fixture'], windows: [],
  },
});

const limit = (patch: Partial<Limit> = {}): Limit => ({
  source_id: 1, harness: 'codex', profile: 'default', display_name: 'a', window_kind: '5h',
  used_percent: 50, resets_at: now + 3 * hour, severity: null, observed_at: now - 15_000,
  source_fetched_at: now - 15_000, origin: 'fixture', account_key: 'a', account_provider: 'openai',
  account_display_name: 'a', subscription_key: 'a', subscription_provider: 'openai',
  subscription_display_name: 'a', ageSeconds: 15, valueAgeSeconds: 15, last_seen_at: now - 15_000,
  burn: null, ...patch,
});

const overview = (limits: Limit[], subs: SubscriptionStatus[]): Overview =>
  ({ now, limits, subscriptions: subs }) as Overview;

const burn = (projectedFullAt: number, samples = 12) => ({
  percentPerHour: 8, projectedFullAt, fromPercent: 50, fromAt: now - hour, samples,
});

test('the fullest window earns the outermost arc', () => {
  const model = pulseModel(overview(
    [
      limit({ subscription_key: 'quiet', subscription_display_name: 'quiet', used_percent: 10 }),
      limit({ subscription_key: 'busy', subscription_display_name: 'busy', used_percent: 88 }),
      limit({ subscription_key: 'mid', subscription_display_name: 'mid', used_percent: 48 }),
    ],
    [subscription('quiet'), subscription('busy'), subscription('mid')],
  ));
  assert.deepEqual(model.items.map((i) => i.key), ['busy', 'mid', 'quiet']);
  assert.equal(model.primary?.key, 'busy');
  assert.equal(model.items[0]!.tone, 'crit');
  assert.equal(model.items.at(-1)!.tone, 'ok');
});

test('a window about to run out leads regardless of how full it is', () => {
  // 60% used but projected full before the reset must outrank a healthy 79% window, because
  // sorting on raw usage alone would place the dangerous one second.
  const model = pulseModel(overview(
    [
      limit({ subscription_key: 'survivor', subscription_display_name: 'survivor', used_percent: 79 }),
      limit({
        subscription_key: 'doomed', subscription_display_name: 'doomed', used_percent: 60,
        burn: burn(now + hour),
      }),
    ],
    [subscription('survivor'), subscription('doomed')],
  ));
  assert.equal(model.primary?.key, 'doomed');
  assert.equal(model.items[0]!.urgent, true);
  assert.equal(model.items[1]!.urgent, false);
  assert.equal(model.items[1]!.used, 79);

  // Inside one band, the fuller window still leads.
  const sameBand = pulseModel(overview(
    [
      limit({ subscription_key: 'low', subscription_display_name: 'low', used_percent: 85 }),
      limit({ subscription_key: 'high', subscription_display_name: 'high', used_percent: 92 }),
    ],
    [subscription('low'), subscription('high')],
  ));
  assert.deepEqual(sameBand.items.map((i) => i.key), ['high', 'low']);
});

test('a burn figure with too few samples is not quoted', () => {
  const thin = pulseModel(overview(
    [limit({ subscription_key: 'a', burn: burn(now + hour, 2) })],
    [subscription('a')],
  ));
  assert.equal(thin.primary?.burnRate, null, 'two samples is a guess, not a rate');
  assert.equal(thin.primary?.projectedFullAt, null);
  const enough = pulseModel(overview(
    [limit({ subscription_key: 'a', burn: burn(now + hour, 5) })],
    [subscription('a')],
  ));
  assert.equal(enough.primary?.burnRate, 8);
  assert.equal(enough.primary?.urgent, true);
});

test('subscriptions past the arc limit are counted, not silently dropped', () => {
  const subs = ['a', 'b', 'c', 'd', 'e', 'f'].map((k) => subscription(k));
  const limits = subs.map((s, i) => limit({
    subscription_key: s.subscription_key,
    subscription_display_name: s.subscription_display_name,
    used_percent: 10 * (i + 1),
  }));
  const model = pulseModel(overview(limits, subs));
  assert.equal(model.items.length, RING_MAX);
  assert.equal(model.overflow, 2);
  assert.equal(model.items[0]!.key, 'f', 'the fullest of the truncated list still leads');
});

test('a subscription with no reading keeps its slot and refuses to show a number', () => {
  const model = pulseModel(overview(
    [limit({ subscription_key: 'a', used_percent: 40 })],
    [subscription('a'), subscription('silent')],
  ));
  const silent = model.items.find((i) => i.key === 'silent');
  assert.ok(silent, 'a tracked subscription with no reading is still shown');
  assert.equal(silent.used, null);
  assert.equal(silent.expired, true);
  assert.equal(silent.windowKind, '');
});

test('an expired reading is never quoted as a current percentage', () => {
  const rolled = pulseModel(overview(
    [limit({ subscription_key: 'a', used_percent: 99, resets_at: now - hour })],
    [subscription('a')],
  ));
  assert.equal(rolled.primary?.used, null, 'the pre-reset number would be a lie');
  assert.equal(rolled.primary?.expired, true);
});

test('hidden and inactive subscriptions leave the ring entirely', () => {
  const ov = overview(
    [limit({ subscription_key: 'a' }), limit({ subscription_key: 'b' })],
    [subscription('a'), subscription('b')],
  );
  assert.deepEqual(pulseModel(ov, ['a']).items.map((i) => i.key), ['b']);
  ov.subscriptions[1]!.state = 'inactive';
  assert.deepEqual(pulseModel(ov, ['a']).items, []);
  assert.deepEqual(pulseModel(overview([], [])), {
    items: [], overflow: 0, primary: null, window: null,
  });
});

test('the time track describes the leading window', () => {
  const model = pulseModel(overview(
    [limit({ subscription_key: 'a', used_percent: 88, burn: burn(now + hour) })],
    [subscription('a')],
  ));
  assert.equal(model.window?.elapsed, 0.4);
  assert.equal(model.window?.willRunOut, true);
});

test('resets in the same minute are one event on the timeline', () => {
  const hour = 3_600_000;
  // The shape that broke the first timeline: three rolling windows landing together, and
  // one weekly window a long way out.
  const simultaneous = groupResets([
    { at: now + 3 * hour }, { at: now + 3 * hour }, { at: now + 3 * hour },
  ]);
  assert.deepEqual(simultaneous, [{ at: now + 3 * hour, members: 3 }]);
  assert.deepEqual(
    groupResets([{ at: now + 3 * hour }, { at: now + 3 * hour + 30_000 }, { at: now + 9 * hour }]),
    [{ at: now + 3 * hour, members: 2 }, { at: now + 9 * hour, members: 1 }],
  );
  // Input order must not matter, and a group boundary is never split by a later arrival.
  assert.deepEqual(groupResets([{ at: now + 9 * hour }, { at: now + 3 * hour }]), [
    { at: now + 3 * hour, members: 1 }, { at: now + 9 * hour, members: 1 },
  ]);
  assert.deepEqual(groupResets([]), []);
});

test('timeline columns stay readable however lopsided the gaps are', () => {
  assert.deepEqual(groupWeights([]), []);
  assert.deepEqual(groupWeights([100]), [1], 'a lone stop takes the neutral weight');

  const weights = groupWeights([0, 0, 0, 93]);
  assert.equal(weights.length, 4);
  // Proportional by raw hours this would be [0.5, 0.5, 0.5, 93] -- the first three would
  // have had no room at all. Every stop must keep a usable share.
  for (const w of weights) assert.ok(w >= 0.6, `weight ${w} leaves no room for a label`);
  // The distant event still gets more room than the cluster, so the shape survives.
  assert.ok(weights[3]! > weights[0]!);
  // Evenly spaced stops come out even, which is the case that must not look arbitrary.
  assert.deepEqual(groupWeights([0, 10, 20, 30]), [1, 1, 1, 1]);
  // Identical timestamps cannot divide by zero.
  assert.deepEqual(groupWeights([0, 0, 0]), [1, 1, 1]);
});

test('the backdrop answers to measured throughput, not a timer', () => {
  assert.equal(recentRate([]), 0);
  // A spike in the last three buckets is the answer, and earlier hours are ignored.
  assert.equal(recentRate([900_000, 10, 5, 400, 20]), 400);
  assert.equal(recentRate([500, 400, 300]), 500, 'the peak, not the mean');
  assert.equal(recentRate([-5, 10]), 10, 'a negative bucket cannot drag the rate down');

  assert.equal(intensityOf(0), 0);
  assert.equal(intensityOf(-10), 0);
  assert.equal(intensityOf(Number.NaN), 0);
  // Monotonic, strictly inside 0-1, and never clipped, so the field cannot hit its ceiling.
  const quiet = intensityOf(50_000);
  const busy = intensityOf(250_000);
  const frantic = intensityOf(5_000_000);
  assert.ok(quiet < busy && busy < frantic);
  assert.ok(frantic < 1 && busy > 0.5);
  assert.ok(intensityOf(1e12) <= 1);
});

test('primaryReading prefers the window that runs out, then the highest', () => {
  const low = limit({ window_kind: '5h', used_percent: 30 });
  const high = limit({ window_kind: 'weekly', used_percent: 90, burn: burn(now + hour) });
  assert.equal(primaryReading([low, high], now), high);
  const calm = limit({ window_kind: 'weekly', used_percent: 90 });
  assert.equal(primaryReading([low, calm], now), calm, 'no projection: the fullest window answers');
  assert.equal(primaryReading([], now), undefined);
  assert.equal(primaryReading([low], now), low);
});
