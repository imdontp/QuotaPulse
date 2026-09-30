import type { DB } from '../db/index.js';
import { usageWhere, type UsageScope } from './usage-scope.js';

export type LiveSessionMode = 'recent' | 'all';
const RECENT_MS = 5 * 60_000;

/** Session metadata and counts over recorded usage; last_seen_at is the source timestamp. */
export function liveSessions(db: DB, scope: UsageScope, now: number, mode: LiveSessionMode, pagination: { limit: number; offset: number }) {
  const where = usageWhere(scope);
  const base = `SELECT sess.id AS sessionKey, sess.native_session_id AS nativeSessionId,
    sess.project, sess.cwd, sess.git_branch AS gitBranch, sess.last_seen_at AS lastSeenAt,
    s.harness, s.display_name AS sourceName,
    COUNT(*) AS records, COALESCE(SUM(u.call_count),0) AS calls,
    COALESCE(SUM(u.total_tokens),0) AS tokens, MAX(u.ts) AS lastObservedAt
    FROM usage_event u JOIN source s ON s.id=u.source_id
    JOIN session sess ON sess.id=u.session_id
    WHERE ${where.sql} GROUP BY sess.id`;
  const recent = 'lastSeenAt >= @recentFrom AND lastSeenAt <= @now';
  const params = { ...where.params, recentFrom: now - RECENT_MS, now };
  return db.transaction(() => {
    const counts = db.prepare(`SELECT COUNT(*) AS allCount,
      COALESCE(SUM(CASE WHEN ${recent} THEN 1 ELSE 0 END),0) AS recentCount FROM (${base})`)
      .get(params) as { allCount: number; recentCount: number };
    const rows = db.prepare(`SELECT * FROM (${base})
      ${mode === 'recent' ? `WHERE ${recent}` : ''}
      ORDER BY lastObservedAt DESC, sessionKey DESC LIMIT @limit OFFSET @offset`)
      .all({ ...(mode === 'recent' ? params : where.params), ...pagination });
    return { mode, rows, ...counts, total: mode === 'recent' ? counts.recentCount : counts.allCount, ...pagination };
  })();
}
