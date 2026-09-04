import type { DB } from '../db/index.js';

export interface PriceRow {
  input_per_1m: number | null;
  cached_input_per_1m: number | null;
  cache_write_per_1m: number | null;
  output_per_1m: number | null;
  provider: string;
  model: string;
}

export interface TokenCounts {
  inputTokens: number;
  cachedInputTokens: number;
  cacheWriteTokens: number;
  outputTokens: number;
}

/** Providers we trust first when a bare model id matches several catalog entries. */
const PREFERRED = ['anthropic', 'openai', 'google', 'google-vertex', 'openrouter'];

/*
 * Gateway labels a harness records that are not catalog provider ids, mapped to the one
 * they bill as. Without this they fall through to the PREFERRED order and get a price
 * that happens to be right rather than one that is known to be: `gpt-5.5` alone exists
 * under 17 providers here, from $0.188 to $5.50 per 1M input.
 */
const PROVIDER_ALIAS: Record<string, string> = {
  'openai-codex': 'openai',
  'opencode-free': 'opencode',
};

/*
 * Providers that run the model on your own hardware. These must never be priced from the
 * catalog: matching a local `qwen2.5-coder` against a cloud entry would invoice you for
 * electricity you already paid for. Today OpenCode reports a native cost of 0 for these
 * so it never comes up, but the trap is one adapter change away.
 */
const LOCAL_PROVIDERS = new Set(['ollama', 'custom', 'lmstudio', 'llamacpp']);

/** How a price was found. `estimated` means the provider was guessed, not matched. */
export type PriceMatch = 'exact' | 'estimated';

export interface CostBreakdown {
  usd: number;
  inputUsd: number;
  cachedInputUsd: number;
  cacheWriteUsd: number;
  outputUsd: number;
  /** Whose price was used -- not necessarily the provider the call was made through. */
  priceProvider: string;
  match: PriceMatch;
}

/**
 * Model ids arrive in several dialects: Claude writes `claude-opus-5`, Codex writes
 * `gpt-5.6-luna`, OpenCode wraps it in JSON, and some carry a date suffix. Try the
 * cheapest match first and widen only as needed.
 */
export class PriceResolver {
  private cache = new Map<string, PriceRow | null>();
  private byPair;
  private byModel;

  constructor(db: DB) {
    this.byPair = db.prepare(
      `SELECT provider, model, input_per_1m, cached_input_per_1m, cache_write_per_1m, output_per_1m
         FROM price WHERE provider = ? AND model = ?`,
    );
    this.byModel = db.prepare(
      `SELECT provider, model, input_per_1m, cached_input_per_1m, cache_write_per_1m, output_per_1m
         FROM price WHERE model = ?`,
    );
  }

  lookup(model: string | null | undefined, provider?: string | null): PriceRow | null {
    if (!model) return null;
    if (provider && LOCAL_PROVIDERS.has(provider)) return null;
    provider = provider ? (PROVIDER_ALIAS[provider] ?? provider) : provider;
    const key = `${provider ?? ''} ${model}`;
    const hit = this.cache.get(key);
    if (hit !== undefined) return hit;

    const found = this.search(model, provider ?? null);
    this.cache.set(key, found);
    return found;
  }

  private search(model: string, provider: string | null): PriceRow | null {
    const variants = [
      model,
      model.replace(/-\d{8}$/, ''),
      model.replace(/^(models|openai|anthropic)\//, ''),
    ];

    if (provider) {
      for (const v of variants) {
        const row = this.byPair.get(provider, v) as PriceRow | undefined;
        if (row) return row;
      }
    }
    for (const v of variants) {
      const rows = this.byModel.all(v) as PriceRow[];
      if (rows.length === 0) continue;
      for (const p of PREFERRED) {
        const pick = rows.find((r) => r.provider === p);
        if (pick) return pick;
      }
      return rows[0] ?? null;
    }
    return null;
  }

  /**
   * Returns null when the model is unpriced. Callers must then record
   * cost_source='unknown' rather than substituting 0, so the dashboard can show a
   * dash instead of a false $0.00.
   *
   * The four components are returned rather than only their sum, because they are the
   * answer to two questions the total cannot answer: what each token bucket actually
   * cost, and what caching actually saved. They are computed here anyway.
   *
   * `match` says whether the price belongs to the provider the call was made through or
   * to one this resolver picked. A guessed price and a known one must not look alike.
   */
  cost(
    model: string | null | undefined,
    provider: string | null | undefined,
    t: TokenCounts,
  ): CostBreakdown | null {
    const p = this.lookup(model, provider);
    if (!p) return null;
    const per = (tokens: number, rate: number | null) =>
      rate == null ? 0 : (tokens / 1_000_000) * rate;
    // A model with no input and no output rate is not really priced.
    if (p.input_per_1m == null && p.output_per_1m == null) return null;

    const inputUsd = per(t.inputTokens, p.input_per_1m);
    const cachedInputUsd = per(t.cachedInputTokens, p.cached_input_per_1m ?? p.input_per_1m);
    const cacheWriteUsd = per(t.cacheWriteTokens, p.cache_write_per_1m ?? p.input_per_1m);
    const outputUsd = per(t.outputTokens, p.output_per_1m);

    const asked = provider ? (PROVIDER_ALIAS[provider] ?? provider) : null;
    return {
      usd: inputUsd + cachedInputUsd + cacheWriteUsd + outputUsd,
      inputUsd,
      cachedInputUsd,
      cacheWriteUsd,
      outputUsd,
      priceProvider: p.provider,
      match: asked != null && asked === p.provider ? 'exact' : 'estimated',
    };
  }

  /**
   * What the cached input would have cost at the full input rate, minus what it did cost.
   * Exact, where the dashboard previously multiplied a blended per-token rate by 0.9.
   */
  cacheSaving(
    model: string | null | undefined,
    provider: string | null | undefined,
    cachedInputTokens: number,
  ): number | null {
    const p = this.lookup(model, provider);
    if (!p || p.input_per_1m == null) return null;
    const full = (cachedInputTokens / 1_000_000) * p.input_per_1m;
    const paid = (cachedInputTokens / 1_000_000) * (p.cached_input_per_1m ?? p.input_per_1m);
    return full - paid;
  }
}
