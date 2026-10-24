import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import type { CostAnalysisResponse } from '@/api';
import type { RedesignTranslate } from './shell';
import { CostValue } from './cost-value';
import { ObservedTrend } from './observed-trend';

type PlotBounds = Pick<DOMRect, 'left' | 'top' | 'width' | 'height'>;
const sameBounds = (a: PlotBounds, b: PlotBounds) => a.left === b.left && a.top === b.top && a.width === b.width && a.height === b.height;

/** The two recorded scales remain fixed while inspecting a shared bucket. */
export function CostTrendPlot({ points, scopeKey, label, help, basisLabel, language, money, t }: {
  points: CostAnalysisResponse['points']; scopeKey: string; label: string; help: string; basisLabel: string;
  language: 'en' | 'th'; money: (amount: number) => string; t: RedesignTranslate;
}) {
  const helpId = useId();
  const chart = useRef<HTMLDivElement>(null);
  const tooltip = useRef<HTMLElement>(null);
  const anchor = useRef<PlotBounds | null>(null);
  const [active, setActive] = useState<{ key: string; index: number; kind: 'pointer' | 'keyboard' } | null>(null);
  const [position, setPosition] = useState({ left: 8, top: 8 });
  const [amountMark, setAmountMark] = useState({ x: 0, y: 0 });
  const locale = language === 'th' ? 'th-TH' : 'en-US';
  const number = new Intl.NumberFormat(locale);
  const maximumAmount = Math.max(0, ...points.map(point => point.amount));
  const maximumTokens = Math.max(0, ...points.map(point => point.pricedTokens));
  const current = active?.key === scopeKey && points[active.index] ? active : null;
  const selected = current ? points[current.index] : null;
  const x = current ? (current.index + .5) / points.length : 0;
  const amountY = selected ? 1 - selected.amount / (maximumAmount || 1) : 0;
  const tokenY = selected ? 1 - selected.pricedTokens / (maximumTokens || 1) : 0;
  useEffect(() => {
    const dismiss = () => { anchor.current = null; setActive(null); };
    const scroll = () => {
      const bounds = chart.current?.getBoundingClientRect();
      // Delayed focus scrolling and unrelated table scrolling can notify us
      // after selection. Only movement of the inspected plot invalidates it.
      if (bounds && anchor.current && !sameBounds(bounds, anchor.current)) dismiss();
    };
    window.addEventListener('scroll', scroll, true); window.addEventListener('resize', dismiss);
    return () => { window.removeEventListener('scroll', scroll, true); window.removeEventListener('resize', dismiss); };
  }, []);
  useLayoutEffect(() => {
    if (!current || !chart.current || !tooltip.current) return;
    const bounds = chart.current.getBoundingClientRect(), box = tooltip.current.getBoundingClientRect();
    anchor.current = bounds;
    const bar = chart.current.querySelectorAll('.qp-cost-column')[current.index]?.getBoundingClientRect();
    const barX = bar ? bar.left + bar.width / 2 : bounds.left + x * bounds.width;
    const barY = bar?.top ?? bounds.top + amountY * bounds.height;
    const nextMark = { x: (barX - bounds.left) / bounds.width * 1000, y: (barY - bounds.top) / bounds.height * 100 };
    setAmountMark(previous => previous.x === nextMark.x && previous.y === nextMark.y ? previous : nextMark);
    const pointX = bounds.left + x * bounds.width;
    const upper = Math.min(barY, bounds.top + tokenY * bounds.height);
    const lower = Math.max(barY, bounds.top + tokenY * bounds.height);
    // Place beside both selected marks; narrow plots use the space above/below.
    let left = pointX + 14, top = Math.max(8, upper - box.height / 2);
    if (left + box.width > Math.min(innerWidth - 8, bounds.right)) left = pointX - box.width - 14;
    if (left < Math.max(8, bounds.left)) {
      left = Math.max(8, Math.min(innerWidth - box.width - 8, pointX - box.width / 2));
      top = upper - box.height - 14 >= 8 ? upper - box.height - 14 : lower + 14;
    }
    const next = { left: Math.max(8, Math.min(innerWidth - box.width - 8, left)), top: Math.max(8, Math.min(innerHeight - box.height - 8, top)) };
    setPosition(previous => previous.left === next.left && previous.top === next.top ? previous : next);
  }, [current, scopeKey, x, amountY, tokenY, language, basisLabel, money, selected]);
  const activate = (index: number, kind: 'pointer' | 'keyboard') => {
    if (!points[index]) return;
    const bounds = chart.current?.getBoundingClientRect(), moved = bounds && anchor.current && !sameBounds(bounds, anchor.current);
    anchor.current = bounds ?? null;
    setActive(previous => !moved && previous?.key === scopeKey && previous.index === index && previous.kind === kind ? previous : { key: scopeKey, index, kind });
  };
  return <div ref={chart} className="qp-cost-chart" role="group" tabIndex={0} aria-label={label} aria-describedby={helpId}
    onFocus={() => activate(current?.index ?? 0, current?.kind ?? 'keyboard')}
    onBlur={() => { anchor.current = null; setActive(null); }}
    onKeyDown={event => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End', 'Escape'].includes(event.key)) return;
      event.preventDefault(); event.stopPropagation();
      if (event.key === 'Escape') { anchor.current = null; setActive(null); }
      else activate(event.key === 'Home' ? 0 : event.key === 'End' ? points.length - 1 : event.key === 'ArrowRight' ? Math.min(points.length - 1, (current?.index ?? -1) + 1) : Math.max(0, (current?.index ?? points.length) - 1), 'keyboard');
    }}
    onPointerMove={event => {
      const bounds = event.currentTarget.getBoundingClientRect();
      activate(Math.max(0, Math.min(points.length - 1, Math.floor((event.clientX - bounds.left) / bounds.width * points.length))), 'pointer');
    }} onPointerLeave={() => setActive(previous => previous?.kind === 'pointer' ? null : previous)}>
    <span id={helpId} className="qp-cost-inspection-help">{help}</span>
    {points.map(point => <div key={point.start}><span className="qp-cost-column" style={{ height: `${point.amount / (maximumAmount || 1) * 100}%` }}/></div>)}
    <ObservedTrend className="qp-cost-token-line" language={language} points={points.map(point => ({ at: point.start, value: point.pricedTokens }))} label={t('redesign.costPricedTokens')} area={false} grid={false} edgeToEdge bucketCenters nativeTitles={false}/>
    {selected && <svg className="qp-cost-inspection-marks" viewBox="0 0 1000 100" preserveAspectRatio="none" aria-hidden="true">
      <line x1={x * 1000} x2={x * 1000} y1="0" y2="100"/>
      <circle data-series="amount" cx={amountMark.x} cy={amountMark.y} r="3"/>
      <circle data-series="tokens" cx={x * 1000} cy={tokenY * 100} r="3"/>
    </svg>}
    {selected && <aside ref={tooltip} className="qp-cost-inspection-tooltip" role="status" data-at={selected.start} style={position}>
      <small>{t('redesign.chartBucketStart')}</small><time dateTime={new Date(selected.start).toISOString()}>{new Date(selected.start).toLocaleString(locale)}</time>
      <dl><dt>{basisLabel}</dt><dd data-amount={selected.amount}><CostValue amount={selected.amount} priced={selected.pricedCalls} total={selected.allCalls} money={money} t={t}/></dd>
      <dt>{t('redesign.costPricedTokens')}</dt><dd data-tokens={selected.pricedTokens}>{number.format(selected.pricedTokens)}</dd>
      <dt>{t('redesign.costCoverage')}</dt><dd data-priced-calls={selected.pricedCalls} data-all-calls={selected.allCalls}>{number.format(selected.pricedCalls)} / {number.format(selected.allCalls)}</dd></dl>
    </aside>}
  </div>;
}
