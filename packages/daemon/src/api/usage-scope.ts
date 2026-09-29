import { vendorSqlCase } from '../util/vendor.js';

export type UsageGrain = 'call' | 'session_aggregate' | 'unknown';
export interface UsageScope {
  from: number;
  to: number;
  sourceId?: number;
  sessionId?: number;
  project?: string;
  projectMissing?: boolean;
  harness?: string;
  provider?: string;
  vendor?: string;
  model?: string;
  q?: string;
  grain?: UsageGrain | 'all';
}

// Explicit adapter declarations: future adapters are unknown, never assumed per-call.
export const USAGE_GRAIN_SQL = `CASE WHEN s.harness = 'hermes' THEN 'session_aggregate'
  WHEN s.harness IN ('codex', 'claude-code', 'opencode') THEN 'call' ELSE 'unknown' END`;

export function parseUsageScope(query: Record<string, unknown>, now: number, options: { requireRange?: boolean; extraKeys?: string[] } = {}): UsageScope {
  const allowed = new Set(['from', 'to', 'source_id', 'session_id', 'project', 'project_missing', 'harness', 'provider', 'vendor', 'model', 'q', 'grain', ...(options.extraKeys ?? [])]);
  for (const [key, value] of Object.entries(query)) {
    if (!allowed.has(key) || typeof value !== 'string') throw new Error(`Invalid query parameter: ${key}`);
  }
  if (options.requireRange && (query.from === undefined || query.to === undefined)) throw new Error('Expected from and to');
  const integer = (key: string, fallback?: number) => {
    const value = query[key];
    if (value === undefined && fallback !== undefined) return fallback;
    if (typeof value !== 'string' || !/^\d+$/.test(value)) throw new Error(`Invalid ${key}`);
    const parsed = Number(value);
    if (!Number.isSafeInteger(parsed)) throw new Error(`Invalid ${key}`);
    return parsed;
  };
  const from = integer('from', Math.max(0, now - 86_400_000));
  const to = integer('to', now + 1);
  if (to <= from || to > 8_640_000_000_000_000) throw new Error('Invalid usage time range');
  const scope: UsageScope = { from, to };
  if (query.source_id !== undefined) {
    scope.sourceId = integer('source_id');
    if (scope.sourceId < 1) throw new Error('Invalid source_id');
  }
  if (query.session_id !== undefined) {
    scope.sessionId = integer('session_id');
    if (scope.sessionId < 1) throw new Error('Invalid session_id');
  }
  if (query.project_missing !== undefined) {
    if (query.project_missing !== '1' || query.project !== undefined) throw new Error('project_missing=1 is exclusive with project');
    scope.projectMissing = true;
  }
  for (const key of ['project', 'harness', 'provider', 'vendor', 'model', 'q'] as const) {
    const value = query[key];
    if (typeof value === 'string') {
      // Preserve exact metadata strings, including leading/trailing spaces.
      if (value.length === 0 || value.length > (key === 'q' ? 256 : 4096)) throw new Error(`Invalid ${key}`);
      scope[key] = value;
    }
  }
  if (query.grain !== undefined) {
    if (!['all', 'call', 'session_aggregate', 'unknown'].includes(query.grain as string)) throw new Error('Invalid grain');
    scope.grain = query.grain as UsageScope['grain'];
  }
  return scope;
}

/** Same parameterized predicates for rows, totals, relationships and export. */
export function usageWhere(scope: UsageScope) {
  const clauses = ['u.ts >= @from', 'u.ts < @to'];
  const params: Record<string, string | number> = { from: scope.from, to: scope.to };
  if (scope.sourceId !== undefined) { clauses.push('u.source_id = @sourceId'); params.sourceId = scope.sourceId; }
  if (scope.sessionId !== undefined) { clauses.push('u.session_id = @sessionId'); params.sessionId = scope.sessionId; }
  if (scope.projectMissing) clauses.push('sess.project IS NULL');
  for (const [key, column] of [
    ['project', 'sess.project'], ['harness', 's.harness'], ['provider', 'u.provider'],
    ['vendor', vendorSqlCase('u.model', 'u.provider')], ['model', 'u.model'],
  ] as const) {
    if (scope[key] !== undefined) { clauses.push(`${column} = @${key}`); params[key] = scope[key]!; }
  }
  if (scope.grain && scope.grain !== 'all') { clauses.push(`(${USAGE_GRAIN_SQL}) = @grain`); params.grain = scope.grain; }
  if (scope.q !== undefined) {
    clauses.push(`(instr(lower(COALESCE(sess.project, '')), lower(@q)) > 0
      OR instr(lower(COALESCE(u.model, '')), lower(@q)) > 0
      OR instr(lower(COALESCE(sess.native_session_id, '')), lower(@q)) > 0
      OR instr(lower(s.display_name), lower(@q)) > 0)`);
    params.q = scope.q;
  }
  return { sql: clauses.join(' AND '), params };
}

export function parseUsagePagination(query: Record<string, unknown>) {
  const integer = (key: string, fallback: number, min: number, max: number) => {
    if (query[key] === undefined) return fallback;
    const raw = query[key];
    const value = typeof raw === 'string' && /^\d+$/.test(raw) ? Number(raw) : NaN;
    if (!Number.isSafeInteger(value) || value < min || value > max) throw new Error(`Invalid ${key}`);
    return value;
  };
  return { limit: integer('limit', 50, 1, 500), offset: integer('offset', 0, 0, Number.MAX_SAFE_INTEGER) };
}
