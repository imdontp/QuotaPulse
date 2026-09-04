import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';

import { openDb, type DB } from '../src/db/index.js';
import { resolveSources, runPass } from '../src/ingest/runner.js';
import { sourceStatus, listSources, health } from '../src/api/queries.js';
import { ADAPTER_TARGET, type Adapter, type Profile } from '../src/adapters/types.js';
import { tmpRoot } from './fixtures.js';

/** An adapter that reports exactly the profiles it is told to, so detection is scriptable. */
function fakeAdapter(id: string, profiles: () => Profile[]): Adapter {
  return {
    id,
    displayName: id,
    async detect() {
      return profiles();
    },
    watchTargets() {
      return [];
    },
    async ingest() {
      /* these tests are about the source table, not about reading anything */
    },
  } as unknown as Adapter;
}

function db(): DB {
  return openDb(join(tmpRoot(), 'usage.db'));
}

const profile = (name: string): Profile => ({
  profile: name,
  rootPath: `/fake/${name}`,
  displayName: `Fake (${name})`,
});

test('a source that disappears stops being ingested', async () => {
  const d = db();
  let live = [profile('a'), profile('b')];
  const adapter = fakeAdapter('fake', () => live);

  await resolveSources(d, [adapter]);
  assert.deepEqual(
    listSources(d).map((s) => s.profile).sort(),
    ['a', 'b'],
  );

  live = [profile('a')];
  await resolveSources(d, [adapter]);
  assert.deepEqual(
    listSources(d).map((s) => s.profile),
    ['a'],
    'b was uninstalled, so no pass should keep reading it',
  );
});

test('a source that comes back is picked up again without a restart', async () => {
  const d = db();
  let live = [profile('a')];
  const adapter = fakeAdapter('fake', () => live);

  await resolveSources(d, [adapter]);
  live = [];
  await resolveSources(d, [adapter]);
  assert.equal(listSources(d).length, 0);

  live = [profile('a')];
  await resolveSources(d, [adapter]);
  assert.deepEqual(
    listSources(d).map((s) => s.profile),
    ['a'],
    'detecting a source again must re-enable it, not leave it disabled forever',
  );
});

/**
 * The Live page asks for this list. A harness that is gone but whose tokens are still
 * inside every total on Trend and Cost has to stay visible there, or those totals look
 * like they came from nowhere. One that recorded nothing has nothing to say.
 */
test('a departed source keeps its card only if it recorded something', async () => {
  const d = db();
  let live = [profile('used'), profile('never')];
  const adapter = fakeAdapter('fake', () => live);
  const ids = await resolveSources(d, [adapter]);

  const usedId = ids.find((s) => s.profile.profile === 'used')!.sourceId;
  d.prepare(
    `INSERT INTO usage_event (source_id, ts, dedup_key, model, total_tokens)
     VALUES (?, ?, 'k1', 'some-model', 100)`,
  ).run(usedId, Date.now());

  live = [];
  await resolveSources(d, [adapter]);

  const shown = sourceStatus(d).map((s) => s.profile);
  assert.deepEqual(shown, ['used']);
  assert.equal(sourceStatus(d)[0]!.total_tokens, 100, 'its history must survive being uninstalled');
});

/*
 * The Health page reported "no read errors" on a machine where nothing had ever recorded
 * one, because `recordError` had no call sites at all -- the number meant "we never
 * looked", not "nothing failed". These pin both halves: a failure is written, and it goes
 * away by itself once the read succeeds.
 */
function throwingAdapter(id: string, fail: () => boolean, profiles?: () => Profile[]): Adapter {
  return {
    id,
    displayName: id,
    async detect() {
      return profiles ? profiles() : [{ profile: 'default', rootPath: '/fake/' + id, displayName: id }];
    },
    watchTargets() {
      return [];
    },
    async ingest() {
      if (fail()) throw new Error('disk on fire');
    },
  } as unknown as Adapter;
}

test('an adapter failure is recorded where the Health page can see it', async () => {
  const d = db();
  let broken = true;
  let live: Profile[] = [{ profile: 'default', rootPath: '/fake/fake', displayName: 'fake' }];
  const adapter = throwingAdapter('fake', () => broken, () => live);
  const sources = await resolveSources(d, [adapter]);

  await runPass(d, sources);
  const failing = health(d).errors as Array<{ target_key: string; error_count: number; last_error: string }>;
  assert.equal(failing.length, 1, 'the failure must reach the health query, not just the log');
  assert.equal(failing[0]!.target_key, ADAPTER_TARGET);
  assert.equal(failing[0]!.last_error, 'disk on fire');
  assert.equal(failing[0]!.error_count, 1);

  // Still broken on the next pass: the count is the rate, so it keeps climbing even
  // though the log line is deduplicated.
  await runPass(d, sources);
  assert.equal(
    (health(d).errors as Array<{ error_count: number }>)[0]!.error_count,
    2,
    'every occurrence counts, even when the log stays quiet',
  );

  broken = false;
  await runPass(d, sources);
  assert.deepEqual(health(d).errors, [], 'a recovered source must not stay on the error list');

  const rows = health(d).sources as Array<Record<string, number>>;
  assert.equal(
    Number(rows[0]!.targets),
    0,
    'the row that only carried the error must be gone, not left inflating the target count',
  );

  // A source uninstalled while failing must leave with its error: the adapters table
  // drops it, and an error about something no longer being read is noise on a page whose
  // whole job is telling you whether what IS being read is working.
  broken = true;
  await runPass(d, sources);
  assert.equal((health(d).errors as unknown[]).length, 1);
  live = [];
  await resolveSources(d, [adapter]);
  assert.deepEqual(health(d).errors, [], 'a departed source must not keep reporting errors');
});
