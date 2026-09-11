import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import type { Adapter, IngestCtx, LimitSample, Profile, WatchTarget } from './types.js';
import { home } from '../util/paths.js';
import { logger } from '../util/log.js';

const log = logger('opencode-account');
const ROOT = home('.local', 'share', 'opencode');
const AUTH_FILE = join(ROOT, 'auth.json');
const SCRIPT_PATH = fileURLToPath(new URL('../../../../scripts/opencode-go-usage.mjs', import.meta.url));
const PROBE_TARGET = 'opencode-go-usage';
const PROBE_ORIGIN = 'opencode-go-usage';
const PROBE_INTERVAL_MS = 60_000;
const PROBE_TIMEOUT_MS = 20_000;

function quotaEnabled(): boolean {
  return !['0', 'false', 'off', 'no'].includes(
    (process.env.QUOTAPULSE_OPENCODE_GO_QUOTA ?? 'on').trim().toLowerCase(),
  );
}

type OpenCodeGoWindowKind = '5h' | 'weekly' | 'monthly';
type ProbeFailureReason =
  | 'missing-credential'
  | 'no-subscription'
  | 'invalid-credential'
  | 'invalid-response'
  | 'unavailable';

interface RawWindow {
  percent?: unknown;
  resetsAt?: unknown;
}

interface RawProbe {
  ok?: unknown;
  reason?: unknown;
  fetchedAt?: unknown;
  usage?: unknown;
}

export interface OpenCodeGoQuotaReading {
  windowKind: OpenCodeGoWindowKind;
  usedPercent: number;
  resetsAt: number | null;
}

export interface OpenCodeGoQuotaSnapshot {
  fetchedAt: number;
  readings: OpenCodeGoQuotaReading[];
}

export type OpenCodeGoProbeResult =
  | { available: true; snapshot: OpenCodeGoQuotaSnapshot }
  | { available: false; reason: ProbeFailureReason };

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

function finiteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function timestamp(value: unknown): number | null {
  if (finiteNumber(value)) return value > 10_000_000_000 ? value : value * 1000;
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function failure(reason: unknown): OpenCodeGoProbeResult {
  const allowed: ProbeFailureReason[] = [
    'missing-credential',
    'no-subscription',
    'invalid-credential',
    'invalid-response',
    'unavailable',
  ];
  return {
    available: false,
    reason: typeof reason === 'string' && allowed.includes(reason as ProbeFailureReason)
      ? (reason as ProbeFailureReason)
      : 'unavailable',
  };
}

function parseWindow(
  value: unknown,
  windowKind: OpenCodeGoWindowKind,
): OpenCodeGoQuotaReading | null {
  if (!isRecord(value)) return null;
  const raw = value as RawWindow;
  if (!finiteNumber(raw.percent) || raw.percent < 0) return null;

  let resetsAt: number | null = null;
  if (raw.resetsAt != null) {
    resetsAt = timestamp(raw.resetsAt);
    if (resetsAt == null) return null;
  }

  // Keep an over-100 value if the provider reports one. The UI caps the bar visually,
  // but the number itself remains authoritative and exposes an already-rate-limited window.
  return { windowKind, usedPercent: raw.percent, resetsAt };
}

/** Parse only the helper's sanitized JSON; credentials and provider error bodies are never accepted. */
export function parseOpenCodeGoUsageOutput(stdout: string, now = Date.now()): OpenCodeGoProbeResult {
  let raw: RawProbe | null = null;
  for (const line of stdout.split(/\r?\n/).map((value) => value.trim()).filter(Boolean).reverse()) {
    try {
      const candidate = JSON.parse(line) as unknown;
      if (isRecord(candidate)) {
        raw = candidate as RawProbe;
        break;
      }
    } catch {
      /* Ignore helper noise; only a JSON object is trusted. */
    }
  }

  if (!raw) return failure('unavailable');
  if (raw.ok !== true) return failure(raw.reason);
  if (!isRecord(raw.usage)) return failure('invalid-response');

  const usage = raw.usage;
  const readings = [
    parseWindow(usage.rolling, '5h'),
    parseWindow(usage.weekly, 'weekly'),
    parseWindow(usage.monthly, 'monthly'),
  ];
  if (readings.some((reading) => reading == null)) return failure('invalid-response');

  return {
    available: true,
    snapshot: {
      fetchedAt: timestamp(raw.fetchedAt) ?? now,
      readings: readings as OpenCodeGoQuotaReading[],
    },
  };
}

function runHelper(): Promise<string | null> {
  return new Promise((resolve) => {
    execFile(
      process.execPath,
      [SCRIPT_PATH],
      {
        timeout: PROBE_TIMEOUT_MS,
        maxBuffer: 64 * 1024,
        windowsHide: true,
      },
      (error, stdout) => {
        if (error) {
          log.debug('OpenCode Go quota probe unavailable', `helper exit: ${error.code ?? 'error'}`);
          resolve(null);
          return;
        }
        resolve(stdout);
      },
    );
  });
}

const lastProbeAt = new Map<string, number>();

export const opencodeAccountAdapter: Adapter = {
  id: 'opencode-account',
  displayName: 'OpenCode Go Subscription',

  async detect(): Promise<Profile[]> {
    if (!quotaEnabled()) return [];
    // The helper, not the daemon, opens auth.json and decides whether the configured
    // OpenCode credential is a Go entitlement.
    if (!existsSync(AUTH_FILE)) return [];
    return [
      {
        profile: 'default',
        rootPath: ROOT,
        displayName: 'OpenCode Go Subscription',
        sourceKind: 'account',
        account: {
          key: 'opencode:go',
          provider: 'opencode',
          displayName: 'OpenCode Go Subscription',
        },
      },
    ];
  },

  watchTargets(): WatchTarget[] {
    // Server-side quota changes are independent of local file changes; the adapter's
    // bounded poll is the source of truth.
    return [];
  },

  async ingest(ctx: IngestCtx): Promise<void> {
    const key = ctx.profile.rootPath;
    const now = Date.now();
    const previous = lastProbeAt.get(key) ?? 0;
    if (now - previous < PROBE_INTERVAL_MS) return;
    lastProbeAt.set(key, now);

    const output = await runHelper();
    const result = parseOpenCodeGoUsageOutput(output ?? '', now);
    if (!result.available) {
      if (result.reason === 'missing-credential' || result.reason === 'no-subscription') {
        ctx.cursors.clearError(PROBE_TARGET);
        ctx.sink.accountState({ state: 'inactive', reason: 'no-subscription', observedAt: now });
        return;
      }

      if (result.reason === 'invalid-credential') {
        ctx.cursors.recordError(PROBE_TARGET, 'invalid-credential');
        ctx.sink.accountState({ state: 'unavailable', reason: 'invalid-credential', observedAt: now });
        return;
      }

      // Keep the last successful reading in place. The normal freshness query will turn
      // it stale after 24 hours, while a first-ever transient failure remains waiting.
      ctx.cursors.recordError(PROBE_TARGET, result.reason);
      return;
    }

    ctx.cursors.clearError(PROBE_TARGET);
    for (const reading of result.snapshot.readings) {
      const sample: LimitSample = {
        windowKind: reading.windowKind,
        usedPercent: reading.usedPercent,
        resetsAt: reading.resetsAt,
        observedAt: now,
        sourceFetchedAt: result.snapshot.fetchedAt,
        origin: PROBE_ORIGIN,
      };
      ctx.sink.limit(sample);
    }
  },
};

export function resetOpenCodeAccountProbeForTests(): void {
  lastProbeAt.clear();
}
