import { GitBranch, Radio, TriangleAlert, Unlink } from 'lucide-react';
import type { AccountState, Overview, SourceStatus } from '@/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Empty } from '@/components/primitives';
import { HarnessIcon } from '@/components/harness-icon';
import { age } from '@/format';
import { groupSources, type SourceAccount } from '@/lib/sources';
import { useFormat } from '@/i18n/format';
import { useT, type MessageKey } from '@/i18n';

/**
 * What state a source's quota feed is in.
 *
 * This is a state, not an age: `FreshnessBadge` answers "how old is this reading", which is
 * a different question, so it cannot stand in here. What was wrong with this function is
 * that every label it returned was a hardcoded English string in an app that ships
 * Thai and English -- a user on the Thai build saw "usage newer" next to translated
 * everything else. The labels are translated now.
 */
function sourceFreshness(source: SourceStatus): { key: MessageKey; variant: 'ok' | 'outline' | 'warn' } {
  if (source.telemetry.gap) return { key: 'sources.fresh.gap', variant: 'warn' };
  switch (source.telemetry.freshness) {
    case 'live':
      return { key: 'sources.fresh.live', variant: 'ok' };
    case 'recent':
      return { key: 'sources.fresh.recent', variant: 'outline' };
    case 'stale':
      return {
        key: source.telemetry.reason === 'cached_only' ? 'sources.fresh.cached' : 'sources.fresh.stale',
        variant: 'warn',
      };
    case 'expired':
      return { key: 'sources.fresh.expired', variant: 'warn' };
    default:
      return {
        key: source.telemetry.reason === 'reader_error' ? 'sources.fresh.readerError' : 'sources.fresh.noQuota',
        variant: 'warn',
      };
  }
}

const STATE_VARIANT: Record<AccountState, 'ok' | 'warn' | 'crit' | 'outline'> = {
  active: 'ok',
  stale: 'warn',
  inactive: 'outline',
  unavailable: 'crit',
  waiting: 'outline',
};

function linkedNames(source: SourceStatus, ov: Overview): string {
  const harness = (ov.harnesses ?? []).find((entry) => entry.source_ids.includes(source.source_id));
  if (!harness || harness.subscription_keys.length === 0) return '—';
  return harness.subscription_keys
    .map((key) => ov.subscriptions.find((subscription) => subscription.subscription_key === key)?.subscription_display_name ?? key)
    .join(', ');
}

