import { useEffect, useId, useRef, useState } from 'react';
import { BarChart3, Box, Coins, Database, Layers, RefreshCw, Search, Users } from 'lucide-react';
import { api, type DetailedModelResponse, type ModelDetailResponse } from '@/api';
import { useI18n, useT } from '@/i18n';
import { useFormat } from '@/i18n/format';
import { useLiveRefresh, useRefreshStatus } from '@/lib/use-live';
import { useTheme } from '@/lib/use-theme';
import { RedesignShell } from './shell';
import { readScope, selectedScope, writeScope, type ScopeSelection, type ScopeRange } from './scope';
import { ScopeNotice } from './scope-notice';
import './models.css';
import { CostValue } from './cost-value';
import { ChartData } from './chart-data';
import { ObservedTrend } from './observed-trend';
import { modelProviderTrends, modelTrendBuckets } from './model-trends';
import { VendorIcon } from '@/components/vendor-icon';
import { PageHeading } from './page-heading';
import { SectionMark } from './section-mark';

type Range = ScopeRange;
type Metric = 'tokens' | 'calls' | 'api_value_usd';
type Group = DetailedModelResponse['groups'][number];
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
  const [snapshot, setSnapshot] = useState<{ key: string; data: DetailedModelResponse; base: DetailedModelResponse } | null>(null);
  const [detailSnapshot, setDetailSnapshot] = useState<{ key: string; data: ModelDetailResponse } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const refresh = useRefreshStatus();
  const requestKey = JSON.stringify([route.range, route.from, route.to, route.sourceId, route.provider, route.vendor]);
  const currentKey = useRef(requestKey);
  currentKey.current = requestKey;
  useEffect(() => {
    const sync = () => { if (location.hash.slice(1).split('?')[0] === 'models') setRoute(readRoute()); };
    addEventListener('hashchange', sync);
    return () => removeEventListener('hashchange', sync);
  }, []);
  const update = (patch: Partial<Route>) => {
    const next = { ...route, ...patch };
    history.replaceState(null, '', `${location.pathname}${location.search}${routeHash(next)}`);
    setRoute(next);
  };
  useLiveRefresh(async () => {
    const key = requestKey;
    const range = selectedScope(route, Date.now());
    try {
      const basePromise = api.detailedModels(range, true);
      const dataPromise = route.provider || route.vendor ? api.detailedModels({ ...range, ...(route.provider ? { provider: route.provider } : {}), ...(route.vendor ? { vendor: route.vendor } : {}) }, true) : basePromise;
      const [base, data] = await Promise.all([basePromise, dataPromise]);
      if (currentKey.current === key) { setSnapshot({ key, base, data }); setError(null); }
    } catch (cause) { if (currentKey.current === key) setError(String(cause)); throw cause; }
  }, [requestKey]);

  const current = snapshot?.key === requestKey ? snapshot : null;
  const data = current?.data;
  const groups = data?.groups ?? [];
  const providers = [...new Set(current?.base.groups.map(group => group.provider).filter((value): value is string => Boolean(value)) ?? [])].sort();
  const vendors = [...new Set(current?.base.groups.map(group => group.vendor).filter(Boolean) ?? [])].sort();
  const needle = search.toLocaleLowerCase(lang);
  const visible = groups.filter(group => !needle || [group.model, group.provider, group.vendor].some(value => (value ?? '').toLocaleLowerCase(lang).includes(needle)))
    .sort((a, b) => b[route.metric] - a[route.metric] || identityKey(a).localeCompare(identityKey(b)));
  const selected = visible.find(group => group.model === route.model && group.provider === route.selectedProvider) ?? visible[0];
  const detailKey = JSON.stringify([data?.scope, selected && identityKey(selected)]);
  useEffect(() => {
    if (!data || !selected) return;
    let cancelled = false;
    setDetailError(null);
    void api.modelDetail(data.scope, { model: selected.model, provider: selected.provider }).then(result => {
      if (!cancelled) setDetailSnapshot({ key: detailKey, data: result });
    }).catch(cause => { if (!cancelled) setDetailError(String(cause)); });
    return () => { cancelled = true; };
  }, [detailKey]);
  const detail = detailSnapshot?.key === detailKey ? detailSnapshot.data : null;
  const trend = detail ? Array.from({ length: Math.ceil((detail.scope.to - detail.scope.from) / detail.bucketMs) }, (_, index) => {
    const start = detail.scope.from + index * detail.bucketMs;
    return { start, tokens: detail.points.find(point => point.start === start)?.tokens ?? 0, calls: detail.points.find(point => point.start === start)?.calls ?? 0 };
  }) : [];
  const effortTotal = detail?.efforts.reduce((sum, effort) => sum + effort.tokens, 0) ?? 0;
  const trendMax = Math.max(0, ...trend.map(point => route.metric === 'calls' ? point.calls : point.tokens));
  const distribution = selected ? [
    { label: t('redesign.modelsFreshInput'), value: selected.inputTokens, color: '#2bb8ef' },
    { label: t('redesign.modelsCachedInput'), value: selected.cachedInputTokens, color: '#775cf6' },
    { label: t('redesign.modelsCacheWrite'), value: selected.cacheWriteTokens, color: '#ad6be8' },
    { label: t('redesign.modelsOutput'), value: selected.outputTokens, color: '#18cfa9' },
  ] : [];
  const distributionTotal = distribution.reduce((sum, part) => sum + part.value, 0);
  const summaryBuckets = data ? modelTrendBuckets(data) : [];
  const providerRows = data ? modelProviderTrends(data) : [];
  const number = (value: number) => new Intl.NumberFormat(lang === 'th' ? 'th-TH' : 'en-US', { maximumFractionDigits: 0 }).format(value);
  const money = (usd: number) => new Intl.NumberFormat(lang === 'th' ? 'th-TH' : 'en-US', { style: 'currency', currency }).format(currency === 'THB' ? usd * rate : usd);
  const apiValue = (group: Pick<Group, 'api_value_usd' | 'computed_calls' | 'estimated_calls' | 'calls'>) => <CostValue amount={group.api_value_usd} priced={group.computed_calls + group.estimated_calls} total={group.calls} money={money} t={t}/>;
  const name = (value: string | null) => value || t('redesign.modelsUnspecified');
  const coverage = (group: Group) => group.calls > 0 ? (group.native_calls + group.computed_calls + group.estimated_calls) / group.calls * 100 : null;
  const cacheShare = (group: Group) => group.inputTokens + group.cachedInputTokens + group.cacheWriteTokens > 0 ? group.cachedInputTokens / (group.inputTokens + group.cachedInputTokens + group.cacheWriteTokens) * 100 : null;
  const ratio = (value: number | null) => value === null ? '—' : <span className="qp-model-ratio"><span>{f.pct(value)}</span><span className="qp-bar" aria-hidden="true"><span style={{ width: `${Math.max(0, Math.min(100, value))}%` }}/></span></span>;
  const historyHref = selected && data && selected.model && selected.provider ? `#history?${new URLSearchParams({ range: 'custom', from: String(data.scope.from), to: String(data.scope.to), model: selected.model, provider: selected.provider, ...(data.scope.vendor ? { vendor: data.scope.vendor } : {}), ...(data.scope.sourceId ? { source: String(data.scope.sourceId) } : {}) })}` : null;

  return <RedesignShell active="models" theme={theme} language={lang} onTheme={toggleTheme} onLanguage={() => setLang(lang === 'en' ? 'th' : 'en')} t={t} testId="production-models">
    <div className="qp-model-layout">
      <div className="qp-model-primary">
        <div className="qp-model-overview">
        <header className="qp-model-header"><PageHeading icon={<Box size={24}/>} title={t('redesign.modelsHeading')} subtitle={t('redesign.modelsSubtitle')} compact/><button onClick={() => void refresh.refreshNow()} disabled={refresh.refreshing}><RefreshCw size={16}/>{t('app.refreshNow')}</button></header>
        {error && <p className="qp-model-error" role="status">{t('redesign.staleSnapshot')} · {error}</p>}
        {!current ? <p className="qp-panel" role="status">{error ?? t('app.loading')}</p> :
          <section className="qp-model-summary" aria-label={t('redesign.modelsHeading')}>
            <article className="qp-panel" data-tone="blue" data-history={summaryBuckets.length > 0} data-wide={number(groups.length).length > 6}><span className="qp-model-summary-icon" aria-hidden="true"><Layers size={24}/></span><span>{t('redesign.modelsCount')}</span><strong>{number(groups.length)}</strong>{summaryBuckets.length > 0 && <ObservedTrend className="qp-model-summary-spark" points={summaryBuckets.map(point => ({ at: point.start, value: point.pairs }))} label={t('redesign.modelsPairsPerBucket')} language={lang} grid={false}/>}</article>
            <article className="qp-panel" data-tone="orange" data-history={summaryBuckets.length > 0}><span className="qp-model-summary-icon" aria-hidden="true"><Database size={24}/></span><span>{t('redesign.modelsTokens')}</span><strong>{f.tokens(data!.totals.tokens)}</strong><small>{t('redesign.modelsCalls')}: {number(data!.totals.calls)}</small>{summaryBuckets.length > 0 && <ObservedTrend className="qp-model-summary-spark" points={summaryBuckets.map(point => ({ at: point.start, value: point.tokens }))} label={t('redesign.modelsTokens')} language={lang} grid={false}/>}</article>
            <article className="qp-panel" data-tone="violet" data-history={summaryBuckets.length > 0} data-wide={number(data!.totals.sessions).length > 6}><span className="qp-model-summary-icon" aria-hidden="true"><Users size={24}/></span><span>{t('redesign.modelsSessions')}</span><strong>{number(data!.totals.sessions)}</strong>{summaryBuckets.length > 0 && <ObservedTrend className="qp-model-summary-spark" points={summaryBuckets.map(point => ({ at: point.start, value: point.sessions }))} label={t('redesign.modelsSessionsPerBucket')} language={lang} grid={false}/>}</article>
            <article className="qp-panel" data-tone="orange" data-history={summaryBuckets.some(point => point.apiValue !== null)} data-wide={money(data!.totals.api_value_usd).length + (data!.totals.computed_calls + data!.totals.estimated_calls < data!.totals.calls ? 1 : 0) > 6}><span className="qp-model-summary-icon" aria-hidden="true"><Coins size={24}/></span><span>{t('redesign.modelsValue')}</span><strong>{apiValue(data!.totals)}</strong><small>{t('redesign.modelsNative')}: {<CostValue amount={data!.totals.reported_native_usd} priced={data!.totals.native_calls} total={data!.totals.calls} money={money} t={t}/>}</small>{summaryBuckets.some(point => point.apiValue !== null) && <ObservedTrend className="qp-model-summary-spark qp-model-value-spark" points={summaryBuckets.map(point => ({ at: point.start, value: point.apiValue === null ? null : currency === 'THB' ? point.apiValue * rate : point.apiValue }))} label={`${t('redesign.modelsKnownValueTrend')} (${currency})`} language={lang} grid={false}/>}</article>
          </section>
        }
        </div>
        {current && <>
          <section className="qp-panel qp-model-comparison"><div className="qp-model-comparison-heading"><h2><SectionMark icon={<BarChart3/>}/>{t('redesign.modelsCompare')}</h2>{data!.totals.unknown_calls > 0 && <p className="qp-footnote">{t('redesign.modelsPartialValue')} · {number(data!.totals.unknown_calls)} {t('redesign.modelsCalls')}</p>}</div>
          <div className="qp-model-toolbar"><label className="qp-model-search"><Search size={15}/><span className="qp-visually-hidden">{t('redesign.modelsSearch')}</span><input value={search} onChange={event => setSearch(event.target.value)} placeholder={t('redesign.modelsSearch')} maxLength={256}/></label>
            <label><span className="qp-model-filter-caption">{t('redesign.projectRange')}</span><select value={route.range} onChange={event => update({ range: event.target.value as Range, model: undefined, selectedProvider: undefined })}><option value="today">{t('redesign.today')}</option><option value="week">{t('redesign.thisWeek')}</option><option value="month">{t('redesign.thisMonth')}</option><option value="all">{t('redesign.allTime')}</option>{route.range === 'custom' && <option value="custom">{t('usage.custom')}</option>}</select></label>
            <label><span className="qp-model-filter-caption">{t('redesign.modelsProvider')}</span><select value={route.provider ?? ''} onChange={event => update({ provider: event.target.value || null, model: undefined, selectedProvider: undefined })}><option value="">{t('redesign.modelsAllProviders')}</option>{providers.map(provider => <option key={provider} value={provider}>{provider}</option>)}</select></label>
            <label><span className="qp-model-filter-caption">{t('redesign.modelsVendor')}</span><select value={route.vendor ?? ''} onChange={event => update({ vendor: event.target.value || null, model: undefined, selectedProvider: undefined })}><option value="">{t('redesign.modelsAllVendors')}</option>{vendors.map(vendor => <option key={vendor} value={vendor}>{vendor}</option>)}</select></label>
            <label><span className="qp-model-filter-caption">{t('redesign.modelsMetric')}</span><select value={route.metric} onChange={event => update({ metric: event.target.value as Metric })}><option value="tokens">{t('redesign.modelsTokens')}</option><option value="calls">{t('redesign.modelsCalls')}</option><option value="api_value_usd">{t('redesign.modelsValue')}</option></select></label>
          </div>
          <ScopeNotice scope={route}/>
          {groups.length === 0 ? <p>{t('redesign.modelsNoData')}</p> : visible.length === 0 ? <p>{t('redesign.modelsNoMatch')}</p> : <div className="qp-model-table-wrap" tabIndex={0} role="region" aria-label={t('redesign.modelsCompare')}><table><thead><tr><th>{t('redesign.modelsModel')}</th><th>{t('redesign.modelsProvider')}</th><th>{t('redesign.modelsVendor')}</th><th>{t('redesign.modelsTokens')}</th><th>{t('redesign.modelsCalls')}</th><th>{t('redesign.modelsSessions')}</th><th>{t('redesign.modelsCache')}</th><th>{t('redesign.modelsCoverage')}</th><th>{t('redesign.modelsValueShort')}</th></tr></thead><tbody>{visible.map(group => <tr key={identityKey(group)} data-selected={selected === group}><td><button aria-pressed={selected === group} onClick={() => update({ model: group.model, selectedProvider: group.provider })}><span className="qp-model-maker-mark" data-vendor={group.vendor} aria-hidden="true">{group.vendor === 'unknown' ? <Layers size={17} aria-hidden="true"/> : <VendorIcon vendor={group.vendor}/>}</span><span className="qp-model-name">{name(group.model)}</span></button></td><td><span className="qp-model-brand"><VendorIcon vendor={group.provider ?? 'unknown'}/>{name(group.provider)}</span></td><td>{name(group.vendor)}</td><td>{f.tokens(group.tokens)}</td><td>{number(group.calls)}</td><td>{number(group.sessions)}</td><td>{ratio(cacheShare(group))}</td><td>{ratio(coverage(group))}</td><td>{apiValue(group)}</td></tr>)}</tbody></table></div>}{summaryBuckets.length > 0 && <details className="qp-model-history"><summary>{t('redesign.chartData')} ({number(summaryBuckets.length)})</summary><div tabIndex={0} role="region" aria-label={t('redesign.chartData')}><table><caption>{t('redesign.modelsCompare')}</caption><thead><tr><th>{t('redesign.chartBucketStart')}</th><th>{t('redesign.modelsTokens')}</th><th>{t('redesign.modelsPairsPerBucket')}</th><th>{t('redesign.modelsSessionsPerBucket')}</th><th>{t('redesign.modelsKnownValueTrend')} ({currency})</th><th>{t('redesign.modelsPricedCalls')}</th>{providerRows.map(value => <th key={JSON.stringify(value.provider)}>{name(value.provider)} ({t('redesign.modelsTokens')})</th>)}</tr></thead><tbody>{summaryBuckets.map((point, index) => <tr key={point.start}><td><time dateTime={new Date(point.start).toISOString()}>{new Date(point.start).toLocaleString(lang === 'th' ? 'th-TH' : 'en-US')}</time></td><td>{number(point.tokens)}</td><td>{number(point.pairs)}</td><td>{number(point.sessions)}</td><td>{point.apiValue === null ? t('redesign.unknownValue') : <CostValue amount={point.api_value_usd} priced={point.api_priced_calls} total={point.calls} money={money} t={t}/>}</td><td>{number(point.api_priced_calls)} / {number(point.calls)}</td>{providerRows.map(value => <td key={JSON.stringify(value.provider)}>{number(value.points[index].value)}</td>)}</tr>)}</tbody></table></div></details>}</section>
          <section className="qp-panel qp-model-providers"><h2><SectionMark icon={<Box/>} size={20}/>{t('redesign.modelsProviderDistribution')}</h2><div className="qp-model-provider-list" tabIndex={0} role="region" aria-label={t('redesign.modelsProviderDistribution')}>{providerRows.map(value => <button key={JSON.stringify(value.provider)} data-provider={value.provider ?? undefined} data-provider-missing={value.provider === null ? true : undefined} disabled={!value.provider} aria-pressed={value.provider !== null && route.provider === value.provider} onClick={() => update({ provider: route.provider === value.provider ? null : value.provider, model: undefined, selectedProvider: undefined })}><span className="qp-model-provider-mark" aria-hidden="true"><VendorIcon vendor={value.provider || 'unknown'}/></span><strong>{name(value.provider)}</strong><span className="qp-model-provider-facts">{f.tokens(value.tokens)} · {number(value.pairs)} {t('redesign.modelsCount')}</span><span className="qp-model-provider-share">{data!.totals.tokens > 0 ? f.pct(value.tokens / data!.totals.tokens * 100) : t('redesign.unknownValue')}</span>{value.points.length > 0 ? <ObservedTrend className="qp-model-provider-spark" points={value.points} language={lang} label={`${name(value.provider)} · ${t('redesign.modelsTokens')}`} grid={false}/> : <span className="qp-bar"><span style={{ width: `${data!.totals.tokens ? value.tokens / data!.totals.tokens * 100 : 0}%` }}/></span>}</button>)}</div></section>
        </>}
      </div>
      {current && <aside className="qp-model-detail">{selected && <><section className="qp-panel"><h2>{t('redesign.modelsDetails')}</h2><div className="qp-model-detail-identity"><svg className="qp-model-detail-mark-defs" width="0" height="0" aria-hidden="true" focusable="false"><defs><linearGradient id={detailMarkGradient} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#2585ff"/><stop offset=".45" stopColor="#2166ff"/><stop offset="1" stopColor="#1747eb"/></linearGradient></defs></svg><span className="qp-model-detail-provider" data-vendor={selected.provider ?? selected.vendor ?? 'unknown'} aria-hidden="true"><VendorIcon vendor={selected.provider ?? selected.vendor ?? 'unknown'} mono={(selected.provider ?? selected.vendor ?? 'unknown') === 'deepseek'} style={(selected.provider ?? selected.vendor ?? 'unknown') === 'deepseek' ? { fill: `url(#${detailMarkGradient})` } : undefined}/></span><div><h3>{name(selected.model)}</h3><p>{t('redesign.modelsProvider')}: {name(selected.provider)} · {t('redesign.modelsVendor')}: {name(selected.vendor)}</p></div></div><div className="qp-model-recorded-facts"><span>{t('redesign.modelsFreshInput')} <strong>{f.tokens(selected.inputTokens)}</strong></span><span>{t('redesign.modelsOutput')} <strong>{f.tokens(selected.outputTokens)}</strong></span><span>{t('redesign.modelsCache')} <strong>{cacheShare(selected) === null ? t('redesign.unknownValue') : f.pct(cacheShare(selected)!)}</strong></span><p>{t('redesign.modelsNative')}: <CostValue amount={selected.reported_native_usd} priced={selected.native_calls} total={selected.calls} money={money} t={t}/></p></div><div className="qp-model-detail-stats"><div><span>{t('redesign.modelsCalls')}</span><strong>{number(selected.calls)}</strong></div><div><span>{t('redesign.modelsSessions')}</span><strong>{number(selected.sessions)}</strong></div><div><span>{t('redesign.modelsCoverage')}</span><strong>{coverage(selected) === null ? '—' : f.pct(coverage(selected))}</strong></div><div><span>{t('redesign.modelsValue')}</span><strong>{apiValue(selected)}</strong></div></div>{historyHref ? <a href={historyHref}>{t('redesign.modelsHistory')}</a> : <small>{t('redesign.modelsNoExactHistory')}</small>}</section>
        <section className="qp-panel qp-model-distribution"><h2>{t('redesign.modelsDistribution')}</h2>{distributionTotal > 0 ? <><div className="qp-model-donut" style={{ background: `conic-gradient(${distribution.map((part, index) => `${part.color} ${distribution.slice(0, index).reduce((sum, prior) => sum + prior.value, 0) / distributionTotal * 100}% ${(distribution.slice(0, index).reduce((sum, prior) => sum + prior.value, 0) + part.value) / distributionTotal * 100}%`).join(',')})` }}><span>{f.tokens(distributionTotal)}</span></div><ul>{distribution.map(part => <li key={part.label}><i style={{ background: part.color }}/><span>{part.label}</span><strong>{f.tokens(part.value)}</strong></li>)}</ul></> : <p>{t('redesign.unknownValue')}</p>}</section>
        <section className="qp-panel"><h2>{t('redesign.modelsTrend')}</h2>{detailError && <p role="status">{detailError}</p>}{!detail && !detailError ? <p>{t('app.loading')}</p> : trend.length === 0 ? <p>{t('redesign.modelsNoTrend')}</p> : <><ObservedTrend className="qp-model-trend" points={trend.map(point => ({ at: point.start, value: route.metric === 'calls' ? point.calls : point.tokens }))} language={lang} label={`${t('redesign.modelsTrend')}: ${t(route.metric === 'calls' ? 'redesign.modelsCalls' : 'redesign.modelsTokens')} 0 – ${number(trendMax)}`}/><ChartData title={t('redesign.modelsTrend')} points={trend.map(point => ({ at: point.start, value: route.metric === 'calls' ? point.calls : point.tokens }))} valueLabel={t(route.metric === 'calls' ? 'redesign.modelsCalls' : 'redesign.modelsTokens')} language={lang} t={t}/></>}</section>
        <section className="qp-panel"><h2>{t('redesign.modelsEffort')}</h2>{detail?.efforts.length ? <ul className="qp-model-efforts">{detail.efforts.map(row => <li key={row.effort ?? 'null'}><span>{row.effort || t('redesign.modelsUnspecified')}</span><strong>{f.tokens(row.tokens)} · {number(row.calls)} {t('redesign.modelsCalls')}</strong><span className="qp-bar qp-model-effort-share" aria-hidden="true"><span style={{ width: `${effortTotal > 0 ? row.tokens / effortTotal * 100 : 0}%` }}/></span></li>)}</ul> : <p>{t('redesign.unknownValue')}</p>}<dl><dt>{t('redesign.modelsContext')}</dt><dd>{t('redesign.unknownValue')}</dd><dt>{t('redesign.modelsObservedContext')}</dt><dd>{detail?.observedContext.window == null ? t('redesign.unknownValue') : `${f.tokens(detail.observedContext.window)} · ${t('redesign.modelsOrigin')} · ${f.clock(detail.observedContext.at)}`}</dd></dl></section></>}</aside>}
    </div>
  </RedesignShell>;
}
