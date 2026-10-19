import { DURATION, EASE } from '../lib/motion';
import { runwayState, type QuotaWindow } from './model';

type ReadyRunway = Extract<ReturnType<typeof runwayState>, { status: 'ready' }>;
type UnavailableRunway = Extract<ReturnType<typeof runwayState>, { status: 'unavailable' }>;
export interface RunwayDisplay {
  /** Exact reading and clock used by this presentation, including a frozen stale one. */
  quota: QuotaWindow;
  at: number;
  runway: ReadyRunway;
  marker: number | null;
}
export type RunwayPresentation =
  | { kind: 'fresh' | 'stale'; contextKey: string; sampleKey: string; display: RunwayDisplay }
  | { kind: 'unavailable'; contextKey: string | null; reason: UnavailableRunway['reason'] };

/** Preserve typed exact identities; account/window alone can cross readers or resets. */
export function runwayContextKey(quota: QuotaWindow | undefined): string | null {
  return quota && Number.isFinite(quota.resetAt) && quota.resetAt > 0
    ? JSON.stringify([quota.ownerKey === undefined ? 'id' : 'ownerKey', quota.ownerKey ?? quota.id,
      quota.id, quota.sourceId ?? null, quota.origin ?? null, quota.provider ?? null, quota.window, quota.resetAt]) : null;
}

/** A keepalive confirmation changes freshness, not the forecast derivation itself. */
function forecastSampleKey(quota: QuotaWindow) {
  return JSON.stringify([quota.observedAt, quota.projectedFullAt ?? null, quota.forecastStatus ?? null,
    quota.usedPercent, quota.burnPercentPerHour ?? null]);
}

/** Pure render projection from committed state. Undefined/missing/unknown/reset clears
 * retention; stale may preserve only the last actual valid marker in this exact period.
 * Caller must resolve an exact still-present stale quota if its automatic default expires.
 * Never pass a missing selection through as the previous quota to manufacture continuity.
 */
export function nextRunwayPresentation(previous: RunwayPresentation | undefined, quota: QuotaWindow | undefined,
  now: number, staleAfterMs: number): RunwayPresentation {
  const contextKey = runwayContextKey(quota);
  const runway = runwayState(quota, now, staleAfterMs);
  if (runway.status === 'unavailable') {
    if (runway.reason === 'stale' && previous?.kind !== 'unavailable' && previous !== undefined
      && previous.contextKey === contextKey && previous.display.marker !== null)
      return { ...previous, kind: 'stale' };
    return { kind: 'unavailable', contextKey, reason: runway.reason };
  }
  const marker = runway.projectedBeforeReset && runway.projectedFullAt !== null
    ? (runway.projectedFullAt - now) / (quota!.resetAt - now) * 100 : null;
  return { kind: 'fresh', contextKey: contextKey!, sampleKey: forecastSampleKey(quota!),
    display: { quota: { ...quota! }, at: now, runway, marker } };
}

/** No initial/clock-only/stale/reset interpolation, even if a clock changes the ratio. */
export function runwayTransition(previous: RunwayPresentation | undefined, next: RunwayPresentation) {
  if (previous?.kind !== 'fresh' || next.kind !== 'fresh' || previous.contextKey !== next.contextKey
    || previous.sampleKey === next.sampleKey) return null;
  const from = previous.display.marker, to = next.display.marker;
  return from !== null && to !== null && Number.isFinite(from) && Number.isFinite(to) && from !== to
    ? { from, to } : null;
}

/** Three synchronized one-shot property animations over already committed final styles. */
export function playRunwayTransition(region: HTMLElement, from: number, to: number, duration: number = DURATION.slow) {
  const active = new Set<Animation>();
  const dispose = (animation: Animation) => {
    if (!active.delete(animation)) return;
    animation.removeEventListener('finish', finished);
    animation.removeEventListener('cancel', finished);
    animation.cancel();
  };
  const finished = (event: Event) => dispose(event.currentTarget as Animation);
  if (duration > 0 && Number.isFinite(from) && Number.isFinite(to) && from !== to) {
    for (const [selector, property] of [['.qp-runway-fill', 'width'], ['.qp-runway-risk', 'left'], ['.qp-runway-marker', 'left']] as const) {
      const target = region.querySelector<HTMLElement>(selector);
      if (!target || typeof target.animate !== 'function') continue;
      const animation = target.animate([{ [property]: `${from}%` }, { [property]: `${to}%` }],
        { duration, easing: `cubic-bezier(${EASE.motion.join(',')})`, iterations: 1, fill: 'none' });
      active.add(animation);
      animation.addEventListener('finish', finished);
      animation.addEventListener('cancel', finished);
    }
  }
  return () => { for (const animation of [...active]) dispose(animation); };
}
