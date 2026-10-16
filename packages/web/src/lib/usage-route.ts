import type { UsageRoute } from '../components/usage-range';

export function usageRouteHash(scope: 'usage' | 'sessions' | 'history', route: UsageRoute, sessionId?: number): string {
  const params = new URLSearchParams();
  params.set('range', route.selection.range);
  if (route.selection.range === 'custom') {
    if (route.selection.from != null) params.set('from', String(route.selection.from));
    if (route.selection.to != null) params.set('to', String(route.selection.to));
  }
  if (route.selection.bucket && route.selection.bucket !== 'auto') params.set('bucket', route.selection.bucket);
  if (route.selection.sourceId != null) params.set('source', String(route.selection.sourceId));
  if (scope === 'history' && sessionId !== undefined && Number.isSafeInteger(sessionId) && sessionId > 0) params.set('session_id', String(sessionId));
  if (scope === 'usage') params.set('view', route.view);
  return `#${scope}?${params.toString()}`;
}
