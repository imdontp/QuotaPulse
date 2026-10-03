import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Activity, ArrowUpRight, Box, CircleGauge, Coins, Folder, GitBranch, Layers, Wallet, X } from 'lucide-react';
import { VendorIcon } from '@/components/vendor-icon';
import { HarnessIcon } from '@/components/harness-icon';
import { countdown } from '@/format';
import type { QuotaHistoryResponse } from '@/api';
import { CostValue, recordCostCoverage } from './cost-value';
import { defaultQuota, dimensions, groupUsage, quotaState, runtimeEdges, runwayState, summarize, type Dimension, type QuotaWindow, type RuntimeGraph, type UsageNode, type UsageRecord } from './model';
import { RedesignShell, type RedesignTranslate } from './shell';
import { QuotaChart } from './quota-chart';
import { RuntimeData } from './runtime-data';

type Translate = RedesignTranslate;
const riskLabel = (state: ReturnType<typeof quotaState> | null) =>
  !state ? 'redesign.unavailable' : state.stale ? 'redesign.stale' : state.risk === 'unknown' ? 'redesign.unavailable' : `redesign.${state.risk}` as const;
interface OverviewProps {
  records?: readonly UsageRecord[];
  graph?: RuntimeGraph;
  quotas: readonly QuotaWindow[];
  now: number;
  t: Translate;
  language: 'en' | 'th';
  onLanguage: () => void;
  theme?: 'dark' | 'light';
  onTheme?: () => void;
  preview?: boolean;
  currency?: 'USD' | 'THB';
  rate?: number;
  onQuotaSelect?: (id: string) => void;
  quotaHistory?: QuotaHistoryResponse | null;
  quotaHistoryError?: boolean;
  recent?: readonly ActivityItem[];
  period?: string;
  periodControl?: ReactNode;
  selectedQuotaId?: string | null;
  historyHref?: string;
  harnessVendors?: Readonly<Record<string, string>>;
}

export interface ActivityItem {
  id: string | number;
  timestamp: number;
  harness: string;
  provider: string | null;
  model: string | null;
  tokens: number;
  grain: 'call' | 'session_aggregate' | 'unknown';
  sessionKey: number | null;
}

