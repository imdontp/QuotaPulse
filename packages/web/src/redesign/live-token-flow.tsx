import { useId, useMemo, type ReactNode } from 'react';
import type { MessageKey } from '@/i18n/en';
import { tokens } from '@/format';
import { liveTokenFlow, liveTokenFlowLatest, liveTokenFlowSegments, liveTokenFlowTicks, liveTokenFlowX, liveTokenFlowY, liveTokenFlowYTicks, type LiveTokenFlowPoint, type LiveTokenFlowResponse, type LiveTokenFlowSeries } from './live-token-flow-data';
import './live-token-flow.css';

type Translate = (key: MessageKey) => string;
const labels: Record<LiveTokenFlowSeries, MessageKey> = { input: 'history.inputCombined', output: 'col.output', total: 'col.total' };
const series: readonly LiveTokenFlowSeries[] = ['input', 'output', 'total'];
const latestSeries: readonly LiveTokenFlowSeries[] = ['total', 'input', 'output'];

/** Place this beside the existing Live heading when the plot renders with showLegend=false. */
export function LiveTokenFlowLegend({ t }: { t: Translate }) {
  return <div className="qp-live-flow-legend">{series.map(key => <span key={key} data-series={key}><i aria-hidden="true"/>{t(labels[key])}</span>)}</div>;
}

