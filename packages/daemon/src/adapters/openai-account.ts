import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Adapter, IngestCtx, LimitSample, Profile, WatchTarget } from './types.js';
import { hermesAdapter, hermesHomeForProfile } from './hermes.js';
import { resolvePythonTarget } from '../util/venv.js';
import { home } from '../util/paths.js';
import { logger } from '../util/log.js';

const log = logger('openai-account');
const PROBE_INTERVAL_MS = 60_000;
const PROBE_TIMEOUT_MS = 20_000;
const PROBE_ORIGIN = 'openai-codex-usage';
const SCRIPT_PATH = fileURLToPath(new URL('../../../../scripts/hermes-account-usage.py', import.meta.url));
const HERMES_ROOT = home('AppData', 'Local', 'hermes');

interface RawWindow {
  windowKind?: unknown;
  usedPercent?: unknown;
  resetAt?: unknown;
}

interface RawSnapshot {
  available?: unknown;
  fetchedAt?: unknown;
  windows?: unknown;
}

export interface AccountQuotaReading {
  windowKind: '5h' | 'weekly';
  usedPercent: number;
  resetsAt: number | null;
}

export interface AccountQuotaSnapshot {
  fetchedAt: number;
  readings: AccountQuotaReading[];
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

/** Parse the helper's stdout without accepting provider errors or arbitrary fields. */
export function parseAccountQuotaOutput(stdout: string, now = Date.now()): AccountQuotaSnapshot | null {
  const lines = stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  let raw: RawSnapshot | null = null;
  for (const line of lines.toReversed()) {
    try {
      const candidate = JSON.parse(line) as RawSnapshot;
      if (candidate && typeof candidate === 'object') {
        raw = candidate;
        break;
      }
    } catch {
      /* Ignore helper noise; only a JSON object is trusted. */
    }
  }
  if (!raw || raw.available !== true || !Array.isArray(raw.windows)) return null;

  const readings: AccountQuotaReading[] = [];
  for (const candidate of raw.windows) {
    if (!candidate || typeof candidate !== 'object') continue;
    const w = candidate as RawWindow;
    if (!finiteNumber(w.usedPercent)) continue;
    const kind = w.windowKind === '5h' || w.windowKind === 'weekly' ? w.windowKind : null;
    if (!kind) continue;
    readings.push({
      windowKind: kind,
      usedPercent: Math.min(100, Math.max(0, w.usedPercent)),
      resetsAt: timestamp(w.resetAt),
    });
  }
  if (readings.length === 0) return null;

  return {
    fetchedAt: timestamp(raw.fetchedAt) ?? now,
    readings,
  };
}

function hermesSource(): string {
  return process.env.QUOTAPULSE_HERMES_SOURCE?.trim() || join(HERMES_ROOT, 'hermes-agent');
}

/**
 * Which Python to run the helper with, and what has to go on `PYTHONPATH` for it to see the
 * packages the environment provides.
 *
 * The Windows branch is the interesting one and the reason `util/venv.ts` exists. Hermes
 * ships a virtual environment, and a Windows virtual environment's `Scripts/python.exe` is a
 * launcher that starts a *second* process -- the real interpreter -- without carrying
 * `CREATE_NO_WINDOW` across. That second process allocates a console, and because the daemon
 * probes on a timer, several helpers at once, every pass flashed a black window that vanished
 * immediately. `windowsHide: true` below is correct and was not enough: it only ever applied
 * to the launcher.
 *
 * Resolving the launcher away means the process that does the work is the one `windowsHide`
 * was passed to. The environment's packages are still found, because its `site-packages` is
 * put on `PYTHONPATH`.
 */
function configuredPython(): { command: string; sitePackages: string | null; cwd?: string } {  const source = hermesSource();
  const cwd = existsSync(source) ? source : undefined;
  const configured = process.env.QUOTAPULSE_HERMES_PYTHON?.trim();
  if (configured) return { command: configured, sitePackages: null, cwd };

  const venvDir = join(source, 'venv');
  const target = resolvePythonTarget(venvDir);
  if (target) return { command: target.command, sitePackages: target.sitePackages, cwd };

  return { command: process.platform === 'win32' ? 'python' : 'python3', sitePackages: null, cwd };
}

function runHelper(hermesHome: string): Promise<string | null> {
  const python = configuredPython();
  const source = hermesSource();
  const separator = process.platform === 'win32' ? ';' : ':';
  const pythonPath = [python.sitePackages, existsSync(source) ? source : null, process.env.PYTHONPATH]
    .filter((value): value is string => Boolean(value))
    .join(separator);
  return new Promise((resolve) => {
    execFile(
      python.command,
      [SCRIPT_PATH],
      {
        cwd: python.cwd,
        env: {
          ...process.env,
          HERMES_HOME: hermesHome,
          ...(pythonPath ? { PYTHONPATH: pythonPath } : {}),
        },
        timeout: PROBE_TIMEOUT_MS,
        maxBuffer: 64 * 1024,
        windowsHide: true,
      },
      (error, stdout) => {
        if (error) {
          log.debug(`quota probe unavailable for ${hermesHome}`, `helper exit: ${error.code ?? 'error'}`);
          resolve(null);
          return;
        }
        resolve(stdout);
      },
    );
  });
}

const lastProbeAt = new Map<string, number>();

function quotaEnabled(): boolean {
  return !['0', 'false', 'off', 'no'].includes(
    (process.env.QUOTAPULSE_HERMES_ACCOUNT_QUOTA ?? 'on').trim().toLowerCase(),
  );
}

export const openaiAccountAdapter: Adapter = {
  id: 'openai-account',
  displayName: 'OpenAI Subscription',

  async detect(): Promise<Profile[]> {
    if (!quotaEnabled()) return [];
    const profiles = await hermesAdapter.detect();
    return profiles.map((p) => ({
      profile: p.profile,
      rootPath: hermesHomeForProfile(p),
      displayName: 'OpenAI Subscription',
      sourceKind: 'account',
      account: {
        key: 'openai:subscription',
        provider: 'openai',
        displayName: 'OpenAI Subscription',
      },
    }));
  },

  watchTargets(_p: Profile): WatchTarget[] {
    return [];
  },

  async ingest(ctx: IngestCtx): Promise<void> {
    const key = ctx.profile.rootPath;
    const now = Date.now();
    const previous = lastProbeAt.get(key) ?? 0;
    if (now - previous < PROBE_INTERVAL_MS) return;
    lastProbeAt.set(key, now);

    const output = await runHelper(ctx.profile.rootPath);
    const snapshot = output ? parseAccountQuotaOutput(output, now) : null;
    if (!snapshot) {
      ctx.sink.accountState({
        state: 'unavailable',
        reason: 'quota-reader-unavailable',
        observedAt: now,
      });
      return;
    }

    for (const reading of snapshot.readings) {
      const sample: LimitSample = {
        windowKind: reading.windowKind,
        usedPercent: reading.usedPercent,
        resetsAt: reading.resetsAt,
        observedAt: now,
        sourceFetchedAt: snapshot.fetchedAt,
        origin: PROBE_ORIGIN,
      };
      ctx.sink.limit(sample);
    }
  },
};

export function resetAccountQuotaProbeForTests(): void {
  lastProbeAt.clear();
}
