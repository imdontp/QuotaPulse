import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Activity, ArrowRight, ArrowUpRight, Box, CircleGauge, Coins, Flame, Folder, GitBranch, History, Layers, Star, Wallet, X } from 'lucide-react';
import { VendorIcon } from '@/components/vendor-icon';
import { HarnessIcon } from '@/components/harness-icon';
import { countdown } from '@/format';
import type { AccountState, CompareResult, MinuteTrendResponse, QuotaHistoryResponse, UsageResponse } from '@/api';
import { CostValue, recordCostCoverage } from './cost-value';
import { defaultQuota, dimensions, groupUsage, quotaState, RUNTIME_ACTIVITY_WINDOW_MS, runtimeActivityState, runtimeEdges, runwayState, summarize, type Dimension, type QuotaWindow, type RuntimeGraph, type UsageNode, type UsageRecord } from './model';
import { averageDailyTokenPace, cacheShareTrendSeries, metricTrendSeries } from './metric-series';
import { cacheSharePercent, paceAboveSafePercent, percentagePointChange, recommendationKind, relativeChangePercent, supportedForecastPace } from './insight-model';
import { RedesignShell, type RedesignTranslate } from './shell';
import { QuotaChart } from './quota-chart';
import { RuntimeData } from './runtime-data';
import { ActivitySparkline } from './activity-sparkline';
import { PulseAmbient } from './pulse-ambient';
import { activityMinutePoints, activityTokensPerMinute } from './activity-trend';

type Translate = RedesignTranslate;
function ModelMark({ node, size }: { node: Pick<UsageNode, 'key' | 'vendor'>; size: number }) {
  return node.key && node.vendor && node.vendor !== 'unknown'
    ? <span className="qp-model-mark" style={{ fontSize: size }}><VendorIcon vendor={node.vendor}/></span>
    : <Box size={size}/>;
}
const runtimeNodeNames = {
  harness: { hermes: 'Hermes Agent', codex: 'Codex CLI', 'claude-code': 'Claude Code', opencode: 'OpenCode' },
  provider: { deepseek: 'DeepSeek', openai: 'OpenAI', anthropic: 'Anthropic', openrouter: 'OpenRouter' },
} as const;
const runtimeHeadingKeys = {
  project: 'redesign.runtimeProjectHeading',
  harness: 'redesign.runtimeHarnessHeading',
  provider: 'redesign.runtimeProviderHeading',
  model: 'redesign.runtimeModelHeading',
} as const;
function runtimeNodeLabel(dimension: Dimension, key: string | null, fallback: string) {
  if (!key || dimension === 'project' || dimension === 'model') return fallback;
  const normalized = key.trim().toLowerCase();
  return (runtimeNodeNames[dimension as 'harness' | 'provider'] as Record<string, string>)[normalized] ?? key;
}
const riskLabel = (state: ReturnType<typeof quotaState> | null) =>
  !state ? 'redesign.unavailable' : state.stale ? 'redesign.stale' : state.risk === 'unknown' ? 'redesign.unavailable' : `redesign.${state.risk}` as const;
const accountStateMessage = (state: AccountState | undefined) => state ? ({ active: 'redesign.providerActive', stale: 'redesign.providerStale', inactive: 'redesign.providerInactive', unavailable: 'redesign.providerUnavailable', waiting: 'redesign.providerWaiting' } as const)[state] : 'redesign.providerFreshUnknown';
const quotaWindowLabel = (window: string, t: Translate) => window === '5h' ? t('redesign.windowQuota5h')
  : window === 'weekly' ? t('redesign.windowQuotaWeekly')
    : window === 'monthly' ? t('redesign.windowQuotaMonthly')
      : window === 'daily' ? t('redesign.windowQuotaDaily') : window;
const quotaDuration = (at: number | null, now: number, unknown: string) => at === null ? unknown : at - now < 60_000 ? '<1m' : countdown(at, now);
interface OverviewProps {
  records?: readonly UsageRecord[];
  graph?: RuntimeGraph;
  runtimeGraph?: RuntimeGraph;
  quotas: readonly QuotaWindow[];
  quotaAccountStates?: Readonly<Record<string, AccountState>>;
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
  metricUsage?: Pick<UsageResponse, 'range' | 'timeline' | 'totals'> | null;
  metricComparison?: CompareResult | null;
  recent?: readonly ActivityItem[];
  activityTrend?: MinuteTrendResponse | null;
  period?: string;
  periodControl?: ReactNode;
  selectedQuotaId?: string | null;
  historyHref?: string;
  harnessVendors?: Readonly<Record<string, string>>;
  runtimeProjects?: readonly string[];
  selectedRuntimeProject?: string | null;
  onRuntimeProjectChange?: (project: string | null) => void;
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
  trend?: MinuteTrendResponse;
  trendError?: boolean;
  sourceName?: string;
}

function ActivityTrend({ item, language }: { item: ActivityItem; language: 'en' | 'th' }) {
  const th = language === 'th';
  const points = item.trend ? activityMinutePoints(item.trend) : [];
  const label = th ? 'โทเค็นจาก call ที่บันทึก / นาที' : 'Recorded call tokens / minute';
  const locale = th ? 'th-TH' : 'en-US';
  const range = item.trend ? `${new Date(item.trend.from).toLocaleString(locale)} – ${new Date(item.trend.to).toLocaleString(locale)}` : '';
  const title = `${label} · ${item.sourceName ?? item.harness} → ${item.provider ?? '—'} / ${item.model ?? '—'} · ${range} · ${th ? 'เฉพาะ source นี้; นาทีต้นและปลายอาจไม่เต็มนาที' : 'This source only; boundary minutes may be partial'}`;
  return <div className="qp-activity-trend" data-testid="activity-minute-trend" title={title}>
    {item.trend && item.trend.coverage.includedRecords > 0 && points.length > 0
      ? <ActivitySparkline points={points} label={title} language={language}/>
      : <small>{item.grain === 'session_aggregate' ? (th ? 'ยอดสะสม · ไม่มีเวลาเรียกใช้รายครั้ง' : 'Aggregate total · no per-call timeline') : item.trendError ? (th ? 'ข้อมูลรายนาทีไม่พร้อมใช้งาน' : 'Minute data unavailable') : (th ? 'ไม่มีข้อมูล call รายนาทีในช่วงนี้' : 'No minute call data in this interval')}</small>}
  </div>;
}

