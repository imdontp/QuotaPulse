import type { DB } from '../db/index.js';
import { vendorSqlCase } from '../util/vendor.js';
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
    COALESCE(SUM(u.total_tokens),0) AS tokens,
    COALESCE(SUM(u.input_tokens + u.cached_input_tokens + u.cache_write_tokens),0) AS inputTokens,
    COALESCE(SUM(u.output_tokens),0) AS outputTokens,
    COUNT(DISTINCT u.provider) AS providerCount,
    COUNT(*)-COUNT(u.provider) AS unknownProviderRecords,
    CASE WHEN COUNT(DISTINCT u.provider)=1 THEN MAX(u.provider) END AS provider,
    COUNT(DISTINCT u.model) AS modelCount,
    COUNT(*)-COUNT(u.model) AS unknownModelRecords,
    CASE WHEN COUNT(DISTINCT u.model)=1 THEN MAX(u.model) END AS model,
    MAX(u.ts) AS lastObservedAt
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
      .all({ ...(mode === 'recent' ? params : where.params), ...pagination }) as Array<{ sessionKey: number; model: string | null; modelCount: number }>;
    // Resolve only the returned page, using the same scoped model/provider pairs
    // as the session aggregates. Conflicting or unknown classifications stay unknown.
    const vendorSets = new Map<number, Set<string>>();
    const sessionParams: Record<string, number> = {};
    rows.forEach((row, index) => { sessionParams[`session${index}`] = row.sessionKey; });
    if (rows.length) {
      const placeholders = rows.map((_, index) => `@session${index}`).join(',');
      const pairs = db.prepare(`SELECT u.session_id AS sessionKey, ${vendorSqlCase('u.model', 'u.provider')} AS vendor
        FROM usage_event u JOIN source s ON s.id=u.source_id JOIN session sess ON sess.id=u.session_id
        WHERE ${where.sql} AND u.session_id IN (${placeholders}) AND u.model IS NOT NULL AND TRIM(u.model) <> ''
        GROUP BY u.session_id, u.model, u.provider`).all({ ...where.params, ...sessionParams }) as Array<{ sessionKey: number; vendor: string }>;
      for (const pair of pairs) {
        const vendors = vendorSets.get(pair.sessionKey) ?? new Set<string>();
        vendors.add(pair.vendor); vendorSets.set(pair.sessionKey, vendors);
      }
    }
    const decorated = rows.map(row => {
      const vendors = vendorSets.get(row.sessionKey);
      return { ...row, modelVendor: row.model && row.modelCount === 1 && vendors?.size === 1 ? [...vendors][0] : 'unknown' };
    });
    return { mode, rows: decorated, ...counts, total: mode === 'recent' ? counts.recentCount : counts.allCount, ...pagination };
  })();
}
