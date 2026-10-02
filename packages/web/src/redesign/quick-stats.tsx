import { useState } from 'react';
import { Box, Layers, Radio, Activity } from 'lucide-react';
import { api, type RuntimeSummary } from '@/api';
import { useLiveRefresh, useRefreshStatus } from '@/lib/use-live';
import { useT } from '@/i18n';
import type { RedesignTranslate } from './shell';

export function DaemonConnection() {
  const t = useT();
  const { state } = useRefreshStatus();
  const label = { connecting: 'app.refreshConnecting', live: 'app.refreshLive', reconnecting: 'app.refreshReconnecting', stale: 'app.refreshStale', unavailable: 'app.refreshUnavailable' } as const;
  return <span className="qp-daemon-badge" data-state={state} role="status"><i aria-hidden="true"/>{t('redesign.daemonConnection')}: {t(label[state])}</span>;
}

export function QuickStats({ t, language }: { t: RedesignTranslate; language: 'en' | 'th' }) {
  const [data, setData] = useState<RuntimeSummary | null>(null);
  const [stale, setStale] = useState(false);
  useLiveRefresh(async () => {
    try { setData(await api.runtimeSummary()); setStale(false); }
    catch (cause) { setStale(true); throw cause; }
  }, []);
  const number = (value: number | undefined) => value === undefined ? t('redesign.unknownValue') : new Intl.NumberFormat(language === 'th' ? 'th-TH' : 'en-US').format(value);
  const rows = [
    { key: 'namedProjects', label: 'redesign.namedProjects', icon: Box, href: '#projects?range=all' },
    { key: 'models', label: 'redesign.recordedModels', icon: Layers, href: '#models?range=all' },
    { key: 'providers', label: 'redesign.recordedProviders', icon: Radio, href: '#providers' },
    { key: 'recentSessions', label: 'redesign.recentSessions', icon: Activity, href: '#live' },
  ] as const;
  return <section className="qp-quick-stats" aria-label={t('redesign.quickStats')} data-stale={stale}>
    <h2>{t('redesign.quickStats')}</h2><p>{t('redesign.machineScope')}</p>
    <dl>{rows.map(({ key, label, icon: Icon, href }) => <div key={key}><dt><a href={href}><Icon aria-hidden="true"/><span>{t(label)}</span></a></dt><dd data-stat={key}>{number(data?.[key])}</dd></div>)}</dl>
    <small>{t('redesign.quickStatsNote')}</small>
    {stale && <small role="status">{t('redesign.staleSnapshot')}</small>}
  </section>;
}
