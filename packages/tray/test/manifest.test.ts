import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  PET_ANIMATION_IDS,
  type PetAnimationAsset,
  type PetAnimationId,
  type PetCharacterManifest,
} from '../src/presence/types.js';
import { readManifest, resolveAnimation, validateManifest } from '../src/pet/manifest.js';

const PETS_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'pets');
const DIR: Record<string, string> = {
  orbit_bot: 'orbit-bot',
  pulse_fox: 'pulse-fox',
  flux_blob: 'flux-blob',
  capsule_cat: 'capsule-cat',
};

function asset(src: string, over: Partial<PetAnimationAsset> = {}): PetAnimationAsset {
  return { playback: 'loop', src, fallback: 'healthy_idle', reducedMotionSrc: null, ...over };
}

function manifest(animations: Partial<Record<PetAnimationId, PetAnimationAsset>>): PetCharacterManifest {
  return {
    id: 'orbit_bot',
    displayName: 'Orbit Bot',
    assetVersion: 1,
    pivot: { x: 0.5, y: 0.92 },
    supportedSizes: [512, 256, 128],
    animations,
  };
}

test('the shipped character manifests validate against the frozen schema', () => {
  for (const [id, dir] of Object.entries(DIR)) {
    const path = join(PETS_DIR, dir, 'manifest.json');
    assert.ok(existsSync(path), `${id} manifest must exist`);
    const { validation } = readManifest(path);
    assert.deepEqual(validation.issues, [], `${id} must have no validation issues`);
    assert.equal(validation.ok, true);
  }
});

test('validation rejects a manifest with a missing required animation', () => {
  const raw = JSON.parse(readFileSync(join(PETS_DIR, 'orbit-bot', 'manifest.json'), 'utf8')) as Record<string, unknown>;
  const animations = { ...(raw.animations as Record<string, unknown>) };
  delete animations.warning_intro;
  const result = validateManifest({ ...raw, animations });
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((i) => i.path === 'animations.warning_intro'));
});

test('a missing animation follows its declared fallback, warning once', () => {
  const m = manifest({
    healthy_idle: asset('/assets/pets/orbit-bot/healthy_idle.webp', { fallback: 'healthy_static' }),
    warning_loop: asset('/assets/pets/orbit-bot/warning_loop.webp'),
    // warning_intro is deliberately absent.
  });
  const warned: string[] = [];
  const keys = new Set<string>();
  const first = resolveAnimation(m, 'warning_intro', { warn: (s) => warned.push(s), warned: keys });
  assert.equal(first.animation, 'warning_loop');
  assert.equal(first.src, '/assets/pets/orbit-bot/warning_loop.webp');
  assert.equal(first.fellBack, true);

  // A second poll must not log again.
  resolveAnimation(m, 'warning_intro', { warn: (s) => warned.push(s), warned: keys });
  assert.equal(warned.length, 1, 'fallback warning must be emitted once');
});

test('reduced motion prefers the supplied variant, then a safe loop', () => {
  const withVariant = manifest({
    warning_intro: asset('/assets/pets/orbit-bot/warning_intro.webp', {
      playback: 'once',
      fallback: 'warning_loop',
      reducedMotionSrc: '/assets/pets/orbit-bot/warning_intro_reduced.webp',
    }),
    warning_loop: asset('/assets/pets/orbit-bot/warning_loop.webp'),
  });
  const a = resolveAnimation(withVariant, 'warning_intro', { reducedMotion: true });
  assert.equal(a.src, '/assets/pets/orbit-bot/warning_intro_reduced.webp');
  assert.equal(a.static, true);
  assert.equal(a.reducedVariant, true);

  const noVariant = manifest({
    warning_intro: asset('/assets/pets/orbit-bot/warning_intro.webp', { playback: 'once', fallback: 'warning_loop' }),
    warning_loop: asset('/assets/pets/orbit-bot/warning_loop.webp'),
  });
  const b = resolveAnimation(noVariant, 'warning_intro', { reducedMotion: true });
  assert.equal(b.animation, 'warning_loop', 'a one-shot intro is not reduced-motion-safe on its own');
  assert.equal(b.static, true);
  assert.equal(b.reducedVariant, false);
});

test('with no assets at all the resolver returns the vector placeholder, never crashing', () => {
  const empty = manifest({});
  const r = resolveAnimation(empty, 'critical_intro', {});
  assert.equal(r.src, null);
  assert.equal(r.animation, 'healthy_idle');
  assert.equal(r.fellBack, true);
});

test('every Wave 1 id resolves against a complete manifest', () => {
  const animations = Object.fromEntries(
    PET_ANIMATION_IDS.map((id) => [id, asset(`/assets/pets/orbit-bot/${id}.webp`)]),
  ) as Record<PetAnimationId, PetAnimationAsset>;
  const complete = manifest(animations);
  for (const id of PET_ANIMATION_IDS) {
    const r = resolveAnimation(complete, id, {});
    assert.equal(r.animation, id);
    assert.equal(r.src, `/assets/pets/orbit-bot/${id}.webp`);
  }
});
