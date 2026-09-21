import type { Scheduler } from './ingest/scheduler.js';

export interface DaemonRuntimeSnapshot {
  schemaVersion: 1;
  capturedAt: number;
  pid: number;
  parentPid: number | null;
  uptimeSeconds: number;
  memory: {
    rssBytes: number;
    heapTotalBytes: number;
    heapUsedBytes: number;
    externalBytes: number;
    arrayBuffersBytes: number;
  };
  scheduler: {
    running: boolean;
    sourceCount: number;
    lastPassAt: number | null;
    lastPassDurationMs: number | null;
  };
}

/** A small, non-sensitive runtime snapshot for the opt-in local diagnostics collector. */
export function runtimeSnapshot(scheduler: Scheduler, now = Date.now()): DaemonRuntimeSnapshot {
  const memory = process.memoryUsage();
  const lastPass = scheduler.status.lastPass;
  return {
    schemaVersion: 1,
    capturedAt: now,
    pid: process.pid,
    parentPid: process.ppid || null,
    uptimeSeconds: Math.round(process.uptime()),
    memory: {
      rssBytes: memory.rss,
      heapTotalBytes: memory.heapTotal,
      heapUsedBytes: memory.heapUsed,
      externalBytes: memory.external,
      arrayBuffersBytes: memory.arrayBuffers,
    },
    scheduler: {
      running: scheduler.status.running,
      sourceCount: scheduler.status.sources.length,
      // PassEvent intentionally does not retain a wall-clock timestamp; diagnostics still
      // records the sample time and duration without inventing a completion time.
      lastPassAt: null,
      lastPassDurationMs: lastPass?.durationMs ?? null,
    },
  };
}