export function LiveTokenFlow({ data, language, t, showLegend = true, excludedDetails }: {
  data: LiveTokenFlowResponse;
  language: 'en' | 'th';
  t: Translate;
  showLegend?: boolean;
  excludedDetails?: ReactNode;
}) {
  const flow = useMemo(() => liveTokenFlow(data), [data]);
  const id = useId().replace(/:/g, '');
  const locale = language === 'th' ? 'th-TH' : 'en-US';
  const number = (value: number) => value.toLocaleString(locale);
  const axisNumber = new Intl.NumberFormat('en-US', { notation: 'compact', maximumSignificantDigits: 3 });
  const date = new Intl.DateTimeFormat(locale, { dateStyle: 'short', timeStyle: 'medium' });
  const clock = new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const x = (at: number) => liveTokenFlowX(at, data.from, data.to);
  const y = (value: number) => liveTokenFlowY(value, flow.maximum);
  const latest = liveTokenFlowLatest(flow.points);
  const xTicks = liveTokenFlowTicks(data.from, data.to);
  const yTicks = liveTokenFlowYTicks(flow.maximum);
  const state = (point: LiveTokenFlowPoint) => t(point.state === 'missing' ? 'redesign.liveMinuteMissing' : point.state === 'zero' ? 'redesign.liveMinuteZero' : 'redesign.liveMinuteRecorded');
  const cell = (point: LiveTokenFlowPoint, value: number | null) => point.state === 'missing' ? '—' : value === null ? t('redesign.unknownValue') : number(value);
  const latestCompact = (value: number | null) => value === null ? t('redesign.unknownValue') : tokens(value);
  const latestExact = (value: number | null) => value === null ? t('redesign.unknownValue') : value.toLocaleString(locale, { maximumFractionDigits: 20 });
  const partial = (point: LiveTokenFlowPoint, index: number) => t(index === flow.points.length - 1 && point.end === data.to && point.end % 60000 !== 0 ? 'redesign.liveMinuteCurrent' : 'redesign.liveMinutePartial');
  const describe = (point: LiveTokenFlowPoint, key: LiveTokenFlowSeries, index: number) => `${date.format(point.start)} – ${date.format(point.end)} · ${state(point)} · ${t(labels[key])}: ${cell(point, point[key])}${point.partial ? ` · ${partial(point, index)}` : ''}`;

  return <div className="qp-live-token-flow" data-maximum={flow.maximum}>
    {showLegend && <LiveTokenFlowLegend t={t}/>}
    <div className="qp-live-flow-plot">
      <div className="qp-live-flow-y-axis" aria-hidden="true">{yTicks.map((value, index) => <span key={`${value}-${index}`} data-value={value} title={number(value)} style={{ top: `${y(value)}%` }}>{axisNumber.format(value)}</span>)}</div>
      <div className="qp-live-flow-canvas" role="img" aria-label={`${t('redesign.liveChart')} · ${series.map(key => t(labels[key])).join(' · ')} · 0 – ${number(flow.maximum)}`} aria-describedby={`${id}-data`}>
      {/* The total SVG retains the existing total-point selector; the other traces use separate SVGs. */}
      <svg className="qp-live-chart qp-live-flow-total" viewBox="0 0 1000 100" preserveAspectRatio="none" aria-hidden="true">
        <defs><linearGradient id={`${id}-area`} x1="0" y1="0" x2="0" y2="1"><stop stopColor="var(--qp-flow-total)" stopOpacity=".18"/><stop offset="1" stopColor="var(--qp-flow-total)" stopOpacity="0"/></linearGradient><filter id={`${id}-glow`} x="-5%" y="-50%" width="110%" height="200%"><feGaussianBlur stdDeviation="1"/><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
        {yTicks.map((value, index) => <line key={`${value}-${index}`} x1="8" x2="992" y1={y(value)} y2={y(value)} stroke="var(--qp-border)" strokeDasharray="2 4" vectorEffect="non-scaling-stroke"/>)}
        {flow.points.length > 1 && <polygon points={`${x(flow.points[0]!.start)},94 ${flow.points.map(point => `${x(point.start)},${y(point.total)}`).join(' ')} ${x(flow.points[flow.points.length - 1]!.start)},94`} fill={`url(#${id}-area)`}/>}
        <polyline className="qp-live-flow-line" data-series="total" points={flow.points.map(point => `${x(point.start)},${y(point.total)}`).join(' ')} fill="none" stroke="var(--qp-flow-total)" strokeWidth="2" vectorEffect="non-scaling-stroke" filter={`url(#${id}-glow)`}/>
        {flow.points.map((point, index) => <circle key={point.at} data-series="total" data-at={point.at} data-value={point.total} data-state={point.state} data-partial={point.partial || undefined} cx={x(point.start)} cy={y(point.total)} r="2" fill="var(--qp-flow-total)"><title>{describe(point, 'total', index)}</title></circle>)}
      </svg>
      {(['input', 'output'] as const).map(key => <svg key={key} className={`qp-live-flow-component qp-live-flow-${key}`} viewBox="0 0 1000 100" preserveAspectRatio="none" aria-hidden="true">
        {liveTokenFlowSegments(flow.points, key).map((segment, index) => <polyline key={index} className="qp-live-flow-line" data-series={key} points={segment.map(point => `${x(point.start)},${y(point.value)}`).join(' ')} fill="none" stroke={`var(--qp-flow-${key})`} strokeWidth="1.8" vectorEffect="non-scaling-stroke"/>)}
        {flow.points.map((point, index) => point[key] === null ? null : <circle key={point.at} data-series={key} data-at={point.at} data-value={point[key]} data-state={point.state} data-partial={point.partial || undefined} cx={x(point.start)} cy={y(point[key]!)} r="1.6" fill={`var(--qp-flow-${key})`}><title>{describe(point, key, index)}</title></circle>)}
      </svg>)}
      </div>
      {!!xTicks.length && <div className="qp-live-flow-axis" role="group" aria-label={t('redesign.liveChart')}>{xTicks.map((at, index) => <span key={`${at}-${index}`} data-at={at} title={date.format(at)} style={{ left: `${(x(at) - 8) / 984 * 100}%`, transform: index === 0 ? 'translateX(0)' : index === xTicks.length - 1 ? 'translateX(-100%)' : 'translateX(-50%)' }}>{clock.format(at)}</span>)}</div>}
      <section className="qp-live-flow-latest" data-at={latest?.at} data-start={latest?.start} data-end={latest?.end} data-partial={latest?.partial || undefined} data-input={latest?.input ?? undefined} data-output={latest?.output ?? undefined} data-total={latest?.total} aria-label={t('redesign.liveLatestMinute')}>
        <div className="qp-live-flow-latest-heading"><span>{t('redesign.liveLatestMinute')}</span>{latest && <time dateTime={new Date(latest.start).toISOString()} title={`${date.format(latest.start)} – ${date.format(latest.end)}`}>{clock.format(latest.start)} – {clock.format(latest.end)}{latest.partial ? ` · ${partial(latest, latest.index)}` : ''}</time>}</div>
        {latest ? <div className="qp-live-flow-latest-values">{latestSeries.map(key => <span key={key} data-series={key}><small>{t(labels[key])}</small><strong data-long-value={key === 'total' && latestCompact(latest[key]).length > 10 || undefined} title={latestExact(latest[key])} aria-label={latestExact(latest[key])}>{latestCompact(latest[key])}</strong></span>)}</div> : <small>{t('redesign.liveFlowNoLatest')}</small>}
      </section>
    </div>
    {flow.hasPartialBreakdown && <p className="qp-footnote qp-live-flow-breakdown">{t('redesign.liveFlowBreakdown')}</p>}
    <details className="qp-live-flow-data" id={`${id}-data`}>
      <summary>{t('redesign.chartData')}</summary>
      {excludedDetails && <div className="qp-live-flow-excluded-source-facts">{excludedDetails}</div>}
      <div className="qp-live-flow-table" tabIndex={0} role="region" aria-label={t('redesign.chartData')}>
        <table>
          <caption>{t('redesign.liveChart')}</caption>
          <thead><tr><th scope="col">{t('redesign.liveMinuteInterval')}</th><th scope="col">{t('history.inputCombined')}</th><th scope="col">{t('col.freshIn')}</th><th scope="col">{t('col.cacheRead')}</th><th scope="col">{t('col.cacheWrite')}</th><th scope="col">{t('col.output')}</th><th scope="col">{t('col.total')}</th><th scope="col">{t('redesign.records')}</th><th scope="col">{t('col.calls')}</th></tr></thead>
          <tbody>{flow.points.map((point, index) => <tr key={point.at} data-at={point.at} data-start={point.start} data-end={point.end} data-state={point.state} data-partial={point.partial || undefined} data-partial-breakdown={point.partialBreakdown || undefined} data-input={point.input ?? undefined} data-output={point.output ?? undefined} data-total={point.total} data-fresh-input={point.freshInput ?? undefined} data-cache-read={point.cacheRead ?? undefined} data-cache-write={point.cacheWrite ?? undefined} data-records={point.records} data-calls={point.calls}>
            <th scope="row">{date.format(point.start)} – {date.format(point.end)}<small>{state(point)}{point.partial && ` · ${partial(point, index)}`}</small></th>
            <td>{cell(point, point.input)}</td><td>{cell(point, point.freshInput)}</td><td>{cell(point, point.cacheRead)}</td><td>{cell(point, point.cacheWrite)}</td><td>{cell(point, point.output)}</td><td>{cell(point, point.total)}</td><td>{point.state === 'missing' ? '—' : number(point.records)}</td><td>{point.state === 'missing' ? '—' : number(point.calls)}</td>
          </tr>)}</tbody>
        </table>
      </div>
    </details>
  </div>;
}
