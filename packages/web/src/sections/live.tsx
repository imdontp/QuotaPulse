import { useState } from 'react';
import { Activity, Coins, CalendarRange, Database, TriangleAlert } from 'lucide-react';
import { api, type Overview, type SourceTotals, type SubscriptionStatus } from '@/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AnimatedNumber, Empty, Sparkline, Stagger, StaggerItem } from '@/components/primitives';
import { GaugeStack } from '@/components/gauge';
import { Hint } from '@/components/ui/tooltip';
import { age, isExpired, tokensParts } from '@/format';
import { HarnessIcon } from '@/components/harness-icon';
import { useFormat } from '@/i18n/format';
import { useI18n, useT } from '@/i18n';
import { useLiveRefresh } from '@/lib/use-live';

/**
 * Hourly series for the stat-card sparklines. Fetched rather than faked: a sparkline
 * that does not track the number above it is worse than no sparkline.
 */
function useRecentHours(hours = 24) {
  const [series, setSeries] = useState<{ tokens: number[]; cost: number[]; calls: number[] }>({
    tokens: [],
    cost: [],
    calls: [],
  });

  useLiveRefresh(() => {
    const to = Date.now();
    return api
      .trend({ bucket: 'hour', from: to - hours * 3_600_000, to, groupBy: 'none' })
      .then((r) => {
        const byBucket = new Map<number, { t: number; c: number; n: number }>();
        for (const row of r.rows) {
          const cur = byBucket.get(row.bucket_ts) ?? { t: 0, c: 0, n: 0 };
          cur.t += row.total_tokens;
          cur.c += row.cost_usd;
          cur.n += row.calls;
          byBucket.set(row.bucket_ts, cur);
        }
        const ordered = [...byBucket.entries()].sort((a, b) => a[0] - b[0]).map(([, v]) => v);
        setSeries({
          tokens: ordered.map((v) => v.t),
          cost: ordered.map((v) => v.c),
          calls: ordered.map((v) => v.n),
        });
      })
      // Keep the last sparkline when a background query fails. The coordinator
      // records the failure and retries; clearing it would make the card flicker.
      .catch((error) => {
        throw error;
      });
  }, [hours]);

  return series;
}

function Stat({
  icon: Icon,
  label,
  value,
  unit,
  children,
}: {
  icon: typeof Activity;
  label: string;
  value: React.ReactNode;
  unit?: string;
  children?: React.ReactNode;
}) {
  return (
    /* h-full so the four cards keep one baseline: the grid already stretches each cell,
       but a Card that sizes to its own content leaves the shorter ones floating. */
    <Card className="h-full">
      <CardContent className="pt-4">
        <div className="text-muted-foreground mb-2 flex items-center gap-2 text-[11.5px] font-medium">
          <Icon className="size-3.5 opacity-70" />
          {label}
        </div>
        <div className="tabular font-mono text-[27px] leading-none font-semibold tracking-tight">
          {value}
          {unit && <span className="text-muted-foreground ml-0.5 text-[17px]">{unit}</span>}
        </div>
        {children}
      </CardContent>
    </Card>
  );
}

function subscriptionStateLabel(t: ReturnType<typeof useT>, state: SubscriptionStatus['state']): string {
  return state === 'active'
    ? t('live.subscriptionActive')
    : state === 'stale'
      ? t('live.subscriptionStale')
      : state === 'inactive'
        ? t('live.subscriptionInactive')
        : state === 'unavailable'
          ? t('live.subscriptionUnavailable')
          : t('live.subscriptionWaiting');
}

function stateVariant(state: SubscriptionStatus['state']): 'ok' | 'outline' | 'warn' {
  return state === 'active' ? 'ok' : state === 'inactive' ? 'outline' : 'warn';
}

