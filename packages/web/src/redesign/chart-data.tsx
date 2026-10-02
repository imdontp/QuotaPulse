import type { RedesignTranslate } from './shell';
import './chart-data.css';

/** Complete bucket series, including zero buckets, outside the chart image. */
export function ChartData({ title, points, language, t, valueLabel = t('redesign.tokens') }: {
  title: string; points: Array<{ at: number; value: number }>; valueLabel?: string;
  language: 'en' | 'th'; t: RedesignTranslate;
}) {
  const locale = language === 'th' ? 'th-TH' : 'en-US';
  const number = (value: number) => new Intl.NumberFormat(locale).format(value);
  const stamp = (at: number) => new Date(at).toLocaleString(locale);
  const multipleDates = points.length > 1 && new Date(points[0].at).toLocaleDateString(locale) !== new Date(points.at(-1)!.at).toLocaleDateString(locale);
  const clock = (at: number) => new Intl.DateTimeFormat(locale, { ...(multipleDates ? { month: 'short', day: 'numeric' } as const : {}), hour: '2-digit', minute: '2-digit' }).format(at);
  const maximum = Math.max(0, ...points.map(point => point.value));
  return <div className="qp-chart-access">
    <div className="qp-chart-scale"><span>{valueLabel}: {number(0)} – {number(maximum)}</span>
      {points.length > 0 && <span><time dateTime={new Date(points[0].at).toISOString()} title={stamp(points[0].at)}>{clock(points[0].at)}</time> – <time dateTime={new Date(points.at(-1)!.at).toISOString()} title={stamp(points.at(-1)!.at)}>{clock(points.at(-1)!.at)}</time></span>}
    </div>
    <details className="qp-chart-data"><summary>{t('redesign.chartData')} ({number(points.length)})</summary><div>
      <table><caption>{title}</caption><thead><tr><th scope="col">{t('redesign.chartBucketStart')}</th><th scope="col">{valueLabel}</th></tr></thead>
        <tbody>{points.map(point => <tr key={point.at} data-at={point.at} data-value={point.value}><td><time dateTime={new Date(point.at).toISOString()}>{stamp(point.at)}</time></td><td>{number(point.value)}</td></tr>)}</tbody>
      </table>
    </div></details>
  </div>;
}
