import { readScope } from './scope';

const canonical = new Set(['overview', 'live', 'projects', 'providers', 'models', 'cost', 'history', 'alerts', 'settings']);

/** Replace aliases without adding a browser history entry or discarding valid scope. */
export function canonicalHash(hash: string): string {
  const [incoming, query = ''] = hash.replace(/^#/, '').split('?');
  if (canonical.has(incoming)) return hash;
  const params = new URLSearchParams(query);
  let destination: string;
  let fallback: 'today' | 'month' | 'all' | undefined;
  switch (incoming) {
    case 'usage': {
      const view = params.get('view');
      destination = view === 'cost' || view === 'projects' || view === 'models' ? view : 'overview';
      fallback = destination === 'cost' ? 'all' : destination === 'overview' ? undefined : 'month';
      params.delete('view');
      break;
    }
    case 'today': destination = 'overview'; fallback = 'today'; break;
    case 'trend': destination = 'overview'; fallback = 'month'; break;
    case 'sessions': destination = 'history'; break;
    case 'sources': destination = 'providers'; break;
    case 'limits': destination = 'providers'; params.set('section', 'quotas'); break;
    case 'health': destination = 'settings'; params.set('section', 'diagnostics'); break;
    default: return '#overview';
  }
  const scope = readScope(params, fallback ?? 'today', destination === 'cost');
  if (params.has('range') || fallback) params.set('range', scope.range);
  if (scope.range !== 'custom') { params.delete('from'); params.delete('to'); }
  if (!scope.sourceId) params.delete('source');
  if (!scope.bucket) params.delete('bucket');
  return `#${destination}${params.size ? `?${params}` : ''}`;
}
