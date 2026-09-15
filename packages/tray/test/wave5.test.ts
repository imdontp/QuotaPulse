import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { isShippableCharacterDir } from '../scripts/package-assets.js';
import { defaultPetSettings, loadPetSettings, savePetSettings, settingsPath } from '../src/pet/settings.js';

// ---------------------------------------------------------------------------
// Wave 5 G16 hardening: only stable-rooster directories may ship in production
// ---------------------------------------------------------------------------

const STABLE_DIRS = ['orbit-bot', 'pulse-fox', 'flux-blob', 'capsule-cat', 'nova', 'byte', 'mochi', 'kuro'];
const EXPERIMENTAL_DIRS = ['future-pet', 'unapproved-cat'];

test('packaging includes every stable character directory regardless of id form', () => {
  for (const dir of STABLE_DIRS) {
    assert.ok(isShippableCharacterDir(dir), `${dir} must ship`);
  }
  // The hyphen-to-underscore migration must also resolve to a stable character.
  assert.ok(isShippableCharacterDir('orbit_bot'));
});

test('packaging excludes experimental candidate directories outright (wave5 G16 leak fix)', () => {
  for (const dir of EXPERIMENTAL_DIRS) {
    assert.equal(isShippableCharacterDir(dir), false, `${dir} must not ship`);
  }
  // Legacy hyphen forms with no stable counterpart never accidentally match.
  for (const dir of EXPERIMENTAL_DIRS) {
    assert.equal(isShippableCharacterDir(`${dir}-pet`), false);
  }
});

test('packaging excludes unblessed junk directories from the production bundle', () => {
  assert.equal(isShippableCharacterDir('unused_concept'), false);
  assert.equal(isShippableCharacterDir('_shared_materials'), false);
});

// ---------------------------------------------------------------------------
// Wave 5 G12: settings migration is idempotent across repeated loads
// ---------------------------------------------------------------------------

function withSettingsDir(testId: string, write: (dataDir: string) => void): { dataDir: string; clean: () => void } {
  const dataDir = mkdtempSync(join(tmpdir(), `qp-wave5-${testId}-`));
  write(dataDir);
  return { dataDir, clean: () => rmSync(dataDir, { recursive: true, force: true }) };
}

test('a legacy settings file loads to the same result on repeated reads (migrate once, read stable)', () => {
  const probe = withSettingsDir('legacy', (dataDir) => {
    mkdirSync(dataDir, { recursive: true });
    writeFileSync(
      settingsPath(dataDir),
      JSON.stringify({ schemaVersion: 1, character: 'pulse-fox', movement: 'companion' }),
      'utf8',
    );
  });
  try {
    const first = loadPetSettings(probe.dataDir);
    const second = loadPetSettings(probe.dataDir);
    assert.deepEqual(second, first);
    assert.equal(second.character, 'pulse_fox'); // hyphen id migrated, not reset
  } finally {
    probe.clean();
  }
});

test('saving current settings and reloading is a round trip with no drift', () => {
  const probe = withSettingsDir('roundtrip', () => undefined);
  try {
    savePetSettings(probe.dataDir, { ...defaultPetSettings(), movement: 'roaming', reducedMotion: false });
    const reloaded = loadPetSettings(probe.dataDir);
    assert.equal(reloaded.movement, 'roaming');
    // The save stamps schemaVersion inside the file, not onto the caller's object.
    assert.ok(JSON.parse(JSON.stringify(reloaded)).schemaVersion === undefined);
  } finally {
    probe.clean();
  }
});
