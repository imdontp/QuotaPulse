import type { DB } from '../db/index.js';
import { FACTS } from './detailed-aggregates.js';
import { usageWhere, type UsageScope } from './usage-scope.js';

/** Full filtered range, independently of the record table's page. */
export function historySummary(db: DB, scope: UsageScope, timeline: 'scope' | 'observed' = 'scope') {
  const where = usageWhere(scope);
  const hour = 3_600_000;
  const day = 24 * hour;
  const from = `FROM usage_event u JOIN source s ON s.id=u.source_id
    LEFT JOIN session sess ON sess.id=u.session_id WHERE ${where.sql}`;
  return db.transaction(() => {
    const { firstObservedAt, ...totals } = db.prepare(`SELECT ${FACTS}, MIN(u.ts) AS firstObservedAt ${from}`)
      .get(where.params) as Record<string, unknown> & { firstObservedAt: number | null };
    // All-time still queries every record. Only its plot starts at the first
    // matching observation, so sparse recent histories do not begin in 1970.
    // Nonzero bounded intervals (and genuine epoch records) stay intact. Opt in
    // so older renderers keep their scope-based bin origin and allocation bound.
    const timelineRange = { from: timeline === 'observed' && scope.from === 0 ? firstObservedAt ?? scope.to : scope.from, to: scope.to };
    const span = timelineRange.to - timelineRange.from;
    // At most 120 buckets; no per-record JS scan or truncation of older records.
    const bucketMs = span <= 2 * day ? hour : Math.ceil(span / (120 * day)) * day;
    const points = db.prepare(`SELECT @timelineFrom + CAST((u.ts-@timelineFrom)/@bucketMs AS INTEGER)*@bucketMs AS at,
      COUNT(*) AS records, COALESCE(SUM(u.call_count),0) AS calls,
      COALESCE(SUM(u.input_tokens+u.cached_input_tokens+u.cache_write_tokens),0) AS inputTokens,
      COALESCE(SUM(u.output_tokens),0) AS outputTokens, COALESCE(SUM(u.total_tokens),0) AS tokens
      ${from} GROUP BY at ORDER BY at`).all({ ...where.params, timelineFrom: timelineRange.from, bucketMs });
    const effort = db.prepare(`SELECT u.effort, COUNT(*) AS records, COALESCE(SUM(u.call_count),0) AS calls
      ${from} GROUP BY u.effort ORDER BY calls DESC, u.effort ASC`).all(where.params);
    return { totals, timeline: points, effort, bucketMs, timelineRange };
  })();
}
