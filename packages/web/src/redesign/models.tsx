import { useEffect, useId, useRef, useState } from 'react';
import { AggregatePresenceLedger } from './aggregate-presence-motion';
import { useAggregatePresenceMotion } from './use-aggregate-presence-motion';
import type { LiveRecordBatch } from './live-record-motion';
import { useModelSelectionMotion } from './use-model-selection-motion';
import type { ModelSelectionIntent } from './model-selection-motion';
import { BarChart3, Box, Database, Layers, Play, RefreshCw, Search } from 'lucide-react';
import { api, type ModelSummaryResponse, type ModelDetailResponse, type ModelRowTrendsResponse } from '@/api';
import { useI18n, useT } from '@/i18n';
import { useFormat } from '@/i18n/format';
import { useLiveRefresh, useRefreshStatus } from '@/lib/use-live';
import { useTheme } from '@/lib/use-theme';
import { RedesignShell } from './shell';
import { readScope, selectedScope, writeScope, type ScopeSelection, type ScopeRange } from './scope';
import { ScopeNotice } from './scope-notice';
import './models.css';
import { CostValue } from './cost-value';
import { ModelTokenDistribution } from './model-token-distribution-panel';
import { ChartData } from './chart-data';
import { ObservedTrend } from './observed-trend';
import { ObservedTrendAxes } from './observed-trend-axes';
import { modelProviderTrends, modelTrendBuckets } from './model-trends';
import { VendorIcon } from '@/components/vendor-icon';
import { ProviderMark } from './provider-mark';
import { PageHeading } from './page-heading';
import { HeadingReferenceIcon } from './heading-reference-icon';
import { SectionMark } from './section-mark';
import { selectModelGroup } from './model-selection';
import { InitialRegion, type InitialRegionState } from './initial-region';
import { EffortPagination, useEffortPage } from './effort-pagination';
import { effortPage } from './effort-page';
import { comparisonPageSelection } from './model-comparison-page';
import { modelPairKey, modelRowTrend, modelRowTrendTone } from './model-row-trends';

