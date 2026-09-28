import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { AccountState, SourceStatus } from '../src/api';
import { groupSources } from '../src/lib/sources';

const now = 1_800_000_000_000;

const source = (patch: Partial<SourceStatus> = {}): SourceStatus => ({
  source_id: 1, harness: 'codex', profile: 'default', display_name: 'OpenAI Subscription',
  root_path: 'C:/codex', vendor: 'openai', account_state: 'active', enabled: true, account_key: 'openai:subscription',
  calls: 100, total_tokens: 1000, last_event_ts: now - 1000, last_limit_at: now, last_limit_source_fetched_at: now,
  last_limit_reset_at: now, limit_origins: 'claude.json', limit_samples: 5,
  telemetry: {
    freshness: 'live', latest_quota_at: now, latest_source_fetched_at: now, latest_usage_at: now,
    gap: false, reason: null, origins: ['claude.json'], windows: [],
  },
  ...patch,
});

test('one account read by several profiles is one row, not several identical ones', () => {
  // The real case: three sources, same account_key, same display name, nothing to tell the
  // rows apart. Sixteen sources for five accounts on a real install.
  const grouped = groupSources([
    source({ source_id: 1, harness: 'codex', profile: 'default', calls: 900 }),
    source({ source_id: 2, harness: 'claude-code', profile: 'company', calls: 400 }),
    source({ source_id: 3, harness: 'hermes', profile: 'claudecompany', calls: 10 }),
  ]);
  assert.equal(grouped.accounts.length, 1);
  const account = grouped.accounts[0]!;
  assert.equal(account.key, 'openai:subscription');
  assert.equal(account.bound, true);
  assert.equal(account.members.length, 3);
  // Busiest reader first, and the usage is summed rather than lost.
  assert.deepEqual(account.members.map((m) => m.source_id), [1, 2, 3]);
  assert.equal(account.calls, 1310);
  assert.equal(account.totalTokens, 3000);
  assert.equal(account.limitSamples, 15);
  assert.equal(account.lastEventTs, now - 1000);
});

test('the group takes its worst reader state, so a dead one cannot hide behind a live one', () => {
  const states: AccountState[] = ['active', 'waiting', 'unavailable', 'inactive', 'stale', 'active'];
  const grouped = groupSources(
    states.map((account_state, i) => source({ source_id: i + 1, account_state })),
  );
  assert.equal(grouped.accounts[0]!.state, 'unavailable');

  const allLive = groupSources([
    source({ source_id: 1, account_state: 'active' }),
    source({ source_id: 2, account_state: 'stale' }),
  ]);
  assert.equal(allLive.accounts[0]!.state, 'stale', 'stale is worse than active');
});

test('harnesses with no account binding are kept apart, never merged into an account', () => {
  const grouped = groupSources([
    source({ source_id: 1, account_key: 'openai:subscription' }),
    source({ source_id: 2, harness: 'hermes', profile: 'default', display_name: 'Hermes Agent', account_key: null, account_state: 'waiting' }),
    source({ source_id: 3, harness: 'opencode', profile: 'default', display_name: 'OpenCode', account_key: null, account_state: 'waiting' }),
  ]);
  assert.equal(grouped.accounts.length, 1, 'the one bound account');
  assert.equal(grouped.unbound.length, 2, 'the two unbound harnesses stay separate');
  for (const group of grouped.unbound) {
    assert.equal(group.bound, false);
    assert.equal(group.members.length, 1);
  }
  // Unbound harnesses of the same name would still share a bucket, so a fresh install does
  // not produce one group per profile.
  const same = groupSources([
    source({ source_id: 1, harness: 'hermes', profile: 'a', account_key: null }),
    source({ source_id: 2, harness: 'hermes', profile: 'b', account_key: null }),
  ]);
  assert.equal(same.unbound.length, 1);
  assert.equal(same.unbound[0]!.members.length, 2);
});

test('accounts lead by use, and ties break on something stable rather than arbitrarily', () => {
  const grouped = groupSources([
    source({ source_id: 1, account_key: 'a', display_name: 'Alpha', calls: 10 }),
    source({ source_id: 2, account_key: 'b', display_name: 'Beta', calls: 900 }),
    source({ source_id: 3, account_key: 'c', display_name: 'Gamma', calls: 10 }),
  ]);
  assert.deepEqual(grouped.accounts.map((a) => a.name), ['Beta', 'Alpha', 'Gamma']);
  // Usage leads; quota samples only break a tie. An account that has actually been used
  // should not be displaced by a quieter one just because it reported more quota, so this
  // is calls first and samples second -- and the comment on the sort says so too.
  const byUse = groupSources([
    source({ source_id: 1, account_key: 'a', display_name: 'Alpha', calls: 500, limit_samples: 0 }),
    source({ source_id: 2, account_key: 'b', display_name: 'Beta', calls: 100, limit_samples: 900 }),
  ]);
  assert.deepEqual(byUse.accounts.map((a) => a.name), ['Alpha', 'Beta']);
  // Samples decide when usage cannot.
  const tied = groupSources([
    source({ source_id: 1, account_key: 'a', display_name: 'Alpha', calls: 100, limit_samples: 0 }),
    source({ source_id: 2, account_key: 'b', display_name: 'Beta', calls: 100, limit_samples: 900 }),
  ]);
  assert.deepEqual(tied.accounts.map((a) => a.name), ['Beta', 'Alpha']);
});

test('an account takes the name of its busiest reader', () => {
  const grouped = groupSources([
    source({ source_id: 1, account_key: 'k', display_name: 'Quiet name', calls: 1 }),
    source({ source_id: 2, account_key: 'k', display_name: 'Busy name', calls: 500 }),
  ]);
  assert.equal(grouped.accounts[0]!.name, 'Busy name');
});

test('nothing to group is not an error', () => {
  assert.deepEqual(groupSources([]), { accounts: [], unbound: [] });
  const one = groupSources([source()]);
  assert.equal(one.accounts.length, 1);
  assert.equal(one.unbound.length, 0);
});
