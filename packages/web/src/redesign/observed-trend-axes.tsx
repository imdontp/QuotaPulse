import { useEffect, useState } from 'react';
import { useT } from '@/i18n';
import { ObservedTrend } from './observed-trend';
import './observed-trend-axes.css';

/** Axes use the same bucket indices and scale as the shared recorded-value plot. */
export function ObservedTrendAxes({ points, bucketMs, language, label, valueLabel, className, tickCount = 5 }: {
  points: Array<{ at: number; value: number }>; bucketMs: number;
  language: 'en' | 'th'; label: string; valueLabel: string; className: string; tickCount?: 3 | 5;
}) {
  const t = useT();
  const [active, setActive] = useState<{ key: string; index: number; kind: 'pointer' | 'keyboard'; left: number; top: number } | null>(null);
  const locale = language === 'th' ? 'th-TH' : 'en-US';
  const maximum = Math.max(0, ...points.map(point => point.value));
  const number = new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 });
  const fullNumber = new Intl.NumberFormat(locale);
  const first = points[0]?.at, last = points.at(-1)?.at;
  const scopeKey = JSON.stringify([location.hash, label, valueLabel, bucketMs, first, last]);
  useEffect(() => setActive(null), [scopeKey]);
  useEffect(() => {
    const dismiss = () => setActive(null);
    window.addEventListener('scroll', dismiss, true); window.addEventListener('resize', dismiss);
    return () => { window.removeEventListener('scroll', dismiss, true); window.removeEventListener('resize', dismiss); };
  }, []);
  const current = active?.key === scopeKey && points[active.index] ? active : null;
  const activate = (index: number, kind: 'pointer' | 'keyboard', chart: SVGSVGElement) => {
    if (!points[index]) return;
    const bounds = chart.getBoundingClientRect();
    const panel = chart.parentElement!.parentElement!.getBoundingClientRect();
    const pointY = bounds.top + (94 - 88 * points[index].value / (maximum || 1)) / 100 * bounds.height;
    const above = pointY - 92, below = pointY + 12;
    const top = above >= Math.max(8, panel.top + 8) ? above : below + 80 <= Math.min(innerHeight - 8, panel.bottom - 8) ? below : above >= 8 ? above : below;
    const next = { key: scopeKey, index, kind,
      left: Math.max(8, Math.min(innerWidth - 188, Math.max(panel.left + 8, Math.min(panel.right - 188, bounds.left + (.008 + .984 * index / Math.max(1, points.length - 1)) * bounds.width - 40)))),
      top: Math.max(8, Math.min(innerHeight - 112, top)) };
    setActive(previous => previous?.key === next.key && previous.index === next.index && previous.kind === next.kind && previous.left === next.left && previous.top === next.top ? previous : next);
  };
  const acrossDates = first !== undefined && last !== undefined
    && new Date(first).toDateString() !== new Date(last).toDateString();
  const acrossYears = first !== undefined && last !== undefined
    && new Date(first).getFullYear() !== new Date(last).getFullYear();
  const stamp = new Intl.DateTimeFormat(locale, {
    ...(acrossDates || bucketMs >= 86_400_000 ? { month: 'short', day: 'numeric' } as const : {}),
    ...(acrossYears ? { year: 'numeric' } as const : {}),
    ...(bucketMs < 86_400_000 ? { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' } as const : {}),
  });
  const indices = points.length <= tickCount ? points.map((_, index) => index)
    : Array.from({ length: tickCount }, (_, index) => Math.round(index * (points.length - 1) / (tickCount - 1)));
  return <div className={`qp-observed-trend-axes ${className}-axes`} data-trend-scope={scopeKey} data-value-label={valueLabel}>
    <div className="qp-trend-y" aria-hidden="true">
      {(maximum > 0 ? [1, .75, .5, .25, 0] : [0]).map(fraction => {
        const value = maximum * fraction;
        return <span key={fraction} data-axis-value={value} title={fullNumber.format(value)} style={{ top: `${94 - 88 * fraction}%` }}>{number.format(value)}</span>;
      })}
    </div>
    <ObservedTrend className={className} points={points} language={language} label={label} inspection={points.length ? {
      index: current?.index ?? null, help: t('history.timelineHelp'),
      onFocus: event => activate(current?.index ?? 0, current?.kind ?? 'keyboard', event.currentTarget), onBlur: () => setActive(null),
      onKeyDown: event => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End', 'Escape'].includes(event.key)) return;
        event.preventDefault(); event.stopPropagation();
        if (event.key === 'Escape') setActive(null);
        else activate(event.key === 'Home' ? 0 : event.key === 'End' ? points.length - 1 : event.key === 'ArrowRight' ? Math.min(points.length - 1, (current?.index ?? -1) + 1) : Math.max(0, (current?.index ?? points.length) - 1), 'keyboard', event.currentTarget);
      },
      onPointerMove: event => {
        const bounds = event.currentTarget.getBoundingClientRect(), x = (event.clientX - bounds.left) / bounds.width;
        if (x < .008 || x > .992) { setActive(previous => previous?.kind === 'pointer' ? null : previous); return; }
        activate(Math.max(0, Math.min(points.length - 1, Math.round((x - .008) / .984 * (points.length - 1)))), 'pointer', event.currentTarget);
      },
      onPointerLeave: () => setActive(previous => previous?.kind === 'pointer' ? null : previous),
    } : undefined}/>
    {current && <div className="qp-trend-inspection-tooltip" role="status" data-at={points[current.index].at} style={{ left: current.left, top: current.top }}>
      <small>{t('redesign.chartBucketStart')}</small><time dateTime={new Date(points[current.index].at).toISOString()}>{new Date(points[current.index].at).toLocaleString(locale)}</time>
      <dl><dt>{valueLabel}</dt><dd data-value={points[current.index].value} title={points[current.index].value.toLocaleString(locale, { maximumFractionDigits: 20 })}>{number.format(points[current.index].value)}</dd></dl>
    </div>}
    <div className="qp-trend-x" aria-hidden="true">
      {indices.map((index, order) => <time key={points[index].at} data-axis-at={points[index].at} data-axis-index={index}
        dateTime={new Date(points[index].at).toISOString()} title={new Date(points[index].at).toLocaleString(locale)}
        data-edge={order === 0 ? 'first' : order === indices.length - 1 ? 'last' : undefined}
        style={{ left: `${.8 + 98.4 * index / Math.max(1, points.length - 1)}%` }}>{stamp.format(points[index].at)}</time>)}
    </div>
  </div>;
}
