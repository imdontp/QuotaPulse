import { useEffect, useRef, useState } from 'react';
import { BarChart3, RefreshCw } from 'lucide-react';
import { api, type CostAnalysisResponse } from '@/api';
import { useI18n, useT } from '@/i18n';
import { useFormat } from '@/i18n/format';
import { useLiveRefresh, useRefreshStatus } from '@/lib/use-live';
import { useTheme } from '@/lib/use-theme';
import { RedesignShell } from './shell';
import './cost.css';

type Range = 'today' | 'week' | 'month' | 'last30' | 'all';
type Basis = 'api' | 'native';
function readRoute() {
  const p = new URLSearchParams(location.hash.split('?')[1] ?? '');
  const range = p.get('range');
  return { range: (['today', 'week', 'last30', 'all'] as string[]).includes(range ?? '') ? range as Range : 'month', basis: p.get('basis') === 'native' ? 'native' as Basis : 'api' as Basis };
}
function rangeScope(range: Range, now: number) {
  if (range === 'all') return { from: 0, to: now + 1 };
  if (range === 'week') return { from: now - 7 * 86_400_000, to: now + 1 };
  if (range === 'last30') return { from: now - 30 * 86_400_000, to: now + 1 };
  const start = new Date(now);
  if (range === 'today') start.setHours(0, 0, 0, 0);
  else { start.setDate(1); start.setHours(0, 0, 0, 0); }
  return { from: start.getTime(), to: now + 1 };
}
const colors = ['#2bb8ef', '#775cf6', '#18cfa9', '#f58e43', '#8796ae', '#d364e9'];

