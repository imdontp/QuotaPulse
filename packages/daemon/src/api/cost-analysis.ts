import type { DB } from '../db/index.js';
import { vendorSqlCase } from '../util/vendor.js';
import { USAGE_GRAIN_SQL, usageWhere, type UsageScope } from './usage-scope.js';

export type CostBasis = 'api' | 'native';

/** Read one monetary basis across the entire scope, including server-ranked sessions. */
export function costAnalysis(db: DB, scope: UsageScope, basis: CostBasis) {
  const where = usageWhere(scope);
  const from = `FROM usage_event u JOIN source s ON s.id=u.source_id
    LEFT JOIN session sess ON sess.id=u.session_id WHERE ${where.sql}`;
  const qualifies = basis === 'api'
    ? "u.cost_source IN ('computed','estimated') AND u.cost_usd IS NOT NULL"
    : "u.cost_source = 'native' AND u.cost_usd IS NOT NULL";
  const amount = `CASE WHEN ${qualifies} THEN u.cost_usd ELSE 0 END`;
  const calls = `CASE WHEN ${qualifies} THEN u.call_count ELSE 0 END`;
  const tokens = `CASE WHEN ${qualifies} THEN u.total_tokens ELSE 0 END`;
  const facts = `COALESCE(SUM(${amount}),0) AS amount,
    COALESCE(SUM(${calls}),0) AS pricedCalls,
    COALESCE(SUM(${tokens}),0) AS pricedTokens,
    COALESCE(SUM(u.call_count),0) AS allCalls,
    COALESCE(SUM(u.total_tokens),0) AS allTokens,
    COUNT(DISTINCT sess.id) AS sessions`;
  const span = scope.to - scope.from;
  const bucketMs = Math.max(60_000, Math.ceil(span / 30 / 60_000) * 60_000);
  const vendor = vendorSqlCase('u.model', 'u.provider');
  return db.transaction(() => {
    const totals = db.prepare(`SELECT ${facts},
      COALESCE(SUM(CASE WHEN u.cost_usd IS NULL OR u.cost_source NOT IN ('native','computed','estimated') THEN u.call_count ELSE 0 END),0) AS unknownCalls,
      COALESCE(SUM(CASE WHEN u.cost_source='estimated' AND u.cost_usd IS NOT NULL THEN u.call_count ELSE 0 END),0) AS estimatedCalls,
      COALESCE(SUM(CASE WHEN ${USAGE_GRAIN_SQL} <> 'call' THEN u.call_count ELSE 0 END),0) AS nonCallCalls,
      COALESCE(SUM(CASE WHEN u.cost_source IN ('computed','estimated') AND u.cost_cache_saving_usd IS NOT NULL THEN u.cost_cache_saving_usd ELSE 0 END),0) AS knownCacheSavingUsd,
      COALESCE(SUM(CASE WHEN u.cost_source IN ('computed','estimated') AND u.cost_cache_saving_usd IS NOT NULL THEN u.call_count ELSE 0 END),0) AS knownCacheSavingCalls
      ${from}`).get(where.params);
    const points = db.prepare(`SELECT CAST((u.ts - @from) / @bucketMs AS INTEGER) AS bin,
      ${facts} ${from} GROUP BY bin ORDER BY bin ASC`)
      .all({ ...where.params, bucketMs }) as Array<{ bin: number; amount: number; pricedCalls: number; pricedTokens: number; allCalls: number; allTokens: number; sessions: number }>;
    const providers = db.prepare(`SELECT u.provider, ${facts} ${from}
      GROUP BY u.provider ORDER BY amount DESC, u.provider ASC`).all(where.params);
    const models = db.prepare(`SELECT u.model, u.provider, ${vendor} AS vendor, ${facts} ${from}
      GROUP BY u.model, u.provider, vendor ORDER BY amount DESC, u.model ASC, u.provider ASC`).all(where.params);
    const projects = db.prepare(`SELECT sess.project AS project, ${facts} ${from}
      GROUP BY sess.project ORDER BY amount DESC, project ASC`).all(where.params);
    const sessions = db.prepare(`SELECT sess.id AS sessionKey, sess.native_session_id AS nativeSessionId,
      sess.project, s.harness, s.display_name AS sourceName, MAX(u.ts) AS lastObservedAt,
      ${facts} ${from} AND sess.id IS NOT NULL
      GROUP BY sess.id HAVING pricedCalls > 0
      ORDER BY amount DESC, lastObservedAt DESC, sess.id DESC LIMIT 10`).all(where.params);
    return {
      totals, providers, models, projects, sessions, bucketMs,
      points: points.map(point => ({ start: scope.from + point.bin * bucketMs,
        amount: point.amount, pricedCalls: point.pricedCalls, pricedTokens: point.pricedTokens,
        allCalls: point.allCalls, allTokens: point.allTokens })),
    };
  })();
}
