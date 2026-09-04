import { useMemo, useState } from 'react';
import { Area, AreaChart, CartesianGrid, Tooltip, XAxis, YAxis } from 'recharts';
import type { TrendRow } from '@/api';
import { ChartContainer, type ChartConfig } from '@/components/ui/chart';
import { VendorIcon, hasVendorMark } from '@/components/vendor-icon';
import { Empty } from '@/components/primitives';
import { OTHER_LABEL, palette, vendorColor, vendorLabel } from '@/format';
import { useFormat } from '@/i18n/format';
import { useT } from '@/i18n';
import { cn } from '@/lib/utils';

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
  [seriesKey: string]: number;
}

export function TrendChart({
  rows,
  metric,
  bucket,
  groupBy,
}: {
  rows: TrendRow[];
  metric: Metric;
  bucket: 'hour' | 'day';
  groupBy: string;
}) {
  const f = useFormat();
  const t = useT();
  const [hidden, setHidden] = useState<Set<string>>(new Set());

  const { data, series, config } = useMemo(() => {
    // Rank by magnitude, then cap: distinct colours only exist for so many series, and
    // beyond that a stacked bar becomes unreadable anyway. The tail folds into `other`.
    const totals = new Map<string, number>();
    for (const r of rows) totals.set(r.series, (totals.get(r.series) ?? 0) + Number(r[metric] ?? 0));
    const ranked = [...totals.entries()].sort((a, b) => b[1] - a[1]).map(([n]) => n);
    const { colorOf, keep, hasOther } = palette(ranked);
    const bucketName = (n: string) => (keep.has(n) ? n : OTHER_LABEL);

    const names = ranked.filter((n) => keep.has(n));
    if (hasOther) names.push(OTHER_LABEL);

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
    };
  }, [rows, metric, groupBy]);

  const fmtValue = (v: number) => (metric === 'cost_usd' ? f.money(v) : f.tokens(v));
  const fmtAxisDate = (ts: number) =>
    new Date(ts).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      ...(bucket === 'hour' ? { hour: '2-digit' } : {}),
    });

  const toggle = (name: string) =>
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });

  if (rows.length === 0) return <Empty>{t('trend.empty')}</Empty>;

  const visible = series.filter((n) => !hidden.has(n));
  // One series needs no legend: the controls above already say what it is.
  const showLegend = series.length > 1;

  return (
    <div>
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
  bucket: 'hour' | 'day';
  groupBy: string;
}

/**
 * One tooltip listing every series at that point, largest first, with a total. The old
 * chart's legend showed the same numbers in a flat row where the biggest contributor was
 * no easier to find than the smallest.
 */
function TrendTooltip({ active, payload, label, config, fmtValue, bucket, groupBy }: TooltipProps) {
  const t = useT();
  if (!active || !payload?.length) return null;

  const rows = payload
    .map((p) => ({
      key: String(p.dataKey ?? ''),
      name: String(config[String(p.dataKey ?? '')]?.label ?? p.dataKey),
      value: Number(p.value ?? 0),
      color: p.color,
    }))
    .filter((r) => r.value > 0)
    .sort((a, b) => b.value - a.value);

  if (rows.length === 0) return null;
  const total = rows.reduce((a, r) => a + r.value, 0);

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
            <span className="tabular shrink-0 font-mono">{fmtValue(r.value)}</span>
          </div>
        ))}
      </div>
      {rows.length > 1 && (
        <div className="mt-1.5 flex items-center gap-2 border-t pt-1.5 text-[12px] font-semibold">
          <span className="flex-1">{t('trend.tooltipTotal')}</span>
          <span className="tabular font-mono">{fmtValue(total)}</span>
        </div>
      )}
    </div>
  );
}
