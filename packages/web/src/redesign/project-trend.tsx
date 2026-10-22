import { ObservedTrend } from './observed-trend';

/** Axes use the same bucket indices and scale as the shared recorded-value plot. */
export function ProjectTrend({ points, bucketMs, language, label }: {
  points: Array<{ at: number; value: number }>; bucketMs: number;
  language: 'en' | 'th'; label: string;
}) {
  const locale = language === 'th' ? 'th-TH' : 'en-US';
  const maximum = Math.max(0, ...points.map(point => point.value));
  const number = new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 });
  const fullNumber = new Intl.NumberFormat(locale);
  const first = points[0]?.at, last = points.at(-1)?.at;
  const acrossDates = first !== undefined && last !== undefined
    && new Date(first).toDateString() !== new Date(last).toDateString();
  const acrossYears = first !== undefined && last !== undefined
    && new Date(first).getFullYear() !== new Date(last).getFullYear();
  const stamp = new Intl.DateTimeFormat(locale, {
    ...(acrossDates || bucketMs >= 86_400_000 ? { month: 'short', day: 'numeric' } as const : {}),
    ...(acrossYears ? { year: 'numeric' } as const : {}),
    ...(bucketMs < 86_400_000 ? { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' } as const : {}),
  });
  const indices = points.length <= 5 ? points.map((_, index) => index)
    : Array.from({ length: 5 }, (_, index) => Math.round(index * (points.length - 1) / 4));
  return <div className="qp-project-trend-axes">
    <div className="qp-project-trend-y" aria-hidden="true">
      {(maximum > 0 ? [1, .75, .5, .25, 0] : [0]).map(fraction => {
        const value = maximum * fraction;
        return <span key={fraction} data-axis-value={value} title={fullNumber.format(value)} style={{ top: `${94 - 88 * fraction}%` }}>{number.format(value)}</span>;
      })}
    </div>
    <ObservedTrend className="qp-project-trend" points={points} language={language} label={label}/>
    <div className="qp-project-trend-x" aria-hidden="true">
      {indices.map((index, order) => <time key={points[index].at} data-axis-at={points[index].at} data-axis-index={index}
        dateTime={new Date(points[index].at).toISOString()} title={new Date(points[index].at).toLocaleString(locale)}
        data-edge={order === 0 ? 'first' : order === indices.length - 1 ? 'last' : undefined}
        style={{ left: `${.8 + 98.4 * index / Math.max(1, points.length - 1)}%` }}>{stamp.format(points[index].at)}</time>)}
    </div>
  </div>;
}
