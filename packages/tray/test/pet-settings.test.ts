import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadPetSettings, savePetSettings } from '../src/pet/settings.js';
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
    savePetSettings(dir, { ...DEFAULT_PET_SETTINGS, character: 'flux_blob' });
    assert.equal(loadPetSettings(dir).character, 'flux_blob');
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
