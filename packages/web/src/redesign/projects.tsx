import { useEffect, useId, useRef, useState } from 'react';
import { AggregatePresenceLedger } from './aggregate-presence-motion';
import { useAggregatePresenceMotion } from './use-aggregate-presence-motion';
import type { LiveRecordBatch } from './live-record-motion';
import { projectMotionKey, projectDetailMotionKey, type ProjectSelectionIntent } from './project-selection-motion';
import { useProjectSelectionMotion } from './use-project-selection-motion';
import { ArrowDownUp, BarChart3, Box, Clock3, Coins, Flame, Folder, Headphones, Layers, SquareCheckBig, RefreshCw, Search, Settings, Users } from 'lucide-react';
import { api, type DetailedProjectResponse, type Overview as OverviewData, type ProjectDetailResponse } from '@/api';
import { useI18n, useT } from '@/i18n';
import { useLiveRefresh, useRefreshStatus } from '@/lib/use-live';
import { useTheme } from '@/lib/use-theme';
import { RedesignShell } from './shell';
import { DashboardHarnessIcon as HarnessIcon } from './dashboard-marks';
import { ProviderMark } from './provider-mark';
import { ObservedTrend } from './observed-trend';
import { ObservedTrendAxes } from './observed-trend-axes';
import { ChartData } from './chart-data';
import { readScope, selectedScope, writeScope, type ScopeSelection, type ScopeRange } from './scope';
import { ScopeNotice } from './scope-notice';
import { PageHeading } from './page-heading';
import { InitialRegion, type InitialRegionState } from './initial-region';
import './projects.css';
import './project-reference-summary.css';
import { CostValue } from './cost-value';
import { projectObservedIdentities } from './project-observed-identities';

type Range = ScopeRange;
type Tab = 'all' | 'recent' | 'unassigned';
type Sort = 'tokens' | 'recent' | 'value';
type DetailTab = 'overview' | 'sessions' | 'usage' | 'details';
interface Route extends ScopeSelection { tab: Tab; sort: Sort; harness: string | null; project: string | null | undefined; detail: DetailTab; offset: number }

type ProjectTone = 'cyan' | 'violet' | 'blue' | 'orange' | 'neutral';

function projectTone(key: string | null): ProjectTone {
  if (key === 'QuotaPulse') return 'cyan';
  if (key === null) return 'neutral';
  const identity = key;
  let hash = 0x811c9dc5;
  for (let index = 0; index < identity.length; index++) {
    hash = Math.imul(hash ^ identity.charCodeAt(index), 0x01000193) >>> 0;
  }
  const tones: Exclude<ProjectTone, 'cyan'>[] = ['violet', 'blue', 'orange', 'neutral'];
  return tones[hash % tones.length];
}

function readRoute(): Route {
  const params = new URLSearchParams(location.hash.split('?')[1] ?? '');
  const tab = params.get('tab');
  const sort = params.get('sort');
  const detail = params.get('detail');
  const offset = Number(params.get('offset'));
  return {
    ...readScope(params, 'month'),
    tab: tab === 'recent' || tab === 'unassigned' ? tab : 'all',
    sort: sort === 'recent' || sort === 'value' ? sort : 'tokens',
    harness: params.get('harness'),
    project: params.get('project_missing') === '1' ? null : params.has('project') ? params.get('project') : undefined,
    detail: detail === 'sessions' || detail === 'usage' || detail === 'details' ? detail : 'overview',
    offset: Number.isSafeInteger(offset) && offset >= 0 ? offset : 0,
  };
}

function routeHash(route: Route) {
  const params = writeScope(new URLSearchParams(), route);
  if (route.tab !== 'all') params.set('tab', route.tab);
  if (route.sort !== 'tokens') params.set('sort', route.sort);
  if (route.harness) params.set('harness', route.harness);
  if (route.project === null) params.set('project_missing', '1');
  else if (route.project !== undefined) params.set('project', route.project);
  if (route.detail !== 'overview') params.set('detail', route.detail);
  if (route.offset > 0) params.set('offset', String(route.offset));
  return `#projects?${params}`;
}

