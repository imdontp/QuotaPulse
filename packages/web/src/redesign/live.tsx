import { useEffect, useRef, useState } from 'react';
import { Activity, AlertTriangle, Pause, Play, RefreshCw, Search, X } from 'lucide-react';
import { api, type DetailedModelResponse, type LiveSessionsResponse, type MinuteTrendResponse, type Overview } from '@/api';
import { useI18n, useT } from '@/i18n';
import { useLiveRefresh, useRefreshStatus } from '@/lib/use-live';
import { useTheme } from '@/lib/use-theme';
import type { UsageEventScope, UsageEventsResponse } from '@/lib/usage-events';
import { RedesignShell } from './shell';
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
interface Snapshot { key: string; overview: Overview; scope: UsageEventScope; trend: MinuteTrendResponse;
  feed: UsageEventsResponse; models: DetailedModelResponse; sessions: LiveSessionsResponse }

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
  currentKey.current = dataKey;
  useEffect(() => {
    const sync = () => { if (location.hash.slice(1).split('?')[0] === 'live') { setRoute(readRoute()); setDraft(readRoute().q); } };
    addEventListener('hashchange', sync);
    return () => removeEventListener('hashchange', sync);
  }, []);
  useEffect(() => { if (selectedSession && !dialog.current?.open) dialog.current?.showModal(); }, [selectedSession]);
  const update = (patch: Partial<LiveRoute>) => {
    if (pausedRef.current) return;
    const next = { ...route, ...patch };
    history.replaceState(null, '', `${location.pathname}${location.search}${routeHash(next)}`);
    setRoute(next);
    setError(null);
  };
  useLiveRefresh(async () => {
    if (pausedRef.current) return;
    const requestedKey = dataKey;
    try {
      const overview = await api.overview();
      const scope: UsageEventScope = { from: Math.max(0, overview.now - 30 * 60_000), to: overview.now + 1,
        ...(route.q ? { q: route.q } : {}), ...(route.provider ? { provider: route.provider } : {}),
        ...(route.model ? { model: route.model } : {}) };
      const base = { from: scope.from, to: scope.to };
      const [trend, feed, models, sessions] = await Promise.all([
        api.minuteTrend(scope), api.usageEvents(scope, { limit: 8, offset: route.feedOffset }),
        api.detailedModels(base), api.liveSessions(scope, route.sessions, route.sessionOffset),
      ]);
      if (!pausedRef.current && currentKey.current === requestedKey) {
        setSnapshot({ key: requestedKey, overview, scope, trend, feed, models, sessions });
        setError(null);
      }
    } catch (cause) {
      if (!pausedRef.current && currentKey.current === requestedKey) setError(String(cause));
      throw cause;
    }
  }, [dataKey, paused]);
  const togglePause = () => {
    pausedRef.current = !pausedRef.current;
    setPaused(pausedRef.current);
    if (!pausedRef.current) update({ sessionOffset: 0, feedOffset: 0 });
  };
  const current = snapshot?.key === dataKey ? snapshot : null;
  const display = paused ? snapshot : current;
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
  const byMinute = new Map(trend?.rows.map(row => [row.bucket_ts, row.total_tokens]) ?? []);
  const bars = trend ? Array.from({ length: Math.floor((trend.to - 1) / 60_000) - Math.floor(trend.from / 60_000) + 1 }, (_, index) => {
    const at = Math.floor(trend.from / 60_000) * 60_000 + index * 60_000;
    return { at, tokens: byMinute.get(at) ?? 0 };
  }) : [];
  const barMax = Math.max(1, ...bars.map(bar => bar.tokens));
  const unknownExcluded = trend?.coverage.excludedSources.filter(source => source.grain === 'unknown').reduce((sum, source) => sum + source.records, 0) ?? 0;
  const aggregateExcluded = trend?.coverage.excludedSources.filter(source => source.grain === 'session_aggregate').reduce((sum, source) => sum + source.records, 0) ?? 0;
  const historyHref = (extra: Record<string, string> = {}) => {
    if (!display) return '#history';
    const p = new URLSearchParams({ range: 'custom', from: String(display.scope.from), to: String(display.scope.to), ...extra });
    return `#history?${p}`;
  };

  return <RedesignShell active="live" theme={theme} language={lang} onTheme={toggleTheme} onLanguage={() => setLang(lang === 'en' ? 'th' : 'en')} t={t} testId="production-live">
    <header className="qp-live-header"><div><h1><Activity size={24}/>{t('redesign.liveHeading')}</h1><p>{t('redesign.liveSubtitle')}</p></div><div className="qp-live-actions"><button onClick={togglePause}>{paused ? <Play size={15}/> : <Pause size={15}/ >}{t(paused ? 'redesign.liveResume' : 'redesign.livePause')}</button><button onClick={() => void refresh.refreshNow()} disabled={paused || refresh.refreshing}><RefreshCw size={15}/>{t('app.refreshNow')}</button></div></header>
    {paused && <p className="qp-live-note" role="status">{t('redesign.livePaused')} · {date(display?.overview.now ?? null)}</p>}
    {error && <p className="qp-live-error" role="status">{t('redesign.staleSnapshot')} · {error}</p>}
    {!display ? <p className="qp-panel" role="status">{error ?? t('app.loading')}</p> : <>
      <section className="qp-live-metrics" aria-label={t('redesign.liveHeading')}>
        {[
          [t('redesign.liveRecentSessions'), display.sessions.recentCount],
          [t('redesign.liveReportingSources'), reporting],
          [t('redesign.liveStaleSources'), stale],
          [t('redesign.liveReaderErrors'), readerErrors],
        ].map(([label, value]) => <div className="qp-panel" key={label}><small>{label}</small><strong>{number(value as number)}</strong></div>)}
      </section>
      <p className="qp-footnote">{t('redesign.liveMetricsNote')}</p>
      <div className="qp-live-layout">
        <div className="qp-live-main">
          <section className="qp-panel qp-live-section"><div className="qp-live-section-head"><h2>{t('redesign.liveSessionTable')}</h2><div><button disabled={paused} aria-pressed={route.sessions === 'recent'} onClick={() => update({ sessions: 'recent', sessionOffset: 0 })}>{t('redesign.liveRecentFilter')}</button><button disabled={paused} aria-pressed={route.sessions === 'all'} onClick={() => update({ sessions: 'all', sessionOffset: 0 })}>{t('redesign.liveAllFilter')}</button></div></div>
            <form className="qp-live-search" onSubmit={event => { event.preventDefault(); update({ q: draft, sessionOffset: 0, feedOffset: 0 }); }}><Search size={15}/><input disabled={paused} value={draft} onChange={event => setDraft(event.target.value)} maxLength={256} aria-label={t('redesign.liveSearch')} placeholder={t('redesign.liveSearch')}/><button disabled={paused} type="submit">{t('redesign.liveApplySearch')}</button></form>
            {display.sessions.rows.length === 0 ? <p>{t('redesign.liveNoSessions')}</p> : <div className="qp-live-table"><table><thead><tr><th>{t('redesign.sessions')}</th><th>{t('redesign.project')}</th><th>{t('redesign.liveSourceTime')}</th><th>{t('redesign.tokens')}</th></tr></thead><tbody>{display.sessions.rows.map(session => <tr key={session.sessionKey}><td><button onClick={event => { returnFocus.current = event.currentTarget; setSelectedSession(session); }}>{session.nativeSessionId}</button><small>{session.sourceName}</small></td><td>{session.project ?? t('redesign.unassigned')}</td><td>{sourceDate(session.lastSeenAt)}</td><td>{number(session.tokens)}</td></tr>)}</tbody></table></div>}
            <div className="qp-live-pagination"><button disabled={paused || route.sessionOffset === 0} onClick={() => update({ sessionOffset: Math.max(0, route.sessionOffset - 10) })}>{t('redesign.livePrevious')}</button><span>{number(display.sessions.total)} {t('redesign.sessions')}</span><button disabled={paused || route.sessionOffset + display.sessions.rows.length >= display.sessions.total} onClick={() => update({ sessionOffset: route.sessionOffset + 10 })}>{t('redesign.liveNext')}</button></div>
          </section>
          <section className="qp-panel qp-live-section"><h2>{t('redesign.liveChart')}</h2>{trend?.coverage.includedRecords ? <><div className="qp-live-chart" role="img" aria-label={`${t('redesign.liveChart')}: ${number(trend.coverage.includedCalls)} ${t('redesign.calls')}`}>{bars.map(bar => <span key={bar.at} title={`${date(bar.at)} · ${number(bar.tokens)}`} style={{ height: `${bar.tokens ? Math.max(3, 100 * bar.tokens / barMax) : 0}%` }}/>)}</div><p className="qp-footnote">{number(trend.coverage.includedCalls)} {t('redesign.calls')}</p></> : <p>{t('redesign.liveChartEmpty')}</p>}
            <div className="qp-live-excluded"><strong>{t('redesign.liveExcluded')}</strong><span>{number(aggregateExcluded)} {t('redesign.liveAggregate')}</span><span>{number(unknownExcluded)} {t('redesign.liveUnknownGrain')}</span>{trend?.coverage.excludedSources.map(source => <small key={source.source_id}>{source.source_name}: {number(source.records)} {t('redesign.records')}</small>)}</div>
          </section>
          <section className="qp-panel qp-live-section"><div className="qp-live-section-head"><h2>{t('redesign.liveFeed')}</h2><a href={historyHref({ ...(route.provider ? { provider: route.provider } : {}), ...(route.model ? { model: route.model } : {}), ...(route.q ? { q: route.q } : {}) })}>{t('redesign.openHistory')}</a></div>
            {display.feed.rows.length === 0 ? <p>{t('redesign.liveNoRecords')}</p> : <ol className="qp-live-feed">{display.feed.rows.map(row => <li key={row.event_id}><span>{date(row.timestamp_ms)} · {row.harness} · {row.provider ?? t('redesign.unknownValue')} · {row.model ?? t('redesign.unknownValue')}<small>{row.grain === 'call' ? t('redesign.callRecord') : t('redesign.aggregateUpdate')}</small></span><strong>{number(row.total_tokens)}</strong></li>)}</ol>}
            <div className="qp-live-pagination"><button disabled={paused || route.feedOffset === 0} onClick={() => update({ feedOffset: Math.max(0, route.feedOffset - 8) })}>{t('redesign.livePrevious')}</button><span>{number(display.feed.total)} {t('redesign.records')}</span><button disabled={paused || route.feedOffset + display.feed.rows.length >= display.feed.total} onClick={() => update({ feedOffset: route.feedOffset + 8 })}>{t('redesign.liveNext')}</button></div>
          </section>
        </div>
        <aside className="qp-live-rail">
          <section className="qp-panel qp-live-section"><h2>{t('redesign.liveAdvisory')}</h2>{advisories.length === 0 ? <p>{t('redesign.liveNoAdvisory')}</p> : <ol>{advisories.map(source => <li key={source.source_id}><AlertTriangle size={15}/><span>{source.display_name} · {t(source.telemetry.reason === 'usage_newer_than_quota' ? 'redesign.liveUsageAheadQuota' : source.telemetry.reason === 'reader_error' ? 'redesign.liveReaderErrorNote' : 'redesign.liveQuotaReview')}</span><a href="#settings?section=diagnostics">{t('redesign.liveDiagnostics')}</a></li>)}</ol>}</section>
          <section className="qp-panel qp-live-section"><h2>{t('redesign.liveMatrix')}</h2><p className="qp-footnote">{t('redesign.liveMatrixNote')} {t('redesign.liveMatrixTop')}</p>{(route.provider || route.model) && <button disabled={paused} className="qp-live-clear" onClick={() => update({ provider: null, model: null, feedOffset: 0, sessionOffset: 0 })}>{t('redesign.liveClearMatrix')}</button>}
            <ol className="qp-live-matrix">{display.models.groups.slice(0, 12).map((group, index) => <li key={JSON.stringify([group.provider, group.model, index])}>{group.provider && group.model ? <button disabled={paused} aria-pressed={route.provider === group.provider && route.model === group.model} onClick={() => update({ provider: group.provider, model: group.model, feedOffset: 0, sessionOffset: 0 })}><span>{group.provider} · {group.model}</span><strong>{number(group.tokens)}</strong></button> : <span>{group.provider ?? t('redesign.unknownValue')} · {group.model ?? t('redesign.unknownValue')}<strong>{number(group.tokens)}</strong></span>}</li>)}</ol>
          </section>
        </aside>
      </div>
    </>}
    <dialog ref={dialog} className="qp-live-dialog" onClose={() => { setSelectedSession(null); returnFocus.current?.focus(); }}>{selectedSession && <><div className="qp-live-section-head"><h2>{t('redesign.liveSessionDetail')}</h2><button autoFocus onClick={() => dialog.current?.close()} aria-label={t('redesign.close')}><X size={18}/></button></div><dl><dt>{t('redesign.sessions')}</dt><dd>{selectedSession.nativeSessionId}</dd><dt>{t('redesign.project')}</dt><dd>{selectedSession.project ?? t('redesign.unassigned')}</dd><dt>{t('redesign.liveSourceTime')}</dt><dd>{sourceDate(selectedSession.lastSeenAt)}</dd><dt>{t('redesign.liveObservedTime')}</dt><dd>{date(selectedSession.lastObservedAt)}</dd><dt>{t('redesign.tokens')}</dt><dd>{number(selectedSession.tokens)}</dd><dt>{t('redesign.projectObservedPaths')}</dt><dd>{selectedSession.cwd ?? t('redesign.projectUnknownPath')}</dd></dl><a href={historyHref({ session_id: String(selectedSession.sessionKey), ...(route.provider ? { provider: route.provider } : {}), ...(route.model ? { model: route.model } : {}), ...(route.q ? { q: route.q } : {}) })}>{t('redesign.openHistory')}</a></>}</dialog>
  </RedesignShell>;
}
