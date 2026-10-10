import { useEffect, useRef, useState } from 'react';
import { Box, Folder, Headphones, Activity } from 'lucide-react';
import { api, type RuntimeSummary } from '@/api';
import { useLiveRefresh, useRefreshStatus } from '@/lib/use-live';
import { useT } from '@/i18n';
import type { RedesignTranslate } from './shell';
import { activeQuotaRiskCount } from './alert-risks';
import { usageEventParams, type UsageEventScope } from '@/lib/usage-events';
import { quickStatsLinks } from './quick-stats-scope';

export function DaemonConnection() {
  const t = useT();
  const { state } = useRefreshStatus();
  const label = { connecting: 'app.refreshConnecting', live: 'app.refreshLive', reconnecting: 'app.refreshReconnecting', stale: 'app.refreshStale', unavailable: 'app.refreshUnavailable' } as const;
  const stateLabel = t(label[state]);
  const status = state === 'live' ? t('redesign.daemonConnected') : stateLabel;
  const description = `${t('redesign.daemonConnection')}: ${stateLabel}`;
  return <span className="qp-daemon-status"><span className="qp-daemon-badge" data-state={state} role="status" aria-label={description} title={description}><i aria-hidden="true"/>{stateLabel}</span><span className="qp-daemon-caption" aria-hidden="true">{status}</span></span>;
}

/** Decorative reference marks; the link, label and counts retain their data semantics. */
function QuickStatMark({ kind }: { kind: 'namedProjects' | 'models' | 'providers' | 'recentSessions' }) {
  return <svg className="qp-native-stat-mark" viewBox="0 0 16 16" aria-hidden="true" focusable="false" data-kind={kind}>
    {kind === 'namedProjects' && <><path d="M1 4a1 1 0 0 1 1-1h4l2 2h6a1 1 0 0 1 1 1v7H1Z" fill="currentColor"/><path d="M3 7h10v4H3Z" fill="none" stroke="#a4d9ff" strokeWidth="1"/><path d="M3 3v3h4" fill="none" stroke="#a4d9ff" strokeWidth="1"/></>}
    {kind === 'models' && <><path d="m8 0 7 4v8l-7 4-7-4V4Z" fill="currentColor"/><path d="m8 2 5 3-5 3-5-3Zm0 6v6" fill="none" stroke="#092451" strokeWidth="1.4"/><path d="M5 7v4l3 2" fill="none" stroke="#c5e9ff" strokeWidth="1"/></>}
    {kind === 'providers' && <><path d="M2 10V7a6 6 0 0 1 12 0v3M2 8H1v4h3V8Zm12 0h1v4h-3V8Zm-1 4c0 2-2 3-5 3" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/><circle cx="8" cy="14" r="1" fill="currentColor"/></>}
    {kind === 'recentSessions' && <circle cx="8" cy="8" r="3.5" fill="currentColor"/>}
  </svg>;
}

export function QuickStats({ t, language, scope, paused = false, onAlertCountChange }: { t: RedesignTranslate; language: 'en' | 'th'; scope?: UsageEventScope | null; paused?: boolean; onAlertCountChange: (count: number | null) => void }) {
  const scopeKey = scope === null ? 'pending' : scope === undefined ? 'machine' : usageEventParams(scope).toString();
  const current = useRef({ key: scopeKey, generation: 0 });
  if (current.current.key !== scopeKey) current.current = { key: scopeKey, generation: current.current.generation + 1 };
  const generation = current.current.generation;
  // Pause invalidates requests while retaining the displayed counts.
  const pause = useRef({ paused, epoch: 0 });
  if (pause.current.paused !== paused) pause.current = { paused, epoch: pause.current.epoch + 1 };
  const pauseEpoch = pause.current.epoch;
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const [snapshot, setSnapshot] = useState<{ generation: number; data: RuntimeSummary } | null>(null);
  const [failure, setFailure] = useState<number | null>(null);
  // Current quota risk is machine-wide, independently of recorded usage filters.
  useLiveRefresh(async () => {
    try {
      const overview = await api.overview();
      if (mounted.current) onAlertCountChange(activeQuotaRiskCount(overview));
    } catch (cause) {
      if (mounted.current) onAlertCountChange(null);
      throw cause;
    }
  }, [onAlertCountChange]);
  useLiveRefresh(async () => {
    if (scope === null || paused) return;
    const requestedGeneration = generation;
    const isCurrent = () => mounted.current && current.current.generation === requestedGeneration && !pause.current.paused && pause.current.epoch === pauseEpoch;
    try {
      const data = await api.runtimeSummary(scope);
      if (isCurrent()) { setSnapshot({ generation: requestedGeneration, data }); setFailure(null); }
    } catch (cause) {
      if (!isCurrent()) return;
      setFailure(requestedGeneration);
      throw cause;
    }
  }, [scopeKey, paused]);
  const data = snapshot?.generation === generation ? snapshot.data : null;
  const stale = failure === generation;
  const links = quickStatsLinks(scope);
  const note = t(scope === undefined ? 'redesign.quickStatsNote' : 'redesign.quickStatsScopedNote');
  const number = (value: number | undefined) => value === undefined ? t('redesign.unknownValue') : new Intl.NumberFormat(language === 'th' ? 'th-TH' : 'en-US').format(value);
  const rows = [
    { key: 'namedProjects', label: 'redesign.quickProjects', icon: Folder, href: links.projects },
    { key: 'models', label: 'redesign.quickModels', icon: Box, href: links.models },
    { key: 'providers', label: 'redesign.quickProviders', icon: Headphones, href: links.providers },
    { key: 'recentSessions', label: 'redesign.quickSessions', icon: Activity, href: links.live },
  ] as const;
  return <section className="qp-quick-stats" aria-label={t('redesign.quickStats')} aria-describedby="qp-quick-stats-note" data-stale={stale}>
    <h2>{t('redesign.quickStats')}</h2>
    <dl>{rows.map(({ key, label, icon: Icon, href }) => <div key={key}><dt><a href={href} aria-disabled={href === undefined || undefined} title={key === 'recentSessions' ? note : undefined}><Icon className="qp-legacy-stat-mark" aria-hidden="true"/><QuickStatMark kind={key}/><span>{t(label)}</span></a></dt><dd data-stat={key}>{number(data?.[key])}</dd></div>)}</dl>
    <small id="qp-quick-stats-note" className="qp-visually-hidden">{note}</small>
    {stale && <small role="status">{t('redesign.staleSnapshot')}</small>}
  </section>;
}
