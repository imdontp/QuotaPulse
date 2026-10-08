import { useEffect, useRef, useState } from 'react';
import { Activity, AlertTriangle, Clock3, GitBranch, Info, Pause, Play, Radio, RefreshCw, Search, X } from 'lucide-react';
import { api, type LiveSessionsResponse, type MinuteTrendResponse, type Overview, type ProviderModelMinuteResponse } from '@/api';
import { useI18n, useT } from '@/i18n';
import { useLiveRefresh, useRefreshStatus } from '@/lib/use-live';
import { useTheme } from '@/lib/use-theme';
import type { UsageEventScope, UsageEventsResponse } from '@/lib/usage-events';
import { RedesignShell } from './shell';
import { HarnessIcon } from '@/components/harness-icon';
import { LiveTokenFlow, LiveTokenFlowLegend } from './live-token-flow';
import { PageHeading } from './page-heading';
import { SectionMark } from './section-mark';
import { LiveMinuteMatrix } from './live-minute-strip';
import './live.css';

interface LiveRoute {
  sessions: 'recent' | 'all'; q: string; provider: string | null; model: string | null;
  sessionOffset: number; feedOffset: number;
}
function readRoute(): LiveRoute {
  const p = new URLSearchParams(location.hash.split('?')[1] ?? '');
  const offset = (name: string) => { const n = Number(p.get(name)); return Number.isSafeInteger(n) && n >= 0 ? n : 0; };
  return { sessions: p.get('sessions') === 'all' ? 'all' : 'recent', q: p.get('q') ?? '',
    provider: p.get('provider'), model: p.get('model'), sessionOffset: offset('session_offset'), feedOffset: offset('feed_offset') };
}
function routeHash(route: LiveRoute) {
  const p = new URLSearchParams();
  if (route.sessions === 'all') p.set('sessions', 'all');
  if (route.q) p.set('q', route.q);
  if (route.provider) p.set('provider', route.provider);
  if (route.model) p.set('model', route.model);
  if (route.sessionOffset) p.set('session_offset', String(route.sessionOffset));
  if (route.feedOffset) p.set('feed_offset', String(route.feedOffset));
  return `#live${p.size ? `?${p}` : ''}`;
}
interface Snapshot { key: string; route: LiveRoute; overview: Overview; scope: UsageEventScope; trend: MinuteTrendResponse;
  feed: UsageEventsResponse; matrix: ProviderModelMinuteResponse; sessions: LiveSessionsResponse }

