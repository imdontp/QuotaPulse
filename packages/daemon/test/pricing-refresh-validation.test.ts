import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateCatalog } from '../src/pricing/refresh.js';

test('pricing refresh accepts providers with at least one finite non-negative rate', () => {
  const result = validateCatalog({
    openai: {
      models: {
        'gpt-test': { cost: { input: 0.001, output: 0.002 } },
        'no-price': { context: 128000 },
      },
    },
  });
  assert.deepEqual(result, { ok: true, providers: 1, models: 1 });
});

test('pricing refresh rejects malformed or empty catalogs before replacing the live file', () => {
  assert.equal(validateCatalog(null).ok, false);
  assert.equal(validateCatalog({ openai: { models: {} } }).code, 'empty');
  assert.equal(
    validateCatalog({ openai: { models: { broken: { cost: { input: -1 } } } } }).code,
    'invalid-json',
  );
  assert.equal(
    validateCatalog({ openai: { models: { broken: { cost: { input: '0.1' } } } } }).code,
    'invalid-json',
  );
});