export function ProductionProjects() {
  const filterCountId = useId();
  const t = useT();
  const { lang, setLang, currency, rate } = useI18n();
  const [theme, toggleTheme] = useTheme();
  const [route, setRoute] = useState(readRoute);
  const [search, setSearch] = useState('');
  const [snapshot, setSnapshot] = useState<{ key: string; data: DetailedProjectResponse; overview: OverviewData; motion: LiveRecordBatch } | null>(null);
  const [detailSnapshot, setDetailSnapshot] = useState<{ key: string; data: ProjectDetailResponse } | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detailErrorKey, setDetailErrorKey] = useState<string | null>(null);
  const [failure, setFailure] = useState<{ key: string; epoch: number; message: string } | null>(null);
  const refresh = useRefreshStatus();
  const [retry, setRetry] = useState(0);
  const [detailRetry, setDetailRetry] = useState(0);
  const selectionOpener = useRef<HTMLButtonElement | null>(null);
  const presenceRegion = useRef<HTMLElement>(null);
  const [presenceLedger] = useState(() => new AggregatePresenceLedger());
  const acceptedSerial = useRef(0);
  const mounted = useRef(true);
  const selectionDetail = useRef<HTMLElement>(null);
  const [selectionIntent, setSelectionIntent] = useState<ProjectSelectionIntent | null>(null);
  const requestKey = JSON.stringify([route.range, route.from, route.to, route.sourceId, route.harness]);
  const currentKey = useRef(requestKey);
  const scopeEpoch = useRef(0);
  if (currentKey.current !== requestKey) scopeEpoch.current++;
  currentKey.current = requestKey;
  useEffect(() => {
    mounted.current = true;
    const sync = () => { setRoute(readRoute()); };
    addEventListener('hashchange', sync);
    return () => { mounted.current = false; scopeEpoch.current++; removeEventListener('hashchange', sync); };
  }, []);
  const update = (patch: Partial<Route>) => {
    const next = { ...route, ...patch };
    history.replaceState(null, '', `${location.pathname}${location.search}${routeHash(next)}`);
    setRoute(next);
  };
  useLiveRefresh(async context => {
    const requestEligibility = presenceLedger.snapshot();
    const requestedKey = requestKey;
    const requestedEpoch = scopeEpoch.current;
    const isCurrent = () => mounted.current && currentKey.current === requestedKey && scopeEpoch.current === requestedEpoch;
    try {
      const scope = { ...selectedScope(route, Date.now()), ...(route.harness ? { harness: route.harness } : {}) };
      const [data, overview] = await Promise.all([api.detailedProjects(scope, true), api.overview()]);
      if (isCurrent()) { setSnapshot({ key: requestedKey, data, overview, motion: { serial: ++acceptedSerial.current, reason: context.reason, requestEligibility } }); setFailure(null); }
    } catch (cause) {
      if (!isCurrent()) return;
      setFailure({ key: requestedKey, epoch: requestedEpoch, message: String(cause) });
      throw cause;
    }
  }, [requestKey, retry]);

  const currentSnapshot = snapshot?.key === requestKey ? snapshot : null;
  const error = failure?.key === requestKey && failure.epoch === scopeEpoch.current ? failure.message : null;
  const groups = currentSnapshot?.data.groups ?? [];
  const data = currentSnapshot?.data;
  const trendLookup = new Map<string | null, Map<number, number>>();
  for (const point of data?.trends?.points ?? []) {
    const values = trendLookup.get(point.project) ?? new Map<number, number>();
    values.set(point.start, point.tokens); trendLookup.set(point.project, values);
  }
  const metadata = new Map<string | null, string[]>();
  for (const row of data?.rows ?? []) {
    const values = metadata.get(row.project) ?? [];
    values.push(row.sourceName, row.harness, row.provider ?? '', row.model ?? '');
    metadata.set(row.project, values);
  }
  const needle = search.toLocaleLowerCase(lang);
  const matchingGroups = groups.filter(group => !needle || [group.key ?? t('redesign.unassigned'), ...(metadata.get(group.key) ?? [])]
    .some(value => value.toLocaleLowerCase(lang).includes(needle)));
  const matchesTab = (group: DetailedProjectResponse['groups'][number], tab: Tab) => tab === 'unassigned' ? group.key === null
    : tab === 'recent' ? data !== undefined && group.lastObservedAt != null && group.lastObservedAt <= data.now && data.now - group.lastObservedAt <= 300_000
      : true;
  const tabCounts = currentSnapshot ? { all: matchingGroups.length, recent: matchingGroups.filter(group => matchesTab(group, 'recent')).length, unassigned: matchingGroups.filter(group => matchesTab(group, 'unassigned')).length } : null;
  const visible = matchingGroups.filter(group => matchesTab(group, route.tab)).sort((a, b) => {
    const rank = route.sort === 'recent' ? (b.lastObservedAt ?? -1) - (a.lastObservedAt ?? -1)
      : route.sort === 'value' ? b.api_value_usd - a.api_value_usd : b.tokens - a.tokens;
    return rank || String(a.key).localeCompare(String(b.key));
  });
  const selected = visible.find(group => group.key === route.project) ?? visible[0];
  const detailRows = selected ? (data?.rows ?? []).filter(row => row.project === selected.key) : [];
  const observed = projectObservedIdentities(detailRows);
  const observedHarnesses = observed.harnesses, observedProviders = observed.providers;
  const detailScope = selected && data ? { ...data.scope, ...(selected.key === null ? { projectMissing: true } : { project: selected.key }) } : null;
  const detailKey = JSON.stringify([detailScope, route.offset, data?.now]);
  useEffect(() => {
    if (!detailScope) return;
    let cancelled = false;
    setDetailError(null);
    void api.projectDetail(detailScope, route.offset).then(result => {
      if (!cancelled) setDetailSnapshot({ key: detailKey, data: result });
    }).catch(cause => { if (!cancelled) { setDetailErrorKey(detailKey); setDetailError(String(cause)); } });
    return () => { cancelled = true; };
  }, [detailKey, detailRetry]);
  const detail = detailSnapshot?.key === detailKey ? detailSnapshot.data : null;
  const currentDetailError = detailErrorKey === detailKey ? detailError : null;
  const motionContext = JSON.stringify([requestKey, route.tab, route.sort, search]);
  const selectedMotionKey = selected ? projectDetailMotionKey(selected.key, route.detail) : null;
  const aggregateDetail = route.detail === 'overview' || route.detail === 'details';
  const desiredMotionDetail = selected && data
    ? aggregateDetail ? JSON.stringify(['aggregate', data.scope, selectedMotionKey]) : detailKey : null;
  const cancelPresence = useAggregatePresenceMotion(presenceRegion, presenceLedger, { batch: currentSnapshot?.motion,
    context: JSON.stringify([motionContext, lang, currency, rate, theme]),
    universe: groups.map(group => projectMotionKey(group.key)), page: visible.map(group => projectMotionKey(group.key)),
    enabled: !!currentSnapshot && !error, hasSnapshot: !!snapshot, mounted: !!currentSnapshot,
    selectionSerial: selectionIntent?.serial ?? 0, selectionKey: selectionIntent?.kind === 'project' ? selectionIntent.openerKey : null,
    attribute: 'data-project-selection-opener', selector: '[data-project-selection-role=card]' });
  useProjectSelectionMotion(selectionOpener, selectionDetail, { contextKey: motionContext, selectedKey: selectedMotionKey,
    detailKey: desiredMotionDetail, acceptedDetailKey: aggregateDetail ? desiredMotionDetail : detail ? detailKey : null,
    intent: selectionIntent, offset: route.offset, enabled: !!currentSnapshot && !!selected && !error,
    failed: !!currentDetailError, detailMounted: !!currentSnapshot });
  const selectProject = (key: string | null, opener: HTMLButtonElement) => {
    if (selected?.key !== key) {
      cancelPresence(projectMotionKey(key));
      selectionOpener.current = opener;
      setSelectionIntent(previous => ({ serial: (previous?.serial ?? 0) + 1,
        key: projectDetailMotionKey(key, route.detail), contextKey: motionContext, kind: 'project', openerKey: projectMotionKey(key) }));
    }
    update({ project: key, offset: 0 });
  };
  const selectDetail = (tab: DetailTab) => {
    if (selected && route.detail !== tab) setSelectionIntent(previous => ({ serial: (previous?.serial ?? 0) + 1,
      key: projectDetailMotionKey(selected.key, tab), contextKey: motionContext, kind: 'detail', openerKey: null }));
    update({ detail: tab, offset: 0 });
  };
  const trendBins = detail ? Array.from({ length: Math.ceil((detail.scope.to - detail.scope.from) / detail.bucketMs) }, (_, index) => {
    const start = detail.scope.from + index * detail.bucketMs;
    return { start, tokens: detail.points.find(point => point.start === start)?.tokens ?? 0 };
  }) : [];
  const trendMaximum = Math.max(0, ...trendBins.map(bin => bin.tokens));
  const historyHref = (sessionId?: number) => {
    if (!detailScope) return '#history';
    const params = new URLSearchParams({ range: 'custom', from: String(detailScope.from), to: String(detailScope.to) });
    if (detailScope.projectMissing) params.set('project_missing', '1');
    else params.set('project', detailScope.project!);
    if (detailScope.harness) params.set('harness', detailScope.harness);
    if (detailScope.sourceId) params.set('source', String(detailScope.sourceId));
    if (sessionId !== undefined) params.set('session_id', String(sessionId));
    return `#history?${params}`;
  };
  const harnesses = [...new Set(snapshot?.overview.sources.map(source => source.harness) ?? [])].sort();
  const number = (value: number) => new Intl.NumberFormat(lang === 'th' ? 'th-TH' : 'en-US', { maximumFractionDigits: 0 }).format(value);
  const compactTokens = (value: number) => new Intl.NumberFormat(lang === 'th' ? 'th-TH' : 'en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
  const percent = (value: number) => new Intl.NumberFormat(lang === 'th' ? 'th-TH' : 'en-US', { style: 'percent', maximumFractionDigits: 1 }).format(value);
  const money = (usd: number) => new Intl.NumberFormat(lang === 'th' ? 'th-TH' : 'en-US', { style: 'currency', currency }).format(currency === 'THB' ? usd * rate : usd);
  const date = (ms: number | null) => ms == null ? '—' : new Intl.DateTimeFormat(lang === 'th' ? 'th-TH' : 'en-US', { dateStyle: 'short', timeStyle: 'short' }).format(ms);
  const providerCount = (count: number, missing: boolean) => <>{number(count)}{missing && <abbr title={t('redesign.projectUnknownProviders')}> + ?</abbr>}</>;
  const dateOnly = (ms: number) => new Intl.DateTimeFormat(lang === 'th' ? 'th-TH' : 'en-US', { dateStyle: 'short' }).format(ms);
  const timeOnly = (ms: number) => new Intl.DateTimeFormat(lang === 'th' ? 'th-TH' : 'en-US', { timeStyle: 'short' }).format(ms);
  const projectName = (key: string | null) => key === null ? t('redesign.unassigned') : key === '' ? t('redesign.emptyProject') : key;

  const initialState: InitialRegionState = { kind: error ? 'error' : 'loading', label: error ? t('app.couldNotLoad') : t('app.loading'), detail: error ?? undefined, retryLabel: t('app.retry'), retrying: false, onRetry: () => { document.querySelector<HTMLElement>('[data-testid=production-projects] main')?.focus(); scopeEpoch.current++; setFailure(null); setRetry(value => value + 1); } };
  const detailState: InitialRegionState = { kind: currentDetailError ? 'error' : 'loading', label: currentDetailError ? t('app.couldNotLoad') : t('app.loading'), detail: currentDetailError ?? undefined, retryLabel: t('app.retry'), retrying: false, onRetry: () => { document.querySelector<HTMLElement>('[data-testid=production-projects] main')?.focus(); setDetailError(null); setDetailRetry(value => value + 1); } };

  return <RedesignShell quickStatsScope={data?.scope ?? null} active="projects" theme={theme} language={lang} onTheme={toggleTheme} onLanguage={() => setLang(lang === 'en' ? 'th' : 'en')} t={t} testId="production-projects">
    <header className="qp-project-header"><PageHeading icon={<Folder size={24}/>} title={t('redesign.projectHeading')} subtitle={t('redesign.projectSubtitle')}/><button onClick={() => void refresh.refreshNow()} disabled={refresh.refreshing} aria-label={t('app.refreshNow')}><RefreshCw size={16}/>{t('app.refreshNow')}</button></header>
    {error && currentSnapshot && <p className="qp-project-error" role="status">{t('redesign.staleSnapshot')} · {error}</p>}
    <div className="qp-project-toolbar">
      <div className="qp-project-tabs" role="group" aria-label={t('redesign.projectHeading')}>{(['all', 'recent', 'unassigned'] as const).map(tab => {
        const label = t(tab === 'all' ? 'redesign.allProjects' : tab === 'recent' ? 'redesign.recentProjects' : 'redesign.unassignedProjects');
        const description = tabCounts ? t(tab === 'recent' ? 'redesign.projectRecentCount' : 'redesign.projectFilterCount', { count: number(tabCounts[tab]) }) : t(error ? 'app.couldNotLoad' : 'app.loading');
        return <button key={tab} data-tab={tab} data-count={tabCounts?.[tab]} aria-label={label} aria-describedby={`${filterCountId}-${tab}`} title={description} aria-busy={!currentSnapshot && !error || undefined} aria-pressed={route.tab === tab} onClick={() => update({ tab, project: undefined, offset: 0 })}>
          {tab === 'recent' ? <Clock3 size={14} aria-hidden="true"/> : tab === 'unassigned' ? <Folder size={14} aria-hidden="true"/> : null}<span>{label}</span><span className="qp-project-tab-count" aria-hidden="true">{tabCounts ? number(tabCounts[tab]) : '—'}</span><span id={`${filterCountId}-${tab}`} className="qp-visually-hidden">{description}</span>
        </button>;
      })}</div>
      <label className="qp-project-search"><Search size={16}/><span className="qp-visually-hidden">{t('redesign.searchProjects')}</span><input value={search} onChange={event => setSearch(event.target.value)} placeholder={t('redesign.searchProjects')} maxLength={4096}/></label>
      <label>{t('redesign.projectRange')}<select value={route.range} onChange={event => update({ range: event.target.value as Range, project: undefined, offset: 0 })}><option value="today">{t('redesign.today')}</option><option value="week">{t('redesign.thisWeek')}</option><option value="month">{t('redesign.thisMonth')}</option><option value="all">{t('redesign.allTime')}</option>{route.range === 'custom' && <option value="custom">{t('usage.custom')}</option>}</select></label>
      <label>{t('redesign.projectHarness')}<select value={route.harness ?? ''} onChange={event => update({ harness: event.target.value || null, project: undefined, offset: 0 })}><option value="">{t('redesign.allHarnesses')}</option>{harnesses.map(harness => <option key={harness} value={harness}>{harness}</option>)}</select></label>
      <label><ArrowDownUp size={15}/>{t('redesign.projectSort')}<select value={route.sort} onChange={event => update({ sort: event.target.value as Sort })}><option value="tokens">{t('redesign.sortTokens')}</option><option value="recent">{t('redesign.sortRecent')}</option><option value="value">{t('redesign.sortValue')}</option></select></label>
    </div>
    <ScopeNotice scope={route}/>
    {!currentSnapshot ? <div className="qp-project-layout qp-project-initial-layout"><section className="qp-project-cards" aria-label={t('redesign.allProjects')}>{Array.from({ length: 4 }, (_, index) => <InitialRegion key={index} id={`project-card-${index}`} label={t('redesign.projectHeading')} state={initialState} className="qp-project-initial-card" status={index === 0} slots={5}/>)}</section><div className="qp-project-rail"><InitialRegion id="project-details" label={t('redesign.projectDetails')} state={initialState} className="qp-project-initial-detail" slots={8}/><InitialRegion id="project-top" label={t('redesign.projectTop')} state={initialState} className="qp-project-initial-top" slots={4}/></div></div> : <div className="qp-project-layout">
      <section ref={presenceRegion} className="qp-project-cards" tabIndex={0} aria-label={t('redesign.allProjects')}>
        {visible.length === 0 && <p className="qp-panel">{t('redesign.noProjects')}</p>}
        {visible.map(group => {
          const share = data?.totals.tokens ? group.tokens / data.totals.tokens * 100 : 0;
          const rows = data?.rows.filter(row => row.project === group.key) ?? [];
          const identities = projectObservedIdentities(rows);
          return <button key={JSON.stringify(group.key)} className="qp-project-card qp-panel" data-project-selection-opener={projectMotionKey(group.key)} data-project-selection-role="card" data-tone={projectTone(group.key)} aria-pressed={selected?.key === group.key} onClick={event => selectProject(group.key, event.currentTarget)}>
            <span className="qp-project-card-heading"><span className="qp-project-icon" aria-hidden="true">{group.key === 'QuotaPulse' ? <Box size={21}/> : <Folder size={21}/>}</span><span className="qp-project-card-identity"><strong>{projectName(group.key)}</strong><span className="qp-project-card-meta">{t('redesign.sortRecent')} · {date(group.lastObservedAt)}<span className="qp-project-card-calls">{number(group.calls)} {t('redesign.modelsCalls')}</span></span></span></span>
            <span className="qp-project-card-summary"><span className="qp-project-card-usage"><span className="qp-project-card-tokens"><strong title={number(group.tokens)} aria-label={`${t('redesign.tokens')}: ${number(group.tokens)}`} data-value={group.tokens}>{compactTokens(group.tokens)}</strong><small title={t('redesign.projectShare')} aria-label={`${number(share)}% ${t('redesign.projectShare')}`}>{number(share)}%</small></span><span className="qp-bar"><span style={{ width: `${share}%` }}/></span><small>{t('redesign.tokens')}</small><span className="qp-project-card-share-label">{t('redesign.projectShare')}</span></span>
            <span className="qp-project-card-money"><span><strong><CostValue amount={group.reported_native_usd} priced={group.native_calls} total={group.calls} money={money} t={t}/></strong><small>{t('redesign.reported')}</small></span><span><strong><CostValue amount={group.api_value_usd} priced={group.computed_calls + group.estimated_calls} total={group.calls} money={money} t={t}/></strong><small>{t('redesign.value')}</small></span></span></span>
            {data?.trends && <ObservedTrend className="qp-project-spark" language={lang} label={`${t('redesign.projectTrend')}: ${projectName(group.key)}`} points={Array.from({ length: Math.ceil((data.scope.to - data.scope.from) / data.trends.bucketMs) }, (_, index) => { const at = data.scope.from + index * data.trends!.bucketMs; return { at, value: trendLookup.get(group.key)?.get(at) ?? 0 }; })}/>}
            <span className="qp-project-card-facts">
              <span data-project-fact="sessions"><span className="qp-project-fact-icon" aria-hidden="true"><Box size={16}/></span><strong>{number(group.sessions)}</strong>{' '}<small title={t('redesign.sessions')}>{t('redesign.projectCardSessions')}</small></span>
              <span data-project-fact="harnesses"><span className="qp-project-fact-icon" aria-hidden="true"><SquareCheckBig size={16}/></span><strong>{number(identities.harnesses.length)}</strong>{' '}<small title={t('redesign.harnessesUsed')}>{t('redesign.projectCardHarnesses')}</small></span>
              <span data-project-fact="providers"><span className="qp-project-fact-icon" aria-hidden="true"><Headphones size={16}/></span><strong>{providerCount(identities.providers.length, identities.hasMissingProvider)}</strong>{' '}<small title={t('redesign.providersUsed')}>{t('redesign.projectCardProviders')}</small></span>
            </span>
          </button>;
        })}
      </section>
      <div className="qp-project-rail"><aside ref={selectionDetail} className="qp-panel qp-project-detail" data-project-selection-detail={selectedMotionKey ?? undefined} data-tone={selected ? projectTone(selected.key) : undefined} aria-label={t('redesign.projectDetails')}>
        {selected ? <>
          <h2><span className="qp-project-icon" aria-hidden="true">{selected.key === 'QuotaPulse' ? <Box size={26}/> : <Folder size={26}/>}</span>{projectName(selected.key)}</h2>
          <div className="qp-project-detail-facts"><span data-project-fact="sessions"><strong>{number(selected.sessions)}</strong> <small>{t('redesign.sessions')}</small></span><span data-project-fact="calls"><strong>{number(selected.calls)}</strong> <small>{t('redesign.modelsCalls')}</small></span><span data-project-fact="harnesses"><strong>{number(observedHarnesses.length)}</strong> <small>{t('redesign.harnessesUsed')}</small></span><span data-project-fact="providers"><strong>{providerCount(observedProviders.length, observed.hasMissingProvider)}</strong> <small>{t('redesign.providersUsed')}</small></span></div>
          <nav className="qp-project-detail-tabs" aria-label={t('redesign.projectDetails')}>{(['overview', 'sessions', 'usage', 'details'] as const).map(tab =>
            <button key={tab} data-project-detail-tab={tab} aria-current={route.detail === tab ? 'page' : undefined} onClick={() => selectDetail(tab)}>{tab === 'overview' ? <Layers size={15} aria-hidden="true"/> : tab === 'sessions' ? <Users size={15} aria-hidden="true"/> : tab === 'usage' ? <BarChart3 size={15} aria-hidden="true"/> : <Settings size={15} aria-hidden="true"/>}{t(tab === 'overview' ? 'redesign.projectOverviewTab' : tab === 'sessions' ? 'redesign.projectSessionsTab' : tab === 'usage' ? 'redesign.projectUsageTab' : 'redesign.projectMetadataTab')}</button>)}</nav>
          {currentDetailError && detail && <p role="status" className="qp-project-error">{t('redesign.staleSnapshot')} · {currentDetailError} <button onClick={detailState.onRetry} disabled={detailState.retrying}>{t('app.retry')}</button></p>}
          {route.detail === 'overview' && <>
          <div className="qp-project-detail-metrics" data-layout="reference">
            <div className="qp-project-reference-token"><span className="qp-project-summary-icon" aria-hidden="true"><Box size={21}/></span><strong title={number(selected.tokens)} aria-label={`${t('redesign.tokens')}: ${number(selected.tokens)}`} data-value={selected.tokens}>{compactTokens(selected.tokens)}</strong><small>{t('redesign.tokens')}</small><span className="qp-bar" title={t('redesign.projectShare')}><span style={{ width: `${data?.totals.tokens ? selected.tokens / data.totals.tokens * 100 : 0}%` }}/></span></div>
            <div className="qp-project-money"><span className="qp-project-summary-icon" aria-hidden="true"><Coins size={21}/></span><div><small>{t('redesign.reported')}</small><strong>{selected.native_calls > 0 ? <CostValue amount={selected.reported_native_usd} priced={selected.native_calls} total={selected.calls} money={money} t={t}/> : t('redesign.projectCostNotReported')}</strong></div><div><small>{t('redesign.value')}</small><strong>{selected.computed_calls + selected.estimated_calls > 0 ? <CostValue amount={selected.api_value_usd} priced={selected.computed_calls + selected.estimated_calls} total={selected.calls} money={money} t={t}/> : t('redesign.projectValueUnavailable')}</strong></div></div>
            <div className="qp-project-reference-observed"><span className="qp-project-summary-icon" aria-hidden="true"><Clock3 size={21}/></span><small>{t('redesign.sortRecent')}</small>{selected.lastObservedAt === null ? <strong title={t('redesign.projectNoTimestamp')}>{t('redesign.unknownValue')}</strong> : <time dateTime={new Date(selected.lastObservedAt).toISOString()} title={date(selected.lastObservedAt)}><span>{dateOnly(selected.lastObservedAt)}</span><span>{timeOnly(selected.lastObservedAt)}</span></time>}</div>
          </div>
          <section className="qp-project-trend-panel" aria-label={t('redesign.projectTrend')}>
          <h3>{t('redesign.projectTrend')}</h3>
          {detail ? detail.points.length ? <><ObservedTrendAxes valueLabel={t('redesign.tokens')} className="qp-project-trend" points={trendBins.map(bin => ({ at: bin.start, value: bin.tokens }))} bucketMs={detail.bucketMs} language={lang} label={`${t('redesign.projectTrend')}: ${t('redesign.tokens')} 0 – ${number(trendMaximum)}`}/><ChartData title={t('redesign.projectTrend')} points={trendBins.map(bin => ({ at: bin.start, value: bin.tokens }))} language={lang} t={t}/></>
            : <p>{t('redesign.projectNoTrend')}</p> : <InitialRegion id="project-trend" label={t('redesign.projectTrend')} state={detailState} className="qp-project-initial-trend" status slots={3}/>}
          {(selected.unknown_calls > 0 || selected.estimated_calls > 0) && <p className="qp-footnote">{number(selected.unknown_calls)} {t('redesign.projectUnpriced')} · {number(selected.estimated_calls)} {t('redesign.projectEstimated')}</p>}
          </section>
          <div className="qp-project-observed-identities">
            <section className="qp-project-identity-panel"><h3>{t('redesign.harnessesUsed')}<span>{number(observedHarnesses.length)}</span></h3><ul>{observedHarnesses.map(harness => <li key={harness}><span className="qp-project-identity-mark" title={harness}><HarnessIcon harness={harness} vendor={currentSnapshot.overview.harnesses.find(item => item.harness === harness)?.vendor} label={harness}/><span className="qp-visually-hidden">{harness}</span></span></li>)}</ul></section>
            <section className="qp-project-identity-panel"><h3>{t('redesign.providersUsed')}<span>{providerCount(observedProviders.length, observed.hasMissingProvider)}</span></h3><ul>{observedProviders.map(provider => <li key={provider}><span className="qp-project-identity-mark" title={provider}><ProviderMark vendor={provider}/><span className="qp-visually-hidden">{provider}</span></span></li>)}<li className="qp-project-provider-action"><button className="qp-project-detail-link" aria-label={t('redesign.projectBreakdown')} title={t('redesign.projectBreakdown')} onClick={() => selectDetail('details')}>{t('redesign.viewAllActivity')} →</button></li></ul></section>
          </div>
          </>}
          {route.detail === 'sessions' && (detail ? <>
            {detail.sessions.total === 0 && <p>{t('redesign.projectNoSessions')}</p>}
            <ol className="qp-project-breakdown">{detail.sessions.rows.map(session => <li key={session.sessionKey}><a href={historyHref(session.sessionKey)}>{session.nativeSessionId}<small>{session.sourceName} · {date(session.lastObservedAt)}</small></a><strong>{number(session.tokens)}</strong></li>)}</ol>
            <div className="qp-project-pagination"><button disabled={route.offset === 0} onClick={() => update({ offset: Math.max(0, route.offset - 20) })}>{t('redesign.projectSessionBack')}</button><span>{number(route.offset + 1)}–{number(Math.min(route.offset + detail.sessions.rows.length, detail.sessions.total))} / {number(detail.sessions.total)}</span><button disabled={route.offset + detail.sessions.rows.length >= detail.sessions.total} onClick={() => update({ offset: route.offset + 20 })}>{t('redesign.projectSessionMore')}</button></div>
          </> : <InitialRegion id="project-sessions" label={t('redesign.sessions')} state={detailState} className="qp-project-initial-tab" status slots={4}/>)}
          {route.detail === 'usage' && (detail ? <>
            <h3>{t('redesign.projectRecent')}</h3>
            {detail.recent.length === 0 && <p>{t('redesign.projectNoRecords')}</p>}
            <ol className="qp-project-breakdown">{detail.recent.map(record => <li key={record.eventId}><span>{date(record.timestamp)} · {record.harness} · {record.provider ?? t('redesign.unknownValue')} · {record.model ?? t('redesign.unknownValue')}</span><strong>{number(record.tokens)}</strong></li>)}</ol>
            <a className="qp-project-link" href={historyHref()}>{t('redesign.projectOpenHistory')}</a>
          </> : <InitialRegion id="project-usage" label={t('redesign.tokens')} state={detailState} className="qp-project-initial-tab" status slots={4}/>)}
          {route.detail === 'details' && <>
            <div><h3>{t('redesign.projectFullIdentity')}</h3><p className="qp-project-identity">{selected.key ?? t('redesign.unassigned')}</p></div>
            <div><h3>{t('redesign.projectBreakdown')}</h3><ol className="qp-project-breakdown qp-project-full-breakdown">{detailRows.map(row => <li key={JSON.stringify([row.sourceId, row.provider, row.model])}><span className="qp-project-route"><HarnessIcon harness={row.harness} vendor={currentSnapshot.overview.harnesses.find(harness => harness.harness === row.harness)?.vendor}/>{row.sourceName} · <ProviderMark vendor={row.provider ?? 'unknown'}/>{row.provider ?? t('redesign.unknownValue')} · {row.model ?? t('redesign.unknownValue')}</span><strong>{number(row.tokens)}</strong></li>)}</ol></div>
            <div><h3>{t('redesign.projectSources')}</h3><ol className="qp-project-breakdown">{[...new Map(detailRows.map(row => [row.sourceId, row])).values()].map(row => <li key={row.sourceId}><span>{row.sourceName}</span><strong>{row.harness}</strong></li>)}</ol></div>
            <div><h3>{t('redesign.projectObservedPaths')}</h3>{detail ? <ol className="qp-project-paths">{[...new Set(detail.sessions.rows.map(session => session.cwd).filter((cwd): cwd is string => Boolean(cwd)))].slice(0, 5).map(cwd => <li key={cwd}>{cwd}</li>)}</ol> : <InitialRegion id="project-paths" label={t('redesign.projectObservedPaths')} state={detailState} className="qp-project-initial-tab" status slots={4}/>}{detail?.sessions.rows.every(session => !session.cwd) && <p>{t('redesign.projectUnknownPath')}</p>}</div>
            <p className="qp-footnote">{t('redesign.projectCoverage')}</p>
          </>}
        </> : <p>{t('redesign.noProjects')}</p>}
      </aside>
        {visible.length > 0 && <div className="qp-panel qp-project-top"><header className="qp-project-rank-heading"><h3><Flame className="qp-project-top-mark" size={18} aria-hidden="true"/>{t('redesign.projectTop')}</h3><p>{t('redesign.value')}</p></header><ol>{[...visible].sort((a, b) => b.tokens - a.tokens).slice(0, 5).map((group, index) =>
          <li key={JSON.stringify(group.key)} data-project-key={JSON.stringify(group.key)} data-tone={projectTone(group.key)}><button data-project-selection-opener={projectMotionKey(group.key)} data-project-selection-role="rank" aria-pressed={selected?.key === group.key} onClick={event => selectProject(group.key, event.currentTarget)}><span className="qp-project-rank" aria-hidden="true">{index + 1}</span><span className="qp-project-rank-icon" aria-hidden="true">{group.key === 'QuotaPulse' ? <Box size={16}/> : <Folder size={16}/>}</span>{projectName(group.key)}</button><span className="qp-project-rank-usage"><span><strong title={number(group.tokens)} aria-label={`${t('redesign.tokens')}: ${number(group.tokens)}`} data-value={group.tokens}>{compactTokens(group.tokens)}</strong><span className="qp-project-rank-share" title={t('redesign.projectShare')} aria-label={`${t('redesign.projectShare')}: ${percent(data?.totals.tokens ? group.tokens / data.totals.tokens : 0)}`} data-share={data?.totals.tokens ? group.tokens / data.totals.tokens : 0}>{percent(data?.totals.tokens ? group.tokens / data.totals.tokens : 0)}</span></span><span className="qp-bar" aria-hidden="true"><span style={{ width: `${data?.totals.tokens ? group.tokens / data.totals.tokens * 100 : 0}%` }}/></span></span><strong className="qp-project-rank-value" title={t('redesign.value')} data-api-value={group.api_value_usd} data-priced-calls={group.computed_calls + group.estimated_calls} data-all-calls={group.calls}><CostValue amount={group.api_value_usd} priced={group.computed_calls + group.estimated_calls} total={group.calls} money={money} t={t}/></strong></li>)}</ol></div>}
      </div>
    </div>}
  </RedesignShell>;
}
