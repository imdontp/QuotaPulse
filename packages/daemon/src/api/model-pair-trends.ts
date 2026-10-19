import type { DB } from '../db/index.js';
import { usageWhere, type UsageScope } from './usage-scope.js';

export interface ModelPair { model: string | null; provider: string | null }

/** Bound the requested chart window, not the underlying observations or totals. */
export function parseModelPairs(raw: unknown): ModelPair[] {
  if (typeof raw !== 'string' || Buffer.byteLength(raw, 'utf8') > 262_144) {
    throw new Error('Expected pairs JSON (at most 262144 UTF-8 bytes)');
  }
  let parsed: unknown;
  try { parsed = JSON.parse(raw); }
  catch { throw new Error('Invalid pairs JSON'); }
  if (!Array.isArray(parsed) || parsed.length < 1 || parsed.length > 20) {
    throw new Error('Expected 1 to 20 model/provider pairs');
  }
  const seen = new Set<string>();
  const pairs: ModelPair[] = [];
  for (const value of parsed) {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
      throw new Error('Expected exact model and provider strings or null');
    }
    const record = value as Record<string, unknown>;
    const validPart = (part: unknown): part is string | null => part === null || (typeof part === 'string' && part.length <= 4096);
    if (Object.keys(record).length !== 2 || !Object.hasOwn(record, 'model') || !Object.hasOwn(record, 'provider') ||
        !validPart(record.model) || !validPart(record.provider)) {
      throw new Error('Expected exact model and provider strings or null');
    }
    const pair: ModelPair = { model: record.model, provider: record.provider };
    const key = JSON.stringify([pair.model, pair.provider]);
    if (!seen.has(key)) { seen.add(key); pairs.push(pair); }
  }
  return pairs;
}

/** One grouped read for the visible exact identities, with model-detail grain/bin semantics. */
export function modelPairTrends(db: DB, scope: UsageScope, pairs: ModelPair[]) {
  const where = usageWhere(scope);
  const bucketMs = Math.max(60_000, Math.ceil((scope.to - scope.from) / 30 / 60_000) * 60_000);
  const params: Record<string, string | number | null> = { ...where.params, bucketMs };
  const requested = pairs.map((pair, index) => {
    params[`model${index}`] = pair.model;
    params[`provider${index}`] = pair.provider;
    return `(@model${index}, @provider${index})`;
  }).join(',');
  return db.transaction(() => {
    // IS preserves NULL versus empty identity and uses the stored binary text comparison.
    const rows = db.prepare(`WITH requested(model,provider) AS (VALUES ${requested})
      SELECT u.model, u.provider, CAST((u.ts - @from) / @bucketMs AS INTEGER) AS bin,
        COALESCE(SUM(u.total_tokens),0) AS tokens, COALESCE(SUM(u.call_count),0) AS calls,
        COUNT(*) AS records
      FROM requested r JOIN usage_event u ON u.model IS r.model AND u.provider IS r.provider
      JOIN source s ON s.id=u.source_id LEFT JOIN session sess ON sess.id=u.session_id
      WHERE ${where.sql} GROUP BY u.model, u.provider, bin ORDER BY bin ASC`).all(params) as Array<{
        model: string | null; provider: string | null; bin: number; tokens: number; calls: number; records: number;
      }>;
    const grouped = new Map<string, Array<{ start: number; tokens: number; calls: number; records: number }>>();
    for (const { model, provider, bin, ...point } of rows) {
      const key = JSON.stringify([model, provider]);
      const points = grouped.get(key) ?? [];
      points.push({ start: scope.from + bin * bucketMs, ...point });
      grouped.set(key, points);
    }
    return { bucketMs, pairs: pairs.map(pair => ({ ...pair, points: grouped.get(JSON.stringify([pair.model, pair.provider])) ?? [] })) };
  })();
}
