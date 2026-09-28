import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Limit } from '../src/api';
import { RING_MAX, MIN_ARC_FRACTION, OVERFLOW_SWEEP, arcPath, credibleProjection, fractionToAngle, overflowSlot, ringArcs, windowProgress } from '../src/lib/quota-ring';

const now = 1_800_000_000_000;
const limit = (patch: Partial<Limit> = {}): Limit => ({
  source_id: 1, harness: 'codex', profile: 'default', display_name: 'a', window_kind: '5h',
  used_percent: 50, resets_at: now + 3_600_000, severity: null, observed_at: now, source_fetched_at: now,
  origin: 'live', account_key: 'a', account_provider: 'openai', account_display_name: 'a',
  subscription_key: 'a', subscription_provider: 'openai', subscription_display_name: 'a',
  ageSeconds: 30, valueAgeSeconds: 30, last_seen_at: now, burn: null, ...patch,
});

const burn = (projectedFullAt: number, percentPerHour = 8, samples = 12) => ({
  percentPerHour, projectedFullAt, fromPercent: 50, fromAt: now, samples,
});

test('arcs fill one fixed band however many subscriptions there are', () => {
  assert.deepEqual(ringArcs(0), []);
  for (const count of [1, 2, 3, 4]) {
    const arcs = ringArcs(count);
    assert.equal(arcs.length, count);
    assert.equal(arcs[0]?.radius, 168);
    // One inner bound for every count, so the ring never grows or shrinks as a list changes.
    assert.equal(arcs.at(-1)?.radius, count === 1 ? 168 : 78);
    if (count > 1) assert.ok(arcs[0]!.radius > arcs.at(-1)!.radius);
  }
  assert.deepEqual(ringArcs(2).map((a) => a.radius), [168, 78]);
  assert.deepEqual(ringArcs(3).map((a) => a.radius), [168, 123, 78]);
});

