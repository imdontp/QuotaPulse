import type { ModelRow, Totals } from '@/api';

const EMPTY_TOTALS: Totals = {
  calls: 0,
  input_tokens: 0,
  cached_input_tokens: 0,
  cache_write_tokens: 0,
  output_tokens: 0,
  reasoning_tokens: 0,
  total_tokens: 0,
  cost_usd: 0,
  cost_input_usd: 0,
  cost_cached_input_usd: 0,
  cost_cache_write_usd: 0,
  cost_output_usd: 0,
  cost_cache_saving_usd: 0,
  cost_unknown_calls: 0,
  cost_estimated_calls: 0,
};

/** Sum exactly the rows shown by the Today table, including the token breakdown. */
export function sumTodayRows(rows: readonly ModelRow[]): Totals {
  return rows.reduce<Totals>((total, row) => ({
    calls: total.calls + row.calls,
    input_tokens: total.input_tokens + row.input_tokens,
    cached_input_tokens: total.cached_input_tokens + row.cached_input_tokens,
    cache_write_tokens: total.cache_write_tokens + row.cache_write_tokens,
    output_tokens: total.output_tokens + row.output_tokens,
    reasoning_tokens: total.reasoning_tokens + row.reasoning_tokens,
    total_tokens: total.total_tokens + row.total_tokens,
    cost_usd: total.cost_usd + row.cost_usd,
    cost_input_usd: total.cost_input_usd + row.cost_input_usd,
    cost_cached_input_usd: total.cost_cached_input_usd + row.cost_cached_input_usd,
    cost_cache_write_usd: total.cost_cache_write_usd + row.cost_cache_write_usd,
    cost_output_usd: total.cost_output_usd + row.cost_output_usd,
    cost_cache_saving_usd: total.cost_cache_saving_usd + row.cost_cache_saving_usd,
    cost_unknown_calls: total.cost_unknown_calls + row.cost_unknown_calls,
    cost_estimated_calls: total.cost_estimated_calls + row.cost_estimated_calls,
  }), { ...EMPTY_TOTALS });
}
