import { useLayoutEffect, useRef, type RefObject } from 'react';
import { useMotionPref } from '../lib/motion';
import { historyElementVisible, playHistoryTransitions } from './history-motion';
import { cancelModelSelectionMotion } from './model-selection-motion';
import { initialProjectSelectionMotion, observeProjectSelectionMotion, type ProjectSelectionIntent } from './project-selection-motion';

/** Existing native opener and actual accepted detail; no requests or replay queue. */
export function useProjectSelectionMotion(opener: RefObject<HTMLButtonElement>, detail: RefObject<HTMLElement>, options: {
  contextKey: string; selectedKey: string | null; detailKey: string | null; acceptedDetailKey: string | null;
  intent: ProjectSelectionIntent | null; offset: number; enabled: boolean; failed: boolean; detailMounted: boolean;
}) {
  const preference = useMotionPref();
  const state = useRef(initialProjectSelectionMotion());
  const latestSerial = useRef(0);
  latestSerial.current = options.intent?.serial ?? 0;
  const cancelOpener = useRef<() => void>(() => {}), cancelDetail = useRef<() => void>(() => {});
  const suspended = useRef(false);
  useLayoutEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const consume = () => { state.current = { ...cancelModelSelectionMotion(state.current, latestSerial.current), offset: state.current.offset }; };
    const update = () => {
      suspended.current = document.hidden || media.matches;
      if (suspended.current) { consume(); cancelOpener.current(); cancelDetail.current(); }
    };
    const observer = detail.current && typeof IntersectionObserver !== 'undefined' ? new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) { consume(); cancelDetail.current(); }
    }) : null;
    if (observer && detail.current) observer.observe(detail.current);
    document.addEventListener('visibilitychange', update); media.addEventListener('change', update); update();
    return () => {
      consume(); cancelOpener.current(); cancelDetail.current(); observer?.disconnect();
      document.removeEventListener('visibilitychange', update); media.removeEventListener('change', update);
    };
  }, [detail, options.detailMounted]);

  useLayoutEffect(() => {
    const target = opener.current;
    const actualOpener = options.intent?.kind === 'project' && target?.isConnected
      && target.dataset.projectSelectionOpener === options.intent.openerKey ? target : null;
    const decision = observeProjectSelectionMotion(state.current, { ...options,
      enabled: options.enabled && !preference.reduced && !suspended.current && !document.hidden,
      rowVisible: !!actualOpener && historyElementVisible(actualOpener),
      detailVisible: !!detail.current && historyElementVisible(detail.current) });
    state.current = decision.state;
    if (decision.cancel) { cancelOpener.current(); cancelDetail.current(); }
    if (decision.row && actualOpener) { cancelOpener.current(); cancelOpener.current = playHistoryTransitions([actualOpener], false, 'outline'); }
    if (decision.detail && detail.current) { cancelDetail.current(); cancelDetail.current = playHistoryTransitions([detail.current], false, 'outline'); }
    // Busy/duplicate accepted renders do not clean up finite native timelines.
  }, [options.contextKey, options.selectedKey, options.detailKey, options.acceptedDetailKey, options.intent,
    options.offset, options.enabled, options.failed, preference.reduced, opener, detail]);
}
