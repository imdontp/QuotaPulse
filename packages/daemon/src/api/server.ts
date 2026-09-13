import Fastify, { type FastifyInstance, type FastifyReply } from 'fastify';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { DB } from '../db/index.js';
import type { Scheduler } from '../ingest/scheduler.js';
import * as q from '../api/queries.js';
import { logger } from '../util/log.js';

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

  app.get('/api/overview', async () => {
    const now = Date.now();
    const limits = q.latestLimits(db);
    return {
      now,
      today: q.totalsSince(db, startOfToday(now)),
      // Deliberately still a rolling seven days -- the label says "last 7 days" to match.
      week: q.totalsSince(db, now - 7 * DAY),
      allTime: q.totalsSince(db, 0),
      bySourceToday: q.totalsBySource(db, startOfToday(now)),
      bySourceAll: q.totalsBySource(db, 0),
      limits: withBurn(db, limits),
      subscriptions: q.subscriptionStatus(db),
      harnesses: q.harnessStatus(db),
      // Legacy aliases kept while clients migrate from Account quota to Subscription.
      accounts: q.accountStatus(db),
      sources: q.listSources(db),
      // Raw source rows remain useful to diagnostics and older clients; the dashboard
      // renders the hierarchical harnesses field above.
      sourceStatus: q.sourceStatus(db),
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

  app.get('/api/trend', async (req, reply) => {
    const s = req.query as Record<string, string | undefined>;
    const bucket: q.Bucket = s.bucket === 'day' ? 'day' : 'hour';
    const to = s.to == null ? Date.now() : Number(s.to);
    const defaultSpan = bucket === 'hour' ? 2 * DAY : 30 * DAY;
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

  app.get('/api/models', async (req) => {
    const s = req.query as Record<string, string | undefined>;
    const since = s.since ? Number(s.since) : 0;
    return { since, models: q.modelBreakdown(db, since) };
  });

  /*
   * One route, four dimensions. The client picks the cut; splitting this into
   * /projects/by-harness, /by-vendor and /by-model would ship the same rows three times
   * and let the three views disagree about a total.
   */
  app.get('/api/projects', async (req, reply) => {
    const s = req.query as Record<string, string | undefined>;
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
    scheduler.on('data', onData);

    // Keep intermediaries and idle sockets from dropping a quiet stream.
    const ping = setInterval(() => reply.raw.write(': ping\n\n'), 25_000);
    req.raw.on('close', () => {
      clearInterval(ping);
      scheduler.off('data', onData);
    });
    await new Promise(() => {}); // held open until the client disconnects
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
