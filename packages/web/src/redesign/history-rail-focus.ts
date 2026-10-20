import { historyElementVisible } from './history-motion';

/** A tall flow rail only needs its heading/first content visible, not its whole height. */
export function historyRailNeedsReveal(rect: Pick<DOMRect, 'top' | 'height'>, viewportHeight: number) {
  return rect.top < 0 || rect.top + Math.min(120, rect.height) > viewportHeight;
}

/** Explicit close only. Do not restore an offscreen/clipped/detached row opener. */
export function restoreHistoryRailFocus(opener: HTMLElement | null, table: HTMLElement | null, fallback: HTMLElement | null) {
  const target = opener?.isConnected && getComputedStyle(opener).visibility !== 'hidden' && historyElementVisible(opener, table) ? opener
    : table?.isConnected && historyElementVisible(table) ? table : fallback;
  if (target?.isConnected) target.focus({ preventScroll: true });
}
