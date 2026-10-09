import type { DB } from '../db/index.js';
import { usageWhere, type UsageScope } from './usage-scope.js';

/** Legacy machine metadata, or opt-in identities backed by matching recorded usage. */
export function runtimeSummary(db: DB, now: number, scope?: UsageScope) {
  const recentFrom = now - 5 * 60_000;
  if (scope) {
    const where = usageWhere(scope);
    const counts = db.prepare(`SELECT
      COUNT(DISTINCT CASE WHEN sess.project <> '' THEN sess.project END) AS namedProjects,
      COUNT(DISTINCT CASE WHEN u.model <> '' THEN u.model END) AS models,
      COUNT(DISTINCT CASE WHEN u.provider <> '' THEN u.provider END) AS providers,
      COUNT(DISTINCT CASE WHEN sess.last_seen_at >= @recentFrom AND sess.last_seen_at <= @now THEN sess.id END) AS recentSessions
      FROM usage_event u JOIN source s ON s.id = u.source_id
      LEFT JOIN session sess ON sess.id = u.session_id
      WHERE ${where.sql}
    `).get({ ...where.params, recentFrom, now }) as { namedProjects: number; models: number; providers: number; recentSessions: number };
    return { now, recentFrom, ...counts, scope };
  }
  const counts = db.prepare(`SELECT
    (SELECT COUNT(DISTINCT project) FROM session WHERE project IS NOT NULL AND project <> '') AS namedProjects,
    (SELECT COUNT(DISTINCT model) FROM usage_event WHERE model IS NOT NULL AND model <> '') AS models,
    (SELECT COUNT(DISTINCT provider) FROM usage_event WHERE provider IS NOT NULL AND provider <> '') AS providers,
    (SELECT COUNT(*) FROM session WHERE last_seen_at >= ? AND last_seen_at <= ?) AS recentSessions
  `).get(recentFrom, now) as { namedProjects: number; models: number; providers: number; recentSessions: number };
  return { now, recentFrom, ...counts };
}
