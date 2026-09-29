import { useEffect, useState } from 'react';
import { api, type Overview as OverviewData, type QuotaHistoryResponse } from '@/api';
import { isExpired, primaryLimits } from '@/format';
import { useI18n, useT } from '@/i18n';
import { useLiveRefresh } from '@/lib/use-live';
import { useTheme } from '@/lib/use-theme';
import { Overview } from './overview';
import type { ActivityItem } from './overview';
import { defaultQuota, type QuotaWindow, type RuntimeGraph } from './model';

export function ProductionOverview() {
  const t = useT();
  const { lang, setLang, currency, rate } = useI18n();
  const [theme, toggleTheme] = useTheme();
  const [snapshot, setSnapshot] = useState<{ overview: OverviewData; graph: RuntimeGraph; recent: ActivityItem[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedQuotaId, setSelectedQuotaId] = useState<string | null>(null);
  const [history, setHistory] = useState<QuotaHistoryResponse | null>(null);
  const [historyError, setHistoryError] = useState(false);
  useLiveRefresh(async () => {
    try {
      const overview = await api.overview();
      const start = new Date(overview.now);
      start.setHours(0, 0, 0, 0);
      const scope = { from: start.getTime(), to: overview.now + 1 };
      const [graph, usage] = await Promise.all([api.runtimeMap(scope), api.usageEvents(scope, { limit: 4, offset: 0 })]);
      const recent: ActivityItem[] = usage.rows.map(row => ({ id: row.event_id, timestamp: row.timestamp_ms, harness: row.harness, provider: row.provider, model: row.model, tokens: row.total_tokens, grain: row.grain, sessionKey: row.session_key }));
      setSnapshot({ overview, graph, recent });
      setError(null);
    } catch (cause) {
      setError(String(cause));
      throw cause;
    }
  }, []);
  const overview = snapshot?.overview;
  const selected = overview ? primaryLimits(overview.limits, overview.now).map(({ primary }) => primary) : [];
  const quotas: QuotaWindow[] = selected.filter(limit => {
    const key = limit.subscription_key ?? limit.account_key;
    const subscription = overview!.subscriptions.find(item => item.subscription_key === key);
    return !subscription || (subscription.state !== 'inactive' && !overview!.settings.hidden_subscriptions.includes(subscription.subscription_key));
  }).map(limit => {
    const key = limit.subscription_key ?? limit.account_key;
    const subscription = overview!.subscriptions.find(item => item.subscription_key === key);
    // The subscription rollup may describe another origin. Core freshness belongs to
    // this selected reading, using the same expiry rule as primaryLimits.
    const freshness = limit.last_seen_at > overview!.now ? 'unknown'
      : isExpired(limit, overview!.now) ? 'expired'
        : overview!.now - limit.last_seen_at < 120000 ? 'live'
          : overview!.now - limit.last_seen_at < 3600000 ? 'recent' : 'stale';
    return {
      id: JSON.stringify([key ?? `source:${limit.source_id}`, limit.window_kind]),
      ownerKey: key ?? `source:${limit.source_id}`,
      sourceId: limit.source_id,
      origin: limit.origin,
      owner: limit.subscription_display_name ?? limit.account_display_name ?? limit.display_name,
      window: limit.window_kind,
      usedPercent: limit.used_percent,
      observedAt: limit.observed_at,
      confirmedAt: limit.last_seen_at,
      resetAt: limit.resets_at ?? 0,
      freshness,
      projectedFullAt: limit.forecast?.status === 'ready' ? limit.forecast.projectedFullAt : null,
      forecastStatus: limit.forecast?.status,
    };
  });
  const activeQuota = quotas.find(quota => quota.id === selectedQuotaId) ?? defaultQuota(quotas, Date.now(), 3600000);
  useEffect(() => {
    const ownerKey = activeQuota?.ownerKey;
    const windowKind = activeQuota?.window;
    if (!ownerKey || !windowKind || !overview) { setHistory(null); return; }
    let current = true;
    setHistory(previous => previous && previous.subscriptionKey === ownerKey && previous.windowKind === windowKind ? previous : null);
    setHistoryError(false);
    void api.quotaHistory({ subscriptionKey: ownerKey, windowKind }).then(result => {
      if (current) setHistory(result);
    }).catch(() => { if (current) setHistoryError(true); });
    return () => { current = false; };
  }, [activeQuota?.id, overview?.now]);
  if (!snapshot) return <main className="p-6" role="status">{error ?? t('app.loading')}</main>;
  const { graph, recent } = snapshot;
  return <>
    {error && <p role="status" className="bg-warn/10 p-2 text-center text-xs text-warn">{t('redesign.staleSnapshot')}</p>}
    <Overview graph={graph} quotas={quotas} recent={recent} now={Date.now()} t={t} language={lang} onLanguage={() => setLang(lang === 'en' ? 'th' : 'en')} theme={theme} onTheme={toggleTheme} currency={currency} rate={rate} onQuotaSelect={setSelectedQuotaId} quotaHistory={history && history.subscriptionKey === activeQuota?.ownerKey && history.windowKind === activeQuota.window && (!history.reader || (history.reader.sourceId === activeQuota.sourceId && history.reader.origin === activeQuota.origin)) ? history : null} quotaHistoryError={historyError}/>
  </>;
}
