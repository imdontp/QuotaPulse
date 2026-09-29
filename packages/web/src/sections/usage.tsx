import { useState } from 'react';
import { Activity, Coins, Database, Download, Hash } from 'lucide-react';
import { api, type Overview, type UsageResponse } from '@/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Empty, ErrorBox, Stagger, StaggerItem } from '@/components/primitives';
import { PageHeader, StatTile, StatTileRow } from '@/components/page-parts';
import { SourceTable } from '@/components/source-table';
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
  const f = useFormat();
  const [route, updateRoute] = useUsageRoute('usage');
  const [data, setData] = useState<UsageResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
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
  const exportUsage = async () => {
    if (!data || exporting) return;
    setExporting(true);
    try {
      const result = await api.exportUsageCsv({
        from: data.range.from,
        to: data.range.to,
        sourceId,
      });
      const url = URL.createObjectURL(result.blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = result.filename ?? 'quotapulse-usage.csv';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
      setErr(null);
    } catch (error) {
      setErr(String(error));
    } finally {
      setExporting(false);
    }
  };
  return (
    <div className="flex flex-col gap-3.5">
      <PageHeader
        title={t('usage.title')}
        blurb={t('usage.blurb')}
        context={data ? <span data-testid="usage-range-label">{data.range.timezone} · {f.day(data.range.from)}</span> : undefined}
      />
      <UsageRangeBar
        route={route}
        onChange={updateRoute}
        sources={sources}
        actions={data ? (
          <Button size="sm" onClick={() => void exportUsage()} disabled={exporting} className="gap-1.5">
            <Download className={exporting ? 'size-3.5 animate-pulse' : 'size-3.5'} />
            {exporting ? t('usage.exporting') : t('usage.exportCsv')}
          </Button>
        ) : undefined}
      />
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
    // Only the two running totals pulse. A call count and a cache figure are tallies that
    // move on every request, so a change in them is not news; tokens are what a person opens
    // this page to watch.
    { label: t('usage.totalTokens'), value: f.tokens(total.total_tokens), icon: Activity, pulse: true },
    { label: t('usage.calls'), value: total.calls.toLocaleString(), icon: Hash, pulse: false },
    { label: t('usage.value'), value: <ValueDisplay total={total} scope={scope} label={t('usage.value')} />, icon: Coins, pulse: false },
    { label: t('usage.cacheRead'), value: f.tokens(total.cached_input_tokens), icon: Database, pulse: false },
  ];
  return (
    <Stagger className="flex flex-col gap-3.5">
      <StaggerItem>
        {/*
          Was a `Card` per figure, which made each tile a page region with no name. The tile
          is a figure with a label, not a region, and `StatTile` says so structurally -- its
          label is a label element, not a heading, so it is correctly absent from the page
          outline while the sections around it are present.
        */}
        <StatTileRow>
          {stats.map((stat) => (
            <StatTile
              key={stat.label}
              label={stat.label}
              value={stat.value}
              icon={stat.icon}
              // The raw figure, not the formatted one. See StatTile for why these are two
              // arguments rather than one.
              pulseOnChange={stat.pulse ? total.total_tokens : undefined}
            />
          ))}
        </StatTileRow>
      </StaggerItem>
      <StaggerItem>
        <Card>
          <CardHeader className="flex-col items-start gap-1">
            <CardTitle as="h2">{t('usage.timeline')}</CardTitle>
            <CardDescription data-testid="usage-range">{data.range.from === 0 ? t('usage.allTime') : `${f.day(data.range.from)} – ${f.day(data.range.to)}`}</CardDescription>
          </CardHeader>
          <CardContent>
            <TrendChart rows={data.timeline} metric="total_tokens" bucket={data.range.bucket} groupBy="none" />
          </CardContent>
        </Card>
      </StaggerItem>
      <StaggerItem>
        <Card>
          <CardHeader><CardTitle as="h2">{t('usage.byHarness')}</CardTitle></CardHeader>
          <SourceTable rows={data.bySource} empty={t('usage.noData')} scope={scope} />
        </Card>
      </StaggerItem>
    </Stagger>
  );
}
