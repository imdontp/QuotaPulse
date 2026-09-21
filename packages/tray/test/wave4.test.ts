import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { galleryRoster, isExperimentalCharacterId, isSelectableCharacterId } from '../src/pet/catalog.js';
import { isContractCompatible, runtimeSatisfies } from '../src/pet/contract.js';
import { validateManifest } from '../src/pet/manifest.js';
import { validatePetAssetTree } from '../src/pet/asset-pipeline.js';
import { isCrashLoop, PetDiagnostics } from '../src/pet/diagnostics.js';
import { PET_CHARACTERS } from '../src/pet/characters.js';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

// ---------------------------------------------------------------------------
// A. Gallery (WAVE4_ACCEPTANCE_TEST_MATRIX.md §A)
// ---------------------------------------------------------------------------

test('the stable roster lists the four approved selectable characters', () => {
  const entries = galleryRoster().filter((e) => e.status === 'stable');
  assert.deepEqual(entries.map((e) => e.id), ['orbit_bot', 'pulse_fox', 'flux_blob', 'capsule_cat']);
  assert.ok(entries.every((e) => e.selectable));
});

test('approved bonus characters are selectable Beta entries with preview art', () => {
  const bonus = galleryRoster().filter(e => e.collection === 'bonus');
  assert.deepEqual(bonus.map(e => e.id), ['nova', 'byte', 'mochi', 'kuro']);
  for (const entry of bonus) {
    assert.equal(entry.status, 'beta');
    assert.ok(entry.selectable && entry.previewAsset);
    assert.ok(isSelectableCharacterId(entry.id));
    assert.equal(isExperimentalCharacterId(entry.id), false);
  }
  assert.equal(isSelectableCharacterId('unapproved_pet'), false);
});

// ---------------------------------------------------------------------------
// B. Asset contract & compatibility (§H, ASSET_VERSIONING_POLICY.md)
// ---------------------------------------------------------------------------

test('manifest contract versions outside the supported range are rejected', () => {
  const base = JSON.parse(
    JSON.stringify(rawManifestFixture()),
  ) as Record<string, unknown>;
  assert.ok(validateManifest({ ...base, contractVersion: 1 }).ok);
  assert.equal(validateManifest({ ...base, contractVersion: 2 }).ok, false);
  assert.equal(validateManifest({ ...base, contractVersion: 0 }).ok, false);
  assert.equal(validateManifest({ ...base, contractVersion: 'x' }).ok, false);
});

test('minimum runtime version stricter than the build is rejected', () => {
  const base = rawManifestFixture();
  assert.ok(validateManifest({ ...base, minimumRuntimeVersion: '1.0.0' }).ok);
  assert.equal(validateManifest({ ...base, minimumRuntimeVersion: '99.0.0' }).ok, false);
});

test('release status / selectable fields must be well-typed', () => {
  const base = rawManifestFixture();
  assert.ok(validateManifest({ ...base, status: 'beta', selectable: false }).ok);
  assert.equal(validateManifest({ ...base, status: 'premium' }).ok, false);
  assert.equal(validateManifest({ ...base, selectable: 'yes' }).ok, false);
});

function rawManifestFixture(): Record<string, unknown> {
  const loop = (fallback: string): unknown => ({ playback: 'loop', src: `/assets/pets/orbit-bot/f.webp`, fallback });
  return {
    id: 'orbit_bot',
    displayName: 'Orbit Bot',
    assetVersion: 1,
    pivot: { x: 0.5, y: 0.9 },
    supportedSizes: [128, 256],
    animations: {
      healthy_idle: { playback: 'loop', src: '/assets/pets/orbit-bot/healthy_idle.webp', fallback: 'healthy_static' },
      working_loop: loop('healthy_idle'),
      warning_intro: loop('warning_loop'),
      warning_loop: loop('healthy_idle'),
      critical_intro: loop('critical_loop'),
      critical_loop: loop('warning_loop'),
      reset_celebrate: loop('healthy_idle'),
      talk_loop: loop('healthy_idle'),
      hover_react: loop('healthy_idle'),
      click_react: loop('healthy_idle'),
    },
  };
}

// ---------------------------------------------------------------------------
// B/C. Pipeline validation (§B, ASSET_PIPELINE_SPEC.md §7)
// ---------------------------------------------------------------------------

