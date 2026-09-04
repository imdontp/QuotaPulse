import { readFileSync, existsSync, statSync } from 'node:fs';
import { globSync } from 'node:fs';
import type { DB } from '../db/index.js';
import { join } from 'node:path';
import { home, DATA_DIR } from '../util/paths.js';
import { logger } from '../util/log.js';

const log = logger('pricing');

/**
 * models.dev catalog, already cached on disk by OpenCode and Hermes -- we never fetch it.
 * MUST be read as explicit UTF-8: the default Windows codepage (cp874 here) corrupts it.
 */
const CANDIDATES = [
  /*
   * Ours first, written by `npm run prices:refresh`. It is the only copy whose freshness
   * is under this project's control -- the others are refreshed when their owner happens
   * to run, and are absent entirely if neither is installed.
   */
  join(DATA_DIR, 'models.dev.json'),
  home('.cache', 'opencode', 'models.json'),
  home('AppData', 'Local', 'hermes', 'profiles', 'claudepersonal', 'models_dev_cache.json'),
  home('AppData', 'Local', 'hermes', 'profiles', 'claudecompany', 'models_dev_cache.json'),
];

interface CatalogModel {
  id?: string;
  cost?: { input?: number; output?: number; cache_read?: number; cache_write?: number };
  limit?: { context?: number; output?: number };
}
interface CatalogProvider {
  id?: string;
  models?: Record<string, CatalogModel>;
}

export function findCatalog(): string | null {
  for (const p of CANDIDATES) if (existsSync(p)) return p;
  const extra = globSync(home('AppData', 'Local', 'hermes', 'profiles', '*', 'models_dev_cache.json'));
  return extra[0] ?? null;
}

/** Load the catalog into the `price` table. Returns the number of priced models. */
export function loadPrices(db: DB): { path: string | null; providers: number; models: number } {
  const path = findCatalog();
  if (!path) {
    log.warn('no models.dev catalog found on disk; all costs will be reported as unknown');
    return { path: null, providers: 0, models: 0 };
  }

  let catalog: Record<string, CatalogProvider>;
  try {
    catalog = JSON.parse(readFileSync(path, 'utf8')) as Record<string, CatalogProvider>;
  } catch (err) {
    log.error(`failed to parse ${path}`, (err as Error).message);
    return { path, providers: 0, models: 0 };
  }

  try {
    const ageDays = (Date.now() - statSync(path).mtimeMs) / 86_400_000;
    const own = path.startsWith(DATA_DIR);
    log.info(
      `catalog ${path} (${ageDays.toFixed(1)}d old${own ? '' : ", not ours -- 'npm run prices:refresh' takes it over"})`,
    );
  } catch {
    /* age is a nicety; a catalog that parsed is still usable without it */
  }

  const now = Date.now();
  const stmt = db.prepare(
    `INSERT INTO price (model, provider, input_per_1m, cached_input_per_1m, cache_write_per_1m,
                        output_per_1m, context_window, origin, updated_at)
     VALUES (@model, @provider, @input, @cachedInput, @cacheWrite, @output, @context, @origin, @updatedAt)
     ON CONFLICT (provider, model) DO UPDATE SET
       input_per_1m        = excluded.input_per_1m,
       cached_input_per_1m = excluded.cached_input_per_1m,
       cache_write_per_1m  = excluded.cache_write_per_1m,
       output_per_1m       = excluded.output_per_1m,
       context_window      = excluded.context_window,
       updated_at          = excluded.updated_at`,
  );

  let providers = 0;
  let models = 0;
  const run = db.transaction(() => {
    for (const [providerId, provider] of Object.entries(catalog)) {
      if (!provider?.models) continue;
      providers++;
      for (const [modelId, m] of Object.entries(provider.models)) {
        const c = m.cost;
        if (!c) continue;
        stmt.run({
          model: modelId,
          provider: providerId,
          input: c.input ?? null,
          cachedInput: c.cache_read ?? null,
          cacheWrite: c.cache_write ?? null,
          output: c.output ?? null,
          context: m.limit?.context ?? null,
          origin: 'models.dev',
          updatedAt: now,
        });
        models++;
      }
    }
  });
  run();

  log.info(`loaded ${models} priced models from ${providers} providers (${path})`);
  return { path, providers, models };
}
