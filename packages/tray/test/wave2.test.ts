import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  IDLE_BEHAVIOR_TIERS,
  WAVE2_EXPRESSION_ASSETS,
  WAVE2_EXTENDED_ASSETS,
  WAVE2_LOCOMOTION_ASSETS,
  idleBehaviorsFor,
  interactionBlocksLocomotion,
  interactionForAnimation,
  locomotionAllowed,
  locomotionRange,
  pickIdleBehavior,
  resolveLayeredState,
  turnFor,
  usesLegWalk,
  wave2ClipSrc,
  type IdleBehavior,
} from '../src/presence/index.js';
import type { PetBehaviorContext } from '../src/presence/types.js';

function ctx(over: Partial<PetBehaviorContext> = {}): PetBehaviorContext {
  return {
    movementMode: 'companion',
    reducedMotion: false,
    bubbleOpen: false,
    userHovering: false,
    userDragging: false,
    elapsedIdleMs: 0,
    facing: 'right',
    ...over,
  };
}

test('locomotion is gated by mode, reduced motion, hover and bubble (QA B/C/E)', () => {
  assert.equal(locomotionAllowed(ctx()), true, 'Companion is allowed to walk');
  assert.equal(locomotionAllowed(ctx({ movementMode: 'minimal' })), false, 'Minimal must not walk');
  assert.equal(locomotionAllowed(ctx({ reducedMotion: true })), false, 'reduced motion must not walk');
  assert.equal(locomotionAllowed(ctx({ userHovering: true })), false, 'hover pauses locomotion');
  assert.equal(locomotionAllowed(ctx({ userDragging: true })), false, 'drag pauses locomotion');
  assert.equal(locomotionAllowed(ctx({ bubbleOpen: true })), false, 'an open bubble pauses locomotion');
});

test('urgent intros and click acknowledgement suppress locomotion (QA B)', () => {
  assert.equal(interactionBlocksLocomotion('critical_intro'), true);
  assert.equal(interactionBlocksLocomotion('warning_intro'), true);
  assert.equal(interactionBlocksLocomotion('reset_celebrate'), true);
  assert.equal(interactionBlocksLocomotion('click_react'), true);
  assert.equal(interactionBlocksLocomotion('hover_react'), false);
  assert.equal(interactionBlocksLocomotion('talk_loop'), false);
  assert.equal(interactionBlocksLocomotion('none'), false);
});

test('local range matches the motion bible (Minimal 0, Companion 20-150)', () => {
  assert.deepEqual(locomotionRange('minimal'), { min: 0, max: 0 });
  assert.deepEqual(locomotionRange('companion'), { min: 20, max: 150 });
  assert.ok(locomotionRange('roaming').max > locomotionRange('companion').max);
});

test('turn is only required when the Pet faces away from the destination', () => {
  assert.equal(turnFor(100, 200, 'right'), 'turn_left');
  assert.equal(turnFor(300, 200, 'left'), 'turn_right');
  assert.equal(turnFor(300, 200, 'right'), null);
  assert.equal(turnFor(100, 200, 'left'), null);
  assert.equal(turnFor(200, 200, 'left'), null);
});

test('idle behaviors unlock in tiers, most recent only (Motion Bible §3)', () => {
  assert.deepEqual(idleBehaviorsFor(0), []);
  assert.deepEqual([...idleBehaviorsFor(10_000)], ['blink', 'look_left', 'look_right']);
  assert.ok(idleBehaviorsFor(18_000).includes('idle_variant_1'));
  assert.ok(idleBehaviorsFor(35_000).includes('stretch'), 'stretch is a Wave 2 recommended idle');
  const longIdle = idleBehaviorsFor(60_000);
  assert.ok(longIdle.includes('sit') && longIdle.includes('lie_down'));
  assert.deepEqual([...idleBehaviorsFor(120_000)], ['sleep_loop', 'lie_down']);
  assert.equal(IDLE_BEHAVIOR_TIERS.length, 5);
});