test('the ring folds anything past four instead of collapsing into the centre', () => {
  assert.equal(ringArcs(9).length, RING_MAX);
  assert.equal(ringArcs(9).at(-1)!.strokeWidth, 13, 'four arcs thin out to keep the centre clear');
  assert.equal(ringArcs(3)[0]!.strokeWidth, 15);
  for (const bad of [-5, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.equal(ringArcs(bad).length, 0);
  }
});

test('elapsed position is measured against the canonical window length', () => {
  const hour = 3_600_000;
  // A 5h window resetting in 3h started 2h ago, so 2/5 = 40% through.
  assert.equal(windowProgress(limit({ resets_at: now + 3 * hour }), now).elapsed, 0.4);
  // Resetting in 5h has just begun; resetting in 1h is 80% gone.
  assert.equal(windowProgress(limit({ resets_at: now + 5 * hour }), now).elapsed, 0);
  assert.equal(windowProgress(limit({ resets_at: now + hour }), now).elapsed, 0.8);
  // A window that has plainly rolled over pins to fully-elapsed rather than running
  // backwards, so an expired reading can never make the marker look like fresh quota.
  assert.equal(windowProgress(limit({ resets_at: now - 10 * hour }), now).elapsed, 1);
  // A reset further out than one full window means the window has not started, not that it
  // is nearly done. `isExpired` catches most of these upstream; the clamp is the backstop.
  assert.equal(windowProgress(limit({ resets_at: now + 40 * hour }), now).elapsed, 0);
  // Weekly windows use their own span, so the same "resets in 3 days" reads very differently.
  assert.equal(windowProgress(limit({ window_kind: 'weekly', resets_at: now + 3 * 86_400_000 }), now).elapsed, 4 / 7);
});

test('a window with no reset time cannot be placed on the ring', () => {
  for (const patch of [{ resets_at: null }, { window_kind: 'credits' }]) {
    assert.deepEqual(windowProgress(limit(patch), now), { elapsed: null, projected: null, willRunOut: false });
  }
});

test('the overflow marker never takes a reading\'s place or cross the numerals', () => {
  // No arcs, nothing to indicate.
  assert.equal(overflowSlot(ringArcs(0)), null);
  for (const count of [1, 2, 3, 4]) {
    const slot = overflowSlot(ringArcs(count));
    assert.ok(slot, `count ${count} should have room for the marker`);
    const inner = ringArcs(count).at(-1)!;
    // Inside the innermost arc, so it can never be read as a fifth subscription...
    assert.ok(slot.radius < inner.radius, `count ${count}`);
    // ...and clear of the centre text, which is about 50 units of radius.
    assert.ok(slot.radius >= 58, `count ${count} would cross the numerals at ${slot.radius}`);
    assert.ok(slot.strokeWidth < inner.strokeWidth, `count ${count}`);
  }
  // A single arc sits at the outer edge, so its marker is the furthest in of all.
  assert.ok(overflowSlot(ringArcs(1))!.radius > overflowSlot(ringArcs(4))!.radius);
});

test('the overflow marker is a partial arc, so it cannot pass for a reading', () => {
  const path = arcPath(200, 200, 60, 90 - OVERFLOW_SWEEP / 2, 90 + OVERFLOW_SWEEP / 2);
  assert.match(path, /^M [\d.]+ [\d.]+ A 60 60 0 0 1 [\d.]+ [\d.]+$/);
  // A full circle would be 360 degrees; this is a short segment low on the dial.
  assert.ok(OVERFLOW_SWEEP < 90, 'a long sweep would read as another arc');
  // Small-arc flag, so the renderer takes the short way round.
  assert.ok(path.includes(' 0 0 1 '), 'small-arc flag');
  /*
   * Centred on six o'clock, so the segment sits below the numerals and away from the
   * twelve o'clock start of the data arcs. Swept symmetrically: the endpoints mirror each
   * other about the vertical through the centre.
   */
  const [, sx, sy, ex, ey] = path.match(/M ([\d.]+) ([\d.]+) A \d+ \d+ 0 0 1 ([\d.]+) ([\d.]+)/)!.map(Number) as number[];
  assert.ok(sy > 200, 'the marker is in the lower half, clear of the centre text');
  assert.ok(ey > 200);
  assert.ok(sx > 200 && ex < 200, "it straddles six o'clock rather than sitting at the start");
  assert.ok(Math.abs((sx + ex) / 2 - 200) < 0.01, 'and is symmetric about it');
  assert.ok(Math.abs(sx - ex) > 20, 'a segment with real width, not a tick');
});

test('a projection that lands after the reset is not a projection at all', () => {
  const hour = 3_600_000;
  const reset = now + 3 * hour;
  const runsOut = windowProgress(limit({ used_percent: 88, resets_at: reset, burn: burn(now + 1.5 * hour, 12, 40) }), now);
  assert.equal(runsOut.elapsed, 0.4);
  assert.equal(runsOut.willRunOut, true);
  assert.ok(runsOut.projected != null);
  const survives = windowProgress(limit({ used_percent: 88, resets_at: reset, burn: burn(now + 6 * hour, 12, 40) }), now);
  assert.equal(survives.willRunOut, false);
  assert.equal(survives.projected, null, 'a projection past the reset is not a projection at all');
  assert.equal(windowProgress(limit(), now).projected, null);
});

test('an unbelievable projection cannot raise an alarm', () => {
  const hour = 3_600_000;
  const reset = now + 6 * 24 * hour; // a healthy week, six days to go
  const ghost = limit({ used_percent: 1, resets_at: reset, burn: burn(now + hour) });

  // This is the record from the real database: 1% used, six days to reset, and a burn
  // figure projecting it full anyway. Taken at face value it painted a red arc around
  // two thirds of a healthy page.
  assert.equal(windowProgress(ghost, now).willRunOut, false);
  assert.equal(windowProgress(ghost, now).projected, null);
  assert.equal(credibleProjection(ghost, now), null);

  // Too few samples is not a rate.
  assert.equal(
    credibleProjection(limit({ used_percent: 90, resets_at: reset, burn: burn(now + hour, 8, 2) }), now),
    null,
  );
  // A window that has already rolled over cannot run out.
  assert.equal(
    credibleProjection(limit({ used_percent: 90, resets_at: now - hour, burn: burn(now - 2 * hour) }), now),
    null,
  );
  // No projection, no claim.
  assert.equal(credibleProjection(limit({ used_percent: 90, resets_at: reset }), now), null);
  // Corroboration, not a fullness threshold: a claim the observed rate cannot support is
  // refused at any level, and a modest window that really is on pace still alerts.
  assert.equal(credibleProjection(limit({ used_percent: 50, resets_at: reset, burn: burn(now + 6 * hour) }), now), now + 6 * hour);
  assert.equal(
    credibleProjection(limit({ used_percent: 95, resets_at: reset, burn: { ...burn(now + hour), percentPerHour: 0.5 } }), now),
    null,
    '0.5%/h cannot fill the last 5 points in an hour',
  );
});

test('fractions map to clock angles, clamped at both ends', () => {
  assert.equal(fractionToAngle(0), -90);
  assert.equal(fractionToAngle(0.25), 0);
  assert.equal(fractionToAngle(0.5), 90);
  assert.equal(fractionToAngle(1), 270);
  assert.equal(fractionToAngle(-3), -90);
  assert.equal(fractionToAngle(9), 270);
});
