import { useState } from 'react';
import type { Overview, PricingScope } from '@/api';
import { api } from '@/api';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { useFormat } from '@/i18n/format';
import { useI18n, useT } from '@/i18n';
import { useLiveRefresh } from '@/lib/use-live';
import { statSeries } from '@/lib/quota-summary';
import { QuotaDetails } from '@/components/quota-overview';
import { SourceTable } from '@/components/source-table';
import { DataHealthDisclosure } from '@/components/data-status';
import { PulseHero } from '@/components/pulse-hero';
import { LiveTicker } from '@/components/live-ticker';
import { ProgressionRail } from '@/components/progression-rail';
import { ResetTimeline } from '@/components/reset-timeline';
import { RecordedMinuteTrend } from '@/components/recorded-minute-trend';
import { intensityOf, pulseModel, recentRate } from '@/lib/live-pulse';
import { firstActivityHour } from '@/lib/progress';
import { useProgress } from '@/lib/progress-store';

/**
 * 30 days of daily buckets, not 7.
 *
 * The streak and the 30-day badge need month-scale history, and the week sparkline is
 * simply the last seven points of the same series -- a second, narrower query would return
 * the same numbers and cost another round trip on every SSE push.
 */
const STREAK_DAYS = 30;

function useStatSeries() {
  const [series, setSeries] = useState({ tokens: [] as number[], cost: [] as number[], week: [] as number[] });
  useLiveRefresh(async () => {
    const to = Date.now();
    const midnight = new Date(to); midnight.setHours(0, 0, 0, 0);
    const from = midnight.getTime();
    const daysFrom = to - STREAK_DAYS * 86_400_000;
    const weekFrom = to - 7 * 86_400_000;
    const [today, days] = await Promise.all([
      api.trend({ bucket: 'hour', from, to, groupBy: 'none' }),
      api.trend({ bucket: 'day', from: daysFrom, to, groupBy: 'none' }),
    ]);
    setSeries({
      tokens: statSeries(today.rows, from, to, 'hour', 'total_tokens'),
      cost: statSeries(today.rows, from, to, 'hour', 'cost_usd'),
      week: statSeries(days.rows, weekFrom, to, 'day', 'total_tokens'),
    });
  }, []);
  return series;
}

export function LiveSection({ ov, onOpenLimits, onOpenHealth, onOpenCost }: { ov: Overview; onOpenLimits: () => void; onOpenHealth?: () => void; onOpenCost?: () => void }) {
  const t = useT();
  const f = useFormat();
  const { hiddenSubscriptions } = useI18n();
  const spark = useStatSeries();
  const today = ov.today;
  const midnight = new Date(ov.now); midnight.setHours(0, 0, 0, 0);
  const pricingScope = { from: midnight.getTime(), to: ov.now };
  const cacheTotal = today.cached_input_tokens + today.input_tokens + today.cache_write_tokens;
  const cacheShare = cacheTotal > 0 ? Number((today.cached_input_tokens / cacheTotal * 100).toFixed(1)) : 0;

  const model = pulseModel(ov, hiddenSubscriptions);
  // Real measured throughput, so a quiet afternoon looks quiet instead of merely un-updated.
  const intensity = intensityOf(recentRate(spark.tokens));
  const progress = useProgress(ov, firstActivityHour(spark.tokens));

  /*
   * Order is the argument: quota first, then the figures that qualify it, then the
   * per-window reference, then collection health last. Live used to open with four
   * diagnostic cards and a "what needs your attention" panel before showing a single
   * percentage -- and the panel's items were largely things the ring and the alert bell
   * had already said.
   */
  return <div className="space-y-5">
    <PulseHero model={model} now={ov.now} intensity={intensity} progress={progress} onOpenLimits={onOpenLimits} />
    <RecordedMinuteTrend />
    <ProgressionRail progress={progress} />
    <LiveTicker ov={ov} scope={pricingScope} weekSeries={spark.week} cacheShare={cacheShare} />
    <Card className="min-w-0 overflow-hidden py-0">
      <ResetTimeline ov={ov} onOpenLimits={onOpenLimits} />
    </Card>
    <QuotaDetails ov={ov} />
    <Card className="min-w-0"><CardHeader><CardTitle as="h2">{t('live.activityToday')}</CardTitle><span className="text-muted-foreground text-xs">{t('live.byHarness')}</span></CardHeader><SourceTable rows={ov.bySourceToday} empty={t('live.noActivity')} scope={pricingScope} /></Card>
    <DataHealthDisclosure ov={ov} onOpenLimits={onOpenLimits} onOpenHealth={onOpenHealth ?? onOpenLimits} onOpenCost={onOpenCost ?? onOpenLimits} />
  </div>;
}
