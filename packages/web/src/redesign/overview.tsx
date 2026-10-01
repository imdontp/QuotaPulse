import { useEffect, useId, useRef, useState } from 'react';
import { Activity, ArrowUpRight, Box, CircleGauge, GitBranch, X } from 'lucide-react';
import type { QuotaHistoryResponse } from '@/api';
import { defaultQuota, dimensions, groupUsage, quotaState, runtimeEdges, runwayState, summarize, type Dimension, type QuotaWindow, type RuntimeGraph, type UsageNode, type UsageRecord } from './model';
import { RedesignShell, type RedesignTranslate } from './shell';

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
  historyHref?: string;
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

function PulseCore({ quota, now, t }: { quota: QuotaWindow | undefined; now: number; t: Translate }) {
  const id = useId().replace(/:/g, '');
  const state = quota ? quotaState(quota, now, 300000) : null;
  const remaining = state?.remaining ?? null;
  return <div className="qp-pulse" data-stale={!state || state.stale}>
    <svg viewBox="0 0 360 320" aria-hidden="true">
      <defs>
        <radialGradient id={`${id}-fill`}><stop stopColor="#225575" stopOpacity=".7"/><stop offset=".75" stopColor="#071f43" stopOpacity=".5"/><stop offset="1" stopColor="#32cdff" stopOpacity=".2"/></radialGradient>
        <linearGradient id={`${id}-arc`}><stop stopColor="#26dcff"/><stop offset=".55" stopColor="#367aff"/><stop offset="1" stopColor="#a26aff"/></linearGradient>
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
      <g fill="#48b7ff" opacity=".4">
        {Array.from({ length: 400 }, (_, index) => {
          const angle = index * 2.399963;
          const radius = 114 * Math.sqrt((index + .5) / 400);
          return <circle key={index} cx={180 + Math.cos(angle) * radius} cy={160 + Math.sin(angle) * radius} r={index % 7 === 0 ? 1.1 : .55}/>;
        })}
      </g>
      <g fill="none" stroke="#59c3fa" strokeOpacity=".16">
        {[34, 69, 98].map(rx => <ellipse key={rx} cx="180" cy="160" rx={rx} ry="116"/>)}
        {[38, 76].map(ry => <ellipse key={ry} cx="180" cy="160" rx="116" ry={ry}/>)}
      </g>
      <circle cx="180" cy="160" r="129" fill="none" stroke="#395175" strokeOpacity=".45" strokeWidth="5"/>
      <circle className="qp-core-halo" cx="180" cy="160" r="120" fill="none" stroke={`url(#${id}-arc)`} strokeWidth="2"/>
      {remaining !== null && <circle cx="180" cy="160" r="129" pathLength="100" fill="none" stroke={`url(#${id}-arc)`} strokeWidth="5" strokeLinecap="round" strokeDasharray={`${remaining} 100`} transform="rotate(-90 180 160)"/>}
    </svg>
    <div className="qp-pulse-label"><span>{quota?.owner ?? '—'} · {quota?.window ?? '—'}</span><strong>{remaining === null ? '—' : `${remaining}%`}</strong><span>{t('redesign.remaining')}</span></div>
  </div>;
}

