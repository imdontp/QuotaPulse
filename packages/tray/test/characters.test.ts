import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PET_CHARACTERS,
  coercePetCharacter,
  isPetCharacter,
  isVectorCharacter,
  petCharacterName,
  renderPetSvg,
} from '../src/pet/characters.js';
import {
  DEFAULT_PET_CHARACTER,
  PET_CHARACTER_IDS,
  type PetMood,
} from '../src/presence/types.js';

const MOODS: PetMood[] = ['healthy', 'working', 'warning', 'critical', 'reset', 'unknown'];

test('the registry ships originals and approved bonus mascots with Orbit Bot as default', () => {
  assert.deepEqual(
    PET_CHARACTERS.map((c) => c.id),
    ['orbit_bot', 'pulse_fox', 'flux_blob', 'capsule_cat', 'nova', 'byte', 'mochi', 'kuro'],
  );
  assert.deepEqual(PET_CHARACTERS.map((c) => c.name), ['Orbit Bot', 'Pulse Fox', 'Flux Blob', 'Capsule Cat', 'Nova', 'Byte', 'Mochi', 'Kuro']);
  assert.deepEqual([...PET_CHARACTER_IDS], PET_CHARACTERS.map(c => c.id));
  assert.equal(DEFAULT_PET_CHARACTER, 'orbit_bot');
  assert.equal(petCharacterName('capsule_cat'), 'Capsule Cat');
});

test('character ids are validated; the old hyphen form is accepted and migrated', () => {
  for (const id of PET_CHARACTER_IDS) assert.equal(isPetCharacter(id), true);
  assert.equal(isPetCharacter('pulse_dragon'), false);
  assert.equal(isPetCharacter(null), false);
  assert.equal(isPetCharacter(7), false);
  // Pre-Wave-1 settings stored hyphenated ids; they must migrate, not reset.
  assert.equal(coercePetCharacter('orbit-bot'), 'orbit_bot');
  assert.equal(coercePetCharacter('pulse-fox'), 'pulse_fox');
  assert.equal(coercePetCharacter('pulse_dragon'), null);
});

test('Orbit Bot prefers its raster clips; the other three render as vector placeholders', () => {
  assert.equal(isVectorCharacter('orbit_bot'), false);
  assert.equal(isVectorCharacter('pulse_fox'), true);
  assert.equal(isVectorCharacter('flux_blob'), true);
  assert.equal(isVectorCharacter('capsule_cat'), true);
});

test('every mascot renders an SVG placeholder for every mood, including unknown', () => {
  for (const id of PET_CHARACTER_IDS) {
    for (const mood of MOODS) {
      const svg = renderPetSvg(id, mood, { color: '#8a939e', percent: 40 });
      assert.match(svg, /^<svg /);
      assert.match(svg, new RegExp(`data-character="${id}"`));
      assert.match(svg, new RegExp(`data-mood="${mood}"`));
      assert.match(svg, /<\/svg>$/);
    }
  }
});

test('the SVG exposes stable part classes for the expression layer', () => {
  for (const id of PET_CHARACTER_IDS) {
    const svg = renderPetSvg(id, 'healthy', { color: '#22d3a7', percent: 50 });
    for (const part of ['qp-sprite', 'qp-eye', 'qp-look', 'qp-mouth', 'qp-ring', 'qp-live']) {
      assert.match(svg, new RegExp(`class="${part}[ "]`), `${id} must expose .${part}`);
    }
  }
  for (const id of ['orbit_bot', 'pulse_fox', 'capsule_cat'] as const) {
    const svg = renderPetSvg(id, 'healthy', { color: '#22d3a7', percent: 50 });
    assert.match(svg, /class="qp-leg /, `${id} must expose walkable legs`);
  }
});

test('the artwork changes with the mood and the mascot', () => {
  const healthy = renderPetSvg('pulse_fox', 'healthy', { color: '#22d3a7', percent: 20 });
  const critical = renderPetSvg('pulse_fox', 'critical', { color: '#ff4d4f', percent: 90 });
  const cat = renderPetSvg('capsule_cat', 'healthy', { color: '#22d3a7', percent: 20 });
  assert.notEqual(healthy, critical);
  assert.notEqual(healthy, cat);
  assert.match(critical, /#ff4d4f/, 'the mood colour reaches the art');
});

test('the quota ring follows the focused percentage', () => {
  const empty = renderPetSvg('orbit_bot', 'healthy', { color: '#22d3a7', percent: null });
  const half = renderPetSvg('orbit_bot', 'healthy', { color: '#22d3a7', percent: 50 });
  const full = renderPetSvg('orbit_bot', 'healthy', { color: '#22d3a7', percent: 100 });
  assert.doesNotMatch(empty, /stroke-dasharray/);
  assert.match(half, /stroke-dasharray/);
  assert.match(full, /stroke-dasharray/);
  assert.notEqual(half, full);
});
