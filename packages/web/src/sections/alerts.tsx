import { useState } from 'react';
import { BellRing, CheckCircle2, Clock3 } from 'lucide-react';
import { api, type AlertEvent } from '@/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Empty, ErrorBox } from '@/components/primitives';
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
  return <div className="flex flex-col gap-3.5">
    <Card>
      <CardHeader className="flex-col items-start gap-1"><CardTitle className="flex items-center gap-2"><BellRing className="text-warn size-4" />{t('alerts.historyTitle')}</CardTitle><p className="note">{t('alerts.historyBlurb')}</p></CardHeader>
      <CardContent>
        {events.length === 0 ? <Empty>{loaded ? t('alerts.noHistory') : t('app.loading')}</Empty> : <div className="divide-y rounded-xl border">{events.map((event) => <div key={event.id} className="flex items-start gap-3 px-4 py-3"><div className="mt-0.5 rounded-full bg-warn/10 p-1.5 text-warn"><BellRing className="size-3.5" /></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="text-sm font-medium">{event.subscription_display_name ?? event.display_name}</p><Badge variant={event.threshold >= 95 ? 'crit' : 'warn'}>{event.threshold}%</Badge><span className="text-muted-foreground text-xs">{event.window_kind}</span></div><p className="text-muted-foreground mt-1 text-xs">{t('alerts.historyDetail', { pct: Math.round(event.used_percent), time: f.clock(event.detected_at) })}</p></div><div className="text-muted-foreground flex shrink-0 items-center gap-1 text-[11px]">{event.delivered_at ? <><CheckCircle2 className="size-3" />{t('alerts.delivered')}</> : <><Clock3 className="size-3" />{t('alerts.detected')}</>}</div></div>)}</div>}
        {error && loaded && <p className="text-warn mt-3 text-xs">{t('alerts.refreshError')}</p>}
        <div className="mt-4 flex items-center justify-between gap-3"><p className="text-muted-foreground text-[11px]">{t('alerts.retention')}</p><Button size="sm" onClick={() => setShowAll((value) => !value)}>{showAll ? t('alerts.recent') : t('alerts.showAll')}</Button></div>
      </CardContent>
    </Card>
  </div>;
}
