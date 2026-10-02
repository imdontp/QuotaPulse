import Fastify, { type FastifyInstance, type FastifyReply } from 'fastify';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { Readable } from 'node:stream';
import type { ServerResponse } from 'node:http';
import { fileURLToPath } from 'node:url';
import type { DB } from '../db/index.js';
import type { Scheduler } from '../ingest/scheduler.js';
import * as q from '../api/queries.js';
import { logger } from '../util/log.js';
import { refreshPricing } from '../pricing/refresh.js';
import { runtimeSnapshot } from '../runtime.js';
import { resolveUsagePeriod, type UsageBucket, type UsageRangeKey } from './usage-period.js';
import { parseUsagePagination, parseUsageScope, type UsageScope } from './usage-scope.js';
import { minuteTrend, MINUTE_GROUPS, type MinuteGroup } from './minute-trend.js';
import { runtimeMap } from './runtime-map.js';
import { parseQuotaHistoryScope, quotaHistory } from './quota-history.js';
import { detailedAggregates } from './detailed-aggregates.js';
import { projectDetail } from './project-detail.js';
import { modelDetail } from './model-detail.js';
import { costAnalysis, type CostBasis } from './cost-analysis.js';
import { liveSessions, type LiveSessionMode } from './live-sessions.js';
import { historySummary } from './history-summary.js';
import { runtimeSummary } from './runtime-summary.js';

const log = logger('api');

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
};

const DAY = 86_400_000;

const USAGE_EXPORT_HEADERS = [
  'event_id', 'timestamp_utc', 'timestamp_ms', 'call_count', 'source_id', 'harness', 'profile', 'source_name',
  'provider', 'vendor', 'model', 'effort', 'service_tier', 'project', 'session_key', 'is_subagent',
  'input_tokens', 'cached_input_tokens', 'cache_write_tokens', 'output_tokens', 'reasoning_tokens',
  'total_tokens', 'duration_ms', 'cost_usd', 'cost_input_usd', 'cost_cached_input_usd',
  'cost_cache_write_usd', 'cost_output_usd', 'cost_cache_saving_usd', 'cost_source', 'price_provider',
] as const;

