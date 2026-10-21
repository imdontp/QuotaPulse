import { useLayoutEffect, useRef, type RefObject } from 'react';
import { AggregatePresenceLedger } from './aggregate-presence-motion';
import type { LiveRecordBatch } from './live-record-motion';
import { historyElementVisible, playHistoryTransitions } from './history-motion';

function visibleRegion(node: HTMLElement) {
  if (!historyElementVisible(node)) return false;
  for (let parent = node.parentElement; parent; parent = parent.parentElement) {
    const style = getComputedStyle(parent);
    if (/(auto|scroll|hidden|clip)/.test(`${style.overflowX} ${style.overflowY}`) && !historyElementVisible(node, parent)) return false;
  }
  return true;
}

/** Presentation adapter only: existing accepted aggregate response, no refresh or queue. */
export function useAggregatePresenceMotion(region: RefObject<HTMLElement>, ledger: AggregatePresenceLedger, options: {
  batch: LiveRecordBatch | undefined; context: string; universe: readonly string[]; page: readonly string[];
  enabled: boolean; hasSnapshot: boolean; mounted: boolean;
  selectionSerial: number; selectionKey: string | null;
  attribute: 'data-model-pair-key' | 'data-project-selection-opener' | 'data-cost-presence-key' | 'data-provider-motion-owner'; selector: string;
}) {
  const active = useRef(new Map<string, { target: HTMLElement; cancel: () => void }>());
  const intersection = useRef<boolean | null>(null);
  const priorContext = useRef(options.context);
  const consumedSelection = useRef(0);
  const cancelAll = () => { for (const player of active.current.values()) player.cancel(); active.current.clear(); };
  const cancelTarget = (key: string) => { active.current.get(key)?.cancel(); active.current.delete(key); };
  useLayoutEffect(() => {
    const node = region.current;
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    intersection.current = null;
    if (priorContext.current !== options.context) { ledger.suspend(); cancelAll(); }
    priorContext.current = options.context;
    const update = () => {
      const eligible = options.enabled && !document.hidden && !media.matches && intersection.current === true && !!node && visibleRegion(node);
      const blocked = document.hidden || media.matches || intersection.current === false
        || options.hasSnapshot && !options.enabled || !!node && !visibleRegion(node);
      if (blocked) ledger.suspend(); else ledger.setEligible(eligible);
      if (!eligible) cancelAll();
    };
    const observer = node && typeof IntersectionObserver !== 'undefined' ? new IntersectionObserver(([entry]) => { intersection.current = entry.isIntersecting; update(); }) : null;
    if (observer && node) observer.observe(node); else if (node) intersection.current = true;
    document.addEventListener('visibilitychange', update); media.addEventListener('change', update);
    window.addEventListener('scroll', update, true); window.addEventListener('resize', update); update();
    return () => {
      ledger.setEligible(false); cancelAll(); observer?.disconnect();
      document.removeEventListener('visibilitychange', update); media.removeEventListener('change', update);
      window.removeEventListener('scroll', update, true); window.removeEventListener('resize', update);
    };
  }, [region, ledger, options.enabled, options.hasSnapshot, options.mounted, options.context]);

  const universeSignature = JSON.stringify(options.universe), pageSignature = JSON.stringify(options.page);
  useLayoutEffect(() => {
    const node = region.current;
    const explicitKey = options.selectionSerial > consumedSelection.current ? options.selectionKey : null;
    consumedSelection.current = Math.max(consumedSelection.current, options.selectionSerial);
    const initialVisible = options.enabled && !document.hidden && !matchMedia('(prefers-reduced-motion: reduce)').matches
      && intersection.current !== false && !!node && visibleRegion(node);
    if (options.batch && !initialVisible) { ledger.suspend(); cancelAll(); }
    if (!options.batch) return;
    const keys = ledger.acceptPage(options.batch, options.context, options.universe, options.page, initialVisible);
    const targets = Array.from(node?.querySelectorAll<HTMLElement>(options.selector) ?? []);
    // Bound retained player handles to the actual mounted page and still-active native effects.
    for (const [key, player] of active.current) if (!targets.includes(player.target) || !player.target.getAnimations().length) cancelTarget(key);
    for (const target of targets) {
      const key = target.getAttribute(options.attribute)!;
      if (key === explicitKey || !keys.includes(key) || !visibleRegion(target) || !historyElementVisible(target, node)) continue;
      // Explicit selection owns an already-playing target. Duplicates never restart it.
      if (target.getAnimations().some(animation => animation.playState === 'running' || animation.pending)) continue;
      active.current.set(key, { target, cancel: playHistoryTransitions([target], false, 'outline') });
    }
    // No per-snapshot cleanup: finite effects survive duplicate accepted responses.
  }, [options.batch, options.context, universeSignature, pageSignature, options.enabled, region, ledger, options.attribute, options.selector, options.selectionSerial, options.selectionKey]);
  return cancelTarget;
}
