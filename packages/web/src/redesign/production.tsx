import { useState } from 'react';
import { api, type Overview as OverviewData } from '@/api';
import { primaryLimits } from '@/format';
import { useI18n, useT } from '@/i18n';
import { useLiveRefresh } from '@/lib/use-live';
import { useTheme } from '@/lib/use-theme';
import { Overview } from './overview';
import type { QuotaWindow, RuntimeGraph } from './model';

export function ProductionOverview() {
  const t = useT();
  const { lang, setLang, currency, rate } = useI18n();
  const [theme, toggleTheme] = useTheme();
  const [snapshot, setSnapshot] = useState<{ overview: OverviewData; graph: RuntimeGraph } | null>(null);
  const [error, setError] = useState<string | null>(null);
  useLiveRefresh(async () => {
    try {
      const overview = await api.overview();
      const start = new Date(overview.now);
      start.setHours(0, 0, 0, 0);
      const graph = await api.runtimeMap({ from: start.getTime(), to: overview.now + 1 });
      setSnapshot({ overview, graph });
      setError(null);
    } catch (cause) {
      setError(String(cause));
      throw cause;
    }
  }, []);
  if (!snapshot) return <main className="p-6" role="status">{error ?? t('app.loading')}</main>;
  const { overview, graph } = snapshot;
  const selected = primaryLimits(overview.limits, overview.now).map(({ primary }) => primary);
  const quotas: QuotaWindow[] = selected.filter(limit => {
    const key = limit.subscription_key ?? limit.account_key;
    const subscription = overview.subscriptions.find(item => item.subscription_key === key);
    return !subscription || (subscription.state !== 'inactive' && !overview.settings.hidden_subscriptions.includes(subscription.subscription_key));
  }).map(limit => {
    const key = limit.subscription_key ?? limit.account_key;
    const subscription = overview.subscriptions.find(item => item.subscription_key === key);
    const freshness = subscription?.telemetry.windows.find(window => window.window_kind === limit.window_kind)?.freshness
      ?? subscription?.telemetry.freshness;
    return {
      id: JSON.stringify([key ?? `source:${limit.source_id}`, limit.window_kind]),
      owner: limit.subscription_display_name ?? limit.account_display_name ?? limit.display_name,
      window: limit.window_kind,
      usedPercent: limit.used_percent,
      observedAt: limit.observed_at,
      confirmedAt: limit.last_seen_at,
      resetAt: limit.resets_at ?? 0,
      freshness,
      projectedFullAt: limit.forecast?.status === 'ready' ? limit.forecast.projectedFullAt : null,
    };
  });
  return <>
    {error && <p role="status" className="bg-warn/10 p-2 text-center text-xs text-warn">{t('redesign.staleSnapshot')}</p>}
    <Overview graph={graph} quotas={quotas} now={Date.now()} t={t} language={lang} onLanguage={() => setLang(lang === 'en' ? 'th' : 'en')} theme={theme} onTheme={toggleTheme} currency={currency} rate={rate}/>
  </>;
}
