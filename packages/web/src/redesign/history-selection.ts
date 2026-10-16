import { usageEventParams } from '../lib/usage-events';
import type { UsageEventRow, UsageEventScope, UsageEventsResponse } from '../lib/usage-events';

export interface HistorySelection {
  row: UsageEventRow;
  scope: UsageEventScope;
}

/** Follow an existing event, retaining its original scope when it leaves the page. */
export function refreshedHistorySelection(selected: HistorySelection | null, snapshot: UsageEventsResponse): HistorySelection | null {
  if (!selected) return null;
  const row = snapshot.rows.find(row => row.event_id === selected.row.event_id);
  return row ? { row, scope: snapshot.scope } : selected;
}

/** Related records use the selected snapshot, not an unrelated replacement page. */
export function historyRelatedSessionHref(selection: HistorySelection | null): string | null {
  if (!selection?.row.session_key) return null;
  const params = usageEventParams({ ...selection.scope, sessionId: selection.row.session_key });
  params.set('range', 'custom');
  if (params.has('source_id')) { params.set('source', params.get('source_id')!); params.delete('source_id'); }
  return `#history?${params}`;
}
