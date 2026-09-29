import { useMemo, useState } from 'react';
import { Area, AreaChart, CartesianGrid, Tooltip, XAxis, YAxis } from 'recharts';
import type { TrendRow, UsageBucket } from '@/api';
import { ChartContainer, type ChartConfig } from '@/components/ui/chart';
import { VendorIcon, hasVendorMark } from '@/components/vendor-icon';
import { Empty } from '@/components/primitives';
import { OTHER_LABEL, palette, vendorColor, vendorLabel } from '@/format';
import { useFormat } from '@/i18n/format';
import { useT } from '@/i18n';
import { cn } from '@/lib/utils';
import { chartValue, foldPricingPoints, type ValueTotal } from '@/lib/pricing';
import { ValueDisplay } from '@/components/value-display';

export type Metric = 'total_tokens' | 'cost_usd' | 'calls' | 'output_tokens';

/*
 * Linear rather than monotone/natural interpolation. These are discrete hourly or daily
 * buckets, and a spline drawn through them invents values between the points: a sharp
 * one-day spike renders as a broad smooth hump, which reads as a week of heavy use that
 * never happened. Prettier curves are not worth misreporting the shape of the data.
 */

/** Recharts needs a stable, CSS-identifier-safe key per series. */
const keyOf = (name: string) => 's_' + name.replace(/[^a-zA-Z0-9]/g, '_');

interface Point {
  ts: number;
  [seriesKey: string]: number | null;
}

