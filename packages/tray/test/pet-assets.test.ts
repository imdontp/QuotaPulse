import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { PET_CHARACTERS } from '../src/pet/characters.js';
import { DEFAULT_PET_CHARACTER } from '../src/presence/types.js';

/**
 * The on-disk asset layout (WAVE1_PRODUCTION_ASSET_BIBLE.md §2/§8) is the production
 * contract. This test keeps it from drifting away from the registry the runtime uses.
 */
const PETS_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'pets');
const dirFor = (id: string): string => id.replace(/_/g, '-');

function readJson(path: string): Record<string, unknown> {
  return JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
}

test('every registry character has a manifest whose identity matches', () => {
  for (const c of PET_CHARACTERS) {
    const path = join(PETS_DIR, dirFor(c.id), 'manifest.json');
    assert.ok(existsSync(path), `${c.id} needs a manifest`);
    const m = readJson(path);
    assert.equal(m.id, c.id);
    assert.equal(m.displayName, c.name);
    assert.equal(m.motionStyle, c.motionStyle);
    assert.deepEqual(m.brandAnchors, [...c.anchors]);
  }
});

test('Orbit Bot is the only default character', () => {
  for (const c of PET_CHARACTERS) {
    const m = readJson(join(PETS_DIR, dirFor(c.id), 'manifest.json'));
    assert.equal(m.default === true, c.id === DEFAULT_PET_CHARACTER, `${c.id} default flag must match`);
  }
});

test('the two Orbit Bot placeholder clips referenced today exist on disk', () => {
  // These are the only Wave 1 clips wired so far; the rest resolve to the vector fallback.
  assert.ok(existsSync(join(PETS_DIR, 'orbit-bot', 'healthy_idle.webp')));
  assert.ok(existsSync(join(PETS_DIR, 'orbit-bot', 'working_loop.webp')));
});

test('the stable roster ships concept-safe motion extension sheets', () => {
  for (const id of ['orbit_bot', 'pulse_fox', 'flux_blob', 'capsule_cat']) {
    const motionDir = join(PETS_DIR, dirFor(id), 'motion-extension');
    assert.ok(existsSync(join(motionDir, 'core-pose-sheet.png')), `${id} needs a core pose sheet`);
    assert.ok(existsSync(join(motionDir, 'action-pose-sheet.png')), `${id} needs an action pose sheet`);
  }
});
