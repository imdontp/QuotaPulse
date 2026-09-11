import Database from 'better-sqlite3';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';

import { openDb } from '../src/db/index.js';
import { tmpRoot } from './fixtures.js';

test('openDb upgrades a legacy source table before creating account indexes', () => {
  const path = join(tmpRoot(), 'legacy.db');
  const legacy = new Database(path);
  legacy.exec(`
    CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    INSERT INTO meta (key, value) VALUES ('schema_version', '1');
    CREATE TABLE source (
      id INTEGER PRIMARY KEY,
      harness TEXT NOT NULL,
      profile TEXT NOT NULL,
      root_path TEXT NOT NULL,
      display_name TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      detected_at INTEGER NOT NULL,
      UNIQUE (harness, profile)
    );
  `);
  legacy.close();

  const db = openDb(path);
  const columns = db.prepare('PRAGMA table_info(source)').all() as Array<{ name: string }>;
  const names = new Set(columns.map((column) => column.name));

  assert.equal(names.has('source_kind'), true);
  assert.equal(names.has('account_key'), true);
  assert.doesNotThrow(() => db.prepare('SELECT * FROM source').all());
  assert.doesNotThrow(() => db.prepare('SELECT * FROM sqlite_master WHERE name = ?').get('idx_source_account_key'));
  db.close();
});
