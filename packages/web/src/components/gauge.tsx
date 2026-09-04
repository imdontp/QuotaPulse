import { motion } from 'motion/react';
import { Clock, TrendingUp, RotateCcw } from 'lucide-react';
import type { Limit } from '@/api';
import { FreshnessBadge } from '@/components/primitives';
import { isExpired, pct, primaryLimits, severityOf, willExhaust } from '@/format';
import { useFormat } from '@/i18n/format';
import { useT, type MessageKey } from '@/i18n';
import { cn } from '@/lib/utils';

const TONE = {
  ok: { bar: 'bg-ok', text: 'text-ok' },
  warn: { bar: 'bg-warn', text: 'text-warn' },
  crit: { bar: 'bg-crit', text: 'text-crit' },
} as const;

const WINDOW_KEY: Record<string, MessageKey> = {
  '5h': 'gauge.5h',
  weekly: 'gauge.weekly',
  weekly_opus: 'gauge.weeklyOpus',
  weekly_sonnet: 'gauge.weeklySonnet',
};

export function Gauge({ limit, now, badge }: { limit: Limit; now: number; badge?: React.ReactNode }) {
  const t = useT();
  const f = useFormat();
  const windowName = WINDOW_KEY[limit.window_kind] ? t(WINDOW_KEY[limit.window_kind]!) : limit.window_kind;
  const expired = isExpired(limit, now);
  const p = limit.used_percent;
  const tone = TONE[expired ? 'ok' : severityOf(p)];
  const burn = limit.burn;

  // A projection only matters when it lands BEFORE the window resets.
  const exhausts = willExhaust(limit, now);

  return (
    <div className={cn(expired && 'opacity-60')}>
      <div className="mb-1.5 flex items-center gap-2">
        <span className="text-muted-foreground text-[12.5px] font-medium">
          {windowName}
        </span>
        {/* The freshness badge sits WITH the window it qualifies, not on its own row:
            it is part of reading the number, not a footnote to it. */}
        {badge}
        <div className="flex-1" />
        <span className={cn('tabular font-mono text-[17px] font-semibold', expired ? 'text-muted-foreground/60' : tone.text)}>
          {expired ? '--' : pct(p)}
        </span>
      </div>

      <div className="bg-track h-1.5 overflow-hidden rounded">
        {!expired && (
          <motion.div
            className={cn('h-full rounded', tone.bar)}
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(100, Math.max(0, p ?? 0))}%` }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          />
        )}
      </div>

      <div className="text-muted-foreground/80 mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11.5px]">
        {expired ? (
          /* Showing the pre-reset number here would be the one genuinely misleading
             thing this page could do: the window has rolled over and the harness has
             not published the new one yet. */
          <span className="inline-flex items-center gap-1.5">
            <RotateCcw className="size-3" />
            {f.countdown(now, limit.resets_at ?? now) === 'now'
              ? t('gauge.windowResetJust')
              : t('gauge.windowReset', { ago: f.countdown(now, limit.resets_at ?? now) })}
            <span className="text-muted-foreground/60">
              &middot; {t('gauge.lastRead', { pct: pct(p) })}
            </span>
          </span>
        ) : (
          <>
            <span className="inline-flex items-center gap-1.5">
              <Clock className="size-3" />
              {t('gauge.resetsIn')}{' '}
              <span className="text-foreground/80 font-medium">{f.countdown(limit.resets_at, now)}</span>
              {limit.resets_at && <span className="text-muted-foreground/60">({f.clock(limit.resets_at)})</span>}
            </span>
            {burn && burn.percentPerHour > 0.05 && (
              <span className={cn('inline-flex items-center gap-1.5', exhausts && 'text-crit font-semibold')}>
                <TrendingUp className="size-3" />
                <span className="tabular font-mono">{burn.percentPerHour.toFixed(1)}%/h</span>
                {exhausts && <>&mdash; {t('gauge.hits100', { time: f.clock(burn.projectedFullAt) })}</>}
              </span>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/** A source's gauges plus whatever other origin reports the same windows. */
export function GaugeStack({
  limits,
  now,
}: {
  limits: Limit[];
  now: number;
}) {
  const t = useT();

  return (
    <div className="flex flex-col gap-4">
      {primaryLimits(limits, now).map(({ primary, superseded: others }) => {
        const kind = primary.window_kind;
        return (
          <div key={kind}>
            <Gauge
              limit={primary}
              now={now}
              badge={<FreshnessBadge seconds={primary.ageSeconds} origin={primary.origin} />}
            />
            {others.map((o) => (
              <div
                key={o.origin}
                className="text-muted-foreground/60 mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px]"
              >
                {t('gauge.alsoVia', { pct: o.used_percent == null ? '--' : `${Math.round(o.used_percent)}%` })}
                <FreshnessBadge seconds={o.ageSeconds} origin={o.origin} />
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
