import { useState } from 'react';
import { Box, Folder, Headphones, Activity } from 'lucide-react';
import { api, type RuntimeSummary } from '@/api';
import { useLiveRefresh, useRefreshStatus } from '@/lib/use-live';
import { useT } from '@/i18n';
import type { RedesignTranslate } from './shell';
import { activeQuotaRiskCount } from './alert-risks';

export function DaemonConnection() {
  const t = useT();
  const { state } = useRefreshStatus();
  const label = { connecting: 'app.refreshConnecting', live: 'app.refreshLive', reconnecting: 'app.refreshReconnecting', stale: 'app.refreshStale', unavailable: 'app.refreshUnavailable' } as const;
  const stateLabel = t(label[state]);
  const status = state === 'live' ? t('redesign.daemonConnected') : stateLabel;
  const description = `${t('redesign.daemonConnection')}: ${stateLabel}`;
  return <span className="qp-daemon-status"><span className="qp-daemon-badge" data-state={state} role="status" aria-label={description} title={description}><i aria-hidden="true"/>{stateLabel}</span><span className="qp-daemon-caption" aria-hidden="true">{status}</span></span>;
}

export function QuickStats({ t, language, onAlertCountChange }: { t: RedesignTranslate; language: 'en' | 'th'; onAlertCountChange: (count: number | null) => void }) {
  const [data, setData] = useState<RuntimeSummary | null>(null);
  const [stale, setStale] = useState(false);
  useLiveRefresh(async () => {
    const [summaryResult, overviewResult] = await Promise.allSettled([api.runtimeSummary(), api.overview()]);
    onAlertCountChange(overviewResult.status === 'fulfilled' ? activeQuotaRiskCount(overviewResult.value) : null);
    if (summaryResult.status === 'rejected') {
      setStale(true);
      throw summaryResult.reason;
    }
    setData(summaryResult.value);
    setStale(false);
  }, [onAlertCountChange]);
  const number = (value: number | undefined) => value === undefined ? t('redesign.unknownValue') : new Intl.NumberFormat(language === 'th' ? 'th-TH' : 'en-US').format(value);
  const rows = [
    { key: 'namedProjects', label: 'redesign.quickProjects', icon: Folder, href: '#projects?range=all' },
    { key: 'models', label: 'redesign.quickModels', icon: Box, href: '#models?range=all' },
    { key: 'providers', label: 'redesign.quickProviders', icon: Headphones, href: '#providers' },
    { key: 'recentSessions', label: 'redesign.quickSessions', icon: Activity, href: '#live' },
  ] as const;
  return <section className="qp-quick-stats" aria-label={t('redesign.quickStats')} aria-describedby="qp-quick-stats-note" data-stale={stale}>
    <h2>{t('redesign.quickStats')}</h2>
    <dl>{rows.map(({ key, label, icon: Icon, href }) => <div key={key}><dt><a href={href} title={key === 'recentSessions' ? t('redesign.quickStatsNote') : undefined}><Icon aria-hidden="true"/><span>{t(label)}</span></a></dt><dd data-stat={key}>{number(data?.[key])}</dd></div>)}</dl>
    <small id="qp-quick-stats-note" className="qp-visually-hidden">{t('redesign.quickStatsNote')}</small>
    {stale && <small role="status">{t('redesign.staleSnapshot')}</small>}
  </section>;
}
