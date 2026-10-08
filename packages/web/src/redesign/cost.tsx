import { useEffect, useRef, useState } from 'react';
import { BarChart3, Box, Database, Flame, Folder, Lightbulb, PieChart, RefreshCw, TrendingUp, Wallet } from 'lucide-react';
import { api, type CostAnalysisResponse } from '@/api';
import { useI18n, useT } from '@/i18n';
import { useFormat } from '@/i18n/format';
import { useLiveRefresh, useRefreshStatus } from '@/lib/use-live';
import { useTheme } from '@/lib/use-theme';
import { VendorIcon } from '@/components/vendor-icon';
import { ObservedTrend } from './observed-trend';
import { RedesignShell } from './shell';
import { readScope, selectedScope, writeScope, type ScopeRange } from './scope';
import { ScopeNotice } from './scope-notice';
import { CostValue, costValue } from './cost-value';
import './cost.css';
import { CostChartData } from './cost-chart-data';
import { PageHeading } from './page-heading';
import { SectionMark } from './section-mark';

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
const colors = ['#2bb8ef', '#775cf6', '#18cfa9', '#f58e43', '#8796ae', '#d364e9'];

/** Decorative edges follow the same recorded shares as the filled donut. */
function CostDonutEdges({ amounts, total }: { amounts: number[]; total: number }) {
  if (!(total > 0)) return null;
  let cumulative = 0;
  const segments = amounts.flatMap((amount, index) => {
    const start = cumulative / total;
    cumulative += amount;
    return amount > 0 ? [{ start, share: amount / total, color: colors[index % colors.length] }] : [];
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
  const [snapshot, setSnapshot] = useState<{ key: string; data: CostAnalysisResponse } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const refresh = useRefreshStatus();
  const bucket: Bucket = route.bucket ?? (route.range === 'month' ? 'day' : 'auto');
  const key = JSON.stringify([route.range, route.from, route.to, route.sourceId, route.basis, bucket]);
  const currentKey = useRef(key); currentKey.current = key;
  useEffect(() => {
    const sync = () => { if (location.hash.slice(1).split('?')[0] === 'cost') setRoute(readRoute()); };
    addEventListener('hashchange', sync);
    return () => removeEventListener('hashchange', sync);
  }, []);
  const update = (patch: Partial<typeof route>) => {
    const next = { ...route, ...patch };
    const p = writeScope(new URLSearchParams({ basis: next.basis }), next);
    history.replaceState(null, '', `${location.pathname}${location.search}#cost?${p}`);
    setRoute(next);
  };
  useLiveRefresh(async () => {
    const requestKey = key;
    try {
      const data = await api.costAnalysis(selectedScope(route, Date.now()), route.basis, bucket);
      if (currentKey.current === requestKey) { setSnapshot({ key: requestKey, data }); setError(null); }
    } catch (cause) { if (currentKey.current === requestKey) setError(String(cause)); throw cause; }
  }, [key]);
  const data = snapshot?.key === key ? snapshot.data : null;
  const total = data?.totals;
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
  const topModels = data?.models.filter(row => row.pricedCalls > 0).slice(0, 8) ?? [];
  const topProjects = data?.projects.filter(row => row.pricedCalls > 0).slice(0, 8) ?? [];
  const providerRows = data?.providers.filter(row => row.pricedCalls > 0) ?? [];
  const share = (amount: number) => total && total.amount > 0 ? percent(amount / total.amount) : '—';
  const name = (value: string | null) => value === null ? t('redesign.modelsUnspecified') : value === '' ? t('redesign.emptyProject') : value;
  const projectName = (value: string | null) => value === null ? t('redesign.costUnknownProject') : value === '' ? t('redesign.emptyProject') : value;
  const topModel = topModels[0];

  return <RedesignShell active="cost" theme={theme} language={lang} onTheme={toggleTheme} onLanguage={() => setLang(lang === 'en' ? 'th' : 'en')} t={t} testId="production-cost">
    <div className="qp-cost-layout"><div className="qp-cost-top-row"><section className="qp-panel qp-cost-overview"><div className="qp-cost-top"><header className="qp-cost-header"><div className="qp-cost-heading"><PageHeading compact icon={<BarChart3 size={24}/>} title={t('redesign.costHeading')} subtitle={t('redesign.costSubtitle')}/><ScopeNotice scope={route}/></div><button onClick={() => void refresh.refreshNow()} disabled={refresh.refreshing}><RefreshCw size={16}/><span>{t('app.refreshNow')}</span></button></header>
    <div className="qp-cost-toolbar"><label><span>{t('redesign.projectRange')}</span><select value={route.range} onChange={event => update({ range: event.target.value as Range })}><option value="month">{t('redesign.costMonthToDate')}</option><option value="today">{t('redesign.today')}</option><option value="week">{t('redesign.thisWeek')}</option><option value="last30">{t('redesign.last30')}</option><option value="all">{t('redesign.allTime')}</option>{route.range === 'custom' && <option value="custom">{t('usage.custom')}</option>}</select></label><label><span>{t('redesign.costBasis')}</span><select value={route.basis} onChange={event => update({ basis: event.target.value as Basis })}><option value="api">{t('redesign.costApiBasis')}</option><option value="native">{t('redesign.costNativeBasis')}</option></select></label><label><span>{t('redesign.costBucket')}</span><select value={bucket} onChange={event => update({ bucket: event.target.value as Bucket })}><option value="auto">{t('redesign.costBucketAuto')}</option><option value="hour">{t('redesign.costBucketHour')}</option><option value="day">{t('redesign.costBucketDay')}</option><option value="week">{t('redesign.costBucketWeek')}</option></select></label></div>
    </div>
    {error && <p className="qp-cost-error" role="status">{t('redesign.staleSnapshot')} · {error}</p>}
    {!data ? <p className="qp-panel" role="status">{error ?? t('app.loading')}</p> : <section className="qp-cost-summary" aria-label={t('redesign.costHeading')}><article className="qp-panel"><i className="qp-cost-metric-icon" aria-hidden="true"><Wallet size={21}/></i><span>{t('redesign.costTotal')}</span><strong><CostValue amount={total!.amount} priced={total!.pricedCalls} total={total!.allCalls} money={money} t={t}/></strong><small>{route.basis === 'api' ? t('redesign.costApiBasis') : t('redesign.costNativeBasis')}</small>{total!.pricedCalls > 0 && <ObservedTrend className="qp-cost-summary-trend" points={trend.map(point => ({ at: point.start, value: currency === 'THB' ? point.amount * rate : point.amount }))} language={lang} label={`${t('redesign.costTotal')} (${currency})`}/>}</article><article className="qp-panel"><i className="qp-cost-metric-icon" aria-hidden="true"><BarChart3 size={21}/></i><span>{t('redesign.costDaily')}</span><strong>{fullDays > 0 && total!.pricedCalls > 0 ? <CostValue amount={total!.amount / elapsedDays} priced={total!.pricedCalls} total={total!.allCalls} money={money} t={t}/> : t('redesign.unknownValue')}</strong><small>{fullDays} {t('redesign.costDays')}</small></article><article className="qp-panel"><i className="qp-cost-metric-icon" aria-hidden="true"><TrendingUp size={21}/></i><span>{t('redesign.costProjection')}</span><strong>{t('redesign.unknownValue')}</strong><small>{t(route.basis === 'api' ? 'redesign.costProjectionUnavailable' : 'redesign.costNativeProjection')}</small></article><article className="qp-panel"><i className="qp-cost-metric-icon" aria-hidden="true"><Database size={21}/></i><span>{t('redesign.costPerThousand')}</span><strong>{total!.pricedTokens > 0 ? unitMoney(total!.amount / total!.pricedTokens * 1000) : t('redesign.unknownValue')}</strong><small>{t('redesign.costAllTokens')}: {f.tokens(total!.allTokens)}</small></article></section>}</section>{data && <section className="qp-panel qp-cost-providers"><h2><SectionMark icon={<PieChart/>}/>{t('redesign.costProviders')}</h2>{providerRows.length === 0 ? <p>{t('redesign.costNoPriced')}</p> : <><div className="qp-cost-donut" data-zero={total!.amount === 0} style={{ background: `conic-gradient(${providerRows.map((row, index) => `${colors[index % colors.length]} ${providerRows.slice(0, index).reduce((sum, prior) => sum + prior.amount, 0) / (total!.amount || 1) * 100}% ${providerRows.slice(0, index + 1).reduce((sum, prior) => sum + prior.amount, 0) / (total!.amount || 1) * 100}%`).join(',')})` }}><CostDonutEdges amounts={providerRows.map(row => row.amount)} total={total!.amount}/><span><CostValue amount={total!.amount} priced={total!.pricedCalls} total={total!.allCalls} money={money} t={t}/></span></div><ol>{providerRows.map((row, index) => <li key={row.provider ?? 'null'}><i style={{ background: colors[index % colors.length] }}/><span className="qp-cost-route"><VendorIcon vendor={row.provider ?? 'unknown'}/>{name(row.provider)}</span><strong><CostValue amount={row.amount} priced={row.pricedCalls} total={row.allCalls} money={money} t={t}/> · {share(row.amount)}</strong></li>)}</ol></>}</section>}</div>
      {data && (total!.allCalls === 0 ? <p className="qp-panel">{t('redesign.costNoData')}</p> : <>
        <div className="qp-cost-upper"><section className="qp-panel qp-cost-trend"><div className="qp-cost-section-head"><div className="qp-cost-section-title"><h2><SectionMark icon={<TrendingUp/>}/>{t('redesign.costTrend')}</h2><div className="qp-cost-chart-labels">{total!.pricedCalls > 0 && <><span title={`${t('redesign.costTotal')}: ${money(0)} – ${money(maxCost)}`}>{t('redesign.costTotal')}</span><span title={`${t('redesign.costPricedTokens')}: 0 – ${f.tokens(maxTokens)}`}>{t('redesign.costPricedTokens')}</span></>}</div></div><a href={historyHref()}>{t('redesign.costOpenHistory')}</a></div>{total!.pricedCalls === 0 ? <p>{t('redesign.costNoPriced')}</p> : <div className="qp-cost-plot"><div className="qp-cost-axis" data-axis="amount" aria-hidden="true">{ticks.map(tick => <span key={tick} data-value={maxCost * tick} style={{ top: `${(1 - tick) * 100}%` }}>{money(maxCost * tick)}</span>)}</div><div className="qp-cost-chart" role="img" aria-label={`${t('redesign.costTrend')}: ${t('redesign.costTotal')} 0 – ${money(maxCost)}, ${t('redesign.costPricedTokens')} 0 – ${f.tokens(maxTokens)}. ${trend.map(pointDescription).join('; ')}`}>{trend.map(point => <div key={point.start} title={pointDescription(point)}><span className="qp-cost-column" style={{ height: `${point.amount / (maxCost || 1) * 100}%` }}/></div>)}<ObservedTrend className="qp-cost-token-line" language={lang} points={trend.map(point => ({ at: point.start, value: point.pricedTokens }))} label={t('redesign.costPricedTokens')} area={false} grid={false} edgeToEdge bucketCenters/></div><div className="qp-cost-axis" data-axis="tokens" aria-hidden="true">{ticks.map(tick => <span key={tick} data-value={maxTokens * tick} style={{ top: `${(1 - tick) * 100}%` }}>{f.tokens(maxTokens * tick)}</span>)}</div><div className="qp-cost-plot-dates"><time dateTime={new Date(data.scope.from).toISOString()}>{date(data.scope.from)}</time><time dateTime={new Date(data.scope.to).toISOString()}>{date(data.scope.to)}</time></div></div>}<div className="qp-cost-chart-footer"><p className="qp-footnote qp-cost-coverage">{t('redesign.costCoverage')}: {number(total!.pricedCalls)} / {number(total!.allCalls)} · {t('redesign.costOtherBasis')}: {number(total!.allCalls - total!.pricedCalls)}{route.basis === 'api' ? ` · ${t('redesign.costEstimated')}: ${number(total!.estimatedCalls)}` : ''}</p><CostChartData points={trend} basis={route.basis} language={lang} money={money} t={t}/></div></section><section className="qp-panel qp-cost-models"><h2><SectionMark icon={<Box/>}/>{t('redesign.costModels')}</h2>{topModels.length === 0 ? <p>{t('redesign.costNoPriced')}</p> : <div className="qp-cost-table" tabIndex={0}><table><thead><tr><th>{t('redesign.modelsModel')}</th><th>{t('redesign.modelsProvider')}</th><th>{t('redesign.costTotal')}</th><th>{t('redesign.costShare')}</th></tr></thead><tbody>{topModels.map(row => <tr key={JSON.stringify([row.model,row.provider])}><td>{row.model && row.provider ? <a href={historyHref({ model: row.model, provider: row.provider })}>{name(row.model)}</a> : name(row.model)}</td><td><span className="qp-cost-route"><VendorIcon vendor={row.provider ?? 'unknown'}/>{name(row.provider)}</span></td><td><CostValue amount={row.amount} priced={row.pricedCalls} total={row.allCalls} money={money} t={t}/></td><td><span className="qp-cost-share"><i aria-hidden="true"><b style={{ width: `${total!.amount > 0 ? row.amount / total!.amount * 100 : 0}%` }}/></i><span>{share(row.amount)}</span></span></td></tr>)}</tbody></table></div>}</section></div>
        <div className="qp-cost-lower"><section className="qp-panel qp-cost-projects"><h2><SectionMark icon={<Folder/>}/>{t('redesign.costProjects')}</h2>{topProjects.length === 0 ? <p>{t('redesign.costNoPriced')}</p> : <div className="qp-cost-table" tabIndex={0}><table><thead><tr><th>{t('redesign.costProject')}</th><th>{t('redesign.costTotal')}</th><th>{t('redesign.costShare')}</th></tr></thead><tbody>{topProjects.map(row => <tr key={row.project === null ? 'null' : `str:${row.project}`}><td><a className="qp-cost-project-link" href={historyHref(row.project === null ? { project_missing: '1' } : { project: row.project })}><Folder size={16} aria-hidden="true"/>{projectName(row.project)}</a></td><td><CostValue amount={row.amount} priced={row.pricedCalls} total={row.allCalls} money={money} t={t}/></td><td><span className="qp-cost-share"><i aria-hidden="true"><b style={{ width: `${total!.amount > 0 ? row.amount / total!.amount * 100 : 0}%` }}/></i><span>{share(row.amount)}</span></span></td></tr>)}</tbody></table></div>}</section><section className="qp-panel qp-cost-sessions"><h2><SectionMark icon={<Flame/>} tone="warm"/>{t('redesign.costSessions')}</h2>{data.sessions.length === 0 ? <p>{t('redesign.costNoPriced')}</p> : <div className="qp-cost-table" tabIndex={0}><table><thead><tr><th>{t('redesign.costSession')}</th><th>{t('redesign.costProject')}</th><th>{t('redesign.costTotal')}</th></tr></thead><tbody>{data.sessions.map(row => <tr key={row.sessionKey}><td><a href={historyHref({ session_id: String(row.sessionKey) })}>{row.nativeSessionId}</a></td><td>{projectName(row.project)}</td><td><CostValue amount={row.amount} priced={row.pricedCalls} total={row.allCalls} money={money} t={t}/></td></tr>)}</tbody></table></div>}</section><aside className="qp-panel qp-cost-insights"><h2><SectionMark icon={<Lightbulb/>}/>{t('redesign.costInsights')}</h2><div><span>{t('redesign.costKnownSavings')}</span><strong>{route.basis === 'api' && total!.knownCacheSavingCalls > 0 ? money(total!.knownCacheSavingUsd) : t('redesign.unknownValue')}</strong><small>{t(route.basis === 'native' ? 'redesign.costNativeNoSavings' : 'redesign.costSavingsNote')}{route.basis === 'api' ? ` · ${number(total!.knownCacheSavingCalls)} / ${number(total!.allCalls)}` : ''}</small></div><div><span>{t('redesign.costConcentration')}</span><strong>{topModel && total!.amount > 0 ? percent(topModel.amount / total!.amount) : t('redesign.unknownValue')}</strong><small>{topModel ? `${name(topModel.model)} · ${name(topModel.provider)}` : t('redesign.costNoPriced')}</small></div><div><span>{t('redesign.costUnpriced')}</span><strong>{number(total!.unknownCalls)} / {number(total!.allCalls)}</strong><small><a href={historyHref()}>{t('redesign.costOpenHistory')}</a></small></div></aside></div>
      </>)}
    </div>
  </RedesignShell>;
}
