import type { DB } from '../db/index.js';
import { vendorSqlCase } from '../util/vendor.js';
import { usageWhere, USAGE_GRAIN_SQL, type UsageScope } from './usage-scope.js';

export const MINUTE_GROUPS = ['none', 'harness', 'model', 'provider', 'vendor', 'project', 'provider_model'] as const;
export type MinuteGroup = typeof MINUTE_GROUPS[number];

interface MinuteValues {
  bucket_ts: number; records: number; calls: number;
  input_tokens: number; cached_input_tokens: number; cache_write_tokens: number;
  output_tokens: number; total_tokens: number;
}
interface PairIdentity { provider: string | null; model: string | null }

export function minuteTrend(db: DB, scope: UsageScope, groupBy: MinuteGroup) {
  const where = usageWhere(scope);
  const pairs = groupBy === 'provider_model';
  const group = groupBy === 'provider_model' ? null : {
    none: "'all'", harness: "s.harness || '/' || s.profile", model: "COALESCE(u.model, '(unknown)')",
    provider: "COALESCE(u.provider, '(unknown)')", vendor: vendorSqlCase('u.model', 'u.provider'),
    project: "COALESCE(sess.project, '(none)')",
  }[groupBy];
  const from = `FROM usage_event u JOIN source s ON s.id=u.source_id
    LEFT JOIN session sess ON sess.id=u.session_id WHERE ${where.sql}`;
  return db.transaction(() => {
    const rawRows = db.prepare(`SELECT CAST(u.ts / 60000 AS INTEGER) * 60000 AS bucket_ts,
      ${pairs ? 'u.provider, u.model' : `${group} AS series`},
      COUNT(*) AS records, COALESCE(SUM(u.call_count),0) AS calls,
      COALESCE(SUM(u.input_tokens),0) AS input_tokens,
      COALESCE(SUM(u.cached_input_tokens),0) AS cached_input_tokens,
      COALESCE(SUM(u.cache_write_tokens),0) AS cache_write_tokens,
      COALESCE(SUM(u.output_tokens),0) AS output_tokens,
      COALESCE(SUM(u.total_tokens),0) AS total_tokens
      ${from} AND (${USAGE_GRAIN_SQL})='call'
      GROUP BY bucket_ts, ${pairs ? 'u.provider, u.model' : 'series'}
      ORDER BY bucket_ts ASC, ${pairs ? 'u.provider ASC, u.model ASC' : 'series ASC'}`).all(where.params);
    // Group raw nullable identities first; display labels and delimiters cannot identify a pair.
    const rows = pairs
      ? (rawRows as Array<MinuteValues & PairIdentity>).map(row => ({ ...row, series: JSON.stringify([row.provider, row.model]) }))
      : rawRows as Array<MinuteValues & { series: string }>;
    const excludedSources = db.prepare(`SELECT s.id AS source_id, s.harness, s.display_name AS source_name,
      ${USAGE_GRAIN_SQL} AS grain, COUNT(*) AS records, COALESCE(SUM(u.call_count),0) AS calls,
      COALESCE(SUM(u.total_tokens),0) AS last_observed_tokens
      ${from} AND (${USAGE_GRAIN_SQL})<>'call'
      GROUP BY s.id ORDER BY s.id`).all(where.params) as Array<{
        source_id: number; harness: string; source_name: string; grain: 'session_aggregate' | 'unknown';
        records: number; calls: number; last_observed_tokens: number;
      }>;
    return {
      rows,
      ...(pairs ? {
        // Window totals include all grains; sparse minute rows above include call records only.
        groups: db.prepare(`SELECT u.provider, u.model, COUNT(*) AS records,
          COALESCE(SUM(u.call_count),0) AS calls, COALESCE(SUM(u.total_tokens),0) AS tokens,
          COALESCE(SUM(CASE WHEN (${USAGE_GRAIN_SQL})='call' THEN 1 ELSE 0 END),0) AS callRecords,
          COALESCE(SUM(CASE WHEN (${USAGE_GRAIN_SQL})='session_aggregate' THEN 1 ELSE 0 END),0) AS aggregateRecords,
          COALESCE(SUM(CASE WHEN (${USAGE_GRAIN_SQL})='unknown' THEN 1 ELSE 0 END),0) AS unknownRecords
          ${from} GROUP BY u.provider, u.model ORDER BY tokens DESC, u.provider ASC, u.model ASC`)
          .all(where.params) as Array<PairIdentity & {
            records: number; calls: number; tokens: number;
            callRecords: number; aggregateRecords: number; unknownRecords: number;
          }>,
      } : {}),
      coverage: {
        includedRecords: rows.reduce((sum, row) => sum + row.records, 0),
        includedCalls: rows.reduce((sum, row) => sum + row.calls, 0),
        excludedRecords: excludedSources.reduce((sum, row) => sum + row.records, 0),
        excludedCalls: excludedSources.reduce((sum, row) => sum + row.calls, 0),
        excludedSources,
      },
    };
  })();
}
