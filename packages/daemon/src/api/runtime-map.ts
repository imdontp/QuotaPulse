import type { DB } from '../db/index.js';
import { usageWhere, USAGE_GRAIN_SQL, type UsageScope } from './usage-scope.js';

const DIMENSIONS = {
  project: 'sess.project',
  harness: 's.harness',
  provider: 'u.provider',
  model: 'u.model',
} as const;
type Dimension = keyof typeof DIMENSIONS;
const ORDER: Dimension[] = ['project', 'harness', 'provider', 'model'];
const TOTALS = `COALESCE(SUM(u.total_tokens),0) AS tokens,
  COUNT(*) AS records,
  COUNT(DISTINCT sess.id) AS sessions,
  COALESCE(SUM(CASE WHEN (${USAGE_GRAIN_SQL})='call' THEN 1 ELSE 0 END),0) AS callRecords,
  COALESCE(SUM(CASE WHEN (${USAGE_GRAIN_SQL})='session_aggregate' THEN 1 ELSE 0 END),0) AS aggregateRecords,
  COALESCE(SUM(CASE WHEN u.cost_source='native' THEN u.cost_usd ELSE 0 END),0) AS reportedCost,
  COALESCE(SUM(CASE WHEN u.cost_source IN ('computed','estimated') THEN u.cost_usd ELSE 0 END),0) AS apiValue,
  COALESCE(SUM(CASE WHEN u.cost_usd IS NULL OR u.cost_source='unknown' THEN 1 ELSE 0 END),0) AS unknownCostRecords,
  COALESCE(SUM(u.input_tokens),0) AS inputTokens,
  COALESCE(SUM(u.cached_input_tokens),0) AS cachedInputTokens,
  COALESCE(SUM(u.cache_write_tokens),0) AS cacheWriteTokens,
  COALESCE(SUM(CASE WHEN u.cost_cache_saving_usd IS NOT NULL THEN u.cost_cache_saving_usd ELSE 0 END),0) AS cacheSavingKnownUsd,
  COALESCE(SUM(CASE WHEN u.cost_cache_saving_usd IS NOT NULL THEN u.call_count ELSE 0 END),0) AS cacheSavingKnownCalls,
  COALESCE(SUM(CASE WHEN u.cost_source='native' AND u.cost_usd IS NOT NULL THEN u.call_count ELSE 0 END),0) AS nativeCalls,
  COALESCE(SUM(CASE WHEN u.cost_source='computed' AND u.cost_usd IS NOT NULL THEN u.call_count ELSE 0 END),0) AS computedCalls,
  COALESCE(SUM(CASE WHEN u.cost_source='estimated' AND u.cost_usd IS NOT NULL THEN u.call_count ELSE 0 END),0) AS estimatedCalls,
  COALESCE(SUM(CASE WHEN u.cost_usd IS NULL OR u.cost_source NOT IN ('native','computed','estimated') THEN u.call_count ELSE 0 END),0) AS unknownCalls`;

/** Read-only graph facts. Every node calculates DISTINCT sessions in its own scope. */
export function runtimeMap(db: DB, scope: UsageScope) {
  const where = usageWhere(scope);
  const from = `FROM usage_event u JOIN source s ON s.id=u.source_id
    LEFT JOIN session sess ON sess.id=u.session_id WHERE ${where.sql}`;
  return db.transaction(() => {
    const totals = db.prepare(`SELECT ${TOTALS} ${from}`).get(where.params) as {
      tokens: number; records: number; sessions: number; callRecords: number;
      aggregateRecords: number; reportedCost: number; apiValue: number; unknownCostRecords: number;
      inputTokens: number; cachedInputTokens: number; cacheWriteTokens: number;
      cacheSavingKnownUsd: number; cacheSavingKnownCalls: number;
      nativeCalls: number; computedCalls: number; estimatedCalls: number; unknownCalls: number;
    };
    const nodes = {} as Record<Dimension, Array<typeof totals & { key: string | null }>>;
    for (const dimension of ORDER) {
      const column = DIMENSIONS[dimension];
      nodes[dimension] = db.prepare(`SELECT ${column} AS key, ${TOTALS} ${from}
        GROUP BY ${column} ORDER BY tokens DESC, key ASC`).all(where.params) as typeof nodes[typeof dimension];
    }
    const edges = ORDER.slice(0, -1).flatMap((dimension, column) => {
      const fromColumn = DIMENSIONS[dimension], toColumn = DIMENSIONS[ORDER[column + 1]!];
      const rows = db.prepare(`SELECT ${fromColumn} AS edgeFrom, ${toColumn} AS edgeTo,
        COALESCE(SUM(u.total_tokens),0) AS tokens ${from}
        GROUP BY ${fromColumn}, ${toColumn}`).all(where.params) as Array<{ edgeFrom: string | null; edgeTo: string | null; tokens: number }>;
      return rows.map(row => ({ column, from: row.edgeFrom, to: row.edgeTo, tokens: row.tokens }));
    });
    return { totals, nodes, edges };
  })();
}
