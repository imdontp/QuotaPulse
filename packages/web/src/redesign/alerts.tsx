import { useEffect, useMemo, useRef, useState } from 'react';
import { BellRing, RefreshCw, Activity, ShieldCheck, Gauge, Lightbulb, History, ChartNoAxesCombined, TriangleAlert, ArrowLeftRight, Clock3, Cable, ChevronRight } from 'lucide-react';
import { api, type AlertEvent, type Limit, type NotificationSettings, type Overview } from '@/api';
import { useI18n, useT } from '@/i18n';
import { useFormat } from '@/i18n/format';
import { countdown } from '@/format';
import { useLiveRefresh, useRefreshStatus } from '@/lib/use-live';
import { useTheme } from '@/lib/use-theme';
import { RedesignShell } from './shell';
import { VendorIcon } from '@/components/vendor-icon';
import { QuotaChart } from './quota-chart';
import { PageHeading } from './page-heading';
import { getQuotaRiskModel, isQuotaReadingFresh, quotaOwnerKey as ownerKey, quotaWindowKey as windowKey, type QuotaRisk as Risk } from './alert-risks';
import { AlertHistoryCache, currentQuotaForecast, observedQuotaSeries, type AlertHistoryResult } from './alert-history';
import './alerts.css';

function routeWindow() {
  const p = new URLSearchParams(location.hash.split('?')[1] ?? '');
  return { owner: p.get('owner'), window: p.get('window') };
}

