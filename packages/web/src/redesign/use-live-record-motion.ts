import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react';
import { historyElementVisible, playHistoryTransitions } from './history-motion';
import { LivePresenceLedger, changedLiveSelection, type LiveRecordBatch, type LiveSelection } from './live-record-motion';

function visibleRegion(node: HTMLElement) {
  if (!historyElementVisible(node)) return false;
  for (let parent = node.parentElement; parent; parent = parent.parentElement) {
    const style = getComputedStyle(parent);
    if (/(auto|scroll|hidden|clip)/.test(`${style.overflowX} ${style.overflowY}`) && !historyElementVisible(node, parent)) return false;
  }
  return true;
}

/** Uses the already-verified finite native player; owns no fetching or refresh loop. */
export function useLivePresenceMotion(region: RefObject<HTMLElement>, ledger: LivePresenceLedger,
  batch: LiveRecordBatch | undefined, context: string, identities: readonly string[],
  attribute: 'data-live-session' | 'data-live-record', clipSelector: string, enabled: boolean, hasSnapshot: boolean) {
  const cancel = useRef<() => void>(() => {});
  const intersection = useRef<boolean | null>(null);
  const signature = JSON.stringify(identities);
  useLayoutEffect(() => {
    const node = region.current;
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    intersection.current = null;
    const update = () => {
      const eligible = enabled && !document.hidden && !media.matches && intersection.current === true && !!node && visibleRegion(node);
      const blocked = document.hidden || media.matches || intersection.current === false || hasSnapshot && !enabled || !!node && !visibleRegion(node);
      if (blocked) ledger.suspend(); else ledger.setEligible(eligible);
      if (!eligible) cancel.current();
    };
    const observer = node && typeof IntersectionObserver !== 'undefined' ? new IntersectionObserver(([entry]) => { intersection.current = entry.isIntersecting; update(); }) : null;
    if (observer && node) observer.observe(node); else if (node) intersection.current = true;
    document.addEventListener('visibilitychange', update); media.addEventListener('change', update);
    window.addEventListener('scroll', update, true); window.addEventListener('resize', update); update();
    return () => {
      ledger.setEligible(false); cancel.current(); observer?.disconnect();
      document.removeEventListener('visibilitychange', update); media.removeEventListener('change', update);
      window.removeEventListener('scroll', update, true); window.removeEventListener('resize', update);
    };
  }, [region, ledger, enabled, hasSnapshot]);
  useEffect(() => {
    const initialVisible = enabled && !document.hidden && !matchMedia('(prefers-reduced-motion: reduce)').matches
      && intersection.current !== false && !!region.current && visibleRegion(region.current);
    if (batch && !initialVisible) {
      ledger.suspend(); cancel.current();
    }
    if (!batch) return;
    const keys = ledger.accept(batch, context, identities, initialVisible);
    const clip = region.current?.querySelector<HTMLElement>(clipSelector);
    const targets = Array.from(region.current?.querySelectorAll<HTMLElement>(`[${attribute}]`) ?? [])
      .filter(node => keys.includes(node.getAttribute(attribute)!) && historyElementVisible(node, clip));
    if (targets.length) { cancel.current(); cancel.current = playHistoryTransitions(targets); }
  }, [batch, context, signature, enabled, region, ledger, attribute, clipSelector]);
}

/** Parent's existing showModal effect runs first; effects never open/close/focus a dialog. */
export function useLiveSelectionMotion(region: RefObject<HTMLElement>, dialog: RefObject<HTMLDialogElement>,
  selectedKey: string | null, selectionSerial: number, context: string, enabled: boolean) {
  const previous = useRef<LiveSelection>({ key: null, serial: 0, context });
  const cancel = useRef<() => void>(() => {});
  useLayoutEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => { if (document.hidden || media.matches) cancel.current(); };
    document.addEventListener('visibilitychange', update); media.addEventListener('change', update);
    return () => { cancel.current(); document.removeEventListener('visibilitychange', update); media.removeEventListener('change', update); };
  }, []);
  useEffect(() => {
    const before = previous.current;
    previous.current = { key: selectedKey, serial: selectionSerial, context };
    if (!enabled || !selectedKey || context !== before.context || document.hidden || matchMedia('(prefers-reduced-motion: reduce)').matches) { cancel.current(); return; }
    if (!changedLiveSelection(before, previous.current)) return;
    const clip = region.current?.querySelector<HTMLElement>('.qp-live-table');
    const row = Array.from(region.current?.querySelectorAll<HTMLElement>('[data-live-session]') ?? []).find(node => node.getAttribute('data-live-session') === selectedKey);
    const detail = dialog.current?.querySelector<HTMLElement>('.qp-live-detail-content');
    const targets = [row && historyElementVisible(row, clip) ? row : null, detail && dialog.current?.open && historyElementVisible(detail, dialog.current) ? detail : null].filter((node): node is HTMLElement => !!node);
    cancel.current(); cancel.current = playHistoryTransitions(targets);
  }, [selectedKey, selectionSerial, context, enabled, region, dialog]);
}
