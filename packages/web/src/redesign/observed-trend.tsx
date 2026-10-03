import { useId } from 'react';
import './observed-trend.css';

/** Straight segments retain bucket values; the complete data table is rendered by the caller. */
export function ObservedTrend({ points, label, className, language, area = true, grid = true, edgeToEdge = false, bucketCenters = false }: {
  points: readonly { at: number; value: number }[];
  label: string;
  className: string;
  language: 'en' | 'th';
  area?: boolean;
  grid?: boolean;
  edgeToEdge?: boolean;
  bucketCenters?: boolean;
}) {
  const id = useId().replace(/:/g, '');
  const maximum = Math.max(0, ...points.map(point => point.value));
  const x = (index: number) => bucketCenters ? 1000 * (index + 0.5) / Math.max(1, points.length) : 8 + 984 * index / Math.max(1, points.length - 1);
  const y = (value: number) => edgeToEdge ? 100 - 100 * value / (maximum || 1) : 94 - 88 * value / (maximum || 1);
  const line = points.map((point, index) => `${x(index)},${y(point.value)}`).join(' ');
  const locale = language === 'th' ? 'th-TH' : 'en-US';
  return <svg className={`qp-observed-trend ${className}`} viewBox="0 0 1000 100" preserveAspectRatio="none" role="img" aria-label={label}>
    <defs><linearGradient id={`${id}-area`} x1="0" y1="0" x2="0" y2="1"><stop stopColor="var(--qp-accent)" stopOpacity=".28"/><stop offset="1" stopColor="var(--qp-accent)" stopOpacity="0"/></linearGradient><filter id={`${id}-glow`} x="-10%" y="-50%" width="120%" height="200%"><feGaussianBlur stdDeviation="1.5"/><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
    {grid && [6, 28, 50, 72, 94].map(value => <line key={value} x1="8" x2="992" y1={value} y2={value} stroke="var(--qp-border)" strokeDasharray="2 4" vectorEffect="non-scaling-stroke"/>)}
    {area && points.length > 1 && <polygon points={`${x(0)},${y(0)} ${line} ${x(points.length - 1)},${y(0)}`} fill={`url(#${id}-area)`}/>}
    <polyline className="qp-observed-line" points={line} fill="none" stroke="var(--qp-accent)" strokeWidth="2" vectorEffect="non-scaling-stroke" filter={`url(#${id}-glow)`}/>
    {points.map((point, index) => <circle key={point.at} data-at={point.at} data-value={point.value} cx={x(index)} cy={y(point.value)} r="2" fill="var(--qp-accent)"><title>{new Date(point.at).toLocaleString(locale)} · {point.value.toLocaleString(locale)}</title></circle>)}
  </svg>;
}
