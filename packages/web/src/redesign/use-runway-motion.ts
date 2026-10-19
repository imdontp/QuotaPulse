import { useLayoutEffect, useRef, type RefObject } from 'react';
import { useMotionPref } from '../lib/motion';
import type { QuotaWindow } from './model';
import { nextRunwayPresentation, playRunwayTransition, runwayTransition, type RunwayPresentation } from './runway-motion';

/** Observe a real section/track box, not a display:contents wrapper. Return the current
 * truthful presentation during render; only committed renders advance the baseline.
 * Integration must visibly and accessibly label kind=stale and use display.at/quota/
 * runway/marker consistently, rather than describe the frozen forecast as current.
 */
export function useRunwayMotion(region: RefObject<HTMLElement>, quota: QuotaWindow | undefined,
  now: number, staleAfterMs: number, frozen = false): RunwayPresentation {
  const preference = useMotionPref();
  const committed = useRef<RunwayPresentation>();
  const cancel = useRef<() => void>(() => {});
  const intersection = useRef<boolean | null>(null);
  const visible = useRef(false);
  const skipNextSample = useRef(false);
  const presentation = nextRunwayPresentation(committed.current, quota, now, staleAfterMs);

  useLayoutEffect(() => {
    const node = region.current;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    intersection.current = null;
    const update = () => {
      visible.current = !document.hidden && intersection.current === true && !media.matches;
      if (!visible.current) {
        cancel.current();
        if (document.hidden || media.matches || intersection.current === false) skipNextSample.current = true;
      }
    };
    const observer = node && typeof IntersectionObserver !== 'undefined'
      ? new IntersectionObserver(([entry]) => { intersection.current = entry.isIntersecting; update(); }) : null;
    if (observer && node) observer.observe(node);
    else if (node) intersection.current = true;
    document.addEventListener('visibilitychange', update);
    media.addEventListener('change', update);
    update();
    return () => {
      visible.current = false;
      cancel.current();
      observer?.disconnect();
      document.removeEventListener('visibilitychange', update);
      media.removeEventListener('change', update);
    };
  }, [region]);

  const sampleKey = presentation.kind === 'unavailable' ? null : presentation.sampleKey;
  useLayoutEffect(() => {
    cancel.current();
    const previous = committed.current;
    const freshSample = presentation.kind === 'fresh' && (previous?.kind !== 'fresh'
      || previous.contextKey !== presentation.contextKey || previous.sampleKey !== presentation.sampleKey);
    const enabled = !frozen && visible.current && !preference.reduced;
    if (frozen || preference.reduced || document.hidden || intersection.current === false) skipNextSample.current = true;
    const change = enabled && !skipNextSample.current ? runwayTransition(previous, presentation) : null;
    if (freshSample && enabled) skipNextSample.current = false;
    committed.current = presentation;
    if (change && region.current) cancel.current = playRunwayTransition(region.current, change.from, change.to, preference.dur('slow'));
    return () => cancel.current();
  }, [presentation.kind, presentation.contextKey, sampleKey, frozen, preference.reduced, region]);
  // A clock/history/map render may update the current truthful projection without
  // replacing or cancelling an in-flight forecast animation for the same sample.
  useLayoutEffect(() => { committed.current = presentation; });
  return presentation;
}
