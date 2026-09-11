import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';

import { openDb, upsertSource, type DB } from '../src/db/index.js';
import { resolveSources, runPass } from '../src/ingest/runner.js';
import {
  ACCOUNT_QUOTA_FRESHNESS_MS,
  accountStatus,
  health,
  harnessStatus,
  latestLimits,
  listSources,
  sourceStatus,
  subscriptionStatus,
} from '../src/api/queries.js';
import { ADAPTER_TARGET, type Adapter, type Profile } from '../src/adapters/types.js';
import { tmpRoot } from './fixtures.js';
import { DbSink } from '../src/ingest/sink.js';
import { PriceResolver } from '../src/pricing/resolve.js';

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

test('Codex and an account reader share one quota card while harness cards stay separate', async () => {
  const d = db();
  const codex: Profile = {
    profile: 'default',
    rootPath: '/fake/codex',
    displayName: 'Codex CLI',
    account: { key: 'openai:subscription', provider: 'openai', displayName: 'OpenAI Subscription' },
  };
  const reader: Profile = {
    profile: 'default',
    rootPath: '/fake/hermes',
    displayName: 'OpenAI Subscription',
    sourceKind: 'account',
    account: { key: 'openai:subscription', provider: 'openai', displayName: 'OpenAI Subscription' },
  };
  const resolved = await resolveSources(d, [
    fakeAdapter('codex', () => [codex]),
    fakeAdapter('openai-account', () => [reader]),
  ]);
  const codexSource = resolved.find((source) => source.adapter.id === 'codex')!;
  const readerSource = resolved.find((source) => source.adapter.id === 'openai-account')!;

  const sink = new DbSink(d, readerSource.sourceId, new PriceResolver(d));
  sink.limit({
    windowKind: '5h',
    usedPercent: 42,
    resetsAt: Date.now() + 3_600_000,
    observedAt: Date.now(),
    origin: 'test-reader',
  });

  const accounts = accountStatus(d);
  assert.equal(accounts.length, 1);
  assert.equal(accounts[0]!.display_name, 'OpenAI Subscription');
  assert.equal(accounts[0]!.state, 'active');
  assert.deepEqual(
    accounts[0]!.owners.map((owner) => owner.harness).sort(),
    ['codex'],
  );
  assert.deepEqual(sourceStatus(d).map((source) => source.source_id), [codexSource.sourceId]);
});

test('stale quota does not keep a subscription active, and fresh quota reactivates it', () => {
  const d = db();
  const account = {
    key: 'anthropic:claude:personal',
    provider: 'anthropic',
    displayName: 'Claude Personal Subscription',
  };
  const sourceId = upsertSource(d, {
    harness: 'claude-code',
    profile: 'default',
    rootPath: '/fake/claude-personal',
    displayName: 'Claude Code Personal',
    account,
  });
  const sink = new DbSink(d, sourceId, new PriceResolver(d));
  const staleAt = Date.now() - ACCOUNT_QUOTA_FRESHNESS_MS - 1_000;

  sink.limit({
    windowKind: '5h',
    usedPercent: 5,
    resetsAt: staleAt + 3_600_000,
    observedAt: staleAt,
    sourceFetchedAt: staleAt,
    origin: 'statusline-snapshot',
  });
  assert.equal(accountStatus(d)[0]!.state, 'stale');
  assert.equal(
    subscriptionStatus(d).find((entry) => entry.subscription_key === account.key)?.state,
    'stale',
  );

  sink.limit({
    windowKind: '5h',
    usedPercent: 6,
    resetsAt: Date.now() + 3_600_000,
    observedAt: Date.now(),
    sourceFetchedAt: Date.now(),
    origin: 'statusline-snapshot',
  });
  assert.equal(accountStatus(d)[0]!.state, 'active');
  assert.equal(
    subscriptionStatus(d).find((entry) => entry.subscription_key === account.key)?.state,
    'active',
  );
  d.close();
});

