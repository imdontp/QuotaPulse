import type { DB } from '../db/index.js';
import { usageWhere, type UsageScope } from './usage-scope.js';

/** Recorded, full-grain histories for the summary and every routed provider. */
export function modelTrends(db: DB, scope: UsageScope) {
  const where = usageWhere(scope);
  const bucketMs = Math.max(60_000, Math.ceil((scope.to - scope.from) / 30 / 60_000) * 60_000);
  const from = `FROM usage_event u JOIN source s ON s.id=u.source_id
    LEFT JOIN session sess ON sess.id=u.session_id WHERE ${where.sql}`;
  const params = { ...where.params, bucketMs };
  const points = db.prepare(`SELECT CAST((u.ts - @from) / @bucketMs AS INTEGER) AS bin,
    COALESCE(SUM(u.total_tokens),0) AS tokens, COALESCE(SUM(u.call_count),0) AS calls,
    COUNT(DISTINCT sess.id) AS sessions,
    COUNT(DISTINCT json_array(u.model,u.provider)) AS pairs,
    COALESCE(SUM(CASE WHEN u.cost_source IN ('computed','estimated') THEN u.cost_usd ELSE 0 END),0) AS api_value_usd,
    COALESCE(SUM(CASE WHEN u.cost_source IN ('computed','estimated') AND u.cost_usd IS NOT NULL THEN u.call_count ELSE 0 END),0) AS api_priced_calls
    ${from} GROUP BY bin ORDER BY bin`).all(params) as Array<{
      bin: number; tokens: number; calls: number; sessions: number; pairs: number; api_value_usd: number; api_priced_calls: number;
    }>;
  // Do not coalesce provider: NULL and the recorded empty string are different identities.
  const providers = db.prepare(`SELECT u.provider, CAST((u.ts - @from) / @bucketMs AS INTEGER) AS bin,
    COALESCE(SUM(u.total_tokens),0) AS tokens
    ${from} GROUP BY u.provider, bin ORDER BY u.provider, bin`).all(params) as Array<{
      provider: string | null; bin: number; tokens: number;
    }>;
  return {
    bucketMs,
    // A session can appear in several bins; these counts must not be summed as range sessions.
    points: points.map(({ bin, ...point }) => ({ start: scope.from + bin * bucketMs, ...point })),
    providers: providers.map(({ bin, ...point }) => ({ start: scope.from + bin * bucketMs, ...point })),
  };
}