export function TrendChart({
  rows,
  metric,
  bucket,
  groupBy,
}: {
  rows: TrendRow[];
  metric: Metric;
  bucket: UsageBucket;
  groupBy: string;
}) {
  const f = useFormat();
  const t = useT();
  const [hidden, setHidden] = useState<Set<string>>(new Set());

  const { data, series, config, coverage } = useMemo(() => {
    // Rank by magnitude, then cap: distinct colours only exist for so many series, and
    // beyond that a stacked bar becomes unreadable anyway. The tail folds into `other`.
    const totals = new Map<string, number>();
    for (const r of rows) totals.set(r.series, (totals.get(r.series) ?? 0) + Number(r[metric] ?? 0));
    const ranked = [...totals.entries()].sort((a, b) => b[1] - a[1]).map(([n]) => n);
    const { colorOf, keep, hasOther } = palette(ranked);
    const bucketName = (n: string) => (keep.has(n) ? n : OTHER_LABEL);

    const names = ranked.filter((n) => keep.has(n));
    if (hasOther) names.push(OTHER_LABEL);
    const coverage = foldPricingPoints(rows, n => keyOf(bucketName(n)));

    const byTs = new Map<number, Point>();
    for (const r of rows) {
      let p = byTs.get(r.bucket_ts);
      if (!p) {
        p = { ts: r.bucket_ts };
        for (const n of names) p[keyOf(n)] = 0;
        byTs.set(r.bucket_ts, p);
      }
      const k = keyOf(bucketName(r.series));
      p[k] = (p[k] ?? 0) + Number(r[metric] ?? 0);
    }
    if (metric === 'cost_usd') {
      for (const [ts, point] of byTs) for (const [key, total] of Object.entries(coverage.get(ts)!)) {
        point[key] = chartValue(total);
      }
    }

    /*
     * When the series IS the vendor, the brand colour is both more informative and
     * consistent with every other page. Any other grouping -- harness, project, model --
     * is not one-to-one with a maker, so it keeps the rank palette.
     */
    const colorFor = (n: string) =>
      groupBy === 'vendor' && n !== OTHER_LABEL ? vendorColor(n) : colorOf(n);

    const config: ChartConfig = {};
    for (const n of names) config[keyOf(n)] = { label: n, color: colorFor(n) };

    return {
      data: [...byTs.values()].sort((a, b) => a.ts - b.ts),
      series: names,
      config,
      coverage,
    };
  }, [rows, metric, groupBy]);

  const fmtValue = (v: number) => (metric === 'cost_usd' ? f.money(v) : f.tokens(v));
  /*
   * The x-axis labels in the *chosen* language.
   *
   * This one passed `undefined` as the locale, which asks Intl for the operating system's
   * -- so a Thai build on an English machine charted a year in English months, with the two
   * axes in different languages. The hourly case keeps its hour, which is the whole reason
   * this is not just `f.day`.
   */
  const fmtAxisDate = (ts: number) =>
    bucket === 'hour' ? f.clock(ts) : f.day(ts);

  const toggle = (name: string) =>
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });

  if (rows.length === 0) return <Empty>{t('trend.empty')}</Empty>;
  const unpriced = rows.reduce((n, r) => n + r.cost_unknown_calls, 0);
  const calls = rows.reduce((n, r) => n + r.calls, 0);
  if (metric === 'cost_usd' && calls > 0 && unpriced >= calls) return <div data-testid="unpriced-chart">
    <Empty>{t('pricing.unknown')}</Empty>
    <p className="text-muted-foreground text-sm">{t('pricing.coverage', { known: 0, calls, unknown: unpriced })}</p>
  </div>;

  const visible = series.filter((n) => !hidden.has(n));
  // One series needs no legend: the controls above already say what it is.
  const showLegend = series.length > 1;

  return (
    <div>
      {metric === 'cost_usd' && unpriced > 0 && <p className="text-warn mb-3 text-xs">{t('pricing.chartPartial')}</p>}
      <ChartContainer config={config} className="aspect-auto h-[320px] w-full">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 4, bottom: 0 }}>
          <defs>
            {visible.map((n) => (
              <linearGradient key={n} id={`fill-${keyOf(n)}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={`var(--color-${keyOf(n)})`} stopOpacity={0.55} />
                <stop offset="95%" stopColor={`var(--color-${keyOf(n)})`} stopOpacity={0.06} />
              </linearGradient>
            ))}
          </defs>

          <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-border/60" />
          <XAxis
            dataKey="ts"
            type="number"
            scale="time"
            domain={['dataMin', 'dataMax']}
            tickLine={false}
            axisLine={false}
            tickMargin={10}
            minTickGap={40}
            tickFormatter={fmtAxisDate}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={62}
            tickMargin={6}
            tickFormatter={(v: number) => fmtValue(v)}
          />
          <Tooltip
            filterNull={false}
            cursor={{ strokeDasharray: '3 3' }}
            content={(props) => (
              <TrendTooltip
                active={props.active}
                payload={props.payload as TooltipProps['payload']}
                label={props.label as number | undefined}
                config={config}
                fmtValue={fmtValue}
                bucket={bucket}
                groupBy={groupBy}
                costMode={metric === 'cost_usd'}
                coverage={coverage.get(Number(props.label))}
              />
            )}
          />

          {visible.map((n) => (
            <Area
              key={n}
              dataKey={keyOf(n)}
              type="linear"
              stackId="a"
              stroke={`var(--color-${keyOf(n)})`}
              fill={`url(#fill-${keyOf(n)})`}
              strokeWidth={1.5}
              isAnimationActive={false}
              connectNulls={false}
            />
          ))}
        </AreaChart>
      </ChartContainer>

      {showLegend && (
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t pt-3">
        {series.map((n) => {
          const off = hidden.has(n);
          return (
            <button
              key={n}
              onClick={() => toggle(n)}
              title={t('trend.legendHint')}
              className={cn(
                'inline-flex items-center gap-1.5 rounded px-1 py-0.5 text-[11.5px] transition-opacity',
                'hover:bg-accent/60',
                off ? 'opacity-40' : 'opacity-100',
              )}
            >
              <span
                className="size-2.5 shrink-0 rounded-[2px]"
                style={{ background: config[keyOf(n)]?.color }}
              />
              <SeriesLabel name={n} groupBy={groupBy} />
            </button>
          );
        })}
      </div>
      )}
    </div>
  );
}

/**
 * A vendor-grouped series is named by vendor, so it can carry the real brand mark. Other
 * groupings are plain text -- a project or harness has no logo to show.
 */
