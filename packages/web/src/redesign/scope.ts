export type ScopeRange = 'today' | 'week' | 'month' | 'all' | 'last30' | 'custom';
export interface ScopeSelection { range: ScopeRange; from?: number; to?: number; sourceId?: number; bucket?: string }

export function readScope(params: URLSearchParams, fallback: 'today' | 'month' | 'all', allowLast30 = false): ScopeSelection {
  const raw = params.get('range');
  const from = Number(params.get('from'));
  const to = Number(params.get('to'));
  const validCustom = params.has('from') && params.has('to') && Number.isSafeInteger(from) && Number.isSafeInteger(to) && from >= 0 && to > from && to <= 8_640_000_000_000_000;
  const range: ScopeRange = raw === 'custom' ? validCustom ? 'custom' : fallback
    : raw === 'today' || raw === 'week' || raw === 'month' || raw === 'all' || (allowLast30 && raw === 'last30') ? raw : fallback;
  const sourceId = Number(params.get('source'));
  const bucket = params.get('bucket');
  return { range, ...(range === 'custom' ? { from, to } : {}),
    ...(Number.isSafeInteger(sourceId) && sourceId > 0 ? { sourceId } : {}),
    ...(bucket && ['auto', 'hour', 'day', 'week', 'month'].includes(bucket) ? { bucket } : {}) };
}

export function writeScope(params: URLSearchParams, scope: ScopeSelection) {
  params.set('range', scope.range);
  if (scope.range === 'custom') { params.set('from', String(scope.from)); params.set('to', String(scope.to)); }
  else { params.delete('from'); params.delete('to'); }
  if (scope.sourceId) params.set('source', String(scope.sourceId));
  if (scope.bucket) params.set('bucket', scope.bucket);
  return params;
}

export function selectedScope(scope: ScopeSelection, now: number) {
  const bounds = scope.range === 'custom' ? { from: scope.from!, to: scope.to! } : rangeScope(scope.range, now);
  return { ...bounds, ...(scope.sourceId ? { sourceId: scope.sourceId } : {}) };
}

/** Local calendar boundaries mirror the daemon's usage-period contract. */
export function rangeScope(range: 'today' | 'week' | 'month' | 'all' | 'last30', now: number) {
  if (range === 'all') return { from: 0, to: now + 1 };
  if (range === 'last30') return { from: now - 30 * 86_400_000, to: now + 1 };
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  if (range === 'week') start.setDate(start.getDate() - (start.getDay() + 6) % 7);
  if (range === 'month') start.setDate(1);
  return { from: start.getTime(), to: now + 1 };
}