function RuntimeMap({ nodes, edges, recordCount, t, onInspect }: { nodes: RuntimeGraph['nodes']; edges: RuntimeGraph['edges']; recordCount: number; t: Translate; onInspect: (dimension: Dimension, key: string | null) => void }) {
  const columns = dimensions.map(dimension => nodes[dimension].slice(0, 8));
  const maxRows = Math.max(1, ...columns.map(column => column.length));
  const height = maxRows * 40;
  return <section className="qp-panel qp-runtime" id="runtime">
    <div className="qp-section-heading"><div><h2><GitBranch size={18}/>{t('redesign.runtime')}</h2><p>{t('redesign.connections')}</p></div><span className="qp-chip">{t('redesign.records')} · {recordCount}</span></div>
    {recordCount === 0 ? <p>{t('redesign.empty')}</p> : <div className="qp-map-scroll" tabIndex={0} aria-label={t('redesign.runtime')}>
      <div className="qp-map" style={{ height: height + 24 }}>
        <svg className="qp-map-edges" viewBox={`0 0 1000 ${height}`} preserveAspectRatio="none" aria-hidden="true">
          {edges.filter(edge => columns[edge.column].some(node => node.key === edge.from) && columns[edge.column + 1].some(node => node.key === edge.to)).map(edge => {
            const fromIndex = columns[edge.column].findIndex(node => node.key === edge.from);
            const toIndex = columns[edge.column + 1].findIndex(node => node.key === edge.to);
            const x = edge.column * 250 + 195;
            const y = fromIndex * 40 + 17;
            const endY = toIndex * 40 + 17;
            return <path key={JSON.stringify([edge.column, edge.from, edge.to])} d={`M ${x} ${y} C ${x + 45} ${y}, ${x + 10} ${endY}, ${x + 55} ${endY}`} fill="none" stroke="currentColor" strokeWidth="2"/>;
          })}
        </svg>
        {dimensions.map((dimension, index) => <div className="qp-map-column" key={dimension}>
          <h3>{t(`redesign.${dimension}`)}</h3>
          {columns[index].map(node => <button className="qp-map-node" key={JSON.stringify(node.key)} onClick={() => onInspect(dimension, node.key)}><span>{node.key ?? t(dimension === 'project' ? 'redesign.unassigned' : 'redesign.unknownValue')}</span><small>{new Intl.NumberFormat(undefined, { notation: 'compact' }).format(node.tokens)}</small></button>)}
        </div>)}
      </div>
    </div>}
    {dimensions.some(dimension => nodes[dimension].length > 8) && <p className="qp-footnote">{t('redesign.topNodes')}</p>}
  </section>;
}

function QuotaRunway({ quota, now, t, language, preview, history, historyError }: { quota: QuotaWindow | undefined; now: number; t: Translate; language: 'en' | 'th'; preview: boolean; history?: QuotaHistoryResponse | null; historyError?: boolean }) {
  const runway = runwayState(quota, now, preview ? 300000 : 3600000);
  const decimal = (value: number) => new Intl.NumberFormat(language === 'th' ? 'th-TH' : 'en-US', { maximumFractionDigits: 1 }).format(value);
  const date = (value: number) => new Intl.DateTimeFormat(language === 'th' ? 'th-TH' : 'en-US', { dateStyle: 'short', timeStyle: 'short' }).format(value);
  const reason = runway.status === 'unavailable' ? ({ noQuota: 'redesign.runwayNoQuota', stale: 'redesign.runwayStale', noReset: 'redesign.runwayNoReset', reset: 'redesign.runwayReset', unknown: 'redesign.runwayUnknown' } as const)[runway.reason] : null;
  const forecast = runway.status === 'ready' ? runway.projectedBeforeReset && runway.projectedFullAt !== null
    ? `${t('redesign.projected')} ${date(runway.projectedFullAt)} · ${t('redesign.beforeReset')}`
    : runway.projectedFullAt !== null ? t('redesign.afterReset')
      : t(runway.forecastStatus === 'flat' ? 'redesign.forecastFlat' : runway.forecastStatus === 'reset' ? 'redesign.forecastReset' : 'redesign.forecastInsufficient') : null;
  const marker = runway.status === 'ready' && runway.projectedBeforeReset && runway.projectedFullAt !== null
    ? (runway.projectedFullAt - now) / (quota!.resetAt - now) * 100 : null;
  return <section className="qp-panel qp-runway" data-testid="quota-runway">
    <h2><CircleGauge size={18}/>{t('redesign.runway')}</h2>
    <p className="qp-footnote">{quota ? `${quota.owner} · ${quota.window}` : t('redesign.unavailable')}</p>
    {runway.status === 'unavailable' ? <p className="qp-runway-message" role="status">{t(reason!)}</p> : <>
      <div className="qp-runway-labels"><span>{t('redesign.now')}</span><span>{t('redesign.resetIn')} {decimal(runway.hoursUntilReset)} {t('redesign.hours')}</span></div>
      <div className="qp-runway-track" role="img" aria-label={forecast ?? t('redesign.runway')}>
        {marker !== null && <span className="qp-runway-marker" style={{ left: `${marker}%` }}/>}</div>
      <div className="qp-runway-stats"><span>{t('redesign.safePace')} <strong>{decimal(runway.safePace)}</strong> {t('redesign.pointsPerHour')}</span></div>
      <p className="qp-footnote">{forecast}</p>
    </>}
    {!preview && <details className="qp-quota-history" data-testid="quota-history">
      <summary>{t('redesign.observedHistory')}</summary>
      {history?.reader && history.segments.length > 0 ? <>
        <div className="qp-history-segments">{history.segments.slice(-3).map((segment, index) => <ol key={`${segment.resetAt}-${index}`} aria-label={`${t('redesign.resetPeriods')} ${index + 1}`}>
          {segment.samples.slice(-8).map(sample => <li key={sample.observedAt} title={`${date(sample.observedAt)} · ${sample.usedPercent ?? '—'}%`} aria-label={`${date(sample.observedAt)} · ${sample.usedPercent ?? '—'}%`} style={{ height: `${Math.max(4, Math.min(100, sample.usedPercent ?? 0))}%` }}/>)}</ol>)}</div>
        <p className="qp-footnote">{history.reader.origin} · {history.segments.length} {t('redesign.resetPeriods')} · {history.segments.reduce((sum, segment) => sum + segment.samples.length, 0)} {t('redesign.readings')}</p>
      </> : <p className="qp-footnote">{historyError ? t('redesign.historyUnavailable') : history || !quota ? t('redesign.noHistory') : t('redesign.historyLoading')}</p>}
    </details>}
  </section>;
}

