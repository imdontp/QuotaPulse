import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { copyAllowedFile, isShippableCharacterDir } from '../scripts/package-assets.js';
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

test('packaging ships approved Orbit motion runtime frames but not review masters', () => {
  assert.equal(copyAllowedFile('pets/orbit-bot/motion-pilot/runtime/256/idle_loop/idle_loop_001.png'), true);
  assert.equal(copyAllowedFile('pets/orbit-bot/motion-pilot/runtime/512/idle_loop/idle_loop_008.png'), true);
  assert.equal(copyAllowedFile('pets/orbit-bot/motion-pilot/runtime/256/walk_right/walk_right_001.png'), true);
  assert.equal(copyAllowedFile('pets/orbit-bot/motion-pilot/runtime/512/walk_right/walk_right_008.png'), true);
  assert.equal(copyAllowedFile('pets/orbit-bot/motion-pilot/runtime/256/walk_left/walk_left_001.png'), true);
  assert.equal(copyAllowedFile('pets/orbit-bot/motion-pilot/runtime/512/walk_left/walk_left_008.png'), true);
  assert.equal(copyAllowedFile('pets/orbit-bot/motion-pilot/runtime/256/turn_right/turn_right_001.png'), true);
  assert.equal(copyAllowedFile('pets/orbit-bot/motion-pilot/runtime/512/turn_right/turn_right_006.png'), true);
  assert.equal(copyAllowedFile('pets/orbit-bot/motion-pilot/runtime/256/turn_left/turn_left_001.png'), true);
  assert.equal(copyAllowedFile('pets/orbit-bot/motion-pilot/runtime/512/turn_left/turn_left_006.png'), true);
  assert.equal(copyAllowedFile('pets/orbit-bot/motion-pilot/runtime/256/stop/stop_001.png'), true);
  assert.equal(copyAllowedFile('pets/orbit-bot/motion-pilot/runtime/512/stop/stop_004.png'), true);
  assert.equal(copyAllowedFile('pets/orbit-bot/motion-pilot/runtime/256/sit_down/sit_down_001.png'), true);
  assert.equal(copyAllowedFile('pets/orbit-bot/motion-pilot/runtime/512/sit_down/sit_down_006.png'), true);
  assert.equal(copyAllowedFile('pets/orbit-bot/motion-pilot/runtime/256/sit_idle/sit_idle_001.png'), true);
  assert.equal(copyAllowedFile('pets/orbit-bot/motion-pilot/runtime/512/sit_idle/sit_idle_006.png'), true);
  assert.equal(copyAllowedFile('pets/orbit-bot/motion-pilot/runtime/256/lie_down/lie_down_001.png'), true);
  assert.equal(copyAllowedFile('pets/orbit-bot/motion-pilot/runtime/512/lie_down/lie_down_006.png'), true);
  assert.equal(copyAllowedFile('pets/orbit-bot/motion-pilot/runtime/256/sleep_loop/sleep_loop_001.png'), true);
  assert.equal(copyAllowedFile('pets/orbit-bot/motion-pilot/runtime/512/sleep_loop/sleep_loop_008.png'), true);
  assert.equal(copyAllowedFile('pets/orbit-bot/motion-pilot/runtime/256/stretch/stretch_001.png'), true);
  assert.equal(copyAllowedFile('pets/orbit-bot/motion-pilot/runtime/512/stretch/stretch_006.png'), true);
  assert.equal(copyAllowedFile('pets/orbit-bot/motion-pilot/runtime/256/hover_react/hover_react_001.png'), true);
  assert.equal(copyAllowedFile('pets/orbit-bot/motion-pilot/runtime/512/hover_react/hover_react_004.png'), true);
  assert.equal(copyAllowedFile('pets/orbit-bot/motion-pilot/runtime/256/wake_up/wake_up_001.png'), true);
  assert.equal(copyAllowedFile('pets/orbit-bot/motion-pilot/runtime/512/wake_up/wake_up_006.png'), true);
  assert.equal(copyAllowedFile('pets/orbit-bot/motion-pilot/runtime/256/walk_left/walk_right_001.png'), false);
  assert.equal(copyAllowedFile('pets/orbit-bot/motion-pilot/runtime/256/turn_right/turn_left_001.png'), false);
  assert.equal(copyAllowedFile('pets/orbit-bot/motion-pilot/runtime/256/turn_left/turn_right_001.png'), false);
  assert.equal(copyAllowedFile('pets/orbit-bot/motion-pilot/master/walk_right/walk_right_001.png'), false);
  assert.equal(copyAllowedFile('pets/orbit-bot/motion-pilot/master/idle_loop/idle_loop_001.png'), false);
  assert.equal(copyAllowedFile('pets/orbit-bot/motion-pilot/master/walk_left/walk_left_001.png'), false);
  assert.equal(copyAllowedFile('pets/orbit-bot/motion-pilot/master/turn_right/turn_right_001.png'), false);
  assert.equal(copyAllowedFile('pets/orbit-bot/motion-pilot/master/turn_left/turn_left_001.png'), false);
  assert.equal(copyAllowedFile('pets/orbit-bot/motion-pilot/master/stop/stop_001.png'), false);
  assert.equal(copyAllowedFile('pets/orbit-bot/motion-pilot/master/sit_down/sit_down_001.png'), false);
  assert.equal(copyAllowedFile('pets/orbit-bot/motion-pilot/master/sit_idle/sit_idle_001.png'), false);
  assert.equal(copyAllowedFile('pets/orbit-bot/motion-pilot/master/lie_down/lie_down_001.png'), false);
  assert.equal(copyAllowedFile('pets/orbit-bot/motion-pilot/master/sleep_loop/sleep_loop_001.png'), false);
  assert.equal(copyAllowedFile('pets/orbit-bot/motion-pilot/master/stretch/stretch_001.png'), false);
  assert.equal(copyAllowedFile('pets/orbit-bot/motion-pilot/master/hover_react/hover_react_001.png'), false);
  assert.equal(copyAllowedFile('pets/orbit-bot/motion-pilot/master/wake_up/wake_up_001.png'), false);
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
