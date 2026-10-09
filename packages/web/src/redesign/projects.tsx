import { useEffect, useRef, useState } from 'react';
import { Activity, ArrowDownUp, BarChart3, Folder, Layers, RefreshCw, Search, Settings, Users } from 'lucide-react';
import { api, type DetailedProjectResponse, type Overview as OverviewData, type ProjectDetailResponse } from '@/api';
import { useI18n, useT } from '@/i18n';
import { useLiveRefresh, useRefreshStatus } from '@/lib/use-live';
import { useTheme } from '@/lib/use-theme';
import { RedesignShell } from './shell';
import { HarnessIcon } from '@/components/harness-icon';
import { VendorIcon } from '@/components/vendor-icon';
import { ObservedTrend } from './observed-trend';
import { ChartData } from './chart-data';
import { readScope, selectedScope, writeScope, type ScopeSelection, type ScopeRange } from './scope';
import { ScopeNotice } from './scope-notice';
import { PageHeading } from './page-heading';
import './projects.css';
import { CostValue } from './cost-value';

type Range = ScopeRange;
type Tab = 'all' | 'recent' | 'unassigned';
type Sort = 'tokens' | 'recent' | 'value';
type DetailTab = 'overview' | 'sessions' | 'usage' | 'details';
interface Route extends ScopeSelection { tab: Tab; sort: Sort; harness: string | null; project: string | null | undefined; detail: DetailTab; offset: number }

