import { useState } from 'react';
import { api, type CompareResult, type TrendRow } from '@/api';
import { Card, CardContent } from '@/components/ui/card';
import { Select } from '@/components/ui/select';
import { ErrorBox } from '@/components/primitives';
import { TrendChart, type Metric } from '@/components/trend-chart';
import { useT } from '@/i18n';
import { useFormat } from '@/i18n/format';
import { useLiveRefresh } from '@/lib/use-live';
import { AnalysisFilterBar, useAnalysisFilters } from '@/components/analysis-filters';

const DAY = 86_400_000;

/**
 * Above this many buckets an hourly point is under two pixels wide on any realistic
 * screen, so the extra resolution is noise that only costs render time. The request is
 * silently coarsened to daily and the UI says so rather than quietly disagreeing with
 * the control the user just set.
 */
const MAX_BUCKETS = 600;

export function TrendSection({ sources = [] }: { sources?: Array<{ id: number; display_name: string }> }) {
  const t = useT();
  const f = useFormat();
  const [bucket, setBucket] = useState<'hour' | 'day'>('day');
  const [groupBy, setGroupBy] = useState('harness');
  const [metric, setMetric] = useState<Metric>('total_tokens');
  const [filters, setFilters, clearFilters] = useAnalysisFilters();
  const days = filters.days;
  const [rows, setRows] = useState<TrendRow[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [compare, setCompare] = useState(false);
  const [comparison, setComparison] = useState<CompareResult | null>(null);

  const wouldBe = bucket === 'hour' ? days * 24 : days;
  const coarsened = bucket === 'hour' && wouldBe > MAX_BUCKETS;
  const effectiveBucket: 'hour' | 'day' = coarsened ? 'day' : bucket;

  useLiveRefresh(() => {
    const to = Date.now();
    const from = days === 0 ? 0 : to - days * DAY;
    const requests: [ReturnType<typeof api.trend>, Promise<CompareResult | null>] = [
      api.trend({ bucket: effectiveBucket, from, to, groupBy, sourceId: filters.sourceId }),
      compare && days > 0
        ? api.compare({ from, to, previousFrom: from - (to - from), previousTo: from, groupBy, sourceId: filters.sourceId })
        : Promise.resolve(null),
    ];
    return Promise.all(requests).then(([r, c]) => {
        setRows(r.rows);
        setComparison(c);
        setErr(null);
        setLoaded(true);
      })
      .catch((e) => {
        setErr(String(e));
        throw e;
      });
  }, [effectiveBucket, groupBy, days, filters.sourceId, compare]);

  const metricValue = (totals: CompareResult['current'] | null) => {
    if (!totals) return '--';
    if (metric === 'cost_usd') return f.moneyTotal(totals.cost_usd, totals.cost_unknown_calls, totals.calls);
    if (metric === 'calls') return totals.calls.toLocaleString();
    return f.tokens(metric === 'output_tokens' ? totals.output_tokens : totals.total_tokens);
  };
  const deltaValue = (current: CompareResult['current'] | null, previous: CompareResult['current'] | null) => {
    if (!current || !previous) return '--';
    const value = metric === 'cost_usd' ? current.cost_usd - previous.cost_usd : metric === 'calls' ? current.calls - previous.calls : metric === 'output_tokens' ? current.output_tokens - previous.output_tokens : current.total_tokens - previous.total_tokens;
    const prefix = value > 0 ? '+' : '';
    return metric === 'cost_usd' ? `${prefix}${f.money(value)}` : `${prefix}${metric === 'calls' ? value.toLocaleString() : f.tokens(value)}`;
  };

  return (
    <div className="flex flex-col gap-3.5">
    <AnalysisFilterBar filters={filters} sources={sources} allowAllTime onChange={setFilters} onClear={clearFilters} />
    <Card>
      <CardContent className="pt-4">
        <div className="mb-4 flex flex-wrap items-center gap-2.5">
          <Select label={t('trend.metric')} value={metric} onChange={(e) => setMetric(e.target.value as Metric)}>
            <option value="total_tokens">{t('trend.metricTotal')}</option>
            <option value="output_tokens">{t('trend.metricOutput')}</option>
            <option value="cost_usd">{t('trend.metricCost')}</option>
            <option value="calls">{t('trend.metricCalls')}</option>
          </Select>

          <Select label={t('trend.groupBy')} value={groupBy} onChange={(e) => setGroupBy(e.target.value)}>
            <option value="harness">{t('trend.byHarness')}</option>
            <option value="vendor">{t('trend.byVendor')}</option>
            <option value="model">{t('trend.byModel')}</option>
            <option value="project">{t('trend.byProject')}</option>
            <option value="none">{t('trend.byNone')}</option>
          </Select>

          <Select label={t('trend.bucket')} value={bucket} onChange={(e) => setBucket(e.target.value as 'hour' | 'day')}>
            <option value="hour">{t('trend.hourly')}</option>
            <option value="day">{t('trend.daily')}</option>
          </Select>
          <label className="text-muted-foreground inline-flex h-8 items-center gap-2 rounded-md border px-2.5 text-[12.5px]">
            <input type="checkbox" checked={compare} disabled={days === 0} onChange={(e) => setCompare(e.target.checked)} className="accent-foreground" />
            {t('trend.compare')}
          </label>

        </div>

        {err && !loaded && <ErrorBox>{err}</ErrorBox>}

        <TrendChart rows={rows} metric={metric} bucket={effectiveBucket} groupBy={groupBy} />

        {comparison && <Card className="mt-4 border-border/70 bg-muted/10"><CardContent className="pt-4"><div className="flex flex-wrap items-baseline justify-between gap-2"><h3 className="text-sm font-semibold">{t('trend.compareTitle')}</h3><span className="text-muted-foreground text-[11px]">{t('trend.compareHelp')}</span></div><div className="mt-3 grid gap-2 sm:grid-cols-3"><div><p className="text-muted-foreground text-[11px]">{t('trend.current')}</p><p className="tabular text-lg font-semibold">{metricValue(comparison.current)}</p></div><div><p className="text-muted-foreground text-[11px]">{t('trend.previous')}</p><p className="tabular text-lg font-semibold">{metricValue(comparison.previous)}</p></div><div><p className="text-muted-foreground text-[11px]">{t('trend.change')}</p><p className="tabular text-lg font-semibold">{deltaValue(comparison.current, comparison.previous)}</p></div></div><div className="mt-4 border-t pt-3"><p className="text-muted-foreground mb-2 text-[11px]">{t('trend.topChanges')}</p><div className="grid gap-1 sm:grid-cols-2">{comparison.series.map((series) => { const current = metric === 'cost_usd' ? series.current?.cost_usd ?? 0 : metric === 'calls' ? series.current?.calls ?? 0 : metric === 'output_tokens' ? series.current?.output_tokens ?? 0 : series.current?.total_tokens ?? 0; const previous = metric === 'cost_usd' ? series.previous?.cost_usd ?? 0 : metric === 'calls' ? series.previous?.calls ?? 0 : metric === 'output_tokens' ? series.previous?.output_tokens ?? 0 : series.previous?.total_tokens ?? 0; return { series: series.series, delta: current - previous }; }).sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)).slice(0, 6).map((item) => <div key={item.series} className="flex items-center justify-between gap-3 text-xs"><span className="min-w-0 truncate">{item.series}</span><span className="tabular shrink-0 font-mono">{item.delta > 0 ? '+' : ''}{metric === 'cost_usd' ? f.money(item.delta) : metric === 'calls' ? item.delta.toLocaleString() : f.tokens(item.delta)}</span></div>)}</div></div></CardContent></Card>}

        {coarsened && (
          <p className="text-muted-foreground/70 mt-2.5 text-[11.5px]">
            {t('trend.coarsened', { days })}
          </p>
        )}
      </CardContent>
    </Card>
    </div>
  );
}
