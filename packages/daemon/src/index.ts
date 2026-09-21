import { randomBytes } from 'node:crypto';
import { mkdirSync, writeFileSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';
import { closeDb, openDb } from './db/index.js';
import { loadPrices } from './pricing/loader.js';
import { PriceResolver } from './pricing/resolve.js';
import { repriceUnknown, reclassifyCosts } from './pricing/reprice.js';
import { ALL_ADAPTERS } from './adapters/index.js';
import { Scheduler } from './ingest/scheduler.js';
import { startServer } from './api/server.js';
import { DATA_DIR, DEFAULT_PORT, LOCK_PATH } from './util/paths.js';
import { logger } from './util/log.js';

const log = logger('daemon');

interface LockFile {
  pid: number;
  port: number;
  token: string;
  startedAt: number;
}

/** Refuse to start twice: two collectors on one DB would fight over cursors. */
function checkExistingInstance(): LockFile | null {
  if (!existsSync(LOCK_PATH)) return null;
  try {
    const lock = JSON.parse(readFileSync(LOCK_PATH, 'utf8')) as LockFile;
    process.kill(lock.pid, 0); // throws if the pid is gone
    return lock;
  } catch {
    return null; // stale lock from a crash; safe to take over
  }
}

async function main() {
  const existing = checkExistingInstance();
  if (existing) {
    log.error(
      `already running as pid ${existing.pid} on http://127.0.0.1:${existing.port} ` +
        `(delete ${LOCK_PATH} if that process is gone)`,
    );
    process.exit(1);
  }

  const db = openDb();
  const priced = loadPrices(db);
  log.info(`pricing: ${priced.models} models from ${priced.providers} providers`);

  // Now that prices exist, fill in any event that could not be priced when it was
  // written -- a model the catalog has since gained, or one migration v5 recovered.
  const resolver = new PriceResolver(db);
  repriceUnknown(db, resolver);
  reclassifyCosts(db, resolver);

  const scheduler = new Scheduler(db, ALL_ADAPTERS, { debounceMs: 500, pollMs: 30_000 });
  const first = await scheduler.start();
  log.info(`initial pass: +${first.newEvents} events, +${first.newLimits} limits in ${first.durationMs}ms`);

  const port = DEFAULT_PORT;
  const token = randomBytes(24).toString('hex');
  const app = await startServer(db, scheduler, { port, token });

  mkdirSync(dirname(LOCK_PATH), { recursive: true });
  writeFileSync(
    LOCK_PATH,
    JSON.stringify({ pid: process.pid, port, token, startedAt: Date.now() } satisfies LockFile, null, 2),
  );
  log.info(`ready -> http://127.0.0.1:${port}   (state in ${DATA_DIR})`);

  let shuttingDown = false;
  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    log.info(`${signal} received, shutting down`);
    scheduler.stop();
    try {
      await app.close();
    } catch {
      /* already closing */
    }
    closeDb();
    try {
      rmSync(LOCK_PATH, { force: true });
    } catch {
      /* best effort */
    }
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGHUP', () => void shutdown('SIGHUP'));
}

main().catch((err) => {
  log.error('fatal', (err as Error).stack ?? String(err));
  process.exit(1);
});
