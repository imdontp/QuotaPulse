import { useLayoutEffect, useRef, type RefObject } from 'react';
import { useMotionPref } from '../lib/motion';
import { historyElementVisible, playHistoryTransitions } from './history-motion';
import { cancelModelSelectionMotion, initialModelSelectionMotion, observeModelSelectionMotion, type ModelSelectionIntent } from './model-selection-motion';
import { providerSelectionMotionKey } from './provider-selection-motion';

/** Current owner facts already come from the accepted overview: no detail fetch/queue. */
export function useProviderSelectionMotion(opener: RefObject<HTMLElement | null>, detail: RefObject<HTMLElement>,
  owner: string | undefined, open: boolean, context: string, intent: ModelSelectionIntent | null, enabled: boolean) {
  const preference = useMotionPref();
  const state = useRef(initialModelSelectionMotion());
  const serial = useRef(0); serial.current = intent?.serial ?? 0;
  const cancel = useRef<() => void>(() => {});
  const suspended = useRef(false);
  useLayoutEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => {
      suspended.current = document.hidden || media.matches;
      if (suspended.current) { state.current = cancelModelSelectionMotion(state.current, serial.current); cancel.current(); }
    };
    document.addEventListener('visibilitychange', update); media.addEventListener('change', update); update();
    return () => {
      cancel.current(); state.current = cancelModelSelectionMotion(state.current, serial.current);
      document.removeEventListener('visibilitychange', update); media.removeEventListener('change', update);
    };
  }, []);
  useLayoutEffect(() => {
    const key = providerSelectionMotionKey(owner, open);
    const trigger = opener.current?.getAttribute('data-provider-motion-owner') === owner ? opener.current : null;
    const panel = detail.current;
    const decision = observeModelSelectionMotion(state.current, {
      contextKey: context, selectedKey: key, detailKey: open ? key : null, acceptedDetailKey: open && enabled ? key : null,
      intent, enabled: enabled && !preference.reduced && !suspended.current && !document.hidden, failed: false,
      rowVisible: !!trigger && historyElementVisible(trigger, trigger.closest('main')),
      detailVisible: open && !!panel && historyElementVisible(panel, panel.closest('main')),
    });
    state.current = decision.state;
    if (decision.cancel) cancel.current();
    const targets = [decision.row ? trigger : null, decision.detail ? panel : null].filter((node): node is HTMLElement => !!node);
    if (targets.length) { cancel.current(); cancel.current = playHistoryTransitions(targets, false, 'outline'); }
    // Refresh/object replacement is not a new intent and must not truncate700ms.
  }, [owner, open, context, intent, enabled, preference.reduced, opener, detail]);
}
