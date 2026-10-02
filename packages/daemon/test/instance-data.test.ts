import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const fixtures = resolve(root, 'tmp/instance-data');
mkdirSync(fixtures, { recursive: true });
for (const custom of [true, false]) test(custom ? 'explicit data directory preserves legacy installation' : 'default data directory still adopts legacy installation', () => {
  const fixture = mkdtempSync(resolve(fixtures, 'case-'));
  const local = resolve(fixture, 'local');
  const legacy = resolve(local, 'plimsoll');
  mkdirSync(legacy, { recursive: true });
  writeFileSync(resolve(legacy, 'sentinel.txt'), 'synthetic legacy');
  const target = custom ? resolve(fixture, 'review') : resolve(local, 'quotapulse');
  const env = { ...process.env, LOCALAPPDATA: local };
  delete env.QUOTAPULSE_DATA_DIR;
  if (custom) env.QUOTAPULSE_DATA_DIR = target;
  const code = `import { openDb } from ${JSON.stringify(new URL('../src/db/index.ts', import.meta.url).href)}; openDb().close();`;
  const child = spawnSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', code], { cwd: root, env, encoding: 'utf8' });
  assert.equal(child.status, 0, child.stderr);
  assert.ok(existsSync(resolve(target, 'usage.db')));
  assert.equal(existsSync(legacy), custom);
  assert.equal(existsSync(resolve(target, 'sentinel.txt')), !custom);
  assert.equal(readFileSync(resolve(custom ? legacy : target, 'sentinel.txt'), 'utf8'), 'synthetic legacy');
});
