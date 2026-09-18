import { useState } from 'react';
import { Activity, Coins, Database, Hash } from 'lucide-react';
import { api, type Overview, type UsageResponse } from '@/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Empty, ErrorBox, Stagger, StaggerItem } from '@/components/primitives';
import { SourceTable } from '@/sections/live';
import { TrendChart } from '@/components/trend-chart';
import { ValueDisplay } from '@/components/value-display';
import { useFormat } from '@/i18n/format';
import { useT } from '@/i18n';
import { useLiveRefresh } from '@/lib/use-live';
import { UsageRangeBar, useUsageRoute, type UsageView } from '@/components/usage-range';
import { CostSection } from '@/sections/cost';
import { ProjectsSection } from '@/sections/projects';
import { ModelsSection } from '@/sections/models';

export function UsageSection({ ov, sources = [] }: { ov: Overview; sources?: Array<{ id: number; display_name: string }> }) {
  const t = useT();
  const [route, updateRoute] = useUsageRoute('usage');
  const [data, setData] = useState<UsageResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const sourceId = route.selection.sourceId;

  useLiveRefresh(() => api.usage({
    range: route.selection.range,
    from: route.selection.from,
    to: route.selection.to,
    bucket: route.selection.bucket ?? 'auto',
    sourceId,
  }).then((next) => {
    setData(next);
    setErr(null);
  }).catch((error) => {
    setErr(String(error));
    throw error;
  }), [route.selection.range, route.selection.from, route.selection.to, route.selection.bucket, sourceId]);

  const view = route.view;
  const selectView = (next: UsageView) => updateRoute({ view: next });
  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-semibold tracking-tight">{t('usage.title')}</h2>
          <p className="text-muted-foreground note mt-1 text-[12.5px] leading-relaxed">{t('usage.blurb')}</p>
        </div>
        {data && <span className="text-muted-foreground text-xs">{data.range.timezone} · {new Date(data.range.from).toLocaleDateString()}</span>}
      </div>
      <UsageRangeBar route={route} onChange={updateRoute} sources={sources} />
      <div className="flex flex-wrap gap-1 rounded-xl border border-border/70 bg-muted/10 p-1" role="tablist" aria-label={t('usage.title')}>
        {([
          ['summary', t('usage.summary')],
          ['cost', t('usage.cost')],
          ['projects', t('usage.projects')],
          ['models', t('usage.models')],
        ] as Array<[UsageView, string]>).map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={view === id} onClick={() => selectView(id)} className={view === id ? 'bg-card text-foreground rounded-lg px-3 py-1.5 text-xs font-medium shadow-sm' : 'text-muted-foreground rounded-lg px-3 py-1.5 text-xs font-medium hover:text-foreground'}>
            {label}
          </button>
        ))}
      </div>
      {err && !data && <ErrorBox>{err}</ErrorBox>}
      {!data ? <Empty>{t('app.loading')}</Empty> : view === 'summary' ? (
        <UsageSummary data={data} />
      ) : view === 'cost' ? (
        <CostSection ov={ov} period={data.range} totals={data.totals} sourceId={sourceId} />
      ) : view === 'projects' ? (
        <ProjectsSection sources={sources} period={data.range} sourceId={sourceId} />
      ) : (
        <ModelsSection period={data.range} sourceId={sourceId} />
      )}
    </div>
  );
}

function UsageSummary({ data }: { data: UsageResponse }) {
  const t = useT();
  const f = useFormat();
  const total = data.totals;
  const scope = { from: data.range.from, to: data.range.to };
  const stats = [
    { label: t('usage.totalTokens'), value: f.tokens(total.total_tokens), icon: Activity },
    { label: t('usage.calls'), value: total.calls.toLocaleString(), icon: Hash },
    { label: t('usage.value'), value: <ValueDisplay total={total} scope={scope} label={t('usage.value')} />, icon: Coins },
    { label: t('usage.cacheRead'), value: f.tokens(total.cached_input_tokens), icon: Database },
  ];
  return (
    <Stagger className="flex flex-col gap-3.5">
      <StaggerItem>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {stats.map((stat) => <Card key={stat.label}><CardContent className="pt-4"><div className="text-muted-foreground flex items-center gap-2 text-[11.5px] font-medium"><stat.icon className="size-3.5 opacity-70" />{stat.label}</div><p className="tabular mt-3 font-mono text-2xl font-semibold">{stat.value}</p></CardContent></Card>)}
        </div>
      </StaggerItem>
      <StaggerItem>
        <Card>
          <CardHeader className="flex-col items-start gap-1">
            <CardTitle>{t('usage.timeline')}</CardTitle>
            <CardDescription>{data.range.from === 0 ? t('usage.allTime') : new Date(data.range.from).toLocaleDateString() + ' – ' + new Date(data.range.to).toLocaleDateString()}</CardDescription>
          </CardHeader>
          <CardContent>
            <TrendChart rows={data.timeline} metric="total_tokens" bucket={data.range.bucket} groupBy="none" />
          </CardContent>
        </Card>
      </StaggerItem>
      <StaggerItem>
        <Card>
          <CardHeader><CardTitle>{t('usage.byHarness')}</CardTitle></CardHeader>
          <SourceTable rows={data.bySource} empty={t('usage.noData')} scope={scope} />
        </Card>
      </StaggerItem>
    </Stagger>
  );
}
