import { useState } from 'react';
import { Activity, Coins, CalendarRange, Database } from 'lucide-react';
import { api, type Overview, type SourceTotals } from '@/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AnimatedNumber, Empty, Sparkline, Stagger, StaggerItem } from '@/components/primitives';
import { GaugeStack } from '@/components/gauge';
import { Hint } from '@/components/ui/tooltip';
import { age } from '@/format';
import { isExpired, tokensParts, vendorLabel } from '@/format';
import { VendorIcon } from '@/components/vendor-icon';
import { useFormat } from '@/i18n/format';
import { useT } from '@/i18n';
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

export function LiveSection({ ov }: { ov: Overview }) {
  const t = useT();
  const f = useFormat();
  const now = ov.now;
  const spark = useRecentHours(24);

  // One card per source: two Claude profiles have separate quotas and must never blur.
  const bySource = new Map<number, typeof ov.limits>();
  for (const l of ov.limits) {
    if (!bySource.has(l.source_id)) bySource.set(l.source_id, []);
    bySource.get(l.source_id)!.push(l);
  }

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

      {/*
        * Every source we detected, not only the ones that publish a quota. OpenCode and
        * Hermes publish none at all, and a quota-driven list left them invisible here --
        * which reads as "not tracked" when in fact their usage is in every other tab.
        */}
      <Stagger className="grid grid-cols-1 gap-3.5 md:grid-cols-2 lg:grid-cols-3">
        {(ov.sourceStatus ?? []).map((src) => {
          const limits = bySource.get(src.source_id) ?? [];
          const hasQuota = limits.length > 0;
          const anyLive = limits.some((l) => !isExpired(l, now) && (l.ageSeconds ?? 1e9) < 120);
          const anyStale = hasQuota && limits.every((l) => isExpired(l, now));
          return (
            <StaggerItem key={src.source_id}>
              <Card className="h-full">
                <CardHeader>
                  <VendorIcon
                    vendor={src.vendor}
                    label={vendorLabel(src.vendor)}
                    className="text-[16px]"
                  />
                  <CardTitle>{src.display_name}</CardTitle>
                  <div className="flex-1" />
                  <span
                    className="size-1.5 rounded-full"
                    style={{
                      background: anyLive
                        ? 'var(--ok)'
                        : anyStale || !hasQuota
                          ? 'var(--muted-foreground)'
                          : 'var(--warn)',
                    }}
                  />
                </CardHeader>
                <CardContent>
                  {hasQuota ? (
                    <GaugeStack limits={limits} now={now} />
                  ) : (
                    <div className="flex flex-col gap-2">
                      <p className="text-muted-foreground note text-[11.5px] leading-relaxed">
                        {t('live.noQuota')}
                      </p>
                      <div className="text-muted-foreground/70 flex flex-wrap items-baseline gap-x-3 text-[11.5px]">
                        <span className="tabular text-foreground/80 font-mono">
                          {t('live.allTime', { tokens: f.tokens(src.total_tokens) })}
                        </span>
                        <span>{t('live.calls', { n: src.calls.toLocaleString() })}</span>
                        <span>
                          {src.last_event_ts
                            ? t('live.lastUsed', { age: age((now - src.last_event_ts) / 1000) })
                            : t('live.neverUsed')}
                        </span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </StaggerItem>
          );
        })}
      </Stagger>

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
                {/* The brand behind the harness, not an abstract colour dot. */}
                <VendorIcon
                  vendor={r.vendor}
                  label={vendorLabel(r.vendor)}
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
