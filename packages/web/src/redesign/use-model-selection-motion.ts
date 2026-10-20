import { useLayoutEffect, useRef, type RefObject } from 'react';
import { useMotionPref } from '../lib/motion';
import { historyElementVisible, playHistoryTransitions } from './history-motion';
import { cancelModelSelectionMotion, initialModelSelectionMotion, observeModelSelectionMotion, type ModelSelectionIntent } from './model-selection-motion';

/** Adapter around the existing finite DOM player. No fetch, clock, replay or polling. */
export function useModelSelectionMotion(rows: RefObject<HTMLDivElement>, detail: RefObject<HTMLElement>,
  options: { contextKey: string; selectedKey: string | null; detailKey: string | null; acceptedDetailKey: string | null;
    intent: ModelSelectionIntent | null; enabled: boolean; failed: boolean; rowsMounted: boolean }) {
  const preference = useMotionPref();
  const state = useRef(initialModelSelectionMotion());
  const latestSerial = useRef(0);
  latestSerial.current = options.intent?.serial ?? 0;
  const cancelRows = useRef<() => void>(() => {}), cancelDetail = useRef<() => void>(() => {});
  const suspended = useRef(false);

  useLayoutEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const consume = () => { state.current = cancelModelSelectionMotion(state.current, latestSerial.current); };
    const update = () => {
      suspended.current = document.hidden || media.matches;
      if (suspended.current) { consume(); cancelRows.current(); cancelDetail.current(); }
    };
    const observer = typeof IntersectionObserver !== 'undefined' ? new IntersectionObserver(entries => {
      for (const entry of entries) if (!entry.isIntersecting) {
        if (entry.target === rows.current) cancelRows.current();
        if (entry.target === detail.current) { consume(); cancelDetail.current(); }
      }
    }) : null;
    if (rows.current) observer?.observe(rows.current);
    if (detail.current) observer?.observe(detail.current);
    document.addEventListener('visibilitychange', update);
    media.addEventListener('change', update);
    update();
    return () => {
      consume(); cancelRows.current(); cancelDetail.current(); observer?.disconnect();
      document.removeEventListener('visibilitychange', update);
      media.removeEventListener('change', update);
    };
  }, [rows, detail, options.rowsMounted]);

  useLayoutEffect(() => {
    const row = Array.from(rows.current?.querySelectorAll<HTMLElement>('[data-model-pair-key]') ?? [])
      .find(element => element.dataset.modelPairKey === options.selectedKey);
    const decision = observeModelSelectionMotion(state.current, { ...options,
      enabled: options.enabled && !preference.reduced && !suspended.current && !document.hidden,
      rowVisible: !!row && historyElementVisible(row, rows.current),
      detailVisible: !!detail.current && historyElementVisible(detail.current) });
    state.current = decision.state;
    if (decision.cancel) { cancelRows.current(); cancelDetail.current(); }
    if (decision.row && row) { cancelRows.current(); cancelRows.current = playHistoryTransitions([row], false, 'outline'); }
    if (decision.detail && detail.current) { cancelDetail.current(); cancelDetail.current = playHistoryTransitions([detail.current], false, 'outline'); }
    // No per-observation cleanup: duplicate accepted data/busy renders must not
    // truncate the native700ms timeline. Lifecycle cleanup owns cancellation.
  }, [options.contextKey, options.selectedKey, options.detailKey, options.acceptedDetailKey,
    options.intent, options.enabled, options.failed, preference.reduced, rows, detail]);
}
