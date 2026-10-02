import type { DB } from '../db/index.js';

/** Machine-wide recorded metadata, independent of dashboard range/provider filters. */
export function runtimeSummary(db: DB, now: number) {
  const recentFrom = now - 5 * 60_000;
  const counts = db.prepare(`SELECT
    (SELECT COUNT(DISTINCT project) FROM session WHERE project IS NOT NULL AND project <> '') AS namedProjects,
    (SELECT COUNT(DISTINCT model) FROM usage_event WHERE model IS NOT NULL AND model <> '') AS models,
    (SELECT COUNT(DISTINCT provider) FROM usage_event WHERE provider IS NOT NULL AND provider <> '') AS providers,
    (SELECT COUNT(*) FROM session WHERE last_seen_at >= ? AND last_seen_at <= ?) AS recentSessions
  `).get(recentFrom, now) as { namedProjects: number; models: number; providers: number; recentSessions: number };
  return { now, recentFrom, ...counts };
}
