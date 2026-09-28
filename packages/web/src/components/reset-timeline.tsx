import { useT } from '@/i18n';
import { useFormat } from '@/i18n/format';
import { useI18n } from '@/i18n';
import type { Overview } from '@/api';
import { quotaSummaries, upcomingResets } from '@/lib/quota-summary';
import { groupResets, groupWeights } from '@/lib/live-pulse';
import { FreshnessBadge } from '@/components/primitives';
import { Button } from '@/components/ui/button';
import { Clock3 } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Stops beyond this stop being legible, and beyond it the list was never the right shape. */
const MAX_STOPS = 8;

/**
 * Upcoming resets as a proportional strip rather than a list.
 *
 * The list this replaces was four rows tall and said the same thing three times over: here,
 * in the subscription card, and in the ring legend. What it had that nothing else did was
 * the *shape* of the next few hours -- three windows rolling over together reads very
 * differently from one now and one in four days, and a list of equal rows throws that away.
 *
 * Resets landing in the same minute are drawn as one stop (see `groupResets`), because with
 * rolling windows that is the common case and three identical timestamps are one event, not
 * three. The `<ol>` and its accessible name are kept deliberately: this is still an ordered
 * list of upcoming reset times, and the browser regression selects on it.
 */
export function ResetTimeline({ ov, onOpenLimits }: { ov: Overview; onOpenLimits: () => void }) {
  const { hiddenSubscriptions } = useI18n();
  const t = useT();
  const f = useFormat();

  const resets = upcomingResets(quotaSummaries(ov, hiddenSubscriptions), ov.now);
  const ordered = [...resets.slice(0, MAX_STOPS)].sort((a, b) => a.resets_at - b.resets_at);
  const groups = groupResets(ordered.map((l) => ({ at: l.resets_at })));
  const weights = groupWeights(groups.map((g) => g.at));

  return (
    <section className="px-3 py-4 sm:px-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 className="flex items-center gap-2 text-[13px] font-semibold">
          <Clock3 className="text-brand size-3.5" />
          {t('quota.next')}
        </h2>
        <Button size="sm" variant="ghost" onClick={onOpenLimits}>{t('quota.details')} →</Button>
      </div>

      {groups.length === 0 ? (
        <p className="text-muted-foreground py-4 text-sm leading-relaxed">{t('quota.noResets')}</p>
      ) : (
        /*
         * Scrolls inside its own box on a phone rather than widening the page: stops with
         * names under them need a floor width, and the document must never overflow. The
         * accessible name stays on the <ol>, because that is the element a screen reader
         * should hear as a list of reset times.
         */
        <div className="mt-3 overflow-x-auto pb-1">
          <ol
            tabIndex={0}
            aria-label={t('quota.next')}
            className="flex min-w-[30rem] items-start sm:min-w-0"
            data-testid="reset-timeline"
          >
            {groups.map((group, index) => {
              const members = ordered.filter((l) => Math.abs(l.resets_at - group.at) <= 60_000);
              // One timestamp can cover several windows of the same subscription, so the
              // names are de-duplicated: a weekly and a 5-hour window on one account are one
              // line here, not two.
              const names = [...new Set(members.map((l) => l.subscription_display_name ?? l.display_name))];
              const first = members[0];
              const last = index === groups.length - 1;
              return (
                <li key={group.at} className="min-w-0 basis-0" style={{ flexGrow: weights[index] ?? 1, flexBasis: 0 }}>
                  {/* The dot sits at the START of its column and the connector fills what is
                      left, so the gap between two dots is the width of one column. Labels
                      then sit directly under their own dot instead of drifting to the edge. */}
                  <div className="flex items-center gap-1.5">
                    <span
                      aria-hidden="true"
                      className={cn(
                        'size-2 shrink-0 rounded-full',
                        index === 0 ? 'bg-brand ring-brand/25 ring-4' : 'bg-muted-foreground/50',
                      )}
                    />
                    {!last && <span aria-hidden="true" className="bg-track h-px flex-1" />}
                  </div>
                  <div className="mt-2 pr-3">
                    <p className="text-brand tabular text-[12px] font-semibold">
                      {f.countdown(group.at, ov.now)}
                    </p>
                    <ul className="mt-1 space-y-0.5">
                      {names.slice(0, 3).map((name) => (
                        <li key={name} className="truncate text-[11.5px] leading-snug" title={name}>
                          {name}
                        </li>
                      ))}
                    </ul>
                    {names.length > 3 && (
                      <p className="text-muted-foreground mt-0.5 text-[10.5px]">
                        {t('pulse.more', { n: names.length - 3 })}
                      </p>
                    )}
                    {group.members === 1 && first && (
                      <p className="text-muted-foreground mt-1 flex flex-wrap items-center gap-x-1.5 text-[10.5px]">
                        <span>{f.window(first.window_kind)}</span>
                        {first.ageSeconds != null && <FreshnessBadge seconds={first.ageSeconds} />}
                      </p>
                    )}
                    {group.members > names.length && (
                      <p className="text-muted-foreground mt-1 text-[10.5px]">
                        {t('pulse.alsoResets', { n: group.members - names.length })}
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </section>
  );
}
