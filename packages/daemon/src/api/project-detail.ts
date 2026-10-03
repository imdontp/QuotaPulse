import type { DB } from '../db/index.js';
import { usageWhere, type UsageScope } from './usage-scope.js';

/** All project mini charts in one scoped query; null and empty identities stay distinct. */
export function projectTrends(db: DB, scope: UsageScope) {
  const where = usageWhere(scope);
  const bucketMs = Math.max(60_000, Math.ceil((scope.to - scope.from) / 30 / 60_000) * 60_000);
  const rows = db.prepare(`SELECT sess.project AS project,
    CAST((u.ts - @from) / @bucketMs AS INTEGER) AS bin,
    COALESCE(SUM(u.total_tokens),0) AS tokens
    FROM usage_event u JOIN source s ON s.id=u.source_id
    LEFT JOIN session sess ON sess.id=u.session_id WHERE ${where.sql}
    GROUP BY sess.project, bin ORDER BY sess.project, bin`).all({ ...where.params, bucketMs }) as Array<{ project: string | null; bin: number; tokens: number }>;
  return { bucketMs, points: rows.map(row => ({ project: row.project, start: scope.from + row.bin * bucketMs, tokens: row.tokens })) };
}

/** One exact project scope. Bins are elapsed time, capped at 30 without fabricating gaps. */
export function projectDetail(db: DB, scope: UsageScope, pagination: { limit: number; offset: number }) {
  const where = usageWhere(scope);
  const from = `FROM usage_event u JOIN source s ON s.id=u.source_id
    LEFT JOIN session sess ON sess.id=u.session_id WHERE ${where.sql}`;
  const span = scope.to - scope.from;
  const bucketMs = Math.max(60_000, Math.ceil(span / 30 / 60_000) * 60_000);
  return db.transaction(() => {
    const points = db.prepare(`SELECT CAST((u.ts - @from) / @bucketMs AS INTEGER) AS bin,
      COALESCE(SUM(u.total_tokens),0) AS tokens, COALESCE(SUM(u.call_count),0) AS calls,
      COUNT(*) AS records
      ${from} GROUP BY bin ORDER BY bin ASC`).all({ ...where.params, bucketMs }) as Array<{ bin: number; tokens: number; calls: number; records: number }>;
    const { total } = db.prepare(`SELECT COUNT(DISTINCT sess.id) AS total ${from}`)
      .get(where.params) as { total: number };
    const sessions = db.prepare(`SELECT sess.id AS sessionKey, sess.native_session_id AS nativeSessionId,
      sess.cwd, sess.git_branch AS gitBranch, s.harness, s.display_name AS sourceName,
      COALESCE(SUM(u.total_tokens),0) AS tokens, COALESCE(SUM(u.call_count),0) AS calls,
      MAX(u.ts) AS lastObservedAt
      ${from} AND sess.id IS NOT NULL GROUP BY sess.id
      ORDER BY lastObservedAt DESC, sess.id DESC LIMIT @limit OFFSET @offset`)
      .all({ ...where.params, ...pagination });
    const recent = db.prepare(`SELECT u.id AS eventId, u.ts AS timestamp, u.total_tokens AS tokens,
      u.call_count AS calls, u.model, u.provider, s.harness, sess.id AS sessionKey
      ${from} ORDER BY u.ts DESC, u.id DESC LIMIT 10`).all(where.params);
    return { bucketMs, points: points.map(point => ({
      start: scope.from + point.bin * bucketMs,
      tokens: point.tokens, calls: point.calls, records: point.records,
    })), sessions: { rows: sessions, total, ...pagination }, recent };
  })();
}
