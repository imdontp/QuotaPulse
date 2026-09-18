import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PET_STRIP_HEIGHT,
  PET_WINDOW_HEIGHT,
  petPopupBounds,
  petWindowBounds,
  roamWindowBounds,
  roamZones,
  shortCountdown,
} from '../src/pet-state.js';

const HOUR = 3_600_000;

test('shortCountdown scales from seconds to hours', () => {
  assert.equal(shortCountdown(0), 'now');
  assert.equal(shortCountdown(45_000), '45s');
  assert.equal(shortCountdown(12 * 60_000), '12m');
  assert.equal(shortCountdown(3 * HOUR), '3h');
  assert.equal(shortCountdown(3 * HOUR + 5 * 60_000), '3h 5m');
});

test('pet strip pins to the work area bottom and is tall enough for bubbles', () => {
  const workArea = { x: 0, y: 0, width: 1920, height: 1040 };
  assert.deepEqual(petWindowBounds(workArea), {
    x: 0,
    y: 1040 - PET_WINDOW_HEIGHT,
    width: 1920,
    height: PET_WINDOW_HEIGHT,
  });
  assert.ok(PET_WINDOW_HEIGHT > PET_STRIP_HEIGHT, 'the bubble area needs room above the pet band');
});

test('the popup follows the actual pet rect and never overlaps it', () => {
  const workArea = { x: 0, y: 0, width: 1920, height: 1040 };

  const middlePet = { x: 928, y: 700, width: 64, height: 64 };
  const mid = petPopupBounds(workArea, middlePet);
  assert.equal(mid.x + mid.width / 2, 960);
  assert.equal(mid.y + mid.height, middlePet.y - 8);

  const left = petPopupBounds(workArea, { x: 0, y: 700, width: 64, height: 64 });
  assert.ok(left.x >= 0);
  assert.ok(left.x + left.width <= workArea.width);

  const right = petPopupBounds(workArea, { x: 1856, y: 700, width: 64, height: 64 });
  assert.ok(right.x >= 0);
  assert.ok(right.x + right.width <= workArea.width);
  assert.ok(right.y >= 0);
});

test('the popup moves below a pet near the top and shrinks on a constrained side', () => {
  const workArea = { x: 100, y: 40, width: 800, height: 600 };
  const topPet = { x: 468, y: 48, width: 64, height: 64 };
  const below = petPopupBounds(workArea, topPet);
  assert.equal(below.y, topPet.y + topPet.height + 8);
  assert.ok(below.y + below.height <= workArea.y + workArea.height - 8);

  const middlePet = { x: 468, y: 310, width: 64, height: 64 };
  const constrained = petPopupBounds(workArea, middlePet);
  assert.ok(
    constrained.y + constrained.height <= middlePet.y - 8 ||
      constrained.y >= middlePet.y + middlePet.height + 8,
  );
});

test('roaming spans the union of every display at the primary baseline', () => {
  const primary = { x: 0, y: 0, width: 1920, height: 1040 };
  const left = { x: -1280, y: 0, width: 1280, height: 1024 };
  const window = roamWindowBounds([primary, left], primary);
  assert.equal(window.x, -1280);
  assert.equal(window.width, 3200);
  assert.equal(window.y, primary.height - PET_WINDOW_HEIGHT);
});

test('roam zones exclude displays that are not on the baseline and the gaps between them', () => {
  const primary = { x: 0, y: 0, width: 1920, height: 1040 };
  // Bottom edge (920) stops short of the taskbar line (968), so this monitor is above it.
  const raisedRight = { x: 1920, y: 120, width: 1080, height: 800 };
  const above = { x: 0, y: -1080, width: 1920, height: 1080 };
  const window = roamWindowBounds([primary, raisedRight, above], primary);
  const zones = roamZones([primary, raisedRight, above], window);

  assert.equal(zones.length, 1, 'only the primary reaches the taskbar line');
  assert.deepEqual(zones[0], { x0: 0, x1: 1920 });
});

test('two monitors on the same baseline give two zones with a gap between them', () => {
  const primary = { x: 0, y: 0, width: 1920, height: 1040 };
  const right = { x: 2100, y: 0, width: 1080, height: 1040 }; // 180px bezel gap
  const window = roamWindowBounds([primary, right], primary);
  assert.deepEqual(roamZones([primary, right], window), [
    { x0: 0, x1: 1920 },
    { x0: 2100, x1: 3180 },
  ]);
});

test('a display too small to hold the pet is not a zone', () => {
  const primary = { x: 0, y: 0, width: 1920, height: 1040 };
  const sliver = { x: 1920, y: 0, width: 40, height: 1040 };
  const window = roamWindowBounds([primary, sliver], primary);
  assert.equal(roamZones([primary, sliver], window).length, 1);
});
