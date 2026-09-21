import { useState } from 'react';
import { Activity, Coins, CalendarRange, Database } from 'lucide-react';
import { api, type Overview, type SourceTotals, type PricingScope } from '@/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Empty, Sparkline } from '@/components/primitives';
import { HarnessIcon } from '@/components/harness-icon';
import { useFormat } from '@/i18n/format';
import { useT } from '@/i18n';
import { useLiveRefresh } from '@/lib/use-live';
import { statSeries } from '@/lib/quota-summary';
import { QuotaOverview } from '@/components/quota-overview';
import { ValueDisplay } from '@/components/value-display';
import { AttentionPanel, DataStatusStrip } from '@/components/data-status';

function useStatSeries() {
  const [series, setSeries] = useState({ tokens: [] as number[], cost: [] as number[], week: [] as number[] });
  useLiveRefresh(async () => {
    const to = Date.now();
    const midnight = new Date(to); midnight.setHours(0, 0, 0, 0);
    const from = midnight.getTime();
    const weekFrom = to - 7 * 86_400_000;
    const [today, week] = await Promise.all([
      api.trend({ bucket: 'hour', from, to, groupBy: 'none' }),
      api.trend({ bucket: 'day', from: weekFrom, to, groupBy: 'none' }),
    ]);
    setSeries({
      tokens: statSeries(today.rows, from, to, 'hour', 'total_tokens'),
      cost: statSeries(today.rows, from, to, 'hour', 'cost_usd'),
      week: statSeries(week.rows, weekFrom, to, 'day', 'total_tokens'),
    });
  }, []);
  return series;
}

export function LiveSection({ ov, onOpenLimits, onOpenHealth, onOpenCost }: { ov: Overview; onOpenLimits: () => void; onOpenHealth?: () => void; onOpenCost?: () => void }) {
  const t = useT();
  const f = useFormat();
  const spark = useStatSeries();
  const today = ov.today;
  const midnight = new Date(ov.now); midnight.setHours(0, 0, 0, 0);
  const pricingScope = { from: midnight.getTime(), to: ov.now };
  const cacheTotal = today.cached_input_tokens + today.input_tokens + today.cache_write_tokens;
  const cacheShare = cacheTotal > 0 ? Number((today.cached_input_tokens / cacheTotal * 100).toFixed(1)) : 0;
  const stats = [
    { label: t('live.tokensToday'), value: f.tokens(today.total_tokens), icon: Activity, points: spark.tokens, note: t('live.apiCalls', { n: today.calls.toLocaleString() }) },
    { label: t('live.valueToday'), value: <ValueDisplay total={today} scope={pricingScope} label={t('live.valueToday')} />, icon: Coins,
      points: today.cost_unknown_calls > 0 ? [] : spark.cost, note: t('live.listPrice') },
    { label: t('live.tokensWeek'), value: f.tokens(ov.week.total_tokens), icon: CalendarRange, points: spark.week, note: t('live.calls', { n: ov.week.calls.toLocaleString() }) },
    { label: t('live.cacheToday'), value: f.tokens(today.cached_input_tokens), icon: Database, points: [], note: cacheTotal === 0 ? t('live.noInput') : t('live.cacheShare', { pct: cacheShare.toFixed(1) }) },
  ];
  return <div className="space-y-5">
    <DataStatusStrip ov={ov} />
    <AttentionPanel ov={ov} onOpenLimits={onOpenLimits} onOpenHealth={onOpenHealth ?? onOpenLimits} onOpenCost={onOpenCost ?? onOpenLimits} />
    <QuotaOverview ov={ov} onOpenLimits={onOpenLimits} />
    <section aria-label={t('quota.usage')}>
      <h2 className="mb-4 text-lg font-semibold">{t('quota.usage')}</h2>
      <div className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map(({ label, value, icon: Icon, points, note }, i) => <Card key={label} className="min-w-0">
          <CardContent className="pt-5">
            <div className="text-muted-foreground flex items-center gap-2 text-xs"><Icon className="size-4 shrink-0" />{label}</div>
            <p className="tabular mt-3 text-[32px] leading-tight font-semibold tracking-tight" data-testid={`stat-${i}`}>{value}</p>
            <div className="mt-3 flex min-h-8 items-center justify-between gap-3">
              <span className="text-muted-foreground text-xs leading-relaxed" title={i === 1 ? f.explain(today.cost_usd) ?? t('live.listPriceHint') : undefined}>{note}</span>
              {points.length > 0 && <Sparkline points={points} width={64} />}
            </div>
            {i === 1 && today.cost_unknown_calls > 0 && <Badge variant="warn" className="mt-2">{t('live.unpriced', { n: today.cost_unknown_calls })}</Badge>}
            {i === 3 && <div className="bg-track mt-2 h-1.5 overflow-hidden rounded-full"><div className="bg-ok h-full rounded-full" style={{ width: `${cacheShare}%` }} /></div>}
          </CardContent>
        </Card>)}
      </div>
    </section>
    <Card className="min-w-0"><CardHeader><CardTitle>{t('live.activityToday')}</CardTitle><span className="text-muted-foreground text-xs">{t('live.byHarness')}</span></CardHeader><SourceTable rows={ov.bySourceToday} empty={t('live.noActivity')} scope={pricingScope} /></Card>
  </div>;
}

export function SourceTable({ rows, empty, scope }: { rows: SourceTotals[]; empty: string; scope?: PricingScope }) {
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
              <ValueDisplay total={r} scope={scope ? { ...scope, sourceId: r.source_id } : undefined} label={r.display_name} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
