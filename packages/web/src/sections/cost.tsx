import { useMemo, useState, type ReactNode } from 'react';
import { Coins, Layers, PiggyBank, CircleHelp } from 'lucide-react';
import { api, type ModelRow, type Overview, type Totals, type UsagePeriod } from '@/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BarList, Empty, Stagger, StaggerItem } from '@/components/primitives';
import { StatTile } from '@/components/page-parts';
import { SourceTable } from '@/components/source-table';
import { vendorColor, vendorLabel } from '@/format';
import { VendorIcon } from '@/components/vendor-icon';
import { useFormat } from '@/i18n/format';
import { useT } from '@/i18n';
import { Hint } from '@/components/ui/tooltip';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  numCell,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { useLiveRefresh } from '@/lib/use-live';
import { ValueDisplay } from '@/components/value-display';

export function CostSection({ ov, period, totals, sourceId }: { ov: Overview; period?: UsagePeriod; totals?: Totals; sourceId?: number }) {
  const t = useT();
  const f = useFormat();
  const [models, setModels] = useState<ModelRow[]>([]);
  useLiveRefresh(() =>
    api.models(period
      ? { from: period.from, to: period.to, sourceId }
      : 0,
    ).then((r) => setModels(r.models)),
  [period?.from, period?.to, sourceId]);

  const byModel = useMemo(() => {
    const m = new Map<string, { cost: number; unknown: number; estimated: number; calls: number; vendor: string }>();
    for (const r of models) {
      const cur = m.get(r.model) ?? { cost: 0, unknown: 0, estimated: 0, calls: 0, vendor: r.vendor };
      cur.cost += r.cost_usd;
      cur.unknown += r.cost_unknown_calls;
      cur.estimated += r.cost_estimated_calls;
      cur.calls += r.calls;
      m.set(r.model, cur);
    }
    return [...m.entries()].sort((a, b) => b[1].cost - a[1].cost);
  }, [models]);

  const all = totals ?? ov.allTime;
  const pricingScope = period ? { from: period.from, to: period.to } : { from: 0, to: ov.now };

  /*
   * One row per token bucket, each at its own rate. Cache read is the interesting line:
   * it is the overwhelming majority of the tokens and nothing like that share of the
   * bill, which is the whole argument for caching stated as a number.
   */
  const buckets = [
    { key: 'col.freshIn' as const, tokens: all.input_tokens, usd: all.cost_input_usd },
    {
      key: 'col.cacheRead' as const,
      tokens: all.cached_input_tokens,
      usd: all.cost_cached_input_usd,
    },
    {
      key: 'col.cacheWrite' as const,
      tokens: all.cache_write_tokens,
      usd: all.cost_cache_write_usd,
    },
    { key: 'col.output' as const, tokens: all.output_tokens, usd: all.cost_output_usd },
  ];
  /*
   * Exact now, not estimated. This used to multiply a blended per-token rate by 0.9;
   * the daemon stores, per call, what the cache reads would have cost at the full input
   * rate minus what they did cost, so the figure no longer depends on a magic constant.
   */
  const cacheSaved = all.cost_cache_saving_usd;

  const stats: Array<{
    icon: typeof Coins;
    label: string;
    value: ReactNode;
    note: string;
    tone?: string;
  }> = [
    {
      icon: Coins,
      label: t('cost.allTimeValue'),
      value: <ValueDisplay total={all} scope={pricingScope} label={t('cost.allTimeValue')} />,
      note: t('cost.listPriceNote'),
    },
    {
      icon: Layers,
      label: t('cost.allTimeTokens'),
      value: f.tokens(all.total_tokens),
      note: t('live.calls', { n: all.calls.toLocaleString() }),
    },
    {
      icon: PiggyBank,
      label: t('cost.savedByCache'),
      value: f.money(cacheSaved),
      note: t('cost.cacheExact'),
    },
    {
      icon: CircleHelp,
      label: t('cost.unpricedCalls'),
      value: all.cost_unknown_calls.toLocaleString(),
      /* A guessed provider is worth saying out loud even when nothing is unpriced:
         the money is there, the certainty behind it is not. */
      note:
        all.cost_estimated_calls > 0
          ? t('cost.estimatedCalls', { n: all.cost_estimated_calls.toLocaleString() })
          : all.cost_unknown_calls > 0
            ? t('cost.shownAsDash')
            : t('cost.allPriced'),
      tone:
        all.cost_unknown_calls > 0 || all.cost_estimated_calls > 0 ? 'text-warn' : undefined,
    },
  ];

  return (
    <div className="flex flex-col gap-3.5">
      <Stagger className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <StaggerItem key={s.label}>
            {/*
              Was a `Card` per figure, which made each tile a page region with no name. A
              figure tile is a labelled number, not a region, and `StatTile` says so
              structurally -- so the tiles are correctly absent from the page outline while
              the three sections below them are present in it.
            */}
            <StatTile
              label={s.label}
              value={s.value}
              icon={s.icon}
              note={s.note}
              tone={s.tone === 'text-warn' ? 'warn' : undefined}
            />
          </StaggerItem>
        ))}
      </Stagger>

      <Card>
        <CardHeader className="flex-col items-start gap-1">
          <CardTitle as="h2">{t('cost.breakdown')}</CardTitle>
          <CardDescription className="note">{t('cost.breakdownBlurb')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('col.bucket')}</TableHead>
                <TableHead className="text-right">{t('col.tokens')}</TableHead>
                <TableHead className="text-right">{t('col.value')}</TableHead>
                <TableHead className="text-right">{t('col.costShare')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {buckets.map((b) => (
                <TableRow key={b.key}>
                  <TableCell>{t(b.key)}</TableCell>
                  <TableCell className={numCell}>{f.tokens(b.tokens)}</TableCell>
                  <TableCell className={numCell}>{f.moneyTotal(b.usd, all.cost_unknown_calls, all.calls)}</TableCell>
                  <TableCell className={cn(numCell, 'text-muted-foreground')}>
                    {all.cost_usd > 0 ? `${((b.usd / all.cost_usd) * 100).toFixed(1)}%` : '--'}
                  </TableCell>
                </TableRow>
              ))}
              <TableRow className="border-t-2">
                <TableCell className="font-medium">{t('col.total')}</TableCell>
                <TableCell className={cn(numCell, 'font-medium')}>
                  {f.tokens(all.total_tokens)}
                </TableCell>
                {/*
                  * Plain text, not a second ValueDisplay.

                  * This used to render the same figure, the same scope, and its own copy of
                  * the pricing modal as the headline card at the top of this page -- so the
                  * all-time cost appeared twice, each copy independently clickable, and a
                  * reader could reasonably wonder which one was authoritative. A table total
                  * belongs in the table; the interactive figure belongs in the headline, and
                  * the rows above are plain money for the same reason.
                  */}
                <TableCell className={cn(numCell, 'font-medium')}>
                  {f.moneyTotal(all.cost_usd, all.cost_unknown_calls, all.calls)}
                </TableCell>
                <TableCell className={numCell} />
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-col items-start gap-1">
          <CardTitle as="h2">{t('cost.byModel')}</CardTitle>
          <CardDescription className="note">{t('cost.byModelBlurb')}</CardDescription>
          {/* A converted figure has to declare its rate, or it reads as money actually
              billed rather than a display conversion the user configured. */}
          {f.isConverted && (
            <CardDescription className="text-warn/90">
              {t('cost.converted', { rate: f.rateLabel })}
            </CardDescription>
          )}
        </CardHeader>
        <CardContent>
          {/*
            * Was rendering an empty card on every visit: `models` starts empty and the card
            * was unconditional, so the "by model" block appeared as a titled box with nothing
            * in it until /api/models came back. Now the three states are told apart -- still
            * loading, genuinely no usage, and the bars.
            */}
          {models.length === 0 ? (
            <Empty>{all.calls === 0 ? t('cost.noData') : t('app.loading')}</Empty>
          ) : byModel.length === 0 ? (
            <Empty>{t('cost.noData')}</Empty>
          ) : (
            <BarList
              rows={byModel.slice(0, 14).map(([model, v]) => ({
                label: model,
                value: v.cost,
                display: <ValueDisplay total={{ calls: v.calls, cost_usd: v.cost, cost_unknown_calls: v.unknown, cost_estimated_calls: v.estimated }} />,
                // The maker's colour, not a hash of the model name. Every Claude row is
                // Anthropic's orange here and on Trend, so the two pages agree.
                color: vendorColor(v.vendor),
                icon: <VendorIcon vendor={v.vendor} label={vendorLabel(v.vendor)} />,
              }))}
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle as="h2">{t('cost.allTimeByHarness')}</CardTitle>
        </CardHeader>
        <SourceTable rows={ov.bySourceAll} empty={t('cost.noData')} scope={pricingScope} />
      </Card>
    </div>
  );
}