export function LiveSection({ ov }: { ov: Overview }) {
  const t = useT();
  const f = useFormat();
  const { hiddenSubscriptions } = useI18n();
  const now = ov.now;
  const spark = useRecentHours(24);

  const today = ov.today;
  /*
   * Cache writes belong in the denominator. They are input the model read for the FIRST
   * time -- and they are billed at a premium to ordinary input, not a discount -- so
   * leaving them out and calling the result "% of input" overstates the cache. On this
   * machine it was the difference between 99.9% and 97.4%: a claim that the uncached
   * surface is 0.1% when it is really 2.6%, a 26x understatement of the part that costs.
   */
  const cacheTotal =
    today.cached_input_tokens + today.input_tokens + today.cache_write_tokens;
  const cacheShareExact = cacheTotal > 0 ? (today.cached_input_tokens / cacheTotal) * 100 : 0;
  // One rounded value for both the bar and the caption. They used to disagree: the
  // caption rounded to 100.0% while the bar, drawn from the exact value, was visibly
  // short of full.
  const cacheShare = Number(cacheShareExact.toFixed(1));
  const weekTok = tokensParts(ov.week.total_tokens);
  const todayTok = tokensParts(today.total_tokens);
  const cacheTok = tokensParts(today.cached_input_tokens);
  const subscriptions = (ov.subscriptions ?? []).filter(
    (subscription) => !hiddenSubscriptions.includes(subscription.subscription_key),
  );

  return (
    <div className="flex flex-col gap-3.5">
      <Stagger className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        <StaggerItem>
          <Stat
            icon={Activity}
            label={t('live.tokensToday')}
            value={<AnimatedNumber value={today.total_tokens} format={(n) => tokensParts(n).value} />}
            unit={todayTok.unit}
          >
            <div className="mt-2.5 flex items-end justify-between gap-3">
              <span className="text-muted-foreground/70 text-[11.5px]">
                {t('live.apiCalls', { n: today.calls.toLocaleString() })}
              </span>
              <Sparkline points={spark.tokens} />
            </div>
          </Stat>
        </StaggerItem>

        <StaggerItem>
          <Stat
            icon={Coins}
            label={t('live.valueToday')}
            value={<AnimatedNumber value={today.cost_usd} format={(n) => f.money(n)} />}
          >
            {/*
              * No flex-wrap here, unlike every earlier version: the spacer and sparkline
              * are flex items, so the moment the note ran long -- which Thai does, at
              * nearly twice the English length -- they were pushed onto a second line and
              * this card alone grew ~22px taller than its three neighbours. The note
              * truncates instead, and the conversion detail moved into the tooltip.
              */}
            <div className="mt-2.5 flex items-center gap-2">
              {today.cost_unknown_calls > 0 && (
                <Badge variant="warn">{t('live.unpriced', { n: today.cost_unknown_calls })}</Badge>
              )}
              {/* The most prominent money figure on the page. A baht number this size
                  would otherwise read as an amount somebody actually charged, so the
                  hover carries the rate and the untouched USD figure behind it. */}
              <Hint text={f.explain(today.cost_usd) ?? t('live.listPriceHint')}>
                <span
                  tabIndex={0}
                  className="text-muted-foreground/70 cursor-help truncate text-[11px] underline decoration-dotted decoration-from-font underline-offset-2"
                >
                  {t('live.listPrice')}
                </span>
              </Hint>
              <div className="flex-1" />
              <Sparkline points={spark.cost} width={56} />
            </div>
          </Stat>
        </StaggerItem>

        <StaggerItem>
          <Stat
            icon={CalendarRange}
            label={t('live.tokensWeek')}
            value={<AnimatedNumber value={ov.week.total_tokens} format={(n) => tokensParts(n).value} />}
            unit={weekTok.unit}
          >
            <div className="mt-2.5 flex items-end justify-between gap-3">
              <span className="text-muted-foreground/70 text-[11.5px]">
                {t('live.calls', { n: ov.week.calls.toLocaleString() })}
              </span>
              <Sparkline points={spark.calls} />
            </div>
          </Stat>
        </StaggerItem>

        <StaggerItem>
          <Stat
            icon={Database}
            label={t('live.cacheToday')}
            value={<AnimatedNumber value={today.cached_input_tokens} format={(n) => tokensParts(n).value} />}
            unit={cacheTok.unit}
          >
            <div className="mt-3">
              <div className="bg-track h-1 overflow-hidden rounded">
                <div className="bg-ok h-full rounded" style={{ width: `${cacheShare}%` }} />
              </div>
              <div className="text-muted-foreground/70 mt-1.5 text-[11px]">
                {cacheTotal === 0
                  ? t('live.noInput')
                  : t('live.cacheShare', { pct: cacheShare.toFixed(1) })}
              </div>
            </div>
          </Stat>
        </StaggerItem>
      </Stagger>

      <div className="flex flex-col gap-3.5">
        <div className="flex items-baseline justify-between gap-3 px-0.5">
          <h2 className="text-[13px] font-semibold">{t('live.subscriptionGroup')}</h2>
          <span className="text-muted-foreground text-[11.5px]">{t('live.subscriptionGroupBlurb')}</span>
        </div>
        {subscriptions.length === 0 ? (
          <p className="text-muted-foreground note text-[11.5px] leading-relaxed">
            {t('live.allSubscriptionsHidden')}
          </p>
        ) : (
          <Stagger className="grid grid-cols-1 gap-3.5 md:grid-cols-2 lg:grid-cols-3">
            {subscriptions.map((subscription) => {
              const limits = ov.limits.filter(
                (limit) => (limit.subscription_key ?? limit.account_key) === subscription.subscription_key,
              );
              const linkedHarness = (ov.harnesses ?? []).find((harness) =>
                subscription.linked_harness_keys.includes(harness.harness_key),
              );
              const anyLive = limits.some(
                (limit) => !isExpired(limit, now) && (limit.ageSeconds ?? 1e9) < 120,
              );
              const statusLabel = subscriptionStateLabel(t, subscription.state);
              return (
                <StaggerItem key={subscription.subscription_key}>
                  <Card className="h-full">
                    <CardHeader>
                      <HarnessIcon
                        harness={linkedHarness?.harness ?? 'unknown'}
                        vendor={subscription.provider}
                        label={subscription.subscription_display_name}
                        className="text-[16px]"
                      />
                      <CardTitle>{subscription.subscription_display_name}</CardTitle>
                      <div className="flex-1" />
                      <Badge variant={stateVariant(subscription.state)}>{statusLabel}</Badge>
                      {subscription.telemetry.gap && <Badge variant="warn">{t('live.quotaGap')}</Badge>}
                      <span
                        className="size-1.5 rounded-full"
                        style={{ background: anyLive ? 'var(--ok)' : 'var(--muted-foreground)' }}
                      />
                    </CardHeader>
                    <CardContent>
                      {limits.length > 0 && subscription.state !== 'inactive' ? (
                        <GaugeStack limits={limits} now={now} />
                      ) : (
                        <p className="text-muted-foreground note text-[11.5px] leading-relaxed">
                          {subscription.state === 'inactive' ? statusLabel : t('live.subscriptionNoReading')}
                        </p>
                      )}
                      {subscription.linked_harness_keys.length > 0 && (
                        <div className="text-muted-foreground/70 mt-3 text-[11px]">
                          {t('live.subscriptionLinkedHarnesses', {
                            n: subscription.linked_harness_keys.length,
                          })}
                        </div>
                      )}
                      {subscription.telemetry.latest_quota_at != null && subscription.telemetry.freshness !== 'live' && (
                        <div className="text-muted-foreground/70 mt-1 text-[11px]">
                          {t('live.quotaLastRead', {
                            age: age((now - subscription.telemetry.latest_quota_at) / 1000),
                          })}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </StaggerItem>
              );
            })}
          </Stagger>
        )}
      </div>

      {subscriptions.some((subscription) => subscription.telemetry.gap) && (
        <Card className="border-warn/30 bg-warn/5">
          <CardContent className="flex items-start gap-2.5 py-3">
            <TriangleAlert className="text-warn mt-0.5 size-4 shrink-0" />
            <div className="text-[12px] leading-relaxed">
              <div className="font-medium">{t('live.quotaGapTitle')}</div>
              <div className="text-muted-foreground mt-0.5">{t('live.quotaGapBlurb')}</div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t('live.activityToday')}</CardTitle>
          <span className="text-muted-foreground text-[11.5px]">{t('live.byHarness')}</span>
        </CardHeader>
        <SourceTable rows={ov.bySourceToday} empty={t('live.noActivity')} />
      </Card>
    </div>
  );
}

export function SourceTable({ rows, empty }: { rows: SourceTotals[]; empty: string }) {
  const t = useT();
  const f = useFormat();
  if (rows.length === 0) return <Empty>{empty}</Empty>;
  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead>{t('col.harness')}</TableHead>
          <TableHead className="text-right">{t('col.calls')}</TableHead>
          <TableHead className="text-right">{t('col.freshIn')}</TableHead>
          <TableHead className="text-right">{t('col.cacheRead')}</TableHead>
          <TableHead className="text-right">{t('col.output')}</TableHead>
          <TableHead className="text-right">{t('col.total')}</TableHead>
          <TableHead className="text-right">{t('col.value')}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={r.source_id}>
            <TableCell>
              <span className="inline-flex items-center gap-2">
                <HarnessIcon
                  harness={r.harness}
                  vendor={r.vendor}
                  label={r.display_name}
                  className="text-muted-foreground text-[15px]"
                />
                {r.display_name}
              </span>
            </TableCell>
            <TableCell className="tabular text-right font-mono">{r.calls.toLocaleString()}</TableCell>
            <TableCell className="tabular text-muted-foreground text-right font-mono">
              {f.tokens(r.input_tokens)}
            </TableCell>
            <TableCell className="tabular text-muted-foreground text-right font-mono">
              {f.tokens(r.cached_input_tokens)}
            </TableCell>
            <TableCell className="tabular text-muted-foreground text-right font-mono">
              {f.tokens(r.output_tokens)}
            </TableCell>
            <TableCell className="tabular text-right font-mono">{f.tokens(r.total_tokens)}</TableCell>
            <TableCell className="tabular text-right font-mono">
              {f.moneyTotal(r.cost_usd, r.cost_unknown_calls, r.calls)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
