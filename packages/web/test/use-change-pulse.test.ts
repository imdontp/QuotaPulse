import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isMaterialChange } from '../src/lib/use-change-pulse';

/*
 * "That number moved" is not information on a page that repaints about once a second, so
 * the threshold that decides what counts as worth noticing is the whole feature. Every rule
 * below exists because the alternative is a page that either looks static or strobes.
 */

const RULES = { relative: 0.02, absolute: 0 };

test('a first reading is never a change', () => {
  // Nothing to compare against. Treating the initial value as a jump would fire on every
  // page that mounts, which is every page.
  assert.equal(isMaterialChange(null, 1_000, RULES), false);
  assert.equal(isMaterialChange(null, 0, RULES), false);
});

test('a change under the relative threshold is drift, not an event', () => {
  assert.equal(isMaterialChange(1_000_000, 1_005_000, RULES), false, '0.5% on a big figure');
  assert.equal(isMaterialChange(100, 101, RULES), false, 'one unit');
  assert.equal(isMaterialChange(100, 100, RULES), false, 'no change at all');
});

test('a change over the threshold is an event', () => {
  assert.equal(isMaterialChange(1_000_000, 1_100_000, RULES), true, '10% on a big figure');
  assert.equal(isMaterialChange(100, 110, RULES), true);
});

test('the threshold is relative, not absolute, so it means the same on any magnitude', () => {
  // The reason for the whole design: 10,000 more tokens is a rounding error on 40 million
  // and a doubling on 40 thousand. An absolute threshold would flag one and miss the other.
  const small = isMaterialChange(40_000, 50_000, RULES);
  const large = isMaterialChange(40_000_000, 40_010_000, RULES);
  assert.equal(small, true, 'a 25% jump is an event');
  assert.equal(large, false, 'a 0.025% jump on a big figure is not');
});

test('a move to zero from a real figure always counts', () => {
  // The single most important thing this signal can report is that the data stopped.
  assert.equal(isMaterialChange(1, 0, RULES), true);
  assert.equal(isMaterialChange(999_999, 0, RULES), true);
});

test('a rise from zero is judged on the floor, not the previous value', () => {
  // Dividing by the previous value, or reading the first value as an infinite increase, are
  // both ways to make a number that has merely started look like a spike. So a rise from
  // zero is measured against the caller's floor and nothing else.
  const floor = { relative: 0.02, absolute: 100 };
  assert.equal(isMaterialChange(0, 5, floor), false, 'a figure that started small is not an event');
  assert.equal(isMaterialChange(0, 50, floor), false, 'still under the floor');
  assert.equal(isMaterialChange(0, 500, floor), true, 'and one that starts above it is');
  // With no floor at all, any departure from zero is a change -- which is why the floor
  // defaults to being the caller's job rather than this module's guess.
  assert.equal(isMaterialChange(0, 5, RULES), true, 'zero floor means zero is the only silent value');
});

test('crossing zero counts in either direction', () => {
  // Sign changes are not size changes, so the ratio test does not describe them: 5 -> -5 reads
  // as +200% and is just a number going negative.
  assert.equal(isMaterialChange(5, -5, RULES), true);
  assert.equal(isMaterialChange(-5, 5, RULES), true);
});

test('a drop counts the same as a rise', () => {
  // A figure that halves is as much a fact as one that doubles, and a threshold that only
  // looked upward would miss it.
  assert.equal(isMaterialChange(10_000, 4_000, RULES), true);
});

test('non-finite values are never events', () => {
  // A transient NaN from a division by an empty set must not be reported as the number
  // changing, and must not become the new baseline either.
  assert.equal(isMaterialChange(100, Number.NaN, RULES), false);
  assert.equal(isMaterialChange(100, Number.POSITIVE_INFINITY, RULES), false);
  assert.equal(isMaterialChange(Number.NaN, 100, RULES), false);
});

test('a climb that would strobe is the case the threshold has to survive', () => {
  // 3,000 calls a second is not unusual for an active machine. Each of these individually is
  // under 2% of a large running total, so none of them may fire -- which is what stops the
  // tile from re-illuminating every repaint.
  let value = 5_000_000;
  let fired = 0;
  for (let tick = 0; tick < 20; tick++) {
    value += 3_000;
    if (isMaterialChange(value - 3_000, value, RULES)) fired++;
  }
  assert.equal(fired, 0, 'a busy but unremarkable climb is silent');
});

test('a genuine jump on top of a busy climb still registers', () => {
  // The threshold has to be selective, not numb: the machine is working and then something
  // happens, and that should be visible.
  let value = 5_000_000;
  for (let tick = 0; tick < 20; tick++) value += 3_000;
  assert.equal(isMaterialChange(value, value + 900_000, RULES), true, 'a 18% jump is an event');
});
