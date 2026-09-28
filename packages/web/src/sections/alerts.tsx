import { useState } from 'react';
import { BellRing, CheckCircle2, Clock3 } from 'lucide-react';
import { api, type AlertEvent } from '@/api';
import { Badge } from '@/components/ui/badge';import { Button } from '@/components/ui/button';
import { Empty, ErrorBox } from '@/components/primitives';
import { PageHeader } from '@/components/page-parts';
import { Skeleton, SkeletonRegion } from '@/components/skeleton';
import { useFormat } from '@/i18n/format';
import { useT } from '@/i18n';
import { useLiveRefresh } from '@/lib/use-live';

export function AlertsSection() {
  const t = useT();
  const f = useFormat();
  const [events, setEvents] = useState<AlertEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [showAll, setShowAll] = useState(false);
  useLiveRefresh(() => api.alerts({ limit: showAll ? 500 : 100 }).then((result) => { setEvents(result.events); setError(null); setLoaded(true); }).catch((err) => { setError(String(err)); throw err; }), [showAll]);

  if (error && !loaded) return <ErrorBox>{error}</ErrorBox>;
  return (
    <div className="flex flex-col gap-3.5">
      {/*
        The topbar already carries the tab name as the page's h1, so this heading is for the
        region inside it, not a second copy of the page title. It was a `div` inside a card
        before, which left this tab with no heading element anywhere in its subtree.

        The card that used to hold the list is gone: the heading above now names this region,
        and the list draws its own border, so the card was a second border and a second
        surface wrapped around content that already had both.
      */}
      <PageHeader title={t('alerts.historyTitle')} blurb={t('alerts.historyBlurb')} />
      <div>
        {events.length === 0 ? (
            loaded ? (
              <Empty>{t('alerts.noHistory')}</Empty>
            ) : (
              // Skeleton rows rather than a centred "loading…" line, because this page is a
              // list and a list that is still arriving should look like a list arriving.
              <SkeletonRegion label={t('app.loading')}>
                <div className="divide-y rounded-xl border">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="flex items-center gap-3 px-4 py-3">
                      <Skeleton className="h-7 w-7 shrink-0 rounded-full" />
                      <Skeleton className="h-3 w-40" />
                    </div>
                  ))}
                </div>
              </SkeletonRegion>
            )
          ) : (
            <div className="divide-y rounded-xl border">
              {events.map((event) => (
                <div key={event.id} className="flex items-start gap-3 px-4 py-3">
                  <div className="bg-warn/10 text-warn mt-0.5 rounded-full p-1.5"><BellRing className="size-3.5" /></div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium">{event.subscription_display_name ?? event.display_name}</p>
                      <Badge variant={event.threshold >= 95 ? 'crit' : 'warn'}>{event.threshold}%</Badge>
                      <span className="text-muted-foreground text-xs">{event.window_kind}</span>
                    </div>
                    <p className="text-muted-foreground mt-1 text-xs">{t('alerts.historyDetail', { pct: Math.round(event.used_percent), time: f.clock(event.detected_at) })}</p>
                  </div>
                  <div className="text-muted-foreground flex shrink-0 items-center gap-1 text-[11px]">
                    {event.delivered_at
                      ? <><CheckCircle2 className="size-3" />{t('alerts.delivered')}</>
                      : <><Clock3 className="size-3" />{t('alerts.detected')}</>}
                  </div>
                </div>
              ))}
            </div>
          )}
        {error && loaded && <p className="text-warn mt-3 text-xs">{t('alerts.refreshError')}</p>}
        <div className="mt-4 flex items-center justify-between gap-3">
          <p className="text-muted-foreground text-[11px]">{t('alerts.retention')}</p>
          <Button size="sm" onClick={() => setShowAll((value) => !value)}>{showAll ? t('alerts.recent') : t('alerts.showAll')}</Button>
        </div>
      </div>
    </div>
  );
}
