import { useMemo, useState } from 'react';
import { api, type ModelRow, type UsagePeriod } from '@/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { EffortByModel, ModelByEffort } from '@/components/effort-breakdown';
import { VendorIcon } from '@/components/vendor-icon';
import { VendorFilter, toggleIn } from '@/components/vendor-filter';
import { Empty, ErrorBox, Stagger, StaggerItem } from '@/components/primitives';
import { effortColor, vendorLabel } from '@/format';
import { useFormat } from '@/i18n/format';
import { useT } from '@/i18n';
import { useLiveRefresh } from '@/lib/use-live';
import { cn } from '@/lib/utils';
import { ValueDisplay } from '@/components/value-display';

type Metric = 'total_tokens' | 'cost_usd' | 'calls';

export function ModelsSection({ period, sourceId }: { period?: UsagePeriod; sourceId?: number }) {
  const t = useT();
  const f = useFormat();
  const [models, setModels] = useState<ModelRow[]>([]);
  const [metric, setMetric] = useState<Metric>('total_tokens');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loaded, setLoaded] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useLiveRefresh(() => {
    return api
      .models(period ? { from: period.from, to: period.to, sourceId } : 0)
      .then((r) => {
        setModels(r.models);
        setLoaded(true);
        setErr(null);
      })
      .catch((error) => {
        setErr(String(error));
        throw error;
      });
  }, [period?.from, period?.to, sourceId]);

  /**
   * Vendors as the server derived them: who MADE the model, not which gateway routed it.
   * Filtering on the raw `provider` column would offer no DeepSeek at all -- its models
   * arrive tagged `opencode`.
   */
  const vendors = useMemo(() => {
    const agg = new Map<string, { tokens: number; models: Set<string> }>();
    for (const m of models) {
      const v = m.vendor || 'unknown';
      const cur = agg.get(v) ?? { tokens: 0, models: new Set<string>() };
      cur.tokens += m.total_tokens;
      cur.models.add(m.model);
      agg.set(v, cur);
    }
    return [...agg.entries()]
      .map(([id, v]) => ({ id, tokens: v.tokens, count: v.models.size }))
      .sort((a, b) => b.tokens - a.tokens);
  }, [models]);

  const filtered = useMemo(
    () => (selected.size === 0 ? models : models.filter((m) => selected.has(m.vendor || 'unknown'))),
    [models, selected],
  );

  const totalCalls = useMemo(() => filtered.reduce((a, m) => a + m.calls, 0), [filtered]);
  const sorted = useMemo(
    () => [...filtered].sort((a, b) => b.total_tokens - a.total_tokens),
    [filtered],
  );

  if (err && !loaded) return <ErrorBox>{err}</ErrorBox>;
  if (loaded && models.length === 0) return <Empty>{t('models.none')}</Empty>;

  return (
    <Stagger className="flex flex-col gap-3.5">
      <StaggerItem>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-[15px] font-semibold tracking-tight">{t('models.title')}</h2>
            <p className="text-muted-foreground note mt-1 text-[12.5px] leading-relaxed">
              {t('models.blurb')}
            </p>
          </div>
          <div className="flex items-center gap-2.5">
            <span className="text-muted-foreground/70 text-[11.5px]">
              {t('live.calls', { n: totalCalls.toLocaleString() })}
            </span>
            <Select
              label={t('models.measure')}
              value={metric}
              onChange={(e) => setMetric(e.target.value as Metric)}
            >
              <option value="total_tokens">{t('trend.metricTotal')}</option>
              <option value="cost_usd">{t('trend.metricCost')}</option>
              <option value="calls">{t('trend.metricCalls')}</option>
            </Select>
          </div>
        </div>
      </StaggerItem>

      <StaggerItem>
        <VendorFilter
          vendors={vendors}
          selected={selected}
          onToggle={(id) => setSelected(toggleIn(selected, id))}
          onClear={() => setSelected(new Set())}
        />
      </StaggerItem>

      {filtered.length === 0 ? (
        <Empty>{t('models.noneMatch')}</Empty>
      ) : (
        <>
          <StaggerItem>
            <Card>
              <CardHeader className="flex-col items-start gap-1">
                <CardTitle>{t('models.effortByModel')}</CardTitle>
                <CardDescription>{t('models.effortByModelBlurb')}</CardDescription>
              </CardHeader>
              <CardContent>
                <EffortByModel models={filtered} metric={metric} />
              </CardContent>
            </Card>
          </StaggerItem>

          <StaggerItem>
            <Card>
              <CardHeader className="flex-col items-start gap-1">
                <CardTitle>{t('models.modelByEffort')}</CardTitle>
                <CardDescription>{t('models.modelByEffortBlurb')}</CardDescription>
              </CardHeader>
              <CardContent>
                <ModelByEffort models={filtered} metric={metric} />
              </CardContent>
            </Card>
          </StaggerItem>

          <StaggerItem>
            <Card>
              <CardHeader>
                <CardTitle>{t('models.detail')}</CardTitle>
              </CardHeader>
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>{t('col.model')}</TableHead>
                    <TableHead>{t('col.effort')}</TableHead>
                    <TableHead>{t('col.harness')}</TableHead>
                    <TableHead className="text-right">{t('col.calls')}</TableHead>
                    <TableHead className="text-right">{t('col.freshIn')}</TableHead>
                    <TableHead className="text-right">{t('col.cacheRead')}</TableHead>
                    <TableHead className="text-right">{t('col.output')}</TableHead>
                    <TableHead className="text-right">{t('col.reasoning')}</TableHead>
                    <TableHead className="text-right">{t('col.total')}</TableHead>
                    <TableHead className="text-right">{t('col.value')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sorted.map((m, i) => (
                    <TableRow key={`${m.model}-${m.harness}-${m.effort}-${i}`}>
                      <TableCell>
                        <span className="inline-flex items-center gap-2">
                          <VendorIcon
                            vendor={m.vendor}
                            label={vendorLabel(m.vendor)}
                            className="text-muted-foreground text-[15px]"
                          />
                          <span className="font-mono">{m.model}</span>
                        </span>
                      </TableCell>
                      <TableCell>
                        {/*
                          The ordinal ramp, not a vendor shade. In the bars above, effort
                          is a depth within the maker's colour because the bar already
                          says whose model it is. A badge in a cell has no such context,
                          so here effort keeps a scale of its own.
                        */}
                        <Badge
                          style={{
                            borderColor: `color-mix(in oklab, ${effortColor(m.effort)} 40%, transparent)`,
                            background: `color-mix(in oklab, ${effortColor(m.effort)} 14%, transparent)`,
                            color: effortColor(m.effort),
                          }}
                        >
                          {m.effort || t('models.effortNone')}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{m.harness}</TableCell>
                      <TableCell className="tabular text-right font-mono">
                        {m.calls.toLocaleString()}
                      </TableCell>
                      <TableCell className="tabular text-muted-foreground text-right font-mono">
                        {f.tokens(m.input_tokens)}
                      </TableCell>
                      <TableCell className="tabular text-muted-foreground text-right font-mono">
                        {f.tokens(m.cached_input_tokens)}
                      </TableCell>
                      <TableCell className="tabular text-muted-foreground text-right font-mono">
                        {f.tokens(m.output_tokens)}
                      </TableCell>
                      <TableCell className="tabular text-muted-foreground text-right font-mono">
                        {m.reasoning_tokens > 0 ? f.tokens(m.reasoning_tokens) : '--'}
                      </TableCell>
                      <TableCell className="tabular text-right font-mono">
                        {f.tokens(m.total_tokens)}
                      </TableCell>
                      <TableCell className="tabular text-right font-mono">
                        <ValueDisplay total={m} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </StaggerItem>
        </>
      )}
    </Stagger>
  );
}
