import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { appendFileSync, writeFileSync } from 'node:fs';

import { openDb, upsertSource, type DB } from '../src/db/index.js';
import { DbCursorStore } from '../src/ingest/cursor.js';
import { DbSink } from '../src/ingest/sink.js';
import { PriceResolver } from '../src/pricing/resolve.js';
import { claudeCodeAdapter } from '../src/adapters/claude-code.js';
import { codexAdapter } from '../src/adapters/codex.js';
import type { Adapter, Profile } from '../src/adapters/types.js';
import { readJsonlDelta } from '../src/ingest/jsonl.js';
import { tmpRoot, writeClaudeProfile, writeCodexProfile, jsonl } from './fixtures.js';

async function ingestOnce(db: DB, adapter: Adapter, profile: Profile, sourceId: number) {
  const sink = new DbSink(db, sourceId, new PriceResolver(db));
  await adapter.ingest({
    profile,
    sourceId,
    cursors: new DbCursorStore(db, sourceId),
    sink,
    backfill: true,
  });
  return sink.stats;
}

const countEvents = (db: DB, sourceId: number) =>
  (db.prepare('SELECT COUNT(*) c FROM usage_event WHERE source_id = ?').get(sourceId) as { c: number }).c;

const sum = (db: DB, sourceId: number, col: string) =>
  Number(
    (db.prepare(`SELECT COALESCE(SUM(${col}),0) v FROM usage_event WHERE source_id = ?`).get(sourceId) as {
      v: number;
    }).v,
  );

/* ------------------------------------------------------------------ Claude */

test('claude: one API response written as three rows counts once', async () => {
  const dir = tmpRoot();
  const db = openDb(join(dir, 'claude.db'));
  const root = join(dir, '.claude');
  writeClaudeProfile(root);
  const profile: Profile = { profile: 'test', rootPath: root, displayName: 'test' };
  const sourceId = upsertSource(db, { harness: 'claude-code', profile: 'test', rootPath: root, displayName: 'test' });

  await ingestOnce(db, claudeCodeAdapter, profile, sourceId);

  // Fixture holds 4 assistant rows but only 2 distinct message ids.
  assert.equal(countEvents(db, sourceId), 2, 'must collapse to one row per message.id');
  assert.equal(sum(db, sourceId, 'output_tokens'), 750, '500 + 250, not 500*3 + 250');
  db.close();
});

test('claude: token fields map straight across (already disjoint)', async () => {
  const dir = tmpRoot();
  const db = openDb(join(dir, 'claude2.db'));
  const root = join(dir, '.claude');
  writeClaudeProfile(root);
  const profile: Profile = { profile: 't', rootPath: root, displayName: 't' };
  const sourceId = upsertSource(db, { harness: 'claude-code', profile: 't', rootPath: root, displayName: 't' });
  await ingestOnce(db, claudeCodeAdapter, profile, sourceId);

  const row = db
    .prepare(`SELECT * FROM usage_event WHERE native_msg_id = 'msg_1'`)
    .get() as Record<string, number>;
  assert.equal(row.input_tokens, 12);
  assert.equal(row.cached_input_tokens, 40_000);
  assert.equal(row.cache_write_tokens, 900);
  assert.equal(row.output_tokens, 500);
  assert.equal(row.reasoning_tokens, 120, 'thinking tokens are a SUBSET of output');
  // total excludes reasoning, which is already inside output
  assert.equal(row.total_tokens, 12 + 40_000 + 900 + 500);
  db.close();
});

test('claude: cost-state lands on the session as the native figure', async () => {
  const dir = tmpRoot();
  const db = openDb(join(dir, 'claude3.db'));
  const root = join(dir, '.claude');
  writeClaudeProfile(root);
  const sourceId = upsertSource(db, { harness: 'claude-code', profile: 't', rootPath: root, displayName: 't' });
  await ingestOnce(db, claudeCodeAdapter, { profile: 't', rootPath: root, displayName: 't' }, sourceId);

  const s = db.prepare(`SELECT * FROM session WHERE native_session_id = 'sess-1'`).get() as Record<string, number>;
  assert.equal(s.native_cost_usd, 1.2345);
  assert.equal(s.native_lines_added, 10);
  db.close();
});

/* ------------------------------------------------------------------- Codex */