function csvCell(value: unknown): string {
  if (value == null) return '';
  const raw = String(value);
  // Project/model/source metadata can come from local tools. Excel interprets a leading
  // formula marker as code when the exported CSV is opened, even in a quoted cell.
  const text = typeof value === 'string' && /^[\s\u0000-\u001f]*[=+\-@]/u.test(raw) ? `'${raw}` : raw;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function csvLine(values: readonly unknown[]): string {
  return `${values.map(csvCell).join(',')}\r\n`;
}

function usageExportFilename(from: number, to: number): string {
  const compact = (ms: number) => new Date(ms).toISOString().slice(0, 16).replace(/[-:]/g, '');
  return `quotapulse-usage-${compact(from)}-${compact(to)}.csv`;
}

function usageTimestampUtc(timestampMs: number): string {
  return new Date(timestampMs).toISOString();
}

function usageCsvStream(rows: Iterable<q.UsageEventRow>, includeGrain = false): Readable {
  function* chunks(): Generator<string> {
    // The BOM makes the UTF-8 CSV open cleanly in Excel while remaining valid CSV for AI tools.
    yield `\uFEFF${csvLine(includeGrain ? [...USAGE_EXPORT_HEADERS, 'grain'] : USAGE_EXPORT_HEADERS)}`;
    for (const row of rows) {
      yield csvLine([
        row.event_id, usageTimestampUtc(row.timestamp_ms), row.timestamp_ms, row.call_count,
        row.source_id, row.harness, row.profile, row.source_name, row.provider, row.vendor,
        row.model, row.effort, row.service_tier, row.project, row.session_key, row.is_subagent,
        row.input_tokens, row.cached_input_tokens, row.cache_write_tokens, row.output_tokens,
        row.reasoning_tokens, row.total_tokens, row.duration_ms, row.cost_usd, row.cost_input_usd,
        row.cost_cached_input_usd, row.cost_cache_write_usd, row.cost_output_usd,
        row.cost_cache_saving_usd, row.cost_source, row.price_provider,
        ...(includeGrain ? [row.grain] : []),
      ]);
    }
  }
  return Readable.from(chunks());
}

/**
 * Local midnight, so "today" means the calendar day the user is actually in.
 *
 * This was `now - DAY` for a long time, which is a rolling 24 hours and something quite
 * different: measured at 00:36 the two answers were 314.9M and 18.8M tokens, a factor of
 * 16.7. The error is largest first thing in the morning and shrinks to nothing by
 * midnight, so the figure looked right every evening and was wildly wrong every morning.
 *
 * The daemon runs in the user's own timezone, so the platform's local-time handling is
 * exactly the right notion of "day" here -- no offset arithmetic of our own.
 */
function startOfToday(now: number): number {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export interface ServerOptions {
  port: number;
  token: string;
  webRoot?: string;
}

export function buildServer(db: DB, scheduler: Scheduler, opts: ServerOptions): FastifyInstance {
  const app = Fastify({ logger: false, bodyLimit: 1 << 20 });
  const eventStreams = new Set<ServerResponse>();
  app.addHook('preClose', async () => {
    for (const stream of eventStreams) stream.end();
  });

  const webRoot =
    opts.webRoot ??
    resolve(fileURLToPath(new URL('.', import.meta.url)), '..', '..', '..', 'web', 'dist');

  /*
   * Loopback-only, so the threat model is other local processes rather than the
   * network. The token stops a random page in the user's browser from reading the
   * API via a stray fetch; index.html is exempt because it is what delivers the token.
   */
  app.addHook('onRequest', async (req, reply) => {
    if (!req.url.startsWith('/api/')) return;
    const header = req.headers['x-quotapulse-token'];
    const query = (req.query as { token?: string } | undefined)?.token;
    if (header === opts.token || query === opts.token) return;
    await reply.code(401).send({ error: 'unauthorized' });
  });

  app.get('/api/health', async () => ({
    ok: true,
    now: Date.now(),
    scheduler: scheduler.status,
    ...q.health(db),
  }));

  // Opt-in local diagnostics endpoint. It contains process/scheduler counters only;
  // usage rows, paths, prompts, and credentials stay outside this response.
  app.get('/api/diagnostics/runtime', async () => runtimeSnapshot(scheduler));

  app.get('/api/runtime-summary', async (req, reply) => {
    if (Object.keys(req.query as Record<string, unknown>).length) return reply.code(400).send({ error: 'Runtime summary has machine-wide scope' });
    return runtimeSummary(db, Date.now());
  });

  app.get('/api/overview', async () => {
    const now = Date.now();
    const limits = q.latestLimits(db);
    /*
     * Computed once and shared. `sourceStatus` is the costliest query in this handler (eight
     * correlated subqueries per source row) and `harnessStatus` used to run it internally
     * while the response asked for it again, so it was paid twice. `accountStatus` was paid
     * twice for the same reason: once inside `subscriptionStatus`, once for the `accounts`
     * alias below, which no client has read since the Account to Subscription migration --
     * `git grep` finds zero references outside the fixtures, so it is gone rather than
     * being kept in case.
     */
    const observed = q.accountStatus(db);
    const sourceRows = q.sourceStatus(db);
    return {
      now,
      today: q.totalsSince(db, startOfToday(now)),
      // Deliberately still a rolling seven days -- the label says "last 7 days" to match.
      week: q.totalsSince(db, now - 7 * DAY),
      allTime: q.totalsSince(db, 0),
      bySourceToday: q.totalsBySource(db, startOfToday(now)),
      bySourceAll: q.totalsBySource(db, 0),
      limits: withBurn(db, limits),
      subscriptions: q.subscriptionStatus(db, observed),
      harnesses: q.harnessStatus(db, sourceRows),
      settings: q.appSettings(db),
      sources: q.listSources(db),
      // Raw source rows remain useful to diagnostics; the dashboard renders the
      // hierarchical harnesses field above.
      sourceStatus: sourceRows,
      lastPass: scheduler.status.lastPass,
    };
  });

  app.get('/api/pricing/coverage', async (req, reply) => {
    const p = req.query as Record<string, string | undefined>;
    const from = Number(p.from), to = Number(p.to);
    const sourceId = p.source_id == null ? undefined : Number(p.source_id);
    if (!p.from || !p.to || !Number.isSafeInteger(from) || !Number.isSafeInteger(to) ||
        from < 0 || to < from || to > 8_640_000_000_000_000 ||
        (sourceId != null && (!Number.isSafeInteger(sourceId) || sourceId <= 0))) {
      return reply.code(400).send({ error: 'Expected from/to epoch milliseconds and an optional positive source_id' });
    }
    return q.pricingCoverage(db, { from, to, ...(sourceId == null ? {} : { sourceId }) });
  });

  app.post('/api/pricing/refresh', async (_req, reply) => {
    try {
      return await refreshPricing(db);
    } catch (error) {
      const code = (error as { code?: string }).code;
      log.error('pricing refresh failed', (error as Error).message);
      return reply.code(code === 'network' || code === 'http' ? 502 : 422).send({
        error: 'pricing refresh failed',
        reason: (error as Error).message,
      });
    }
  });

  app.get('/api/alerts', async (req, reply) => {
    const p = req.query as Record<string, string | undefined>;
    const from = p.from == null ? undefined : Number(p.from);
    const to = p.to == null ? undefined : Number(p.to);
    const sourceId = p.source_id == null ? undefined : Number(p.source_id);
    const limit = p.limit == null ? undefined : Number(p.limit);
    if ((from != null && !Number.isSafeInteger(from)) ||
        (to != null && !Number.isSafeInteger(to)) ||
        (from != null && from < 0) || (to != null && to < 0) ||
        (from != null && to != null && to < from) ||
        (sourceId != null && (!Number.isSafeInteger(sourceId) || sourceId <= 0)) ||
        (limit != null && (!Number.isSafeInteger(limit) || limit < 1 || limit > 500))) {
      return reply.code(400).send({ error: 'Invalid alert history range, source_id, or limit' });
    }
    return { events: q.alertHistory(db, {
      ...(from == null ? {} : { from }), ...(to == null ? {} : { to }),
      ...(sourceId == null ? {} : { sourceId }), ...(limit == null ? {} : { limit }),
      pending: p.pending === '1',
    }) };
  });

  app.post('/api/alerts/:id/delivered', async (req, reply) => {
    const id = Number((req.params as { id: string }).id);
    if (!Number.isSafeInteger(id) || id <= 0) return reply.code(400).send({ error: 'Invalid alert id' });
    if (!q.markAlertDelivered(db, id)) return reply.code(404).send({ error: 'Alert not found' });
    return { ok: true };
  });

  app.get('/api/notification-settings', async () => q.notificationSettings(db));
  app.put('/api/notification-settings', async (req, reply) => {
    if (req.body != null && (typeof req.body !== 'object' || Array.isArray(req.body))) {
      return reply.code(400).send({ error: 'Notification settings must be a JSON object' });
    }
    const body = (req.body ?? {}) as Record<string, unknown>;
    const validMinute = (value: unknown) => value == null || (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value < 1440);
    const validSnooze = (value: unknown) => value == null || (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0);
    if ((body.enabled != null && typeof body.enabled !== 'boolean') || !validMinute(body.quiet_start) || !validMinute(body.quiet_end) || !validSnooze(body.snooze_until)) {
      return reply.code(400).send({ error: 'Invalid notification settings' });
    }
    return q.updateNotificationSettings(db, {
      ...(body.enabled == null ? {} : { enabled: body.enabled }),
      ...(body.snooze_until === undefined ? {} : { snooze_until: body.snooze_until as number | null }),
      ...(body.quiet_start === undefined ? {} : { quiet_start: body.quiet_start as number | null }),
      ...(body.quiet_end === undefined ? {} : { quiet_end: body.quiet_end as number | null }),
    });
  });

  app.get('/api/settings', async () => q.appSettings(db));
  app.put('/api/settings', async (req, reply) => {
    if (req.body != null && (typeof req.body !== 'object' || Array.isArray(req.body))) {
      return reply.code(400).send({ error: 'Settings must be a JSON object' });
    }
    const body = (req.body ?? {}) as Record<string, unknown>;
    const validHidden = body.hidden_subscriptions === undefined || (
      Array.isArray(body.hidden_subscriptions) &&
      body.hidden_subscriptions.every((key) => typeof key === 'string' && key.trim() !== '')
    );
    if ((body.pet_enabled != null && typeof body.pet_enabled !== 'boolean') ||
        (body.tray_animation_enabled != null && typeof body.tray_animation_enabled !== 'boolean') ||
        !validHidden) {
      return reply.code(400).send({ error: 'Invalid application settings' });
    }
    const settings = q.updateAppSettings(db, {
      ...(body.pet_enabled == null ? {} : { pet_enabled: body.pet_enabled }),
      ...(body.tray_animation_enabled == null ? {} : { tray_animation_enabled: body.tray_animation_enabled }),
      ...(body.hidden_subscriptions === undefined ? {} : { hidden_subscriptions: body.hidden_subscriptions as string[] }),
    });
    scheduler.emit('settings', settings);
    return settings;
  });

  /**
   * Interactive refresh: ingest the current source cursors before the browser
   * re-queries its view. The scheduler serializes this with watch/poll passes, so
   * two tabs cannot make adapters read concurrently.
   */
  app.post('/api/refresh', async (_req, reply) => {
    try {
      const pass = await scheduler.runNow();
      return {
        now: Date.now(),
        pass: {
          newEvents: pass.newEvents,
          newLimits: pass.newLimits,
          durationMs: pass.durationMs,
          failedSources: pass.results.filter((r) => r.error != null).length,
          trigger: 'manual' as const,
        },
      };
    } catch (err) {
      log.error('manual refresh failed', (err as Error).message);
      return reply.code(503).send({ error: 'refresh failed' });
    }
  });

  app.get('/api/limits', async () => ({
    now: Date.now(),
    limits: withBurn(db, q.latestLimits(db)),
    subscriptions: q.subscriptionStatus(db),
    harnesses: q.harnessStatus(db),
    accounts: q.accountStatus(db),
  }));

  app.get('/api/quota-history', async (req, reply) => {
    const now = Date.now();
    try {
      return quotaHistory(db, parseQuotaHistoryScope(req.query as Record<string, unknown>, now), now);
    } catch (error) {
      if (error instanceof Error && (error.message.startsWith('Invalid ') || error.message.startsWith('Unknown ') || error.message.startsWith('Quota-history range'))) {
        return reply.code(400).send({ error: error.message });
      }
      throw error;
    }
  });

  app.get('/api/usage', async (req, reply) => {
    const s = req.query as Record<string, string | undefined>;
    const range = s.range as UsageRangeKey | undefined;
    const validRanges: UsageRangeKey[] = ['today', 'week', 'month', 'all', 'custom'];
    const validBuckets: UsageBucket[] = ['hour', 'day', 'week', 'month'];
    const sourceId = s.source_id == null ? undefined : Number(s.source_id);
    const from = s.from == null ? undefined : Number(s.from);
    const to = s.to == null ? undefined : Number(s.to);
    const bucket = s.bucket == null || s.bucket === 'auto' ? undefined : s.bucket as UsageBucket;
    if ((range != null && !validRanges.includes(range)) ||
        (bucket != null && !validBuckets.includes(bucket)) ||
        (from != null && (!Number.isSafeInteger(from) || from < 0)) ||
        (to != null && (!Number.isSafeInteger(to) || to < 0)) ||
        (sourceId != null && (!Number.isSafeInteger(sourceId) || sourceId <= 0))) {
      return reply.code(400).send({ error: 'Invalid usage range, bucket, or source_id' });
    }
    try {
      const period = resolveUsagePeriod({
        range: range ?? 'today',
        ...(from == null ? {} : { from }),
        ...(to == null ? {} : { to }),
        ...(bucket == null ? {} : { bucket }),
      });
      return q.usageSnapshot(db, period, sourceId);
    } catch (error) {
      return reply.code(400).send({ error: (error as Error).message });
    }
  });

  app.get('/api/export/usage', async (req, reply) => {
    const s = req.query as Record<string, unknown>;
    let scope: UsageScope;
    try {
      scope = parseUsageScope(s, Date.now(), { requireRange: true, extraKeys: ['format', 'order', 'include_grain'] });
      if ((s.format !== undefined && s.format !== 'csv') ||
          (s.order !== undefined && s.order !== 'asc' && s.order !== 'desc') ||
          (s.include_grain !== undefined && s.include_grain !== '1')) throw new Error('Invalid CSV options');
    } catch (error) {
      return reply.code(400).send({ error: (error as Error).message });
    }
    reply.header('Content-Type', 'text/csv; charset=utf-8');
    reply.header('Content-Disposition', `attachment; filename="${usageExportFilename(scope.from, scope.to)}"`);
    return reply.send(usageCsvStream(q.usageExportRows(db, {
      ...scope, order: s.order === 'desc' ? 'desc' : 'asc',
    }), s.include_grain === '1'));
  });

  app.get('/api/usage-events', async (req, reply) => {
    const now = Date.now();
    const s = req.query as Record<string, unknown>;
    let scope: UsageScope;
    let pagination: { limit: number; offset: number };
    try {
      scope = parseUsageScope(s, now, { extraKeys: ['limit', 'offset'] });
      pagination = parseUsagePagination(s);
    } catch (error) {
      return reply.code(400).send({ error: (error as Error).message });
    }
    return { ...q.usageEvents(db, scope, pagination), scope, now };
  });

  app.get('/api/history-summary', async (req, reply) => {
    const now = Date.now();
    try {
      const scope = parseUsageScope(req.query as Record<string, unknown>, now, { requireRange: true });
      return { now, scope, ...historySummary(db, scope) };
    } catch (error) { return reply.code(400).send({ error: (error as Error).message }); }
  });

  app.get('/api/live-sessions', async (req, reply) => {
    const now = Date.now();
    const query = req.query as Record<string, unknown>;
    try {
      const scope = parseUsageScope(query, now, { requireRange: true, extraKeys: ['mode', 'limit', 'offset'] });
      if (query.mode !== undefined && query.mode !== 'recent' && query.mode !== 'all') throw new Error('Invalid session mode');
      const mode = (query.mode ?? 'recent') as LiveSessionMode;
      const pagination = parseUsagePagination(query);
      return { now, scope, ...liveSessions(db, scope, now, mode, pagination) };
    } catch (error) { return reply.code(400).send({ error: (error as Error).message }); }
  });

  app.get('/api/runtime-map', async (req, reply) => {
    const now = Date.now();
    let scope: UsageScope;
    try { scope = parseUsageScope(req.query as Record<string, unknown>, now); }
    catch (error) { return reply.code(400).send({ error: (error as Error).message }); }
    return { ...runtimeMap(db, scope), scope, now };
  });

  app.get('/api/trend', async (req, reply) => {
    const s = req.query as Record<string, string | undefined>;
    if (s.bucket === 'minute') {
      const now = Date.now();
      let scope: UsageScope;
      let groupBy: MinuteGroup;
      try {
        const rawTo = s.to === undefined ? now : s.to;
        scope = parseUsageScope({ ...s, to: String(rawTo), from: s.from ?? String(Math.max(0, Number(rawTo) - 30 * 60000)) }, now, { extraKeys: ['bucket', 'group_by'] });
        if (scope.to - scope.from > DAY) throw new Error('Minute trend range must not exceed 24 hours');
        if (s.group_by !== undefined && !MINUTE_GROUPS.includes(s.group_by as MinuteGroup)) throw new Error('Invalid minute grouping');
        groupBy = (s.group_by ?? 'none') as MinuteGroup;
      } catch (error) {
        return reply.code(400).send({ error: (error as Error).message });
      }
      return { bucket: 'minute', from: scope.from, to: scope.to, groupBy, scope, now,
        measurement: 'recorded_tokens_per_minute', ...minuteTrend(db, scope, groupBy) };
    }
    const bucket: q.Bucket = (['hour', 'day', 'week', 'month'] as const).includes(s.bucket as q.Bucket)
      ? s.bucket as q.Bucket
      : 'hour';
    const to = s.to == null ? Date.now() : Number(s.to);
    const defaultSpan = bucket === 'hour' ? 2 * DAY : bucket === 'day' ? 30 * DAY : bucket === 'week' ? 180 * DAY : 365 * DAY;
    const from = s.from == null ? to - defaultSpan : Number(s.from);
    const groupBy = (['harness', 'model', 'vendor', 'project', 'none'] as const).includes(
      s.group_by as q.GroupBy,
    )
      ? (s.group_by as q.GroupBy)
      : 'harness';
    const sourceId = s.source_id == null ? undefined : Number(s.source_id);
    if (!Number.isSafeInteger(from) || !Number.isSafeInteger(to) || from < 0 || to <= from ||
        (sourceId != null && (!Number.isSafeInteger(sourceId) || sourceId <= 0))) {
      return reply.code(400).send({ error: 'Invalid trend range or source_id' });
    }
    return {
      bucket,
      from,
      to,
      groupBy,
      rows: q.trend(db, {
        from,
        to,
        bucket,
        groupBy,
        ...(sourceId == null ? {} : { sourceId }),
      }),
    };
  });

  app.get('/api/compare', async (req, reply) => {
    const s = req.query as Record<string, string | undefined>;
    const from = Number(s.from), to = Number(s.to), previousFrom = Number(s.previous_from), previousTo = Number(s.previous_to);
    const sourceId = s.source_id == null ? undefined : Number(s.source_id);
    const groupBy = (['harness', 'model', 'vendor', 'project', 'none'] as const).includes(s.group_by as q.GroupBy) ? s.group_by as q.GroupBy : 'harness';
    if (![from, to, previousFrom, previousTo].every(Number.isSafeInteger) || from < 0 || to <= from || previousFrom < 0 || previousTo <= previousFrom || to - from !== previousTo - previousFrom || (sourceId != null && (!Number.isSafeInteger(sourceId) || sourceId <= 0))) {
      return reply.code(400).send({ error: 'Expected equal-length current and previous ranges' });
    }
    return q.compareUsage(db, { from, to, previousFrom, previousTo, groupBy, ...(sourceId == null ? {} : { sourceId }) });
  });

  app.get('/api/models', async (req, reply) => {
    const s = req.query as Record<string, string | undefined>;
    if (s.detailed !== undefined) {
      if (s.detailed !== '1') return reply.code(400).send({ error: 'Invalid detailed mode' });
      const now = Date.now();
      try {
        const scope = parseUsageScope(req.query as Record<string, unknown>, now, { extraKeys: ['detailed'] });
        return { now, scope, ...detailedAggregates(db, scope, 'model') };
      } catch (error) { return reply.code(400).send({ error: (error as Error).message }); }
    }
    const since = s.since == null ? 0 : Number(s.since);
    const from = s.from == null ? since : Number(s.from);
    const to = s.to == null ? null : Number(s.to);
    const sourceId = s.source_id == null ? undefined : Number(s.source_id);
    if (!Number.isSafeInteger(from) || from < 0 ||
        (to != null && (!Number.isSafeInteger(to) || to <= from)) ||
        (sourceId != null && (!Number.isSafeInteger(sourceId) || sourceId <= 0))) {
      return reply.code(400).send({ error: 'Invalid model range or source_id' });
    }
    return { since: from, from, to, models: q.modelBreakdownBetween(db, from, to, sourceId) };
  });

  app.get('/api/today', async () => {
    const now = Date.now();
    const from = startOfToday(now);
    return {
      from,
      to: now,
      totals: q.totalsBetween(db, from, now),
      rows: q.modelBreakdownBetween(db, from, now),
    };
  });

  /*
   * One route, four dimensions. The client picks the cut; splitting this into
   * /projects/by-harness, /by-vendor and /by-model would ship the same rows three times
   * and let the three views disagree about a total.
   */
  app.get('/api/projects', async (req, reply) => {
    const s = req.query as Record<string, string | undefined>;
    if (s.detailed !== undefined) {
      if (s.detailed !== '1') return reply.code(400).send({ error: 'Invalid detailed mode' });
      const now = Date.now();
      try {
        const scope = parseUsageScope(req.query as Record<string, unknown>, now, { extraKeys: ['detailed'] });
        return { now, scope, ...detailedAggregates(db, scope, 'project') };
      } catch (error) { return reply.code(400).send({ error: (error as Error).message }); }
    }
    const to = s.to == null ? Date.now() : Number(s.to);
    // Default 30 days, matching the Trend tab's default range.
    const from = s.from == null ? to - 30 * 86_400_000 : Number(s.from);
    const sourceId = s.source_id == null ? undefined : Number(s.source_id);
    if (!Number.isSafeInteger(from) || !Number.isSafeInteger(to) || from < 0 || to <= from ||
        (sourceId != null && (!Number.isSafeInteger(sourceId) || sourceId <= 0))) {
      return reply.code(400).send({ error: 'Invalid project range or source_id' });
    }
    return { from, to, rows: q.projectBreakdown(db, { from, to, ...(sourceId == null ? {} : { sourceId }) }) };
  });

  app.get('/api/project-detail', async (req, reply) => {
    const now = Date.now();
    const query = req.query as Record<string, unknown>;
    try {
      const scope = parseUsageScope(query, now, { requireRange: true, extraKeys: ['limit', 'offset'] });
      if (scope.project === undefined && !scope.projectMissing) throw new Error('Expected exact project or project_missing=1');
      const pagination = parseUsagePagination(query);
      return { now, scope, ...projectDetail(db, scope, pagination) };
    } catch (error) { return reply.code(400).send({ error: (error as Error).message }); }
  });

  app.get('/api/model-detail', async (req, reply) => {
    const now = Date.now();
    const query = req.query as Record<string, unknown>;
    try {
      const scope = parseUsageScope(query, now, { requireRange: true, extraKeys: ['model_missing', 'provider_missing', 'model_empty', 'provider_empty'] });
      const modelMissing = query.model_missing === '1';
      const providerMissing = query.provider_missing === '1';
      const modelEmpty = query.model_empty === '1';
      const providerEmpty = query.provider_empty === '1';
      if ([query.model_missing, query.provider_missing, query.model_empty, query.provider_empty].some(flag => flag !== undefined && flag !== '1') ||
          Number(scope.model !== undefined) + Number(modelMissing) + Number(modelEmpty) !== 1 ||
          Number(scope.provider !== undefined) + Number(providerMissing) + Number(providerEmpty) !== 1) {
        throw new Error('Expected exact model and provider or their missing flags');
      }
      return { now, scope, modelMissing, providerMissing, modelEmpty, providerEmpty,
        ...modelDetail(db, scope, { modelMissing, providerMissing, modelEmpty, providerEmpty }) };
    } catch (error) { return reply.code(400).send({ error: (error as Error).message }); }
  });

  app.get('/api/cost-analysis', async (req, reply) => {
    const now = Date.now();
    const query = req.query as Record<string, unknown>;
    try {
      const scope = parseUsageScope(query, now, { requireRange: true, extraKeys: ['basis'] });
      if (query.basis !== 'api' && query.basis !== 'native') throw new Error('Expected api or native basis');
      return { now, scope, basis: query.basis, ...costAnalysis(db, scope, query.basis as CostBasis) };
    } catch (error) { return reply.code(400).send({ error: (error as Error).message }); }
  });

  app.get('/api/sessions', async (req, reply) => {
    const s = req.query as Record<string, string | undefined>;
    const vendors = (s.vendor ?? '')
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean);
    const from = s.from == null ? undefined : Number(s.from);
    const to = s.to == null ? undefined : Number(s.to);
    const sourceId = s.source_id == null ? undefined : Number(s.source_id);
    const rawLimit = s.limit == null ? 50 : Number(s.limit);
    const rawOffset = s.offset == null ? 0 : Number(s.offset);
    if ((from != null && (!Number.isSafeInteger(from) || from < 0)) ||
        (to != null && (!Number.isSafeInteger(to) || to < 0)) ||
        (from != null && to != null && to <= from)) {
      return reply.code(400).send({ error: 'Invalid session time range' });
    }
    if ((sourceId != null && (!Number.isSafeInteger(sourceId) || sourceId <= 0)) ||
        !Number.isSafeInteger(rawLimit) || rawLimit < 1 || rawLimit > 500 ||
        !Number.isSafeInteger(rawOffset) || rawOffset < 0) {
      return reply.code(400).send({ error: 'Invalid session pagination or source_id' });
    }
    const opts = {
      limit: rawLimit,
      offset: rawOffset,
      ...(sourceId == null ? {} : { sourceId }),
      ...(from == null ? {} : { from }),
      ...(to == null ? {} : { to }),
      ...(vendors.length ? { vendors } : {}),
    };
    return {
      sessions: q.sessionList(db, opts),
      // The page control needs the filtered total, not just this page's length.
      total: q.sessionCount(db, opts),
      vendors: q.sessionVendors(db, opts),
      limit: opts.limit,
      offset: opts.offset,
    };
  });

  app.get('/api/sessions/:id', async (req, reply) => {
    const id = Number((req.params as { id: string }).id);
    const detail = q.sessionDetail(db, id);
    if (!detail) return reply.code(404).send({ error: 'not found' });
    return detail;
  });

  // Server-sent events: the dashboard updates immediately when ingest produces rows;
  // the client also has a local fallback query for quiet or interrupted streams.
  app.get('/api/events/stream', async (req, reply) => {
    // The response owns the stream lifetime. A request close is not an SSE
    // disconnect, and an unresolved handler prevents graceful shutdown.
    reply.hijack();
    eventStreams.add(reply.raw);
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    });
    reply.raw.write(`retry: 3000\nevent: hello\ndata: ${JSON.stringify({ now: Date.now() })}\n\n`);

    const onData = (evt: { newEvents: number; newLimits: number; trigger: string }) => {
      reply.raw.write(
        `event: data\ndata: ${JSON.stringify({
          now: Date.now(),
          newEvents: evt.newEvents,
          newLimits: evt.newLimits,
          trigger: evt.trigger,
        })}\n\n`,
      );
    };
    const onSettings = (settings: q.AppSettings) => {
      reply.raw.write(`event: settings\ndata: ${JSON.stringify({ settings })}\n\n`);
    };
    scheduler.on('data', onData);
    scheduler.on('settings', onSettings);

    // Keep intermediaries and idle sockets from dropping a quiet stream.
    const ping = setInterval(() => reply.raw.write(': ping\n\n'), 25_000);
    reply.raw.once('close', () => {
      clearInterval(ping);
      scheduler.off('data', onData);
      scheduler.off('settings', onSettings);
      eventStreams.delete(reply.raw);
    });
  });

  // Static dashboard. Hand-rolled rather than @fastify/static: the whitelist below is
  // the entire surface, which avoids the path-traversal class of bug outright.
  app.get('/*', async (req, reply) => {
    const urlPath = (req.params as { '*': string })['*'] || 'index.html';
    return sendStatic(reply, webRoot, urlPath, opts.token);
  });
  app.get('/', async (_req, reply) => sendStatic(reply, webRoot, 'index.html', opts.token));

  return app;
}

