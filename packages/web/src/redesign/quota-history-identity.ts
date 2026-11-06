import type { QuotaHistoryResponse } from '../api.js';

/** A history response belongs to one owner, window, reader and reset period. */
export function quotaHistoryMatches(history: QuotaHistoryResponse, selected: {
  owner: string; window: string; sourceId?: number; origin?: string; resetAt: number | null;
}) {
  if (history.subscriptionKey !== selected.owner || history.windowKind !== selected.window) return false;
  const reader = history.reader;
  if (!reader) return !history.available && history.segments.length === 0;
  const resetMatches = reader.resetAt === null || selected.resetAt === null
    ? reader.resetAt === selected.resetAt : Math.abs(reader.resetAt - selected.resetAt) <= 2_000;
  return reader.sourceId === selected.sourceId && reader.origin === selected.origin && resetMatches;
}