function projectTone(key: string | null): 'cyan' | 'violet' {
  const identity = key ?? '\0unassigned';
  let hash = 0x811c9dc5;
  for (let index = 0; index < identity.length; index++) {
    hash = Math.imul(hash ^ identity.charCodeAt(index), 0x01000193) >>> 0;
  }
  return hash % 2 === 0 ? 'cyan' : 'violet';
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
  const t = useT();
  const { lang, setLang, currency, rate } = useI18n();
  const [theme, toggleTheme] = useTheme();
  const [route, setRoute] = useState(readRoute);
  const [search, setSearch] = useState('');
  const [snapshot, setSnapshot] = useState<{ key: string; data: DetailedProjectResponse; overview: OverviewData } | null>(null);
  const [detailSnapshot, setDetailSnapshot] = useState<{ key: string; data: ProjectDetailResponse } | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const refresh = useRefreshStatus();
  const requestKey = JSON.stringify([route.range, route.from, route.to, route.sourceId, route.harness]);
  const currentKey = useRef(requestKey);
  const scopeEpoch = useRef(0);
  if (currentKey.current !== requestKey) scopeEpoch.current++;
  currentKey.current = requestKey;
  useEffect(() => {
    const sync = () => { setRoute(readRoute()); setError(null); };
    addEventListener('hashchange', sync);
    return () => removeEventListener('hashchange', sync);
  }, []);
  const update = (patch: Partial<Route>) => {
    const next = { ...route, ...patch };
    history.replaceState(null, '', `${location.pathname}${location.search}${routeHash(next)}`);
    setRoute(next);
    setError(null);
  };
  useLiveRefresh(async () => {
    const requestedKey = requestKey;
    const requestedEpoch = scopeEpoch.current;
    try {
      const scope = { ...selectedScope(route, Date.now()), ...(route.harness ? { harness: route.harness } : {}) };
      const [data, overview] = await Promise.all([api.detailedProjects(scope, true), api.overview()]);
      if (currentKey.current === requestedKey && scopeEpoch.current === requestedEpoch) { setSnapshot({ key: requestedKey, data, overview }); setError(null); }
    } catch (cause) {
      if (!(currentKey.current === requestedKey && scopeEpoch.current === requestedEpoch)) return;
      setError(String(cause));
      throw cause;
    }
  }, [requestKey]);

  const currentSnapshot = snapshot?.key === requestKey ? snapshot : null;
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
  const visible = groups.filter(group => {
    if (route.tab === 'unassigned' && group.key !== null) return false;
    if (route.tab === 'recent' && (group.lastObservedAt == null || group.lastObservedAt > data!.now || data!.now - group.lastObservedAt > 300_000)) return false;
    return !needle || [group.key ?? t('redesign.unassigned'), ...(metadata.get(group.key) ?? [])]
      .some(value => value.toLocaleLowerCase(lang).includes(needle));
  }).sort((a, b) => {
    const rank = route.sort === 'recent' ? (b.lastObservedAt ?? -1) - (a.lastObservedAt ?? -1)
      : route.sort === 'value' ? b.api_value_usd - a.api_value_usd : b.tokens - a.tokens;
    return rank || String(a.key).localeCompare(String(b.key));
  });
  const selected = visible.find(group => group.key === route.project) ?? visible[0];
  const detailRows = selected ? (data?.rows ?? []).filter(row => row.project === selected.key) : [];
  const observedHarnesses = [...new Set(detailRows.map(row => row.harness))].sort();
  const observedProviders = [...new Set(detailRows.map(row => row.provider).filter((provider): provider is string => Boolean(provider)))].sort();
  const detailScope = selected && data ? { ...data.scope, ...(selected.key === null ? { projectMissing: true } : { project: selected.key }) } : null;
  const detailKey = JSON.stringify([detailScope, route.offset, data?.now]);
  useEffect(() => {
    if (!detailScope) return;
    let cancelled = false;
    setDetailError(null);
    void api.projectDetail(detailScope, route.offset).then(result => {
      if (!cancelled) setDetailSnapshot({ key: detailKey, data: result });
    }).catch(cause => { if (!cancelled) setDetailError(String(cause)); });
    return () => { cancelled = true; };
  }, [detailKey]);
  const detail = detailSnapshot?.key === detailKey ? detailSnapshot.data : null;
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
  const money = (usd: number) => new Intl.NumberFormat(lang === 'th' ? 'th-TH' : 'en-US', { style: 'currency', currency }).format(currency === 'THB' ? usd * rate : usd);
  const date = (ms: number | null) => ms == null ? '—' : new Intl.DateTimeFormat(lang === 'th' ? 'th-TH' : 'en-US', { dateStyle: 'short', timeStyle: 'short' }).format(ms);
  const projectName = (key: string | null) => key === null ? t('redesign.unassigned') : key === '' ? t('redesign.emptyProject') : key;

  return <RedesignShell quickStatsScope={data?.scope ?? null} active="projects" theme={theme} language={lang} onTheme={toggleTheme} onLanguage={() => setLang(lang === 'en' ? 'th' : 'en')} t={t} testId="production-projects">
    <header className="qp-project-header"><PageHeading icon={<Folder size={24}/>} title={t('redesign.projectHeading')} subtitle={t('redesign.projectSubtitle')}/><button onClick={() => void refresh.refreshNow()} disabled={refresh.refreshing} aria-label={t('app.refreshNow')}><RefreshCw size={16}/>{t('app.refreshNow')}</button></header>
    {error && <p className="qp-project-error" role="status">{t('redesign.staleSnapshot')} · {error}</p>}
    <div className="qp-project-toolbar">
      <div className="qp-project-tabs" role="group" aria-label={t('redesign.projectHeading')}>{(['all', 'recent', 'unassigned'] as const).map(tab => <button key={tab} aria-pressed={route.tab === tab} onClick={() => update({ tab, project: undefined, offset: 0 })}>{t(tab === 'all' ? 'redesign.allProjects' : tab === 'recent' ? 'redesign.recentProjects' : 'redesign.unassignedProjects')}</button>)}</div>
      <label className="qp-project-search"><Search size={16}/><span className="qp-visually-hidden">{t('redesign.searchProjects')}</span><input value={search} onChange={event => setSearch(event.target.value)} placeholder={t('redesign.searchProjects')} maxLength={4096}/></label>
      <label>{t('redesign.projectRange')}<select value={route.range} onChange={event => update({ range: event.target.value as Range, project: undefined, offset: 0 })}><option value="today">{t('redesign.today')}</option><option value="week">{t('redesign.thisWeek')}</option><option value="month">{t('redesign.thisMonth')}</option><option value="all">{t('redesign.allTime')}</option>{route.range === 'custom' && <option value="custom">{t('usage.custom')}</option>}</select></label>
      <label>{t('redesign.projectHarness')}<select value={route.harness ?? ''} onChange={event => update({ harness: event.target.value || null, project: undefined, offset: 0 })}><option value="">{t('redesign.allHarnesses')}</option>{harnesses.map(harness => <option key={harness} value={harness}>{harness}</option>)}</select></label>
      <label><ArrowDownUp size={15}/>{t('redesign.projectSort')}<select value={route.sort} onChange={event => update({ sort: event.target.value as Sort })}><option value="tokens">{t('redesign.sortTokens')}</option><option value="recent">{t('redesign.sortRecent')}</option><option value="value">{t('redesign.sortValue')}</option></select></label>
    </div>
    <ScopeNotice scope={route}/>
    {!currentSnapshot ? <p className="qp-panel" role="status">{error ?? t('app.loading')}</p> : <div className="qp-project-layout">
      <section className="qp-project-cards" tabIndex={0} aria-label={t('redesign.allProjects')}>
        {visible.length === 0 && <p className="qp-panel">{t('redesign.noProjects')}</p>}
        {visible.map(group => {
          const share = data?.totals.tokens ? group.tokens / data.totals.tokens * 100 : 0;
          const rows = data?.rows.filter(row => row.project === group.key) ?? [];
          return <button key={JSON.stringify(group.key)} className="qp-project-card qp-panel" data-tone={projectTone(group.key)} aria-pressed={selected?.key === group.key} onClick={() => update({ project: group.key, offset: 0 })}>
            <span className="qp-project-card-heading"><span className="qp-project-icon" aria-hidden="true"><Folder size={21}/></span><span className="qp-project-card-identity"><strong>{projectName(group.key)}</strong><span className="qp-project-card-meta">{t('redesign.sortRecent')} · {date(group.lastObservedAt)}</span></span></span>
            <span className="qp-project-card-summary"><span className="qp-project-card-usage"><span className="qp-project-card-tokens"><strong title={number(group.tokens)} aria-label={`${t('redesign.tokens')}: ${number(group.tokens)}`} data-value={group.tokens}>{compactTokens(group.tokens)}</strong><small title={t('redesign.projectShare')} aria-label={`${number(share)}% ${t('redesign.projectShare')}`}>{number(share)}%</small></span><span className="qp-bar"><span style={{ width: `${share}%` }}/></span><small>{t('redesign.tokens')}</small><span className="qp-project-card-share-label">{t('redesign.projectShare')}</span></span>
            <span className="qp-project-card-money"><span><strong><CostValue amount={group.reported_native_usd} priced={group.native_calls} total={group.calls} money={money} t={t}/></strong><small>{t('redesign.reported')}</small></span><span><strong><CostValue amount={group.api_value_usd} priced={group.computed_calls + group.estimated_calls} total={group.calls} money={money} t={t}/></strong><small>{t('redesign.value')}</small></span></span></span>
            {data?.trends && <ObservedTrend className="qp-project-spark" language={lang} label={`${t('redesign.projectTrend')}: ${projectName(group.key)}`} points={Array.from({ length: Math.ceil((data.scope.to - data.scope.from) / data.trends.bucketMs) }, (_, index) => { const at = data.scope.from + index * data.trends!.bucketMs; return { at, value: trendLookup.get(group.key)?.get(at) ?? 0 }; })}/>}
            <span className="qp-project-card-facts"><span><Users size={14}/>{number(group.sessions)} {t('redesign.sessions')}</span><span><Activity size={14}/>{number(group.calls)} {t('redesign.modelsCalls')}</span><span><Layers size={14}/>{new Set(rows.map(row => row.harness)).size} {t('redesign.harnessesUsed')}</span></span>
          </button>;
        })}
      </section>
      <div className="qp-project-rail"><aside className="qp-panel qp-project-detail" data-tone={selected ? projectTone(selected.key) : undefined} aria-label={t('redesign.projectDetails')}>
        {selected ? <>
          <h2><span className="qp-project-icon" aria-hidden="true"><Folder size={26}/></span>{projectName(selected.key)}</h2>
          <nav className="qp-project-detail-tabs" aria-label={t('redesign.projectDetails')}>{(['overview', 'sessions', 'usage', 'details'] as const).map(tab =>
            <button key={tab} aria-current={route.detail === tab ? 'page' : undefined} onClick={() => update({ detail: tab, offset: 0 })}>{tab === 'overview' ? <Layers size={15} aria-hidden="true"/> : tab === 'sessions' ? <Users size={15} aria-hidden="true"/> : tab === 'usage' ? <BarChart3 size={15} aria-hidden="true"/> : <Settings size={15} aria-hidden="true"/>}{t(tab === 'overview' ? 'redesign.projectOverviewTab' : tab === 'sessions' ? 'redesign.projectSessionsTab' : tab === 'usage' ? 'redesign.projectUsageTab' : 'redesign.projectMetadataTab')}</button>)}</nav>
          {detailError && <p role="status" className="qp-project-error">{detailError}</p>}
          {route.detail === 'overview' && <>
          <div className="qp-project-detail-metrics"><div><small>{t('redesign.tokens')}</small><strong title={number(selected.tokens)} aria-label={`${t('redesign.tokens')}: ${number(selected.tokens)}`} data-value={selected.tokens}>{compactTokens(selected.tokens)}</strong></div><div><small>{t('redesign.sessions')}</small><strong>{number(selected.sessions)}</strong></div><div><small>{t('redesign.modelsCalls')}</small><strong>{number(selected.calls)}</strong></div><div><small>{t('redesign.providersUsed')}</small><strong>{new Set(detailRows.map(row => row.provider).filter(Boolean)).size}</strong></div></div>
          <div className="qp-project-money"><div><small>{t('redesign.reported')}</small><strong>{selected.native_calls > 0 ? <CostValue amount={selected.reported_native_usd} priced={selected.native_calls} total={selected.calls} money={money} t={t}/> : t('redesign.projectCostNotReported')}</strong></div><div><small>{t('redesign.value')}</small><strong>{selected.computed_calls + selected.estimated_calls > 0 ? <CostValue amount={selected.api_value_usd} priced={selected.computed_calls + selected.estimated_calls} total={selected.calls} money={money} t={t}/> : t('redesign.projectValueUnavailable')}</strong></div></div>
          {(selected.unknown_calls > 0 || selected.estimated_calls > 0) && <p className="qp-footnote">{number(selected.unknown_calls)} {t('redesign.projectUnpriced')} · {number(selected.estimated_calls)} {t('redesign.projectEstimated')}</p>}
          <h3>{t('redesign.projectTrend')}</h3>
          {detail ? detail.points.length ? <><ObservedTrend className="qp-project-trend" points={trendBins.map(bin => ({ at: bin.start, value: bin.tokens }))} language={lang} label={`${t('redesign.projectTrend')}: ${t('redesign.tokens')} 0 – ${number(trendMaximum)}`}/><ChartData title={t('redesign.projectTrend')} points={trendBins.map(bin => ({ at: bin.start, value: bin.tokens }))} language={lang} t={t}/></>
            : <p>{t('redesign.projectNoTrend')}</p> : detailError ? null : <p>{t('app.loading')}</p>}
          <div className="qp-project-observed-identities">
            <section className="qp-project-identity-panel"><h3>{t('redesign.harnessesUsed')}<span>{number(observedHarnesses.length)}</span></h3><ul>{observedHarnesses.map(harness => <li key={harness}><span className="qp-project-identity-mark" title={harness}><HarnessIcon harness={harness} vendor={currentSnapshot.overview.harnesses.find(item => item.harness === harness)?.vendor} label={harness}/><span className="qp-visually-hidden">{harness}</span></span></li>)}</ul></section>
            <section className="qp-project-identity-panel"><h3>{t('redesign.providersUsed')}<span>{number(observedProviders.length)}</span></h3><ul>{observedProviders.map(provider => <li key={provider}><span className="qp-project-identity-mark" title={provider}><VendorIcon vendor={provider}/><span className="qp-visually-hidden">{provider}</span></span></li>)}</ul></section>
          </div>
          <button className="qp-project-detail-link" onClick={() => update({ detail: 'details', offset: 0 })}>{t('redesign.projectBreakdown')} →</button>
          </>}
          {route.detail === 'sessions' && (detail ? <>
            {detail.sessions.total === 0 && <p>{t('redesign.projectNoSessions')}</p>}
            <ol className="qp-project-breakdown">{detail.sessions.rows.map(session => <li key={session.sessionKey}><a href={historyHref(session.sessionKey)}>{session.nativeSessionId}<small>{session.sourceName} · {date(session.lastObservedAt)}</small></a><strong>{number(session.tokens)}</strong></li>)}</ol>
            <div className="qp-project-pagination"><button disabled={route.offset === 0} onClick={() => update({ offset: Math.max(0, route.offset - 20) })}>{t('redesign.projectSessionBack')}</button><span>{number(route.offset + 1)}–{number(Math.min(route.offset + detail.sessions.rows.length, detail.sessions.total))} / {number(detail.sessions.total)}</span><button disabled={route.offset + detail.sessions.rows.length >= detail.sessions.total} onClick={() => update({ offset: route.offset + 20 })}>{t('redesign.projectSessionMore')}</button></div>
          </> : detailError ? null : <p>{t('app.loading')}</p>)}
          {route.detail === 'usage' && (detail ? <>
            <h3>{t('redesign.projectRecent')}</h3>
            {detail.recent.length === 0 && <p>{t('redesign.projectNoRecords')}</p>}
            <ol className="qp-project-breakdown">{detail.recent.map(record => <li key={record.eventId}><span>{date(record.timestamp)} · {record.harness} · {record.provider ?? t('redesign.unknownValue')} · {record.model ?? t('redesign.unknownValue')}</span><strong>{number(record.tokens)}</strong></li>)}</ol>
            <a className="qp-project-link" href={historyHref()}>{t('redesign.projectOpenHistory')}</a>
          </> : detailError ? null : <p>{t('app.loading')}</p>)}
          {route.detail === 'details' && <>
            <div><h3>{t('redesign.projectFullIdentity')}</h3><p className="qp-project-identity">{selected.key ?? t('redesign.unassigned')}</p></div>
            <div><h3>{t('redesign.projectBreakdown')}</h3><ol className="qp-project-breakdown qp-project-full-breakdown">{detailRows.map(row => <li key={JSON.stringify([row.sourceId, row.provider, row.model])}><span className="qp-project-route"><HarnessIcon harness={row.harness} vendor={currentSnapshot.overview.harnesses.find(harness => harness.harness === row.harness)?.vendor}/>{row.sourceName} · <VendorIcon vendor={row.provider ?? 'unknown'}/>{row.provider ?? t('redesign.unknownValue')} · {row.model ?? t('redesign.unknownValue')}</span><strong>{number(row.tokens)}</strong></li>)}</ol></div>
            <div><h3>{t('redesign.projectSources')}</h3><ol className="qp-project-breakdown">{[...new Map(detailRows.map(row => [row.sourceId, row])).values()].map(row => <li key={row.sourceId}><span>{row.sourceName}</span><strong>{row.harness}</strong></li>)}</ol></div>
            <div><h3>{t('redesign.projectObservedPaths')}</h3>{detail ? <ol className="qp-project-paths">{[...new Set(detail.sessions.rows.map(session => session.cwd).filter((cwd): cwd is string => Boolean(cwd)))].slice(0, 5).map(cwd => <li key={cwd}>{cwd}</li>)}</ol> : detailError ? null : <p>{t('app.loading')}</p>}{detail?.sessions.rows.every(session => !session.cwd) && <p>{t('redesign.projectUnknownPath')}</p>}</div>
            <p className="qp-footnote">{t('redesign.projectCoverage')}</p>
          </>}
        </> : <p>{t('redesign.noProjects')}</p>}
      </aside>
        {visible.length > 0 && <div className="qp-panel qp-project-top"><h3>{t('redesign.projectTop')}</h3><ol>{[...visible].sort((a, b) => b.tokens - a.tokens).slice(0, 5).map((group, index) =>
          <li key={JSON.stringify(group.key)}><button aria-pressed={selected?.key === group.key} onClick={() => update({ project: group.key, offset: 0 })}><span className="qp-project-rank" aria-hidden="true">{index + 1}</span><Folder size={16} aria-hidden="true"/>{projectName(group.key)}</button><span className="qp-bar"><span style={{ width: `${data?.totals.tokens ? group.tokens / data.totals.tokens * 100 : 0}%` }}/></span><strong title={number(group.tokens)} aria-label={`${t('redesign.tokens')}: ${number(group.tokens)}`} data-value={group.tokens}>{compactTokens(group.tokens)}</strong></li>)}</ol></div>}
      </div>
    </div>}
  </RedesignShell>;
}
