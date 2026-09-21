#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Read Claude Code's OAuth credential in memory, call the provider usage endpoint,
 * and emit only quota fields. The daemon invokes this as a child process so the
 * credential never enters the daemon's object graph, database, logs, or API.
 *
 * The endpoint is used by Claude Code's own usage/statusline flow but is not a public
 * stable API. Fail closed when its shape or availability changes.
 */

export const CLAUDE_USAGE_URL = 'https://api.anthropic.com/api/oauth/usage';
const DEFAULT_CONFIG_DIR = join(homedir(), '.claude');
const TIMEOUT_MS = 20_000;

function isRecord(value) {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

function finiteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function safeReset(value) {
  if (finiteNumber(value) && value > 0) return value;
  if (typeof value !== 'string') return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
}

function safeWindow(value) {
  if (!isRecord(value)) return null;
  const percent = [value.utilization, value.used_percentage, value.used_percent, value.percent].find(
    (candidate) => finiteNumber(candidate) && candidate >= 0,
  );
  if (!finiteNumber(percent)) return null;
  const resetValue = value.resets_at ?? value.reset_at ?? value.resetsAt ?? value.resetAt;
  const resetsAt = safeReset(resetValue);
  return {
    percent,
    ...(resetsAt != null ? { resetsAt } : {}),
  };
}

function fallbackWindow(limits, predicate) {
  if (!Array.isArray(limits)) return null;
  const match = limits.find((candidate) => {
    if (!isRecord(candidate)) return false;
    return predicate(candidate.kind, candidate.group);
  });
  return safeWindow(match);
}

/** Return only the Claude OAuth access token; callers must never log or serialize it. */
export function extractClaudeAccessToken(credentials) {
  if (!isRecord(credentials) || !isRecord(credentials.claudeAiOauth)) return null;
  const token = credentials.claudeAiOauth.accessToken;
  return typeof token === 'string' && token.trim() !== '' ? token.trim() : null;
}

/** Map the provider response to the two subscription windows QuotaPulse understands. */
export function normalizeClaudeUsage(body) {
  if (!isRecord(body)) return null;
  const limits = body.limits;
  const fiveHour =
    safeWindow(body.five_hour) ??
    fallbackWindow(limits, (kind, group) => kind === 'session' || group === 'session');
  const weekly =
    safeWindow(body.seven_day) ??
    fallbackWindow(
      limits,
      (kind, group) =>
        kind === 'weekly_all' ||
        kind === 'weekly' ||
        group === 'weekly',
    );
  if (!fiveHour && !weekly) return null;
  return {
    ...(fiveHour ? { five_hour: fiveHour } : {}),
    ...(weekly ? { seven_day: weekly } : {}),
  };
}

function failure(reason) {
  const allowed = ['missing-credential', 'no-subscription', 'invalid-credential', 'invalid-response', 'unavailable'];
  return {
    ok: false,
    reason: allowed.includes(reason) ? reason : 'unavailable',
  };
}

/**
 * Fetch a sanitized Claude quota snapshot. `fetchImpl` is injectable for tests and
 * keeps the credential selection logic independent from the network.
 */
export async function fetchClaudeOAuthUsage({
  configDir = process.env.CLAUDE_CONFIG_DIR || DEFAULT_CONFIG_DIR,
  fetchImpl = globalThis.fetch,
} = {}) {
  let credentials;
  try {
    credentials = JSON.parse(await readFile(join(configDir, '.credentials.json'), 'utf8'));
  } catch {
    return failure('missing-credential');
  }

  const token = extractClaudeAccessToken(credentials);
  if (!token) return failure('missing-credential');
  if (typeof fetchImpl !== 'function') return failure('unavailable');

  let response;
  try {
    response = await fetchImpl(CLAUDE_USAGE_URL, {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
        'User-Agent': 'QuotaPulse/0.1.0',
        'anthropic-beta': 'oauth-2025-04-20',
      },
      redirect: 'error',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    return failure('unavailable');
  }

  if (response.status === 401) return failure('invalid-credential');
  if (response.status === 403) return failure('no-subscription');
  if (!response.ok) return failure('unavailable');

  let body;
  try {
    body = await response.json();
  } catch {
    return failure('invalid-response');
  }

  const usage = normalizeClaudeUsage(body);
  if (!usage) return failure('invalid-response');

  return {
    ok: true,
    fetchedAt: Date.now(),
    usage,
  };
}

function emit(value) {
  process.stdout.write(`${JSON.stringify(value)}\n`);
}

async function main() {
  emit(await fetchClaudeOAuthUsage());
}

// Keep imports side-effect free so credential selection and response mapping can be
// regression-tested without reading the real profile or making a provider request.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(() => emit(failure('unavailable')));
}