test('dashboard separates subscriptions from harnesses and nests Hermes delegates', () => {
  const d = db();
  upsertSource(d, {
    harness: 'codex',
    profile: 'default',
    rootPath: '/fake/codex',
    displayName: 'Codex CLI',
    account: { key: 'openai:subscription', provider: 'openai', displayName: 'OpenAI Subscription' },
  });
  upsertSource(d, {
    harness: 'claude-code',
    profile: 'company',
    rootPath: '/fake/claude-company',
    displayName: 'Claude Code Company',
    account: {
      key: 'anthropic:claude:company',
      provider: 'anthropic',
      displayName: 'Claude Company Subscription',
    },
  });
  upsertSource(d, {
    harness: 'hermes',
    profile: 'default',
    rootPath: '/fake/hermes/state.db',
    displayName: 'Hermes Agent',
  });
  upsertSource(d, {
    harness: 'openai-account',
    profile: 'default',
    rootPath: '/fake/hermes',
    displayName: 'OpenAI Subscription',
    sourceKind: 'account',
    account: { key: 'openai:subscription', provider: 'openai', displayName: 'OpenAI Subscription' },
  });

  const subscriptions = subscriptionStatus(d);
  assert.deepEqual(
    subscriptions.map((subscription) => subscription.subscription_key),
    ['openai:subscription', 'anthropic:claude:company', 'anthropic:claude:personal'],
    'known subscriptions remain one card each; optional OpenCode Go is not fabricated',
  );
  assert.equal(
    subscriptions.find((subscription) => subscription.subscription_key === 'anthropic:claude:personal')?.state,
    'inactive',
  );
  assert.equal(
    subscriptions.find((subscription) => subscription.subscription_key === 'openai:subscription')?.linked_harness_keys.includes(
      'hermes-delegate-codex-cli',
    ),
    true,
  );

  const harnesses = harnessStatus(d);
  const hermes = harnesses.find((harness) => harness.harness_key === 'hermes-agent')!;
  assert.deepEqual(hermes.delegate_keys, [
    'hermes-delegate-codex-cli',
    'hermes-delegate-claude-code-company',
    'hermes-delegate-claude-code-personal',
  ]);
  assert.equal(
    harnesses.find((harness) => harness.harness_key === 'hermes-delegate-codex-cli')?.parent_harness_key,
    'hermes-agent',
  );
  assert.equal(
    harnesses.some((harness) => harness.harness_key === 'source:4'),
    false,
    'the account reader must not become a Harness card',
  );

  upsertSource(d, {
    harness: 'opencode',
    profile: 'default',
    rootPath: '/fake/opencode',
    displayName: 'OpenCode',
    account: { key: 'opencode:go', provider: 'opencode', displayName: 'OpenCode Go Subscription' },
  });
  assert.equal(
    subscriptionStatus(d).some((subscription) => subscription.subscription_key === 'opencode:go'),
    false,
    'an OpenCode harness/API key alone does not prove a Go entitlement',
  );

  const readerId = upsertSource(d, {
    harness: 'opencode-account',
    profile: 'default',
    rootPath: '/fake/opencode/auth.json',
    displayName: 'OpenCode Go Subscription',
    sourceKind: 'account',
    account: { key: 'opencode:go', provider: 'opencode', displayName: 'OpenCode Go Subscription' },
  });
  const readerSink = new DbSink(d, readerId, new PriceResolver(d));
  const observedAt = Date.now();
  for (const [windowKind, usedPercent] of [
    ['5h', 12.9],
    ['weekly', 38.4],
    ['monthly', 81],
  ] as const) {
    readerSink.limit({
      windowKind,
      usedPercent,
      resetsAt: observedAt + 3_600_000,
      observedAt,
      sourceFetchedAt: observedAt,
      origin: 'opencode-go-usage',
    });
  }
  assert.equal(
    subscriptionStatus(d).some((subscription) => subscription.subscription_key === 'opencode:go'),
    true,
    'OpenCode Go appears after the account reader receives quota data',
  );
  assert.equal(
    subscriptionStatus(d).find((subscription) => subscription.subscription_key === 'opencode:go')?.state,
    'active',
  );
  assert.equal(
    (d.prepare(`SELECT COUNT(*) AS n FROM limit_sample WHERE source_id = ?`).get(readerId) as { n: number }).n,
    3,
  );
  assert.equal(latestLimits(d).filter((row) => row.account_key === 'opencode:go').length, 3);

  readerSink.accountState({ state: 'unavailable', reason: 'invalid-credential', observedAt: Date.now() });
  assert.equal(
    subscriptionStatus(d).find((subscription) => subscription.subscription_key === 'opencode:go')?.state,
    'unavailable',
    'a previously confirmed entitlement remains visible when the next credential read fails',
  );
  assert.equal(latestLimits(d).filter((row) => row.account_key === 'opencode:go').length, 3);

  readerSink.accountState({ state: 'inactive', reason: 'no-subscription', observedAt: Date.now() });
  assert.equal(
    subscriptionStatus(d).some((subscription) => subscription.subscription_key === 'opencode:go'),
    false,
    'an explicit no-subscription response hides the optional card and its cached limits',
  );
  assert.equal(latestLimits(d).some((row) => row.account_key === 'opencode:go'), false);
  d.close();
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
