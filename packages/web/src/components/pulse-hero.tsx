import { Flame, TrendingUp } from 'lucide-react';
import type { Progress } from '@/lib/progress';
import type { PulseModel } from '@/lib/live-pulse';
import { AuroraField } from '@/components/aurora-field';
import { QuotaRing } from '@/components/quota-ring';
import { FreshnessBadge } from '@/components/primitives';
import { Button } from '@/components/ui/button';
import { pct } from '@/format';
import { useFormat } from '@/i18n/format';
import { useT } from '@/i18n';
import { cn } from '@/lib/utils';

const TONE_TEXT = { ok: 'text-ok', warn: 'text-warn', crit: 'text-crit' } as const;

/**
 * The Live hero. Quota is the subject here, not a summary of it.
 *
 * The centre numeral and the breakdown beside it are the two halves of one reading, not a
 * duplicate: the big number is the answer to "how much room do I have", the rows are which
 * account and which window that answer came from. The arc is `aria-hidden` and this
 * component supplies the full text equivalent, so a screen reader hears one clean list.
 */
export function PulseHero({
  model,
  now,
  intensity,
  progress,
  onOpenLimits,
}: {
  model: PulseModel;
  now: number;
  intensity: number;
  progress: Progress;
  onOpenLimits: () => void;
}) {
  const t = useT();
  const f = useFormat();
  const primary = model.primary;

  if (!primary) {
    return (
      <section className="pulse-stage rounded-2xl border px-5 py-8" aria-label={t('pulse.eyebrow')}>
        <div className="relative text-center">
          <p className="text-muted-foreground text-sm font-medium">{t('pulse.emptyTitle')}</p>
          <p className="text-muted-foreground mt-1.5 text-xs leading-relaxed">{t('pulse.emptyDetail')}</p>
          <Button className="mt-4" onClick={onOpenLimits}>{t('quota.details')}</Button>
        </div>
      </section>
    );
  }

  const halo = `var(--${primary.tone})`;

  return (
    <section
      className="pulse-stage rounded-2xl border"
      style={{ '--pulse': intensity, '--halo': halo } as React.CSSProperties}
      aria-label={t('pulse.eyebrow')}
      data-testid="pulse-hero"
    >
      <AuroraField intensity={intensity} />

      <div className="relative px-5 pt-5 pb-6 sm:px-7 sm:pt-6">
        <header className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <p className="text-brand text-[11px] font-semibold tracking-[0.16em] uppercase">{t('pulse.eyebrow')}</p>
          <div className="flex-1" />
          <StreakChip progress={progress} />
        </header>

        <div className="mt-4 grid items-center gap-6 min-[720px]:grid-cols-[minmax(0,300px)_minmax(0,1fr)] min-[720px]:gap-8">
          {/* The ring and its numeral. Sized by width so it never overflows a 390px phone. */}
          <div className="relative mx-auto aspect-square w-full max-w-[300px]">
            <div className="pulse-halo" />
            <div className="absolute inset-0">
              <QuotaRing
                items={model.items.map((item) => ({
                  key: item.key,
                  name: item.name,
                  used: item.used,
                  expired: item.expired,
                }))}
                window={model.window ?? undefined}
              />
            </div>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-8 text-center">
              <span className="tabular text-[clamp(2.1rem,9vw,3.1rem)] leading-none font-semibold tracking-tight">
                {pct(primary.used)}
              </span>
              <span className="text-muted-foreground mt-1.5 text-[11px] tracking-wide uppercase">
                {t('quota.used')}
              </span>
              <span className="mt-2.5 max-w-[88%] truncate text-[13px] font-medium">{primary.name}</span>
              {primary.windowKind && (
                <span className="text-muted-foreground mt-0.5 text-[11px]">
                  {f.window(primary.windowKind)}
                  {primary.used != null && ` · ${t('quota.remaining', { pct: pct(100 - primary.used) })}`}
                </span>
              )}
            </div>
          </div>

          <div className="min-w-0">
            <PrimaryReadout model={model} now={now} />
            <ul aria-label={t('pulse.legend')} className="mt-5 space-y-px">
              {model.items.map((item) => (
                <li key={item.key} className="flex min-w-0 items-center gap-3 rounded-lg px-1.5 py-2">
                  <span
                    aria-hidden="true"
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ background: item.used == null ? 'var(--muted-foreground)' : `var(--${item.tone})` }}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium">{item.name}</span>
                    <span className="text-muted-foreground mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px]">
                      {item.windowKind ? f.window(item.windowKind) : t('quota.noReading')}
                      {item.resetsAt != null && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="text-brand tabular">
                            {f.countdown(item.resetsAt, now)}
                          </span>
                        </>
                      )}
                      {item.ageSeconds != null && <FreshnessBadge seconds={item.ageSeconds} />}
                    </span>
                  </span>
                  <span
                    className={cn('tabular shrink-0 font-mono text-[15px] font-semibold', TONE_TEXT[item.tone])}
                  >
                    {item.used == null ? '--' : pct(item.used)}
                  </span>
                </li>
              ))}
            </ul>
            {model.overflow > 0 && (
              <p className="text-muted-foreground mt-2 px-1.5 text-[11px]" title={t('pulse.moreTitle', { n: model.overflow })}>
                {t('pulse.more', { n: model.overflow })}
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

/** The one line that turns a percentage into a decision: how long, and how fast. */
function PrimaryReadout({ model, now }: { model: PulseModel; now: number }) {
  const t = useT();
  const f = useFormat();
  const primary = model.primary;
  if (!primary) return null;
  return (
    <div className="rounded-xl border bg-background/55 p-3.5 backdrop-blur-sm">
      <p className="flex flex-wrap items-baseline gap-x-2 text-[13px]">
        <span className="text-muted-foreground">{t('gauge.resetsIn')}</span>
        <span className="tabular text-brand font-semibold">{f.countdown(primary.resetsAt, now)}</span>
        {primary.resetsAt != null && (
          <span className="text-muted-foreground text-[11px]">({f.clock(primary.resetsAt)})</span>
        )}
      </p>
      {primary.burnRate != null && (
        <p className={cn('mt-1.5 flex items-center gap-1.5 text-[12px]', primary.urgent && 'text-crit font-semibold')}>
          <TrendingUp className="size-3.5 shrink-0" />
          <span className="tabular font-mono">
            {t('pulse.burnRate', { rate: primary.burnRate.toFixed(1) })}
          </span>
          {primary.urgent && primary.projectedFullAt != null && (
            <span>— {t('gauge.hits100', { time: f.clock(primary.projectedFullAt) })}</span>
          )}
        </p>
      )}
      {model.window?.elapsed != null && (
        <p className="text-muted-foreground mt-2 text-[11px] leading-relaxed">{t('pulse.timeTrack')}</p>
      )}
    </div>
  );
}

function StreakChip({ progress }: { progress: Progress }) {
  const t = useT();
  return (
    <div className="flex items-center gap-1.5">
      <span
        className={cn(
          'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium',
          progress.streak > 0 ? 'border-warn/30 text-warn' : 'text-muted-foreground border-border',
        )}
      >
        <Flame className="size-3 shrink-0" />
        <span className="tabular">{progress.streak}</span>
        <span className="sr-only">{t('progress.streak')}</span>
      </span>
      <span className="border-brand/30 text-brand inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold">
        <span className="text-muted-foreground">{t('progress.levelShort')}</span>
        <span className="tabular">{progress.level}</span>
      </span>
    </div>
  );
}
