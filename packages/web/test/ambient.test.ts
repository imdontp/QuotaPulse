import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Limit, Overview, SubscriptionStatus } from '../src/api';
import { ambientOf, MAX_INTENSITY, STALE_AFTER_MS } from '../src/lib/ambient';

/*
 * The ambient backdrop is the one piece of decoration in the app that makes a claim about
 * the data, so these are not styling tests. The claim is "this dashboard is calm / busy /
 * in trouble", and the rules that keep it honest are:
 *
 *   1. It cannot disagree with the quota rings -- both call `severityOf`.
 *   2. A reading that is expired, missing, or days old may not colour the present.
 *   3. "I could not establish this" is never painted as calm.
 *   4. It never out-competes the content for attention.
 *
 * Each of those is invisible in a screenshot -- a backdrop that is subtly wrong looks like a
 * backdrop -- so they are pinned here instead.
 */

const now = 1_800_000_000_000;
const HOUR = 3_600_000;

const subscription = (patch: Partial<SubscriptionStatus> = {}): SubscriptionStatus => ({
  subscription_key: 'openai',
  provider: 'openai',
  display_name: 'OpenAI',
  state: 'active',
  reason: null,
  last_success_at: now,
  owners: [{ harness: 'codex', profile: 'default' }],
  linked_harness_keys: ['codex:default'],
  telemetry: {
    freshness: 'live', gap: false, reason: null, origins: ['auth.json'],
    latest_quota_at: now, latest_source_fetched_at: now, latest_usage_at: now, windows: [],
  },
  ...patch,
});

const limit = (patch: Partial<Limit> = {}): Limit => ({
  source_id: 1, harness: 'codex', profile: 'default', display_name: 'Codex CLI',
  window_kind: '5h', used_percent: 10, resets_at: now + HOUR, severity: null,
  observed_at: now, source_fetched_at: now, origin: 'auth.json',
  account_key: 'openai:subscription', account_provider: 'openai', account_display_name: 'OpenAI',
  subscription_key: 'openai', subscription_provider: 'openai', subscription_display_name: 'OpenAI',
  ageSeconds: 60, valueAgeSeconds: 120, last_seen_at: now, burn: null,
  ...patch,
});

const overview = (limits: Limit[], subs: SubscriptionStatus[] = [subscription()]): Overview => ({
  now, today: {} as Overview['today'], week: {} as Overview['week'], allTime: {} as Overview['allTime'],
  bySourceToday: [], bySourceAll: [], limits, subscriptions: subs, harnesses: [],
  settings: {} as Overview['settings'], sources: [], sourceStatus: [], lastPass: null,
});

test('a machine with quota to spare is calm, and a barely-used one is quieter still', () => {
  const light = ambientOf(overview([limit({ used_percent: 2 })]));
  const moderate = ambientOf(overview([limit({ used_percent: 30 })]));
  assert.equal(light.tone, 'ok');
  assert.equal(moderate.tone, 'ok');
  // A linear ramp would show 11% of the full effect at 2% used, which reads as "something is
  // happening" when nothing is. The exponential has to keep the quiet end quiet.
  assert.ok(light.intensity < moderate.intensity, 'a fuller window is more present');
  assert.ok(light.intensity < 0.06, '2% used should be almost imperceptible');
});

test('the backdrop crosses to warn and crit at the same thresholds the rings do', () => {
  // 60 and 85 are `severityOf`'s thresholds. If either moves, this moves with it, because it
  // is the same function -- the test is here to make that coupling impossible to break by
  // editing a number on this side.
  assert.equal(ambientOf(overview([limit({ used_percent: 59 })])).tone, 'ok');
  assert.equal(ambientOf(overview([limit({ used_percent: 60 })])).tone, 'warn');
  assert.equal(ambientOf(overview([limit({ used_percent: 85 })])).tone, 'crit');
});

test('the worst window decides the mood, not the average', () => {
  const mixed = ambientOf(overview([
    limit({ source_id: 1, used_percent: 3, window_kind: '5h' }),
    limit({ source_id: 2, used_percent: 88, window_kind: 'weekly' }),
  ]));
  assert.equal(mixed.tone, 'crit', 'one window in trouble is the answer, not a mean of many empty ones');
});

