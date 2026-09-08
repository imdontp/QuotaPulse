import { useState } from 'react';
import { api, type TrendRow } from '@/api';
import { Card, CardContent } from '@/components/ui/card';
import { Select } from '@/components/ui/select';
import { ErrorBox } from '@/components/primitives';
import { TrendChart, type Metric } from '@/components/trend-chart';
import { useT } from '@/i18n';
import { useLiveRefresh } from '@/lib/use-live';

const DAY = 86_400_000;

/**
 * Above this many buckets an hourly point is under two pixels wide on any realistic
 * screen, so the extra resolution is noise that only costs render time. The request is
 * silently coarsened to daily and the UI says so rather than quietly disagreeing with
 * the control the user just set.
 */
const MAX_BUCKETS = 600;

export function TrendSection() {
  const t = useT();
  const [bucket, setBucket] = useState<'hour' | 'day'>('day');
  const [groupBy, setGroupBy] = useState('harness');
  const [metric, setMetric] = useState<Metric>('total_tokens');
  const [days, setDays] = useState(30);
  const [rows, setRows] = useState<TrendRow[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const wouldBe = bucket === 'hour' ? days * 24 : days;
  const coarsened = bucket === 'hour' && wouldBe > MAX_BUCKETS;
  const effectiveBucket: 'hour' | 'day' = coarsened ? 'day' : bucket;

  useLiveRefresh(() => {
    const to = Date.now();
    return api
      .trend({ bucket: effectiveBucket, from: to - days * DAY, to, groupBy })
      .then((r) => {
        setRows(r.rows);
        setErr(null);
        setLoaded(true);
      })
      .catch((e) => {
        setErr(String(e));
        throw e;
      });
  }, [effectiveBucket, groupBy, days]);

  return (
    <Card>
      <CardContent className="pt-4">
        <div className="mb-4 flex flex-wrap items-center gap-2.5">
          <Select label={t('trend.metric')} value={metric} onChange={(e) => setMetric(e.target.value as Metric)}>
            <option value="total_tokens">{t('trend.metricTotal')}</option>
            <option value="output_tokens">{t('trend.metricOutput')}</option>
            <option value="cost_usd">{t('trend.metricCost')}</option>
            <option value="calls">{t('trend.metricCalls')}</option>
          </Select>

          <Select label={t('trend.groupBy')} value={groupBy} onChange={(e) => setGroupBy(e.target.value)}>
            <option value="harness">{t('trend.byHarness')}</option>
            <option value="vendor">{t('trend.byVendor')}</option>
            <option value="model">{t('trend.byModel')}</option>
            <option value="project">{t('trend.byProject')}</option>
            <option value="none">{t('trend.byNone')}</option>
          </Select>

          <Select label={t('trend.bucket')} value={bucket} onChange={(e) => setBucket(e.target.value as 'hour' | 'day')}>
            <option value="hour">{t('trend.hourly')}</option>
            <option value="day">{t('trend.daily')}</option>
          </Select>

          <Select label={t('trend.range')} value={days} onChange={(e) => setDays(Number(e.target.value))}>
            <option value={1}>{t('trend.range24h')}</option>
            <option value={7}>{t('trend.range7d')}</option>
            <option value={30}>{t('trend.range30d')}</option>
            <option value={120}>{t('trend.range120d')}</option>
          </Select>

        </div>

        {err && !loaded && <ErrorBox>{err}</ErrorBox>}

        <TrendChart rows={rows} metric={metric} bucket={effectiveBucket} groupBy={groupBy} />

        {coarsened && (
          <p className="text-muted-foreground/70 mt-2.5 text-[11.5px]">
            {t('trend.coarsened', { days })}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
