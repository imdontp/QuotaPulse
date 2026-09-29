import { useState } from 'react';
import { api, type MinuteTrendResponse } from '@/api';
import { useT } from '@/i18n';
import { useLiveRefresh } from '@/lib/use-live';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';

/** A chart of recorded call facts. Aggregate adapters are accounted for beside it. */
export function RecordedMinuteTrend() {
  const t = useT();
  const [snapshot, setSnapshot] = useState<MinuteTrendResponse | null>(null);
  const [error, setError] = useState(false);
  useLiveRefresh(async () => {
    try {
      const next = await api.minuteTrend();
      setSnapshot(next);
      setError(false);
    } catch (cause) {
      setError(true);
      throw cause;
    }
  }, []);
  const byMinute = new Map(snapshot?.rows.map(row => [row.bucket_ts, row.total_tokens]) ?? []);
  const bars = snapshot ? Array.from({ length: Math.floor((snapshot.to - 1) / 60000) - Math.floor(snapshot.from / 60000) + 1 }, (_, index) => {
    const ts = Math.floor(snapshot.from / 60000) * 60000 + index * 60000;
    return { ts, tokens: byMinute.get(ts) ?? 0 };
  }) : [];
  const max = Math.max(1, ...bars.map(bar => bar.tokens));
  return <Card className="min-w-0 overflow-hidden" data-testid="recorded-minute-trend">
    <CardHeader><CardTitle as="h2">{t('minute.title')}</CardTitle><span className="text-xs text-muted-foreground">{t('minute.range')}</span></CardHeader>
    <div className="px-4 pb-4">
      {error && <p role="status" className="mb-2 text-xs text-warn">{t('minute.unavailable')}{snapshot && <> · {t('minute.lastGood')}</>}</p>}
      {!snapshot ? !error && <p className="text-xs text-muted-foreground">{t('app.loading')}</p> : <>
        {snapshot.coverage.includedRecords === 0 ? <p className="py-6 text-xs text-muted-foreground">{t('minute.empty')}</p> : <>
          <div role="img" aria-label={t('minute.coverage', { calls: snapshot.coverage.includedCalls, records: snapshot.coverage.includedRecords })} className="flex h-28 items-end gap-px rounded-md border-b border-border/70" title={t('minute.title')}>
            {bars.map(bar => <span key={bar.ts} className="min-w-0 flex-1 rounded-t-sm bg-brand/70" style={{ height: `${bar.tokens ? Math.max(3, 100 * bar.tokens / max) : 0}%` }} title={`${String(new Date(bar.ts).getHours()).padStart(2, '0')}:${String(new Date(bar.ts).getMinutes()).padStart(2, '0')} · ${bar.tokens.toLocaleString()}`}/>)}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">{t('minute.coverage', { calls: snapshot.coverage.includedCalls, records: snapshot.coverage.includedRecords })}</p>
          <details className="mt-2 text-xs text-muted-foreground"><summary className="cursor-pointer">{t('minute.values')}</summary><ol className="mt-2 grid grid-cols-2 gap-1 sm:grid-cols-4">{bars.map(bar => <li key={bar.ts}>{String(new Date(bar.ts).getHours()).padStart(2, '0')}:{String(new Date(bar.ts).getMinutes()).padStart(2, '0')} · {bar.tokens.toLocaleString()}</li>)}</ol></details>
        </>}
        {snapshot.coverage.excludedRecords > 0 && <div className="mt-2 rounded-md border border-border/70 p-2 text-xs"><strong>{t('minute.excluded', { records: snapshot.coverage.excludedRecords })}</strong><p className="mt-1 text-muted-foreground">{t('minute.excludedHint')}</p><ul className="mt-1 text-muted-foreground">{snapshot.coverage.excludedSources.map(source => <li key={source.source_id}>{source.source_name}: {source.records} · {source.last_observed_tokens.toLocaleString()}</li>)}</ul></div>}
      </>}
    </div>
  </Card>;
}
