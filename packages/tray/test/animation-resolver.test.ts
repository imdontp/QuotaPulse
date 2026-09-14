import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  baseAnimationForMood,
  createAnimationResolver,
  type ResolveAnimationInput,
} from '../src/presence/index.js';
import { ONCE_DURATION_MS } from '../src/pet/runtime.js';

const T0 = Date.parse('2026-09-02T12:00:00Z');

function input(over: Partial<ResolveAnimationInput> = {}): ResolveAnimationInput {
  return {
    characterId: 'orbit_bot',
    assetVersion: 1,
    mood: 'healthy',
    bubbleOpen: false,
    reducedMotion: false,
    now: T0,
    ...over,
  };
}

test('persistent base animation follows the mood', () => {
  assert.equal(baseAnimationForMood('healthy', false), 'healthy_idle');
  assert.equal(baseAnimationForMood('working', false), 'working_loop');
  assert.equal(baseAnimationForMood('warning', false), 'warning_loop');
  assert.equal(baseAnimationForMood('critical', false), 'critical_loop');
  assert.equal(baseAnimationForMood('reset', false), 'reset_celebrate');
  assert.equal(baseAnimationForMood('unknown', false), 'healthy_idle');
});

test('talk_loop replaces idle/working while a bubble is open, but never warning/critical', () => {
  assert.equal(baseAnimationForMood('healthy', true), 'talk_loop');
  assert.equal(baseAnimationForMood('working', true), 'talk_loop');
  assert.equal(baseAnimationForMood('warning', true), 'warning_loop');
  assert.equal(baseAnimationForMood('critical', true), 'critical_loop');
});

test('warning intro plays once, then settles into the warning loop', () => {
  const r = createAnimationResolver();
  const intro = r.resolve(input({ mood: 'warning', events: [{ type: 'warning' }] }));
  assert.equal(intro.animation, 'warning_intro');
  assert.equal(intro.playback, 'once');

  // 61 -> 62 -> 63 with no new event must not re-announce the intro.
  const held = r.resolve(input({ mood: 'warning', now: T0 + 400 }));
  assert.equal(held.animation, 'warning_intro');
  assert.equal(held.restart, false, 'the same clip must not restart');

  const loop = r.resolve(input({ mood: 'warning', now: T0 + ONCE_DURATION_MS.warning_intro + 50 }));
  assert.equal(loop.animation, 'warning_loop');
  assert.equal(loop.playback, 'loop');
});

test('critical intro plays once, then settles into the critical loop', () => {
  const r = createAnimationResolver();
  assert.equal(r.resolve(input({ mood: 'critical', events: [{ type: 'critical' }] })).animation, 'critical_intro');
  const loop = r.resolve(input({ mood: 'critical', now: T0 + ONCE_DURATION_MS.critical_intro + 10 }));
  assert.equal(loop.animation, 'critical_loop');
});

test('a critical event outranks a warning event arriving together', () => {
  const r = createAnimationResolver();
  const d = r.resolve(input({ mood: 'critical', events: [{ type: 'warning' }, { type: 'critical' }] }));
  assert.equal(d.animation, 'critical_intro');
});

test('threshold intros cannot be interrupted by hover or click', () => {
  const r = createAnimationResolver();
  const intro = r.resolve(input({ mood: 'critical', events: [{ type: 'critical' }] }));
  assert.equal(intro.animation, 'critical_intro');
  const during = r.resolve(input({ mood: 'critical', now: T0 + 200, interaction: 'click' }));
  assert.equal(during.animation, 'critical_intro', 'click must not cut the critical intro');
});

test('hover and click play their reaction once, then return to base', () => {
  const r = createAnimationResolver();
  const hover = r.resolve(input({ interaction: 'hover' }));
  assert.equal(hover.animation, 'hover_react');
  const back = r.resolve(input({ now: T0 + ONCE_DURATION_MS.hover_react + 10 }));
  assert.equal(back.animation, 'healthy_idle');

  const click = r.resolve(input({ now: T0 + 5_000, interaction: 'click' }));
  assert.equal(click.animation, 'click_react');
  assert.equal(click.playback, 'once');
});

test('reset celebrate plays once and recomputes the base afterwards', () => {
  const r = createAnimationResolver();
  assert.equal(r.resolve(input({ mood: 'reset', events: [{ type: 'reset' }] })).animation, 'reset_celebrate');
  const after = r.resolve(input({ mood: 'working', now: T0 + ONCE_DURATION_MS.reset_celebrate + 10 }));
  assert.equal(after.animation, 'working_loop');
});

test('the same clip does not restart on every quota refresh', () => {
  const r = createAnimationResolver();
  const first = r.resolve(input({ mood: 'working' }));
  assert.equal(first.animation, 'working_loop');
  assert.equal(first.restart, true, 'first resolve starts the clip');

  const second = r.resolve(input({ mood: 'working', now: T0 + 15_000 }));
  const third = r.resolve(input({ mood: 'working', now: T0 + 30_000 }));
  assert.equal(second.restart, false);
  assert.equal(third.restart, false);
});

test('switching character restarts the clip but does not touch engine state', () => {
  const r = createAnimationResolver();
  r.resolve(input({ mood: 'warning' }));
  const switched = r.resolve(input({ mood: 'warning', characterId: 'pulse_fox', now: T0 + 1_000 }));
  assert.equal(switched.restart, true, 'a new character must restart its own clip');
  assert.equal(switched.animation, 'warning_loop', 'mood is preserved across a character switch');
});

test('bumping assetVersion restarts the clip', () => {
  const r = createAnimationResolver();
  r.resolve(input({ mood: 'healthy' }));
  const bumped = r.resolve(input({ mood: 'healthy', assetVersion: 2, now: T0 + 1_000 }));
  assert.equal(bumped.restart, true);
});