test('codex: cache reads are removed from input, both schema generations', async () => {
  const dir = tmpRoot();
  const db = openDb(join(dir, 'codex.db'));
  const root = join(dir, '.codex');
  writeCodexProfile(root);
  const sourceId = upsertSource(db, { harness: 'codex', profile: 't', rootPath: root, displayName: 't' });
  await ingestOnce(db, codexAdapter, { profile: 't', rootPath: root, displayName: 't' }, sourceId);

  // Two usage rows: the `info: null` quota-only event must not create one.
  assert.equal(countEvents(db, sourceId), 2);

  // Codex folds cache into input; our convention keeps them disjoint.
  assert.equal(sum(db, sourceId, 'input_tokens'), 10_000 - 9_000 + (2_000 - 1_500));
  assert.equal(sum(db, sourceId, 'cached_input_tokens'), 9_000 + 1_500);
  // Older generation lacks cache_write_input_tokens entirely -> 0, not NaN.
  assert.equal(sum(db, sourceId, 'cache_write_tokens'), 100);
  assert.equal(sum(db, sourceId, 'output_tokens'), 500);
  assert.equal(sum(db, sourceId, 'reasoning_tokens'), 190);

  const models = db.prepare(`SELECT DISTINCT model, effort FROM usage_event`).all();
  assert.deepEqual(models, [{ model: 'gpt-5.6-luna', effort: 'max' }], 'model/effort come from turn_context');
  db.close();
});

/*
 * The regression that shipped: `model` and `effort` were per-pass variables set only
 * when a delta happened to contain the `turn_context` line naming them. Ingestion reads
 * only newly-appended bytes, so once the cursor moved past that line every later call
 * was stored with model NULL -- and a null model fails pricing before it starts, which
 * is how 59 real calls came to be worth $0. Two passes is the smallest reproduction.
 */
test('codex: a pass that appends only usage still knows the model from an earlier one', async () => {
  const dir = tmpRoot();
  const db = openDb(join(dir, 'codex3.db'));
  const root = join(dir, '.codex');
  const file = writeCodexProfile(root);
  const profile: Profile = { profile: 't', rootPath: root, displayName: 't' };
  const sourceId = upsertSource(db, { harness: 'codex', profile: 't', rootPath: root, displayName: 't' });

  // Pass 1 reads the whole file, turn_context included.
  await ingestOnce(db, codexAdapter, profile, sourceId);
  const firstPass = countEvents(db, sourceId);
  assert.ok(firstPass > 0, 'the fixture must produce usage on the first pass');

  // A later turn: usage only, exactly what a live tail delivers between turn_contexts.
  appendFileSync(
    file,
    jsonl([
      {
        timestamp: '2026-09-01T09:05:00.000Z',
        ordinal: 99,
        type: 'event_msg',
        payload: {
          type: 'token_count',
          info: {
            total_token_usage: { input_tokens: 1, output_tokens: 1, total_tokens: 2 },
            last_token_usage: { input_tokens: 3_000, cached_input_tokens: 1_000, output_tokens: 400 },
            model_context_window: 258_400,
          },
          rate_limits: null,
        },
      },
    ]),
    'utf8',
  );

  // Pass 2 starts from the persisted cursor and never sees turn_context.
  await ingestOnce(db, codexAdapter, profile, sourceId);
  assert.equal(countEvents(db, sourceId), firstPass + 1, 'the appended call must be ingested');

  const modelless = db
    .prepare(`SELECT COUNT(*) c FROM usage_event WHERE source_id = ? AND model IS NULL`)
    .get(sourceId) as { c: number };
  assert.equal(modelless.c, 0, 'no event may be stored without a model');

  const added = db
    .prepare(`SELECT model, effort FROM usage_event WHERE source_id = ? ORDER BY id DESC LIMIT 1`)
    .get(sourceId) as { model: string | null; effort: string | null };
  assert.deepEqual(
    added,
    { model: 'gpt-5.6-luna', effort: 'max' },
    'model and effort must carry over from the pass that read turn_context',
  );
  db.close();
});

test('codex: quota is recorded even from an event with no usage, and a missing secondary is tolerated', async () => {
  const dir = tmpRoot();
  const db = openDb(join(dir, 'codex2.db'));
  const root = join(dir, '.codex');
  writeCodexProfile(root);
  const sourceId = upsertSource(db, { harness: 'codex', profile: 't', rootPath: root, displayName: 't' });
  await ingestOnce(db, codexAdapter, { profile: 't', rootPath: root, displayName: 't' }, sourceId);

  const five = db
    .prepare(`SELECT used_percent, resets_at FROM limit_sample WHERE window_kind='5h' ORDER BY observed_at`)
    .all() as Array<{ used_percent: number; resets_at: number }>;
  assert.deepEqual(five.map((r) => r.used_percent), [12.5, 13, 14]);
  // resets_at arrives as epoch SECONDS and must be stored as millis.
  assert.equal(five[0]!.resets_at, 1_788_335_173 * 1000);

  const weekly = db.prepare(`SELECT COUNT(*) c FROM limit_sample WHERE window_kind='weekly'`).get() as { c: number };
  assert.equal(weekly.c, 1, 'only the one event that carried a secondary window');
  db.close();
});