function SeriesLabel({ name, groupBy }: { name: string; groupBy: string }) {
  const t = useT();
  if (name === 'all') return <span>{t('trend.byNone')}</span>;
  if (groupBy === 'vendor' && hasVendorMark(name)) {
    return (
      <span className="inline-flex items-center gap-1">
        {/* mono: the colour chip beside this already carries the series mapping, and a
            brand colour next to a different series colour reads as a contradiction. */}
        <VendorIcon vendor={name} className="text-[13px]" />
        {vendorLabel(name)}
      </span>
    );
  }
  return <span>{name}</span>;
}

interface TooltipProps {
  active?: boolean;
  // Recharts hands this over readonly and loosely typed; narrow it here rather than
  // fighting the generic.
  payload?: ReadonlyArray<{ dataKey?: string | number; value?: unknown; color?: string }>;
  label?: number | string;
  config: ChartConfig;
  fmtValue: (v: number) => string;
  bucket: UsageBucket;
  groupBy: string;
  costMode: boolean;
  coverage?: Record<string, ValueTotal>;
}

/**
 * One tooltip listing every series at that point, largest first, with a total. The old
 * chart's legend showed the same numbers in a flat row where the biggest contributor was
 * no easier to find than the smallest.
 */
function TrendTooltip({ active, payload, label, config, fmtValue, bucket, groupBy, costMode, coverage }: TooltipProps) {
  const t = useT();
  if (!active || !payload?.length) return null;

  const rows = payload
    .map((p) => ({
      key: String(p.dataKey ?? ''),
      name: String(config[String(p.dataKey ?? '')]?.label ?? p.dataKey),
      value: Number(p.value ?? 0),
      color: p.color,
      pricing: coverage?.[String(p.dataKey ?? '')],
    }))
    .filter((r) => costMode ? (r.pricing?.calls ?? 0) > 0 : r.value > 0)
    .sort((a, b) => b.value - a.value);

  if (rows.length === 0) return null;
  const total = rows.reduce((a, r) => a + r.value, 0);
  const pricingTotal = rows.reduce<ValueTotal>((a, r) => ({
    calls: a.calls + (r.pricing?.calls ?? 0),
    cost_usd: (a.cost_usd ?? 0) + (r.pricing?.cost_usd ?? 0),
    cost_unknown_calls: a.cost_unknown_calls + (r.pricing?.cost_unknown_calls ?? 0),
    cost_estimated_calls: (a.cost_estimated_calls ?? 0) + (r.pricing?.cost_estimated_calls ?? 0),
  }), { calls: 0, cost_usd: 0, cost_unknown_calls: 0, cost_estimated_calls: 0 });

  const when = label
    ? new Date(Number(label)).toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        ...(bucket === 'hour' ? { hour: '2-digit', minute: '2-digit' } : {}),
      })
    : '';

  return (
    <div className="bg-popover text-popover-foreground min-w-52 rounded-lg border px-3 py-2 shadow-md">
      <div className="mb-1.5 text-[11.5px] font-medium">{when}</div>
      <div className="flex flex-col gap-1">
        {rows.map((r) => (
          <div key={r.key} className="flex items-center gap-2 text-[12px]">
            <span className="size-2 shrink-0 rounded-[2px]" style={{ background: r.color }} />
            <span className="flex min-w-0 flex-1 items-center gap-1 truncate">
              {groupBy === 'vendor' && hasVendorMark(r.name) && (
                <VendorIcon vendor={r.name} className="text-[12px]" />
              )}
              <span className="truncate">
                {r.name === 'all'
                  ? t('trend.byNone')
                  : groupBy === 'vendor'
                    ? vendorLabel(r.name)
                    : r.name}
              </span>
            </span>
            <span className="tabular font-mono">{costMode && r.pricing ? <ValueDisplay total={r.pricing} /> : fmtValue(r.value)}</span>
          </div>
        ))}
      </div>
      {rows.length > 1 && (
        <div className="mt-1.5 flex items-center gap-2 border-t pt-1.5 text-[12px] font-semibold">
          <span className="flex-1">{t('trend.tooltipTotal')}</span>
          <span className="tabular font-mono">{costMode ? <ValueDisplay total={pricingTotal} /> : fmtValue(total)}</span>
        </div>
      )}
    </div>
  );
}
