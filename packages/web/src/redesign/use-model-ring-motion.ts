import { useLayoutEffect, useRef, type RefObject } from 'react';
import { historyElementVisible } from './history-motion';
import { initialModelRingMotion, observeModelRingMotion, playModelRingMotion } from './model-ring-motion';
import type { modelTokenDistribution } from './model-token-distribution';
import type { ModelSelectionIntent } from './model-selection-motion';

export function useModelRingMotion(root: RefObject<HTMLDivElement>, options: {
  value: ReturnType<typeof modelTokenDistribution>; contextKey: string; pairKey: string;
  intent: ModelSelectionIntent | null;
}) {
  const state = useRef(initialModelRingMotion());
  const cancel = useRef<() => void>(() => {}), serial = useRef(0);
  serial.current = options.intent?.serial ?? 0;
  useLayoutEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const stop = () => { cancel.current(); state.current.consumedSerial = Math.max(state.current.consumedSerial, serial.current); };
    const update = () => { if (document.hidden || media.matches) stop(); };
    const observer = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver(entries => {
      if (entries.some(entry => !entry.isIntersecting)) stop();
    });
    if (root.current) observer?.observe(root.current);
    document.addEventListener('visibilitychange', update); media.addEventListener('change', update); update();
    return () => { stop(); observer?.disconnect(); document.removeEventListener('visibilitychange', update); media.removeEventListener('change', update); };
  }, [root, options.value.valid]);
  useLayoutEffect(() => {
    const before = state.current.value;
    const decision = observeModelRingMotion(state.current, { ...options,
      eligible: !!root.current && !window.matchMedia('(prefers-reduced-motion: reduce)').matches
        && !document.hidden && historyElementVisible(root.current) });
    state.current = decision.state;
    if (decision.cancel) cancel.current();
    if (decision.animate && before && root.current) cancel.current = playModelRingMotion(root.current, before, options.value);
  }, [options.value, options.contextKey, options.pairKey, options.intent, root]);
}