test('a window that will exhaust before it resets is a problem long before 60%', () => {
  // `attention` is the app's existing verdict, reached when a window is at the threshold or
  // will run out first. A 20% window that empties in ten minutes is worse than a 70% window
  // with four hours to go, and the backdrop has to say so. The burn record needs three
  // samples before `willExhaust` will believe it at all, which is the app's own bar for
  // trusting a projection.
  const expiring = limit({
    used_percent: 20,
    burn: { percentPerHour: 120, projectedFullAt: now + 10 * 60_000, fromPercent: 20, fromAt: now - HOUR, samples: 5 },
  });
  const ambient = ambientOf(overview([expiring]));
  assert.equal(ambient.tone, 'warn', 'runs out first, so never calmer than warn');
  assert.equal(ambient.reason, 'OpenAI', 'and it can name the window responsible');
});

test('a reading that is days old may not colour the present', () => {
  const stale = ambientOf(overview([limit({ used_percent: 95, ageSeconds: STALE_AFTER_MS / 1000 + 60 })]));
  assert.equal(stale.tone, 'idle', 'a 90%-full reading from yesterday says nothing about now');
  assert.equal(stale.intensity, 0);
});

test('an expired reading may not colour the present either', () => {
  // `resets_at` in the past is what `isExpired` keys on, and it is a different failure from
  // staleness: the window closed, so its percentage is a historical fact.
  const expired = ambientOf(overview([limit({ used_percent: 95, resets_at: now - HOUR })]));
  assert.equal(expired.tone, 'idle');
});

test('a dead feed is idle, never calm', () => {
  // The single most dishonest thing this component could do: paint green because nothing is
  // wrong, when what is actually true is that nothing could be established.
  const blind = subscription({
    telemetry: {
      freshness: 'unknown', gap: false, reason: 'no_quota_observed', origins: [],
      latest_quota_at: null, latest_source_fetched_at: null, latest_usage_at: now, windows: [],
    },
  });
  const ambient = ambientOf(overview([limit()], [blind]));
  assert.equal(ambient.tone, 'idle', 'unknown is not the same as fine');
  assert.notEqual(ambient.tone, 'ok');
});

test('with nothing to report the backdrop is idle, and says nothing is responsible', () => {
  const empty = ambientOf(overview([], []));
  assert.deepEqual(empty, { tone: 'idle', intensity: 0, reason: null });
});

test('inactive subscriptions are excluded entirely', () => {
  // A switched-off subscription sitting at 99% is not a crisis; including it would paint the
  // dashboard red for a window nobody is reading.
  const off = subscription({ state: 'inactive' });
  const ambient = ambientOf(overview([limit({ used_percent: 99 })], [off]));
  assert.equal(ambient.tone, 'idle');
});

test('a hidden subscription does not colour the page, and a fully hidden set is simply idle', () => {
  /*
   * `hidden_subscriptions` is a display preference -- the Settings panel calls it
   * "Subscriptions on Live", which is where it is honoured. A reader who hides a noisy
   * subscription is saying "stop putting this in front of me", and the strongest possible
   * version of putting it in front of them is tinting every tab amber because a window they
   * dismissed is at 70%.
   *
   * An earlier version of this file also asserted the opposite, for the case where the hidden
   * subscription is the only one. That was wrong, and inconsistent with the test above it:
   * the preference is about being shown, so honouring it must not depend on what else is
   * visible. Hiding everything correctly leaves the dashboard idle rather than blank.
   */
  const hidden = ambientOf(overview([limit({ used_percent: 99, subscription_key: 'hidden' })], [
    subscription({ subscription_key: 'hidden' }),
  ]), ['hidden']);
  assert.equal(hidden.tone, 'idle', 'a subscription hidden from Live is not a reason to tint every tab');
  assert.equal(hidden.intensity, 0);
});

test('the backdrop never out-competes the content, even in real trouble', () => {
  const worst = ambientOf(overview([limit({ used_percent: 100 })]));
  assert.ok(worst.intensity <= MAX_INTENSITY, 'capped');
  // An absolute ceiling as well as a relative one, so a future change to MAX_INTENSITY cannot
  // quietly raise the whole thing past the point of being a backdrop.
  assert.ok(worst.intensity <= 0.55, 'a full ring and a full bar stay the loudest things on screen');
});

test('intensity only ever grows with a fuller window', () => {
  let previous = -1;
  for (const used of [0, 5, 20, 40, 60, 75, 85, 95, 100]) {
    const ambient = ambientOf(overview([limit({ used_percent: used })]));
    assert.ok(ambient.intensity > previous, `intensity must rise at ${used}%`);
    previous = ambient.intensity;
  }
});
