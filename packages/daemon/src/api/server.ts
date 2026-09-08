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
      sources: q.listSources(db),
      // Every source, including ones with no quota to gauge.
      sourceStatus: q.sourceStatus(db),
      lastPass: scheduler.status.lastPass,
    };
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
  }));

  app.get('/api/trend', async (req) => {
    const s = req.query as Record<string, string | undefined>;
    const bucket: q.Bucket = s.bucket === 'day' ? 'day' : 'hour';
    const to = s.to ? Number(s.to) : Date.now();
    const defaultSpan = bucket === 'hour' ? 2 * DAY : 30 * DAY;
    const from = s.from ? Number(s.from) : to - defaultSpan;
    const groupBy = (['harness', 'model', 'vendor', 'project', 'none'] as const).includes(
      s.group_by as q.GroupBy,
    )
      ? (s.group_by as q.GroupBy)
      : 'harness';
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
        ...(s.source_id ? { sourceId: Number(s.source_id) } : {}),
      }),
    };
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
  app.get('/api/projects', async (req) => {
    const s = req.query as Record<string, string | undefined>;
    const to = s.to ? Number(s.to) : Date.now();
    // Default 30 days, matching the Trend tab's default range.
    const from = s.from ? Number(s.from) : to - 30 * 86_400_000;
    return { from, to, rows: q.projectBreakdown(db, { from, to }) };
  });

  app.get('/api/sessions', async (req) => {
    const s = req.query as Record<string, string | undefined>;
    const vendors = (s.vendor ?? '')
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean);
    const opts = {
      limit: Math.min(Math.max(Number(s.limit ?? 50), 1), 500),
      offset: Math.max(Number(s.offset ?? 0), 0),
      ...(s.source_id ? { sourceId: Number(s.source_id) } : {}),
      ...(vendors.length ? { vendors } : {}),
    };
    return {
      sessions: q.sessionList(db, opts),
      // The page control needs the filtered total, not just this page's length.
      total: q.sessionCount(db, opts),
      vendors: q.sessionVendors(db),
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
    // How long since the SOURCE last confirmed this reading -- not how long since the
    // value changed. A steady 12% that the harness republishes every 5s is live data.
    ageSeconds: Math.round((now - Math.max(l.last_seen_at, l.source_fetched_at ?? 0)) / 1000),
    valueAgeSeconds: Math.round((now - l.observed_at) / 1000),
    burn: q.burnRate(db, l.source_id, l.window_kind, l.origin),
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
