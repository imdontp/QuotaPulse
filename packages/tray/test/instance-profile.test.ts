import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { configureInstanceProfile } from '../src/instance-profile.js';

test('default Electron profile remains untouched', () => {
  assert.equal(configureInstanceProfile({ setPath() { assert.fail('unexpected profile override'); } }), undefined);
});
test('explicit instances isolate both settings and Chromium session storage', () => {
  const fixtures = fileURLToPath(new URL('../../../tmp/instance-profile/', import.meta.url));
  mkdirSync(fixtures, { recursive: true });
  const base = mkdtempSync(resolve(fixtures, 'case-'));
  const profiles = ['first', 'second'].map(name => {
    const calls: Array<[string, string]> = [];
    const path = configureInstanceProfile({ setPath(key, value) { calls.push([key, value]); } }, resolve(base, name));
    assert.equal(path, resolve(base, name, 'electron'));
    assert.ok(existsSync(path!));
    assert.deepEqual(calls, [['userData', path], ['sessionData', path]]);
    return path;
  });
  assert.notEqual(profiles[0], profiles[1]);
});