/* ------------------------------------------------------- Idempotency + tail */

test('re-ingesting changes nothing (idempotent), and appended lines are picked up', async () => {
  const dir = tmpRoot();
  const db = openDb(join(dir, 'idem.db'));
  const root = join(dir, '.claude');
  const file = writeClaudeProfile(root);
  const profile: Profile = { profile: 't', rootPath: root, displayName: 't' };
  const sourceId = upsertSource(db, { harness: 'claude-code', profile: 't', rootPath: root, displayName: 't' });

  const first = await ingestOnce(db, claudeCodeAdapter, profile, sourceId);
  const afterFirst = countEvents(db, sourceId);
  const tokensFirst = sum(db, sourceId, 'total_tokens');
  assert.equal(first.usageInserted, 2);

  const second = await ingestOnce(db, claudeCodeAdapter, profile, sourceId);
  assert.equal(second.usageInserted, 0, 'second pass must insert nothing');
  assert.equal(countEvents(db, sourceId), afterFirst);
  assert.equal(sum(db, sourceId, 'total_tokens'), tokensFirst, 'totals must not drift');

  // A live session appends; only the delta should be read.
  appendFileSync(
    file,
    jsonl([
      {
        type: 'assistant',
        sessionId: 'sess-1',
        uuid: 'u9',
        apiBlockIndex: 0,
        timestamp: '2026-09-01T11:00:00.000Z',
        requestId: 'req_ccc',
        message: { id: 'msg_3', model: 'claude-opus-5', usage: { input_tokens: 1, output_tokens: 7 } },
      },
    ]),
    'utf8',
  );
  const third = await ingestOnce(db, claudeCodeAdapter, profile, sourceId);
  assert.equal(third.usageInserted, 1, 'exactly the appended call');
  assert.equal(countEvents(db, sourceId), afterFirst + 1);
  db.close();
});

/* ------------------------------------------------------------ jsonl reader */

test('jsonl reader leaves a partial trailing line unconsumed', async () => {
  const dir = tmpRoot();
  const file = join(dir, 'partial.jsonl');
  writeFileSync(file, '{"a":1}\n{"a":2}\n{"a":3', 'utf8'); // last line still being written

  const seen: unknown[] = [];
  const res = await readJsonlDelta(file, 0, (r) => seen.push(r));
  assert.equal(seen.length, 2, 'only the two complete lines');
  assert.equal(res.nextOffset, 16, 'offset stops before the partial line');

  // Now the writer finishes the line.
  appendFileSync(file, '}\n', 'utf8');
  const seen2: unknown[] = [];
  const res2 = await readJsonlDelta(file, res.nextOffset, (r) => seen2.push(r));
  assert.deepEqual(seen2, [{ a: 3 }], 'the completed line is read exactly once');
  assert.equal(res2.nextOffset, 24);
});

test('jsonl reader restarts when a file is truncated', async () => {
  const dir = tmpRoot();
  const file = join(dir, 'trunc.jsonl');
  writeFileSync(file, '{"a":1}\n{"a":2}\n', 'utf8');
  const first = await readJsonlDelta(file, 0, () => {});
  assert.equal(first.restarted, false);

  writeFileSync(file, '{"b":1}\n', 'utf8'); // replaced, now shorter
  const seen: unknown[] = [];
  const second = await readJsonlDelta(file, first.nextOffset, (r) => seen.push(r));
  assert.equal(second.restarted, true, 'a shrunk file invalidates the old offset');
  assert.deepEqual(seen, [{ b: 1 }]);
});

test('jsonl reader survives a corrupt line without losing the rest', async () => {
  const dir = tmpRoot();
  const file = join(dir, 'corrupt.jsonl');
  writeFileSync(file, '{"a":1}\n{not json\n{"a":3}\n', 'utf8');
  const seen: unknown[] = [];
  const res = await readJsonlDelta(file, 0, (r) => seen.push(r));
  assert.deepEqual(seen, [{ a: 1 }, { a: 3 }]);
  assert.equal(res.parseErrors, 1);
});
