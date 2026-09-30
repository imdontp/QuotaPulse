import type { DB } from '../db/index.js';
import { vendorSqlCase } from '../util/vendor.js';
import { usageWhere, type UsageScope } from './usage-scope.js';

export type AggregateDimension = 'project' | 'model';
const FACTS = `COUNT(*) AS records,
  COALESCE(SUM(u.call_count),0) AS calls,
  COUNT(DISTINCT sess.id) AS sessions,
  COALESCE(SUM(u.input_tokens),0) AS inputTokens,
  COALESCE(SUM(u.cached_input_tokens),0) AS cachedInputTokens,
  COALESCE(SUM(u.cache_write_tokens),0) AS cacheWriteTokens,
  COALESCE(SUM(u.output_tokens),0) AS outputTokens,
  COALESCE(SUM(u.total_tokens),0) AS tokens,
  COALESCE(SUM(CASE WHEN u.cost_source='native' THEN u.cost_usd ELSE 0 END),0) AS reported_native_usd,
  COALESCE(SUM(CASE WHEN u.cost_source IN ('computed','estimated') THEN u.cost_usd ELSE 0 END),0) AS api_value_usd,
  COALESCE(SUM(CASE WHEN u.cost_source='native' AND u.cost_usd IS NOT NULL THEN u.call_count ELSE 0 END),0) AS native_calls,
  COALESCE(SUM(CASE WHEN u.cost_source='computed' AND u.cost_usd IS NOT NULL THEN u.call_count ELSE 0 END),0) AS computed_calls,
  COALESCE(SUM(CASE WHEN u.cost_source='estimated' AND u.cost_usd IS NOT NULL THEN u.call_count ELSE 0 END),0) AS estimated_calls,
  COALESCE(SUM(CASE WHEN u.cost_usd IS NULL OR u.cost_source NOT IN ('native','computed','estimated') THEN u.call_count ELSE 0 END),0) AS unknown_calls,
  COALESCE(SUM(CASE WHEN u.cost_cache_saving_usd IS NOT NULL THEN u.cost_cache_saving_usd ELSE 0 END),0) AS cache_saving_known_usd,
  COALESCE(SUM(CASE WHEN u.cost_cache_saving_usd IS NOT NULL THEN u.call_count ELSE 0 END),0) AS cache_saving_known_calls,
  MAX(u.ts) AS lastObservedAt`;

/** Opt-in aggregate; legacy project/model response cardinality is unchanged. */
export function detailedAggregates(db: DB, scope: UsageScope, dimension: AggregateDimension) {
  const where = usageWhere(scope);
  const from = `FROM usage_event u JOIN source s ON s.id=u.source_id
    LEFT JOIN session sess ON sess.id=u.session_id WHERE ${where.sql}`;
  const vendor = vendorSqlCase('u.model', 'u.provider');
  const identity = dimension === 'project'
    ? `sess.project AS project, u.source_id AS sourceId, s.harness, s.display_name AS sourceName,
       u.provider, u.model, ${vendor} AS vendor`
    : `u.model, u.provider, ${vendor} AS vendor, u.source_id AS sourceId,
       s.harness, s.display_name AS sourceName, u.effort`;
  const group = dimension === 'project'
    ? 'sess.project, u.source_id, u.provider, u.model, vendor'
    : 'u.model, u.provider, u.source_id, u.effort, vendor';
  const tie = dimension === 'project' ? 'project ASC, sourceId ASC, provider ASC, model ASC' : 'model ASC, provider ASC, sourceId ASC, effort ASC';
  const groupIdentity = dimension === 'project' ? 'sess.project AS key' : `u.model, u.provider, ${vendor} AS vendor`;
  const groupBy = dimension === 'project' ? 'sess.project' : 'u.model, u.provider, vendor';
  const groupTie = dimension === 'project' ? 'key ASC' : 'model ASC, provider ASC';
  return db.transaction(() => {
    const totals = db.prepare(`SELECT ${FACTS} ${from}`).get(where.params);
    const groups = db.prepare(`SELECT ${groupIdentity}, ${FACTS} ${from}
      GROUP BY ${groupBy} ORDER BY tokens DESC, ${groupTie}`).all(where.params);
    const rows = db.prepare(`SELECT ${identity}, ${FACTS} ${from}
      GROUP BY ${group} ORDER BY tokens DESC, ${tie}`).all(where.params);
    return { totals, groups, rows };
  })();
}