function sendStatic(reply: FastifyReply, root: string, rel: string, token: string) {
  const target = resolve(root, normalize(rel).replace(/^(\.\.[/\\])+/, ''));
  // Containment check: the resolved path must stay inside the web root.
  if (target !== root && !target.startsWith(root + sep)) {
    return reply.code(403).send({ error: 'forbidden' });
  }
  if (!existsSync(target) || !statSync(target).isFile()) {
    const index = join(root, 'index.html');
    if (!existsSync(index)) {
      return reply
        .code(404)
        .type('text/plain')
        .send('dashboard not built yet -- run: npm run build -w @quotapulse/web');
    }
    return reply.type('text/html; charset=utf-8').send(injectToken(readFileSync(index, 'utf8'), token));
  }
  const ext = extname(target).toLowerCase();
  const body = readFileSync(target);
  if (ext === '.html') {
    return reply.type(MIME[ext]!).send(injectToken(body.toString('utf8'), token));
  }
  return reply.type(MIME[ext] ?? 'application/octet-stream').send(body);
}

/** The page is served the token so the browser never has to be told it out of band. */
function injectToken(html: string, token: string): string {
  return html.replace('</head>', `<script>window.__QUOTAPULSE_TOKEN__=${JSON.stringify(token)};</script></head>`);
}

function withBurn(db: DB, limits: q.LimitRow[]) {
  const now = Date.now();
  return limits.map((l) => ({
    ...l,
    // Expose the new domain vocabulary without breaking persisted/account readers.
    subscription_key: l.account_key,
    subscription_provider: l.account_provider,
    subscription_display_name: l.account_display_name,
    // How long since the SOURCE last confirmed this reading -- not how long since the
    // value changed. A steady 12% that the harness republishes every 5s is live data.
    ageSeconds: Math.round((now - Math.max(l.last_seen_at, l.source_fetched_at ?? 0)) / 1000),
    valueAgeSeconds: Math.round((now - l.observed_at) / 1000),
    burn: q.burnRate(db, l.source_id, l.window_kind, l.origin),
    forecast: q.quotaForecast(db, l.source_id, l.window_kind, l.origin, now),
  }));
}

export async function startServer(
  db: DB,
  scheduler: Scheduler,
  opts: ServerOptions,
): Promise<FastifyInstance> {
  const app = buildServer(db, scheduler, opts);
  // Loopback only. This daemon is explicitly single-machine; there is no network ingest.
  await app.listen({ port: opts.port, host: '127.0.0.1' });
  log.info(`listening on http://127.0.0.1:${opts.port}`);
  return app;
}