function PulseCore({ quota, now, t, language, staleAfterMs, tokens, period }: { quota: QuotaWindow | undefined; now: number; t: Translate; language: 'en' | 'th'; staleAfterMs: number; tokens: number; period: string }) {
  const id = useId().replace(/:/g, '');
  const state = quota ? quotaState(quota, now, staleAfterMs) : null;
  const used = state?.remaining == null ? null : quota?.usedPercent ?? null;
  const runway = runwayState(quota, now, staleAfterMs);
  const projectedAt = runway.status === 'ready' ? runway.projectedFullAt : null;
  const resetAt = runway.status === 'ready' ? quota!.resetAt : null;
  const duration = (at: number | null) => quotaDuration(at, now, t('redesign.unknownValue'));
  const exact = (at: number | null) => at === null ? t('redesign.unavailable') : new Intl.DateTimeFormat(language === 'th' ? 'th-TH' : 'en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(at);
  const tokenTotal = new Intl.NumberFormat(language === 'th' ? 'th-TH' : 'en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(tokens);
  return <div className="qp-pulse" data-stale={!state || state.stale}>
    <PulseAmbient/>
    <svg className="qp-pulse-art" viewBox="0 0 360 320" aria-hidden="true">
      <defs>
        <radialGradient id={`${id}-fill`}><stop stopColor="#225575" stopOpacity=".7"/><stop offset=".75" stopColor="#071f43" stopOpacity=".5"/><stop offset="1" stopColor="#32cdff" stopOpacity=".2"/></radialGradient>
        <linearGradient id={`${id}-arc`}><stop stopColor="#26dcff"/><stop offset=".55" stopColor="#367aff"/><stop offset="1" stopColor="#a26aff"/></linearGradient>
        <filter id={`${id}-glow`} x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="3"/><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        <clipPath id={`${id}-world`}><circle cx="180" cy="160" r="114"/></clipPath>
      </defs>
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
      {used !== null && <circle className="qp-core-progress" data-testid="pulse-progress" cx="180" cy="160" r="129" pathLength="100" fill="none" stroke={`url(#${id}-arc)`} strokeWidth="8" strokeLinecap={used === 0 ? 'butt' : 'round'} strokeDasharray={`${Math.min(100, used)} 100`} transform="rotate(-90 180 160)" filter={`url(#${id}-glow)`}/>}
    </svg>
    <div className="qp-pulse-label"><strong>{used === null ? '—' : `${used}%`}</strong><span className="qp-pulse-state">{t(quota?.window === 'monthly' ? 'redesign.monthlyUsed' : 'redesign.quotaUsed')}</span><span>{tokenTotal} {t('redesign.tokens')} · {period}</span></div>
    <div className="qp-pulse-runway" data-testid="pulse-runway" data-projected-at={projectedAt ?? undefined} data-reset-at={resetAt ?? undefined}>
      <span>{t('redesign.runwayShort')} <strong title={exact(projectedAt)}>{duration(projectedAt)}</strong></span>
      <span>{t('redesign.resetShort')} <strong title={exact(resetAt)}>{duration(resetAt)}</strong></span>
    </div>
  </div>;
}

function RuntimeMap({ nodes, edges, recordCount, now, activityWindowMs, t, language, harnessVendors, onInspect, projects, selectedProject, onProjectChange }: { nodes: RuntimeGraph['nodes']; edges: RuntimeGraph['edges']; recordCount: number; now: number; activityWindowMs: number; harnessVendors: Readonly<Record<string, string>>; t: Translate; language: 'en' | 'th'; onInspect: (dimension: Dimension, key: string | null) => void; projects?: readonly string[]; selectedProject?: string | null; onProjectChange?: (project: string | null) => void }) {
  const arrowId = useId();
  const map = useRef<HTMLDivElement>(null);
  const [geometry, setGeometry] = useState<{ width: number; height: number; paths: Array<{ edge: RuntimeGraph['edges'][number]; x: number; y: number; endX: number; endY: number }> }>({ width: 1, height: 1, paths: [] });
  const modelTokens = nodes.model.reduce((total, node) => total + node.tokens, 0);
  const locale = language === 'th' ? 'th-TH' : 'en-US';
  const number = new Intl.NumberFormat(locale);
  const percent = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
  const columns = dimensions.map(dimension => nodes[dimension].slice(0, 8));
  const columnTokenTotals = dimensions.slice(0, 3).map(dimension => nodes[dimension].reduce((total, node) => total + node.tokens, 0));
  const maxRows = Math.max(1, ...columns.map(column => column.length));
  const height = maxRows * 43;
  const singleProject = columns[0].length === 1 && maxRows >= 3;
  const flowPaths = dimensions.slice(0, 3).flatMap((_, column) => geometry.paths
    .filter(path => path.edge.column === column && runtimeActivityState(path.edge.lastActivityAt, now, activityWindowMs) === 'active')
    .sort((a, b) => b.edge.tokens - a.edge.tokens || JSON.stringify([a.edge.from, a.edge.to]).localeCompare(JSON.stringify([b.edge.from, b.edge.to])))
    .slice(0, 2)
    .map(({ edge, x, y, endX, endY }) => {
      const bend = (endX - x) * .55, t = .58, u = 1 - t;
      return { edge, x: u ** 3 * x + 3 * u ** 2 * t * (x + bend) + 3 * u * t ** 2 * (endX - bend) + t ** 3 * endX,
        y: u ** 3 * y + 3 * u ** 2 * t * y + 3 * u * t ** 2 * endY + t ** 3 * endY };
    }));
  const projectFilter = onProjectChange && (projects?.length ?? 0) > 1 && <label className="qp-runtime-project"><span className="qp-visually-hidden">{t('redesign.runtimeProject')}</span><select aria-label={t('redesign.runtimeProject')} value={selectedProject ?? ''} onChange={event => onProjectChange(event.currentTarget.value || null)}><option value="">{t('redesign.allProjects')}</option>{projects!.map(project => <option key={project} value={project}>{project}</option>)}</select></label>;
  useLayoutEffect(() => {
    const element = map.current;
    if (!element) { setGeometry(previous => previous.paths.length ? { width: 1, height: 1, paths: [] } : previous); return; }
    const svg = element.querySelector<SVGSVGElement>('.qp-map-edges')!;
    const measure = () => {
      const viewport = svg.getBoundingClientRect();
      if (!viewport.width || !viewport.height) return;
      const bounds = new Map(Array.from(element.querySelectorAll<HTMLElement>('.qp-map-node'), node => [`${node.dataset.dimension}:${node.dataset.key}`, node.getBoundingClientRect()]));
      const paths = edges.flatMap(edge => {
        const from = bounds.get(`${dimensions[edge.column]}:${JSON.stringify(edge.from)}`);
        const to = bounds.get(`${dimensions[edge.column + 1]}:${JSON.stringify(edge.to)}`);
        return from && to ? [{ edge, x: from.right - viewport.left, y: from.top + from.height / 2 - viewport.top, endX: to.left - viewport.left, endY: to.top + to.height / 2 - viewport.top }] : [];
      });
      const next = { width: viewport.width, height: viewport.height, paths };
      setGeometry(previous => JSON.stringify(previous) === JSON.stringify(next) ? previous : next);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element); observer.observe(svg);
    element.querySelectorAll('.qp-map-node').forEach(node => observer.observe(node));
    return () => observer.disconnect();
  }, [nodes, edges, recordCount, height, singleProject]);
  return <section className="qp-panel qp-runtime" id="runtime">
    <div className="qp-section-heading">
      <div className="qp-runtime-heading-main">
        <h2><GitBranch size={18}/>{t('redesign.liveRuntimeMap')}</h2>
        <p>{t('redesign.connections')}</p>
        {projectFilter}
        {recordCount > 0 && <RuntimeData nodes={nodes} edges={edges} recordCount={recordCount} language={language} t={t} onInspect={onInspect}/>}
      </div>
      <div className="qp-runtime-controls">
        <span className="qp-runtime-legend"><i aria-hidden="true"/>{t('redesign.tokenFlow')}</span>
        <span className="qp-runtime-activity-legend" title={t('redesign.runtimeActivityNote')} aria-label={`${t('redesign.runtimeActivityActive')}, ${t('redesign.runtimeActivityIdle')}. ${t('redesign.runtimeActivityNote')}`}>
          <span data-state="active"><i aria-hidden="true"/>{t('redesign.runtimeActivityActive')}</span>
          <span data-state="idle"><i aria-hidden="true"/>{t('redesign.runtimeActivityIdle')}</span>
        </span>
      </div>
    </div>

    {recordCount === 0 ? <p>{t('redesign.empty')}</p> : <div className="qp-map-scroll" tabIndex={0} aria-label={t('redesign.runtime')}>
      <div ref={map} className="qp-map" data-single-project={singleProject} style={{ height: height + 24 }}>
        <svg className="qp-map-edges" viewBox={`0 0 ${geometry.width} ${geometry.height}`} preserveAspectRatio="none" aria-hidden="true">
          <defs><marker id={arrowId} viewBox="0 0 8 8" refX="8" refY="4" markerWidth="5" markerHeight="5" orient="auto" markerUnits="strokeWidth"><polygon points="0,0 8,4 0,8 2,4" fill="context-stroke"/></marker></defs>
          {geometry.paths.map(({ edge, x, y, endX, endY }) => {
            const bend = (endX - x) * .55;
            const total = columnTokenTotals[edge.column] ?? 0;
            const strokeWidth = total > 0 ? Math.max(1.4, Math.min(5.5, 1.4 + edge.tokens / total * 9)) : 1.4;
            const activityState = runtimeActivityState(edge.lastActivityAt, now, activityWindowMs);
            return <path data-column={edge.column} data-from={JSON.stringify(edge.from)} data-to={JSON.stringify(edge.to)} data-tokens={edge.tokens} data-last-activity-at={edge.lastActivityAt ?? undefined} data-active-sessions={edge.activeSessions} data-activity-state={activityState} key={JSON.stringify([edge.column, edge.from, edge.to])} d={`M ${x} ${y} C ${x + bend} ${y}, ${endX - bend} ${endY}, ${endX} ${endY}`} fill="none" stroke="currentColor" strokeWidth={strokeWidth} markerEnd={`url(#${arrowId})`}/>;
          })}
          {flowPaths.map(({ edge, x, y }) => <circle className="qp-map-flow-dot" data-column={edge.column} data-from={JSON.stringify(edge.from)} data-to={JSON.stringify(edge.to)} data-tokens={edge.tokens} data-activity-state="active" key={JSON.stringify([edge.column, edge.from, edge.to])} cx={x} cy={y} r="2.8"/>)}
        </svg>
        {dimensions.map((dimension, index) => <div className="qp-map-column" data-dimension={dimension} key={dimension}>
          <h3>{singleProject && dimension === 'project' ? <span className="qp-visually-hidden">{t(runtimeHeadingKeys.project)}</span> : t(runtimeHeadingKeys[dimension])}</h3>
          {columns[index].map(node => {
            const label = runtimeNodeLabel(dimension, node.key, node.key ?? t(dimension === 'project' ? 'redesign.unassigned' : 'redesign.unknownValue'));
            const share = dimension === 'model' && modelTokens > 0 ? node.tokens / modelTokens * 100 : null;
            const activityState = runtimeActivityState(node.lastActivityAt, now, activityWindowMs);
            const activityKey = activityState === 'active' ? 'redesign.runtimeActivityActive' : activityState === 'idle' ? 'redesign.runtimeActivityIdle' : 'redesign.runtimeActivityUnknown';
            const activityLabel = t(activityKey);
            const activeSessions = typeof node.activeSessions === 'number' && Number.isFinite(node.activeSessions) ? node.activeSessions : null;
            const sessionValue = dimension === 'project' && activeSessions !== null ? activeSessions : node.sessions;
            const sessionLabel = dimension === 'project' && activeSessions !== null ? 'redesign.runtimeNodeActiveSessions' : 'redesign.runtimeNodeSessions';
            const exact = `${label} · ${number.format(node.tokens)} ${t('redesign.tokens')} · ${number.format(sessionValue)} ${t(sessionLabel)}${dimension === 'provider' ? ` · ${activityLabel}. ${t('redesign.runtimeActivityNote')}` : ''}`;
            const nodeStyle = dimension === 'project' && singleProject ? { height: 80, marginTop: Math.max(0, (Math.min(4, maxRows) * 43 - 80) / 2 - 8) } : undefined;
            return <button className="qp-map-node" style={nodeStyle} data-dimension={dimension} data-runtime-name={node.key?.trim().toLowerCase() ?? undefined} data-key={JSON.stringify(node.key)} data-tokens={node.tokens} data-sessions={node.sessions} data-active-sessions={activeSessions ?? undefined} data-last-activity-at={node.lastActivityAt ?? undefined} data-activity-state={activityState} data-total={dimension === 'model' ? modelTokens : undefined} key={JSON.stringify(node.key)} title={exact} aria-label={share === null ? exact : `${exact} · ${percent.format(share)}%`} onClick={() => onInspect(dimension, node.key)}><span className="qp-node-icon" data-model-vendor={dimension === 'model' && node.key ? node.vendor : undefined} aria-hidden="true">{dimension === 'harness' ? <HarnessIcon harness={node.key ?? ''} vendor={harnessVendors[node.key ?? '']} label={node.key ?? undefined}/> : dimension === 'provider' ? <VendorIcon vendor={node.key ?? 'unknown'}/> : dimension === 'project' ? <Folder size={15}/> : <ModelMark node={node} size={15}/>}</span><span className="qp-node-label">{dimension === 'project' && singleProject && <small className="qp-node-kicker">{language === 'th' ? 'โปรเจกต์' : 'Project'}</small>}<span className="qp-node-label-main">{label}</span>{dimension === 'provider' ? <small className="qp-node-activity" data-testid="runtime-node-activity" data-state={activityState} title={t('redesign.runtimeActivityNote')}><i aria-hidden="true"/>{activityLabel}</small> : dimension !== 'model' && <small className="qp-node-meta" data-testid="runtime-node-sessions">{number.format(sessionValue)} {t(sessionLabel)}</small>}</span>{dimension === 'model' ? <span className="qp-node-share"><span className="qp-node-track" aria-hidden="true"><span style={{ width: `${share ?? 0}%` }}/></span><small>{share === null ? '—' : `${percent.format(share)}%`}</small></span> : null}</button>;
          })}
        </div>)}
      </div>
    </div>}
    {dimensions.some(dimension => nodes[dimension].length > 8) && <p className="qp-footnote">{t('redesign.topNodes')}</p>}
  </section>;
}

function QuotaRunway({ quota, now, t, language, preview, history, historyError }: { quota: QuotaWindow | undefined; now: number; t: Translate; language: 'en' | 'th'; preview: boolean; history?: QuotaHistoryResponse | null; historyError?: boolean }) {
  const [historyOpen, setHistoryOpen] = useState(false);
  const runway = runwayState(quota, now, preview ? 300000 : 3600000);
  const date = (value: number) => new Intl.DateTimeFormat(language === 'th' ? 'th-TH' : 'en-US', { dateStyle: 'short', timeStyle: 'short' }).format(value);
  const duration = (value: number) => value - now < 60_000 ? '<1m' : countdown(value, now);
  const reason = runway.status === 'unavailable' ? ({ noQuota: 'redesign.runwayNoQuota', stale: 'redesign.runwayStale', noReset: 'redesign.runwayNoReset', reset: 'redesign.runwayReset', unknown: 'redesign.runwayUnknown' } as const)[runway.reason] : null;
  const forecast = runway.status === 'ready' ? runway.projectedBeforeReset && runway.projectedFullAt !== null
    ? `${t('redesign.projected')} ${date(runway.projectedFullAt)} · ${t('redesign.beforeReset')}`
    : runway.projectedFullAt !== null ? t('redesign.afterReset')
      : t(runway.forecastStatus === 'flat' ? 'redesign.forecastFlat' : runway.forecastStatus === 'reset' ? 'redesign.forecastReset' : 'redesign.forecastInsufficient') : null;
  const timeBeforeReset = runway.status === 'ready' && runway.projectedBeforeReset && runway.projectedFullAt !== null
    ? quotaDuration(now + quota!.resetAt - runway.projectedFullAt, now, t('redesign.unknownValue')) : null;
  const consequence = timeBeforeReset !== null
    ? `${t('redesign.runwayHitLimitLead')} ${timeBeforeReset} ${t('redesign.beforeReset')}${language === 'th' ? '' : '.'}`
    : runway.status === 'ready' && runway.projectedFullAt !== null
      ? t('redesign.runwayAfterReset') : forecast;
  const marker = runway.status === 'ready' && runway.projectedBeforeReset && runway.projectedFullAt !== null
    ? (runway.projectedFullAt - now) / (quota!.resetAt - now) * 100 : null;
  return <section className="qp-panel qp-runway" data-testid="quota-runway">
    <div className="qp-runway-heading"><h2><CircleGauge size={18}/>{t('redesign.runway')}</h2><span className="qp-runway-subtitle">{t('redesign.runwaySubtitle')}</span>{!preview && <details className="qp-quota-history" data-testid="quota-history" onToggle={event => setHistoryOpen(event.currentTarget.open)}>
      <summary aria-label={t('redesign.observedHistory')} title={t('redesign.observedHistory')}><History size={14}/></summary>
      <div className="qp-quota-history-panel">
        {historyError && history?.reader && <p role="status" className="qp-footnote">{t('redesign.historyUnavailable')}</p>}
        {history?.reader && history.segments.length > 0 ? <>
          {historyOpen && <QuotaChart history={history} t={t} language={language} title={t('redesign.observedHistory')}/>}
          <p className="qp-footnote">{history.reader.origin} · {history.segments.length} {t('redesign.resetPeriods')} · {history.segments.reduce((sum, segment) => sum + segment.samples.length, 0)} {t('redesign.readings')}</p>
        </> : <p className="qp-footnote">{historyError ? t('redesign.historyUnavailable') : history || !quota ? t('redesign.noHistory') : t('redesign.historyLoading')}</p>}
      </div>
    </details>}<span className="qp-runway-owner">{quota ? `${quota.owner} · ${quotaWindowLabel(quota.window, t)}` : t('redesign.unavailable')}</span></div>
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
      <div className="qp-runway-outcome"><strong>{runway.projectedFullAt !== null ? `${duration(runway.projectedFullAt)} ${t('redesign.remaining')}` : '—'}</strong><span data-testid="quota-runway-consequence" data-risk={marker !== null ? 'warning' : undefined}>{consequence}</span><strong>{t('redesign.resetIn')} {duration(quota!.resetAt)}</strong></div>
    </>}
  </section>;
}

export function Overview({ records = [], graph, runtimeGraph, quotas, quotaAccountStates, now, t, language, onLanguage, theme: themeProp, onTheme, preview = false, currency = 'USD', rate = 1, onQuotaSelect, quotaHistory, quotaHistoryError, metricUsage, metricComparison, recent, activityTrend, period, periodControl, selectedQuotaId, harnessVendors = {}, historyHref = '#history?range=today', runtimeProjects, selectedRuntimeProject, onRuntimeProjectChange }: OverviewProps) {
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
  const runtimeTotals = runtimeGraph?.totals ?? totals;
  const runtimeNodes = runtimeGraph?.nodes ?? nodes;
  const runtimeEdgesForMap = runtimeGraph?.edges ?? edges;
  const models = nodes.model;
  const quotaGroups = new Map<string, QuotaWindow[]>();
  for (const item of quotas) {
    const key = item.ownerKey ?? JSON.stringify([item.provider, item.owner]);
    const group = quotaGroups.get(key) ?? []; group.push(item); quotaGroups.set(key, group);
  }
  const detail: UsageNode | null = selection ? runtimeNodes[selection.dimension].find(node => node.key === selection.key) ?? null : null;
  const number = (value: number) => new Intl.NumberFormat(language === 'th' ? 'th-TH' : 'en-US', { maximumFractionDigits: 0 }).format(value);
  const compactNumber = (value: number) => new Intl.NumberFormat(language === 'th' ? 'th-TH' : 'en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
  const totalActivityRate = activityTokensPerMinute(activityTrend);
  const money = (value: number) => new Intl.NumberFormat(language === 'th' ? 'th-TH' : 'en-US', { style: 'currency', currency }).format(currency === 'THB' ? value * rate : value);
  const coverage = graph?.totals;
  const prices = coverage ? { native: coverage.nativeCalls, api: coverage.computedCalls + coverage.estimatedCalls, total: coverage.nativeCalls + coverage.computedCalls + coverage.estimatedCalls + coverage.unknownCalls } : recordCostCoverage(records);
  const inputTotal = coverage ? coverage.inputTokens + coverage.cachedInputTokens + coverage.cacheWriteTokens : 0;
  const cacheShare = inputTotal > 0 && coverage ? coverage.cachedInputTokens / inputTotal * 100 : null;
  const tokenPeriodChange = metricComparison
    ? relativeChangePercent(metricComparison.current.total_tokens, metricComparison.previous.total_tokens) : null;
  const previousCacheShare = metricComparison ? cacheSharePercent(metricComparison.previous) : null;
  const cacheShareChange = percentagePointChange(cacheShare, previousCacheShare);
  const metricPace = metricUsage ? averageDailyTokenPace(metricUsage.totals.total_tokens, metricUsage.range.from, metricUsage.range.to) : null;
  const metricTokenSeries = metricUsage ? metricTrendSeries(metricUsage.timeline, metricUsage.range, 'total_tokens') : [];
  const metricCostSeries = metricUsage ? metricTrendSeries(metricUsage.timeline, metricUsage.range, 'cost_usd') : [];
  const metricCacheSeries = metricUsage ? cacheShareTrendSeries(metricUsage.timeline, metricUsage.range) : [];
  const quotaReading = quota ? quotaState(quota, now, preview ? 300000 : 3600000) : null;
  const runway = runwayState(quota, now, preview ? 300000 : 3600000);
  const projectionMessage = runway.status !== 'ready' || runway.projectedFullAt === null
    ? null
    : runway.projectedBeforeReset
      ? `${t('redesign.coreProjectionLead')} ${quotaDuration(runway.projectedFullAt, now, t('redesign.unknownValue'))} ${t('redesign.beforeReset')}${language === 'th' ? '' : '.'}`
      : t('redesign.coreProjectionAfterReset');
  const quotaPercent = quotaReading && !quotaReading.stale && quotaReading.remaining !== null ? quota?.usedPercent ?? null : null;
  const measuredPace = supportedForecastPace(quota?.forecastStatus, quota?.burnPercentPerHour);
  const safePace = runway.status === 'ready' ? runway.safePace : null;
  const paceVsSafe = paceAboveSafePercent(measuredPace, safePace);
  const pricingState = prices.total === 0 ? 'unavailable' : prices.native + prices.api === prices.total ? 'complete' : 'partial';
  const recommendation = recommendationKind({
    stale: !quotaReading || quotaReading.stale,
    projectedBeforeReset: runway.status === 'ready' && runway.projectedBeforeReset,
    risk: quotaReading?.risk ?? 'unknown',
    cacheShare,
    pricingState,
  });
  const recommendationAction = ({
    'fresh-reading': 'redesign.insightActionFresh',
    'reduce-load': 'redesign.insightActionReduce',
    'slow-down': 'redesign.insightActionSlow',
    'use-cache': 'redesign.insightActionCache',
    'check-pricing': 'redesign.insightActionPricing',
    monitor: 'redesign.insightActionMonitor',
  } as const)[recommendation];
  const recommendationText = ({
    'fresh-reading': 'redesign.insightFreshReading',
    'reduce-load': 'redesign.insightReduceLoad',
    'slow-down': 'redesign.insightSlowDown',
    'use-cache': 'redesign.insightUseCache',
    'check-pricing': 'redesign.insightCheckPricing',
    monitor: 'redesign.insightMonitor',
  } as const)[recommendation];
  const signedPercent = (value: number | null) => value === null ? '—' : `${new Intl.NumberFormat(language === 'th' ? 'th-TH' : 'en-US', { maximumFractionDigits: 0, signDisplay: 'always' }).format(value)}%`;
  const signedPoints = (value: number | null) => value === null ? null : `${value > 0 ? '↑' : value < 0 ? '↓' : '→'}${number(Math.abs(value))} ${t('redesign.percentagePointsShort')}`;
  const decimalNumber = (value: number | null) => value === null ? '—' : new Intl.NumberFormat(language === 'th' ? 'th-TH' : 'en-US', { maximumFractionDigits: 2 }).format(value);
  const knownCost = totals.reportedCost + totals.apiValue;
  const metricTrendLabel = `${t('redesign.metricTrend')} · ${period ?? t('redesign.allTime')}`;
  const costSupport = `${t('redesign.nativeShort')} ${money(totals.reportedCost)} · ${t('redesign.apiShort')} ${money(totals.apiValue)}`;
  const cacheSupport = cacheShare === null ? t('redesign.noInput') : `${compactNumber(coverage!.cachedInputTokens)} / ${compactNumber(inputTotal)}`;
  const cacheInsightSupport = `${cacheSupport} · ${coverage && coverage.cacheSavingKnownCalls > 0
    ? `${money(coverage.cacheSavingKnownUsd)} · ${number(coverage.cacheSavingKnownCalls)} ${t('redesign.knownCalls')}`
    : t('redesign.noCachePrice')}`;
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
            <div className="qp-section-heading"><div className="qp-hero-heading-copy"><h2><Activity size={18}/>{t('redesign.core')}</h2><small className="qp-hero-tagline">{t('redesign.coreSubtitle')}</small></div>{periodControl ?? (period && <span className="qp-chip">{period}</span>)}</div>
            <div className="qp-core-grid"><div className="qp-metrics">
              <MetricRailItem metric="tokens" icon={<CircleGauge size={21}/>} label={t('redesign.tokenUsage')} value={compactNumber(totals.tokens)} rawValue={totals.tokens} meter={quotaPercent} meterCaption={quota ? quotaWindowLabel(quota.window, t) : t('redesign.quotaUsed')} meterLabel={quota ? `${quota.owner} · ${quotaWindowLabel(quota.window, t)} · ${t('redesign.quotaUsed')}` : t('redesign.quotaUsed')}/>
              <MetricRailItem metric="pace" icon={<Flame size={21}/>} label={t('redesign.averageTokenPace')} value={metricPace === null ? '—' : compactNumber(metricPace)} rawValue={metricPace} support={t('redesign.tokensPerDay')} trend={metricTokenSeries} trendLabel={metricTrendLabel}/>
              <MetricRailItem metric="cost" icon={<Coins size={21}/>} label={t('redesign.knownCost')} value={<CostValue amount={knownCost} priced={prices.native + prices.api} total={prices.total} money={money} t={t} unit={graph ? 'calls' : 'records'}/>} rawValue={knownCost} support={costSupport} trend={metricCostSeries} trendLabel={metricTrendLabel}/>
              <MetricRailItem metric="cache" icon={<Star size={21}/>} label={t('redesign.cacheShare')} value={cacheShare === null ? '—' : `${number(cacheShare)}%`} rawValue={cacheShare} support={cacheSupport} trend={metricCacheSeries} trendLabel={metricTrendLabel} scale="percent"/>
                </div><PulseCore quota={quota} now={now} t={t} language={language} staleAfterMs={preview ? 300000 : 3600000} tokens={totals.tokens} period={period ?? t('redesign.allTime')}/><section className="qp-top-models" id="model-usage" tabIndex={0} aria-label={t('redesign.topModelsByTokens')}><h3>{t('redesign.topModelsByTokens')}</h3><div className="qp-top-model-list">{models.slice(0, 5).map(model => <button className="qp-model-row" key={String(model.key)} onClick={() => setSelection({ dimension: 'model', key: model.key })}><span className="qp-model-identity"><i data-model-vendor={model.key ? model.vendor : undefined} aria-hidden="true"><ModelMark node={model} size={18}/></i><span>{model.key ?? t('redesign.unknownValue')}</span></span><strong title={number(model.tokens)}>{totals.tokens ? number(model.tokens / totals.tokens * 100) : '0'}%</strong><span className="qp-bar"><span style={{ width: `${totals.tokens ? model.tokens / totals.tokens * 100 : 0}%` }}/></span></button>)}</div></section></div>
            <div className="qp-hero-notes">
              {projectionMessage && <p className="qp-hero-projection" data-testid="pulse-projection">{projectionMessage}</p>}
              <p className="qp-footnote">{t('redesign.scope')}</p>
            </div>
          </section>
          <section className="qp-panel qp-quotas"><div className="qp-quotas-heading"><h2><CircleGauge size={18}/>{t('redesign.windows')}</h2><a className="qp-quota-manage" href="#providers">{t('redesign.manage')} <ArrowRight size={14}/></a></div>
            {quotas.length === 0 && <p className="qp-footnote">{t('redesign.unavailable')}</p>}
            {quotas.length > 0 && <div className="qp-quota-groups" tabIndex={0} aria-label={t('redesign.windows')}>
              {[...quotaGroups].map(([key, windows]) => <section className="qp-quota-group" key={key} data-owner-key={key} data-state={quotaAccountStates?.[key] ?? 'unknown'} aria-label={windows[0].owner}>
                <div className="qp-quota-group-heading"><h3><VendorIcon vendor={windows[0].provider ?? 'unknown'}/>{windows[0].owner}</h3><span className="qp-quota-group-status" data-state={quotaAccountStates?.[key] ?? 'unknown'}>{t(accountStateMessage(quotaAccountStates?.[key]))}</span></div>
                {windows.map(item => { const reading = quotaState(item, now, preview ? 300000 : 3600000);
                  const used = reading.remaining === null ? null : item.usedPercent;
                  const percent = used === null ? '—' : `${used}%`;
                  const knownReset = Number.isFinite(item.resetAt) && item.resetAt > 0;
                  const reset = !knownReset ? '—' : item.resetAt <= now ? t('redesign.resetPast') : item.resetAt - now < 60_000 ? '<1m' : countdown(item.resetAt, now);
                  return <button className="qp-quota" key={item.id} data-owner={item.owner} data-window={item.window} data-stale={reading.stale} aria-pressed={quota?.id === item.id} aria-label={`${item.owner} · ${item.window} · ${percent} ${t('redesign.quotaUsed')} · ${t('redesign.resetIn')} ${reset} · ${t(riskLabel(reading))}`} onClick={() => { setQuotaId(item.id); onQuotaSelect?.(item.id); }}>
                    <span className="qp-quota-heading"><span>{quotaWindowLabel(item.window, t)}</span>{reading.risk !== 'normal' && <span className="qp-status" data-risk={reading.risk}>{t(riskLabel(reading))}</span>}</span>
                    <span className="qp-quota-usage"><span className="qp-quota-number"><strong>{percent}</strong><small>{t('redesign.quotaUsed')}</small></span><span className="qp-bar"><span style={{ width: `${used === null ? 0 : Math.min(100, used)}%` }}/></span></span>
                    <span className="qp-quota-reset"><small>{t('redesign.resetIn')}</small><strong title={knownReset ? new Intl.DateTimeFormat(language === 'th' ? 'th-TH' : 'en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(item.resetAt) : t('redesign.unavailable')}>{reset}</strong></span>
                  </button>;
                })}
              </section>)}
            </div>}
          </section>
        </div>
        <RuntimeMap nodes={runtimeNodes} edges={runtimeEdgesForMap} recordCount={runtimeTotals.records} now={runtimeGraph?.now ?? now} activityWindowMs={runtimeGraph?.activityWindowMs ?? RUNTIME_ACTIVITY_WINDOW_MS} t={t} language={language} harnessVendors={harnessVendors} projects={runtimeProjects} selectedProject={selectedRuntimeProject} onProjectChange={onRuntimeProjectChange} onInspect={(dimension, key) => setSelection({ dimension, key })}/>
        <div className="qp-bottom-grid">
          <QuotaRunway quota={quota} now={now} t={t} language={language} preview={preview} history={quotaHistory} historyError={quotaHistoryError}/>
          <section className="qp-panel qp-insights" data-testid="usage-insights"><div className="qp-insights-heading"><h2><Box size={18}/>{t('redesign.insights')}</h2><span className="qp-insights-subtitle">{t('redesign.insightsSubtitle')}</span></div>
            <div className="qp-insight-grid">
              <article className="qp-insight-card" data-insight="burn" data-state={tokenPeriodChange === null ? 'unknown' : tokenPeriodChange > 0 ? 'increase' : tokenPeriodChange < 0 ? 'decrease' : 'steady'} data-value={tokenPeriodChange ?? undefined}><i aria-hidden="true"><Flame size={17}/></i><div><header><h3>{t('redesign.highBurnRate')}</h3><strong>{signedPercent(tokenPeriodChange)}</strong></header><p>{tokenPeriodChange === null ? t('redesign.noComparisonBaseline') : `${t('redesign.comparedWithPrevious')} · ${period ?? t('redesign.allTime')}`}</p></div></article>
              <article className="qp-insight-card" data-insight="cache" data-state={cacheShare === null ? 'unavailable' : 'measured'} data-value={cacheShare ?? undefined}><i aria-hidden="true"><Layers size={17}/></i><div><header><h3>{t('redesign.cacheEfficiency')}</h3><strong>{cacheShare === null ? '—' : `${number(cacheShare)}%`}</strong></header><p>{cacheInsightSupport}</p>{cacheShareChange !== null && <small className="qp-insight-delta" data-direction={cacheShareChange > 0 ? 'up' : cacheShareChange < 0 ? 'down' : 'steady'}>{signedPoints(cacheShareChange)}</small>}</div></article>
              <article className="qp-insight-card" data-insight="pace-comparison" data-state={paceVsSafe === null ? 'unknown' : paceVsSafe > 0 ? 'above-safe' : 'within-safe'} data-value={paceVsSafe ?? undefined}><i aria-hidden="true"><Activity size={17}/></i><div><header><h3>{t('redesign.paceComparison')}</h3><strong>{signedPercent(paceVsSafe)}</strong></header><p>{measuredPace === null || safePace === null ? t('redesign.paceComparisonUnavailable') : `${t('redesign.measuredPace')} ${decimalNumber(measuredPace)} ${t('redesign.pointsPerHour')} · ${t('redesign.safePace')} ${decimalNumber(safePace)} ${t('redesign.pointsPerHour')}`}</p></div></article>
              <article className="qp-insight-card" data-insight="recommendation" data-state={recommendation} data-pricing-state={pricingState}><i aria-hidden="true"><Wallet size={17}/></i><div><header><h3>{t('redesign.recommendation')}</h3><strong>{t(recommendationAction)}</strong></header><p title={t(recommendationText)}>{t(recommendationText)}</p><small className="qp-insight-detail">{prices.total > 0 ? `${number(prices.native + prices.api)}/${number(prices.total)} ${t('redesign.calls')} · ${number(totals.unknownCostRecords)} ${t('redesign.unknownCostShort')}` : t('redesign.pricingUnavailable')}</small></div></article>
            </div>
          </section>
        </div>
        <section className="qp-panel qp-activity" data-testid="recent-activity">
          <div className="qp-section-heading"><h2><Activity size={18}/>{t('redesign.liveActivity')}<small className='qp-activity-chart-label'>{t('redesign.activityWindow')}</small></h2>{!preview && <div className="qp-activity-actions"><span className="qp-activity-total" data-rate-state={totalActivityRate === null ? 'unavailable' : 'measured'}><small>{t('redesign.activityTotal')}</small><strong data-activity-total>{totalActivityRate === null ? '—' : compactNumber(totalActivityRate)} <small>{t('redesign.tokensPerMinute')}</small></strong></span><a href={historyHref}>{t('redesign.viewAllActivity')} <ArrowUpRight size={14}/></a></div>}</div>
          {activities.length === 0 ? <p className="qp-footnote">{t('redesign.noRecent')}</p> : <div className="qp-activity-list">{activities.map(item => {
            const route = `${item.provider ?? t('redesign.unknownValue')} · ${item.model ?? t('redesign.unknownValue')}`;
            const grain = t(item.grain === 'call' ? 'redesign.callRecord' : item.grain === 'session_aggregate' ? 'redesign.aggregateUpdate' : 'redesign.unknownValue');
            const time = new Intl.DateTimeFormat(language === 'th' ? 'th-TH' : 'en-US', { hour: '2-digit', minute: '2-digit' }).format(item.timestamp);
            const ratePerMinute = activityTokensPerMinute(item.trend);
            const isAggregate = item.grain === 'session_aggregate';
            const harnessName = runtimeNodeLabel('harness', item.harness, item.harness);
            const shownValue = isAggregate ? compactNumber(item.tokens) : ratePerMinute === null ? '—' : compactNumber(ratePerMinute);
            const shownUnit = isAggregate ? t('redesign.tokensObserved') : t('redesign.tokensPerMinute');
            const identityMetric = isAggregate ? `${number(item.tokens)} ${t('redesign.tokensObserved')}` : ratePerMinute === null ? t('redesign.unavailable') : `${number(ratePerMinute)} ${t('redesign.tokensPerMinute')}`;
            const identityTokens = isAggregate ? '' : ` · ${number(item.tokens)} ${t('redesign.tokens')} recorded`;
            const identity = `${harnessName} → ${route} · ${identityMetric} · ${grain} · ${time}${identityTokens}`;
            const rateState = isAggregate ? 'aggregate' : item.grain !== 'call' || ratePerMinute === null ? 'unavailable' : 'measured';
            const content = <><div className="qp-activity-path"><span className="qp-activity-identity" title={harnessName}><HarnessIcon harness={item.harness} vendor={harnessVendors[item.harness]} label={harnessName}/><b>{harnessName}</b></span><ArrowRight size={12} aria-hidden="true"/><span className="qp-activity-route" title={route}><VendorIcon vendor={item.provider ?? 'unknown'}/><span>{item.model ?? t('redesign.unknownValue')}</span></span></div><div className="qp-activity-value" data-rate-state={rateState}><strong data-rate-value={ratePerMinute ?? undefined}>{shownValue}</strong><small>{shownUnit}</small></div><div className="qp-activity-meta qp-visually-hidden"><time dateTime={new Date(item.timestamp).toISOString()}>{time}</time><small>{grain}</small></div>{!preview && <ActivityTrend item={item} language={language}/>}</>;
            return preview ? <div className="qp-activity-item" key={item.id} data-harness={item.harness.trim().toLowerCase()} title={identity}>{content}</div>
              : <a className="qp-activity-item" key={item.id} data-harness={item.harness.trim().toLowerCase()} data-record-id={item.id} data-grain={item.grain} title={identity} href={item.sessionKey !== null ? `#history?range=all&session_id=${item.sessionKey}` : '#history?range=today'} aria-label={`${identity} · ${t('redesign.openHistory')}`}>{content}</a>;
          })}</div>}
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

function MetricTrace({ values, label, scale = 'amount' }: { values: readonly (number | null)[]; label: string; scale?: 'amount' | 'percent' }) {
  const finite = values.filter((value): value is number => value !== null && Number.isFinite(value));
  if (finite.length < 2 || values.length < 2) return null;
  const max = scale === 'percent' ? 100 : Math.max(1, ...finite);
  let drawing = false;
  const path = values.map((value, index) => {
    if (value === null || !Number.isFinite(value)) { drawing = false; return ''; }
    const x = index / (values.length - 1) * 56;
    const y = 20 - Math.max(0, Math.min(max, value)) / max * 16;
    const command = drawing ? 'L' : 'M'; drawing = true;
    return `${command}${x.toFixed(2)},${y.toFixed(2)}`;
  }).filter(Boolean).join(' ');
  return <svg className="qp-metric-trace" viewBox="0 0 56 22" preserveAspectRatio="none" role="img" aria-label={label} data-values={values.map(value => value === null ? '' : String(value)).join(',')}><path d={path} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke"/></svg>;
}

function MetricRailItem({ metric, label, value, rawValue, icon, support, trend, trendLabel, scale = 'amount', meter, meterCaption, meterLabel }: {
  metric: string; label: string; value: ReactNode; rawValue: number | null; icon: ReactNode; support?: string;
  trend?: readonly (number | null)[]; trendLabel?: string; scale?: 'amount' | 'percent'; meter?: number | null; meterCaption?: string; meterLabel?: string;
}) {
  const hasMeter = meter != null && Number.isFinite(meter);
  const visibleMeter = hasMeter ? `${Math.round(meter)}%` : null;
  return <div className="qp-metric-rail" data-metric={metric} data-value={rawValue ?? undefined}>
    <i className="qp-metric-rail-icon" aria-hidden="true">{icon}</i>
    <div className="qp-metric-rail-copy">
      <span className="qp-metric-rail-label">{label}</span>
      <div className="qp-metric-rail-main"><strong>{value}</strong>{trend && trendLabel && <MetricTrace values={trend} label={trendLabel} scale={scale}/>}</div>
      {hasMeter && <div className="qp-metric-meter" role="meter" aria-label={`${meterLabel ?? label} · ${visibleMeter}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={meter} data-value={meter}>
        <small aria-hidden="true"><span className="qp-metric-meter-context">{meterCaption ?? label}</span><strong>{visibleMeter}</strong></small>
        <span aria-hidden="true"><i style={{ width: `${Math.max(0, Math.min(100, meter))}%` }}/></span>
      </div>}
      {support && <small className="qp-metric-rail-support" title={support}>{support}</small>}
    </div>
  </div>;
}
