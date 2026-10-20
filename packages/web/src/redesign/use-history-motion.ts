import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react';
import { useMotionPref } from '../lib/motion';
import type { UsageEventsResponse } from '../lib/usage-events';
import { historyElementVisible, historyRecordMotionKey, newHistoryPresences, playHistoryTransitions, type HistoryPageObservation } from './history-motion';

/** Motion consumes already accepted snapshots; it never fetches or changes selection. */
export function useHistoryMotion(table: RefObject<HTMLDivElement>, detailRegion: RefObject<HTMLElement>,
  snapshot: UsageEventsResponse | null, context: string, acceptedContext: string, selectedKey: string | null,
  selectionSerial: number, enabled: boolean) {
  const preference = useMotionPref();
  const previous = useRef<HistoryPageObservation>();
  const accepted = useRef<UsageEventsResponse | null>(null);
  const priorSelection = useRef<{ key: string | null; serial: number }>({ key: null, serial: 0 });
  const cancelRows = useRef<() => void>(() => {}), cancelDetail = useRef<() => void>(() => {});
  const skipNextSnapshot = useRef(false);
  const suspended = useRef(false);
  const hasSnapshot = snapshot !== null, hasSelection = selectedKey !== null;

  useLayoutEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => {
      suspended.current = document.hidden || media.matches;
      if (suspended.current) { cancelRows.current(); cancelDetail.current(); skipNextSnapshot.current = true; }
    };
    const observer = table.current && typeof IntersectionObserver !== 'undefined' ? new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) { cancelRows.current(); skipNextSnapshot.current = true; }
    }) : null;
    if (observer && table.current) observer.observe(table.current);
    document.addEventListener('visibilitychange', update);
    media.addEventListener('change', update);
    update();
    return () => {
      cancelRows.current(); cancelDetail.current(); observer?.disconnect();
      document.removeEventListener('visibilitychange', update);
      media.removeEventListener('change', update);
    };
  }, [table, detailRegion, hasSnapshot, hasSelection]);

  // The non-blocking rail already contains accepted facts; only user intent animates.
  useEffect(() => {
    const contextChanged = previous.current !== undefined && previous.current.context !== context;
    const fresh = accepted.current !== snapshot;
    const ready = enabled && !preference.reduced && !suspended.current && !document.hidden;
    if (!ready || contextChanged || context !== acceptedContext) {
      cancelRows.current(); cancelDetail.current();
      if (!ready) skipNextSnapshot.current = true;
    }
    const tableReady = ready && table.current !== null && historyElementVisible(table.current);
    if (!tableReady) skipNextSnapshot.current = true;
    let newKeys: string[] = [];
    if (snapshot && context === acceptedContext) {
      const next = { context, identities: snapshot.rows.map(historyRecordMotionKey) };
      if (fresh && tableReady && !skipNextSnapshot.current) newKeys = newHistoryPresences(previous.current, next);
      if (fresh && tableReady) skipNextSnapshot.current = false;
      previous.current = next;
    } else previous.current = undefined;
    accepted.current = snapshot;
    const selectionChanged = selectionSerial !== priorSelection.current.serial && selectedKey !== null
      && selectedKey !== priorSelection.current.key;
    priorSelection.current = { key: selectedKey, serial: selectionSerial };
    if (!ready) return;
    const rows = Array.from(table.current?.querySelectorAll<HTMLElement>('[data-history-record]') ?? []);
    const targets = rows.filter(row => (newKeys.includes(row.dataset.historyRecord!) || selectionChanged && row.dataset.historyRecord === selectedKey)
      && historyElementVisible(row, table.current));
    if (targets.length) { cancelRows.current(); cancelRows.current = playHistoryTransitions(targets, false, 'outline'); }
    const detail = detailRegion.current?.querySelector<HTMLElement>('.qp-history-detail-groups');
    if (selectionChanged && detail && historyElementVisible(detail)) {
      cancelDetail.current(); cancelDetail.current = playHistoryTransitions([detail], false, 'outline');
    }
  }, [snapshot, context, acceptedContext, selectedKey, selectionSerial, enabled, preference.reduced, table, detailRegion]);
}
