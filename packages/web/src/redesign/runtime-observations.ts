import type { RuntimeGraph } from './model';
import type { UsageEventRow, UsageEventsResponse, UsageEventScope } from '../lib/usage-events';
import { recentActivityScope } from './activity-trend';

/** UI null means All; an exact empty project remains a distinct context. */
export const runtimeObservationContext = (routeKey: string, project: string | null) => JSON.stringify([routeKey, project]);

/** One newest observation per actual graph harness, with the graph's exact scope.
 * Coalesces calls deliberately; this is neither an event queue nor a global rail page.
 */
export async function readRuntimeObservations(
  graph: Pick<RuntimeGraph, 'nodes'>,
  scope: UsageEventScope,
  now: number,
  read: (scope: UsageEventScope, pagination: { limit: number; offset: number }) => Promise<UsageEventsResponse>,
): Promise<UsageEventRow[]> {
  const activityScope = recentActivityScope(scope, now);
  if (!activityScope) return [];
  const harnesses = [...new Set(graph.nodes.harness.map(node => node.key)
    .filter((harness): harness is string => harness !== null && harness.trim().length > 0))];
  return (await Promise.all(harnesses.map(async harness => {
    try { return (await read({ ...activityScope, harness }, { limit: 1, offset: 0 })).rows[0] ?? null; }
    catch { return null; }
  }))).filter((row): row is UsageEventRow => row !== null);
}
