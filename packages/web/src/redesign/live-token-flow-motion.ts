import { EASE } from '../lib/motion';
import { liveTokenFlowX, liveTokenFlowY, liveTokenFlowSegments, type LiveTokenFlowPoint } from './live-token-flow-data';

export interface MinuteFlowSnapshot {
  scopeKey: string;
  from: number;
  to: number;
  maximum: number;
  points: readonly LiveTokenFlowPoint[];
}
export interface MinuteFlowTransition { selector: string; attribute: 'points' | 'cy'; from: string; to: string }

/** Only prior actual readings in the same numeric domain may provide a start value.
 * Rolling-window x positions snap to their newly accepted timestamps; axes never tween.
 * New/removed/missing/unknown points never acquire a fabricated prior observation.
 */
export function minuteFlowTransitions(previous: MinuteFlowSnapshot | undefined, next: MinuteFlowSnapshot): MinuteFlowTransition[] {
  if (!previous || previous.scopeKey !== next.scopeKey || previous.maximum !== next.maximum) return [];
  const before = new Map(previous.points.map(point => [point.at, point]));
  const x = (point: { start: number }) => liveTokenFlowX(point.start, next.from, next.to);
  const y = (value: number) => liveTokenFlowY(value, next.maximum);
  const result: MinuteFlowTransition[] = [];
  for (const series of ['total', 'input', 'output'] as const) {
    const oldValues = new Map<number, number>();
    for (const point of next.points) {
      const old = before.get(point.at);
      const value = old?.[series];
      const current = point[series];
      if (old && old.records > 0 && point.records > 0 && value !== null && value !== undefined && current !== null
        && Number.isFinite(value) && Number.isFinite(current) && value !== current) {
        oldValues.set(point.at, value);
        result.push({ selector: `circle[data-series="${series}"][data-at="${point.at}"]`, attribute: 'cy', from: String(y(value)), to: String(y(current)) });
      }
    }
    if (!oldValues.size) continue;
    const coordinates = (points: readonly { at: number; start: number; value: number }[], old: boolean) => points
      .map(point => `${x(point)},${y(old ? oldValues.get(point.at) ?? point.value : point.value)}`).join(' ');
    if (series === 'total') {
      const points = next.points.map(point => ({ ...point, value: point.total }));
      const from = coordinates(points, true), to = coordinates(points, false);
      result.push({ selector: 'polyline[data-series="total"]', attribute: 'points', from, to });
      if (points.length > 1) result.push({ selector: '.qp-live-flow-total polygon', attribute: 'points',
        from: `${x(points[0]!)},94 ${from} ${x(points[points.length - 1]!)},94`,
        to: `${x(points[0]!)},94 ${to} ${x(points[points.length - 1]!)},94` });
    } else liveTokenFlowSegments(next.points, series).forEach((segment, index) => {
      if (segment.some(point => oldValues.has(point.at))) result.push({ selector: `.qp-live-flow-${series} polyline[data-segment="${index}"]`, attribute: 'points',
        from: coordinates(segment, true), to: coordinates(segment, false) });
    });
  }
  return result;
}

/** One bounded SVG batch. Base attributes always contain the accepted final facts.
 * SMIL interpolates SVG point lists directly; CSS/WAAPI cannot reliably do that.
 * No fill, loop, timer, frame callback or replay queue survives completion/cancel.
 */
export function playMinuteFlowTransitions(region: HTMLElement, changes: readonly MinuteFlowTransition[], duration: number) {
  const active = new Set<SVGAnimateElement>();
  const dispose = (animation: SVGAnimateElement, stop: boolean) => {
    if (!active.delete(animation)) return;
    animation.removeEventListener('endEvent', ended);
    if (stop) { try { animation.endElement(); } catch { /* Already ended or detached. */ } }
    animation.remove();
  };
  const ended = (event: Event) => dispose(event.currentTarget as SVGAnimateElement, false);
  if (duration > 0) for (const change of changes) {
    const target = region.querySelector(change.selector);
    if (!target) continue;
    const animation = region.ownerDocument.createElementNS('http://www.w3.org/2000/svg', 'animate');
    if (typeof animation.beginElement !== 'function') continue;
    animation.setAttribute('attributeName', change.attribute);
    animation.setAttribute('from', change.from);
    animation.setAttribute('to', change.to);
    animation.setAttribute('dur', `${duration}ms`);
    animation.setAttribute('begin', 'indefinite');
    animation.setAttribute('repeatCount', '1');
    animation.setAttribute('fill', 'remove');
    animation.setAttribute('calcMode', 'spline');
    animation.setAttribute('keyTimes', '0;1');
    animation.setAttribute('keySplines', EASE.motion.join(' '));
    active.add(animation);
    animation.addEventListener('endEvent', ended);
    target.appendChild(animation);
    try { animation.beginElement(); } catch { dispose(animation, true); }
  }
  return () => { for (const animation of [...active]) dispose(animation, true); };
}
