import { useEffect, useId, useRef, useState } from 'react';
import { Activity, ArrowUpRight, BarChart3, BellRing, Box, CircleGauge, GitBranch, Layers, MessagesSquare, Moon, Radio, Settings, Sun, X } from 'lucide-react';
import type { MessageKey } from '@/i18n/en';
import { defaultQuota, dimensions, groupUsage, quotaState, runtimeEdges, summarize, type Dimension, type QuotaWindow, type RuntimeGraph, type UsageNode, type UsageRecord } from './model';
import './overview.css';

type Translate = (key: Extract<MessageKey, `redesign.${string}`>) => string;
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
          {columns[index].map(node => <button className="qp-map-node" key={JSON.stringify(node.key)} onClick={() => onInspect(dimension, node.key)}><span>{node.key ?? t(dimension === 'project' ? 'redesign.unassigned' : 'redesign.unavailable')}</span><small>{new Intl.NumberFormat(undefined, { notation: 'compact' }).format(node.tokens)}</small></button>)}
        </div>)}
      </div>
    </div>}
    {dimensions.some(dimension => nodes[dimension].length > 8) && <p className="qp-footnote">{t('redesign.topNodes')}</p>}
  </section>;
}

export function Overview({ records = [], graph, quotas, now, t, language, onLanguage, theme: themeProp, onTheme, preview = false, currency = 'USD', rate = 1 }: OverviewProps) {
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
  useEffect(() => {
    if (selection && !dialog.current?.open) dialog.current?.showModal();
  }, [selection]);
  useEffect(() => {
    const node = shell.current;
    if (!node) return;
    let intersecting = true;
    const update = () => { node.dataset.paused = String(document.hidden || !intersecting); };
    const observer = new IntersectionObserver(([entry]) => { intersecting = entry.isIntersecting; update(); });
    observer.observe(node);
    document.addEventListener('visibilitychange', update);
    update();
    return () => { observer.disconnect(); document.removeEventListener('visibilitychange', update); };
  }, []);
  return <div ref={shell} className="qp-redesign" data-theme={theme} lang={language} data-testid={preview ? 'redesign-preview' : 'production-overview'}>
    <aside className="qp-sidebar">
      <a className="qp-brand" href="#overview" aria-label="QuotaPulse"><Activity/><span>QuotaPulse<small>MISSION CONTROL</small></span></a>
      <nav aria-label={t('redesign.overview')}>
        {preview ? <>
          <a href="#overview" className="qp-nav-active" aria-label={t('redesign.overview')}><CircleGauge/><span>{t('redesign.overview')}</span></a>
          <a href="#runtime" aria-label={t('redesign.runtime')}><GitBranch/><span>{t('redesign.runtime')}</span></a>
          <a href="#model-usage" aria-label={t('redesign.models')}><Layers/><span>{t('redesign.models')}</span></a>
        </> : [
          { href: '#overview', label: 'redesign.overview', icon: CircleGauge },
          { href: '#live', label: 'redesign.live', icon: Activity },
          { href: '#usage?view=projects', label: 'redesign.project', icon: Box },
          { href: '#sources', label: 'redesign.provider', icon: Radio },
          { href: '#usage?view=models', label: 'redesign.models', icon: Layers },
          { href: '#usage?view=cost', label: 'redesign.cost', icon: BarChart3 },
          { href: '#history', label: 'redesign.history', icon: MessagesSquare },
          { href: '#alerts', label: 'redesign.alerts', icon: BellRing },
          { href: '#settings', label: 'redesign.settings', icon: Settings },
        ].map(({ href, label, icon: Icon }) => <a key={href} href={href} aria-label={t(label as Extract<MessageKey, `redesign.${string}`>)} className={href === '#overview' ? 'qp-nav-active' : undefined}><Icon/><span>{t(label as Extract<MessageKey, `redesign.${string}`>)}</span></a>)}
      </nav>
      {preview && <a className="qp-exit" href="./#overview" aria-label={t('redesign.dashboard')}><ArrowUpRight/><span>{t('redesign.dashboard')}</span></a>}
    </aside>
    <div className="qp-workspace">
      <header className="qp-topbar"><span className="qp-preview-badge">{t(preview ? 'redesign.preview' : 'redesign.overview')}</span><div className="qp-tools"><button onClick={onLanguage} aria-label={t('redesign.language')}>{language === 'en' ? 'ไทย' : 'EN'}</button><button onClick={() => onTheme ? onTheme() : setLocalTheme(theme === 'dark' ? 'light' : 'dark')} aria-label={t('redesign.theme')}>{theme === 'dark' ? <Sun size={18}/> : <Moon size={18}/>}</button></div></header>
      <main id="overview">
        <div className="qp-page-heading"><h1>{t('redesign.title')}</h1><span className="qp-chip">{new Intl.DateTimeFormat(language === 'th' ? 'th-TH' : 'en-US', { dateStyle: 'medium' }).format(now)}</span></div>
        <div className="qp-hero-grid">
          <section className="qp-panel qp-hero">
            <div className="qp-section-heading"><h2><Activity size={18}/>{t('redesign.core')}</h2><span className="qp-status" data-risk={state?.risk ?? 'unknown'}>{t(riskLabel(state))}</span></div>
            <div className="qp-core-grid"><div className="qp-metrics">
              <Metric label={t('redesign.tokens')} value={number(totals.tokens)}/>
              <Metric label={t('redesign.sessions')} value={number(totals.sessions)}/>
              <Metric label={t('redesign.reported')} value={money(totals.reportedCost)}/>
              <Metric label={t('redesign.value')} value={money(totals.apiValue)}/>
            </div><PulseCore quota={quota} now={now} t={t}/><section className="qp-top-models" id="model-usage"><h3>{t('redesign.models')}</h3>{models.map(model => <button className="qp-model-row" key={String(model.key)} onClick={() => setSelection({ dimension: 'model', key: model.key })}><span>{model.key ?? t('redesign.unavailable')}</span><strong>{number(model.tokens)}</strong><span className="qp-bar"><span style={{ width: `${totals.tokens ? model.tokens / totals.tokens * 100 : 0}%` }}/></span></button>)}</section></div>
            <p className="qp-footnote">{t('redesign.scope')}</p>
          </section>
          <section className="qp-panel qp-quotas"><h2><CircleGauge size={18}/>{t('redesign.windows')}</h2>
            {quotas.length === 0 && <p className="qp-footnote">{t('redesign.unavailable')}</p>}
            {quotas.map(item => { const reading = quotaState(item, now, preview ? 300000 : 3600000); return <button className="qp-quota" key={item.id} aria-pressed={quota?.id === item.id} onClick={() => setQuotaId(item.id)}>
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
          <section className="qp-panel"><h2><Box size={18}/>{t('redesign.detail')}</h2><div className="qp-coverage"><Metric label={t('redesign.calls')} value={number(totals.callRecords)}/><Metric label={t('redesign.aggregates')} value={number(totals.aggregateRecords)}/><Metric label={t('redesign.unknown')} value={number(totals.unknownCostRecords)}/></div><p className="qp-footnote">{t('redesign.coverage')}</p></section>
        </div>
      </main>
    </div>
    <dialog ref={dialog} className="qp-dialog" aria-labelledby="qp-detail-title" onClose={() => setSelection(null)}>
      <div className="qp-section-heading"><h2 id="qp-detail-title">{selection?.key ?? t(selection?.dimension === 'project' ? 'redesign.unassigned' : 'redesign.unavailable')}</h2><button autoFocus onClick={() => dialog.current?.close()} aria-label={t('redesign.close')}><X/></button></div>
      <p>{selection && t(`redesign.${selection.dimension}`)}</p><div className="qp-detail-grid"><Metric label={t('redesign.tokens')} value={number(detail?.tokens ?? 0)}/><Metric label={t('redesign.sessions')} value={number(detail?.sessions ?? 0)}/><Metric label={t('redesign.calls')} value={number(detail?.callRecords ?? 0)}/><Metric label={t('redesign.aggregates')} value={number(detail?.aggregateRecords ?? 0)}/></div>
      <p className="qp-footnote">{t('redesign.coverage')}</p>
    </dialog>
  </div>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="qp-metric"><span>{label}</span><strong>{value}</strong></div>;
}
