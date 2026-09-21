import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadPetSettings, savePetSettings } from '../src/pet/settings.js';
import { loadPlacement, savePlacement } from '../src/pet/position.js';
import { DEFAULT_PET_SETTINGS } from '../src/presence/types.js';

function tempDir(): string {
  return mkdtempSync(join(tmpdir(), 'qp-pet-settings-'));
}

test('a missing settings file uses the spec defaults, including Orbit Bot', () => {
  const dir = tempDir();
  try {
    assert.deepEqual(loadPetSettings(dir), DEFAULT_PET_SETTINGS);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('the chosen character round-trips through disk', () => {
  const dir = tempDir();
  try {
    for (const character of ['flux_blob', 'nova', 'byte', 'mochi', 'kuro'] as const) {
      savePetSettings(dir, { ...DEFAULT_PET_SETTINGS, character, skin: 'winter', movement: 'companion', reducedMotion: true });
      const restored = loadPetSettings(dir);
      assert.equal(restored.character, character);
      assert.equal(restored.skin, 'winter');
      assert.equal(restored.movement, 'companion');
      assert.equal(restored.reducedMotion, true);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('a pre-Wave-1 hyphenated character id migrates instead of resetting', () => {
  const dir = tempDir();
  try {
    writeFileSync(
      join(dir, 'pet-settings.json'),
      JSON.stringify({ ...DEFAULT_PET_SETTINGS, character: 'capsule-cat' }),
      'utf8',
    );
    assert.equal(loadPetSettings(dir).character, 'capsule_cat');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('a pre-v2 file without a character falls back to the default', () => {
  const dir = tempDir();
  try {
    const legacy = { ...DEFAULT_PET_SETTINGS } as Record<string, unknown>;
    delete legacy.character;
    writeFileSync(join(dir, 'pet-settings.json'), JSON.stringify(legacy), 'utf8');
    assert.equal(loadPetSettings(dir).character, DEFAULT_PET_SETTINGS.character);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('an unknown character slug falls back to the default', () => {
  const dir = tempDir();
  try {
    writeFileSync(
      join(dir, 'pet-settings.json'),
      JSON.stringify({ ...DEFAULT_PET_SETTINGS, character: 'pulse-dragon' }),
      'utf8',
    );
    assert.equal(loadPetSettings(dir).character, DEFAULT_PET_SETTINGS.character);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('a saved file stamps the current schema version and reloads cleanly', () => {
  const dir = tempDir();
  try {
    savePetSettings(dir, { ...DEFAULT_PET_SETTINGS, character: 'pulse_fox' });
    const raw = JSON.parse(readFileSync(join(dir, 'pet-settings.json'), 'utf8')) as { schemaVersion?: number };
    assert.equal(raw.schemaVersion, 4);
    assert.equal(loadPetSettings(dir).character, 'pulse_fox');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('an unknown future schema version prefers the last-known-good backup', () => {
  const dir = tempDir();
  try {
    savePetSettings(dir, { ...DEFAULT_PET_SETTINGS, character: 'orbit_bot' });
    // Simulate an upgraded app having written a newer schema, plus a stale good backup.
    writeFileSync(
      join(dir, 'pet-settings.json'),
      JSON.stringify({ schemaVersion: 99, character: 'flux_blob' }),
      'utf8',
    );
    writeFileSync(
      join(dir, 'pet-settings.last-good.json'),
      JSON.stringify({ schemaVersion: 4, ...DEFAULT_PET_SETTINGS, character: 'orbit_bot' }),
      'utf8',
    );
    const diag = { corrupt: false, recoveredFromBackup: false };
    const loaded = loadPetSettings(dir, diag);
    assert.equal(loaded.character, 'orbit_bot');
    assert.equal(diag.corrupt, true);
    assert.equal(diag.recoveredFromBackup, true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('a healthy load refreshes the last-known-good backup', () => {
  const dir = tempDir();
  try {
    savePetSettings(dir, { ...DEFAULT_PET_SETTINGS, character: 'capsule_cat' });
    loadPetSettings(dir);
    const backup = JSON.parse(readFileSync(join(dir, 'pet-settings.last-good.json'), 'utf8')) as {
      character?: string;
    };
    assert.equal(backup.character, 'capsule_cat');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('corrupt primary without a backup falls back to defaults, not a crash', () => {
  const dir = tempDir();
  try {
    writeFileSync(join(dir, 'pet-settings.json'), '{"movement": "roami', 'utf8');
    const diag = { corrupt: false, recoveredFromBackup: false };
    const loaded = loadPetSettings(dir, diag);
    assert.deepEqual(loaded, DEFAULT_PET_SETTINGS);
    assert.equal(diag.corrupt, true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('placement loads recover from a corrupt primary via the last-known-good backup', () => {
  const dir = tempDir();
  try {
    savePlacement(dir, {
      displayId: 'primary',
      x: 120,
      y: 40,
      dock: 'taskbar-top',
      homeX: 120,
      homeY: 40,
      updatedAt: 1,
    });
    loadPlacement(dir); // refresh backup
    writeFileSync(join(dir, 'pet-position.json'), '{"x": 999', 'utf8');
    const diag = { corrupt: false, recoveredFromBackup: false };
    const placement = loadPlacement(dir, diag);
    assert.ok(placement);
    assert.equal(placement.x, 120);
    assert.equal(diag.recoveredFromBackup, true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('placement save leaves no .tmp litter and stamps its schema version', () => {
  const dir = tempDir();
  try {
    savePlacement(dir, { displayId: 'primary', x: 5, y: 5, dock: null, homeX: null, homeY: null, updatedAt: 0 });
    assert.equal(existsSync(join(dir, 'pet-position.json.tmp')), false);
    const raw = JSON.parse(readFileSync(join(dir, 'pet-position.json'), 'utf8')) as { schemaVersion?: number };
    assert.equal(raw.schemaVersion, 1);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