export function ProductionCost() {
  const t = useT();
  const f = useFormat();
  const { lang, setLang, currency, rate } = useI18n();
  const [theme, toggleTheme] = useTheme();
  const [route, setRoute] = useState(readRoute);
  const [snapshot, setSnapshot] = useState<{ key: string; data: CostAnalysisResponse } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const refresh = useRefreshStatus();
  const key = `${route.range}:${route.basis}`;
  const currentKey = useRef(key); currentKey.current = key;
  useEffect(() => {
    const sync = () => { if (location.hash.slice(1).split('?')[0] === 'cost') setRoute(readRoute()); };
    addEventListener('hashchange', sync);
    return () => removeEventListener('hashchange', sync);
  }, []);
  const update = (patch: Partial<typeof route>) => {
    const next = { ...route, ...patch };
    const p = new URLSearchParams({ range: next.range, basis: next.basis });
    history.replaceState(null, '', `${location.pathname}${location.search}#cost?${p}`);
    setRoute(next);
  };
  useLiveRefresh(async () => {
    const requestKey = key;
    try {
      const data = await api.costAnalysis(rangeScope(route.range, Date.now()), route.basis);
      if (currentKey.current === requestKey) { setSnapshot({ key: requestKey, data }); setError(null); }
    } catch (cause) { if (currentKey.current === requestKey) setError(String(cause)); throw cause; }
  }, [route.range, route.basis]);
  const data = snapshot?.key === key ? snapshot.data : null;
  const total = data?.totals;
  const number = (value: number) => new Intl.NumberFormat(lang === 'th' ? 'th-TH' : 'en-US', { maximumFractionDigits: 0 }).format(value);
  const money = (usd: number) => new Intl.NumberFormat(lang === 'th' ? 'th-TH' : 'en-US', { style: 'currency', currency }).format(currency === 'THB' ? usd * rate : usd);
  const percent = (value: number) => new Intl.NumberFormat(lang === 'th' ? 'th-TH' : 'en-US', { style: 'percent', maximumFractionDigits: 1 }).format(value);
  const displayValue = (amount: number, pricedCalls: number, allCalls: number) => allCalls === 0 ? money(0) : pricedCalls === 0 ? t('redesign.unknownValue') : `${money(amount)}${pricedCalls < allCalls ? '+' : ''}`;
  const historyHref = (extra: Record<string, string> = {}) => data ? `#history?${new URLSearchParams({ range: 'custom', from: String(data.scope.from), to: String(data.scope.to), ...extra })}` : '#history';
  const elapsedDays = data ? (data.scope.to - data.scope.from) / 86_400_000 : 0;
  const fullDays = Math.floor(elapsedDays);
  const trend = data ? Array.from({ length: Math.ceil((data.scope.to - data.scope.from) / data.bucketMs) }, (_, index) => {
    const start = data.scope.from + index * data.bucketMs;
    return data.points.find(point => point.start === start) ?? { start, amount: 0, pricedTokens: 0, allTokens: 0, pricedCalls: 0, allCalls: 0 };
  }) : [];
  const maxCost = Math.max(0.000001, ...trend.map(point => point.amount));
  const maxTokens = Math.max(1, ...trend.map(point => point.pricedTokens));
  const topModels = data?.models.filter(row => row.pricedCalls > 0).slice(0, 8) ?? [];
  const topProjects = data?.projects.filter(row => row.pricedCalls > 0).slice(0, 8) ?? [];
  const providerRows = data?.providers.filter(row => row.pricedCalls > 0) ?? [];
  const share = (amount: number) => total && total.amount > 0 ? percent(amount / total.amount) : '—';
  const name = (value: string | null) => value === null ? t('redesign.modelsUnspecified') : value === '' ? t('redesign.emptyProject') : value;
  const projectName = (value: string | null) => value === null ? t('redesign.costUnknownProject') : value === '' ? t('redesign.emptyProject') : value;
  const topModel = topModels[0];

  return <RedesignShell active="cost" theme={theme} language={lang} onTheme={toggleTheme} onLanguage={() => setLang(lang === 'en' ? 'th' : 'en')} t={t} testId="production-cost">
    <header className="qp-cost-header"><div><h1><BarChart3 size={24}/>{t('redesign.costHeading')}</h1><p>{t('redesign.costSubtitle')}</p></div><button onClick={() => void refresh.refreshNow()} disabled={refresh.refreshing}><RefreshCw size={16}/>{t('app.refreshNow')}</button></header>
    <div className="qp-cost-toolbar"><label>{t('redesign.projectRange')}<select value={route.range} onChange={event => update({ range: event.target.value as Range })}><option value="month">{t('redesign.costMonthToDate')}</option><option value="today">{t('redesign.today')}</option><option value="week">{t('redesign.last7')}</option><option value="last30">{t('redesign.last30')}</option><option value="all">{t('redesign.allTime')}</option></select></label><label>{t('redesign.costBasis')}<select value={route.basis} onChange={event => update({ basis: event.target.value as Basis })}><option value="api">{t('redesign.costApiBasis')}</option><option value="native">{t('redesign.costNativeBasis')}</option></select></label></div>
    {error && <p className="qp-cost-error" role="status">{t('redesign.staleSnapshot')} · {error}</p>}
    {!data ? <p className="qp-panel" role="status">{error ?? t('app.loading')}</p> : <>
      <section className="qp-cost-summary" aria-label={t('redesign.costHeading')}><article className="qp-panel"><span>{t('redesign.costTotal')}</span><strong>{displayValue(total!.amount, total!.pricedCalls, total!.allCalls)}</strong><small>{route.basis === 'api' ? t('redesign.costApiBasis') : t('redesign.costNativeBasis')}</small></article><article className="qp-panel"><span>{t('redesign.costDaily')}</span><strong>{fullDays > 0 && total!.pricedCalls > 0 ? money(total!.amount / elapsedDays) : t('redesign.unknownValue')}</strong><small>{fullDays} {t('redesign.costDays')}</small></article><article className="qp-panel"><span>{t('redesign.costProjection')}</span><strong>{t('redesign.unknownValue')}</strong><small>{t(route.basis === 'api' ? 'redesign.costProjectionUnavailable' : 'redesign.costNativeProjection')}</small></article><article className="qp-panel"><span>{t('redesign.costPerThousand')}</span><strong>{total!.pricedTokens > 0 ? money(total!.amount / total!.pricedTokens * 1000) : t('redesign.unknownValue')}</strong><small>{t('redesign.costAllTokens')}: {f.tokens(total!.allTokens)}</small></article></section>
      <p className="qp-footnote">{t('redesign.costCoverage')}: {number(total!.pricedCalls)} / {number(total!.allCalls)} · {t('redesign.costOtherBasis')}: {number(total!.allCalls - total!.pricedCalls)}{route.basis === 'api' ? ` · ${t('redesign.costEstimated')}: ${number(total!.estimatedCalls)}` : ''}</p>
      {total!.allCalls === 0 ? <p className="qp-panel">{t('redesign.costNoData')}</p> : <>
        <div className="qp-cost-upper"><section className="qp-panel qp-cost-trend"><div className="qp-cost-section-head"><h2>{t('redesign.costTrend')}</h2><a href={historyHref()}>{t('redesign.costOpenHistory')}</a></div>{total!.pricedCalls === 0 ? <p>{t('redesign.costNoPriced')}</p> : <div className="qp-cost-chart" role="img" aria-label={t('redesign.costTrend')}>{trend.map(point => <div key={point.start} title={`${new Date(point.start).toLocaleString(lang === 'th' ? 'th-TH' : 'en-US')} · ${money(point.amount)} · ${f.tokens(point.pricedTokens)}`}><span className="qp-cost-column" style={{ height: `${Math.max(2, point.amount / maxCost * 100)}%` }}/><i style={{ bottom: `${point.pricedTokens / maxTokens * 100}%` }}/></div>)}</div>}<p className="qp-footnote">{t('redesign.costBasis')}: {route.basis === 'api' ? t('redesign.costApiBasis') : t('redesign.costNativeBasis')} · {t('redesign.costAllTokens')}: {f.tokens(total!.allTokens)}</p></section><section className="qp-panel qp-cost-providers"><h2>{t('redesign.costProviders')}</h2>{providerRows.length === 0 ? <p>{t('redesign.costNoPriced')}</p> : <><div className="qp-cost-donut" data-zero={total!.amount === 0} style={{ background: `conic-gradient(${providerRows.map((row, index) => `${colors[index % colors.length]} ${providerRows.slice(0, index).reduce((sum, prior) => sum + prior.amount, 0) / (total!.amount || 1) * 100}% ${providerRows.slice(0, index + 1).reduce((sum, prior) => sum + prior.amount, 0) / (total!.amount || 1) * 100}%`).join(',')})` }}><span>{money(total!.amount)}</span></div><ol>{providerRows.map((row, index) => <li key={row.provider ?? 'null'}><i style={{ background: colors[index % colors.length] }}/><span>{name(row.provider)}</span><strong>{money(row.amount)} · {share(row.amount)}</strong></li>)}</ol></>}</section></div>
        <div className="qp-cost-lower"><section className="qp-panel"><h2>{t('redesign.costModels')}</h2>{topModels.length === 0 ? <p>{t('redesign.costNoPriced')}</p> : <div className="qp-cost-table"><table><thead><tr><th>{t('redesign.modelsModel')}</th><th>{t('redesign.modelsProvider')}</th><th>{t('redesign.costTotal')}</th><th>{t('redesign.costShare')}</th></tr></thead><tbody>{topModels.map(row => <tr key={JSON.stringify([row.model,row.provider])}><td>{row.model && row.provider ? <a href={historyHref({ model: row.model, provider: row.provider })}>{name(row.model)}</a> : name(row.model)}</td><td>{name(row.provider)}</td><td>{money(row.amount)}</td><td>{share(row.amount)}</td></tr>)}</tbody></table></div>}</section><section className="qp-panel"><h2>{t('redesign.costProjects')}</h2>{topProjects.length === 0 ? <p>{t('redesign.costNoPriced')}</p> : <div className="qp-cost-table"><table><thead><tr><th>{t('redesign.costProject')}</th><th>{t('redesign.costTotal')}</th><th>{t('redesign.costShare')}</th></tr></thead><tbody>{topProjects.map(row => <tr key={row.project === null ? 'null' : `str:${row.project}`}><td><a href={historyHref(row.project === null ? { project_missing: '1' } : { project: row.project })}>{projectName(row.project)}</a></td><td>{money(row.amount)}</td><td>{share(row.amount)}</td></tr>)}</tbody></table></div>}</section><section className="qp-panel qp-cost-sessions"><h2>{t('redesign.costSessions')}</h2>{data.sessions.length === 0 ? <p>{t('redesign.costNoPriced')}</p> : <div className="qp-cost-table"><table><thead><tr><th>{t('redesign.costSession')}</th><th>{t('redesign.costProject')}</th><th>{t('redesign.costTotal')}</th></tr></thead><tbody>{data.sessions.map(row => <tr key={row.sessionKey}><td><a href={historyHref({ session_id: String(row.sessionKey) })}>{row.nativeSessionId}</a></td><td>{projectName(row.project)}</td><td>{money(row.amount)}</td></tr>)}</tbody></table></div>}</section><aside className="qp-panel qp-cost-insights"><h2>{t('redesign.costInsights')}</h2><div><span>{t('redesign.costKnownSavings')}</span><strong>{route.basis === 'api' && total!.knownCacheSavingCalls > 0 ? money(total!.knownCacheSavingUsd) : t('redesign.unknownValue')}</strong><small>{t(route.basis === 'native' ? 'redesign.costNativeNoSavings' : 'redesign.costSavingsNote')}{route.basis === 'api' ? ` · ${number(total!.knownCacheSavingCalls)} / ${number(total!.allCalls)}` : ''}</small></div><div><span>{t('redesign.costConcentration')}</span><strong>{topModel && total!.amount > 0 ? percent(topModel.amount / total!.amount) : t('redesign.unknownValue')}</strong><small>{topModel ? `${name(topModel.model)} · ${name(topModel.provider)}` : t('redesign.costNoPriced')}</small></div><div><span>{t('redesign.costUnpriced')}</span><strong>{number(total!.unknownCalls)} / {number(total!.allCalls)}</strong><small><a href={historyHref()}>{t('redesign.costOpenHistory')}</a></small></div></aside></div>
      </>}
    </>}
  </RedesignShell>;
}
