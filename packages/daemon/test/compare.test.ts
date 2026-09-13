import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { openDb, upsertSource } from '../src/db/index.js';
import { compareUsage } from '../src/api/queries.js';
import { tmpRoot } from './fixtures.js';

test('compareUsage keeps equal windows and weighted pricing coverage together', () => {
  const db = openDb(join(tmpRoot(), 'compare.db'));
  const sourceId = upsertSource(db, { harness: 'codex', profile: 'default', rootPath: '/tmp/codex', displayName: 'Codex' });
  const add = db.prepare(`INSERT INTO usage_event
    (source_id, dedup_key, ts, call_count, model, provider, total_tokens, cost_usd, cost_source)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  add.run(sourceId, 'previous', 1_000, 2, 'gpt-5', 'openai', 20, 1, 'known');
  add.run(sourceId, 'current', 2_000, 3, 'gpt-5', 'openai', 30, 2, 'known');
  add.run(sourceId, 'unknown', 2_500, 4, 'local', 'local', 40, null, 'unknown');
  const result = compareUsage(db, { from: 2_000, to: 3_000, previousFrom: 1_000, previousTo: 2_000, groupBy: 'model' });
  assert.equal(result.current.calls, 7);
  assert.equal(result.previous.calls, 2);
  assert.equal(result.series.find((row) => row.series === 'local')?.previous, null);
  assert.equal(result.series.find((row) => row.series === 'local')?.current?.cost_unknown_calls, 4);
  db.close();
});
