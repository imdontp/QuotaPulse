import { useId, useMemo } from 'react';
import type { MessageKey } from '@/i18n/en';
import { liveTokenFlow, liveTokenFlowSegments, liveTokenFlowX, liveTokenFlowY, type LiveTokenFlowPoint, type LiveTokenFlowResponse, type LiveTokenFlowSeries } from './live-token-flow-data';
import './live-token-flow.css';

type Translate = (key: MessageKey) => string;
const labels: Record<LiveTokenFlowSeries, MessageKey> = { input: 'history.inputCombined', output: 'col.output', total: 'col.total' };
const series: readonly LiveTokenFlowSeries[] = ['input', 'output', 'total'];

/** Place this beside the existing Live heading when the plot renders with showLegend=false. */
export function LiveTokenFlowLegend({ t }: { t: Translate }) {
  return <div className="qp-live-flow-legend">{series.map(key => <span key={key} data-series={key}><i aria-hidden="true"/>{t(labels[key])}</span>)}</div>;
}

export function LiveTokenFlow({ data, language, t, showLegend = true }: {
  data: LiveTokenFlowResponse;
  language: 'en' | 'th';
  t: Translate;
  showLegend?: boolean;
}) {
  const flow = useMemo(() => liveTokenFlow(data), [data]);
  const id = useId().replace(/:/g, '');
  const locale = language === 'th' ? 'th-TH' : 'en-US';
  const number = (value: number) => value.toLocaleString(locale);
  const date = new Intl.DateTimeFormat(locale, { dateStyle: 'short', timeStyle: 'medium' });
  const clock = new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const x = (index: number) => liveTokenFlowX(index, flow.points.length);
  const y = (value: number) => liveTokenFlowY(value, flow.maximum);
  const state = (point: LiveTokenFlowPoint) => t(point.state === 'missing' ? 'redesign.liveMinuteMissing' : point.state === 'zero' ? 'redesign.liveMinuteZero' : 'redesign.liveMinuteRecorded');
  const cell = (point: LiveTokenFlowPoint, value: number | null) => point.state === 'missing' ? '—' : value === null ? t('redesign.unknownValue') : number(value);
  const partial = (point: LiveTokenFlowPoint, index: number) => t(index === flow.points.length - 1 && point.end === data.to && point.end % 60000 !== 0 ? 'redesign.liveMinuteCurrent' : 'redesign.liveMinutePartial');
  const describe = (point: LiveTokenFlowPoint, key: LiveTokenFlowSeries, index: number) => `${date.format(point.start)} – ${date.format(point.end)} · ${state(point)} · ${t(labels[key])}: ${cell(point, point[key])}${point.partial ? ` · ${partial(point, index)}` : ''}`;

  return <div className="qp-live-token-flow" data-maximum={flow.maximum}>
    {showLegend && <LiveTokenFlowLegend t={t}/>}
    <div className="qp-live-flow-plot" role="img" aria-label={`${t('redesign.liveChart')} · ${series.map(key => t(labels[key])).join(' · ')} · 0 – ${number(flow.maximum)}`} aria-describedby={`${id}-data`}>
      {/* The total SVG retains the existing total-point selector; the other traces use separate SVGs. */}
      <svg className="qp-live-chart qp-live-flow-total" viewBox="0 0 1000 100" preserveAspectRatio="none" aria-hidden="true">
        <defs><linearGradient id={`${id}-area`} x1="0" y1="0" x2="0" y2="1"><stop stopColor="var(--qp-flow-total)" stopOpacity=".18"/><stop offset="1" stopColor="var(--qp-flow-total)" stopOpacity="0"/></linearGradient><filter id={`${id}-glow`} x="-5%" y="-50%" width="110%" height="200%"><feGaussianBlur stdDeviation="1"/><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
        {[6, 28, 50, 72, 94].map(value => <line key={value} x1="8" x2="992" y1={value} y2={value} stroke="var(--qp-border)" strokeDasharray="2 4" vectorEffect="non-scaling-stroke"/>)}
        {flow.points.length > 1 && <polygon points={`${x(0)},94 ${flow.points.map((point, index) => `${x(index)},${y(point.total)}`).join(' ')} ${x(flow.points.length - 1)},94`} fill={`url(#${id}-area)`}/>}
        <polyline className="qp-live-flow-line" data-series="total" points={flow.points.map((point, index) => `${x(index)},${y(point.total)}`).join(' ')} fill="none" stroke="var(--qp-flow-total)" strokeWidth="2" vectorEffect="non-scaling-stroke" filter={`url(#${id}-glow)`}/>
        {flow.points.map((point, index) => <circle key={point.at} data-series="total" data-at={point.at} data-value={point.total} data-state={point.state} data-partial={point.partial || undefined} cx={x(index)} cy={y(point.total)} r="2" fill="var(--qp-flow-total)"><title>{describe(point, 'total', index)}</title></circle>)}
      </svg>
      {(['input', 'output'] as const).map(key => <svg key={key} className={`qp-live-flow-component qp-live-flow-${key}`} viewBox="0 0 1000 100" preserveAspectRatio="none" aria-hidden="true">
        {liveTokenFlowSegments(flow.points, key).map((segment, index) => <polyline key={index} className="qp-live-flow-line" data-series={key} points={segment.map(point => `${x(point.index)},${y(point.value)}`).join(' ')} fill="none" stroke={`var(--qp-flow-${key})`} strokeWidth="1.8" vectorEffect="non-scaling-stroke"/>)}
        {flow.points.map((point, index) => point[key] === null ? null : <circle key={point.at} data-series={key} data-at={point.at} data-value={point[key]} data-state={point.state} data-partial={point.partial || undefined} cx={x(index)} cy={y(point[key]!)} r="1.6" fill={`var(--qp-flow-${key})`}><title>{describe(point, key, index)}</title></circle>)}
      </svg>)}
    </div>
    {!!flow.points.length && <div className="qp-live-flow-axis"><span>{clock.format(flow.points[0]!.start)}</span><span>{clock.format(flow.points[flow.points.length - 1]!.start)}{flow.points[flow.points.length - 1]!.partial && ` · ${partial(flow.points[flow.points.length - 1]!, flow.points.length - 1)}`}</span></div>}
    {flow.hasPartialBreakdown && <p className="qp-footnote qp-live-flow-breakdown">{t('redesign.liveFlowBreakdown')}</p>}
    <details className="qp-live-flow-data" id={`${id}-data`}>
      <summary>{t('redesign.chartData')}</summary>
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
