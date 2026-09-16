import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  ORBIT_BOT_MOTION_CLIPS,
  ORBIT_BOT_MOTION_PILOT,
  validateOrbitBotMotionPilot,
} from '../src/pet/orbit-motion.js';

const PILOT_PATH = fileURLToPath(new URL('../assets/pets/orbit-bot/motion-pilot.json', import.meta.url));

test('Orbit Bot motion pilot contains the approved 15-clip contract', () => {
  const raw = JSON.parse(readFileSync(PILOT_PATH, 'utf8')) as unknown;
  const validation = validateOrbitBotMotionPilot(raw);
  assert.equal(validation.ok, true, JSON.stringify(validation.issues));
  assert.deepEqual(Object.keys((raw as { animations: object }).animations), [...ORBIT_BOT_MOTION_CLIPS]);
  assert.deepEqual((raw as { pivot: object }).pivot, { x: 0.5, y: 0.92 });
  assert.deepEqual((raw as { runtimeSizes: number[] }).runtimeSizes, [512, 256]);
  const frames = Object.values(ORBIT_BOT_MOTION_PILOT.animations).reduce((sum, clip) => sum + clip.frames, 0);
  assert.equal(frames, 94);
});

test('Orbit Bot motion pilot rejects identity, pivot, and clip-shape drift', () => {
  const invalid = JSON.parse(JSON.stringify(ORBIT_BOT_MOTION_PILOT)) as Record<string, unknown>;
  invalid.characterId = 'pulse_fox';
  (invalid.pivot as Record<string, unknown>).y = 0.5;
  ((invalid.animations as Record<string, unknown>).idle_loop as Record<string, unknown>).fps = 0;
  const validation = validateOrbitBotMotionPilot(invalid);
  assert.equal(validation.ok, false);
  assert.ok(validation.issues.some((issue) => issue.path === 'characterId'));
  assert.ok(validation.issues.some((issue) => issue.path === 'pivot'));
  assert.ok(validation.issues.some((issue) => issue.path === 'animations.idle_loop.fps'));
});
