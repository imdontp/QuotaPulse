import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { openDb, upsertSource } from '../src/db/index.js';
import { sessionCount, sessionList, sessionVendors } from '../src/api/queries.js';
import { tmpRoot } from './fixtures.js';

test('session range filters usage totals, rows, counts and vendor options together', () => {
  const db = openDb(join(tmpRoot(), 'sessions-range.db'));
  const sourceId = upsertSource(db, { harness: 'codex', profile: 'default', rootPath: '/tmp/codex', displayName: 'Codex' });
  const addSession = db.prepare(`INSERT INTO session
    (source_id, native_session_id, project, model_default, started_at, last_seen_at)
    VALUES (?, ?, ?, ?, ?, ?)`);
  const first = Number(addSession.run(sourceId, 'first', 'one', 'gpt-5', 900, 1900).lastInsertRowid);
  const second = Number(addSession.run(sourceId, 'second', 'two', 'claude-opus', 900, 2900).lastInsertRowid);
  const addEvent = db.prepare(`INSERT INTO usage_event
    (source_id, session_id, dedup_key, ts, model, provider, total_tokens, cost_usd, cost_source)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'known')`);
  addEvent.run(sourceId, first, 'first-old', 1000, 'gpt-5', 'openai', 10, 1);
  addEvent.run(sourceId, first, 'first-in-range', 1500, 'gpt-5', 'openai', 20, 2);
  addEvent.run(sourceId, second, 'second', 2500, 'claude-opus', 'anthropic', 40, 4);

  const all = sessionList(db, { limit: 50, offset: 0 });
  assert.equal(all.length, 2);
  const ranged = sessionList(db, { limit: 50, offset: 0, from: 1200, to: 2000 });
  assert.equal(ranged.length, 1);
  assert.equal(ranged[0]!.id, first);
  assert.equal(ranged[0]!.calls, 1);
  assert.equal(ranged[0]!.total_tokens, 20);
  assert.equal(sessionCount(db, { from: 1200, to: 2000 }), 1);
  assert.deepEqual(sessionVendors(db, { from: 1200, to: 2000 }), [{ vendor: 'openai', sessions: 1 }]);
  db.close();
});
