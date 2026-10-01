import type { DB } from '../db/index.js';
import { FACTS } from './detailed-aggregates.js';
import { usageWhere, type UsageScope } from './usage-scope.js';

/** Full filtered range, independently of the record table's page. */
export function historySummary(db: DB, scope: UsageScope) {
  const where = usageWhere(scope);
  const span = scope.to - scope.from;
  const hour = 3_600_000;
  const day = 24 * hour;
  // At most 120 buckets, even for all-time histories; no per-record JS scan.
  const bucketMs = span <= 2 * day ? hour : Math.ceil(span / (120 * day)) * day;
  const from = `FROM usage_event u JOIN source s ON s.id=u.source_id
    LEFT JOIN session sess ON sess.id=u.session_id WHERE ${where.sql}`;
  return db.transaction(() => {
    const totals = db.prepare(`SELECT ${FACTS} ${from}`).get(where.params);
    const timeline = db.prepare(`SELECT @from + CAST((u.ts-@from)/@bucketMs AS INTEGER)*@bucketMs AS at,
      COUNT(*) AS records, COALESCE(SUM(u.call_count),0) AS calls,
      COALESCE(SUM(u.input_tokens+u.cached_input_tokens+u.cache_write_tokens),0) AS inputTokens,
      COALESCE(SUM(u.output_tokens),0) AS outputTokens, COALESCE(SUM(u.total_tokens),0) AS tokens
      ${from} GROUP BY at ORDER BY at`).all({ ...where.params, bucketMs });
    const effort = db.prepare(`SELECT u.effort, COUNT(*) AS records, COALESCE(SUM(u.call_count),0) AS calls
      ${from} GROUP BY u.effort ORDER BY calls DESC, u.effort ASC`).all(where.params);
    return { totals, timeline, effort, bucketMs };
  })();
}
