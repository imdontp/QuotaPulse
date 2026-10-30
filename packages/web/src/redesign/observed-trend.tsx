import { useId, type SVGProps } from 'react';
import { observedTrendRuns, type ObservedPoint } from './observed-trend-runs';
import './observed-trend.css';

/** Straight segments retain bucket values; the complete data table is rendered by the caller. */
export function ObservedTrend({ points, label, className, language, area = true, grid = true, edgeToEdge = false, bucketCenters = false, nativeTitles = true, pointTitle, inspection, guideIndices = [] }: {
  points: readonly ObservedPoint[];
  label: string;
  className: string;
  language: 'en' | 'th';
  area?: boolean;
  grid?: boolean;
  edgeToEdge?: boolean;
  bucketCenters?: boolean;
  nativeTitles?: boolean;
  guideIndices?: readonly number[];
  pointTitle?: (point: { at: number; value: number; index: number }) => string;
  inspection?: { index: number | null; help: string } & Pick<SVGProps<SVGSVGElement>, 'onFocus' | 'onBlur' | 'onKeyDown' | 'onPointerMove' | 'onPointerLeave'>;
}) {
  const id = useId().replace(/:/g, '');
  const runs = observedTrendRuns(points);
  const maximum = Math.max(0, ...runs.flatMap(run => run.map(point => point.value)));
  const x = (index: number) => bucketCenters ? 1000 * (index + 0.5) / Math.max(1, points.length) : 8 + 984 * index / Math.max(1, points.length - 1);
  const y = (value: number) => edgeToEdge ? 100 - 100 * value / (maximum || 1) : 94 - 88 * value / (maximum || 1);
  const line = (run: (typeof runs)[number]) => run.map(point => `${x(point.index)},${y(point.value)}`).join(' ');
  const locale = language === 'th' ? 'th-TH' : 'en-US';
  const selected = inspection?.index !== null && inspection?.index !== undefined ? points[inspection.index] : null;
  const pointDescriptions = pointTitle ? runs.flatMap(run => run.map(pointTitle)).join('; ') : '';
  return <svg className={`qp-observed-trend ${className}`} viewBox="0 0 1000 100" preserveAspectRatio="none" role={inspection ? 'group' : 'img'} tabIndex={inspection ? 0 : undefined} aria-label={label} aria-describedby={inspection ? `${id}-help` : pointDescriptions ? `${id}-data` : undefined}
    onFocus={inspection?.onFocus} onBlur={inspection?.onBlur} onKeyDown={inspection?.onKeyDown} onPointerMove={inspection?.onPointerMove} onPointerLeave={inspection?.onPointerLeave}>
    {inspection && <desc id={`${id}-help`}>{inspection.help}</desc>}
    {pointDescriptions && <desc id={`${id}-data`}>{pointDescriptions}</desc>}
    <defs><linearGradient id={`${id}-area`} x1="0" y1="0" x2="0" y2="1"><stop stopColor="var(--qp-accent)" stopOpacity=".28"/><stop offset="1" stopColor="var(--qp-accent)" stopOpacity="0"/></linearGradient><filter id={`${id}-glow`} x="-10%" y="-50%" width="120%" height="200%"><feGaussianBlur stdDeviation="1.5"/><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
    {grid && [6, 28, 50, 72, 94].map(value => <line key={value} x1="8" x2="992" y1={value} y2={value} stroke="var(--qp-border)" strokeDasharray="2 4" vectorEffect="non-scaling-stroke"/>)}
    {guideIndices.map(index => <line key={index} className="qp-observed-time-guide" data-index={index} x1={x(index)} x2={x(index)} y1="6" y2="94" stroke="var(--qp-border)" strokeDasharray="2 4" vectorEffect="non-scaling-stroke" aria-hidden="true"/>)}
    {area && runs.filter(run => run.length > 1).map(run => <polygon key={run[0].index} points={`${x(run[0].index)},${y(0)} ${line(run)} ${x(run.at(-1)!.index)},${y(0)}`} fill={`url(#${id}-area)`}/>)}
    {(points.length === 0 ? [[]] : runs).map((run, index) => <polyline key={index} className="qp-observed-line" points={line(run)} fill="none" stroke="var(--qp-accent)" strokeWidth="2" vectorEffect="non-scaling-stroke" filter={`url(#${id}-glow)`}/>)}
    {runs.flatMap(run => run.map(point => <circle key={point.at} data-at={point.at} data-value={point.value} cx={x(point.index)} cy={y(point.value)} r="2" fill="var(--qp-accent)" aria-hidden={inspection ? true : undefined}>{!inspection && nativeTitles && <title>{pointTitle ? pointTitle(point) : <>{new Date(point.at).toLocaleString(locale)} · {point.value.toLocaleString(locale)}</>}</title>}</circle>))}
    {selected && selected.value !== null && Number.isFinite(selected.value) && <g className="qp-observed-inspection" aria-hidden="true"><line x1={x(inspection!.index!)} x2={x(inspection!.index!)} y1="6" y2="94" vectorEffect="non-scaling-stroke"/><circle cx={x(inspection!.index!)} cy={y(selected.value)} r="3" vectorEffect="non-scaling-stroke"/></g>}
  </svg>;
}