type Range = ScopeRange;
type Metric = 'tokens' | 'calls' | 'api_value_usd';
type Group = ModelSummaryResponse['groups'][number];
interface Route extends ScopeSelection { provider: string | null; vendor: string | null; metric: Metric; model: string | null | undefined; selectedProvider: string | null | undefined }
const identityKey = (group: { model: string | null; provider: string | null }) => JSON.stringify([group.model, group.provider]);
function readRoute(): Route {
  const p = new URLSearchParams(location.hash.split('?')[1] ?? '');
  const metric = p.get('metric');
  return { ...readScope(p, 'month'),
    provider: p.get('provider'), vendor: p.get('vendor'),
    metric: metric === 'calls' || metric === 'api_value_usd' ? metric : 'tokens',
    model: p.get('model_missing') === '1' ? null : p.has('model') ? p.get('model') : undefined,
    selectedProvider: p.get('selected_provider_missing') === '1' ? null : p.has('selected_provider') ? p.get('selected_provider') : undefined };
}
function routeHash(route: Route) {
  const p = writeScope(new URLSearchParams(), route);
  if (route.provider) p.set('provider', route.provider);
  if (route.vendor) p.set('vendor', route.vendor);
  if (route.metric !== 'tokens') p.set('metric', route.metric);
  if (route.model === null) p.set('model_missing', '1'); else if (route.model !== undefined) p.set('model', route.model);
  if (route.selectedProvider === null) p.set('selected_provider_missing', '1'); else if (route.selectedProvider !== undefined) p.set('selected_provider', route.selectedProvider);
  return `#models?${p}`;
}
export function ProductionModels() {
  const t = useT();
  const detailMarkGradient = `${useId()}-model-detail-blue`;
  const f = useFormat();
  const { lang, setLang, currency, rate } = useI18n();
  const [theme, toggleTheme] = useTheme();
  const [route, setRoute] = useState(readRoute);
  const [search, setSearch] = useState('');
  const [snapshot, setSnapshot] = useState<{ key: string; data: ModelSummaryResponse; base: ModelSummaryResponse; motion: LiveRecordBatch } | null>(null);
  const [detailSnapshot, setDetailSnapshot] = useState<{ key: string; data: ModelDetailResponse } | null>(null);
  const [failure, setFailure] = useState<{ key: string; epoch: number; message: string } | null>(null);
  const [detailFailure, setDetailFailure] = useState<{ key: string; message: string } | null>(null);
  const [queryRetry, setQueryRetry] = useState(0);
  const [queryBusy, setQueryBusy] = useState(false);
  const [detailRetry, setDetailRetry] = useState(0);
  const [detailBusy, setDetailBusy] = useState(false);
  const [comparisonSelection, setComparisonSelection] = useState({ scopeKey: '', selectionKey: '', page: 0 });
  const motionRows = useRef<HTMLDivElement>(null);
  const [presenceLedger] = useState(() => new AggregatePresenceLedger());
  const acceptedSerial = useRef(0);
  const mounted = useRef(true);
  const motionDetail = useRef<HTMLElement>(null);
  const [selectionIntent, setSelectionIntent] = useState<ModelSelectionIntent | null>(null);
  const [rowTrendSnapshot, setRowTrendSnapshot] = useState<{ key: string; data: ModelRowTrendsResponse } | null>(null);
  const [rowTrendFailure, setRowTrendFailure] = useState<string | null>(null);
  const [rowTrendRetry, setRowTrendRetry] = useState(0);
  const [rowTrendBusy, setRowTrendBusy] = useState(false);
  const refresh = useRefreshStatus();
  const requestKey = JSON.stringify([route.range, route.from, route.to, route.sourceId, route.provider, route.vendor]);
  const currentKey = useRef(requestKey);
  const scopeEpoch = useRef(0);
  if (currentKey.current !== requestKey) scopeEpoch.current++;
  currentKey.current = requestKey;
  useEffect(() => {
    mounted.current = true;
    const sync = () => { if (location.hash.slice(1).split('?')[0] === 'models') setRoute(readRoute()); };
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
    const key = requestKey;
    const requestedEpoch = scopeEpoch.current;
    const isCurrent = () => mounted.current && currentKey.current === key && scopeEpoch.current === requestedEpoch;
    const range = selectedScope(route, Date.now());
    setQueryBusy(true);
    try {
      const basePromise = api.modelSummary(range, true);
      const dataPromise = route.provider || route.vendor ? api.modelSummary({ ...range, ...(route.provider ? { provider: route.provider } : {}), ...(route.vendor ? { vendor: route.vendor } : {}) }, true) : basePromise;
      const [base, data] = await Promise.all([basePromise, dataPromise]);
      if (isCurrent()) { setSnapshot({ key, base, data, motion: { serial: ++acceptedSerial.current, reason: context.reason, requestEligibility } }); setFailure(null); }
    } catch (cause) { if (!isCurrent()) return; setFailure({ key, epoch: requestedEpoch, message: String(cause) }); throw cause; }
    finally { if (isCurrent()) setQueryBusy(false); }
  }, [requestKey, queryRetry]);

  const current = snapshot?.key === requestKey ? snapshot : null;
  const error = failure?.key === requestKey && failure.epoch === scopeEpoch.current ? failure.message : null;
  const data = current?.data;
  const groups = data?.groups ?? [];
  const providers = [...new Set(current?.base.groups.map(group => group.provider).filter((value): value is string => Boolean(value)) ?? [])].sort();
  const vendors = [...new Set(current?.base.groups.map(group => group.vendor).filter(Boolean) ?? [])].sort();
  const needle = search.toLocaleLowerCase(lang);
  const visible = groups.filter(group => !needle || [group.model, group.provider, group.vendor].some(value => (value ?? '').toLocaleLowerCase(lang).includes(needle)))
    .sort((a, b) => b[route.metric] - a[route.metric] || identityKey(a).localeCompare(identityKey(b)));
  const selected = selectModelGroup(visible, route.model, route.selectedProvider);
  const comparisonScopeKey = JSON.stringify([requestKey, search, route.metric]);
  const routeSelectionKey = JSON.stringify([route.model === undefined, route.model, route.selectedProvider === undefined, route.selectedProvider]);
  const comparisonCurrent = comparisonPageSelection(comparisonSelection, comparisonScopeKey, routeSelectionKey, data ? visible.length : undefined, selected ? visible.indexOf(selected) : -1);
  if (comparisonCurrent !== comparisonSelection) setComparisonSelection(comparisonCurrent);
  const comparison = effortPage(visible, comparisonCurrent.page);
  const rowPairs = comparison.rows.map(({ model, provider }) => ({ model, provider }));
  const rowTrendKey = JSON.stringify([data?.scope, rowPairs]);
  useEffect(() => {
    if (!data || rowPairs.length === 0) return;
    let cancelled = false;
    setRowTrendFailure(null);
    setRowTrendBusy(true);
    void api.modelRowTrends(data.scope, rowPairs).then(result => {
      if (!cancelled) setRowTrendSnapshot({ key: rowTrendKey, data: result });
    }).catch(() => { if (!cancelled) setRowTrendFailure(rowTrendKey); }).finally(() => { if (!cancelled) setRowTrendBusy(false); });
    return () => { cancelled = true; };
  }, [data, rowTrendKey, rowTrendRetry]);
  const rowTrends = rowTrendSnapshot?.key === rowTrendKey ? rowTrendSnapshot.data : null;
  const rowTrendError = rowTrendFailure === rowTrendKey;
  const detailKey = JSON.stringify([data?.scope, selected && identityKey(selected)]);
  useEffect(() => {
    if (!data || !selected) return;
    let cancelled = false;
    setDetailFailure(null);
    setDetailBusy(true);
    void api.modelDetail(data.scope, { model: selected.model, provider: selected.provider }).then(result => {
      if (!cancelled) setDetailSnapshot({ key: detailKey, data: result });
    }).catch(cause => { if (!cancelled) setDetailFailure({ key: detailKey, message: String(cause) }); }).finally(() => { if (!cancelled) setDetailBusy(false); });
    return () => { cancelled = true; };
  }, [data, detailKey, detailRetry]);
  const detailError = detailFailure?.key === detailKey ? detailFailure.message : null;
  const detail = detailSnapshot?.key === detailKey ? detailSnapshot.data : null;
  const selectionMotionContext = JSON.stringify([comparisonScopeKey, comparison.page]);
  const selectedMotionKey = selected ? modelPairKey(selected) : null;
  const cancelPresence = useAggregatePresenceMotion(motionRows, presenceLedger, { batch: current?.motion,
    context: JSON.stringify([selectionMotionContext, lang, currency, rate, theme]),
    universe: groups.map(modelPairKey), page: comparison.rows.map(modelPairKey),
    enabled: !!current && !error, hasSnapshot: !!snapshot, mounted: !!current && visible.length > 0,
    selectionSerial: selectionIntent?.serial ?? 0, selectionKey: selectedMotionKey,
    attribute: 'data-model-pair-key', selector: '[data-model-pair-key]' });
  useModelSelectionMotion(motionRows, motionDetail, { contextKey: selectionMotionContext, selectedKey: selectedMotionKey,
    detailKey: data && selected ? detailKey : null, acceptedDetailKey: detail ? detailKey : null,
    intent: selectionIntent, enabled: !!current && !!selected && !error, failed: !!detailError,
    rowsMounted: !!current && visible.length > 0 });
  const selectPair = (group: Group) => {
    const key = modelPairKey(group);
    if (key !== selectedMotionKey) cancelPresence(key);
    if (key !== selectedMotionKey) setSelectionIntent(previous => ({ serial: (previous?.serial ?? 0) + 1, key, contextKey: selectionMotionContext }));
    update({ model: group.model, selectedProvider: group.provider });
  };
  const trend = detail ? Array.from({ length: Math.ceil((detail.scope.to - detail.scope.from) / detail.bucketMs) }, (_, index) => {
    const start = detail.scope.from + index * detail.bucketMs;
    return { start, tokens: detail.points.find(point => point.start === start)?.tokens ?? 0, calls: detail.points.find(point => point.start === start)?.calls ?? 0 };
  }) : [];
  const effort = useEffortPage(detail?.efforts, JSON.stringify([requestKey, selected && identityKey(selected)]));
  const effortTotal = detail?.efforts.reduce((sum, effort) => sum + effort.tokens, 0) ?? 0;
  const trendMax = Math.max(0, ...trend.map(point => route.metric === 'calls' ? point.calls : point.tokens));
  const summaryBuckets = data ? modelTrendBuckets(data) : [];
  const providerRows = data ? modelProviderTrends(data) : [];
  const recordedProviders = new Set(groups.map(group => group.provider).filter(provider => provider !== null && provider.trim() !== ''));
  const missingProviderPairs = groups.filter(group => group.provider === null || group.provider.trim() === '').length;
  const inputTokens = data ? data.totals.inputTokens + data.totals.cachedInputTokens + data.totals.cacheWriteTokens : 0;
  const number = (value: number) => new Intl.NumberFormat(lang === 'th' ? 'th-TH' : 'en-US', { maximumFractionDigits: 0 }).format(value);
  const money = (usd: number) => new Intl.NumberFormat(lang === 'th' ? 'th-TH' : 'en-US', { style: 'currency', currency }).format(currency === 'THB' ? usd * rate : usd);
  const apiValue = (group: Pick<Group, 'api_value_usd' | 'computed_calls' | 'estimated_calls' | 'calls'>) => <CostValue amount={group.api_value_usd} priced={group.computed_calls + group.estimated_calls} total={group.calls} money={money} t={t}/>;
  const name = (value: string | null) => value || t('redesign.modelsUnspecified');
  const coverage = (group: Group) => group.calls > 0 ? (group.native_calls + group.computed_calls + group.estimated_calls) / group.calls * 100 : null;
  const cacheShare = (group: Group) => group.inputTokens + group.cachedInputTokens + group.cacheWriteTokens > 0 ? group.cachedInputTokens / (group.inputTokens + group.cachedInputTokens + group.cacheWriteTokens) * 100 : null;
  const ratio = (value: number | null) => value === null ? '—' : <span className="qp-model-ratio"><span>{f.pct(value)}</span><span className="qp-bar" aria-hidden="true"><span style={{ width: `${Math.max(0, Math.min(100, value))}%` }}/></span></span>;
  const historyHref = selected && data && selected.model && selected.provider ? `#history?${new URLSearchParams({ range: 'custom', from: String(data.scope.from), to: String(data.scope.to), model: selected.model, provider: selected.provider, ...(data.scope.vendor ? { vendor: data.scope.vendor } : {}), ...(data.scope.sourceId ? { source: String(data.scope.sourceId) } : {}) })}` : null;

  const initialState: InitialRegionState = {
    kind: error ? 'error' : 'loading', label: t(error ? 'app.couldNotLoad' : 'app.loading'), detail: error ?? undefined,
    retryLabel: t('app.retry'), retrying: queryBusy,
    onRetry: () => { document.getElementById('models')?.focus({ preventScroll: true }); setFailure(null); setQueryRetry(value => value + 1); },
  };
  const detailState: InitialRegionState = {
    kind: detailError ? 'error' : 'loading', label: t(detailError ? 'app.couldNotLoad' : 'app.loading'), detail: detailError ?? undefined,
    retryLabel: t('app.retry'), retrying: detailBusy,
    onRetry: () => { document.getElementById('models')?.focus({ preventScroll: true }); setDetailFailure(null); setDetailRetry(value => value + 1); },
  };

  return <RedesignShell quickStatsScope={data?.scope ?? null} active="models" theme={theme} language={lang} onTheme={toggleTheme} onLanguage={() => setLang(lang === 'en' ? 'th' : 'en')} t={t} testId="production-models">
    <div className="qp-model-layout">
      <div className="qp-model-primary">
        <div className="qp-model-overview">
        <header className="qp-model-header"><PageHeading icon={<HeadingReferenceIcon kind="models"/>} title={t('redesign.modelsHeading')} subtitle={t('redesign.modelsSubtitle')} compact/><button onClick={() => current ? void refresh.refreshNow() : initialState.onRetry()} disabled={refresh.refreshing || (!current && queryBusy)}><RefreshCw size={16}/>{t('app.refreshNow')}</button></header>
        {current && error && <p className="qp-model-error" role="status">{t('redesign.staleSnapshot')} · {error}</p>}
        {!current ? <section className="qp-model-summary" aria-label={t('redesign.modelsHeading')}>{(['redesign.modelsCount', 'redesign.modelsTokens', 'redesign.modelsSessions', 'redesign.modelsValue'] as const).map((label, index) => <InitialRegion key={label} id={`models-summary-${index}`} label={t(label)} state={initialState} className="qp-model-summary-pending" slots={2}/>)}</section> :
          <section className="qp-model-summary" aria-label={t('redesign.modelsHeading')}>
            <article className="qp-panel" data-tone="blue" data-history={summaryBuckets.length > 0} data-wide={number(groups.length).length > 6} data-long-count={number(groups.length).length > 3}><span className="qp-model-summary-icon" aria-hidden="true"><Box size={24}/></span><span>{t('redesign.modelsCount')}</span><strong>{number(groups.length)}</strong><small data-testid="models-provider-count" data-known-providers={recordedProviders.size} data-unknown-provider-pairs={missingProviderPairs}>{t('redesign.modelsAcrossProviders').replace('{count}', number(recordedProviders.size))}{missingProviderPairs > 0 && <abbr title={t('redesign.unknownValue') + ': ' + number(missingProviderPairs) + ' ' + t('redesign.modelsCount')}> + ?</abbr>}</small>{summaryBuckets.length > 0 && <ObservedTrend className="qp-model-summary-spark" points={summaryBuckets.map(point => ({ at: point.start, value: point.pairs }))} label={t('redesign.modelsPairsPerBucket')} language={lang} grid={false}/>}</article>
            <article className="qp-panel" data-tone="orange" data-history={summaryBuckets.length > 0}><span className="qp-model-summary-icon" aria-hidden="true"><Database size={24}/></span><span>{t('redesign.modelsTokens')}</span><strong>{f.tokens(data!.totals.tokens)}</strong><small className="qp-model-token-components" title={t('redesign.liveFlowBreakdown')}><span data-component="input" data-value={inputTokens} title={number(inputTokens)}>{t('redesign.modelsInput')} <b>{f.tokens(inputTokens)}</b></span><span data-component="output" data-value={data!.totals.outputTokens} title={number(data!.totals.outputTokens)}>{t('redesign.modelsOutput')} <b>{f.tokens(data!.totals.outputTokens)}</b></span></small>{summaryBuckets.length > 0 && <ObservedTrend className="qp-model-summary-spark" points={summaryBuckets.map(point => ({ at: point.start, value: point.tokens }))} label={t('redesign.modelsTokens')} language={lang} grid={false}/>}</article>
            <article className="qp-panel" data-tone="violet" data-history={summaryBuckets.length > 0} data-wide={number(data!.totals.sessions).length > 6} data-long-count={number(data!.totals.sessions).length > 3}><span className="qp-model-summary-icon" aria-hidden="true"><Play size={24}/></span><span>{t('redesign.modelsSessions')}</span><strong>{number(data!.totals.sessions)}</strong>{summaryBuckets.length > 0 && <ObservedTrend className="qp-model-summary-spark" points={summaryBuckets.map(point => ({ at: point.start, value: point.sessions }))} label={t('redesign.modelsSessionsPerBucket')} language={lang} grid={false}/>}</article>
            <article className="qp-panel" data-tone="orange" data-history={summaryBuckets.some(point => point.apiValue !== null)} data-wide={money(data!.totals.api_value_usd).length + (data!.totals.computed_calls + data!.totals.estimated_calls < data!.totals.calls ? 1 : 0) > 5}><span className="qp-model-summary-icon" aria-hidden="true"><Database size={24}/></span><span>{t('redesign.modelsValue')}</span><strong>{apiValue(data!.totals)}</strong><small>{t('redesign.modelsNative')}: {<CostValue amount={data!.totals.reported_native_usd} priced={data!.totals.native_calls} total={data!.totals.calls} money={money} t={t}/>}</small>{summaryBuckets.some(point => point.apiValue !== null) && <ObservedTrend className="qp-model-summary-spark qp-model-value-spark" points={summaryBuckets.map(point => ({ at: point.start, value: point.apiValue === null ? null : currency === 'THB' ? point.apiValue * rate : point.apiValue }))} label={`${t('redesign.modelsKnownValueTrend')} (${currency})`} language={lang} grid={false}/>}</article>
          </section>
        }
        </div>
        <>
          <section className="qp-panel qp-model-comparison"><div className="qp-model-comparison-heading"><h2><SectionMark icon={<BarChart3/>}/>{t('redesign.modelsCompare')}</h2>{data && data.totals.unknown_calls > 0 && <p className="qp-footnote">{t('redesign.modelsPartialValue')} · {number(data!.totals.unknown_calls)} {t('redesign.modelsCalls')}</p>}</div>
          <div className="qp-model-toolbar"><label className="qp-model-search"><Search size={15}/><span className="qp-visually-hidden">{t('redesign.modelsSearch')}</span><input value={search} onChange={event => setSearch(event.target.value)} placeholder={t('redesign.modelsSearch')} maxLength={256}/></label>
            <label><span className="qp-model-filter-caption">{t('redesign.projectRange')}</span><select value={route.range} onChange={event => update({ range: event.target.value as Range, model: undefined, selectedProvider: undefined })}><option value="today">{t('redesign.today')}</option><option value="week">{t('redesign.thisWeek')}</option><option value="month">{t('redesign.thisMonth')}</option><option value="all">{t('redesign.allTime')}</option>{route.range === 'custom' && <option value="custom">{t('usage.custom')}</option>}</select></label>
            <label><span className="qp-model-filter-caption">{t('redesign.modelsProvider')}</span><select value={route.provider ?? ''} onChange={event => update({ provider: event.target.value || null, model: undefined, selectedProvider: undefined })}><option value="">{t('redesign.modelsAllProviders')}</option>{!current && route.provider && <option value={route.provider}>{route.provider}</option>}{providers.map(provider => <option key={provider} value={provider}>{provider}</option>)}</select></label>
            <label><span className="qp-model-filter-caption">{t('redesign.modelsVendor')}</span><select value={route.vendor ?? ''} onChange={event => update({ vendor: event.target.value || null, model: undefined, selectedProvider: undefined })}><option value="">{t('redesign.modelsAllVendors')}</option>{!current && route.vendor && <option value={route.vendor}>{route.vendor}</option>}{vendors.map(vendor => <option key={vendor} value={vendor}>{vendor}</option>)}</select></label>
            <label><span className="qp-model-filter-caption">{t('redesign.modelsMetric')}</span><select value={route.metric} onChange={event => update({ metric: event.target.value as Metric })}><option value="tokens">{t('redesign.modelsTokens')}</option><option value="calls">{t('redesign.modelsCalls')}</option><option value="api_value_usd">{t('redesign.modelsValue')}</option></select></label>
          </div>
          <ScopeNotice scope={route}/>
          {!current ? <InitialRegion id="models-comparison" label={t('redesign.modelsCompare')} heading={<></>} state={initialState} className="qp-model-table-pending" status slots={8}/> : groups.length === 0 ? <p>{t('redesign.modelsNoData')}</p> : visible.length === 0 ? <p>{t('redesign.modelsNoMatch')}</p> : <div ref={motionRows} className="qp-model-table-wrap" tabIndex={0} role="region" aria-label={t('redesign.modelsCompare')}><table><thead><tr><th>{t('redesign.modelsModel')}</th><th>{t('redesign.modelsProvider')}</th><th>{t('redesign.modelsVendor')}</th><th>{t('redesign.modelsTokens')}</th><th>{t('redesign.modelsCalls')}</th><th>{t('redesign.modelsSessions')}</th><th>{t('redesign.modelsCache')}</th><th>{t('redesign.modelsCoverage')}</th><th>{t('redesign.modelsValueShort')}</th><th>{t('redesign.modelsRowTrend')}</th></tr></thead><tbody>{comparison.rows.map(group => <tr key={identityKey(group)} data-model-pair-key={modelPairKey(group)} data-selected={selected === group}><td><button aria-pressed={selected === group} onClick={() => selectPair(group)}><span className="qp-model-maker-mark" data-vendor={group.vendor} aria-hidden="true">{group.vendor === 'unknown' ? <Layers size={17} aria-hidden="true"/> : <VendorIcon vendor={group.vendor}/>}</span><span className="qp-model-name">{name(group.model)}</span></button></td><td><span className="qp-model-brand"><ProviderMark vendor={group.provider ?? 'unknown'}/>{name(group.provider)}</span></td><td>{name(group.vendor)}</td><td>{f.tokens(group.tokens)}</td><td>{number(group.calls)}</td><td>{number(group.sessions)}</td><td>{ratio(cacheShare(group))}</td><td>{ratio(coverage(group))}</td><td>{apiValue(group)}</td><td className="qp-model-row-trend-cell" data-trend-tone={modelRowTrendTone(group)}>{(() => {
            const points = modelRowTrend(rowTrends, group);
            const label = t('redesign.modelsRowTrendScope', { model: name(group.model), provider: name(group.provider), from: data ? new Date(data.scope.from).toLocaleString(lang) : '', to: data ? new Date(data.scope.to).toLocaleString(lang) : '' });
            return points === null ? <small className="qp-model-row-trend-status">{t(rowTrendBusy && !rowTrendError ? 'app.loading' : 'redesign.modelsRowTrendUnavailable')}</small> : points.length === 0 ? <small className="qp-model-row-trend-status">{t('redesign.modelsRowTrendNoHistory')}</small> : <ObservedTrend className="qp-model-row-trend" points={points} label={label} language={lang} grid={false} area={false}/>;
          })()}</td></tr>)}</tbody></table></div>}
          {current && (comparison.hasPrevious || comparison.hasNext) && <nav className="qp-model-comparison-pagination" data-testid="model-comparison-pagination" aria-label={t('redesign.modelsComparePages')}><small role="status" aria-live="polite">{t('redesign.modelsCompareRange', { from: number(comparison.from), to: number(comparison.to), total: number(comparison.total) })}</small><button type="button" disabled={!comparison.hasPrevious} onClick={() => setComparisonSelection({ ...comparisonCurrent, page: comparison.page - 1 })}>{t('history.previous')}</button><button type="button" disabled={!comparison.hasNext} onClick={() => setComparisonSelection({ ...comparisonCurrent, page: comparison.page + 1 })}>{t('history.next')}</button></nav>}
          {current && rowTrendError && <p className="qp-model-row-trend-error" role="status">{t(rowTrends ? 'redesign.staleSnapshot' : 'redesign.modelsRowTrendUnavailable')} <button type="button" disabled={rowTrendBusy} onClick={() => setRowTrendRetry(value => value + 1)}>{t('app.retry')}</button></p>}
          {summaryBuckets.length > 0 && <details className="qp-model-history"><summary>{t('redesign.chartData')} ({number(summaryBuckets.length)})</summary><div tabIndex={0} role="region" aria-label={t('redesign.chartData')}><table><caption>{t('redesign.modelsCompare')}</caption><thead><tr><th>{t('redesign.chartBucketStart')}</th><th>{t('redesign.modelsTokens')}</th><th>{t('redesign.modelsPairsPerBucket')}</th><th>{t('redesign.modelsSessionsPerBucket')}</th><th>{t('redesign.modelsKnownValueTrend')} ({currency})</th><th>{t('redesign.modelsPricedCalls')}</th>{providerRows.map(value => <th key={JSON.stringify(value.provider)}>{name(value.provider)} ({t('redesign.modelsTokens')})</th>)}</tr></thead><tbody>{summaryBuckets.map((point, index) => <tr key={point.start}><td><time dateTime={new Date(point.start).toISOString()}>{new Date(point.start).toLocaleString(lang === 'th' ? 'th-TH' : 'en-US')}</time></td><td>{number(point.tokens)}</td><td>{number(point.pairs)}</td><td>{number(point.sessions)}</td><td>{point.apiValue === null ? t('redesign.unknownValue') : <CostValue amount={point.api_value_usd} priced={point.api_priced_calls} total={point.calls} money={money} t={t}/>}</td><td>{number(point.api_priced_calls)} / {number(point.calls)}</td>{providerRows.map(value => <td key={JSON.stringify(value.provider)}>{number(value.points[index].value)}</td>)}</tr>)}</tbody></table></div></details>}</section>
          <section className="qp-panel qp-model-providers"><h2><SectionMark icon={<Box/>} size={20}/>{t('redesign.modelsProviderDistribution')}</h2><div className="qp-model-provider-list" tabIndex={0} role="region" aria-label={t('redesign.modelsProviderDistribution')}>{!current ? <InitialRegion id="models-providers" label={t('redesign.modelsProviderDistribution')} heading={<></>} state={initialState} className="qp-model-providers-pending" slots={2}/> : providerRows.map(value => <button key={JSON.stringify(value.provider)} data-provider={value.provider ?? undefined} data-provider-missing={value.provider === null ? true : undefined} disabled={!value.provider} aria-pressed={value.provider !== null && route.provider === value.provider} onClick={() => update({ provider: route.provider === value.provider ? null : value.provider, model: undefined, selectedProvider: undefined })}><span className="qp-model-provider-mark" aria-hidden="true"><ProviderMark vendor={value.provider || 'unknown'}/></span><strong>{name(value.provider)}</strong><span className="qp-model-provider-facts">{f.tokens(value.tokens)} · {number(value.pairs)} {t('redesign.modelsCount')}</span><span className="qp-model-provider-share">{data!.totals.tokens > 0 ? f.pct(value.tokens / data!.totals.tokens * 100) : t('redesign.unknownValue')}</span>{value.points.length > 0 ? <ObservedTrend className="qp-model-provider-spark" points={value.points} language={lang} label={`${name(value.provider)} · ${t('redesign.modelsTokens')}`} grid={false}/> : <span className="qp-bar"><span style={{ width: `${data!.totals.tokens ? value.tokens / data!.totals.tokens * 100 : 0}%` }}/></span>}</button>)}</div></section>
        </>
      </div>
      <aside ref={motionDetail} className="qp-model-detail" data-model-selection-detail={selectedMotionKey ?? undefined}>{!current ? <>{(['redesign.modelsDetails', 'redesign.modelsDistribution', 'redesign.modelsTrend', 'redesign.modelsEffort'] as const).map((label, index) => <InitialRegion key={label} id={`models-detail-${index}`} label={t(label)} state={initialState} className={`qp-model-detail-pending qp-model-detail-pending-${index}`}/>)}</> : selected && <><section className="qp-panel"><h2>{t('redesign.modelsDetails')}</h2><div className="qp-model-detail-identity"><svg className="qp-model-detail-mark-defs" width="0" height="0" aria-hidden="true" focusable="false"><defs><linearGradient id={detailMarkGradient} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#2585ff"/><stop offset=".45" stopColor="#2166ff"/><stop offset="1" stopColor="#1747eb"/></linearGradient></defs></svg><span className="qp-model-detail-provider" data-vendor={selected.provider ?? selected.vendor ?? 'unknown'} aria-hidden="true"><VendorIcon vendor={selected.provider ?? selected.vendor ?? 'unknown'} mono={(selected.provider ?? selected.vendor ?? 'unknown') === 'deepseek'} style={(selected.provider ?? selected.vendor ?? 'unknown') === 'deepseek' ? { fill: `url(#${detailMarkGradient})` } : undefined}/></span><div><h3>{name(selected.model)}</h3><p>{t('redesign.modelsProvider')}: {name(selected.provider)} · {t('redesign.modelsVendor')}: {name(selected.vendor)}</p></div></div><div className="qp-model-recorded-facts"><span>{t('redesign.modelsFreshInput')} <strong>{f.tokens(selected.inputTokens)}</strong></span><span>{t('redesign.modelsOutput')} <strong>{f.tokens(selected.outputTokens)}</strong></span><span>{t('redesign.modelsCache')} <strong>{cacheShare(selected) === null ? t('redesign.unknownValue') : f.pct(cacheShare(selected)!)}</strong></span><p>{t('redesign.modelsNative')}: <CostValue amount={selected.reported_native_usd} priced={selected.native_calls} total={selected.calls} money={money} t={t}/></p></div><div className="qp-model-detail-stats"><div><span>{t('redesign.modelsCalls')}</span><strong>{number(selected.calls)}</strong></div><div><span>{t('redesign.modelsSessions')}</span><strong>{number(selected.sessions)}</strong></div><div><span>{t('redesign.modelsCoverage')}</span><strong>{coverage(selected) === null ? '—' : f.pct(coverage(selected))}</strong></div><div><span>{t('redesign.modelsValue')}</span><strong>{apiValue(selected)}</strong></div></div>{historyHref ? <a href={historyHref}>{t('redesign.modelsHistory')}</a> : <small>{t('redesign.modelsNoExactHistory')}</small>}</section>
        <ModelTokenDistribution facts={selected}/>
        <section className="qp-panel qp-model-trend-panel"><h2>{t('redesign.modelsTrend')}</h2>{detail && detailError && <p role="status">{t('redesign.staleSnapshot')} · {detailError}<button onClick={detailState.onRetry} disabled={detailBusy}>{t('app.retry')}</button></p>}{!detail ? <InitialRegion id="models-detail-trend" label={t('redesign.modelsTrend')} heading={<></>} state={detailState} status className="qp-model-trend-pending"/> : trend.length === 0 ? <p>{t('redesign.modelsNoTrend')}</p> : <><ObservedTrendAxes valueLabel={t(route.metric === 'calls' ? 'redesign.modelsCalls' : 'redesign.modelsTokens')} className="qp-model-trend" bucketMs={detail.bucketMs} tickCount={3} points={trend.map(point => ({ at: point.start, value: route.metric === 'calls' ? point.calls : point.tokens }))} language={lang} label={`${t('redesign.modelsTrend')}: ${t(route.metric === 'calls' ? 'redesign.modelsCalls' : 'redesign.modelsTokens')} 0 – ${number(trendMax)}`}/><ChartData title={t('redesign.modelsTrend')} points={trend.map(point => ({ at: point.start, value: route.metric === 'calls' ? point.calls : point.tokens }))} valueLabel={t(route.metric === 'calls' ? 'redesign.modelsCalls' : 'redesign.modelsTokens')} language={lang} t={t}/></>}</section>
        <section className="qp-panel"><h2>{t('redesign.modelsEffort')}</h2>{!detail ? <InitialRegion id="models-detail-effort" label={t('redesign.modelsEffort')} heading={<></>} state={detailState} className="qp-model-effort-pending"/> : <>{detail.efforts.length ? <ul className="qp-model-efforts">{effort.rows.map(row => <li key={JSON.stringify(row.effort)}><span>{row.effort === null ? t('redesign.modelsUnspecified') : row.effort === '' ? t('redesign.modelsEmptyEffort') : row.effort}</span><strong>{f.tokens(row.tokens)} · {number(row.calls)} {t('redesign.modelsCalls')}</strong><span className="qp-bar qp-model-effort-share" aria-hidden="true"><span style={{ width: `${effortTotal > 0 ? row.tokens / effortTotal * 100 : 0}%` }}/></span></li>)}</ul> : <p>{t('redesign.unknownValue')}</p>}<EffortPagination {...effort}/><dl><dt>{t('redesign.modelsContext')}</dt><dd data-testid="model-catalog-context">{detail?.catalogContext ? <>{f.tokens(detail.catalogContext.window)}<br/><small>{detail.catalogContext.origin ?? t('redesign.unknownValue')} · {t('redesign.modelsCatalogLoaded')}: {detail.catalogContext.loadedAt === null ? t('redesign.unknownValue') : new Date(detail.catalogContext.loadedAt).toLocaleString(lang === 'th' ? 'th-TH' : 'en-US')}</small></> : t('redesign.unknownValue')}</dd><dt>{t('redesign.modelsObservedContext')}</dt><dd>{detail?.observedContext.window == null ? t('redesign.unknownValue') : `${f.tokens(detail.observedContext.window)} · ${t('redesign.modelsOrigin')} · ${f.clock(detail.observedContext.at)}`}</dd></dl></>}</section></>}</aside>
    </div>
  </RedesignShell>;
}
