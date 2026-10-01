import type { DB } from '../db/index.js';
import { usageWhere, type UsageScope } from './usage-scope.js';

/** Sparse elapsed-time bins for one exact recorded model and provider identity. */
export function modelDetail(db: DB, scope: UsageScope, identity: { modelMissing: boolean; providerMissing: boolean; modelEmpty: boolean; providerEmpty: boolean }) {
  const where = usageWhere(scope);
  const predicate = `${where.sql}${identity.modelMissing ? ' AND u.model IS NULL' : ''}${identity.providerMissing ? ' AND u.provider IS NULL' : ''}${identity.modelEmpty ? " AND u.model = ''" : ''}${identity.providerEmpty ? " AND u.provider = ''" : ''}`;
  const from = `FROM usage_event u JOIN source s ON s.id=u.source_id
    LEFT JOIN session sess ON sess.id=u.session_id WHERE ${predicate}`;
  const span = scope.to - scope.from;
  const bucketMs = Math.max(60_000, Math.ceil(span / 30 / 60_000) * 60_000);
  return db.transaction(() => {
    const points = db.prepare(`SELECT CAST((u.ts - @from) / @bucketMs AS INTEGER) AS bin,
      COALESCE(SUM(u.total_tokens),0) AS tokens, COALESCE(SUM(u.call_count),0) AS calls,
      COUNT(*) AS records ${from} GROUP BY bin ORDER BY bin ASC`)
      .all({ ...where.params, bucketMs }) as Array<{ bin: number; tokens: number; calls: number; records: number }>;
    const efforts = db.prepare(`SELECT u.effort, COALESCE(SUM(u.total_tokens),0) AS tokens,
      COALESCE(SUM(u.call_count),0) AS calls, COUNT(DISTINCT sess.id) AS sessions
      ${from} GROUP BY u.effort ORDER BY tokens DESC, u.effort ASC`).all(where.params);
    const context = db.prepare(`SELECT u.context_window AS observedWindow, u.ts AS observedAt
      ${from} AND u.context_window IS NOT NULL
      ORDER BY u.context_window DESC, u.ts DESC, u.id DESC LIMIT 1`)
      .get(where.params) as { observedWindow: number; observedAt: number } | undefined;
    return {
      bucketMs,
      points: points.map(point => ({ start: scope.from + point.bin * bucketMs, tokens: point.tokens, calls: point.calls, records: point.records })),
      efforts,
      observedContext: { window: context?.observedWindow ?? null, at: context?.observedAt ?? null, origin: 'recorded usage event' },
    };
  })();
}