function PulseCore({ quota, now, t, language, staleAfterMs }: { quota: QuotaWindow | undefined; now: number; t: Translate; language: 'en' | 'th'; staleAfterMs: number }) {
  const id = useId().replace(/:/g, '');
  const state = quota ? quotaState(quota, now, staleAfterMs) : null;
  const used = state?.remaining == null ? null : quota?.usedPercent ?? null;
  const runway = runwayState(quota, now, staleAfterMs);
  const projectedAt = runway.status === 'ready' ? runway.projectedFullAt : null;
  const resetAt = runway.status === 'ready' ? quota!.resetAt : null;
  const duration = (at: number | null) => at === null ? t('redesign.unknownValue') : at - now < 60_000 ? '<1m' : countdown(at, now);
  const exact = (at: number | null) => at === null ? t('redesign.unavailable') : new Intl.DateTimeFormat(language === 'th' ? 'th-TH' : 'en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(at);
  return <div className="qp-pulse" data-stale={!state || state.stale}>
    <svg viewBox="0 0 360 320" aria-hidden="true">
      <defs>
        <radialGradient id={`${id}-fill`}><stop stopColor="#225575" stopOpacity=".7"/><stop offset=".75" stopColor="#071f43" stopOpacity=".5"/><stop offset="1" stopColor="#32cdff" stopOpacity=".2"/></radialGradient>
        <linearGradient id={`${id}-arc`}><stop stopColor="#26dcff"/><stop offset=".55" stopColor="#367aff"/><stop offset="1" stopColor="#a26aff"/></linearGradient>
        <filter id={`${id}-glow`} x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="3"/><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        <clipPath id={`${id}-world`}><circle cx="180" cy="160" r="114"/></clipPath>
      </defs>
      <g fill="none" stroke={`url(#${id}-arc)`} strokeWidth=".8" opacity=".45">
        {[0, 1, 2].map(wave => <path key={wave} d={Array.from({ length: 73 }, (_, index) => {
          const x = index * 5;
          const y = 160 + Math.sin(index * .21 + wave * 1.8) * (18 + wave * 9);
          return `${index === 0 ? 'M' : 'L'}${x} ${y.toFixed(2)}`;
        }).join(' ')}/>)}
      </g>
      <g className="qp-orbit" fill="none" stroke="#55baf3" strokeOpacity=".2">
        <ellipse cx="180" cy="160" rx="169" ry="73" transform="rotate(-26 180 160)"/>
        <ellipse cx="180" cy="160" rx="165" ry="96" transform="rotate(30 180 160)"/>
      </g>
      <circle cx="180" cy="160" r="117" fill={`url(#${id}-fill)`} stroke="#51b9ef" strokeOpacity=".4"/>
      <image data-testid="pulse-earth" href="/redesign/pulse-earth-v1.png" x="38" y="19" width="284" height="284" clipPath={`url(#${id}-world)`}/>
      <g fill="none" stroke={`url(#${id}-arc)`} filter={`url(#${id}-glow)`}>
        <circle cx="180" cy="160" r="119" strokeWidth="2"/>
        <circle cx="180" cy="160" r="137" strokeWidth="3" opacity=".45"/>
        <circle cx="180" cy="160" r="145" pathLength="100" strokeWidth="1" strokeDasharray=".1 1.8" opacity=".6"/>
      </g>
      <g fill="#4ebcff" filter={`url(#${id}-glow)`} aria-hidden="true">{Array.from({ length: 16 }, (_, index) => {
        const angle = index * 2.399963;
        return <circle key={index} cx={180 + Math.cos(angle) * 150} cy={160 + Math.sin(angle) * 150} r={index % 3 === 0 ? 1.7 : .7}/>;
      })}</g>
      <circle cx="180" cy="160" r="129" fill="none" stroke="#395175" strokeOpacity=".45" strokeWidth="8"/>
      <circle className="qp-core-halo" cx="180" cy="160" r="120" fill="none" stroke={`url(#${id}-arc)`} strokeWidth="2"/>
      {used !== null && <circle className="qp-core-progress" data-testid="pulse-progress" cx="180" cy="160" r="129" pathLength="100" fill="none" stroke={`url(#${id}-arc)`} strokeWidth="8" strokeLinecap={used === 0 ? 'butt' : 'round'} strokeDasharray={`${Math.min(100, used)} 100`} transform="rotate(-90 180 160)"/>}
    </svg>
    <div className="qp-pulse-label"><strong>{used === null ? '—' : `${used}%`}</strong><span className="qp-pulse-state">{t('redesign.quotaUsed')}</span><span>{quota?.owner ?? '—'} · {quota?.window ?? '—'}</span></div>
    <div className="qp-pulse-runway" data-testid="pulse-runway" data-projected-at={projectedAt ?? undefined} data-reset-at={resetAt ?? undefined}>
      <span>{t('redesign.runwayShort')} <strong title={exact(projectedAt)}>{duration(projectedAt)}</strong></span>
      <span>{t('redesign.resetShort')} <strong title={exact(resetAt)}>{duration(resetAt)}</strong></span>
    </div>
  </div>;
}

function RuntimeMap({ nodes, edges, recordCount, t, language, harnessVendors, onInspect }: { nodes: RuntimeGraph['nodes']; edges: RuntimeGraph['edges']; recordCount: number; harnessVendors: Readonly<Record<string, string>>; t: Translate; language: 'en' | 'th'; onInspect: (dimension: Dimension, key: string | null) => void }) {
  const columns = dimensions.map(dimension => nodes[dimension].slice(0, 8));
  const maxRows = Math.max(1, ...columns.map(column => column.length));
  const height = maxRows * 40;
  return <section className="qp-panel qp-runtime" id="runtime">
    <div className="qp-section-heading"><div><h2><GitBranch size={18}/>{t('redesign.runtime')}</h2><p>{t('redesign.connections')}</p></div><span className="qp-chip">{t('redesign.records')} · {recordCount}</span></div>
    {recordCount > 0 && <RuntimeData nodes={nodes} edges={edges} language={language} t={t} onInspect={onInspect}/>}
    {recordCount === 0 ? <p>{t('redesign.empty')}</p> : <div className="qp-map-scroll" tabIndex={0} aria-label={t('redesign.runtime')}>
      <div className="qp-map" style={{ height: height + 24 }}>
        <svg className="qp-map-edges" viewBox={`0 0 1000 ${height}`} preserveAspectRatio="none" aria-hidden="true">
          {edges.filter(edge => columns[edge.column].some(node => node.key === edge.from) && columns[edge.column + 1].some(node => node.key === edge.to)).map(edge => {
            const fromIndex = columns[edge.column].findIndex(node => node.key === edge.from);
            const toIndex = columns[edge.column + 1].findIndex(node => node.key === edge.to);
            const x = edge.column * 250 + 195;
            const y = fromIndex * 40 + 17;
            const endY = toIndex * 40 + 17;
            return <path data-column={edge.column} data-from={JSON.stringify(edge.from)} data-to={JSON.stringify(edge.to)} key={JSON.stringify([edge.column, edge.from, edge.to])} d={`M ${x} ${y} C ${x + 45} ${y}, ${x + 10} ${endY}, ${x + 55} ${endY}`} fill="none" stroke="currentColor" strokeWidth="2"/>;
          })}
        </svg>
        {dimensions.map((dimension, index) => <div className="qp-map-column" key={dimension}>
          <h3>{t(`redesign.${dimension}`)}</h3>
          {columns[index].map(node => <button className="qp-map-node" data-dimension={dimension} data-key={JSON.stringify(node.key)} key={JSON.stringify(node.key)} onClick={() => onInspect(dimension, node.key)}><span className="qp-node-icon" aria-hidden="true">{dimension === 'harness' ? <HarnessIcon harness={node.key ?? ''} vendor={harnessVendors[node.key ?? '']} label={node.key ?? undefined}/> : dimension === 'provider' ? <VendorIcon vendor={node.key ?? 'unknown'}/> : dimension === 'project' ? <Folder size={15}/> : <Box size={15}/>}</span><span className="qp-node-label">{node.key ?? t(dimension === 'project' ? 'redesign.unassigned' : 'redesign.unknownValue')}</span><small>{new Intl.NumberFormat(undefined, { notation: 'compact' }).format(node.tokens)}</small></button>)}
        </div>)}
      </div>
    </div>}
    {dimensions.some(dimension => nodes[dimension].length > 8) && <p className="qp-footnote">{t('redesign.topNodes')}</p>}
  </section>;
}

function QuotaRunway({ quota, now, t, language, preview, history, historyError }: { quota: QuotaWindow | undefined; now: number; t: Translate; language: 'en' | 'th'; preview: boolean; history?: QuotaHistoryResponse | null; historyError?: boolean }) {
  const [historyOpen, setHistoryOpen] = useState(false);
  const runway = runwayState(quota, now, preview ? 300000 : 3600000);
  const decimal = (value: number) => new Intl.NumberFormat(language === 'th' ? 'th-TH' : 'en-US', { maximumFractionDigits: 1 }).format(value);
  const date = (value: number) => new Intl.DateTimeFormat(language === 'th' ? 'th-TH' : 'en-US', { dateStyle: 'short', timeStyle: 'short' }).format(value);
  const duration = (value: number) => value - now < 60_000 ? '<1m' : countdown(value, now);
  const reason = runway.status === 'unavailable' ? ({ noQuota: 'redesign.runwayNoQuota', stale: 'redesign.runwayStale', noReset: 'redesign.runwayNoReset', reset: 'redesign.runwayReset', unknown: 'redesign.runwayUnknown' } as const)[runway.reason] : null;
  const forecast = runway.status === 'ready' ? runway.projectedBeforeReset && runway.projectedFullAt !== null
    ? `${t('redesign.projected')} ${date(runway.projectedFullAt)} · ${t('redesign.beforeReset')}`
    : runway.projectedFullAt !== null ? t('redesign.afterReset')
      : t(runway.forecastStatus === 'flat' ? 'redesign.forecastFlat' : runway.forecastStatus === 'reset' ? 'redesign.forecastReset' : 'redesign.forecastInsufficient') : null;
  const marker = runway.status === 'ready' && runway.projectedBeforeReset && runway.projectedFullAt !== null
    ? (runway.projectedFullAt - now) / (quota!.resetAt - now) * 100 : null;
  return <section className="qp-panel qp-runway" data-testid="quota-runway">
    <div className="qp-runway-heading"><h2><CircleGauge size={18}/>{t('redesign.runway')}</h2><span className="qp-footnote">{quota ? `${quota.owner} · ${quota.window}` : t('redesign.unavailable')}</span></div>
    {runway.status === 'unavailable' ? <p className="qp-runway-message" role="status">{t(reason!)}</p> : <>
      <div className="qp-runway-labels">
        <span>{t('redesign.now')}<time dateTime={new Date(now).toISOString()}>{date(now)}</time></span>
        <span data-risk={marker !== null ? 'warning' : undefined}>{t('redesign.projected')}{runway.projectedFullAt !== null ? <time dateTime={new Date(runway.projectedFullAt).toISOString()}>{date(runway.projectedFullAt)}</time> : <small>{t('redesign.unknownValue')}</small>}</span>
        <span>{t('redesign.resetShort')} ({quota!.window})<time dateTime={new Date(quota!.resetAt).toISOString()}>{date(quota!.resetAt)}</time></span>
      </div>
      <div className="qp-runway-track" role="img" aria-label={`${t('redesign.now')} ${date(now)} · ${forecast} · ${t('redesign.resetShort')} ${date(quota!.resetAt)}`} data-now={now} data-reset-at={quota!.resetAt} data-projected-at={runway.projectedFullAt ?? undefined}>
        <span className="qp-runway-fill" style={{ width: `${marker ?? 100}%` }}/>
        {marker !== null && <span className="qp-runway-risk" style={{ left: `${marker}%` }}/>}<span className="qp-runway-now"/>
        {marker !== null && <span className="qp-runway-marker" style={{ left: `${marker}%` }}/>}<span className="qp-runway-reset"/>
      </div>
      <div className="qp-runway-outcome"><strong>{runway.projectedFullAt !== null ? `${duration(runway.projectedFullAt)} ${t('redesign.remaining')}` : '—'}</strong><span data-risk={marker !== null ? 'warning' : undefined}>{forecast}</span><strong>{t('redesign.resetIn')} {duration(quota!.resetAt)}</strong></div>
      <p className="qp-footnote">{t('redesign.safePace')} <strong>{decimal(runway.safePace)}</strong> {t('redesign.pointsPerHour')}</p>
    </>}
    {!preview && <details className="qp-quota-history" data-testid="quota-history" onToggle={event => setHistoryOpen(event.currentTarget.open)}>
      <summary>{t('redesign.observedHistory')}</summary>
      {historyError && history?.reader && <p role="status" className="qp-footnote">{t('redesign.historyUnavailable')}</p>}
      {history?.reader && history.segments.length > 0 ? <>
        {historyOpen && <QuotaChart history={history} t={t} language={language} title={t('redesign.observedHistory')}/>}
        <p className="qp-footnote">{history.reader.origin} · {history.segments.length} {t('redesign.resetPeriods')} · {history.segments.reduce((sum, segment) => sum + segment.samples.length, 0)} {t('redesign.readings')}</p>
      </> : <p className="qp-footnote">{historyError ? t('redesign.historyUnavailable') : history || !quota ? t('redesign.noHistory') : t('redesign.historyLoading')}</p>}
    </details>}
  </section>;
}

export function Overview({ records = [], graph, quotas, now, t, language, onLanguage, theme: themeProp, onTheme, preview = false, currency = 'USD', rate = 1, onQuotaSelect, quotaHistory, quotaHistoryError, recent, period, periodControl, selectedQuotaId, harnessVendors = {}, historyHref = '#history?range=today' }: OverviewProps) {
  const [localTheme, setLocalTheme] = useState<'dark' | 'light'>('dark');
  const theme = themeProp ?? localTheme;
  const [quotaId, setQuotaId] = useState<string | null>(null);
  const [selection, setSelection] = useState<{ dimension: Dimension; key: string | null } | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const shell = useRef<HTMLDivElement>(null);
  const quotaKey = selectedQuotaId !== undefined ? selectedQuotaId : quotaId;
  const quota = (quotaKey && quotas.find(item => item.id === quotaKey)) || defaultQuota(quotas, now, preview ? 300000 : 3600000);
  const totals = graph?.totals ?? { ...summarize(records), records: records.length };
  const nodes: RuntimeGraph['nodes'] = graph?.nodes ?? Object.fromEntries(dimensions.map(dimension => [dimension, groupUsage(records, dimension)])) as RuntimeGraph['nodes'];
  const edges = graph?.edges ?? runtimeEdges(records);
  const models = nodes.model;
  const state = quota ? quotaState(quota, now, preview ? 300000 : 3600000) : null;
  const detail: UsageNode | null = selection ? nodes[selection.dimension].find(node => node.key === selection.key) ?? null : null;
  const number = (value: number) => new Intl.NumberFormat(language === 'th' ? 'th-TH' : 'en-US', { maximumFractionDigits: 0 }).format(value);
  const money = (value: number) => new Intl.NumberFormat(language === 'th' ? 'th-TH' : 'en-US', { style: 'currency', currency }).format(currency === 'THB' ? value * rate : value);
  const coverage = graph?.totals;
  const prices = coverage ? { native: coverage.nativeCalls, api: coverage.computedCalls + coverage.estimatedCalls, total: coverage.nativeCalls + coverage.computedCalls + coverage.estimatedCalls + coverage.unknownCalls } : recordCostCoverage(records);
  const inputTotal = coverage ? coverage.inputTokens + coverage.cachedInputTokens + coverage.cacheWriteTokens : 0;
  const cacheShare = inputTotal > 0 && coverage ? coverage.cachedInputTokens / inputTotal * 100 : null;
  const activities: readonly ActivityItem[] = recent ?? records.slice(0, 4).map((record, index) => ({ id: record.id, timestamp: now - index * 60_000, harness: record.harness, provider: record.provider, model: record.model, tokens: record.tokens, grain: record.grain === 'call' ? 'call' : 'session_aggregate', sessionKey: null }));
  useEffect(() => {
    if (selection && !dialog.current?.open) dialog.current?.showModal();
  }, [selection]);
  useEffect(() => {
    const node = shell.current;
    if (!node) return;
    let intersecting = true;
    const update = () => { node.dataset.paused = String(document.hidden || !intersecting); };
    const observer = new IntersectionObserver(([entry]) => { intersecting = entry.isIntersecting; update(); });
    observer.observe(node.querySelector('.qp-pulse') ?? node);
    document.addEventListener('visibilitychange', update);
    update();
    return () => { observer.disconnect(); document.removeEventListener('visibilitychange', update); };
  }, []);
  return <RedesignShell active="overview" rootRef={shell} theme={theme} language={language} onLanguage={onLanguage} onTheme={() => onTheme ? onTheme() : setLocalTheme(theme === 'dark' ? 'light' : 'dark')} t={t} preview={preview} testId={preview ? 'redesign-preview' : 'production-overview'}>
        <div className="qp-page-heading"><h1>{t('redesign.title')}</h1><span className="qp-chip">{period ?? new Intl.DateTimeFormat(language === 'th' ? 'th-TH' : 'en-US', { dateStyle: 'medium' }).format(now)}</span></div>
        <div className="qp-hero-grid">
          <section className="qp-panel qp-hero">
            <div className="qp-section-heading"><h2><Activity size={18}/>{t('redesign.core')}</h2>{periodControl ?? (period && <span className="qp-chip">{period}</span>)}<span className="qp-status" data-risk={state?.risk ?? 'unknown'}>{t(riskLabel(state))}</span></div>
            <div className="qp-core-grid"><div className="qp-metrics">
              <Metric icon={<CircleGauge size={21}/>} label={t('redesign.tokens')} value={number(totals.tokens)}/>
              <Metric icon={<Layers size={21}/>} label={t('redesign.sessions')} value={number(totals.sessions)}/>
              <Metric icon={<Coins size={21}/>} label={t('redesign.reported')} value={<CostValue amount={totals.reportedCost} priced={prices.native} total={prices.total} money={money} t={t} unit={graph ? 'calls' : 'records'}/>}/>
              <Metric icon={<Wallet size={21}/>} label={t('redesign.value')} value={<CostValue amount={totals.apiValue} priced={prices.api} total={prices.total} money={money} t={t} unit={graph ? 'calls' : 'records'}/>}/>
            </div><PulseCore quota={quota} now={now} t={t} language={language} staleAfterMs={preview ? 300000 : 3600000}/><section className="qp-top-models" id="model-usage" tabIndex={0} aria-label={t('redesign.models')}><h3>{t('redesign.models')}</h3><div className="qp-top-model-list">{models.map(model => <button className="qp-model-row" key={String(model.key)} onClick={() => setSelection({ dimension: 'model', key: model.key })}><span className="qp-model-identity"><i aria-hidden="true"><Box size={18}/></i><span>{model.key ?? t('redesign.unknownValue')}</span></span><strong title={number(model.tokens)}>{totals.tokens ? number(model.tokens / totals.tokens * 100) : '0'}%</strong><span className="qp-bar"><span style={{ width: `${totals.tokens ? model.tokens / totals.tokens * 100 : 0}%` }}/></span></button>)}</div></section></div>
            <p className="qp-footnote">{t('redesign.scope')}</p>
          </section>
          <section className="qp-panel qp-quotas"><h2><CircleGauge size={18}/>{t('redesign.windows')}</h2>
            {quotas.length === 0 && <p className="qp-footnote">{t('redesign.unavailable')}</p>}
            {quotas.map(item => { const reading = quotaState(item, now, preview ? 300000 : 3600000); return <button className="qp-quota" key={item.id} aria-pressed={quota?.id === item.id} onClick={() => { setQuotaId(item.id); onQuotaSelect?.(item.id); }}>
              <span className="qp-quota-heading"><strong><VendorIcon vendor={item.provider ?? 'unknown'}/>{item.owner}</strong><span>{item.window}</span></span>
              <span className="qp-quota-number">{reading.remaining === null ? '—' : `${reading.remaining}%`} <small>{t('redesign.remaining')}</small></span>
              <span className="qp-bar"><span style={{ width: `${reading.remaining ?? 0}%` }}/></span>
              <small>{t('redesign.reset')} · {Number.isFinite(item.resetAt) && item.resetAt > 0 ? new Date(item.resetAt).toISOString().slice(5, 16).replace('T', ' ') : '—'}</small>
              <span className="qp-status" data-risk={reading.risk}>{t(riskLabel(reading))}</span>
            </button>; })}
          </section>
        </div>
        <RuntimeMap nodes={nodes} edges={edges} recordCount={totals.records} t={t} language={language} harnessVendors={harnessVendors} onInspect={(dimension, key) => setSelection({ dimension, key })}/>
        <div className="qp-bottom-grid">
          <QuotaRunway quota={quota} now={now} t={t} language={language} preview={preview} history={quotaHistory} historyError={quotaHistoryError}/>
          <section className="qp-panel qp-insights" data-testid="usage-insights"><h2><Box size={18}/>{t('redesign.insights')}</h2>
            <div className="qp-insight-grid"><Metric label={t('redesign.cacheShare')} value={cacheShare === null ? '—' : `${number(cacheShare)}%`}/><Metric label={t('redesign.cacheSaving')} value={coverage && coverage.cacheSavingKnownCalls > 0 ? money(coverage.cacheSavingKnownUsd) : '—'}/></div>
            <p className="qp-footnote">{cacheShare === null ? t('redesign.noInput') : `${number(coverage!.cachedInputTokens)} / ${number(inputTotal)}`}. {coverage && coverage.cacheSavingKnownCalls > 0 ? `${number(coverage.cacheSavingKnownCalls)} ${t('redesign.knownCalls')}` : t('redesign.noCachePrice')}.</p>
            <h3 className={preview ? undefined : 'qp-visually-hidden'}>{t('redesign.detail')}</h3><div className="qp-coverage"><Metric label={t('redesign.calls')} value={number(totals.callRecords)}/><Metric label={t('redesign.aggregates')} value={number(totals.aggregateRecords)}/><Metric label={t('redesign.unknown')} value={number(totals.unknownCostRecords)}/></div><p className="qp-footnote">{t('redesign.coverage')}</p>
          </section>
        </div>
        <section className="qp-panel qp-activity" data-testid="recent-activity">
          <div className="qp-section-heading"><h2><Activity size={18}/>{t('redesign.activity')}</h2>{!preview && <a href={historyHref}>{t('redesign.openHistory')} <ArrowUpRight size={14}/></a>}</div>
          {activities.length === 0 ? <p className="qp-footnote">{t('redesign.noRecent')}</p> : <div className="qp-activity-list">{activities.map(item => {
            const content = <><strong><span className="qp-activity-identity"><HarnessIcon harness={item.harness} vendor={harnessVendors[item.harness]} label={item.harness}/>{item.harness}</span><time dateTime={new Date(item.timestamp).toISOString()}>{new Intl.DateTimeFormat(language === 'th' ? 'th-TH' : 'en-US', { hour: '2-digit', minute: '2-digit' }).format(item.timestamp)}</time></strong><span className="qp-activity-route"><VendorIcon vendor={item.provider ?? 'unknown'}/>{item.provider ?? t('redesign.unknownValue')} · {item.model ?? t('redesign.unknownValue')}</span><small>{number(item.tokens)} {t('redesign.tokens')} · {t(item.grain === 'call' ? 'redesign.callRecord' : 'redesign.aggregateUpdate')}</small></>;
            return preview ? <div className="qp-activity-item" key={item.id}>{content}</div>
              : <a className="qp-activity-item" key={item.id} href={item.sessionKey !== null ? `#history?range=all&session_id=${item.sessionKey}` : '#history?range=today'} aria-label={`${item.harness} · ${item.model ?? t('redesign.unknownValue')} · ${t('redesign.openHistory')}`}>{content}</a>;
          })}</div>}
          <p className="qp-footnote">{t('redesign.activityCaveat')}</p>
        </section>
    <dialog ref={dialog} className="qp-dialog" aria-labelledby="qp-detail-title" onClose={event => { if (!event.currentTarget.open) setSelection(null); }}>
      <div className="qp-section-heading"><h2 id="qp-detail-title">{selection?.key === '' ? t('redesign.emptyIdentity') : selection?.key ?? t(selection?.dimension === 'project' ? 'redesign.unassigned' : 'redesign.unknownValue')}</h2><button autoFocus onClick={() => dialog.current?.close()} aria-label={t('redesign.close')}><X/></button></div>
      <p>{selection && t(`redesign.${selection.dimension}`)}</p><div className="qp-detail-grid"><Metric label={t('redesign.tokens')} value={number(detail?.tokens ?? 0)}/><Metric label={t('redesign.sessions')} value={number(detail?.sessions ?? 0)}/><Metric label={t('redesign.calls')} value={number(detail?.callRecords ?? 0)}/><Metric label={t('redesign.aggregates')} value={number(detail?.aggregateRecords ?? 0)}/></div>
      <p className="qp-footnote">{t('redesign.coverage')}</p>
    </dialog>
  </RedesignShell>;
}

function Metric({ label, value, icon }: { label: string; value: React.ReactNode; icon?: React.ReactNode }) {
  return <div className="qp-metric" data-icon={icon ? true : undefined}>{icon && <i className="qp-metric-icon" aria-hidden="true">{icon}</i>}<span>{label}</span><strong>{value}</strong></div>;
}