test('reposition is only offered when locomotion is allowed (QA B/D)', () => {
  const always: () => number = () => 0.999;
  const companion = pickIdleBehavior(ctx({ elapsedIdleMs: 40_000 }), always);
  assert.equal(companion, 'reposition', 'Companion may reposition at long idle');
  // Every policy that forbids locomotion must also drop `reposition` from the pool.
  for (const blocked of [
    ctx({ movementMode: 'minimal', elapsedIdleMs: 40_000 }),
    ctx({ reducedMotion: true, elapsedIdleMs: 40_000 }),
    ctx({ bubbleOpen: true, elapsedIdleMs: 40_000 }),
    ctx({ userHovering: true, elapsedIdleMs: 40_000 }),
  ]) {
    assert.notEqual(pickIdleBehavior(blocked, always), 'reposition');
  }
  assert.equal(pickIdleBehavior(ctx({ elapsedIdleMs: 1_000 }), always), null, 'nothing before the first tier');
});

test('resolveLayeredState clamps locomotion under intros and reduced motion', () => {
  const base = { mood: 'warning' as const, facing: 'right' as const };
  const walking = resolveLayeredState({
    ...base,
    interaction: 'none',
    locomotion: 'walk_right',
    context: ctx(),
  });
  assert.equal(walking.locomotion, 'walk_right');

  const duringIntro = resolveLayeredState({
    ...base,
    interaction: 'critical_intro',
    locomotion: 'walk_right',
    context: ctx(),
  });
  assert.equal(duringIntro.locomotion, 'stationary', 'locomotion is suppressed during an intro');

  const reduced = resolveLayeredState({
    ...base,
    interaction: 'none',
    locomotion: 'walk_right',
    context: ctx({ reducedMotion: true }),
  });
  assert.equal(reduced.locomotion, 'stationary');
});

test('Wave 1 animations map onto the Wave 2 interaction layer', () => {
  assert.equal(interactionForAnimation('critical_intro'), 'critical_intro');
  assert.equal(interactionForAnimation('warning_intro'), 'warning_intro');
  assert.equal(interactionForAnimation('reset_celebrate'), 'reset_celebrate');
  assert.equal(interactionForAnimation('hover_react'), 'hover_react');
  assert.equal(interactionForAnimation('click_react'), 'click_react');
  assert.equal(interactionForAnimation('talk_loop'), 'talk_loop');
  assert.equal(interactionForAnimation('healthy_idle'), 'none');
});

test('Wave 2 asset paths use the hyphen folder convention', () => {
  assert.equal(wave2ClipSrc('orbit_bot', 'blink'), '/assets/pets/orbit-bot/locomotion/blink.webp');
  assert.equal(wave2ClipSrc('pulse_fox', 'walk_left'), '/assets/pets/pulse-fox/locomotion/walk_left.webp');
  assert.equal(WAVE2_EXPRESSION_ASSETS.length, 5);
  assert.equal(WAVE2_LOCOMOTION_ASSETS.length, 6);
  assert.equal(WAVE2_EXTENDED_ASSETS.length, 5);
});

test('Flux Blob glides instead of leg-walking (Wave 2 handoff constraint)', () => {
  assert.equal(usesLegWalk('orbit_bot'), true);
  assert.equal(usesLegWalk('pulse_fox'), true);
  assert.equal(usesLegWalk('capsule_cat'), true);
  assert.equal(usesLegWalk('flux_blob'), false);
});

test('the idle pool never returns an unknown behavior', () => {
  const allowed = new Set<IdleBehavior>([
    'blink', 'look_left', 'look_right', 'idle_variant_1', 'idle_variant_2', 'stretch', 'sit', 'lie_down', 'sleep_loop', 'reposition',
  ]);
  for (const idle of [0, 10_000, 18_000, 35_000, 60_000, 120_000]) {
    const pick = pickIdleBehavior(ctx({ elapsedIdleMs: idle }), () => 0.5);
    if (pick) assert.ok(allowed.has(pick), `unexpected behavior ${pick}`);
  }
});
