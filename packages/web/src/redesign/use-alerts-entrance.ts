import { useLayoutEffect, useRef, type RefObject } from 'react';
import { AlertsEntranceLedger, AlertsEntranceAnimations, type AlertsEntranceBatch } from './alerts-entrance';

/** Test viewport and scroll-container clipping without depending on asynchronous IO for a new row. */
function rowVisible(node: HTMLElement): boolean {
  const rect = node.getBoundingClientRect();
  let left = Math.max(0, rect.left), right = Math.min(innerWidth, rect.right);
  let top = Math.max(0, rect.top), bottom = Math.min(innerHeight, rect.bottom);
  if (right <= left || bottom <= top) return false;
  for (let parent = node.parentElement; parent; parent = parent.parentElement) {
    const style = getComputedStyle(parent);
    const bounds = parent.getBoundingClientRect();
    if (/(auto|scroll|hidden|clip)/.test(style.overflowX)) { left = Math.max(left, bounds.left); right = Math.min(right, bounds.right); }
    if (/(auto|scroll|hidden|clip)/.test(style.overflowY)) { top = Math.max(top, bounds.top); bottom = Math.min(bottom, bounds.bottom); }
    if (right <= left || bottom <= top) return false;
  }
  return true;
}

/** A finite entrance per new accepted identity. Visibility losses consume, never defer. */
export function useAlertsEntrance(region: RefObject<HTMLElement>, ledger: AlertsEntranceLedger,
  batch: AlertsEntranceBatch | undefined, identities: readonly string[], rendered: readonly string[], ready: boolean) {
  const active = useRef(new AlertsEntranceAnimations());
  const intersecting = useRef(false);
  const signature = JSON.stringify(identities);
  const renderedSignature = JSON.stringify(rendered);
  const cancelAll = () => active.current.cancelAll();

  useLayoutEffect(() => {
    const node = region.current;
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    intersecting.current = false;
    const update = () => {
      const eligible = Boolean(node && intersecting.current && !document.hidden && !media.matches && rowVisible(node));
      ledger.setEligible(eligible);
      if (!eligible) cancelAll();
      else active.current.prune(rowVisible);
    };
    const observer = node && typeof IntersectionObserver !== 'undefined'
      ? new IntersectionObserver(([entry]) => { intersecting.current = entry.isIntersecting; update(); }) : null;
    if (node && observer) observer.observe(node);
    else if (node) intersecting.current = true;
    document.addEventListener('visibilitychange', update);
    media.addEventListener('change', update);
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    update();
    return () => {
      ledger.setEligible(false); cancelAll(); observer?.disconnect();
      document.removeEventListener('visibilitychange', update); media.removeEventListener('change', update);
      window.removeEventListener('scroll', update, true); window.removeEventListener('resize', update);
    };
  }, [region, ledger, ready]);

  useLayoutEffect(() => {
    active.current.prune(rowVisible);
    if (!batch) return;
    if (document.hidden || matchMedia('(prefers-reduced-motion: reduce)').matches || !region.current || !rowVisible(region.current)) {
      ledger.setEligible(false); cancelAll();
    }
    const candidates = new Set(ledger.accept(batch, identities));
    // Rows absent due to a local filter, or clipped/offscreen at acceptance, are
    // already consumed by the full-data ledger. Revealing them cannot replay later.
    for (const node of region.current?.querySelectorAll<HTMLElement>('[data-alert-motion-key]') ?? []) {
      if (!candidates.has(node.dataset.alertMotionKey!) || !rowVisible(node) || typeof node.animate !== 'function') continue;
      active.current.play(node);
    }
  }, [region, ledger, batch, signature, renderedSignature]);
}
