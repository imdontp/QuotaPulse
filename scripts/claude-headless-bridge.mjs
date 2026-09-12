#!/usr/bin/env node

import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { homedir } from 'node:os';
import { join } from 'node:path';

/*
 * Run the user's existing Claude headless command and copy only structured rate-limit
 * fields into QuotaPulse's local event bridge. The child output is forwarded unchanged;
 * no prompt, response, token payload or credential is written to the event file.
 *
 * Example (PowerShell):
 *   $env:QUOTAPULSE_EVENT_PROFILE = 'company'
 *   $env:QUOTAPULSE_ACCOUNT_KEY = 'anthropic:claude:company'
 *   node scripts/claude-headless-bridge.mjs -p --output-format stream-json "..."
 */

const env = process.env;
const command = env.QUOTAPULSE_CLAUDE_BIN || 'claude';
const args = process.argv.slice(2);
const dataDir = env.QUOTAPULSE_DATA_DIR || join(env.LOCALAPPDATA || join(homedir(), '.local', 'share'), 'quotapulse');
const eventPath = join(dataDir, 'events', 'quota.jsonl');
const source = env.QUOTAPULSE_EVENT_SOURCE || 'claude-code';
const configDir = env.CLAUDE_CONFIG_DIR || null;
const startedAt = Date.now();
const isHeadless = args.some((arg) => arg === '-p' || arg === '--print');
const profile =
  env.QUOTAPULSE_EVENT_PROFILE ||
  (env.CLAUDE_CONFIG_DIR && /claude-company[\\/]?$/.test(env.CLAUDE_CONFIG_DIR) ? 'company' : 'default');

function asNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function firstNumber(...values) {
  for (const value of values) {
    const number = asNumber(value);
    if (number != null) return number;
  }
  return null;
}

function firstValue(object, names) {
  if (!object || typeof object !== 'object') return null;
  for (const name of names) {
    if (Object.prototype.hasOwnProperty.call(object, name)) return object[name];
  }
  return null;
}

function asMillis(value) {
  const number = asNumber(value);
  if (number != null) return number < 1_000_000_000_000 ? Math.round(number * 1000) : Math.round(number);
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function rateWindows(value) {
  if (!value || typeof value !== 'object') return [];
  const entries = [
    ['primary', '5h'],
    ['secondary', 'weekly'],
    ['five_hour', '5h'],
    ['fiveHour', '5h'],
    ['seven_day', 'weekly'],
    ['sevenDay', 'weekly'],
  ];
  const windows = [];
  const seen = new Set();
  for (const [key, kind] of entries) {
    const raw = value[key];
    if (!raw || typeof raw !== 'object' || seen.has(kind)) continue;
    const usedPercent = firstNumber(raw.used_percent, raw.used_percentage, raw.usedPercent, raw.utilization);
    const resetsAt = asMillis(firstValue(raw, ['resets_at', 'resetsAt', 'reset_at', 'resetAt']));
    if (usedPercent == null && resetsAt == null) continue;
    seen.add(kind);
    windows.push({
      window_kind: kind,
      used_percent: usedPercent,
      resets_at: resetsAt,
      severity: typeof raw.severity === 'string' ? raw.severity : null,
    });
  }
  return windows;
}

function extractEvent(record) {
  if (!record || typeof record !== 'object') return null;
  const candidates = [
    record,
    record.rate_limits,
    record.rateLimits,
    record.rate_limit_info,
    record.rateLimitInfo,
    record.result?.rate_limits,
    record.result?.rateLimits,
    record.result?.rate_limit_info,
    record.data?.rate_limits,
    record.data?.rateLimits,
    record.usage,
    record.usage?.rate_limits,
    record.payload?.rate_limits,
    record.payload?.rateLimits,
    record.payload?.rate_limit_info,
    record.payload?.result?.rate_limits,
    record.payload?.result?.rateLimits,
    record.message?.rate_limits,
  ];
  for (const candidate of candidates) {
    const windows = rateWindows(candidate);
    if (windows.length > 0) {
      return {
        windows,
        observedAt: asMillis(firstValue(record, ['timestamp', 'observed_at', 'observedAt', 'updated_at'])) ?? Date.now(),
      };
    }
  }
  return null;
}

function sessionIdOf(record) {
  return firstValue(record, ['session_id', 'sessionId']) || record.payload?.session_id || record.payload?.sessionId || null;
}

function snapshotEvent() {
  if (!configDir) return null;
  const candidates = [];
  if (sessionId) candidates.push(join(configDir, 'statusline', String(sessionId), 'snapshot.json'));
  candidates.push(join(configDir, 'usage-snapshot.json'));
  for (const path of candidates) {
    if (!existsSync(path)) continue;
    try {
      const snapshot = JSON.parse(readFileSync(path, 'utf8'));
      const event = extractEvent(snapshot);
      // Do not turn --version/--help or an unrelated invocation into a new quota
      // observation by copying a snapshot from yesterday. A headless call may use
      // the snapshot written during that call, or one written just before startup.
      if (event && event.observedAt >= startedAt - 120_000) return event;
    } catch {
      // A statusline snapshot can be mid-write; the next invocation can retry it.
    }
  }
  return null;
}

function appendQuotaEvent(event) {
  mkdirSync(join(dataDir, 'events'), { recursive: true });
  const accountKey = env.QUOTAPULSE_ACCOUNT_KEY || null;
  const account = accountKey
    ? {
        key: accountKey,
        provider: env.QUOTAPULSE_ACCOUNT_PROVIDER || 'anthropic',
        display_name: env.QUOTAPULSE_ACCOUNT_NAME || accountKey,
      }
    : undefined;
  appendFileSync(
    eventPath,
    `${JSON.stringify({
      schema: 1,
      source,
      profile,
      ...(account ? { account } : {}),
      execution_mode: 'headless',
      observed_at: event.observedAt,
      source_fetched_at: event.observedAt,
      origin: 'claude-headless-event',
      windows: event.windows,
    })}\n`,
    'utf8',
  );
}

let sessionId = null;
let lastEventFingerprint = null;

function recordEvent(event) {
  if (!event) return;
  const fingerprint = JSON.stringify(event);
  if (fingerprint === lastEventFingerprint) return;
  lastEventFingerprint = fingerprint;
  appendQuotaEvent(event);
}

function inspectRecord(record) {
  sessionId ||= sessionIdOf(record);
  recordEvent(extractEvent(record));
}

const child = spawn(command, args, {
  stdio: ['inherit', 'pipe', 'pipe'],
  windowsHide: true,
  // Claude is commonly installed as a .cmd shim on Windows. The caller controls the
  // command and arguments, and this wrapper is intended for local command configuration.
  shell: process.platform === 'win32',
});

function forward(stream, target, inspect) {
  const lines = createInterface({ input: stream });
  lines.on('line', (line) => {
    target.write(`${line}\n`);
    try {
      inspect(JSON.parse(line));
    } catch {
      // Human-readable output and partial JSON are forwarded but never become quota data.
    }
  });
}

forward(child.stdout, process.stdout, inspectRecord);
forward(child.stderr, process.stderr, inspectRecord);

child.on('error', (error) => {
  process.stderr.write(`claude-headless-bridge: ${error.message}\n`);
  process.exitCode = 1;
});
child.on('close', (code, signal) => {
  if (isHeadless) recordEvent(snapshotEvent());
  if (signal) process.kill(process.pid, signal);
  else process.exitCode = code ?? 1;
});
