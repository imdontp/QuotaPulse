import { useEffect, useId, useRef, useState } from 'react';
import { BarChart3, Coins, FileText, History, Zap } from 'lucide-react';
import type { HistorySummaryResponse } from '@/api';
import { useI18n, useT } from '@/i18n';
import { useFormat } from '@/i18n/format';
import './history.css';
import { EffortPagination, useEffortPage } from './effort-pagination';

export function HistoryTimeline({ data }: { data: HistorySummaryResponse }) {
  const t = useT();
  const f = useFormat();
  const { lang } = useI18n();
  const id = useId().replace(/:/g, '');
  const chart = useRef<SVGSVGElement>(null);
  const [width, setWidth] = useState(1000);
  const [active, setActive] = useState<{ scope: string; index: number; kind: 'pointer' | 'keyboard'; width: number; left: number; top: number } | null>(null);
  useEffect(() => {
    const dismiss = () => setActive(null);
    window.addEventListener('scroll', dismiss, true);
    window.addEventListener('resize', dismiss);
    return () => { window.removeEventListener('scroll', dismiss, true); window.removeEventListener('resize', dismiss); };
  }, []);
  useEffect(() => {
    const node = chart.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(240, Math.round(entry.contentRect.width))));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  const effort = useEffortPage(data.effort, location.hash);
  const totals = data.totals;
  const count = (value: number) => value.toLocaleString(lang);
  const entries = new Map(data.timeline.map(row => [row.at, row]));
  const buckets = Array.from({ length: Math.ceil((data.scope.to - data.scope.from) / data.bucketMs) }, (_, index) => {
    const at = data.scope.from + index * data.bucketMs;
    return { at, inputTokens: entries.get(at)?.inputTokens ?? 0, outputTokens: entries.get(at)?.outputTokens ?? 0 };
  });
  const max = Math.max(1, ...buckets.flatMap(row => [row.inputTokens, row.outputTokens]));
  const left = 44;
  const right = width - 12;
  const x = (index: number) => left + (right - left) * index / Math.max(1, buckets.length - 1);
  const y = (value: number) => 118 - 100 * value / max;
  const points = (key: 'inputTokens' | 'outputTokens') => buckets.map((row, index) => `${x(index)},${y(row[key])}`).join(' ');
  const gridStride = Math.max(1, Math.ceil((buckets.length - 1) / 12));
  const date = (at: number) => new Intl.DateTimeFormat(lang === 'th' ? 'th-TH' : 'en-US', { dateStyle: 'short', timeStyle: 'short' }).format(at);
  const scopeKey = JSON.stringify([location.hash, data.scope, data.bucketMs]);
  useEffect(() => setActive(null), [scopeKey, width]);
  const current = active?.scope === scopeKey && active.width === width && buckets[active.index] ? active : null;
  const selected = current ? buckets[current.index] : null;
  const activate = (index: number, kind: 'pointer' | 'keyboard') => {
    const node = chart.current;
    if (!node || !buckets[index]) return;
    const bounds = node.getBoundingClientRect(), panel = node.parentElement!.getBoundingClientRect();
    const next = { scope: scopeKey, index, kind, width,
      left: Math.max(panel.left + 8, Math.min(panel.right - 192, bounds.left + x(index) / width * bounds.width - 40)),
      top: Math.max(8, Math.min(innerHeight - 160, bounds.top - 10)) };
    setActive(previous => previous?.scope === next.scope && previous.index === index && previous.kind === kind && previous.width === width && previous.left === next.left && previous.top === next.top ? previous : next);
  };
  const timed = data.bucketMs < 86_400_000;
  const tickCount = width >= (timed ? 1200 : 900) ? 9 : width >= (timed ? 750 : 600) ? 5 : width >= 350 ? 3 : 2;
  const dateIndices = buckets.length <= tickCount ? buckets.map((_, index) => index)
    : Array.from({ length: tickCount }, (_, index) => Math.round(index * (buckets.length - 1) / (tickCount - 1)));
  const dateLabel = new Intl.DateTimeFormat(lang === 'th' ? 'th-TH' : 'en-US', {
    ...(data.scope.to - data.scope.from >= 86_400_000 ? { month: 'short', day: 'numeric' } as const : {}),
    ...(new Date(data.scope.from).getFullYear() !== new Date(data.scope.to - 1).getFullYear() ? { year: 'numeric' } as const : {}),
    ...(data.bucketMs < 86_400_000 ? { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' } as const : {}),
  });
  const priced = totals.computed_calls + totals.estimated_calls;
  const value = (amount: number, calls: number) => totals.records === 0 ? f.money(0) : calls ? `${f.money(amount)}${calls < totals.calls ? '+' : ''}` : t('redesign.unknownValue');
  return <section className="qp-history-timeline qp-panel" data-testid="history-timeline" data-scope={JSON.stringify(data.scope)} data-bucket-ms={data.bucketMs}>
    <h2><i aria-hidden="true"><History size={19}/></i>{t('history.timeline')}</h2>
    <p className="qp-footnote">{t('history.timelineNote')}</p>
    <div className="qp-history-summary">
      <article><i aria-hidden="true"><BarChart3 size={24}/></i><span>{t('col.total')}</span><strong data-testid="history-total-tokens" title={totals.tokens.toLocaleString(lang, { maximumFractionDigits: 20 })} aria-label={String(totals.tokens)}>{f.tokens(totals.tokens)}</strong></article>
      <article><i aria-hidden="true"><FileText size={24}/></i><span>{t('col.calls')}</span><strong>{count(totals.calls)}</strong><small>{count(totals.records)} {t('history.records')} · {count(totals.sessions)} {t('redesign.sessions')}</small></article>
      <article><i aria-hidden="true"><Coins size={24}/></i><span>{t('history.apiTotal')}</span><strong>{value(totals.api_value_usd, priced)}</strong><small>{t('history.nativeTotal')}: {value(totals.reported_native_usd, totals.native_calls)}</small><small>{count(priced)} / {count(totals.calls)} {t('col.calls')}</small></article>
      <article><i aria-hidden="true"><Zap size={24}/></i><span>{t('history.effortDistribution')}</span><ul>{effort.rows.map(row => <li key={JSON.stringify(row.effort)}>{row.effort ?? t('redesign.unknownValue')}: {count(row.calls)}</li>)}</ul><EffortPagination {...effort}/>{!data.effort.length && <strong>—</strong>}</article>
    </div>
    <div className="qp-history-legend"><span>{t('history.inputCombined')}</span><span>{t('col.output')}</span></div>
    <svg ref={chart} viewBox={`0 0 ${width} 144`} preserveAspectRatio="none" role="group" tabIndex={buckets.length ? 0 : -1} aria-label={`${t('history.timeline')}: ${count(totals.tokens)}`} aria-describedby={`${id}-help`}
      onFocus={() => activate(current?.index ?? 0, current?.kind ?? 'keyboard')} onBlur={() => setActive(null)}
      onKeyDown={event => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End', 'Escape'].includes(event.key)) return;
        event.preventDefault(); event.stopPropagation();
        if (event.key === 'Escape') setActive(null);
        else activate(event.key === 'Home' ? 0 : event.key === 'End' ? buckets.length - 1 : event.key === 'ArrowRight' ? Math.min(buckets.length - 1, (current?.index ?? -1) + 1) : Math.max(0, (current?.index ?? buckets.length) - 1), 'keyboard');
      }}
      onPointerMove={event => {
        const bounds = event.currentTarget.getBoundingClientRect();
        const localX = (event.clientX - bounds.left) / bounds.width * width, localY = (event.clientY - bounds.top) / bounds.height * 144;
        if (localX < left || localX > right || localY < 18 || localY > 118) { setActive(previous => previous?.kind === 'pointer' ? null : previous); return; }
        activate(Math.max(0, Math.min(buckets.length - 1, Math.round((localX - left) / (right - left) * (buckets.length - 1)))), 'pointer');
      }} onPointerLeave={() => setActive(previous => previous?.kind === 'pointer' ? null : previous)}>
      <desc id={`${id}-help`}>{t('history.timelineHelp')} {date(data.scope.from)} — {date(data.scope.to)}</desc>
      <defs>{(['input', 'output'] as const).map(series => <linearGradient key={series} id={`${id}-${series}`} x1="0" y1="0" x2="0" y2="1"><stop stopColor={`var(--history-${series})`} stopOpacity=".22"/><stop offset="1" stopColor={`var(--history-${series})`} stopOpacity="0"/></linearGradient>)}<filter id={`${id}-glow`} x="-10%" y="-50%" width="120%" height="200%"><feGaussianBlur stdDeviation="1.5"/><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
      {[0, .25, .5, .75, 1].map(fraction => <g key={fraction} className={fraction === .25 || fraction === .75 ? 'qp-history-grid-secondary' : undefined}><line className="qp-history-grid-line" x1={left} x2={right} y1={y(max * fraction)} y2={y(max * fraction)}/><text x="0" y={y(max * fraction)} fill="currentColor" fontSize="11">{f.tokens(max * fraction)}</text></g>)}
      <g className="qp-history-grid-vertical" aria-hidden="true">{buckets.map((row, index) => index % gridStride === 0 || index === buckets.length - 1 ? <line key={row.at} className="qp-history-grid-line" x1={x(index)} x2={x(index)} y1={y(max)} y2={y(0)}/> : null)}</g>
      <polygon points={`${left},118 ${points('inputTokens')} ${right},118`} fill={`url(#${id}-input)`}/>
      <polygon points={`${left},118 ${points('outputTokens')} ${right},118`} fill={`url(#${id}-output)`}/>
      <polyline points={points('inputTokens')} fill="none" stroke="var(--history-input)" strokeWidth="2" filter={`url(#${id}-glow)`}/>
      <polyline points={points('outputTokens')} fill="none" stroke="var(--history-output)" strokeWidth="2" filter={`url(#${id}-glow)`}/>
      {buckets.map((row, index) => <g key={row.at} data-bucket-at={row.at} data-input={row.inputTokens} data-output={row.outputTokens} aria-hidden="true"><circle cx={x(index)} cy={y(row.inputTokens)} r="2" fill="var(--history-input)"/><circle cx={x(index)} cy={y(row.outputTokens)} r="2" fill="var(--history-output)"/></g>)}
      {current && selected && <g className="qp-history-cursor" aria-hidden="true"><line x1={x(current.index)} x2={x(current.index)} y1="18" y2="118"/><circle cx={x(current.index)} cy={y(selected.inputTokens)} r="4"/><circle cx={x(current.index)} cy={y(selected.outputTokens)} r="4"/></g>}
      {dateIndices.map((index, order) => <text key={buckets[index].at} x={x(index)} y="140" data-axis-at={buckets[index].at} data-axis-index={index} textAnchor={order === 0 ? 'start' : order === dateIndices.length - 1 ? 'end' : 'middle'} fill="currentColor" fontSize="11"><title>{date(buckets[index].at)}</title>{dateLabel.format(buckets[index].at)}</text>)}
    </svg>
    {current && selected && <div className="qp-history-tooltip" role="status" data-bucket-at={selected.at} style={{ left: current.left, top: current.top }}>
      <small>{t('redesign.chartBucketStart')}</small><time dateTime={new Date(selected.at).toISOString()}>{date(selected.at)}</time>
      <dl><dt><i data-series="input"/>{t('history.inputCombined')}</dt><dd data-value={selected.inputTokens} title={selected.inputTokens.toLocaleString(lang, { maximumFractionDigits: 20 })}>{f.tokens(selected.inputTokens)}</dd>
      <dt><i data-series="output"/>{t('col.output')}</dt><dd data-value={selected.outputTokens} title={selected.outputTokens.toLocaleString(lang, { maximumFractionDigits: 20 })}>{f.tokens(selected.outputTokens)}</dd></dl>
    </div>}
    {totals.tokens !== totals.inputTokens + totals.cachedInputTokens + totals.cacheWriteTokens + totals.outputTokens && <p className="qp-footnote">{t('history.partialBreakdown')}</p>}
  </section>;
}
