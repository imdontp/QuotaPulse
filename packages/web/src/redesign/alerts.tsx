import { useEffect, useState } from 'react';
import { BellRing, RefreshCw, Activity, ShieldCheck, Gauge, Lightbulb, History, ChartNoAxesCombined } from 'lucide-react';
import { api, type AlertEvent, type Limit, type NotificationSettings, type Overview, type QuotaHistoryResponse } from '@/api';
import { useI18n, useT } from '@/i18n';
import { useFormat } from '@/i18n/format';
import { useLiveRefresh, useRefreshStatus } from '@/lib/use-live';
import { useTheme } from '@/lib/use-theme';
import { RedesignShell } from './shell';
import { VendorIcon } from '@/components/vendor-icon';
import { QuotaChart } from './quota-chart';
import { PageHeading } from './page-heading';
import { getQuotaRiskModel, isQuotaReadingFresh, quotaOwnerKey as ownerKey, quotaWindowKey as windowKey, type QuotaRisk as Risk } from './alert-risks';
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
  const [quota, setQuota] = useState<{ key: string; data: QuotaHistoryResponse } | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quotaError, setQuotaError] = useState<string | null>(null);
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
  useEffect(() => {
    if (!selected) return;
    let cancelled = false;
    const owner = ownerKey(selected.primary);
    const window = selected.primary.window_kind;
    setQuotaError(null);
    void api.quotaHistory({ subscriptionKey: owner, windowKind: window, from: Math.max(0, now - 30 * 86_400_000), to: now + 1 }).then(data => {
      if (!cancelled) setQuota({ key: selectionKey, data });
    }).catch(cause => { if (!cancelled) setQuotaError(String(cause)); });
    return () => { cancelled = true; };
  }, [selectionKey, now]);
  const history = quota?.key === selectionKey ? quota.data : null;
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

  return <RedesignShell active="alerts" theme={theme} language={lang} onTheme={toggleTheme} onLanguage={() => setLang(lang === 'en' ? 'th' : 'en')} t={t} testId="production-alerts">
    <div className="qp-alert-layout"><div className="qp-alert-main"><header className="qp-alert-header"><PageHeading icon={<BellRing size={24}/>} title={t('redesign.alertHeading')} subtitle={t('redesign.alertSubtitle')}/><div className="qp-alert-controls"><label><input type="checkbox" checked={notification?.enabled ?? false} disabled={!notification || busy} onChange={() => void changeNotifications()}/><span>{t('redesign.alertNotifications')}</span></label><button onClick={() => void refresh.refreshNow()} disabled={refresh.refreshing}><RefreshCw size={16}/>{t('app.refreshNow')}</button></div></header>
    <p className="qp-footnote">{t('redesign.alertCollectionNote')} · <a href="#settings">{t('redesign.alertSettings')}</a></p>
    {error && <p className="qp-alert-error" role="status">{t('redesign.staleSnapshot')} · {error}</p>}
    {!overview ? <p className="qp-panel" role="status">{error ?? t('app.loading')}</p> : <>

      <section className="qp-alert-summary" aria-label={t('redesign.alertHeading')}><article className="qp-panel" data-summary="redesign.alertCurrent"><BellRing className="qp-alert-summary-icon" size={20} aria-hidden="true"/><span>{t('redesign.alertCurrent')}</span><strong>{count(activeRisks.length)}</strong></article><article className="qp-panel" data-summary="redesign.alertMonitored"><Activity className="qp-alert-summary-icon" size={20} aria-hidden="true"/><span>{t('redesign.alertMonitored')}</span><strong>{count(windows.length)}</strong></article><article className="qp-panel" data-summary="redesign.alertRules"><ShieldCheck className="qp-alert-summary-icon" size={20} aria-hidden="true"/><span>{t('redesign.alertRules')}</span><strong>3</strong><small>50% · 80% · 95%</small></article><article className="qp-panel" data-summary="redesign.alertCoverage"><Gauge className="qp-alert-summary-icon" size={20} aria-hidden="true"/><span>{t('redesign.alertCoverage')}</span><strong>{windows.length ? f.pct(freshCount / windows.length * 100) : t('redesign.unknownValue')}</strong><small>{count(freshCount)} / {count(windows.length)}</small></article></section><section className="qp-panel qp-alert-chart"><div className="qp-alert-section-head"><h2><ChartNoAxesCombined size={18} aria-hidden="true"/>{t('redesign.alertRiskChart')}</h2>{windows.length > 0 && <label><span className="qp-visually-hidden">{t('redesign.alertRiskChart')}</span><select value={selectionKey} onChange={event => { const item = windows.find(({ primary }) => windowKey(primary) === event.target.value); if (item) pick(item.primary); }}>{windows.map(({ primary }) => <option key={windowKey(primary)} value={windowKey(primary)}>{primary.subscription_display_name ?? primary.display_name} · {f.window(primary.window_kind)}</option>)}</select></label>}</div><p className="qp-footnote">{t('redesign.alertResetBreak')}</p>{windows.length === 0 ? <p>{t('redesign.alertNoWindows')}</p> : quotaError ? <p role="status">{quotaError}</p> : !history ? <p>{t('app.loading')}</p> : history.segments.length === 0 ? <p>{t('redesign.alertNoHistory')}</p> : <QuotaChart history={history} t={t} language={lang}/>}</section>
        <section className="qp-panel qp-alert-risk" aria-label={t('redesign.alertRisks')}><h2><BellRing size={18} aria-hidden="true"/>{t('redesign.alertRisks')}</h2>{risks.length === 0 ? <p>{t('redesign.alertNoRisks')}</p> : <ul tabIndex={0} aria-label={t('redesign.alertRisks')}>{risks.map(risk => <li key={risk.key} data-level={risk.level}><span className="qp-alert-level" data-level={risk.level}>{levelLabel(risk.level)}</span><div><strong className="qp-alert-owner"><VendorIcon vendor={risk.reading.subscription_provider ?? risk.reading.account_provider ?? 'unknown'}/>{risk.title} · {f.window(risk.window)}</strong><p>{t(risk.reason === 'forecast' ? 'redesign.alertForecast' : risk.reason === 'stale' ? 'redesign.alertStale' : 'redesign.alertThreshold')} · {isQuotaReadingFresh(risk.reading, now) && risk.reading.used_percent !== null ? f.pct(risk.reading.used_percent) : t('redesign.unknownValue')}</p></div><a href={ownerHref(risk)}>{t('redesign.alertOpenProvider')}</a></li>)}</ul>}{readerAdvisories.length > 0 && <ul>{readerAdvisories.map(source => <li key={`source:${source.source_id}`}><span className="qp-alert-level" data-level="stale">{t('redesign.alertInfo')}</span><div><strong>{source.display_name}</strong><p>{t('redesign.alertReaderAdvisory')}</p></div><a href={`#settings?section=diagnostics&source=${source.source_id}`}>{t('redesign.providerDiagnostics')}</a></li>)}</ul>}</section>
        <section className="qp-panel qp-alert-rules"><h2><ShieldCheck size={18} aria-hidden="true"/>{t('redesign.alertThresholdTable')}</h2><p className="qp-footnote">{t('redesign.alertThresholdNote')}</p><div className="qp-alert-rule-table"><table><thead><tr><th>{t('redesign.alertThresholdTable')}</th><th>{t('redesign.alertRisks')}</th></tr></thead><tbody>{([50,80,95] as const).map(threshold => <tr key={threshold}><td><span data-threshold={threshold}>{threshold}%</span></td><td>{levelLabel(threshold === 95 ? 'critical' : threshold === 80 ? 'warning' : 'info')}</td></tr>)}</tbody></table></div></section></>}
      </div>{overview && <aside className="qp-alert-rail"><section className="qp-panel qp-alert-forecast"><h2><Gauge size={18} aria-hidden="true"/>{t('redesign.alertForecastPanel')}</h2>{selected && history?.reader ? <><strong className="qp-alert-owner"><VendorIcon vendor={selected.primary.subscription_provider ?? selected.primary.account_provider ?? 'unknown'}/>{selected.primary.subscription_display_name ?? selected.primary.display_name} · {f.window(selected.primary.window_kind)}</strong><div className="qp-alert-forecast-orb"><div><strong data-testid="alert-forecast-days">{history.reader.forecast.status === 'ready' && history.reader.forecast.projectedFullAt != null ? new Intl.NumberFormat(lang === 'th' ? 'th-TH' : 'en-US', { maximumFractionDigits: 1 }).format(Math.max(0, (history.reader.forecast.projectedFullAt - now) / 86_400_000)) : t('redesign.unknownValue')}</strong><span>{t('redesign.alertForecastDays')}</span></div></div><p>{history.reader.forecast.status === 'ready' && history.reader.forecast.projectedFullAt != null ? f.clock(history.reader.forecast.projectedFullAt) : t('redesign.alertForecastUnknown')}</p><p>{t('redesign.alertReset')}: {f.clock(history.reader.resetAt)}</p><small>{history.reader.origin} · {f.age(history.reader.ageSeconds)}</small></> : <p>{t('redesign.alertForecastUnknown')}</p>}</section><section className="qp-panel qp-alert-guidance"><h2><Lightbulb size={18} aria-hidden="true"/>{t('redesign.alertGuidance')}</h2><p>{t('redesign.alertGuidanceNote')}</p>{risks[0] && <a href={ownerHref(risks[0])}>{t('redesign.alertOpenProvider')}</a>}</section><section className="qp-panel qp-alert-history"><h2><History size={18} aria-hidden="true"/>{t('redesign.alertHistory')}</h2><p className="qp-footnote">{t('redesign.alertHistoryNote')}</p>{events.length === 0 ? <p>{t('redesign.alertNoEvents')}</p> : <ol tabIndex={0} aria-label={t('redesign.alertHistory')}>{events.map(event => <li key={event.id}><span className="qp-alert-event-threshold" data-threshold={event.threshold}>{event.threshold}%</span><strong>{event.subscription_display_name ?? event.display_name} · {f.window(event.window_kind)}</strong><span className="qp-alert-event-date">{f.clock(event.detected_at)} · {t(event.delivered_at ? 'redesign.alertDelivered' : 'redesign.alertDetected')}</span></li>)}</ol>}<button onClick={() => setShowAll(!showAll)}>{t(showAll ? 'redesign.alertLess' : 'redesign.alertMore')}</button></section></aside>}</div>
  </RedesignShell>;
}

function historyReplace(hash: string) {
  history.replaceState(null, '', `${location.pathname}${location.search}${hash}`);
}
