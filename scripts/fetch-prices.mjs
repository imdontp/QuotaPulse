/**
 * Fetch the models.dev price catalog into QuotaPulse's own state directory.
 *
 * This is the ONLY thing in the project that touches the network, and it is a separate
 * process you start by hand. The daemon never fetches: leaving it that way is what keeps
 * "no credentials, no API calls, no proxy, no network" literally true of the process that
 * runs all day, which is the part of the promise that matters.
 *
 * What goes out: an unauthenticated GET for a public static JSON file. No credentials, no
 * usage data, no identifiers, no query string. What comes back is a price list.
 *
 * Without this, prices are read from whatever OpenCode or Hermes happened to cache. That
 * works only if one of them is installed, and it goes stale at their pace, not yours.
 *
 * Usage:  npm run prices:refresh
 */
import { writeFileSync, mkdirSync, statSync } from 'node:fs';
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
const res = await fetch(URL_, {
  headers: { accept: 'application/json' },
  signal: AbortSignal.timeout(60_000),
});
if (!res.ok) {
  console.error(`  failed: HTTP ${res.status} ${res.statusText}`);
  process.exit(1);
}

const body = await res.text();

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
const providers = Object.keys(catalog);
const models = providers.reduce((n, p) => n + Object.keys(catalog[p]?.models ?? {}).length, 0);
if (providers.length === 0 || models === 0) {
  console.error('  failed: parsed, but carries no providers or models');
  process.exit(1);
}

mkdirSync(DATA_DIR, { recursive: true });
writeFileSync(OUT, body, 'utf8');

console.log(`  ${providers.length} providers, ${models} priced models`);
console.log(`  wrote ${OUT} (${(body.length / 1e6).toFixed(2)} MB)`);
if (before) {
  const days = (Date.now() - before.mtimeMs) / 86_400_000;
  console.log(`  replaced a copy ${days.toFixed(1)} days old`);
}
console.log('\nThe daemon picks this up on its next start; it is preferred over the');
console.log('OpenCode and Hermes caches. Restart it to reprice immediately:');
console.log('  Stop-ScheduledTask quotapulse-daemon; Start-ScheduledTask quotapulse-daemon');
