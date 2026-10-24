import { useEffect, useRef, useState } from 'react';
import { BarChart3, Box, CircleHelp, Database, Flame, Folder, Lightbulb, PieChart, RefreshCw, TrendingUp, Wallet } from 'lucide-react';
import { api, type CostAnalysisResponse } from '@/api';
import { useI18n, useT } from '@/i18n';
import { useFormat } from '@/i18n/format';
import { useLiveRefresh, useRefreshStatus } from '@/lib/use-live';
import { useTheme } from '@/lib/use-theme';
import { ProviderMark as VendorIcon } from './provider-mark';
import { ObservedTrend } from './observed-trend';
import { RedesignShell } from './shell';
import { readScope, selectedScope, writeScope, type ScopeRange } from './scope';
import { ScopeNotice } from './scope-notice';
import { CostValue, costValue } from './cost-value';
import './cost.css';
import { CostChartData } from './cost-chart-data';
import { costTimeAxis } from './cost-time-axis';
import { CostTrendPlot } from './cost-trend-plot';
import { PageHeading } from './page-heading';
import { HeadingReferenceIcon } from './heading-reference-icon';
import { SectionMark } from './section-mark';
import { InitialRegion, type InitialRegionState } from './initial-region';
import { AggregatePresenceLedger } from './aggregate-presence-motion';
import { modelPairKey } from './model-row-trends';
import { projectMotionKey } from './project-selection-motion';
import { useAggregatePresenceMotion } from './use-aggregate-presence-motion';
import type { LiveRecordBatch } from './live-record-motion';

type Range = ScopeRange;
type Basis = 'api' | 'native';
type Bucket = 'auto' | 'hour' | 'day' | 'week';
function readRoute() {
  const p = new URLSearchParams(location.hash.split('?')[1] ?? '');
  const bucket = p.get('bucket');
  // Preserve legacy bookmarks; redesigned navigation selects month explicitly.
  return { ...readScope(p, 'all', true), bucket: bucket === 'hour' || bucket === 'day' || bucket === 'week' || bucket === 'auto' ? bucket as Bucket : undefined,
    basis: p.get('basis') === 'native' ? 'native' as Basis : 'api' as Basis };
}
const providerColors: Record<string, string> = {
  openai: '#177af6', anthropic: '#7a3cf6', google: '#01bcf5', deepseek: '#f78c3f',
};
const providerColor = (provider: string | null) => {
  const identity = provider?.toLowerCase() ?? '';
  return Object.hasOwn(providerColors, identity) ? providerColors[identity] : '#7d8ba0';
};

// Donut body and lit rims are sampled independently from the source artwork.
// Legend dots retain their existing provider palette; shares remain API-derived.
const providerDonutColors: Record<string, { body: string; rim: string }> = {
  openai: { body: '#0d88fd', rim: '#2ad1fb' },
  anthropic: { body: '#6329fb', rim: '#a35ffa' },
  google: { body: '#0096c7', rim: '#00bfed' },
  deepseek: { body: '#f37836', rim: '#f89840' },
};
const providerDonutColor = (provider: string | null, part: 'body' | 'rim') => {
  const identity = provider?.toLowerCase() ?? '';
  return Object.hasOwn(providerDonutColors, identity)
    ? providerDonutColors[identity][part]
    : part === 'body' ? '#505c6f' : '#75879d';
};

/** Decorative edges follow the same recorded shares as the filled donut. */
function CostDonutEdges({ rows, total }: { rows: Array<{ provider: string | null; amount: number }>; total: number }) {
  if (!(total > 0)) return null;
  let cumulative = 0;
  const segments = rows.flatMap(({ provider, amount }) => {
    const start = cumulative / total;
    cumulative += amount;
    return amount > 0 ? [{ start, share: amount / total, color: providerDonutColor(provider, 'rim') }] : [];
  });
  if (!segments.length) return null;
  return <svg className="qp-cost-donut-edges" viewBox="0 0 184 184" aria-hidden="true" focusable="false">
    {segments.map((segment, index) => <g key={index} style={{ color: segment.color }}>
      <circle className="qp-cost-donut-edge" cx="92" cy="92" r="91.4" pathLength="1" transform="rotate(-90 92 92)" strokeDasharray={`${segment.share} 1`} strokeDashoffset={-segment.start}/>
      <circle className="qp-cost-donut-edge qp-cost-donut-inner-edge" cx="92" cy="92" r="65.6" pathLength="1" transform="rotate(-90 92 92)" strokeDasharray={`${segment.share} 1`} strokeDashoffset={-segment.start}/>
    </g>)}
    {segments.length > 1 && segments.map((segment, index) => <g key={`seam-${index}`} className="qp-cost-donut-seam" style={{ color: segment.color }} transform={`rotate(${segment.start * 360} 92 92)`}>
      <line className="qp-cost-donut-separator" x1="92" y1="92" x2="92" y2="0.6"/>
      <line className="qp-cost-donut-seam-light" x1="92" y1="92" x2="92" y2="0.6"/>
    </g>)}
  </svg>;
}

