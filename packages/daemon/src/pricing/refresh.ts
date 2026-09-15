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

  const body = await response.text();
  let catalog: Record<string, { models?: Record<string, { cost?: unknown }> }>;
  try {
    catalog = JSON.parse(body) as typeof catalog;
  } catch (error) {
    throw Object.assign(new Error(`models.dev returned invalid JSON: ${(error as Error).message}`), { code: 'invalid-json' as const });
  }
  const providers = Object.keys(catalog).length;
  const models = Object.values(catalog).reduce(
    (count, provider) => count + Object.keys(provider?.models ?? {}).length,
    0,
  );
  if (!providers || !models) {
    throw Object.assign(new Error('models.dev response contained no providers or models'), { code: 'empty' as const });
  }

  mkdirSync(DATA_DIR, { recursive: true });
  const tempPath = `${CATALOG_PATH}.tmp-${process.pid}-${Date.now()}`;
  try {
    writeFileSync(tempPath, body, 'utf8');
    try {
      renameSync(tempPath, CATALOG_PATH);
    } catch (error) {
      // Node may refuse rename-over-existing on Windows. Keep the replacement scoped to
      // this exact catalog path so a second Dashboard refresh does not silently fail.
      if (!existsSync(CATALOG_PATH)) throw error;
      unlinkSync(CATALOG_PATH);
      renameSync(tempPath, CATALOG_PATH);
    }
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
