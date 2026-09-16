import { existsSync, mkdirSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DB } from '../db/index.js';
import { loadPrices } from './loader.js';
import { PriceResolver } from './resolve.js';
import { reclassifyCosts, repriceUnknown } from './reprice.js';
import { DATA_DIR } from '../util/paths.js';

const MODELS_DEV_URL = 'https://models.dev/api.json';
const CATALOG_PATH = join(DATA_DIR, 'models.dev.json');

export interface PricingRefreshResult {
  ok: true;
  fetchedAt: number;
  catalogPath: string;
  providers: number;
  models: number;
  repriced: number;
  reclassified: number;
}

export interface PricingRefreshError {
  code: 'network' | 'http' | 'invalid-json' | 'empty' | 'write';
  message: string;
}

let inFlight: Promise<PricingRefreshResult> | null = null;

/**
 * Download the public models.dev catalog and make it live without restarting the daemon.
 * The file is validated before an atomic replace, then the same safe reprice rules used at
 * startup run: unknown/computed rows may be filled, native harness costs are never touched.
 */
export function refreshPricing(db: DB): Promise<PricingRefreshResult> {
  if (inFlight) return inFlight;
  inFlight = refreshPricingOnce(db).finally(() => {
    inFlight = null;
  });
  return inFlight;
}

async function refreshPricingOnce(db: DB): Promise<PricingRefreshResult> {
  let response: Response;
  try {
    response = await fetch(MODELS_DEV_URL, {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(60_000),
    });
  } catch (error) {
    throw Object.assign(new Error(`models.dev request failed: ${(error as Error).message}`), { code: 'network' as const });
  }
  if (!response.ok) {
    throw Object.assign(new Error(`models.dev returned HTTP ${response.status}`), { code: 'http' as const });
  }

  let body: string;
  try {
    body = await response.text();
  } catch (error) {
    throw Object.assign(new Error(`models.dev response could not be read: ${(error as Error).message}`), { code: 'network' as const });
  }

  let catalog: unknown;
  try {
    catalog = JSON.parse(body) as unknown;
  } catch (error) {
    throw Object.assign(new Error(`models.dev returned invalid JSON: ${(error as Error).message}`), { code: 'invalid-json' as const });
  }

  const validation = validateCatalog(catalog);
  if (!validation.ok) {
    throw Object.assign(new Error(validation.message), { code: validation.code });
  }
  const { providers, models } = validation;

  mkdirSync(DATA_DIR, { recursive: true });
  const tempPath = `${CATALOG_PATH}.tmp-${process.pid}-${Date.now()}`;
  try {
    writeFileSync(tempPath, body, 'utf8');
    replaceCatalog(tempPath);
  } catch (error) {
    try {
      if (existsSync(tempPath)) unlinkSync(tempPath);
    } catch {
      /* best effort cleanup */
    }
    throw Object.assign(new Error(`could not replace the pricing catalog: ${(error as Error).message}`), { code: 'write' as const });
  }

  // Reload the table and re-run only non-native classifications. This preserves the
  // historical/native cost contract while making newly priced models available now.
  loadPrices(db);
  const resolver = new PriceResolver(db);
  const repriced = repriceUnknown(db, resolver);
  const reclassified = reclassifyCosts(db, resolver);
  return {
    ok: true,
    fetchedAt: Date.now(),
    catalogPath: CATALOG_PATH,
    providers,
    models,
    repriced,
    reclassified,
  };
}

type CatalogValidation =
  | { ok: true; providers: number; models: number }
  | { ok: false; code: 'empty' | 'invalid-json'; message: string };

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Validate the parts the loader can safely interpret before touching the live catalog. */
export function validateCatalog(raw: unknown): CatalogValidation {
  if (!record(raw)) {
    return { ok: false, code: 'invalid-json', message: 'models.dev response root must be an object' };
  }
  let providers = 0;
  let models = 0;
  for (const [providerId, provider] of Object.entries(raw)) {
    if (!record(provider) || !record(provider.models)) {
      return { ok: false, code: 'invalid-json', message: `models.dev provider ${providerId} has no valid models object` };
    }
    providers += 1;
    for (const [modelId, model] of Object.entries(provider.models)) {
      if (!record(model) || model.cost == null) continue;
      const cost = model.cost;
      if (!record(cost)) {
        return { ok: false, code: 'invalid-json', message: `models.dev cost for ${providerId}/${modelId} must be an object` };
      }
      for (const key of ['input', 'output', 'cache_read', 'cache_write']) {
        const value = cost[key];
        if (value !== undefined && value !== null && (typeof value !== 'number' || !Number.isFinite(value) || value < 0)) {
          return { ok: false, code: 'invalid-json', message: `models.dev rate ${providerId}/${modelId}/${key} must be a finite non-negative number` };
        }
      }
      if (['input', 'output', 'cache_read', 'cache_write'].some((key) => typeof cost[key] === 'number')) models += 1;
    }
  }
  if (!providers || !models) {
    return { ok: false, code: 'empty', message: 'models.dev response contained no providers or usable model prices' };
  }
  return { ok: true, providers, models };
}

/** Replace the catalog while retaining a rollback copy if the final rename fails. */
function replaceCatalog(tempPath: string): void {
  const backupPath = `${CATALOG_PATH}.bak`;
  let movedLive = false;
  try {
    if (existsSync(CATALOG_PATH)) {
      if (existsSync(backupPath)) unlinkSync(backupPath);
      renameSync(CATALOG_PATH, backupPath);
      movedLive = true;
    }
    renameSync(tempPath, CATALOG_PATH);
  } catch (error) {
    try {
      if (existsSync(CATALOG_PATH) && movedLive) unlinkSync(CATALOG_PATH);
      if (movedLive && existsSync(backupPath) && !existsSync(CATALOG_PATH)) renameSync(backupPath, CATALOG_PATH);
    } catch {
      // Preserve the original write error; the backup remains available for manual recovery.
    }
    throw error;
  }
}