export function Overview({ records = [], graph, quotas, now, t, language, onLanguage, theme: themeProp, onTheme, preview = false, currency = 'USD', rate = 1, onQuotaSelect, quotaHistory, quotaHistoryError, recent, period, historyHref = '#history?range=today' }: OverviewProps) {
  const [localTheme, setLocalTheme] = useState<'dark' | 'light'>('dark');
  const theme = themeProp ?? localTheme;
  const [quotaId, setQuotaId] = useState<string | null>(null);
  const [selection, setSelection] = useState<{ dimension: Dimension; key: string | null } | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const shell = useRef<HTMLDivElement>(null);
  const quota = (quotaId && quotas.find(item => item.id === quotaId)) || defaultQuota(quotas, now, preview ? 300000 : 3600000);
  const totals = graph?.totals ?? { ...summarize(records), records: records.length };
  const nodes: RuntimeGraph['nodes'] = graph?.nodes ?? Object.fromEntries(dimensions.map(dimension => [dimension, groupUsage(records, dimension)])) as RuntimeGraph['nodes'];
  const edges = graph?.edges ?? runtimeEdges(records);
  const models = nodes.model;
  const state = quota ? quotaState(quota, now, preview ? 300000 : 3600000) : null;
  const detail: UsageNode | null = selection ? nodes[selection.dimension].find(node => node.key === selection.key) ?? null : null;
  const number = (value: number) => new Intl.NumberFormat(language === 'th' ? 'th-TH' : 'en-US', { maximumFractionDigits: 0 }).format(value);
  const money = (value: number) => new Intl.NumberFormat(language === 'th' ? 'th-TH' : 'en-US', { style: 'currency', currency }).format(currency === 'THB' ? value * rate : value);
  const coverage = graph?.totals;
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
            <div className="qp-section-heading"><h2><Activity size={18}/>{t('redesign.core')}</h2>{period && <span className="qp-chip">{period}</span>}<span className="qp-status" data-risk={state?.risk ?? 'unknown'}>{t(riskLabel(state))}</span></div>
            <div className="qp-core-grid"><div className="qp-metrics">
              <Metric label={t('redesign.tokens')} value={number(totals.tokens)}/>
              <Metric label={t('redesign.sessions')} value={number(totals.sessions)}/>
              <Metric label={t('redesign.reported')} value={money(totals.reportedCost)}/>
              <Metric label={t('redesign.value')} value={money(totals.apiValue)}/>
            </div><PulseCore quota={quota} now={now} t={t}/><section className="qp-top-models" id="model-usage"><h3>{t('redesign.models')}</h3>{models.map(model => <button className="qp-model-row" key={String(model.key)} onClick={() => setSelection({ dimension: 'model', key: model.key })}><span>{model.key ?? t('redesign.unknownValue')}</span><strong>{number(model.tokens)}</strong><span className="qp-bar"><span style={{ width: `${totals.tokens ? model.tokens / totals.tokens * 100 : 0}%` }}/></span></button>)}</section></div>
            <p className="qp-footnote">{t('redesign.scope')}</p>
          </section>
          <section className="qp-panel qp-quotas"><h2><CircleGauge size={18}/>{t('redesign.windows')}</h2>
            {quotas.length === 0 && <p className="qp-footnote">{t('redesign.unavailable')}</p>}
            {quotas.map(item => { const reading = quotaState(item, now, preview ? 300000 : 3600000); return <button className="qp-quota" key={item.id} aria-pressed={quota?.id === item.id} onClick={() => { setQuotaId(item.id); onQuotaSelect?.(item.id); }}>
              <span className="qp-quota-heading"><strong>{item.owner}</strong><span>{item.window}</span></span>
              <span className="qp-quota-number">{reading.remaining === null ? '—' : `${reading.remaining}%`} <small>{t('redesign.remaining')}</small></span>
              <span className="qp-bar"><span style={{ width: `${reading.remaining ?? 0}%` }}/></span>
              <small>{t('redesign.reset')} · {Number.isFinite(item.resetAt) && item.resetAt > 0 ? new Date(item.resetAt).toISOString().slice(5, 16).replace('T', ' ') : '—'}</small>
              <span className="qp-status" data-risk={reading.risk}>{t(riskLabel(reading))}</span>
            </button>; })}
          </section>
        </div>
        <RuntimeMap nodes={nodes} edges={edges} recordCount={totals.records} t={t} onInspect={(dimension, key) => setSelection({ dimension, key })}/>
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
            const content = <><strong>{item.harness}<time dateTime={new Date(item.timestamp).toISOString()}>{new Intl.DateTimeFormat(language === 'th' ? 'th-TH' : 'en-US', { hour: '2-digit', minute: '2-digit' }).format(item.timestamp)}</time></strong><span>{item.provider ?? t('redesign.unknownValue')} · {item.model ?? t('redesign.unknownValue')}</span><small>{number(item.tokens)} {t('redesign.tokens')} · {t(item.grain === 'call' ? 'redesign.callRecord' : 'redesign.aggregateUpdate')}</small></>;
            return preview ? <div className="qp-activity-item" key={item.id}>{content}</div>
              : <a className="qp-activity-item" key={item.id} href={item.sessionKey !== null ? `#history?range=all&session_id=${item.sessionKey}` : '#history?range=today'} aria-label={`${item.harness} · ${item.model ?? t('redesign.unknownValue')} · ${t('redesign.openHistory')}`}>{content}</a>;
          })}</div>}
          <p className="qp-footnote">{t('redesign.activityCaveat')}</p>
        </section>
    <dialog ref={dialog} className="qp-dialog" aria-labelledby="qp-detail-title" onClose={() => setSelection(null)}>
      <div className="qp-section-heading"><h2 id="qp-detail-title">{selection?.key ?? t(selection?.dimension === 'project' ? 'redesign.unassigned' : 'redesign.unknownValue')}</h2><button autoFocus onClick={() => dialog.current?.close()} aria-label={t('redesign.close')}><X/></button></div>
      <p>{selection && t(`redesign.${selection.dimension}`)}</p><div className="qp-detail-grid"><Metric label={t('redesign.tokens')} value={number(detail?.tokens ?? 0)}/><Metric label={t('redesign.sessions')} value={number(detail?.sessions ?? 0)}/><Metric label={t('redesign.calls')} value={number(detail?.callRecords ?? 0)}/><Metric label={t('redesign.aggregates')} value={number(detail?.aggregateRecords ?? 0)}/></div>
      <p className="qp-footnote">{t('redesign.coverage')}</p>
    </dialog>
  </RedesignShell>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="qp-metric"><span>{label}</span><strong>{value}</strong></div>;
}