export function ProductionAlerts() {
  const t = useT();
  const f = useFormat();
  const { lang, setLang } = useI18n();
  const [theme, toggleTheme] = useTheme();
  const [route, setRoute] = useState(routeWindow);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [events, setEvents] = useState<AlertEvent[]>([]);
  const [notification, setNotification] = useState<NotificationSettings | null>(null);
  const [level, setLevel] = useState<Risk['level'] | 'all'>('all');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<'severity' | 'recent'>('severity');
  const [histories, setHistories] = useState<Map<string, AlertHistoryResult>>(new Map());
  const historyCache = useRef<AlertHistoryCache>();
  if (!historyCache.current) historyCache.current = new AlertHistoryCache(scope => api.quotaHistory(scope));
  const historyGeneration = useRef(0);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; historyGeneration.current++; }; }, []);
  const [showAll, setShowAll] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const refresh = useRefreshStatus();
  useEffect(() => {
    const sync = () => { if (location.hash.slice(1).split('?')[0] === 'alerts') setRoute(routeWindow()); };
    addEventListener('hashchange', sync);
    return () => removeEventListener('hashchange', sync);
  }, []);
  useLiveRefresh(async () => {
    try {
      const [nextOverview, nextEvents, nextNotification] = await Promise.all([api.overview(), api.alerts({ limit: showAll ? 500 : 100 }), api.notificationSettings()]);
      setOverview(nextOverview); setEvents(nextEvents.events); setNotification(nextNotification); setError(null);
    } catch (cause) { setError(String(cause)); throw cause; }
  }, [showAll]);

  const now = overview?.now ?? Date.now();
  const riskModel = getQuotaRiskModel(overview?.limits ?? [], overview?.settings.hidden_subscriptions ?? [], now);
  const { windows, risks, activeRisks, freshCount } = riskModel;
  const selected = windows.find(({ primary }) => ownerKey(primary) === route.owner && primary.window_kind === route.window) ??
    windows.find(({ primary }) => primary.forecast?.status === 'ready' && primary.forecast.projectedFullAt != null) ?? windows[0];
  const selectionKey = selected ? windowKey(selected.primary) : '';
  const query = search.trim().toLocaleLowerCase();
  const filteredRisks = risks.filter(risk => (level === 'all' || risk.level === level) &&
    [risk.title, risk.owner, risk.window, risk.reading.subscription_provider, risk.reading.account_provider,
      t(risk.reason === 'forecast' ? 'redesign.alertForecast' : risk.reason === 'stale' ? 'redesign.alertStale' : 'redesign.alertThreshold')]
      .some(value => value?.toLocaleLowerCase().includes(query)))
    .sort((a, b) => sort === 'recent' ? b.reading.last_seen_at - a.reading.last_seen_at || a.title.localeCompare(b.title) : 0);
  const requestedReadings = [...(selected ? [selected.primary] : []), ...filteredRisks.map(risk => risk.reading)];
  const requestedKeys = [...new Map(requestedReadings.map(reading => [windowKey(reading), reading])).values()].slice(0, 6);
  const historySignature = JSON.stringify(requestedKeys.map(reading => [windowKey(reading), reading.source_id, reading.origin, reading.last_seen_at, reading.resets_at, reading.used_percent, isQuotaReadingFresh(reading, now)]));
  const renderedHistorySignature = useRef(historySignature);
  if (renderedHistorySignature.current !== historySignature) {
    renderedHistorySignature.current = historySignature;
    historyGeneration.current++;
  }
  useLiveRefresh(async context => {
    if (!overview) return;
    const generation = ++historyGeneration.current;
    const next = await historyCache.current!.load(requestedKeys, now, ['manual', 'visible', 'online'].includes(context.reason));
    if (mounted.current && generation === historyGeneration.current) setHistories(next);
  }, [historySignature]);
  const history = histories.get(selectionKey)?.data ?? null;
  const quotaError = histories.get(selectionKey)?.error ?? null;
  const forecast = currentQuotaForecast(history, selected?.primary, now);
  const resetAt = history?.reader?.resetAt;
  const forecastGap = forecast?.status === 'ready' && forecast.projectedFullAt != null && resetAt != null && forecast.projectedFullAt < resetAt
    ? resetAt - forecast.projectedFullAt < 60_000 ? '<1m' : countdown(resetAt, forecast.projectedFullAt) : null;
  const readerAdvisories = (overview?.sourceStatus ?? []).filter(source => source.enabled &&
    (source.telemetry.reason === 'reader_error' || source.account_state === 'unavailable') &&
    !overview?.settings.hidden_subscriptions.includes(source.account_key ?? ''));
  const pick = (reading: Limit) => {
    const owner = ownerKey(reading);
    const window = reading.window_kind;
    const p = new URLSearchParams({ mode: 'redesign', owner, window });
    historyReplace(`#alerts?${p}`);
    setRoute({ owner, window });
  };
  const changeNotifications = async () => {
    if (!notification || busy) return;
    setBusy(true);
    try { setNotification(await api.updateNotificationSettings({ enabled: !notification.enabled })); setError(null); }
    catch (cause) { setError(String(cause)); }
    finally { setBusy(false); }
  };
  const ownerHref = (risk: Risk) => `#providers?${new URLSearchParams({ owner: risk.owner, window: risk.window })}`;
  const levelLabel = (level: Risk['level']) => t(level === 'critical' ? 'redesign.alertCritical' : level === 'warning' ? 'redesign.alertWarning' : level === 'info' ? 'redesign.alertInfo' : 'redesign.providerStale');
  const count = (value: number) => new Intl.NumberFormat(lang === 'th' ? 'th-TH' : 'en-US').format(value);
  const selectedOwnerHref = selected ? `#providers?${new URLSearchParams({ owner: ownerKey(selected.primary), window: selected.primary.window_kind })}` : null;
  const guidanceSourceId = history?.reader?.sourceId ?? selected?.primary.source_id;
  const guidanceSource = overview?.sourceStatus.find(source => source.source_id === guidanceSourceId);
  const guidanceSourceName = guidanceSource?.display_name ?? (guidanceSourceId != null ? `${t('redesign.alertGuidanceSource')} ${count(guidanceSourceId)}` : t('redesign.alertGuidanceNoReader'));
  const guidanceDiagnosticsHref = guidanceSourceId != null && Number.isSafeInteger(guidanceSourceId) && guidanceSourceId > 0
    ? `#settings?section=diagnostics&source=${guidanceSourceId}` : null;
  const guidanceReaderNeedsReview = guidanceSource?.telemetry.reason === 'reader_error' || guidanceSource?.account_state === 'unavailable';
  const guidanceReset = !selected ? t('redesign.alertGuidanceNoQuota') : quotaError ? t('redesign.providerUnavailable') : !history ? t('app.loading')
    : resetAt != null && resetAt > now ? `${t('redesign.alertGuidanceReportedReset')} ${f.clock(resetAt)}` : t('redesign.alertGuidanceResetUnknown');
  const quietClock = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
  const guidanceNotificationFacts = notification ? [
    t(notification.enabled ? 'redesign.alertGuidanceNotificationsOn' : 'redesign.alertGuidanceNotificationsOff'),
    ...(notification.snooze_until != null && notification.snooze_until > now
      ? [`${t('redesign.alertGuidanceSnoozedUntil')} ${f.clock(notification.snooze_until)}`] : []),
    ...(notification.quiet_start != null && notification.quiet_end != null && notification.quiet_start !== notification.quiet_end
      ? [`${t('redesign.alertGuidanceQuietHours')} ${quietClock(notification.quiet_start)}–${quietClock(notification.quiet_end)}`] : []),
  ].join(' · ') : t('redesign.providerUnavailable');

  return <RedesignShell active="alerts" theme={theme} language={lang} onTheme={toggleTheme} onLanguage={() => setLang(lang === 'en' ? 'th' : 'en')} t={t} testId="production-alerts">
    <div className="qp-alert-layout"><div className="qp-alert-main"><section className="qp-panel qp-alert-top"><header className="qp-alert-header"><PageHeading icon={<BellRing size={24}/>} title={t('redesign.alertHeading')} subtitle={t('redesign.alertSubtitle')}/><div className="qp-alert-controls"><label><input type="checkbox" checked={notification?.enabled ?? false} disabled={!notification || busy} onChange={() => void changeNotifications()}/><span>{t('redesign.alertNotifications')}</span></label><button onClick={() => void refresh.refreshNow()} disabled={refresh.refreshing}><RefreshCw size={16}/>{t('app.refreshNow')}</button></div></header>
    <p className="qp-footnote">{t('redesign.alertCollectionNote')} · <a href="#settings">{t('redesign.alertSettings')}</a></p>
    {error && <p className="qp-alert-error" role="status">{t('redesign.staleSnapshot')} · {error}</p>}
    {!overview ? <p role="status">{error ?? t('app.loading')}</p> :

      <section className="qp-alert-summary" aria-label={t('redesign.alertHeading')}><article className="qp-panel" data-summary="redesign.alertCurrent" data-level={activeRisks[0]?.level ?? 'none'}><BellRing className="qp-alert-summary-icon" size={20} aria-hidden="true"/><span>{t('redesign.alertCurrent')}</span><strong>{count(activeRisks.length)}</strong></article><article className="qp-panel" data-summary="redesign.alertMonitored"><Activity className="qp-alert-summary-icon" size={20} aria-hidden="true"/><span>{t('redesign.alertMonitored')}</span><strong>{count(windows.length)}</strong></article><article className="qp-panel" data-summary="redesign.alertRules"><ShieldCheck className="qp-alert-summary-icon" size={20} aria-hidden="true"/><span>{t('redesign.alertRules')}</span><strong>3</strong><small>50% · 80% · 95%</small></article><article className="qp-panel" data-summary="redesign.alertCoverage"><Gauge className="qp-alert-summary-icon" size={20} aria-hidden="true"/><span>{t('redesign.alertCoverage')}</span><strong>{windows.length ? f.pct(freshCount / windows.length * 100) : t('redesign.unknownValue')}</strong><small>{count(freshCount)} / {count(windows.length)}</small></article></section>}</section>{overview && <><section className="qp-panel qp-alert-chart" data-history-key={history ? JSON.stringify([history.subscriptionKey, history.windowKind]) : undefined}><div className="qp-alert-section-head"><div className="qp-alert-chart-heading"><h2><ChartNoAxesCombined size={18} aria-hidden="true"/>{t('redesign.alertRiskChart')}</h2><p className="qp-footnote">{t('redesign.alertResetBreak')}</p></div>{windows.length > 0 && <label><span className="qp-visually-hidden">{t('redesign.alertRiskChart')}</span><select value={selectionKey} onChange={event => { const item = windows.find(({ primary }) => windowKey(primary) === event.target.value); if (item) pick(item.primary); }}>{windows.map(({ primary }) => <option key={windowKey(primary)} value={windowKey(primary)}>{primary.subscription_display_name ?? primary.display_name} · {f.window(primary.window_kind)}</option>)}</select></label>}</div>{windows.length === 0 ? <p>{t('redesign.alertNoWindows')}</p> : quotaError ? <p role="status">{quotaError}</p> : !history ? <p>{t('app.loading')}</p> : history.segments.length === 0 ? <p>{t('redesign.alertNoHistory')}</p> : <QuotaChart history={history} t={t} language={lang}/>}</section>
        <section className="qp-panel qp-alert-risk" aria-label={t('redesign.alertRisks')}>
          <div className="qp-alert-risk-toolbar"><h2><BellRing size={18} aria-hidden="true"/>{t('redesign.alertRisks')}</h2>
            <div className="qp-alert-risk-filters" role="group" aria-label={t('redesign.alertFilter')}>
              {(['all', 'critical', 'warning', 'info', 'stale'] as const).map(item => <button key={item} type="button" data-level={item} aria-pressed={level === item} onClick={() => setLevel(item)}>{item === 'all' ? t('redesign.alertAll') : levelLabel(item)} <span>{count(item === 'all' ? risks.length : risks.filter(risk => risk.level === item).length)}</span></button>)}
            </div>
            <label className="qp-alert-risk-search"><span className="qp-visually-hidden">{t('history.search')}</span><input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder={t('history.search')}/></label>
            <label><span className="qp-visually-hidden">{t('redesign.alertSort')}</span><select aria-label={t('redesign.alertSort')} value={sort} onChange={event => setSort(event.target.value as 'severity' | 'recent')}><option value="severity">{t('redesign.alertSeverity')}</option><option value="recent">{t('redesign.sortRecent')}</option></select></label>
          </div>
          {filteredRisks.length === 0 && <p role="status">{t(risks.length === 0 ? 'redesign.alertNoRisks' : 'redesign.alertNoMatch')}</p>}
          {(filteredRisks.length > 0 || readerAdvisories.length > 0) && <ul tabIndex={0} aria-label={t('redesign.alertRisks')}>
          {filteredRisks.map(risk => <li key={risk.key} data-level={risk.level} data-owner={risk.owner} data-window={risk.window}>
            <span className="qp-alert-risk-icon" data-level={risk.level} aria-hidden="true">{risk.reason === 'forecast' ? <TriangleAlert size={23}/> : risk.reason === 'stale' ? <Clock3 size={23}/> : <BellRing size={23}/>}</span>
            <div className="qp-alert-risk-description"><div className="qp-alert-risk-heading"><strong>{t(risk.reason === 'forecast' ? 'redesign.alertForecast' : risk.reason === 'stale' ? 'redesign.alertStale' : 'redesign.alertThreshold')}</strong><span className="qp-alert-level" data-level={risk.level}>{levelLabel(risk.level)}</span></div><p>{f.clock(risk.reading.last_seen_at)}</p></div>
            <div className="qp-alert-risk-owner"><strong className="qp-alert-owner"><VendorIcon vendor={risk.reading.subscription_provider ?? risk.reading.account_provider ?? 'unknown'}/>{risk.title}</strong><small>{f.window(risk.window)}</small></div>
            <RiskSparkline risk={risk} result={histories.get(risk.key)} t={t} now={now}/>
            <div className="qp-alert-risk-value"><strong>{isQuotaReadingFresh(risk.reading, now) && risk.reading.used_percent !== null ? f.pct(risk.reading.used_percent) : t('redesign.unknownValue')}</strong><small>{t('redesign.alertQuotaPercent')}</small></div>
            <a href={ownerHref(risk)}>{t('redesign.alertOpenProvider')}</a>
          </li>)}
          {readerAdvisories.map(source => <li key={`source:${source.source_id}`} data-advisory="reader">
            <span className="qp-alert-risk-icon" data-level="stale" aria-hidden="true"><Cable size={23}/></span>
            <div><strong>{source.display_name}</strong><p>{t('redesign.alertReaderAdvisory')}</p></div>
            <a href={`#settings?section=diagnostics&source=${source.source_id}`}>{t('redesign.providerDiagnostics')}</a>
          </li>)}
          </ul>}
        </section>
        <section className="qp-panel qp-alert-rules"><h2><ShieldCheck size={18} aria-hidden="true"/>{t('redesign.alertThresholdTable')}</h2><p className="qp-footnote">{t('redesign.alertThresholdNote')}</p><div className="qp-alert-rule-table"><table><thead><tr><th>{t('redesign.alertThresholdTable')}</th><th>{t('redesign.alertRisks')}</th></tr></thead><tbody>{([50,80,95] as const).map(threshold => <tr key={threshold}><td><span data-threshold={threshold}>{threshold}%</span></td><td>{levelLabel(threshold === 95 ? 'critical' : threshold === 80 ? 'warning' : 'info')}</td></tr>)}</tbody></table></div></section></>}
      </div>{overview && <aside className="qp-alert-rail"><section className="qp-panel qp-alert-forecast"><h2><Gauge size={18} aria-hidden="true"/>{t('redesign.alertForecastPanel')}</h2>{selected && history?.reader ? <><div className="qp-alert-forecast-reading"><div className="qp-alert-forecast-orb"><div><strong data-testid="alert-forecast-days">{forecast?.status === 'ready' && forecast.projectedFullAt != null ? new Intl.NumberFormat(lang === 'th' ? 'th-TH' : 'en-US', { maximumFractionDigits: 1 }).format(Math.max(0, (forecast.projectedFullAt - now) / 86_400_000)) : t('redesign.unknownValue')}</strong><span>{t('redesign.alertForecastDays')}</span></div></div><div className="qp-alert-forecast-facts"><strong className="qp-alert-owner"><VendorIcon vendor={selected.primary.subscription_provider ?? selected.primary.account_provider ?? 'unknown'}/>{selected.primary.subscription_display_name ?? selected.primary.display_name} · {f.window(selected.primary.window_kind)}</strong><dl><div><dt>{t('redesign.projected')}</dt><dd>{forecast?.status === 'ready' && forecast.projectedFullAt != null ? f.clock(forecast.projectedFullAt) : t('redesign.alertForecastUnknown')}</dd></div><div><dt>{t('redesign.alertReset')}</dt><dd>{f.clock(history.reader.resetAt)}</dd></div></dl><small>{history.reader.origin} · {f.age(history.reader.ageSeconds)}</small></div></div>{forecastGap !== null && <div className="qp-alert-forecast-warning"><TriangleAlert size={28} aria-hidden="true"/><div><strong>{t('redesign.alertForecast')}</strong><span>{forecastGap} {t('redesign.beforeReset')}</span></div></div>}</> : <p>{t('redesign.alertForecastUnknown')}</p>}</section><section className="qp-panel qp-alert-guidance">
  <div className="qp-alert-guidance-heading">
    <span className="qp-alert-guidance-icon" aria-hidden="true"><Lightbulb size={22}/></span>
    <div><h2>{t('redesign.alertGuidance')}</h2><p>{t('redesign.alertGuidanceNote')}</p></div>
  </div>
  <ul className="qp-alert-guidance-list">
    <li data-guidance="quota">
      <span className="qp-alert-guidance-icon" aria-hidden="true"><ArrowLeftRight size={20}/></span>
      <div><strong>{t('redesign.alertGuidanceQuota')}</strong><p>{selected ? <>{selected.primary.subscription_display_name ?? selected.primary.display_name} · {f.window(selected.primary.window_kind)} · {isQuotaReadingFresh(selected.primary, now) && selected.primary.used_percent !== null ? f.pct(selected.primary.used_percent) : t('redesign.providerUnavailable')}</> : t('redesign.alertGuidanceNoQuota')}</p></div>
      {selectedOwnerHref && <a href={selectedOwnerHref} aria-label={`${t('redesign.alertGuidanceOpen')}: ${t('redesign.alertGuidanceQuota')}`}>{t('redesign.alertGuidanceOpen')}<ChevronRight size={12} aria-hidden="true"/></a>}
    </li>
    <li data-guidance="reset">
      <span className="qp-alert-guidance-icon" aria-hidden="true"><Clock3 size={20}/></span>
      <div><strong>{t('redesign.alertGuidanceReset')}</strong><p>{guidanceReset}</p></div>
      {selectedOwnerHref && <a href={selectedOwnerHref} aria-label={`${t('redesign.alertGuidanceView')}: ${t('redesign.alertGuidanceReset')}`}>{t('redesign.alertGuidanceView')}<ChevronRight size={12} aria-hidden="true"/></a>}
    </li>
    <li data-guidance="reader">
      <span className="qp-alert-guidance-icon" aria-hidden="true"><Cable size={20}/></span>
      <div><strong>{t('redesign.alertGuidanceReader')}</strong><p>{guidanceDiagnosticsHref ? <>{guidanceSourceName} · {t(guidanceReaderNeedsReview ? 'redesign.alertReaderAdvisory' : 'redesign.alertGuidanceReaderDetails')}</> : t('redesign.alertGuidanceNoReader')}</p></div>
      {guidanceDiagnosticsHref && <a href={guidanceDiagnosticsHref} aria-label={`${t('redesign.alertGuidanceOpen')}: ${t('redesign.alertGuidanceReader')}`}>{t('redesign.alertGuidanceOpen')}<ChevronRight size={12} aria-hidden="true"/></a>}
    </li>
    <li data-guidance="notifications">
      <span className="qp-alert-guidance-icon" aria-hidden="true"><BellRing size={20}/></span>
      <div><strong>{t('redesign.alertGuidanceNotifications')}</strong><p>{guidanceNotificationFacts}</p></div>
      <a href="#settings" aria-label={`${t('redesign.alertGuidanceSettings')}: ${t('redesign.alertGuidanceNotifications')}`}>{t('redesign.alertGuidanceSettings')}<ChevronRight size={12} aria-hidden="true"/></a>
    </li>
  </ul>
</section><section className="qp-panel qp-alert-history"><div className="qp-alert-history-heading"><h2><span className="qp-alert-history-heading-icon" aria-hidden="true"><History size={18}/></span>{t('redesign.alertHistory')}</h2><button onClick={() => setShowAll(!showAll)}>{t(showAll ? 'redesign.alertLess' : 'redesign.alertMore')}</button></div><p className="qp-footnote">{t('redesign.alertHistoryNote')}</p>{events.length === 0 ? <p>{t('redesign.alertNoEvents')}</p> : <ol tabIndex={0} aria-label={t('redesign.alertHistory')}>{events.map(event => <li key={event.id}><span className="qp-alert-event-threshold" data-threshold={event.threshold}>{event.threshold}%</span><strong>{event.subscription_display_name ?? event.display_name} · {f.window(event.window_kind)}</strong><span className="qp-alert-event-date">{f.clock(event.detected_at)} · {t(event.delivered_at ? 'redesign.alertDelivered' : 'redesign.alertDetected')}</span></li>)}</ol>}</section></aside>}</div>
  </RedesignShell>;
}