export function ProductionCost() {
  const t = useT();
  const f = useFormat();
  const { lang, setLang, currency, rate } = useI18n();
  const [theme, toggleTheme] = useTheme();
  const [route, setRoute] = useState(readRoute);
  const [snapshot, setSnapshot] = useState<{ key: string; data: CostAnalysisResponse; motion: LiveRecordBatch } | null>(null);
  const [error, setError] = useState<{ key: string; epoch: number; message: string } | null>(null);
  const [retryAttempt, setRetryAttempt] = useState(0);
  const refresh = useRefreshStatus();
  const presenceRegion = useRef<HTMLDivElement>(null);
  const [presenceLedger] = useState(() => new AggregatePresenceLedger());
  const acceptedSerial = useRef(0);
  const mounted = useRef(true);
  const bucket: Bucket = route.bucket ?? (route.range === 'month' ? 'day' : 'auto');
  const key = JSON.stringify([route.range, route.from, route.to, route.sourceId, route.basis, bucket]);
  const currentKey = useRef(key);
  const scopeEpoch = useRef(0);
  if (currentKey.current !== key) scopeEpoch.current++;
  currentKey.current = key;
  useEffect(() => {
    mounted.current = true;
    const sync = () => { if (location.hash.slice(1).split('?')[0] === 'cost') setRoute(readRoute()); };
    addEventListener('hashchange', sync);
    return () => { mounted.current = false; scopeEpoch.current++; removeEventListener('hashchange', sync); };
  }, []);
  const update = (patch: Partial<typeof route>) => {
    const next = { ...route, ...patch };
    const p = writeScope(new URLSearchParams({ basis: next.basis }), next);
    history.replaceState(null, '', `${location.pathname}${location.search}#cost?${p}`);
    setRoute(next);
  };
  useLiveRefresh(async context => {
    const requestEligibility = presenceLedger.snapshot();
    const requestKey = key;
    const requestedEpoch = scopeEpoch.current;
    const isCurrent = () => mounted.current && currentKey.current === requestKey && scopeEpoch.current === requestedEpoch;
    try {
      const data = await api.costAnalysis(selectedScope(route, Date.now()), route.basis, bucket);
      if (isCurrent()) { setSnapshot({ key: requestKey, data, motion: { serial: ++acceptedSerial.current, reason: context.reason, requestEligibility } }); setError(null); }
    } catch (cause) { if (!isCurrent()) return; setError({ key: requestKey, epoch: requestedEpoch, message: String(cause) }); throw cause; }
  }, [key, retryAttempt]);
  const data = snapshot?.key === key ? snapshot.data : null;
  const total = data?.totals;
  const currentError = error?.key === key && error.epoch === scopeEpoch.current ? error.message : null;
  const initialState: InitialRegionState = {
    kind: currentError ? 'error' : 'loading',
    label: t(currentError ? 'app.couldNotLoad' : 'app.loading'),
    detail: currentError ?? undefined,
    retryLabel: t('app.retry'),
    retrying: false,
    onRetry: () => {
      document.getElementById('cost')?.focus();
      setError(previous => previous?.key === key && previous.epoch === scopeEpoch.current ? null : previous);
      setRetryAttempt(attempt => attempt + 1);
    },
  };
  const pending = (id: string, label: string, className: string, status = false) =>
    <InitialRegion key={id} id={`cost-${id}`} label={label} state={initialState} className={className} status={status}/>;
  const number = (value: number) => new Intl.NumberFormat(lang === 'th' ? 'th-TH' : 'en-US', { maximumFractionDigits: 0 }).format(value);
  const money = (usd: number) => new Intl.NumberFormat(lang === 'th' ? 'th-TH' : 'en-US', { style: 'currency', currency }).format(currency === 'THB' ? usd * rate : usd);
  const unitMoney = (usd: number) => new Intl.NumberFormat(lang === 'th' ? 'th-TH' : 'en-US', { style: 'currency', currency, maximumFractionDigits: 6 }).format(currency === 'THB' ? usd * rate : usd);
  const percent = (value: number) => new Intl.NumberFormat(lang === 'th' ? 'th-TH' : 'en-US', { style: 'percent', maximumFractionDigits: 1 }).format(value);
  const historyHref = (extra: Record<string, string> = {}) => data ? `#history?${new URLSearchParams({ range: 'custom', from: String(data.scope.from), to: String(data.scope.to), ...(data.scope.sourceId ? { source: String(data.scope.sourceId) } : {}), ...extra })}` : '#history';
  const elapsedDays = data ? (data.scope.to - data.scope.from) / 86_400_000 : 0;
  const fullDays = Math.floor(elapsedDays);
  const trend = data ? Array.from({ length: Math.ceil((data.scope.to - data.scope.from) / data.bucketMs) }, (_, index) => {
    const start = data.scope.from + index * data.bucketMs;
    return data.points.find(point => point.start === start) ?? { start, amount: 0, pricedTokens: 0, allTokens: 0, pricedCalls: 0, allCalls: 0 };
  }) : [];
  const pointDescription = (point: (typeof trend)[number]) => `${new Date(point.start).toLocaleString(lang === 'th' ? 'th-TH' : 'en-US')} · ${costValue(point.amount, point.pricedCalls, point.allCalls, money, t('redesign.unknownValue'))} · ${f.tokens(point.pricedTokens)} ${t('redesign.costPricedTokens')}`;
  const maxCost = Math.max(0, ...trend.map(point => point.amount));
  const maxTokens = Math.max(0, ...trend.map(point => point.pricedTokens));
  const ticks = [1, 0.75, 0.5, 0.25, 0];
  const date = (at: number) => new Date(at).toLocaleString(lang === 'th' ? 'th-TH' : 'en-US', { dateStyle: 'short', timeStyle: 'short' });
  const timeTicks = data ? costTimeAxis({ ...data.scope, bucketMs: data.bucketMs, starts: trend.map(point => point.start) }, lang) : [];
  const centerBasis = t(data?.basis === 'native' ? 'redesign.costNativeBasis' : 'redesign.costApiBasis');
  const centerAmount = total ? costValue(total.amount, total.pricedCalls, total.allCalls, money, t('redesign.unknownValue')) : '';
  const centerAmountSize = centerAmount.length > 15 ? 'long' : centerAmount.length > 7 ? 'medium' : 'normal';
  let centerRange = '';
  let centerRangeTitle = '';
  if (data) {
    const start = new Date(data.scope.from);
    const end = new Date(data.scope.to - 1); // Usage scope excludes its end timestamp.
    const includeYear = start.getFullYear() !== end.getFullYear()
      || start.getFullYear() !== new Date(data.now).getFullYear();
    const rangeFormatter = new Intl.DateTimeFormat(lang === 'th' ? 'th-TH' : 'en-US', {
      month: 'short', day: 'numeric', ...(includeYear ? { year: 'numeric' as const } : {}),
    });
    centerRange = route.range === 'all' && data.scope.from === 0
      ? t('redesign.allTime') : rangeFormatter.formatRange(start, end);
    centerRangeTitle = `${t('usage.from')}: ${start.toISOString()} · ${t('usage.to')}: ${new Date(data.scope.to).toISOString()} (${t('redesign.costEndExcluded')})`;
  }
  const topModels = data?.models.filter(row => row.pricedCalls > 0).slice(0, 8) ?? [];
  const topProjects = data?.projects.filter(row => row.pricedCalls > 0).slice(0, 8) ?? [];
  const modelPresenceKey = (row: NonNullable<typeof data>['models'][number]) => JSON.stringify(['model', modelPairKey(row)]);
  const projectPresenceKey = (row: NonNullable<typeof data>['projects'][number]) => JSON.stringify(['project', projectMotionKey(row.project)]);
  const cancelPresence = useAggregatePresenceMotion(presenceRegion, presenceLedger, {
    batch: data ? snapshot?.motion : undefined,
    context: JSON.stringify([key, lang, currency, rate, theme]),
    universe: [...(data?.models.map(modelPresenceKey) ?? []), ...(data?.projects.map(projectPresenceKey) ?? [])],
    page: [...topModels.map(modelPresenceKey), ...topProjects.map(projectPresenceKey)],
    enabled: !!data && !currentError, hasSnapshot: !!snapshot, mounted: !!data,
    selectionSerial: 0, selectionKey: null, attribute: 'data-cost-presence-key', selector: '[data-cost-presence-key]',
  });
  const providerRows = data?.providers.filter(row => row.pricedCalls > 0) ?? [];
  const share = (amount: number) => total && total.amount > 0 ? percent(amount / total.amount) : '—';
  const name = (value: string | null) => value === null ? t('redesign.modelsUnspecified') : value === '' ? t('redesign.emptyProject') : value;
  const projectName = (value: string | null) => value === null ? t('redesign.costUnknownProject') : value === '' ? t('redesign.emptyProject') : value;
  const topModel = topModels[0];

  return <RedesignShell quickStatsScope={data?.scope ?? null} active="cost" theme={theme} language={lang} onTheme={toggleTheme} onLanguage={() => setLang(lang === 'en' ? 'th' : 'en')} t={t} testId="production-cost">
    <div className="qp-cost-layout" ref={presenceRegion}><div className="qp-cost-top-row"><section className="qp-panel qp-cost-overview"><div className="qp-cost-top"><header className="qp-cost-header"><div className="qp-cost-heading"><PageHeading compact icon={<HeadingReferenceIcon kind="cost"/>} title={t('redesign.costHeading')} subtitle={t('redesign.costSubtitle')}/><ScopeNotice scope={route}/></div><button onClick={() => void refresh.refreshNow()} disabled={refresh.refreshing}><RefreshCw size={16}/><span>{t('app.refreshNow')}</span></button></header>
    <div className="qp-cost-toolbar"><label><span>{t('redesign.projectRange')}</span><select value={route.range} onChange={event => update({ range: event.target.value as Range })}><option value="month">{t('redesign.costMonthToDate')}</option><option value="today">{t('redesign.today')}</option><option value="week">{t('redesign.thisWeek')}</option><option value="last30">{t('redesign.last30')}</option><option value="all">{t('redesign.allTime')}</option>{route.range === 'custom' && <option value="custom">{t('usage.custom')}</option>}</select></label><label><span>{t('redesign.costBasis')}</span><select value={route.basis} onChange={event => update({ basis: event.target.value as Basis })}><option value="api">{t('redesign.costApiBasis')}</option><option value="native">{t('redesign.costNativeBasis')}</option></select></label><label><span>{t('redesign.costBucket')}</span><select value={bucket} onChange={event => update({ bucket: event.target.value as Bucket })}><option value="auto">{t('redesign.costBucketAuto')}</option><option value="hour">{t('redesign.costBucketHour')}</option><option value="day">{t('redesign.costBucketDay')}</option><option value="week">{t('redesign.costBucketWeek')}</option></select></label></div>
    </div>
    {currentError && data && <p className="qp-cost-error" role="status">{t('redesign.staleSnapshot')} · {currentError} <button onClick={initialState.onRetry}>{t('app.retry')}</button></p>}
    {!data ? <section className="qp-cost-summary qp-cost-initial-summary-grid" aria-label={t('redesign.costHeading')}>{(['redesign.costTotal', 'redesign.costDaily', 'redesign.costProjection', 'redesign.costPerThousand'] as const).map((label, index) => pending(index === 0 ? 'summary' : `summary-${index}`, t(label), 'qp-cost-initial-summary'))}</section> : <section className="qp-cost-summary" aria-label={t('redesign.costHeading')}><article className="qp-panel"><i className="qp-cost-metric-icon" aria-hidden="true"><Wallet size={21}/></i><span>{t('redesign.costTotal')}</span><strong><CostValue amount={total!.amount} priced={total!.pricedCalls} total={total!.allCalls} money={money} t={t}/></strong><small>{route.basis === 'api' ? t('redesign.costApiBasis') : t('redesign.costNativeBasis')}</small>{total!.pricedCalls > 0 && <ObservedTrend className="qp-cost-summary-trend" points={trend.map(point => ({ at: point.start, value: currency === 'THB' ? point.amount * rate : point.amount }))} language={lang} label={`${t('redesign.costTotal')} (${currency})`}/>}</article><article className="qp-panel"><i className="qp-cost-metric-icon" aria-hidden="true"><BarChart3 size={21}/></i><span>{t('redesign.costDaily')}</span><strong>{fullDays > 0 && total!.pricedCalls > 0 ? <CostValue amount={total!.amount / elapsedDays} priced={total!.pricedCalls} total={total!.allCalls} money={money} t={t}/> : t('redesign.unknownValue')}</strong><small>{fullDays} {t('redesign.costDays')}</small></article><article className="qp-panel"><i className="qp-cost-metric-icon" aria-hidden="true"><TrendingUp size={21}/></i><span>{t('redesign.costProjection')}</span><strong>{t('redesign.unknownValue')}</strong><small>{t(route.basis === 'api' ? 'redesign.costProjectionUnavailable' : 'redesign.costNativeProjection')}</small></article><article className="qp-panel"><i className="qp-cost-metric-icon" aria-hidden="true"><Database size={21}/></i><span>{t('redesign.costPerThousand')}</span><strong>{total!.pricedTokens > 0 ? unitMoney(total!.amount / total!.pricedTokens * 1000) : t('redesign.unknownValue')}</strong><small>{t('redesign.costAllTokens')}: {f.tokens(total!.allTokens)}</small></article></section>}</section>{!data ? pending('providers', t('redesign.costProviders'), 'qp-cost-providers', true) : <section className="qp-panel qp-cost-providers"><h2><SectionMark icon={<PieChart/>}/>{t('redesign.costProviders')}</h2>{providerRows.length === 0 ? <p>{t('redesign.costNoPriced')}</p> : <><div className="qp-cost-donut" data-zero={total!.amount === 0} style={{ background: `conic-gradient(${providerRows.map((row, index) => `${providerDonutColor(row.provider, 'body')} ${providerRows.slice(0, index).reduce((sum, prior) => sum + prior.amount, 0) / (total!.amount || 1) * 100}% ${providerRows.slice(0, index + 1).reduce((sum, prior) => sum + prior.amount, 0) / (total!.amount || 1) * 100}%`).join(',')})` }}><CostDonutEdges rows={providerRows} total={total!.amount}/><span className="qp-cost-donut-hole"><span className="qp-cost-donut-content"><strong className="qp-cost-donut-amount" data-size={centerAmountSize}><CostValue amount={total!.amount} priced={total!.pricedCalls} total={total!.allCalls} money={money} t={t}/></strong><small className="qp-cost-donut-basis">{centerBasis}</small><span className="qp-cost-donut-range" title={centerRangeTitle} aria-label={centerRangeTitle} data-from={data.scope.from} data-to={data.scope.to}>{centerRange}</span></span></span></div><ol>{providerRows.map(row => <li key={row.provider ?? 'null'}><i style={{ background: providerColor(row.provider) }}/><span className="qp-cost-provider-name">{name(row.provider)}</span><span className="qp-cost-provider-value"><strong className="qp-cost-provider-amount"><CostValue amount={row.amount} priced={row.pricedCalls} total={row.allCalls} money={money} t={t}/></strong><span className="qp-visually-hidden"> · </span><span className="qp-cost-provider-share">{share(row.amount)}</span></span></li>)}</ol></>}</section>}</div>
      {!data ? <><div className="qp-cost-upper">{pending('trend', t('redesign.costTrend'), 'qp-cost-trend')}{pending('models', t('redesign.costModels'), 'qp-cost-models')}</div><div className="qp-cost-lower">{pending('projects', t('redesign.costProjects'), 'qp-cost-projects')}{pending('sessions', t('redesign.costSessions'), 'qp-cost-sessions')}{pending('insights', t('redesign.costInsights'), 'qp-cost-insights')}</div></> : (total!.allCalls === 0 ? <p className="qp-panel">{t('redesign.costNoData')}</p> : <>
        <div className="qp-cost-upper"><section className="qp-panel qp-cost-trend"><div className="qp-cost-section-head"><div className="qp-cost-section-title"><h2><SectionMark icon={<TrendingUp/>}/>{t('redesign.costTrend')}</h2><div className="qp-cost-chart-labels">{total!.pricedCalls > 0 && <><span title={`${t('redesign.costTotal')}: ${money(0)} – ${money(maxCost)}`}>{t('redesign.costTotal')}</span><span title={`${t('redesign.costPricedTokens')}: 0 – ${f.tokens(maxTokens)}`}>{t('redesign.costPricedTokens')}</span></>}</div></div><a href={historyHref()}>{t('redesign.costOpenHistory')}</a></div>
          <div className="qp-cost-chart-footer"><p className="qp-footnote qp-cost-coverage">{t('redesign.costCoverage')}: {number(total!.pricedCalls)} / {number(total!.allCalls)} · {t('redesign.costOtherBasis')}: {number(total!.allCalls - total!.pricedCalls)}{route.basis === 'api' ? ` · ${t('redesign.costEstimated')}: ${number(total!.estimatedCalls)}` : ''}</p><CostChartData points={trend} basis={route.basis} language={lang} money={money} t={t}/></div>
          {total!.pricedCalls === 0 ? <p>{t('redesign.costNoPriced')}</p> : <div className="qp-cost-plot"><div className="qp-cost-axis" data-axis="amount" data-size-label={ticks.map(tick => money(maxCost * tick)).join('\n')} aria-hidden="true">{ticks.map(tick => <span key={tick} data-value={maxCost * tick} style={{ top: `${(1 - tick) * 100}%` }}>{money(maxCost * tick)}</span>)}</div><CostTrendPlot help={t('history.timelineHelp')} points={trend} scopeKey={JSON.stringify([key, data.scope.from, data.scope.to, data.bucketMs, lang, currency, rate])} language={lang} money={money} t={t} basisLabel={centerBasis} label={`${t('redesign.costTrend')}: ${t('redesign.costTotal')} 0 – ${money(maxCost)}, ${t('redesign.costPricedTokens')} 0 – ${f.tokens(maxTokens)}. ${trend.map(pointDescription).join('; ')}`}/><div className="qp-cost-axis" data-axis="tokens" data-size-label={ticks.map(tick => f.tokens(maxTokens * tick)).join('\n')} aria-hidden="true">{ticks.map(tick => <span key={tick} data-value={maxTokens * tick} style={{ top: `${(1 - tick) * 100}%` }}>{f.tokens(maxTokens * tick)}</span>)}</div><div className="qp-cost-plot-dates">{timeTicks.map(tick => <time key={tick.at} dateTime={new Date(tick.at).toISOString()} title={date(tick.at)} style={{ left: `${tick.position}%` }}>{tick.label}</time>)}</div></div>}</section><section className="qp-panel qp-cost-models"><h2><SectionMark icon={<Box/>}/>{t('redesign.costModels')}</h2>{topModels.length === 0 ? <p>{t('redesign.costNoPriced')}</p> : <div className="qp-cost-table" tabIndex={0}><table><thead><tr><th className="qp-cost-rank" aria-label={t('redesign.rowNumber')}>#</th><th>{t('redesign.modelsModel')}</th><th>{t('redesign.modelsProvider')}</th><th title={t('redesign.costAllTokens')}>{t('redesign.tokens')}</th><th>{t('redesign.costTotal')}</th><th>{t('redesign.costShare')}</th></tr></thead><tbody>{topModels.map((row, index) => <tr key={JSON.stringify([row.model,row.provider])} data-cost-presence-key={modelPresenceKey(row)} data-vendor={row.vendor.toLowerCase()}><td className="qp-cost-rank">{index + 1}</td><td className="qp-cost-name">{row.model && row.provider ? <a href={historyHref({ model: row.model, provider: row.provider })} onClick={() => cancelPresence(modelPresenceKey(row))}>{name(row.model)}</a> : name(row.model)}</td><td><span className="qp-cost-route"><VendorIcon vendor={row.provider ?? 'unknown'}/>{name(row.provider)}</span></td><td data-testid="cost-row-tokens" data-value={row.allTokens}>{f.tokens(row.allTokens)}</td><td><CostValue amount={row.amount} priced={row.pricedCalls} total={row.allCalls} money={money} t={t}/></td><td><span className="qp-cost-share"><i aria-hidden="true"><b style={{ width: `${total!.amount > 0 ? row.amount / total!.amount * 100 : 0}%` }}/></i><span>{share(row.amount)}</span></span></td></tr>)}</tbody></table></div>}</section></div>
        <div className="qp-cost-lower"><section className="qp-panel qp-cost-projects"><h2><SectionMark icon={<Folder/>}/>{t('redesign.costProjects')}</h2>{topProjects.length === 0 ? <p>{t('redesign.costNoPriced')}</p> : <div className="qp-cost-table" tabIndex={0}><table><thead><tr><th>{t('redesign.costProject')}</th><th>{t('redesign.costTotal')}</th><th title={t('redesign.costAllTokens')}>{t('redesign.tokens')}</th><th>{t('redesign.costShare')}</th></tr></thead><tbody>{topProjects.map(row => <tr key={row.project === null ? 'null' : `str:${row.project}`} data-cost-presence-key={projectPresenceKey(row)}><td className="qp-cost-name"><a className="qp-cost-project-link" href={historyHref(row.project === null ? { project_missing: '1' } : { project: row.project })} onClick={() => cancelPresence(projectPresenceKey(row))}><Folder size={16} aria-hidden="true"/>{projectName(row.project)}</a></td><td><CostValue amount={row.amount} priced={row.pricedCalls} total={row.allCalls} money={money} t={t}/></td><td data-testid="cost-row-tokens" data-value={row.allTokens}>{f.tokens(row.allTokens)}</td><td><span className="qp-cost-share"><i aria-hidden="true"><b style={{ width: `${total!.amount > 0 ? row.amount / total!.amount * 100 : 0}%` }}/></i><span>{share(row.amount)}</span></span></td></tr>)}</tbody></table></div>}</section><section className="qp-panel qp-cost-sessions"><h2><SectionMark icon={<Flame/>} tone="warm"/>{t('redesign.costSessions')}</h2>{data.sessions.length === 0 ? <p>{t('redesign.costNoPriced')}</p> : <div className="qp-cost-table" tabIndex={0}><table><thead><tr><th className="qp-cost-rank" aria-label={t('redesign.rowNumber')}>#</th><th>{t('redesign.costSession')}</th><th>{t('redesign.costProject')}</th><th>{t('redesign.costTotal')}</th><th title={t('redesign.costAllTokens')}>{t('redesign.tokens')}</th></tr></thead><tbody>{data.sessions.map((row, index) => <tr key={row.sessionKey}><td className="qp-cost-rank">{index + 1}</td><td className="qp-cost-name"><a href={historyHref({ session_id: String(row.sessionKey) })}>{row.nativeSessionId}</a></td><td>{projectName(row.project)}</td><td><CostValue amount={row.amount} priced={row.pricedCalls} total={row.allCalls} money={money} t={t}/></td><td data-testid="cost-row-tokens" data-value={row.allTokens}>{f.tokens(row.allTokens)}</td></tr>)}</tbody></table></div>}</section><aside className="qp-panel qp-cost-insights"><h2><SectionMark icon={<Lightbulb/>}/>{t('redesign.costInsights')}</h2><div><i className="qp-cost-insight-icon" aria-hidden="true"><Database size={24}/></i><span>{t('redesign.costKnownSavings')}</span><strong>{route.basis === 'api' && total!.knownCacheSavingCalls > 0 ? money(total!.knownCacheSavingUsd) : t('redesign.unknownValue')}</strong><small>{t(route.basis === 'native' ? 'redesign.costNativeNoSavings' : 'redesign.costSavingsNote')}{route.basis === 'api' ? ` · ${number(total!.knownCacheSavingCalls)} / ${number(total!.allCalls)}` : ''}</small></div><div><i className="qp-cost-insight-icon" aria-hidden="true"><PieChart size={24}/></i><span>{t('redesign.costConcentration')}</span><strong>{topModel && total!.amount > 0 ? percent(topModel.amount / total!.amount) : t('redesign.unknownValue')}</strong><small>{topModel ? `${name(topModel.model)} · ${name(topModel.provider)}` : t('redesign.costNoPriced')}</small></div><div><i className="qp-cost-insight-icon" aria-hidden="true"><CircleHelp size={24}/></i><span>{t('redesign.costUnpriced')}</span><strong>{number(total!.unknownCalls)} / {number(total!.allCalls)}</strong><small><a href={historyHref()}>{t('redesign.costOpenHistory')}</a></small></div></aside></div>
      </>)}
    </div>
  </RedesignShell>;
}
