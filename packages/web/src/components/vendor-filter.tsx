import { VendorIcon } from '@/components/vendor-icon';
import { vendorLabel } from '@/format';
import { useT } from '@/i18n';
import { cn } from '@/lib/utils';

export interface VendorOption {
  id: string;
  /** Secondary figure shown after the name -- models, sessions, whatever the page counts. */
  count: number;
}

/**
 * Filter chips keyed on the vendor that MADE the model, not the gateway that routed it.
 * Shared by Models and Sessions so the two pages filter by the same thing and look the
 * same doing it.
 */
export function VendorFilter({
  vendors,
  selected,
  onToggle,
  onClear,
  className,
}: {
  vendors: VendorOption[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  onClear: () => void;
  className?: string;
}) {
  const t = useT();
  if (vendors.length === 0) return null;

  const chip = (active: boolean) =>
    cn(
      'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] transition-colors',
      active
        ? 'border-foreground/25 bg-secondary text-foreground font-medium'
        : 'text-muted-foreground hover:bg-accent/60',
    );

  return (
    <div className={cn('flex flex-wrap items-center gap-1.5', className)} title={t('models.filterHint')}>
      <button onClick={onClear} aria-pressed={selected.size === 0} className={chip(selected.size === 0)}>
        {t('models.filterAll')}
      </button>
      {vendors.map((v) => (
        <button
          key={v.id}
          onClick={() => onToggle(v.id)}
          aria-pressed={selected.has(v.id)}
          className={chip(selected.has(v.id))}
        >
          <VendorIcon vendor={v.id} label={vendorLabel(v.id)} className="text-[14px]" />
          {vendorLabel(v.id)}
          <span className="text-muted-foreground/60 tabular text-[10.5px]">{v.count}</span>
        </button>
      ))}
    </div>
  );
}

/** The toggle behaviour every caller needs; kept here so it is written once. */
export function toggleIn(set: Set<string>, id: string): Set<string> {
  const next = new Set(set);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}