function historyReplace(hash: string) {
  history.replaceState(null, '', `${location.pathname}${location.search}${hash}`);
}

function RiskSparkline({ risk, result, t, now }: { risk: Risk; result?: AlertHistoryResult; t: ReturnType<typeof useT>; now: number }) {
  const f = useFormat();
  const history = result?.data;
  const series = useMemo(() => history ? observedQuotaSeries(history) : null, [history]);
  const missing = !result ? 'redesign.alertHistoryNotLoaded' : result.error ? 'redesign.providerUnavailable' : 'redesign.alertNoHistory';
  if (!history?.available || !history.reader || !series?.displayedSamples) return <span className="qp-alert-risk-spark qp-alert-risk-spark-empty">{t(missing)}</span>;
  const freshness = !isQuotaReadingFresh(risk.reading, now) || risk.level === 'stale' ? 'stale' : history.reader.freshness;
  const age = Math.round((now - Math.max(history.reader.lastSeenAt, history.reader.sourceFetchedAt ?? 0)) / 1000);
  const label = `${risk.title} · ${f.window(risk.window)} · ${t('redesign.alertQuotaPercent')} · ${new Date(series.first).toISOString()} – ${new Date(series.last).toISOString()} · ${t('redesign.alertGuidanceSource')} ${history.reader.sourceId} · ${history.reader.origin} · ${freshness} · ${f.age(age)} · ${t('redesign.alertObservedSamples')}: ${series.displayedSamples} / ${series.totalSamples}`;
  return <div className="qp-alert-risk-spark" data-freshness={freshness}>
    {series.points.length === 0 ? <span role="img" aria-label={label}>{t('redesign.unknownValue')}</span> : <svg viewBox="0 0 100 32" role="img" aria-label={label}><title>{label}</title>
      {series.lines.map((line, i) => <line key={i} {...line}/>)}
      {series.points.map((point, i) => <circle key={i} cx={point.x} cy={point.y} r="1.5"><title>{f.clock(point.at)} · {f.pct(point.percent)}</title></circle>)}
    </svg>}
    <small title={label}>{freshness === 'stale' || freshness === 'expired' || freshness === 'unknown' ? t('redesign.providerStale') : f.age(age)}</small>
  </div>;
}