test('a stable character missing its semantic fallback chain is a hard failure', () => {
  const dir = tempTree();
  try {
    writeFixture(dir, 'orbit-bot', 'manifest.json', JSON.stringify({
      id: 'orbit_bot',
      displayName: 'Orbit Bot',
      assetVersion: 1,
      pivot: { x: 0.5, y: 0.9 },
      supportedSizes: [256],
      animations: {
        // No healthy_idle entry, and warning/critical chains are broken.
        warning_loop: { playback: 'loop', src: '/assets/pets/orbit-bot/warning_loop.webp', fallback: 'nowhere' },
        critical_loop: { playback: 'loop', src: '/assets/pets/orbit-bot/critical_loop.webp', fallback: 'nope' },
      },
    }));
    writeFileSync(join(dir, 'orbit-bot', 'healthy_idle.webp'), Buffer.alloc(10));
    const report = validatePetAssetTree(dir);
    assert.equal(report.ok, false);
    assert.ok(report.issues.some((i) => i.severity === 'error' && i.message.includes('fallback chain')));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('experimental candidates only warn, never hard-fail the tree', () => {
  const dir = tempTree();
  try {
    // Seed every stable character from the real repo manifests so their state passes.
    for (const def of PET_CHARACTERS) {
      mkdirSync(join(dir, def.id.replace(/_/g, '-')), { recursive: true });
      writeFileSync(
        join(dir, def.id.replace(/_/g, '-'), 'manifest.json'),
        realManifestFor(def.id),
        'utf8',
      );
    }
    mkdirSync(join(dir, 'future-pet'), { recursive: true });
    writeFileSync(join(dir, 'future-pet', 'manifest.json'), '{"id":"future_pet","broken":true}', 'utf8');
    writeFileSync(join(dir, 'future-pet', 'readonly_note.txt'), 'n/a');
    const report = validatePetAssetTree(dir);
    assert.equal(report.ok, true, report.issues.filter((i) => i.severity === 'error').map((i) => i.message).join(' | '));
    assert.ok(report.issues.some((i) => i.severity === 'warning' && i.path.startsWith('future-pet')));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('provider/model names must not appear in asset filenames', () => {
  const dir = tempTree();
  try {
    mkdirSync(join(dir, 'entry-nova'), { recursive: true });
    writeFileSync(join(dir, 'entry-nova', 'gpt-mascot.webp'), Buffer.alloc(8));
    const report = validatePetAssetTree(dir);
    assert.ok(report.issues.some((i) => i.severity === 'error' && i.message.includes('provider/model')));
    assert.equal(report.ok, false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('the real on-disk asset tree validates cleanly for the current stable roster', () => {
  const realPetsDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'pets');
  const report = validatePetAssetTree(realPetsDir);
  const errors = report.issues.filter((i) => i.severity === 'error');
  assert.deepEqual(errors, [], errors.map((i) => `${i.path}: ${i.message}`).join('; '));
  assert.ok(report.metadata.length >= 1, 'real tree should checksum its webp clips');
});

// ---------------------------------------------------------------------------
// C/E. Crash loop + diagnostics (§C, §E)
// ---------------------------------------------------------------------------

test('three crashes inside ten minutes is a crash loop; spread-out crashes are not', () => {
  const now = 10_000_000;
  assert.ok(isCrashLoop([now - 1000, now - 2000, now - 3000], now));
  assert.ok(!isCrashLoop([now - 1000, now - 2000, now - 700_000], now));
  assert.ok(!isCrashLoop([now - 1000, now - 2000], now));
});

test('animation identity switches count, unchanged-state restarts do not', () => {
  const diag = new PetDiagnostics();
  diag.observeAnimation('healthy_idle', 1000); // baseline observation, not a restart
  assert.equal(diag.snapshot().animationSwitches, 0);
  diag.observeAnimation('healthy_idle', 2000); // same id: no restart
  diag.observeAnimation('warning_loop', 3000);
  diag.observeAnimation('warning_loop', 4000); // deduped
  assert.equal(diag.snapshot().switchesPerMinute, 1);
  diag.count('fallbackCount', 3);
  diag.observeAnimation(null, 5000); // pause: last id sticky
  assert.equal(diag.snapshot().animationId, 'warning_loop');
});

test('the meta helper keeps the contract predicate honest', () => {
  assert.equal(isContractCompatible(1), true);
  assert.equal(isContractCompatible(undefined), false);
  assert.ok(runtimeSatisfies(undefined)); // absent requirement = compatible
});

// E. soak (WAVE4_ACCEPTANCE_TEST_MATRIX.md §E): one simulated hour of 2s polls
// with unchanged state, punctuated by real transitions -- no restart storm, a
// per-minute window rather than unbounded growth, memory-proof counters.
// E. soak (WAVE4_ACCEPTANCE_TEST_MATRIX.md §E): one simulated hour of 2s polls.
// The mood never changes, so the animation id never changes: restart suppression
// stays quiet (0 switches), nothing leaks stormy counters, snapshot stays flat.
test('soak: one simulated hour of unchanged-state polling performs zero restarts', () => {
  const diag = new PetDiagnostics();
  for (let tick = 0; tick < 1800; tick++) {
    diag.observeAnimation('healthy_idle', tick * 2000);
  }
  const snap = diag.snapshot('orbit_bot', 'default');
  assert.equal(snap.animationSwitches, 0);
  assert.equal(snap.switchesPerMinute, 0);
  assert.equal(snap.animationId, 'healthy_idle');
});

test('soak: four real transitions inside an hour stay well under a restart storm', () => {
  const diag = new PetDiagnostics();
  const changedAt = new Set([900, 1500, 2700, 1790]); // last one inside the final minute
  let expected = 0;
  let current: string | null = null;
  for (let tick = 0; tick < 1800; tick++) {
    const id = changedAt.has(tick) ? `anim_${tick}` : (current ?? 'anim_0');
    if (current !== null && id !== current) expected += 1; // baseline tick 0 is not a restart
    current = id;
    diag.observeAnimation(id, tick * 2000);
  }
  const snap = diag.snapshot('orbit_bot', 'default');
  assert.equal(snap.animationSwitches, expected);
  assert.ok(snap.switchesPerMinute >= 1 && snap.switchesPerMinute <= 5, `storm check: ${snap.switchesPerMinute}/min`);
});

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function tempTree(): string {
  return mkdtempSync(join(tmpdir(), 'qp-asset-tree-'));
}

function writeFixture(dir: string, slug: string, name: string, content: string): void {
  mkdirSync(join(dir, slug), { recursive: true });
  writeFileSync(join(dir, slug, name), content, 'utf8');
}

function realManifestFor(id: string): string {
  const path = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'pets', id.replace(/_/g, '-'), 'manifest.json');
  return readFileSync(path, 'utf8');
}
