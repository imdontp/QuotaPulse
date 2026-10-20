import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react';
import { historyElementVisible, playHistoryTransitions } from './history-motion';
import { runtimeInspectorDecision, type RuntimeInspectorMotionState } from './runtime-inspector-motion';

/** Finite user-selection effects only; never observes calls or changes the graph. */
export function useRuntimeInspectorMotion(opener: RefObject<HTMLElement>, dialog: RefObject<HTMLDialogElement>,
  contextKey: string, key: string | null, serial: number, enabled: boolean, startable: boolean) {
  const state = useRef<RuntimeInspectorMotionState>({ contextKey, key: null, serial: 0 });
  const latestSerial = useRef(serial); latestSerial.current = serial;
  const cancel = useRef<() => void>(() => {});
  useLayoutEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => {
      if (document.hidden || media.matches) {
        state.current = { ...state.current, serial: Math.max(state.current.serial, latestSerial.current) };
        cancel.current();
      }
    };
    document.addEventListener('visibilitychange', update); media.addEventListener('change', update); update();
    return () => { cancel.current(); document.removeEventListener('visibilitychange', update); media.removeEventListener('change', update); };
  }, []);
  // Overview's existing native showModal effect runs first. No cleanup per render:
  // a duplicate graph/clock update must not truncate the finite180/700 timelines.
  useEffect(() => {
    const decision = runtimeInspectorDecision(state.current, { contextKey, key, serial },
      enabled && !document.hidden && !matchMedia('(prefers-reduced-motion: reduce)').matches, startable);
    state.current = decision.state;
    if (decision.cancel) cancel.current();
    if (!decision.animate || !dialog.current?.open) return;
    const detail = dialog.current.querySelector<HTMLElement>('[data-runtime-inspector-detail]');
    const target = opener.current;
    const clip = target?.closest<HTMLElement>('.qp-chart-data>div,.qp-map-scroll');
    const targets = [target && historyElementVisible(target, clip) ? target : null,
      detail && historyElementVisible(detail, dialog.current) ? detail : null].filter((node): node is HTMLElement => !!node);
    cancel.current(); cancel.current = playHistoryTransitions(targets, false, 'outline');
  }, [contextKey, key, serial, enabled, startable, opener, dialog]);
}
