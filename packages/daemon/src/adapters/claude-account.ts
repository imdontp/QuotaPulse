import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Adapter, IngestCtx, LimitSample, Profile, WatchTarget } from './types.js';
import { home } from '../util/paths.js';
import { logger } from '../util/log.js';

const log = logger('claude-account');
const PROBE_INTERVAL_MS = 60_000;
const PROBE_TIMEOUT_MS = 25_000;
const PROBE_TARGET = 'claude-oauth-usage';
const PROBE_ORIGIN = 'claude-oauth-usage';
const SCRIPT_PATH = fileURLToPath(new URL('../../../../scripts/claude-oauth-usage.mjs', import.meta.url));

const KNOWN_ROOTS: Array<{ profile: string; path: string; label: string }> = [
  { profile: 'default', path: home('.claude'), label: 'Claude Personal Subscription' },
  { profile: 'company', path: home('.claude-company'), label: 'Claude Company Subscription' },
];

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

export interface ClaudeQuotaReading {
  windowKind: '5h' | 'weekly';
  usedPercent: number;
  resetsAt: number | null;
}

export interface ClaudeQuotaSnapshot {
  fetchedAt: number;
  readings: ClaudeQuotaReading[];
}

export type ClaudeProbeResult =
  | { available: true; snapshot: ClaudeQuotaSnapshot }
  | { available: false; reason: ProbeFailureReason };

function quotaEnabled(): boolean {
  return !['0', 'false', 'off', 'no'].includes(
    (process.env.QUOTAPULSE_CLAUDE_QUOTA ?? 'on').trim().toLowerCase(),
  );
}

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

function failure(reason: unknown): ClaudeProbeResult {
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

function parseWindow(value: unknown, windowKind: ClaudeQuotaReading['windowKind']): ClaudeQuotaReading | null {
  if (!isRecord(value) || !finiteNumber(value.percent) || value.percent < 0) return null;
  return {
    windowKind,
    usedPercent: value.percent,
    resetsAt: timestamp(value.resetsAt),
  };
}

/** Parse only the helper's sanitized JSON; credentials and provider error bodies are ignored. */
export function parseClaudeOAuthUsageOutput(stdout: string, now = Date.now()): ClaudeProbeResult {
  let raw: RawProbe | null = null;
  for (const line of stdout.split(/\r?\n/).map((value) => value.trim()).filter(Boolean).toReversed()) {
    try {
      const candidate = JSON.parse(line) as unknown;
      if (isRecord(candidate)) {
        raw = candidate as RawProbe;
        break;
      }
    } catch {
      /* Ignore helper noise; only one sanitized JSON object is trusted. */
    }
  }

  if (!raw) return failure('unavailable');
  if (raw.ok !== true) return failure(raw.reason);
  if (!isRecord(raw.usage)) return failure('invalid-response');

  const readings = [
    parseWindow(raw.usage.five_hour, '5h'),
    parseWindow(raw.usage.seven_day, 'weekly'),
  ].filter((reading): reading is ClaudeQuotaReading => reading != null);
  if (readings.length === 0) return failure('invalid-response');

  return {
    available: true,
    snapshot: {
      fetchedAt: timestamp(raw.fetchedAt) ?? now,
      readings,
    },
  };
}

function accountFor(profile: string) {
  if (profile === 'company') {
    return {
      key: 'anthropic:claude:company',
      provider: 'anthropic',
      displayName: 'Claude Company Subscription',
    };
  }
  if (profile === 'default') {
    return {
      key: 'anthropic:claude:personal',
      provider: 'anthropic',
      displayName: 'Claude Personal Subscription',
    };
  }
  const label = profile
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part[0]!.toUpperCase() + part.slice(1))
    .join(' ');
  return {
    key: `anthropic:claude:${profile}`,
    provider: 'anthropic',
    displayName: `Claude ${label || profile} Subscription`,
  };
}

function profileRoots(): Array<{ profile: string; path: string; label: string }> {
  const roots = [...KNOWN_ROOTS];
  const envRoot = process.env.CLAUDE_CONFIG_DIR;
  if (envRoot && !roots.some((root) => root.path === envRoot)) {
    roots.push({
      profile: basename(envRoot).replace(/^\./, ''),
      path: envRoot,
      label: `Claude ${basename(envRoot)} Subscription`,
    });
  }
  return roots;
}

function runHelper(configDir: string): Promise<string | null> {
  return new Promise((resolve) => {
    execFile(
      process.execPath,
      [SCRIPT_PATH],
      {
        env: { ...process.env, CLAUDE_CONFIG_DIR: configDir },
        timeout: PROBE_TIMEOUT_MS,
        maxBuffer: 64 * 1024,
        windowsHide: true,
      },
      (error, stdout) => {
        if (error) {
          log.debug(`Claude quota probe unavailable for ${configDir}`, `helper exit: ${error.code ?? 'error'}`);
          resolve(null);
          return;
        }
        resolve(stdout);
      },
    );
  });
}

const lastProbeAt = new Map<string, number>();

export const claudeAccountAdapter: Adapter = {
  id: 'claude-account',
  displayName: 'Claude OAuth quota',

  async detect(): Promise<Profile[]> {
    if (!quotaEnabled()) return [];
    return profileRoots()
      .filter((root) => existsSync(join(root.path, '.credentials.json')))
      .map((root) => ({
        profile: root.profile,
        rootPath: root.path,
        displayName: root.label,
        sourceKind: 'account' as const,
        account: accountFor(root.profile),
      }));
  },

  watchTargets(_profile: Profile): WatchTarget[] {
    // Provider-side quota changes are independent of local credential file writes.
    return [];
  },

  async ingest(ctx: IngestCtx): Promise<void> {
    const key = ctx.profile.rootPath;
    const now = Date.now();
    const previous = lastProbeAt.get(key) ?? 0;
    if (now - previous < PROBE_INTERVAL_MS) return;
    lastProbeAt.set(key, now);

    const output = await runHelper(ctx.profile.rootPath);
    const result = parseClaudeOAuthUsageOutput(output ?? '', now);
    if (!result.available) {
      if (result.reason === 'missing-credential' || result.reason === 'no-subscription') {
        ctx.cursors.clearError(PROBE_TARGET);
        ctx.sink.accountState({ state: 'inactive', reason: 'no-subscription', observedAt: now });
        return;
      }

      ctx.cursors.recordError(PROBE_TARGET, result.reason);
      ctx.sink.accountState({
        state: 'unavailable',
        reason: result.reason === 'invalid-credential' ? 'invalid-credential' : 'quota-reader-unavailable',
        observedAt: now,
      });
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

export function resetClaudeAccountProbeForTests(): void {
  lastProbeAt.clear();
}
