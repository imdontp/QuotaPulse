import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PET_CHARACTERS } from '../packages/tray/src/pet/characters.js';
import { validatePetAssetTree } from '../packages/tray/src/pet/asset-pipeline.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const source = resolve(root, 'packages/tray/assets/pets');
const packaged = resolve(root, 'packages/tray/dist-package/pets');
const approved = new Set(PET_CHARACTERS.map(character => character.id.replaceAll('_', '-')));
const files: Array<{ path: string; bytes: number; sha256: string }> = [];
function walk(dir: string, prefix = '') {
  for (const item of readdirSync(dir, { withFileTypes: true })) {
    assert.equal(item.isSymbolicLink(), false, `linked package entry ${item.name}`);
    const relative = prefix ? `${prefix}/${item.name}` : item.name;
    if (item.isDirectory()) { if (!prefix) assert.ok(approved.has(item.name), `unapproved character ${item.name}`); walk(join(dir, item.name), relative); }
    else {
      assert.equal(/(?:^|\/)(?:master|draft|prompt|contact)(?:\/|[-.])/i.test(relative), false, `development asset shipped: ${relative}`);
      const bytes = readFileSync(join(dir, item.name));
      assert.deepEqual(bytes, readFileSync(join(source, relative)), `packaged bytes changed: ${relative}`);
      files.push({ path: relative, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') });
    }
  }
}
walk(packaged); files.sort((a, b) => a.path.localeCompare(b.path, 'en'));
assert.ok(files.some(file => file.path === 'orbit-bot/manifest.json'));
for (const character of approved) assert.ok(files.some(file => file.path === `${character}/manifest.json`), `missing character ${character}`);
const validation = validatePetAssetTree(packaged);
assert.equal(validation.ok, true, JSON.stringify(validation.issues));
const output = resolve(root, 'screens/tray-recovery'); mkdirSync(output, { recursive: true });
writeFileSync(join(output, 'package-verification.json'), JSON.stringify({ status: 'passed', scope: 'pet runtime assets only; not application installer', characterCount: approved.size, fileCount: files.length, totalBytes: files.reduce((sum, file) => sum + file.bytes, 0), inventorySha256: createHash('sha256').update(JSON.stringify(files)).digest('hex'), validation: { ok: validation.ok, issues: validation.issues, checksummedClips: validation.metadata.length }, files }, null, 2));
console.log(`Asset package passed: ${files.length} unchanged runtime files, ${approved.size} approved characters.`);
