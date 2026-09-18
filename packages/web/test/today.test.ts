import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sumTodayRows } from '../src/lib/today.ts';
import type { ModelRow } from '../src/api.ts';

function row(overrides: Partial<ModelRow> = {}): ModelRow {
  return {
    model: 'model-a',
    harness: 'harness-a',
    effort: '',
    vendor: 'vendor-a',
    calls: 1,
    input_tokens: 10,
    cached_input_tokens: 2,
    cache_write_tokens: 3,
    output_tokens: 4,
    reasoning_tokens: 5,
    total_tokens: 24,
    cost_usd: 0.1,
    cost_input_usd: 0.02,
    cost_cached_input_usd: 0.01,
    cost_cache_write_usd: 0.01,
    cost_output_usd: 0.06,
    cost_cache_saving_usd: 0.005,
    cost_unknown_calls: 0,
    cost_estimated_calls: 0,
    ...overrides,
  };
}

test('Today cards sum the rows selected by the harness/model filters', () => {
  const totals = sumTodayRows([
    row(),
    row({ harness: 'harness-b', model: 'model-b', calls: 2, total_tokens: 48, output_tokens: 8 }),
  ]);

  assert.equal(totals.calls, 3);
  assert.equal(totals.input_tokens, 20);
  assert.equal(totals.output_tokens, 12);
  assert.equal(totals.total_tokens, 72);
});

test('Today cards show zero when a filter matches no rows', () => {
  const totals = sumTodayRows([]);
  assert.equal(totals.calls, 0);
  assert.equal(totals.total_tokens, 0);
  assert.equal(totals.output_tokens, 0);
});
