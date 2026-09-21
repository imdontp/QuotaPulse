import { ArrowUpRight, Clock3, ShieldCheck, TriangleAlert, Radio } from 'lucide-react';
import type { Overview } from '@/api';
import { quotaSummaries, upcomingResets, type SubscriptionSummary } from '@/lib/quota-summary';
import { useI18n, useT } from '@/i18n';
import { useFormat } from '@/i18n/format';
import { isExpired, pct, severityOf, thresholdLimits, willExhaust } from '@/format';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { GaugeStack } from '@/components/gauge';
import { FreshnessBadge } from '@/components/primitives';
import { HarnessIcon } from '@/components/harness-icon';

export function SubscriptionCard({ item, now }: { item: SubscriptionSummary; now: number }) {
  const { subscription: s, limits, status } = item;
  const t = useT();
  const f = useFormat();
  const primary = limits.find(l => willExhaust(l, now)) ?? thresholdLimits(limits, now)[0] ?? limits[0];
  const valid = primary && !isExpired(primary, now) && primary.used_percent != null;
  const used = valid ? Math.min(100, Math.max(0, primary.used_percent!)) : null;
  const color = valid ? `var(--${severityOf(used)})` : 'var(--muted-foreground)';
  return <Card className={`quota-card min-w-0 h-full ${status === 'attention' ? 'border-warn/35' : ''}`}>
    <CardHeader className="items-start">
      <HarnessIcon harness="unknown" vendor={s.provider} label={s.subscription_display_name} className="mt-0.5 shrink-0 text-xl" />
      <CardTitle className="min-w-0 break-words leading-snug">{s.subscription_display_name}</CardTitle>
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

export function QuotaOverview({ ov, onOpenLimits }: { ov: Overview; onOpenLimits: () => void }) {
  const { hiddenSubscriptions } = useI18n();
  const t = useT();
  const f = useFormat();
  const items = quotaSummaries(ov, hiddenSubscriptions);
  const active = items.filter(s => s.status !== 'inactive');
  const inactive = items.filter(s => s.status === 'inactive');
  const resets = upcomingResets(items, ov.now).slice(0, 5);
  const metrics = [
    { status: 'attention', icon: TriangleAlert, tone: 'text-warn' },
    { status: 'available', icon: ShieldCheck, tone: 'text-ok' },
    { status: 'check', icon: Radio, tone: 'text-muted-foreground' },
  ] as const;
  return <div className="space-y-6">
    <div className="grid gap-5 xl:grid-cols-3">
      <Card className="quota-hero min-w-0 xl:col-span-2">
        <CardContent className="relative p-5 sm:p-6">
          <p className="text-brand text-xs font-semibold tracking-[0.14em]">{t('quota.eyebrow')}</p>
          <h2 className="mt-3 text-2xl leading-tight font-semibold tracking-tight sm:text-3xl">{t('quota.title')}</h2>
          <p className="text-muted-foreground mt-2 max-w-lg text-sm leading-relaxed">{t('quota.blurb')}</p>
          <div className="mt-5 grid grid-cols-3 gap-2 sm:gap-3">
            {metrics.map(({ status, icon: Icon, tone }) => <div key={status} className="min-w-0 rounded-xl border border-border/70 bg-background/50 p-3 sm:p-4">
              <Icon className={`mb-3 size-4 ${tone}`} />
              <p className="tabular text-3xl font-semibold">{items.filter(s => s.status === status).length}</p>
              <p className={`mt-1 text-xs leading-relaxed ${tone}`}>{t(`quota.${status}`)}</p>
            </div>)}
          </div>
          <Button className="mt-5 gap-2" onClick={onOpenLimits}>{t('quota.details')}<ArrowUpRight className="size-4" /></Button>
        </CardContent>
      </Card>
      <Card className="min-w-0">
        <CardHeader><Clock3 className="text-brand size-4" /><CardTitle>{t('quota.next')}</CardTitle></CardHeader>
        <CardContent>
          <p className="text-muted-foreground mb-4 text-xs">{t('quota.nextHelp')}</p>
          {resets.length === 0 ? <p className="text-muted-foreground py-6 text-sm leading-relaxed">{t('quota.noResets')}</p> : <ol tabIndex={0} aria-label={t('quota.next')} className="max-h-64 overflow-y-auto divide-y pr-1">
            {resets.map(l => <li key={`${l.subscription_key ?? l.account_key}-${l.window_kind}`} className="py-3 first:pt-0">
              <div className="flex items-start justify-between gap-3">
                <p className="min-w-0 text-sm font-medium leading-snug">{l.subscription_display_name ?? l.display_name}</p>
                <span className="text-brand tabular shrink-0 text-sm font-semibold">{f.countdown(l.resets_at, ov.now)}</span>
              </div>
              <div className="text-muted-foreground mt-1.5 flex flex-wrap items-center gap-2 text-xs"><span>{f.window(l.window_kind)} · {f.clock(l.resets_at)}</span><FreshnessBadge seconds={l.ageSeconds} /></div>
            </li>)}
          </ol>}
          <button onClick={onOpenLimits} className="text-brand mt-4 rounded text-sm font-medium">{t('quota.details')} →</button>
        </CardContent>
      </Card>
    </div>
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <h2 className="text-lg font-semibold">{t('live.subscriptionGroup')}</h2>
      <p className="text-muted-foreground text-xs">{t('quota.availableHelp')}</p>
    </div>
    {items.length === 0 && <Card><CardContent className="pt-5 text-sm text-muted-foreground">{ov.subscriptions.length === 0 ? t('quota.noSubscriptions') : t('live.allSubscriptionsHidden')}</CardContent></Card>}
    <div className="grid min-w-0 gap-5 md:grid-cols-2 xl:grid-cols-3">
      {active.map(item => <SubscriptionCard key={item.subscription.subscription_key} item={item} now={ov.now} />)}
    </div>
    {inactive.length > 0 && <details className="quota-details rounded-xl border bg-card/50 px-5 py-3">
      <summary className="cursor-pointer rounded text-sm text-muted-foreground">{t('quota.inactive')} <span className="tabular">({inactive.length})</span></summary>
      <div className="mt-4 grid gap-4 md:grid-cols-2">{inactive.map(item => <SubscriptionCard key={item.subscription.subscription_key} item={item} now={ov.now} />)}</div>
    </details>}
  </div>;
}
