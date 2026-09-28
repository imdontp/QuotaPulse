import type { AccountState, SourceStatus } from '@/api';

/**
 * Grouping for the Sources page.
 *
 * The page used to render one row per database source, which is not what a person thinks
 * they are looking at. One account is normally read by several harness profiles, so a
 * single OpenAI account appeared three times under the same name with nothing to tell the
 * rows apart -- sixteen rows for five accounts on a real install. Grouping by `account_key`
 * puts the account back at the top and the readers underneath it.
 *
 * Sources with no account binding are kept apart rather than merged in. They are not a
 * broken account, they are a harness that has never been bound to one, and folding them in
 * would invent a grouping the data does not support.
 */

export interface SourceAccount {
  /** `account_key`, or a synthetic `unbound:` key for harness-only sources. */
  key: string;
  /** True when this is a real account rather than an unbound harness. */
  bound: boolean;
  name: string;
  vendor: string;
  /** Worst state among the members, so a dead reader cannot hide behind a live one. */
  state: AccountState;
  /** The harness profiles reading this account, busiest first. */
  members: SourceStatus[];
  calls: number;
  totalTokens: number;
  limitSamples: number;
  lastEventTs: number | null;
}

/** Most severe first. A group takes its worst member's state. */
const STATE_RANK: Record<AccountState, number> = {
  unavailable: 0,
  waiting: 1,
  inactive: 2,
  stale: 3,
  active: 4,
};

function worse(a: AccountState, b: AccountState): AccountState {
  return STATE_RANK[a] <= STATE_RANK[b] ? a : b;
}

/**
 * The name to show for an account, from its members.
 *
 * Harness profiles often share a display name, so any of them is usually right. Where they
 * disagree the one carrying the most usage wins, since that is the name the user's own
 * numbers are attached to.
 */
function nameFor(members: SourceStatus[]): string {
  return [...members].sort((a, b) => b.calls - a.calls)[0]?.display_name ?? '';
}

function build(key: string, bound: boolean, members: SourceStatus[]): SourceAccount {
  const sorted = [...members].sort((a, b) => b.calls - a.calls);
  return {
    key,
    bound,
    name: nameFor(sorted),
    vendor: sorted[0]?.vendor ?? 'unknown',
    state: sorted.map((m) => m.account_state).reduce(worse, 'active'),
    members: sorted,
    calls: sorted.reduce((sum, m) => sum + m.calls, 0),
    totalTokens: sorted.reduce((sum, m) => sum + m.total_tokens, 0),
    limitSamples: sorted.reduce((sum, m) => sum + m.limit_samples, 0),
    lastEventTs: sorted.reduce<number | null>(
      (latest, m) => (m.last_event_ts == null ? latest : Math.max(latest ?? 0, m.last_event_ts)),
      null,
    ),
  };
}

export interface GroupedSources {
  /** Accounts with a real binding, busiest first. */
  accounts: SourceAccount[];
  /** Harness profiles that have never been bound to an account. */
  unbound: SourceAccount[];
}

export function groupSources(sources: readonly SourceStatus[]): GroupedSources {
  const byKey = new Map<string, SourceStatus[]>();
  for (const source of sources) {
    // Sources with no account_key share one bucket, so they stay in a single section
    // rather than each inventing a group of one.
    const key = source.account_key ?? `unbound:${source.harness}`;
    const bucket = byKey.get(key);
    if (bucket) bucket.push(source);
    else byKey.set(key, [source]);
  }

  const accounts: SourceAccount[] = [];
  const unbound: SourceAccount[] = [];
  for (const [key, members] of byKey) {
    const bound = members[0]?.account_key != null;
    (bound ? accounts : unbound).push(build(key, bound, members));
  }

  // Busiest first, so the account the user is actually working in leads. Name breaks ties
  // because two idle accounts with no calls would otherwise sort arbitrarily between runs.
  const byUse = (a: SourceAccount, b: SourceAccount) =>
    b.calls - a.calls || b.limitSamples - a.limitSamples || a.name.localeCompare(b.name);
  accounts.sort(byUse);
  unbound.sort(byUse);
  return { accounts, unbound };
}
