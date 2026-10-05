import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cacheSharePercent, paceAboveSafePercent, percentagePointChange, recommendationKind, relativeChangePercent, supportedForecastPace } from '../src/redesign/insight-model.js';

test('period change requires a positive observed baseline and keeps decreases signed', () => {
  assert.ok(Math.abs(relativeChangePercent(128, 100)! - 28) < 1e-9);
  assert.ok(Math.abs(relativeChangePercent(75, 100)! + 25) < 1e-9);
  assert.equal(relativeChangePercent(0, 100), -100);
  assert.equal(relativeChangePercent(10, 0), null);
  assert.equal(relativeChangePercent(null, 100), null);
});

test('cache share uses observed input, cached input and cache writes only', () => {
  assert.equal(cacheSharePercent({ input_tokens: 400, cached_input_tokens: 500, cache_write_tokens: 100 }), 50);
  assert.equal(cacheSharePercent({ input_tokens: 0, cached_input_tokens: 0, cache_write_tokens: 0 }), null);
  assert.equal(cacheSharePercent({ input_tokens: -1, cached_input_tokens: 2, cache_write_tokens: 0 }), null);
  assert.equal(percentagePointChange(42, 30), 12);
  assert.equal(percentagePointChange(null, 30), null);
});

test('measured quota pace is compared with safe pace in the same unit', () => {
  assert.ok(Math.abs(paceAboveSafePercent(1.53, 1)! - 53) < 1e-9);
  assert.ok(Math.abs(paceAboveSafePercent(0.8, 1)! + 20) < 1e-9);
  assert.equal(paceAboveSafePercent(1, 0), null);
  assert.equal(paceAboveSafePercent(null, 1), null);
  assert.equal(supportedForecastPace('ready', 0.25), 0.25);
  assert.equal(supportedForecastPace('flat', 0), 0);
  assert.equal(supportedForecastPace('insufficient', 0.25), null);
  assert.equal(supportedForecastPace('reset', 0.25), null);
  assert.equal(supportedForecastPace('ready', -0.25), null);
});

test('recommendation prioritizes fresh quota data and observed runway risk', () => {
  assert.equal(recommendationKind({ stale: true, projectedBeforeReset: false, risk: 'unknown', cacheShare: 0, pricingState: 'unavailable' }), 'fresh-reading');
  assert.equal(recommendationKind({ stale: false, projectedBeforeReset: true, risk: 'warning', cacheShare: 0, pricingState: 'partial' }), 'reduce-load');
  assert.equal(recommendationKind({ stale: false, projectedBeforeReset: false, risk: 'critical', cacheShare: 50, pricingState: 'complete' }), 'slow-down');
  assert.equal(recommendationKind({ stale: false, projectedBeforeReset: false, risk: 'normal', cacheShare: 10, pricingState: 'complete' }), 'use-cache');
  assert.equal(recommendationKind({ stale: false, projectedBeforeReset: false, risk: 'normal', cacheShare: 50, pricingState: 'partial' }), 'check-pricing');
  assert.equal(recommendationKind({ stale: false, projectedBeforeReset: false, risk: 'normal', cacheShare: null, pricingState: 'unavailable' }), 'monitor', 'No calls must not be presented as a pricing problem');
  assert.equal(recommendationKind({ stale: false, projectedBeforeReset: false, risk: 'normal', cacheShare: 50, pricingState: 'complete' }), 'monitor');
});
