import { Database, Coins, Activity, CalendarRange } from 'lucide-react';
import type { Overview, PricingScope } from '@/api';
import { ValueDisplay } from '@/components/value-display';
import { Sparkline } from '@/components/primitives';
import { useFormat } from '@/i18n/format';
import { useT } from '@/i18n';
import { cn } from '@/lib/utils';

/**
 * The dense line of figures under the ring.
 *
 * This replaces four separate stat cards, and the reason it can is that the ring has taken
 * over the job of being the headline. What is left is reference data, so it gets laid out
 * as reference data: no card borders, no icons competing with the numerals, and one rule
 * across the top. It stays a single row on a wide screen and folds to two columns on a
 * phone rather than becoming four stacked cards.
 */
export function LiveTicker({
  ov,
  scope,
  weekSeries,
  cacheShare,
}: {
  ov: Overview;
  scope: PricingScope;
  weekSeries: number[];
  cacheShare: number;
}) {
  const t = useT();
  const f = useFormat();
  const today = ov.today;

  return (
    <section
      aria-label={t('quota.usage')}
      className="grid grid-cols-2 divide-x divide-y border-y sm:grid-cols-4 sm:divide-y-0"
    >
      <Cell
        className="order-1"
        label={t('live.valueToday')}
        testId="stat-1"
        icon={<Coins className="size-3.5" />}
        note={t('live.listPrice')}
        title={f.explain(today.cost_usd) ?? t('live.listPriceHint')}
      >
        <ValueDisplay total={today} scope={scope} label={t('live.valueToday')} />
      </Cell>

      <Cell
        className="order-2"
        label={t('live.tokensToday')}
        icon={<Activity className="size-3.5" />}
        note={t('live.apiCalls', { n: today.calls.toLocaleString() })}
      >
        <span className="tabular">{f.tokens(today.total_tokens)}</span>
      </Cell>

      <Cell
        className="order-3"
        label={t('live.tokensWeek')}
        icon={<CalendarRange className="size-3.5" />}
        note={t('live.calls', { n: ov.week.calls.toLocaleString() })}
        spark={weekSeries}
      >
        <span className="tabular">{f.tokens(ov.week.total_tokens)}</span>
      </Cell>

      <Cell
        className="order-4"
        label={t('live.cacheToday')}
        icon={<Database className="size-3.5" />}
        note={today.calls === 0 ? t('live.noInput') : t('live.cacheShare', { pct: cacheShare.toFixed(1) })}
        meter={cacheShare}
      >
        <span className="tabular">{f.tokens(today.cached_input_tokens)}</span>
      </Cell>
    </section>
  );
}

function Cell({
  label,
  note,
  icon,
  spark,
  meter,
  testId,
  title,
  className,
  children,
}: {
  label: string;
  note: string;
  icon: React.ReactNode;
  spark?: number[];
  meter?: number;
  testId?: string;
  title?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn('min-w-0 px-3 py-3.5 sm:px-4', className)} data-testid={testId}>
      <p className="text-muted-foreground flex items-center gap-1.5 text-[11px]">
        <span className="shrink-0 opacity-70">{icon}</span>
        <span className="truncate">{label}</span>
      </p>
      <p className="tabular mt-1.5 text-[22px] leading-tight font-semibold tracking-tight sm:text-[24px]">
        {children}
      </p>
      <div className="mt-1.5 flex min-h-4 items-center justify-between gap-2">
        <span className="text-muted-foreground truncate text-[11px]" title={title ?? note}>
          {note}
        </span>
        {spark && spark.length > 1 && <Sparkline points={spark} width={54} height={18} />}
      </div>
      {meter != null && (
        <div className="bg-track mt-2 h-1 overflow-hidden rounded-full">
          <div
            className="bg-ok h-full rounded-full"
            style={{ width: `${Math.min(100, Math.max(0, meter))}%` }}
          />
        </div>
      )}
    </div>
  );
}