export function ProductionLive() {
  const t = useT();
  const { lang, setLang } = useI18n();
  const [theme, toggleTheme] = useTheme();
  const [route, setRoute] = useState(readRoute);
  const [draft, setDraft] = useState(route.q);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(false);
  const [selectedSession, setSelectedSession] = useState<LiveSessionsResponse['rows'][number] | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const returnFocus = useRef<HTMLButtonElement | null>(null);
  const refresh = useRefreshStatus();
  const dataKey = JSON.stringify(route);
  const currentKey = useRef(dataKey);
  const requestEpoch = useRef(0);
  const mounted = useRef(true);
  currentKey.current = dataKey;
  useEffect(() => {
    mounted.current = true;
    const sync = () => {
      requestEpoch.current++;
      if (location.hash.slice(1).split('?')[0] === 'live') {
        const next = readRoute();
        currentKey.current = JSON.stringify(next);
        setRoute(next); setDraft(next.q); setError(null);
      }
    };
    addEventListener('hashchange', sync);
    return () => { mounted.current = false; requestEpoch.current++; removeEventListener('hashchange', sync); };
  }, []);
  useEffect(() => { if (selectedSession && !dialog.current?.open) dialog.current?.showModal(); }, [selectedSession]);
  const update = (patch: Partial<LiveRoute>) => {
    if (pausedRef.current) return;
    const next = { ...route, ...patch };
    requestEpoch.current++;
    currentKey.current = JSON.stringify(next);
    history.replaceState(null, '', `${location.pathname}${location.search}${routeHash(next)}`);
    setRoute(next);
    setError(null);
  };
  useLiveRefresh(async () => {
    if (pausedRef.current) return;
    const requestedKey = dataKey;
    const requestedEpoch = requestEpoch.current;
    const isCurrent = () => mounted.current && !pausedRef.current && currentKey.current === requestedKey && requestEpoch.current === requestedEpoch;
    try {
      const overview = await api.overview();
      if (!isCurrent()) return;
      const scope: UsageEventScope = { from: Math.max(0, overview.now - 30 * 60_000), to: overview.now + 1,
        ...(route.q ? { q: route.q } : {}), ...(route.provider ? { provider: route.provider } : {}),
        ...(route.model ? { model: route.model } : {}) };
      const base = { from: scope.from, to: scope.to };
      const [trend, feed, matrix, sessions] = await Promise.all([
        api.minuteTrend(scope), api.usageEvents(scope, { limit: 8, offset: route.feedOffset }),
        api.providerModelMinutes(base), api.liveSessions(scope, route.sessions, route.sessionOffset),
      ]);
      if (isCurrent()) {
        setSnapshot({ key: requestedKey, route, overview, scope, trend, feed, matrix, sessions });
        setError(null);
      }
    } catch (cause) {
      if (!isCurrent()) return;
      setError(String(cause));
      throw cause;
    }
  }, [dataKey, paused]);
  const togglePause = () => {
    requestEpoch.current++;
    pausedRef.current = !pausedRef.current;
    setPaused(pausedRef.current);
    if (!pausedRef.current) update({ sessionOffset: 0, feedOffset: 0 });
  };
  const current = snapshot?.key === dataKey ? snapshot : null;
  const display = paused ? snapshot : current ?? (error ? snapshot : null);
  const displayRoute = display?.route ?? route;
  const frozen = paused || (display !== null && display.key !== dataKey);
  const now = display?.overview.now ?? Date.now();
  const sources = display?.overview.sourceStatus ?? [];
  const validRecent = (at: number | null) => at !== null && at <= now && now - at <= 300_000;
  const reporting = sources.filter(source => source.enabled && validRecent(source.last_event_ts)).length;
  const stale = sources.filter(source => source.enabled && source.limit_samples > 0 && source.last_limit_source_fetched_at !== null
    && source.last_limit_source_fetched_at <= now && now - source.last_limit_source_fetched_at > 3_600_000).length;
  const readerErrors = sources.filter(source => source.enabled && source.telemetry.reason === 'reader_error').length;
  const advisories = sources.filter(source => source.enabled && (source.telemetry.gap || source.telemetry.reason === 'reader_error'));
  const number = (value: number) => new Intl.NumberFormat(lang === 'th' ? 'th-TH' : 'en-US').format(value);
  const date = (value: number | null) => value === null ? '—' : new Intl.DateTimeFormat(lang === 'th' ? 'th-TH' : 'en-US', { dateStyle: 'short', timeStyle: 'short' }).format(value);
  const sourceDate = (value: number | null) => value === null || value > now ? t('redesign.unknownValue') : date(value);
  const trend = display?.trend;
  const unknownExcluded = trend?.coverage.excludedSources.filter(source => source.grain === 'unknown').reduce((sum, source) => sum + source.records, 0) ?? 0;
  const aggregateExcluded = trend?.coverage.excludedSources.filter(source => source.grain === 'session_aggregate').reduce((sum, source) => sum + source.records, 0) ?? 0;
  const historyHref = (extra: Record<string, string> = {}) => {
    if (!display) return '#history';
    const p = new URLSearchParams({ range: 'custom', from: String(display.scope.from), to: String(display.scope.to), ...extra });
    return `#history?${p}`;
  };

  return <RedesignShell active="live" theme={theme} language={lang} onTheme={toggleTheme} onLanguage={() => setLang(lang === 'en' ? 'th' : 'en')} t={t} testId="production-live">
    <section className="qp-panel qp-live-top">
    <header className="qp-live-header"><PageHeading icon={<Activity size={24}/>} title={t('redesign.liveHeading')} subtitle={t('redesign.liveSubtitle')} compact/><div className="qp-live-actions"><button onClick={togglePause}>{paused ? <Play size={15}/> : <Pause size={15}/ >}{t(paused ? 'redesign.liveResume' : 'redesign.livePause')}</button><button onClick={() => void refresh.refreshNow()} disabled={paused || refresh.refreshing}><RefreshCw size={15}/>{t('app.refreshNow')}</button></div></header>
    {paused && <p className="qp-live-note" role="status">{t('redesign.livePaused')} · {date(display?.overview.now ?? null)}</p>}
    {error && <p className="qp-live-error" role="status">{t('redesign.staleSnapshot')} · {error}</p>}
    {!display ? <p role="status">{error ?? t('app.loading')}</p> :
      <section className="qp-live-metrics" aria-label={t('redesign.liveHeading')}>
        {[
          [t('redesign.liveRecentSessions'), display.sessions.recentCount],
          [t('redesign.liveReportingSources'), reporting],
          [t('redesign.liveStaleSources'), stale],
          [t('redesign.liveReaderErrors'), readerErrors],
        ].map(([label, value], index) => <div className="qp-panel" key={label}><i className="qp-live-metric-icon" aria-hidden="true">{index === 0 ? <Activity size={20}/> : index === 1 ? <Radio size={20}/> : index === 2 ? <Clock3 size={20}/> : <AlertTriangle size={20}/>}</i><small>{label}</small><strong>{number(value as number)}</strong></div>)}
      </section>}
    </section>
    {display && <div className="qp-live-layout">
        <div className="qp-live-main">
          <section className="qp-panel qp-live-section qp-live-sessions"><div className="qp-live-session-tools"><div className="qp-live-section-head"><h2><SectionMark icon={<GitBranch/>} size={28}/>{t('redesign.liveSessionTable')}</h2>
              <details className="qp-live-session-note">
                <summary><Info size={15} aria-hidden="true"/><span>{t('redesign.liveSessionTable')}</span></summary>
                <p className="qp-footnote">{t('redesign.liveMetricsNote')}</p>
              </details>
              <div><button disabled={frozen} aria-pressed={displayRoute.sessions === 'recent'} onClick={() => update({ sessions: 'recent', sessionOffset: 0 })}>{t('redesign.liveRecentFilter')}</button><button disabled={frozen} aria-pressed={displayRoute.sessions === 'all'} onClick={() => update({ sessions: 'all', sessionOffset: 0 })}>{t('redesign.liveAllFilter')}</button></div></div>
            <form className="qp-live-search" onSubmit={event => { event.preventDefault(); update({ q: draft, sessionOffset: 0, feedOffset: 0 }); }}><Search size={15}/><input disabled={frozen} value={frozen ? displayRoute.q : draft} onChange={event => setDraft(event.target.value)} maxLength={256} aria-label={t('redesign.liveSearch')} placeholder={t('redesign.liveSearch')}/><button disabled={frozen} type="submit">{t('redesign.liveApplySearch')}</button></form>
            <div className="qp-live-session-controls">
              <div className="qp-live-pagination qp-live-session-pagination"><button disabled={frozen || displayRoute.sessionOffset === 0} onClick={() => update({ sessionOffset: Math.max(0, displayRoute.sessionOffset - 10) })}>{t('redesign.livePrevious')}</button><span>{number(display.sessions.total)} {t('redesign.sessions')}</span><button disabled={frozen || displayRoute.sessionOffset + display.sessions.rows.length >= display.sessions.total} onClick={() => update({ sessionOffset: displayRoute.sessionOffset + 10 })}>{t('redesign.liveNext')}</button></div>

            </div>
          </div>
            {display.sessions.rows.length === 0 ? <p>{t('redesign.liveNoSessions')}</p> : <div className="qp-live-table" tabIndex={0} role="region" aria-label={t('redesign.liveSessionTable')}><table><thead><tr><th>{t('redesign.sessions')}</th><th>{t('redesign.project')}</th><th>{t('redesign.harness')}</th><th>{t('redesign.liveSourceTime')}</th><th>{t('redesign.tokens')}</th></tr></thead><tbody>{display.sessions.rows.map(session => <tr key={session.sessionKey}><td><button onClick={event => { returnFocus.current = event.currentTarget; setSelectedSession(session); }}>{session.nativeSessionId}</button><small>{session.sourceName}</small></td><td>{session.project ?? t('redesign.unassigned')}</td><td><span className="qp-live-session-harness"><HarnessIcon harness={session.harness} vendor={display.overview.harnesses.find(harness => harness.harness === session.harness)?.vendor} label={session.harness}/>{session.harness}</span></td><td>{sourceDate(session.lastSeenAt)}</td><td>{number(session.tokens)}</td></tr>)}</tbody></table></div>}
          </section>
          <section className="qp-panel qp-live-section qp-live-trend"><div className="qp-live-section-head"><h2><SectionMark icon={<Activity/>} size={28}/>{t('redesign.liveChart')}</h2>{trend?.coverage.includedRecords ? <LiveTokenFlowLegend t={t}/> : null}{trend?.coverage.includedRecords ? <p className="qp-footnote">{number(trend.coverage.includedCalls)} {t('redesign.modelsCalls')}</p> : null}</div>{trend?.coverage.includedRecords ? <LiveTokenFlow data={trend} language={lang} t={t} showLegend={false}/> : <p>{t('redesign.liveChartEmpty')}</p>}<div className="qp-live-excluded"><strong>{t('redesign.liveExcluded')}</strong><span>{number(aggregateExcluded)} {t('redesign.liveAggregate')}</span><span>{number(unknownExcluded)} {t('redesign.liveUnknownGrain')}</span>{trend?.coverage.excludedSources.map(source => <small key={source.source_id}>{source.source_name}: {number(source.records)} {t('redesign.records')}</small>)}</div>
          </section>
          <section className="qp-panel qp-live-section qp-live-records"><div className="qp-live-feed-tools"><div className="qp-live-section-head"><h2><SectionMark icon={<Activity/>} size={28}/>{t('redesign.liveFeed')}</h2><a href={historyHref({ ...(displayRoute.provider ? { provider: displayRoute.provider } : {}), ...(displayRoute.model ? { model: displayRoute.model } : {}), ...(displayRoute.q ? { q: displayRoute.q } : {}) })}>{t('redesign.openHistory')}</a></div>
            <div className="qp-live-pagination qp-live-feed-pagination"><button disabled={frozen || displayRoute.feedOffset === 0} onClick={() => update({ feedOffset: Math.max(0, displayRoute.feedOffset - 8) })}>{t('redesign.livePrevious')}</button><span>{number(display.feed.total)} {t('redesign.records')}</span><button disabled={frozen || displayRoute.feedOffset + display.feed.rows.length >= display.feed.total} onClick={() => update({ feedOffset: displayRoute.feedOffset + 8 })}>{t('redesign.liveNext')}</button></div>
          </div>
            {display.feed.rows.length === 0 ? <p>{t('redesign.liveNoRecords')}</p> : <ol className="qp-live-feed" tabIndex={0} aria-label={t('redesign.liveFeed')}>{display.feed.rows.map(row => <li key={row.event_id}><span>{date(row.timestamp_ms)} · {row.harness} · {row.provider ?? t('redesign.unknownValue')} · {row.model ?? t('redesign.unknownValue')}<small>{row.grain === 'call' ? t('redesign.callRecord') : t('redesign.aggregateUpdate')}</small></span><strong>{number(row.total_tokens)}</strong></li>)}</ol>}

          </section>
        </div>
        <aside className="qp-live-rail">
          <section className="qp-panel qp-live-section"><h2><SectionMark icon={<AlertTriangle/>} size={28}/>{t('redesign.liveAdvisory')}</h2>{advisories.length === 0 ? <p>{t('redesign.liveNoAdvisory')}</p> : <ol>{advisories.map(source => <li key={source.source_id}><AlertTriangle size={15}/><span>{source.display_name} · {t(source.telemetry.reason === 'usage_newer_than_quota' ? 'redesign.liveUsageAheadQuota' : source.telemetry.reason === 'reader_error' ? 'redesign.liveReaderErrorNote' : 'redesign.liveQuotaReview')}</span><a href="#settings?section=diagnostics">{t('redesign.liveDiagnostics')}</a></li>)}</ol>}</section>
          <section className="qp-panel qp-live-section qp-live-matrix-section"><h2><SectionMark icon={<Radio/>} size={28}/>{t('redesign.liveMatrix')}</h2>
            <LiveMinuteMatrix data={display.matrix} language={lang} t={t} frozen={frozen} provider={displayRoute.provider} model={displayRoute.model} onSelect={(provider, model) => update({ provider, model, feedOffset: 0, sessionOffset: 0 })} onClear={() => update({ provider: null, model: null, feedOffset: 0, sessionOffset: 0 })}/>
          </section>
        </aside>
      </div>}
    <dialog ref={dialog} className="qp-live-dialog" aria-labelledby="qp-live-detail-title" onClose={event => { if (!event.currentTarget.open) { setSelectedSession(null); returnFocus.current?.focus(); } }}>{selectedSession && <><div className="qp-live-section-head"><h2 id="qp-live-detail-title">{t('redesign.liveSessionDetail')}</h2><button autoFocus onClick={() => dialog.current?.close()} aria-label={t('redesign.close')}><X size={18}/></button></div><dl><dt>{t('redesign.sessions')}</dt><dd>{selectedSession.nativeSessionId}</dd><dt>{t('redesign.project')}</dt><dd>{selectedSession.project ?? t('redesign.unassigned')}</dd><dt>{t('redesign.liveSourceTime')}</dt><dd>{sourceDate(selectedSession.lastSeenAt)}</dd><dt>{t('redesign.liveObservedTime')}</dt><dd>{date(selectedSession.lastObservedAt)}</dd><dt>{t('redesign.tokens')}</dt><dd>{number(selectedSession.tokens)}</dd><dt>{t('redesign.projectObservedPaths')}</dt><dd>{selectedSession.cwd ?? t('redesign.projectUnknownPath')}</dd></dl><a href={historyHref({ session_id: String(selectedSession.sessionKey), ...(displayRoute.provider ? { provider: displayRoute.provider } : {}), ...(displayRoute.model ? { model: displayRoute.model } : {}), ...(displayRoute.q ? { q: displayRoute.q } : {}) })}>{t('redesign.openHistory')}</a></>}</dialog>
  </RedesignShell>;
}
