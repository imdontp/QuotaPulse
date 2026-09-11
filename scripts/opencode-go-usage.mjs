import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const AUTH_FILE = join(homedir(), '.local', 'share', 'opencode', 'auth.json');
const USAGE_URL = 'https://opencode.ai/zen/go/v1/usage';
const TIMEOUT_MS = 20_000;

function emit(value) {
  process.stdout.write(`${JSON.stringify(value)}\n`);
}

function isRecord(value) {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

function finiteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function safeWindow(value) {
  if (!isRecord(value)) return null;
  return {
    ...(finiteNumber(value.percent) ? { percent: value.percent } : {}),
    ...(typeof value.resetsAt === 'string' || finiteNumber(value.resetsAt)
      ? { resetsAt: value.resetsAt }
      : {}),
  };
}

/**
 * OpenCode Go is registered as `opencode-go` in auth.json. Older OpenCode builds
 * used `opencode` for the same endpoint, so keep that as a compatibility fallback.
 * Return only the key string; callers must never log or serialize the auth object.
 */
export function extractOpenCodeGoApiKey(auth) {
  if (!isRecord(auth)) return null;
  for (const provider of ['opencode-go', 'opencode']) {
    const entry = auth[provider];
    if (isRecord(entry) && typeof entry.key === 'string' && entry.key.trim() !== '') {
      return entry.key.trim();
    }
  }
  return null;
}

async function main() {
  let auth;
  try {
    auth = JSON.parse(await readFile(AUTH_FILE, 'utf8'));
  } catch {
    emit({ ok: false, reason: 'missing-credential' });
    return;
  }

  const key = extractOpenCodeGoApiKey(auth);
  if (!key) {
    emit({ ok: false, reason: 'missing-credential' });
    return;
  }

  let response;
  try {
    response = await fetch(USAGE_URL, {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${key.trim()}`,
        'User-Agent': 'QuotaPulse/0.1.0',
      },
      redirect: 'error',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    emit({ ok: false, reason: 'unavailable' });
    return;
  }

  if (response.status === 401) {
    emit({ ok: false, reason: 'invalid-credential' });
    return;
  }
  if (response.status === 403) {
    emit({ ok: false, reason: 'no-subscription' });
    return;
  }
  if (!response.ok) {
    emit({ ok: false, reason: 'unavailable' });
    return;
  }

  let body;
  try {
    body = await response.json();
  } catch {
    emit({ ok: false, reason: 'invalid-response' });
    return;
  }

  const usage = isRecord(body) && isRecord(body.usage) ? body.usage : null;
  if (!usage) {
    emit({ ok: false, reason: 'invalid-response' });
    return;
  }

  emit({
    ok: true,
    fetchedAt: Date.now(),
    usage: {
      rolling: safeWindow(usage.rolling),
      weekly: safeWindow(usage.weekly),
      monthly: safeWindow(usage.monthly),
    },
  });
}

// Keep imports side-effect free so the credential-selection logic can be regression-tested
// without reading the real auth file or making a provider request.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(() => emit({ ok: false, reason: 'unavailable' }));
}
