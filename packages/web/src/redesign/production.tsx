import { useEffect, useRef, useState } from 'react';
import { api, type CompareResult, type Overview as OverviewData, type QuotaHistoryResponse, type UsageRangeKey, type UsageResponse } from '@/api';
import { isExpired, primaryLimits } from '@/format';
import { useI18n, useT } from '@/i18n';
import { useLiveRefresh } from '@/lib/use-live';
import { useTheme } from '@/lib/use-theme';
import { Overview } from './overview';
import type { ActivityItem } from './overview';
import { defaultQuota, type QuotaWindow, type RuntimeGraph } from './model';
import { readScope, selectedScope, writeScope, type ScopeRange } from './scope';
import { activityTrendScope, latestActivityByHarness, recentActivityCallScope, recentActivityScope } from './activity-trend';
import { usageEventParams } from '@/lib/usage-events';
import { supportedForecastPace } from './insight-model';

function readRoute() {
  return readScope(new URLSearchParams(location.hash.split('?')[1] ?? ''), 'today');
}

export function ProductionOverview() {
  const t = useT();
  const { lang, setLang, currency, rate } = useI18n();
  const [theme, toggleTheme] = useTheme();
  const [route, setRoute] = useState(readRoute);
  const [mapProject, setMapProject] = useState<string | null | 'auto'>('auto');
  const [mapGraphSnapshot, setMapGraphSnapshot] = useState<{ key: string; graph: RuntimeGraph } | null>(null);
  const periodSelect = useRef<HTMLSelectElement>(null);
  const restorePeriodFocus = useRef(false);
  const routeKey = JSON.stringify(route);
  const currentKey = useRef(routeKey);
  currentKey.current = routeKey;
  const [snapshot, setSnapshot] = useState<{ key: string; overview: OverviewData; graph: RuntimeGraph; recent: ActivityItem[]; recentTrend: Awaited<ReturnType<typeof api.minuteTrend>> | null; metricUsage: UsageResponse | null; metricComparison: CompareResult | null } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedQuotaId, setSelectedQuotaId] = useState<string | null>(null);
  const [history, setHistory] = useState<QuotaHistoryResponse | null>(null);
  const [historyError, setHistoryError] = useState(false);
  useEffect(() => {
    const sync = () => { if (location.hash.slice(1).split('?')[0] === 'overview') { setRoute(readRoute()); setError(null); } };
    addEventListener('hashchange', sync);
    return () => removeEventListener('hashchange', sync);
  }, []);
  useLiveRefresh(async () => {
    const key = routeKey;
    try {
      const overview = await api.overview();
      const scope = selectedScope(route, overview.now);
      const activityScope = recentActivityScope(scope, overview.now);
      const activityCallScope = recentActivityCallScope(scope, overview.now);
      const usageRange: UsageRangeKey = route.range === 'last30' ? 'custom' : route.range;
      const comparisonSpan = scope.to - scope.from;
      const previousFrom = scope.from - comparisonSpan;
      const comparison = comparisonSpan > 0 && previousFrom >= 0
        ? api.compare({ from: scope.from, to: scope.to, previousFrom, previousTo: scope.from, groupBy: 'none', sourceId: route.sourceId }).catch(() => null)
        : Promise.resolve(null);
      const [graph, recentTrend, metricUsage, metricComparison] = await Promise.all([
        api.runtimeMap(scope),
        activityCallScope ? api.minuteTrend(activityCallScope).catch(() => null) : Promise.resolve(null),
        api.usage({ range: usageRange, from: scope.from, to: scope.to, bucket: 'auto', sourceId: route.sourceId }).catch(() => null),
        comparison,
      ]);
      // Fetch one newest event per observed harness. A global first page can be filled
      // by a single busy harness and hide quieter harnesses before client-side dedupe.
      const harnesses = [...new Set(graph.nodes.harness.map(node => node.key)
        .filter((harness): harness is string => harness !== null && harness.trim().length > 0))];
      const activityRows = activityScope ? (await Promise.all(harnesses.map(async harness => {
        try { return (await api.usageEvents({ ...activityScope, harness }, { limit: 1, offset: 0 })).rows[0] ?? null; }
        catch { return null; }
      }))).filter((row): row is NonNullable<typeof row> => row !== null) : [];
      const latestByHarness = latestActivityByHarness(activityRows);
      const recent: ActivityItem[] = latestByHarness.map(row => ({ id: row.event_id, timestamp: row.timestamp_ms, harness: row.harness, provider: row.provider, model: row.model, tokens: row.total_tokens, grain: row.grain, sessionKey: row.session_key, sourceName: row.source_name }));
      const trends = new Map<string, ReturnType<typeof api.minuteTrend>>();
      await Promise.all(recent.map(async (item, index) => {
        const trendScope = activityTrendScope(activityCallScope, latestByHarness[index], overview.now);
        if (!trendScope) return;
        const trendKey = usageEventParams(trendScope).toString();
        let request = trends.get(trendKey);
        if (!request) { request = api.minuteTrend(trendScope); trends.set(trendKey, request); }
        // A chart failure must not discard the real activity records or quota snapshot.
        try { item.trend = await request; } catch { item.trendError = true; }
      }));
      if (currentKey.current === key) { setSnapshot({ key, overview, graph, recent, recentTrend, metricUsage, metricComparison }); setError(null); }
    } catch (cause) {
      if (currentKey.current === key) setError(String(cause));
      throw cause;
    }
  }, [routeKey]);
  const current = snapshot?.key === routeKey ? snapshot : null;
  const projectNames = current?.graph.nodes.project.map(node => node.key).filter((project): project is string => project !== null) ?? [];
  const mostActiveProject = current?.graph.nodes.project.slice().sort((a, b) => b.sessions - a.sessions || b.tokens - a.tokens)[0]?.key ?? null;
  const selectedRuntimeProject = mapProject === 'auto' || (mapProject !== null && !projectNames.includes(mapProject)) ? mostActiveProject : mapProject;
  const mapGraphKey = current ? `${current.key}|${current.overview.now}|${selectedRuntimeProject ?? ''}` : '';
  useEffect(() => {
    if (!current) return;
    if (mapProject !== selectedRuntimeProject) { setMapProject(selectedRuntimeProject); return; }
    if (!selectedRuntimeProject) { setMapGraphSnapshot({ key: mapGraphKey, graph: current.graph }); return; }
    let active = true;
    const scope = { ...selectedScope(route, current.overview.now), project: selectedRuntimeProject };
    void api.runtimeMap(scope).then(graph => {
      if (active) setMapGraphSnapshot({ key: mapGraphKey, graph });
    }).catch(cause => {
      if (active) { setMapGraphSnapshot(null); setError(String(cause)); }
    });
    return () => { active = false; };
  }, [current?.key, current?.overview.now, mapProject, selectedRuntimeProject, routeKey]);
  useEffect(() => {
    if (current && restorePeriodFocus.current) {
      periodSelect.current?.focus({ preventScroll: true }); restorePeriodFocus.current = false;
    }
  }, [current?.key]);
  const overview = current?.overview;
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
      provider: limit.subscription_provider ?? limit.account_provider ?? subscription?.provider,
      window: limit.window_kind,
      usedPercent: limit.used_percent,
      observedAt: limit.observed_at,
      confirmedAt: limit.last_seen_at,
      resetAt: limit.resets_at ?? 0,
      freshness,
      projectedFullAt: limit.forecast?.status === 'ready' ? limit.forecast.projectedFullAt : null,
      forecastStatus: limit.forecast?.status,
      burnPercentPerHour: supportedForecastPace(limit.forecast?.status, limit.forecast?.percentPerHour),
    };
  });
  const quotaAccountStates = Object.fromEntries([
    ...(overview?.subscriptions ?? []).map(subscription => [subscription.subscription_key, subscription.state] as const),
    ...(overview?.sourceStatus ?? []).filter(source => source.account_key === null).map(source => [`source:${source.source_id}`, source.account_state] as const),
  ]);
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
  if (!current) return <main className="p-6" role="status">{error ?? t('app.loading')}</main>;
  const { graph, recent, metricUsage, metricComparison } = current;
  const period = route.range === 'custom'
    ? `${new Intl.DateTimeFormat(lang === 'th' ? 'th-TH' : 'en-US', { dateStyle: 'medium' }).format(route.from!)} – ${new Intl.DateTimeFormat(lang === 'th' ? 'th-TH' : 'en-US', { dateStyle: 'medium' }).format(route.to!)}`
    : t(route.range === 'today' ? 'redesign.today' : route.range === 'week' ? 'redesign.thisWeek' : route.range === 'month' ? 'redesign.thisMonth' : 'redesign.allTime');
  const historyParams = writeScope(new URLSearchParams(), route);
  const scopeLabel = route.sourceId ? `${period} · ${t('analysis.source')} #${route.sourceId}` : period;
  const periodControl = <div className="qp-overview-period">
    <select ref={periodSelect} aria-label={t('redesign.period')} title={scopeLabel} value={route.range} onChange={event => {
      const range = event.currentTarget.value as ScopeRange;
      const next = { ...route, range, ...(range !== 'custom' ? { from: undefined, to: undefined } : {}) };
      const params = writeScope(new URLSearchParams(location.hash.split('?')[1] ?? ''), next);
      restorePeriodFocus.current = true;
      window.history.replaceState(null, '', `${location.pathname}${location.search}#overview?${params}`); setRoute(next);
    }}>
      <option value="today">{t('redesign.today')}</option><option value="week">{t('redesign.thisWeek')}</option>
      <option value="month">{t('redesign.monthly')}</option><option value="all">{t('redesign.allTime')}</option>
      {route.range === 'custom' && <option value="custom">{period}</option>}
    </select>
    {route.sourceId && <span className="qp-chip">{t('analysis.source')} #{route.sourceId}</span>}
  </div>;
  const mapGraph = mapGraphSnapshot?.key === mapGraphKey ? mapGraphSnapshot.graph : graph;
  return <>
    {error && <p role="status" className="bg-warn/10 p-2 text-center text-xs text-warn">{t('redesign.staleSnapshot')}</p>}
    <Overview graph={graph} runtimeGraph={mapGraph} runtimeHarnesses={[...new Set((overview?.sources ?? []).map(source => source.harness))]} runtimeProjects={projectNames} selectedRuntimeProject={selectedRuntimeProject} onRuntimeProjectChange={setMapProject} harnessVendors={Object.fromEntries((overview?.harnesses ?? []).map(harness => [harness.harness, harness.vendor]))} quotas={quotas} quotaAccountStates={quotaAccountStates} recent={recent} activityTrend={current?.recentTrend} metricUsage={metricUsage} metricComparison={metricComparison} now={Date.now()} t={t} language={lang} onLanguage={() => setLang(lang === 'en' ? 'th' : 'en')} theme={theme} onTheme={toggleTheme} currency={currency} rate={rate} period={scopeLabel} periodControl={periodControl} selectedQuotaId={selectedQuotaId} historyHref={`#history?${historyParams}`} onQuotaSelect={setSelectedQuotaId} quotaHistory={history && history.subscriptionKey === activeQuota?.ownerKey && history.windowKind === activeQuota.window && (!history.reader || (history.reader.sourceId === activeQuota.sourceId && history.reader.origin === activeQuota.origin)) ? history : null} quotaHistoryError={historyError}/>
  </>;
}
