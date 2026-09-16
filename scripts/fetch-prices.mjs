/**
 * Fetch the models.dev price catalog into QuotaPulse's own state directory.
 *
 * The CLI remains a safe manual fallback. The running daemon now exposes the same guarded
 * refresh through the Dashboard, so users do not need to restart the app just to update prices.
 *
 * What goes out: an unauthenticated GET for a public static JSON file. No credentials, no
 * usage data, no identifiers, no query string. What comes back is a price list.
 *
 * Without this, prices are read from whatever OpenCode or Hermes happened to cache. That
 * works only if one of them is installed, and it goes stale at their pace, not yours.
 *
 * Usage:  npm run prices:refresh
 */
import { existsSync, mkdirSync, renameSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const URL_ = 'https://models.dev/api.json';

const DATA_DIR =
  process.env.QUOTAPULSE_DATA_DIR ??
  join(process.env.LOCALAPPDATA ?? join(homedir(), '.local', 'share'), 'quotapulse');
const OUT = join(DATA_DIR, 'models.dev.json');

const before = (() => {
  try {
    return statSync(OUT);
  } catch {
    return null;
  }
})();

console.log(`fetching ${URL_}`);
let res;
try {
  res = await fetch(URL_, {
    headers: { accept: 'application/json' },
    signal: AbortSignal.timeout(60_000),
  });
} catch (error) {
  console.error(`  failed: request error (${error.message})`);
  process.exit(1);
}
if (!res.ok) {
  console.error(`  failed: HTTP ${res.status} ${res.statusText}`);
  process.exit(1);
}

let body;
try {
  body = await res.text();
} catch (error) {
  console.error(`  failed: response could not be read (${error.message})`);
  process.exit(1);
}

/*
 * Parse before writing. A truncated or error-page response that lands on disk would be
 * read as the catalog on the next start and quietly price nothing.
 */
let catalog;
try {
  catalog = JSON.parse(body);
} catch (err) {
  console.error(`  failed: response was not JSON (${err.message})`);
  process.exit(1);
}

const validation = validateCatalog(catalog);
if (!validation.ok) {
  console.error(`  failed: ${validation.message}`);
  process.exit(1);
}
const { providers, models } = validation;

mkdirSync(DATA_DIR, { recursive: true });
const tempPath = `${OUT}.tmp-${process.pid}-${Date.now()}`;
try {
  writeFileSync(tempPath, body, 'utf8');
  replaceCatalog(tempPath);
} catch (error) {
  try {
    if (existsSync(tempPath)) unlinkSync(tempPath);
  } catch {
    /* best effort cleanup */
  }
  console.error(`  failed: could not replace the pricing catalog (${error.message})`);
  process.exit(1);
}

console.log(`  ${providers} providers, ${models} priced models`);
console.log(`  wrote ${OUT} (${(body.length / 1e6).toFixed(2)} MB)`);
if (before) {
  const days = (Date.now() - before.mtimeMs) / 86_400_000;
  console.log(`  replaced a copy ${days.toFixed(1)} days old`);
}
console.log('\nThe daemon will use this catalog on its next refresh/start.');
console.log('You can also update model prices from Dashboard > Settings without restarting.');

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Validate the parts the daemon loader can safely interpret before touching the live catalog. */
function validateCatalog(raw) {
  if (!isRecord(raw)) {
    return { ok: false, message: 'parsed response root must be an object' };
  }
  let providers = 0;
  let models = 0;
  for (const [providerId, provider] of Object.entries(raw)) {
    if (!isRecord(provider) || !isRecord(provider.models)) {
      return { ok: false, message: `provider ${providerId} has no valid models object` };
    }
    providers += 1;
    for (const [modelId, model] of Object.entries(provider.models)) {
      if (!isRecord(model) || model.cost == null) continue;
      if (!isRecord(model.cost)) {
        return { ok: false, message: `cost for ${providerId}/${modelId} must be an object` };
      }
      for (const key of ['input', 'output', 'cache_read', 'cache_write']) {
        const value = model.cost[key];
        if (value !== undefined && value !== null && (typeof value !== 'number' || !Number.isFinite(value) || value < 0)) {
          return { ok: false, message: `rate ${providerId}/${modelId}/${key} must be a finite non-negative number` };
        }
      }
      if (['input', 'output', 'cache_read', 'cache_write'].some((key) => typeof model.cost[key] === 'number')) models += 1;
    }
  }
  if (!providers || !models) {
    return { ok: false, message: 'parsed response contained no providers or usable model prices' };
  }
  return { ok: true, providers, models };
}

/** Replace the catalog while retaining a rollback copy if the final rename fails. */
function replaceCatalog(tempPath) {
  const backupPath = `${OUT}.bak`;
  let movedLive = false;
  try {
    if (existsSync(OUT)) {
      if (existsSync(backupPath)) unlinkSync(backupPath);
      renameSync(OUT, backupPath);
      movedLive = true;
    }
    renameSync(tempPath, OUT);
  } catch (error) {
    try {
      if (existsSync(OUT) && movedLive) unlinkSync(OUT);
      if (movedLive && existsSync(backupPath) && !existsSync(OUT)) renameSync(backupPath, OUT);
    } catch {
      /* Preserve the original write error; the backup remains available for manual recovery. */
    }
    throw error;
  }
}
