import { useMemo, type ReactNode } from 'react';
import type { ModelRow } from '@/api';
import {
  OTHER_LABEL,
  effortLabel,
  effortRank,
  palette,
  vendorLabel,
  vendorShade,
} from '@/format';
import { Legend, StackedBars, type BarMetric, type Row } from '@/components/stacked-bars';
import { VendorIcon } from '@/components/vendor-icon';
import { useT } from '@/i18n';

type LegendItem = { label: string; color: string; icon?: ReactNode };

/** Every effort level the app knows, so a shade means the same thing on every bar. */
const MAX_EFFORT_RANK = effortRank('xhigh');

type Metric = BarMetric;

/**
 * Reasoning effort only means something next to the model that ran at it: "a lot of
 * high effort" is not actionable until you know it is one model. Both blocks carry
 * the same totals, cut the two ways worth asking about.
 */
export function EffortByModel({ models, metric }: { models: ModelRow[]; metric: Metric }) {
  const t = useT();
  const { rows, legend } = useMemo(() => {
    // Rank models globally first, so colours are assigned by size and the long tail
    // collapses into one neutral bucket instead of recycling a meaningful colour.
    const totals = new Map<string, number>();
    for (const m of models) {
      const v = Number(m[metric] ?? 0);
      if (v > 0) totals.set(m.model, (totals.get(m.model) ?? 0) + v);
    }
    const ranked = [...totals.entries()].sort((a, b) => b[1] - a[1]).map(([n]) => n);
    const { colorOf, keep, hasOther } = palette(ranked);
    const bucket = (model: string) => (keep.has(model) ? model : OTHER_LABEL);

    const byEffort = new Map<string, Map<string, number>>();
    for (const m of models) {
      const v = Number(m[metric] ?? 0);
      if (v <= 0) continue;
      const e = m.effort || '';
      if (!byEffort.has(e)) byEffort.set(e, new Map());
      const inner = byEffort.get(e)!;
      const k = bucket(m.model);
      inner.set(k, (inner.get(k) ?? 0) + v);
    }

    const rows: Row[] = [...byEffort.entries()]
      .map(([effort, inner]) => {
        const segments = [...inner.entries()]
          .sort((a, b) => b[1] - a[1])
          .map(([model, value]) => ({ key: model, value, color: colorOf(model), label: model }));
        return {
          key: effort || 'none',
          label: effortLabel(effort),
          total: segments.reduce((a, s) => a + s.value, 0),
          segments,
        };
      })
      .sort((a, b) => b.total - a.total);

    /*
     * Segments here are models drawn from several makers at once, so they keep the
     * rank palette: two Claude models next to each other in one bar would become a
     * single unreadable block if both took Anthropic's colour. The maker still shows,
     * as a mark in the legend rather than as the fill.
     */
    const vendorOf = new Map(models.map((m) => [m.model, m.vendor]));
    // Typed up front: the `other` bucket below is a mix of makers and so carries no mark,
    // which an inferred element type would reject.
    const legend: LegendItem[] = ranked
      .filter((n) => keep.has(n))
      .map((n) => ({
        label: n,
        color: colorOf(n),
        icon: <VendorIcon vendor={vendorOf.get(n) ?? 'unknown'} label={vendorLabel(vendorOf.get(n) ?? '')} />,
      }));
    if (hasOther) {
      legend.push({
        // Translated, not interpolated in English: this string reaches the Thai UI too.
        label: `${OTHER_LABEL} (${t('models.nModels', { n: ranked.length - keep.size })})`,
        color: colorOf(OTHER_LABEL),
      });
    }
    return { rows, legend };
  }, [models, metric, t]);

  return (
    <>
      <StackedBars rows={rows} metric={metric} />
      <Legend items={legend} />
    </>
  );
}

export function ModelByEffort({ models, metric }: { models: ModelRow[]; metric: Metric }) {
  const t = useT();
  const { rows, legend } = useMemo(() => {
    const byModel = new Map<string, Map<string, number>>();
    const vendorOf = new Map<string, string>();
    for (const m of models) {
      vendorOf.set(m.model, m.vendor || 'unknown');
      const v = Number(m[metric] ?? 0);
      if (v <= 0) continue;
      if (!byModel.has(m.model)) byModel.set(m.model, new Map());
      const inner = byModel.get(m.model)!;
      const e = m.effort || '';
      inner.set(e, (inner.get(e) ?? 0) + v);
    }

    /*
     * Every row here is one model, so it is one maker: the bar can carry the brand
     * colour without two vendors ever meeting inside it. Effort then rides on the same
     * colour as a depth, which keeps both facts on screen -- whose model this is, and
     * how hard it was told to think.
     */
    const rows: Row[] = [...byModel.entries()]
      .map(([model, inner]) => {
        const vendor = vendorOf.get(model) ?? 'unknown';
        const segments = [...inner.entries()]
          .sort((a, b) => effortRank(a[0]) - effortRank(b[0]))
          .map(([effort, value]) => ({
            key: effort || 'none',
            value,
            color: vendorShade(vendor, effortRank(effort), MAX_EFFORT_RANK),
            label: `${model} at ${effortLabel(effort)}`,
          }));
        return {
          key: model,
          label: model,
          total: segments.reduce((a, s) => a + s.value, 0),
          segments,
          icon: <VendorIcon vendor={vendor} label={vendorLabel(vendor)} />,
        };
      })
      .sort((a, b) => b.total - a.total);

    /*
     * The legend can no longer show one swatch per effort, because effort no longer has
     * a colour of its own -- it has a depth within whichever maker's colour the row
     * already carries. So the swatches show the makers, and a note explains the depth.
     */
    const vendorsByWeight = new Map<string, number>();
    for (const r of rows) {
      const vendor = vendorOf.get(r.key) ?? 'unknown';
      vendorsByWeight.set(vendor, (vendorsByWeight.get(vendor) ?? 0) + r.total);
    }
    const legend = [...vendorsByWeight.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([vendor]) => ({
        label: vendorLabel(vendor),
        color: vendorShade(vendor, MAX_EFFORT_RANK, MAX_EFFORT_RANK),
        icon: <VendorIcon vendor={vendor} label={vendorLabel(vendor)} />,
      }));

    return { rows, legend };
  }, [models, metric]);

  /** Worth calling out: a model appearing at two effort levels is the interesting case. */
  const multiEffort = rows.filter((r) => r.segments.length > 1).map((r) => r.label);

  return (
    <>
      <StackedBars rows={rows} metric={metric} />
      <Legend items={legend} note={t('models.effortRamp')} />
      {multiEffort.length > 0 && (
        <p className="text-muted-foreground mt-3 text-[11.5px]">
          {t('models.multiEffort')}{' '}
          <span className="text-foreground font-mono">{multiEffort.join(', ')}</span>
        </p>
      )}
    </>
  );
}
