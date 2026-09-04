import type { DB } from '../db/index.js';
import { PriceResolver } from './resolve.js';
import { logger } from '../util/log.js';

const log = logger('pricing');

/**
 * Put a price on events that were stored without one, where we now can.
 *
 * `cost_source='unknown'` means only "no price was found when this was written", and
 * that can stop being true two ways: the model catalog gains an entry, or the event's
 * own model is recovered (migration v5 refilled the model on calls the Codex adapter
 * had written as NULL, and a null model makes the lookup fail before it starts).
 * Neither is rare enough to leave a permanent hole in the money column.
 *
 * Runs after the catalog is loaded, which is why this is not a migration -- migrations
 * run at `openDb`, before any price exists to look up.
 *
 * Only ever fills in: a row that already has a price is never touched, and neither is
 * `cost_source='native'`, which is the harness's own figure and outranks ours.
 */
export function repriceUnknown(db: DB, prices: PriceResolver): number {
  const rows = db
    .prepare(
      `SELECT id, model, provider, input_tokens, cached_input_tokens,
              cache_write_tokens, output_tokens
         FROM usage_event
        WHERE cost_source = 'unknown' AND model IS NOT NULL`,
    )
    .all() as Array<{
    id: number;
    model: string;
    provider: string | null;
    input_tokens: number;
    cached_input_tokens: number;
    cache_write_tokens: number;
    output_tokens: number;
  }>;
  if (rows.length === 0) return 0;

  const update = db.prepare(
    `UPDATE usage_event
        SET cost_usd = @usd, cost_source = @source, price_provider = @priceProvider,
            cost_input_usd = @inputUsd, cost_cached_input_usd = @cachedInputUsd,
            cost_cache_write_usd = @cacheWriteUsd, cost_output_usd = @outputUsd,
            cost_cache_saving_usd = @cacheSavingUsd
      WHERE id = @id`,
  );

  // One transaction: thousands of single-row updates against a WAL database is the
  // difference between a few milliseconds and several seconds of startup.
  const run = db.transaction(() => {
    let priced = 0;
    for (const r of rows) {
      const cost = prices.cost(r.model, r.provider, {
        inputTokens: r.input_tokens,
        cachedInputTokens: r.cached_input_tokens,
        cacheWriteTokens: r.cache_write_tokens,
        outputTokens: r.output_tokens,
      });
      if (cost == null) continue; // Still genuinely unpriced; it stays a dash.
      update.run({
        id: r.id,
        usd: cost.usd,
        source: cost.match === 'exact' ? 'computed' : 'estimated',
        priceProvider: cost.priceProvider,
        inputUsd: cost.inputUsd,
        cachedInputUsd: cost.cachedInputUsd,
        cacheWriteUsd: cost.cacheWriteUsd,
        outputUsd: cost.outputUsd,
        cacheSavingUsd: prices.cacheSaving(r.model, r.provider, r.cached_input_tokens),
      });
      priced++;
    }
    return priced;
  });

  const priced = run();
  if (priced > 0) {
    log.info(`priced ${priced} events that had no price before (of ${rows.length} checked)`);
  }
  return priced;
}


/**
 * Fill the cost breakdown and `price_provider` on rows priced before those columns
 * existed, and demote to `estimated` the ones whose price came from a provider this
 * resolver picked rather than the one the call went through.
 *
 * A companion to `repriceUnknown`, run beside it for the same reason: resolving a price
 * needs the catalog, and migrations run at `openDb` before any of it is loaded.
 *
 * `native` is never touched -- that figure is the harness's own and outranks ours. Rows
 * whose breakdown is already stored are skipped, so this costs nothing after one pass.
 * The cached-tokens clause is what lets a column added later be filled on rows that were
 * classified before it existed, without reprocessing everything every start.
 */
export function reclassifyCosts(db: DB, prices: PriceResolver): number {
  const rows = db
    .prepare(
      `SELECT id, model, provider, input_tokens, cached_input_tokens,
              cache_write_tokens, output_tokens
         FROM usage_event
        WHERE cost_source IN ('computed', 'estimated')
          AND model IS NOT NULL
          AND (price_provider IS NULL
               OR (cost_cache_saving_usd IS NULL AND cached_input_tokens > 0))`,
    )
    .all() as Array<{
    id: number;
    model: string;
    provider: string | null;
    input_tokens: number;
    cached_input_tokens: number;
    cache_write_tokens: number;
    output_tokens: number;
  }>;
  if (rows.length === 0) return 0;

  const update = db.prepare(
    `UPDATE usage_event
        SET cost_source = @source, price_provider = @priceProvider,
            cost_input_usd = @inputUsd, cost_cached_input_usd = @cachedInputUsd,
            cost_cache_write_usd = @cacheWriteUsd, cost_output_usd = @outputUsd,
            cost_cache_saving_usd = @cacheSavingUsd
      WHERE id = @id`,
  );

  const run = db.transaction(() => {
    let done = 0;
    let estimated = 0;
    for (const r of rows) {
      const cost = prices.cost(r.model, r.provider, {
        inputTokens: r.input_tokens,
        cachedInputTokens: r.cached_input_tokens,
        cacheWriteTokens: r.cache_write_tokens,
        outputTokens: r.output_tokens,
      });
      // The catalog no longer prices it. Leave cost_usd alone rather than rewrite
      // history: only the classification was ever in question here.
      if (cost == null) continue;
      const source = cost.match === 'exact' ? 'computed' : 'estimated';
      if (source === 'estimated') estimated++;
      update.run({
        id: r.id,
        source,
        priceProvider: cost.priceProvider,
        inputUsd: cost.inputUsd,
        cachedInputUsd: cost.cachedInputUsd,
        cacheWriteUsd: cost.cacheWriteUsd,
        outputUsd: cost.outputUsd,
        cacheSavingUsd: prices.cacheSaving(r.model, r.provider, r.cached_input_tokens),
      });
      done++;
    }
    if (estimated > 0) {
      log.info(`${estimated} of ${done} priced events used a provider we picked, not theirs`);
    }
    return done;
  });

  const done = run();
  if (done > 0) log.info(`filled the cost breakdown on ${done} events`);
  return done;
}
