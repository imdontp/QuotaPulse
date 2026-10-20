import { DURATION, EASE } from '../lib/motion';
import type { UsageEventRow } from '../lib/usage-events';

/** Exact recorded identity, independent of localized labels and mutable token totals. */
export function historyRecordMotionKey(row: Pick<UsageEventRow, 'event_id' | 'source_id' | 'session_key' | 'timestamp_ms'>) {
  return JSON.stringify([row.event_id, row.source_id, row.session_key, row.timestamp_ms]);
}
export interface HistoryPageObservation { context: string; identities: readonly string[] }
/** Bounded preceding accepted page only. A presence absent from that page may enter
 * again when presented later. This is observed presence, never ingestion/call recency.
 */
export function newHistoryPresences(previous: HistoryPageObservation | undefined, next: HistoryPageObservation) {
  if (!previous || previous.context !== next.context) return [];
  const retained = new Set(previous.identities);
  return [...new Set(next.identities)].filter(identity => !retained.has(identity));
}

export function historyElementVisible(element: HTMLElement, clip?: HTMLElement | null) {
  const rect = element.getBoundingClientRect();
  const bounds = clip?.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0 && rect.bottom > Math.max(0, bounds?.top ?? 0)
    && rect.top < Math.min(window.innerHeight, bounds?.bottom ?? window.innerHeight)
    && rect.right > Math.max(0, bounds?.left ?? 0)
    && rect.left < Math.min(window.innerWidth, bounds?.right ?? window.innerWidth);
}

/** Each actual presence/selection has a180ms readable settle and700ms finite emphasis.
 * Base DOM/focus/identity never changes; reduced callers skip animation and keep static selection.
 */
export function playHistoryTransitions(targets: readonly HTMLElement[], reduced = false) {
  const active = new Map<Animation, HTMLElement>();
  let observer: IntersectionObserver | undefined;
  const dispose = (animation: Animation) => {
    const target = active.get(animation);
    if (!target || !active.delete(animation)) return;
    animation.removeEventListener('finish', finished);
    animation.removeEventListener('cancel', finished);
    animation.cancel();
    if (![...active.values()].includes(target)) observer?.unobserve(target);
    if (!active.size) observer?.disconnect();
  };
  const finished = (event: Event) => dispose(event.currentTarget as Animation);
  if (!reduced && typeof IntersectionObserver !== 'undefined') observer = new IntersectionObserver(entries => {
    for (const entry of entries) if (!entry.isIntersecting)
      for (const [animation, target] of [...active]) if (target === entry.target) dispose(animation);
  });
  if (!reduced) for (const target of new Set(targets)) {
    if (typeof target.animate !== 'function') continue;
    const finalBackground = getComputedStyle(target).backgroundColor;
    const ease = `cubic-bezier(${EASE.motion.join(',')})`;
    for (const [frames, duration] of [
      [[{ opacity: .78 }, { opacity: 1 }], DURATION.fast],
      [[{ backgroundColor: 'color-mix(in srgb,var(--qp-accent) 25%,transparent)' }, { backgroundColor: finalBackground }], DURATION.deliberate],
    ] as const) {
      const animation = target.animate([...frames], { duration, easing: ease, iterations: 1, fill: 'none' });
      active.set(animation, target);
      animation.addEventListener('finish', finished);
      animation.addEventListener('cancel', finished);
    }
    observer?.observe(target);
  }
  if (!active.size) observer?.disconnect();
  return () => { for (const animation of [...active.keys()]) dispose(animation); observer?.disconnect(); };
}