function DelegateRoutes({ ov }: { ov: Overview }) {
  const t = useT();
  const f = useFormat();
  const delegates = (ov.harnesses ?? []).filter((harness) => harness.parent_harness_key != null);
  if (delegates.length === 0) return null;

  return (
    <Card>
      <CardHeader className="flex-col items-start gap-1">
        <CardTitle className="flex items-center gap-2">
          <GitBranch className="size-4 text-muted-foreground" />
          {t('sources.routesTitle')}
        </CardTitle>
        <CardDescription className="note">{t('sources.routesBlurb')}</CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-2 md:grid-cols-2">
        {delegates.map((delegate) => {
          const parent = (ov.harnesses ?? []).find((harness) => harness.harness_key === delegate.parent_harness_key);
          const subscriptions = delegate.subscription_keys
            .map((key) => ov.subscriptions.find((subscription) => subscription.subscription_key === key)?.subscription_display_name ?? key)
            .join(', ');
          return (
            <div key={delegate.harness_key} className="border-border/70 bg-muted/15 rounded-md border px-3 py-2.5">
              <div className="flex items-center gap-2">
                <HarnessIcon
                  harness={delegate.harness}
                  vendor={delegate.vendor}
                  label={delegate.display_name}
                  className="text-[14px]"
                />
                <span className="text-[12px] font-medium">{delegate.display_name}</span>
                <div className="flex-1" />
                <Badge variant={delegate.usage_attributed ? 'ok' : 'outline'}>
                  {delegate.usage_attributed ? t('sources.attributed') : t('sources.parentOnly')}
                </Badge>
              </div>
              <div className="text-muted-foreground/75 mt-1.5 text-[11px] leading-relaxed">
                {parent?.display_name ?? t('sources.unknownParent')}
                {subscriptions ? ` · ${subscriptions}` : ` · ${f.tokens(delegate.total_tokens)} tokens`}
              </div>
              {!delegate.usage_attributed && (
                <div className="text-muted-foreground/70 mt-1 text-[10.5px]">{t('sources.parentOnlyHint')}</div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

/** Icon, display name, and the harness/profile the reading came from. */
function ReaderIdentity({ source }: { source: SourceStatus }) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <HarnessIcon
        harness={source.harness}
        vendor={source.vendor}
        label={source.display_name}
        className="text-muted-foreground text-[15px]"
      />
      <div className="min-w-0">
        <div className="truncate text-[12.5px] font-medium">{source.display_name}</div>
        <div className="text-muted-foreground/65 font-mono text-[10.5px]">
          {source.harness}/{source.profile}
        </div>
      </div>
    </div>
  );
}

/** Feed state, where the numbers came from, and the one warning worth calling out. */
function QuotaFeed({ source }: { source: SourceStatus }) {
  const t = useT();
  const status = sourceFreshness(source);
  // `freshness: 'gap'` and `reason: 'usage_newer_than_quota'` are the same fact reached two
  // ways, and the daemon sets both together. Rendering the badge and the warning in that
  // case prints the same sentence twice, with a warning icon on it the second time.
  const badgeAlreadySaysIt = status.key === 'sources.fresh.gap';
  return (
    <>
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge variant={status.variant}>{t(status.key)}</Badge>
        {source.telemetry.origins.slice(0, 2).map((origin) => (
          <Badge key={origin} variant="origin">
            {origin}
          </Badge>
        ))}
        {/*
          Lead with this rather than burying it: a disabled reader is still on this page
          precisely because it has history, and its feed state is the stalest thing here.
          Saying "expired" without saying the source is switched off sends the reader
          looking for a quota problem that does not exist.
        */}
        {!source.enabled && <Badge variant="outline">{t('sources.disabled')}</Badge>}
      </div>
      {!badgeAlreadySaysIt && source.telemetry.reason === 'usage_newer_than_quota' && (
        <div className="text-warn mt-1 inline-flex items-center gap-1 text-[10.5px]">
          <TriangleAlert className="size-3" />
          {t('sources.usageNewerThanQuota')}
        </div>
      )}
    </>
  );
}

/** The harness profiles reading one account, each with its own feed state. */
function ReaderTable({ account, ov }: { account: SourceAccount; ov: Overview }) {
  const t = useT();
  const f = useFormat();
  // Every unbound group is a table of readers with no subscription to name, so a column of
  // em dashes is the widest thing on the page and says nothing. Drop it unless someone in
  // the group actually has a name.
  const showSubscription = account.members.some((member) => linkedNames(member, ov) !== '—');
  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead>{t('sources.reader')}</TableHead>
          {showSubscription && <TableHead>{t('sources.subscription')}</TableHead>}
          <TableHead>{t('sources.quota')}</TableHead>
          <TableHead className="text-right">{t('col.calls')}</TableHead>
          <TableHead className="text-right">{t('col.total')}</TableHead>
          <TableHead className="text-right">{t('sources.samples')}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {account.members.map((source) => (
          <TableRow key={source.source_id}>
            <TableCell>
              <ReaderIdentity source={source} />
            </TableCell>
            {showSubscription && (
              <TableCell className="text-muted-foreground text-[11.5px]">{linkedNames(source, ov)}</TableCell>
            )}
            <TableCell>
              <QuotaFeed source={source} />
            </TableCell>
            <TableCell className="tabular text-right font-mono">{source.calls.toLocaleString()}</TableCell>
            <TableCell className="tabular text-muted-foreground text-right font-mono">
              {f.tokens(source.total_tokens)}
            </TableCell>
            <TableCell className="tabular text-right font-mono">{source.limit_samples.toLocaleString()}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

/**
 * A single reader, as a line rather than a one-row table.
 *
 * Two things make the table wrong here. A six-column header above one line is a header and
 * a grid saying "there is one of these". And the numbers would be duplicates: the account
 * header above already carries calls and sample totals, and with one reader those
 * aggregates are this reader's own. Worse, `groupSources` names a group after its busiest
 * member, so with a single member the account name and the reader name are the same string
 * by construction -- printing it twice says nothing.
 *
 * What the header does not say is which harness profile did the reading, what state its
 * feed is in, and which subscription it is bound to. Only those are added.
 */
function ReaderRow({ source, ov }: { source: SourceStatus; ov: Overview }) {
  const t = useT();
  const f = useFormat();
  const names = linkedNames(source, ov);
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 pl-0.5">
      <HarnessIcon
        harness={source.harness}
        vendor={source.vendor}
        label={source.display_name}
        className="text-muted-foreground text-[15px]"
      />
      <span className="text-muted-foreground/70 font-mono text-[10.5px]">
        {source.harness}/{source.profile}
      </span>
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
        <QuotaFeed source={source} />
        {names !== '—' && <span className="text-muted-foreground/75 truncate text-[11px]">{names}</span>}
      </div>
      <span className="text-muted-foreground shrink-0 text-[11px]">
        {t('col.total')} <span className="tabular font-mono">{f.tokens(source.total_tokens)}</span>
      </span>
    </div>
  );
}

/**
 * One account or unbound harness, with its readers underneath.
 *
 * Accounts and unbound groups are the same shape -- a header, a state, a set of readers --
 * so they share this component. Rendering them separately is how the unbound section came
 * to drop the individual profiles it had grouped: with a summary line and nothing else, a
 * harness with six unbound profiles showed one row and five of them were invisible.
 */
function SourceGroup({ group, ov, now }: { group: SourceAccount; ov: Overview; now: number }) {
  const t = useT();
  return (
    <section
      data-testid="source-group"
      data-key={group.key}
      data-members={group.members.length}
      className="px-4 py-3 first:pt-0 last:pb-0"
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <span className={group.bound ? 'text-[13.5px] font-semibold' : 'text-[13px] font-medium'}>{group.name}</span>
        <Badge variant={STATE_VARIANT[group.state]}>{t(`sources.state.${group.state}`)}</Badge>
        {/* Only worth saying when there is a choice to make; a lone reader is already one line. */}
        {group.members.length > 1 && (
          <span className="text-muted-foreground text-[11px]">{t('sources.readersN', { n: group.members.length })}</span>
        )}
        <span className="text-muted-foreground/70 font-mono text-[10.5px]">{group.key}</span>
        <div className="flex-1" />
        <span className="text-muted-foreground text-[11px]">
          {t('col.calls')} {group.calls.toLocaleString()}
        </span>
        <span className="text-muted-foreground text-[11px]">
          {t('sources.samples')} {group.limitSamples.toLocaleString()}
        </span>
        {group.lastEventTs != null && (
          <span className="text-muted-foreground/70 text-[11px]">
            {age(Math.max(0, (now - group.lastEventTs) / 1000))}
          </span>
        )}
      </div>
      <div className="mt-2">
        {group.members.length > 1 ? <ReaderTable account={group} ov={ov} /> : <ReaderRow source={group.members[0]!} ov={ov} />}
      </div>
    </section>
  );
}

export function SourcesSection({ ov }: { ov: Overview }) {
  const t = useT();
  const now = ov.now;
  const { accounts, unbound } = groupSources(ov.sourceStatus ?? []);

  return (
    <div className="flex flex-col gap-3.5">
      <Card data-testid="source-accounts">
        <CardHeader className="flex-col items-start gap-1">
          <CardTitle className="flex items-center gap-2">
            <Radio className="size-4 text-muted-foreground" />
            {t('sources.accounts')}
          </CardTitle>
          <CardDescription className="note">{t('sources.accountsBlurb')}</CardDescription>
        </CardHeader>
        {accounts.length === 0 ? (
          <Empty>{t('sources.empty')}</Empty>
        ) : (
          <div className="divide-y">
            {accounts.map((account) => (
              <SourceGroup key={account.key} group={account} ov={ov} now={now} />
            ))}
          </div>
        )}
      </Card>

      {/*
        Unbound harnesses get their own section rather than being folded into the account
        list. They are not a broken account -- they are a harness that has never been bound
        to one -- and inventing a group for them would be a grouping the data does not
        support. On a fresh install this is most of the page, so it gets a heading that
        explains itself rather than looking like a list of failures.
      */}
      {unbound.length > 0 && (
        <Card data-testid="source-unbound">
          <CardHeader className="flex-col items-start gap-1">
            <CardTitle className="flex items-center gap-2">
              <Unlink className="size-4 text-muted-foreground" />
              {t('sources.unbound')}
            </CardTitle>
            <CardDescription className="note">{t('sources.unboundBlurb')}</CardDescription>
          </CardHeader>
          <div className="divide-y">
            {unbound.map((group) => (
              <SourceGroup key={group.key} group={group} ov={ov} now={now} />
            ))}
          </div>
        </Card>
      )}

      <DelegateRoutes ov={ov} />
    </div>
  );
}
