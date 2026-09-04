import type { ReactNode } from 'react';
import { motion } from 'motion/react';
import { Hint } from '@/components/ui/tooltip';
import { Empty } from '@/components/primitives';
import { useFormat } from '@/i18n/format';
import { tokens } from '@/format';
import { cn } from '@/lib/utils';

export type BarMetric = 'total_tokens' | 'cost_usd' | 'calls';

export interface Segment {
  key: string;
  value: number;
  color: string;
  label: string;
}

export interface Row {
  key: string;
  label: string;
  total: number;
  segments: Segment[];
  /**
   * The maker's mark, shown before the label. A stacked bar names a model or a project,
   * and the logo is how you find the row you want without reading twenty of them; the
   * detail tables have carried one for a while, and the bars were the gap.
   */
  icon?: ReactNode;
  /**
   * Overrides the rendered total. Money is the reason: a row whose every call ran on a
   * model with no published price is not worth zero, it is unknown, and must read as a
   * dash rather than as the cheapest row on the chart.
   */
  display?: string;
}

/**
 * Formats a bar value in the metric's own unit.
 *
 * Money goes through the shared formatter rather than a local `$` template. It used to
 * be the latter, which meant that with the display currency set to THB the Models bars
 * and their tooltips showed dollar signs while every other number on the page showed
 * baht.
 */
export function useBarFormat(metric: BarMetric): (v: number) => string {
  const f = useFormat();
  return (v: number) =>
    metric === 'cost_usd' ? f.money(v) : metric === 'calls' ? v.toLocaleString() : tokens(v);
}

/**
 * One stacked bar per group, ranked. Shared by the effort views and the project
 * breakdown, which is what makes those pages read as one idea seen from several sides.
 *
 * Pass `onSelect` to make the rows a picker; without it they are inert, and neither the
 * cursor nor the roles suggest otherwise.
 */
export function StackedBars({
  rows,
  metric,
  onSelect,
  selectedKey,
  empty,
}: {
  rows: Row[];
  metric: BarMetric;
  onSelect?: (key: string) => void;
  selectedKey?: string | null;
  empty?: string;
}) {
  const fmt = useBarFormat(metric);
  const max = Math.max(1, ...rows.map((r) => r.total));
  if (rows.length === 0) return <Empty>{empty ?? 'no data'}</Empty>;

  return (
    <div className="flex flex-col gap-2">
      {rows.map((row, i) => {
        const selected = selectedKey === row.key;
        const body = (
          <>
            <div
              className={cn(
                'flex w-52 shrink-0 items-center justify-end gap-1.5 truncate text-right text-[12.5px]',
                selected ? 'text-foreground font-medium' : 'text-foreground',
              )}
              title={row.label}
            >
              {row.icon && (
                <span className="text-muted-foreground shrink-0 text-[14px]">{row.icon}</span>
              )}
              <span className="truncate">{row.label}</span>
            </div>

            <div className="bg-track relative h-6 flex-1 overflow-hidden rounded-[5px]">
              <motion.div
                className="flex h-full"
                initial={{ width: 0 }}
                animate={{ width: `${(row.total / max) * 100}%` }}
                transition={{ duration: 0.6, delay: i * 0.03, ease: [0.22, 1, 0.36, 1] }}
              >
                {row.segments.map((s) => (
                  <Hint
                    key={s.key}
                    text={
                      <span>
                        <strong>{s.label}</strong>
                        <br />
                        {fmt(s.value)} &middot; {((s.value / row.total) * 100).toFixed(1)}% of{' '}
                        {row.label}
                      </span>
                    }
                  >
                    <div
                      className="h-full cursor-default transition-opacity hover:opacity-80"
                      style={{ width: `${(s.value / row.total) * 100}%`, background: s.color }}
                    />
                  </Hint>
                ))}
              </motion.div>
            </div>

            <div className="tabular w-20 shrink-0 text-right font-mono text-[12.5px]">
              {row.display ?? fmt(row.total)}
            </div>
          </>
        );

        return onSelect ? (
          <button
            key={row.key}
            type="button"
            onClick={() => onSelect(row.key)}
            aria-pressed={selected}
            className={cn(
              'flex w-full items-center gap-3 rounded-md px-1.5 py-1 text-left transition-colors',
              'hover:bg-muted/60 focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none',
              selected && 'bg-muted',
            )}
          >
            {body}
          </button>
        ) : (
          <div key={row.key} className="flex items-center gap-3 px-1.5 py-1">
            {body}
          </div>
        );
      })}
    </div>
  );
}

export const Legend = ({
  items,
  note,
}: {
  items: Array<{ label: string; color: string; icon?: ReactNode }>;
  /** Explains what the colours mean when the swatches alone do not say it. */
  note?: string;
}) => (
  <div className="mt-4 border-t pt-3.5">
    <div className="flex flex-wrap gap-x-3.5 gap-y-2">
      {items.map((it) => (
        <span
          key={it.label}
          className="text-muted-foreground inline-flex items-center gap-1.5 text-[11.5px]"
        >
          <span className="size-2.5 shrink-0 rounded-[2px]" style={{ background: it.color }} />
          {it.icon && <span className="shrink-0 text-[13px]">{it.icon}</span>}
          {it.label}
        </span>
      ))}
    </div>
    {note && <p className="text-muted-foreground/70 mt-2.5 text-[11px]">{note}</p>}
  </div>
);
