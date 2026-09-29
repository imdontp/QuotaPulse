import { ChevronDown, Clock3 } from 'lucide-react';
import type { Overview } from '@/api';
import { quotaSummaries, type SubscriptionSummary } from '@/lib/quota-summary';
import { primaryReading } from '@/lib/live-pulse';
import { useI18n, useT } from '@/i18n';
import { useFormat } from '@/i18n/format';
import { isExpired, pct, severityOf, willExhaust } from '@/format';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { GaugeStack } from '@/components/gauge';
import { FreshnessBadge } from '@/components/primitives';
import { HarnessIcon } from '@/components/harness-icon';

export function SubscriptionCard({ item, now }: { item: SubscriptionSummary; now: number }) {
  const { subscription: s, limits, status } = item;
  const t = useT();
  const f = useFormat();
  // One rule, shared with the ring: a card that quoted a different window than the arc
  // above it would be two answers to the same question on one screen.
  const primary = primaryReading(limits, now);
  const valid = primary && !isExpired(primary, now) && primary.used_percent != null;
  const used = valid ? Math.min(100, Math.max(0, primary.used_percent!)) : null;
  const color = valid ? `var(--${severityOf(used)})` : 'var(--muted-foreground)';
  return <Card interactive className={`quota-card min-w-0 h-full ${status === 'attention' ? 'border-warn/35' : ''}`}>
    <CardHeader className="items-start">
      <HarnessIcon harness="unknown" vendor={s.provider} label={s.subscription_display_name} className="mt-0.5 shrink-0 text-xl" />
      <CardTitle as="h2" className="min-w-0 break-words leading-snug">{s.subscription_display_name}</CardTitle>
    </CardHeader>
    <CardContent>
      <Badge variant={status === 'available' ? 'ok' : status === 'inactive' ? 'outline' : 'warn'}>{t(`quota.${status}`)}</Badge>
      {primary && status !== 'inactive' ? <>
        <div className="my-5 flex items-center gap-5">
          <div className="relative size-28 shrink-0" role="img" aria-label={`${f.window(primary.window_kind)}: ${pct(used)} ${t('quota.used')}`}>
            <svg viewBox="0 0 112 112" className="size-full -rotate-90" aria-hidden="true">
              <circle cx="56" cy="56" r="48" fill="none" stroke="var(--track)" strokeWidth="7" />
              {used != null && <circle cx="56" cy="56" r="48" fill="none" stroke={color} strokeWidth="7" strokeLinecap="round" pathLength="100" strokeDasharray={`${used} 100`} />}
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="tabular text-[28px] font-semibold tracking-tight">{pct(used)}</span>
              <span className="text-muted-foreground text-xs">{t('quota.used')}</span>
            </div>
          </div>
          <div className="min-w-0 space-y-2">
            <p className="font-semibold">{f.window(primary.window_kind)}</p>
            <p className="text-muted-foreground text-sm">{used == null ? t('quota.noReading') : t('quota.remaining', { pct: pct(100 - used) })}</p>
            <FreshnessBadge seconds={primary.ageSeconds} />
          </div>
        </div>
        <div className="mb-5 rounded-xl bg-muted/50 p-3 text-sm">
          <p className="flex items-center gap-2"><Clock3 className="text-muted-foreground size-4 shrink-0" /><span>{t('gauge.resetsIn')} <strong>{f.countdown(primary.resets_at, now)}</strong></span></p>
          {primary.resets_at != null && <p className="text-muted-foreground mt-1 pl-6 text-xs">{f.clock(primary.resets_at)}</p>}
          {willExhaust(primary, now) && <p className="text-crit mt-2 text-xs font-medium">{t('gauge.hits100', { time: f.clock(primary.burn?.projectedFullAt) })}</p>}
        </div>
        <GaugeStack limits={limits.filter(l => l !== primary)} now={now} />
      </> : <p className="text-muted-foreground my-4 text-sm leading-relaxed">{status === 'inactive' ? t('live.subscriptionInactive') : t('quota.checkHelp')}</p>}
      {status === 'check' || s.telemetry.gap ? <p className="text-warn mt-4 text-xs leading-relaxed">{t('quota.checkHelp')}</p> : null}
      {limits.length > 0 && <details className="quota-details mt-5 border-t pt-3 text-xs text-muted-foreground">
        <summary className="cursor-pointer rounded py-1">{t('quota.readers')}</summary>
        {limits.map(l => <p key={l.window_kind} className="mt-2 break-all">{f.window(l.window_kind)} · {l.origin} · {f.age(l.ageSeconds)}</p>)}
      </details>}
    </CardContent>
  </Card>;
}

/**
 * Per-subscription quota detail, below the pulse hero.
 *
 * The marketing hero, its three count tiles and the "Next resets" list used to live here.
 * All three are gone: the counts are on the ring, the alert bell already carried them, and
 * the reset times are now in the hero's legend rows and the proportional strip. What
 * remains is the one thing the ring cannot show -- every window of every subscription, with
 * the reading detail behind a disclosure.
 *
 * Collapsed by default. The ring already answers "how much room is left" for every
 * subscription, and these cards only add the secondary windows and the raw reading
 * provenance, which is reference rather than headline. The empty state is the exception and
 * stays open: if nothing is being tracked at all, that is the one message on the page that
 * must not be hidden behind a click.
 */
export function QuotaDetails({ ov }: { ov: Overview }) {
  const { hiddenSubscriptions } = useI18n();
  const t = useT();
  const items = quotaSummaries(ov, hiddenSubscriptions);
  const active = items.filter(s => s.status !== 'inactive');
  const inactive = items.filter(s => s.status === 'inactive');
  return <div className="space-y-4">
    {items.length === 0 ? (
      <Card><CardContent className="pt-5 text-sm text-muted-foreground">{ov.subscriptions.length === 0 ? t('quota.noSubscriptions') : t('live.allSubscriptionsHidden')}</CardContent></Card>
    ) : (
      <details className="quota-details rounded-2xl border" data-testid="subscription-detail">
        <summary className="group flex cursor-pointer list-none flex-wrap items-center gap-x-2.5 gap-y-1 rounded-2xl px-4 py-3">
          <ChevronDown className="text-muted-foreground size-3.5 shrink-0 transition-transform duration-200 group-open:rotate-180" />
          <span className="text-[13px] font-semibold">{t('live.subscriptionGroup')}</span>
          <span className="text-muted-foreground text-[11.5px]">{t('quota.detailSummary', { n: items.length })}</span>
        </summary>
        <div className="space-y-4 px-3 pb-3">
          <div className="grid min-w-0 gap-5 md:grid-cols-2 xl:grid-cols-3">
            {active.map(item => <SubscriptionCard key={item.subscription.subscription_key} item={item} now={ov.now} />)}
          </div>
          {inactive.length > 0 && <details className="quota-details rounded-xl border bg-card/50 px-5 py-3">
            <summary className="cursor-pointer rounded text-sm text-muted-foreground">{t('quota.inactive')} <span className="tabular">({inactive.length})</span></summary>
            <div className="mt-4 grid gap-4 md:grid-cols-2">{inactive.map(item => <SubscriptionCard key={item.subscription.subscription_key} item={item} now={ov.now} />)}</div>
          </details>}
        </div>
      </details>
    )}
  </div>;
}
