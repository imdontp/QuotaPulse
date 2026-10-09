import type { UsageEventScope } from '@/lib/usage-events';
import { writeScope } from './scope';

/** A destination is actionable only when its table can retain the entire scope. */
export function quickStatsLinks(scope?: UsageEventScope | null): Record<'projects' | 'models' | 'providers' | 'live', string | undefined> {
  if (scope === null) return { projects: undefined, models: undefined, providers: undefined, live: undefined };
  if (scope === undefined) return { projects: '#projects?range=all', models: '#models?range=all', providers: '#providers', live: '#live' };
  const params = () => writeScope(new URLSearchParams(), { range: 'custom', from: scope.from, to: scope.to, sourceId: scope.sourceId });
  const projects = params();
  if (scope.harness !== undefined) projects.set('harness', scope.harness);
  const models = params();
  if (scope.provider !== undefined) models.set('provider', scope.provider);
  if (scope.vendor !== undefined) models.set('vendor', scope.vendor);
  const restricted = Object.keys(scope).filter(key => scope[key as keyof UsageEventScope] !== undefined && !(key === 'grain' && scope.grain === 'all') && !(key === 'projectMissing' && !scope.projectMissing));
  const supports = (keys: string[]) => restricted.every(key => keys.includes(key));
  return {
    projects: supports(['from', 'to', 'sourceId', 'harness']) ? `#projects?${projects}` : undefined,
    models: supports(['from', 'to', 'sourceId', 'provider', 'vendor']) ? `#models?${models}` : undefined,
    // Providers displays current quotas; Live has a rolling window rather than
    // a custom time range. Neither represents an arbitrary recorded usage scope.
    providers: undefined,
    live: undefined,
  };
}
