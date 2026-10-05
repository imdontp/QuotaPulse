import { test } from 'node:test';
import assert from 'node:assert/strict';

import type { Limit } from '../src/api.js';
import { getQuotaRiskModel } from '../src/redesign/alert-risks.js';

const now = 1_800_000_000_000;
const reading = (overrides: Partial<Limit> = {}): Limit => ({
  source_id: 1,
  harness: 'claude',
  profile: 'default',
  display_name: 'Claude',
  window_kind: '5h',
  used_percent: 20,
  resets_at: now + 2 * 3_600_000,
  severity: null,
  observed_at: now - 60_000,
  source_fetched_at: now - 60_000,
  origin: 'live',
  account_key: 'account:claude',
  account_provider: 'anthropic',
  account_display_name: 'Claude account',
  subscription_key: 'subscription:claude',
  subscription_provider: 'anthropic',
  subscription_display_name: 'Claude Pro',
  ageSeconds: 60,
  valueAgeSeconds: 60,
  last_seen_at: now - 60_000,
  burn: null,
  forecast: { status: 'insufficient', samples: 0, fromAt: null, toAt: null, percentPerHour: null, projectedFullAt: null },
  ...overrides,
});

test('classifies threshold boundaries and uses the same active risks exposed to the sidebar', () => {
  const model = getQuotaRiskModel([
    reading({ used_percent: 49.99, subscription_key: 'below' }),
    reading({ used_percent: 50, subscription_key: 'notice' }),
    reading({ used_percent: 80, subscription_key: 'warning' }),
    reading({ used_percent: 95, subscription_key: 'critical' }),
  ], [], now);

  assert.deepEqual(model.risks.map(({ owner, level }) => [owner, level]), [
    ['critical', 'critical'], ['warning', 'warning'], ['notice', 'info'],
  ]);
  assert.equal(model.activeRisks.length, 3);
  assert.equal(model.freshCount, 4);
});

test('collapses duplicate origins to the freshest reading and excludes hidden subscriptions', () => {
  const staleDuplicate = reading({ origin: 'cached', used_percent: 5, ageSeconds: 300, last_seen_at: now - 300_000 });
  const freshDuplicate = reading({ origin: 'live', used_percent: 80, ageSeconds: 60, last_seen_at: now - 60_000 });
  const hidden = reading({ subscription_key: 'hidden', used_percent: 95 });
  const model = getQuotaRiskModel([staleDuplicate, freshDuplicate, hidden], ['hidden'], now);

  assert.equal(model.windows.length, 1);
  assert.equal(model.windows[0].primary, freshDuplicate);
  assert.equal(model.activeRisks.length, 1);
  assert.equal(model.activeRisks[0].reading.used_percent, 80);
});

test('reports stale or expired windows as unknown without counting them as active risks', () => {
  const model = getQuotaRiskModel([
    reading({ subscription_key: 'old', used_percent: 99, last_seen_at: now - 3_600_000 }),
    reading({ subscription_key: 'expired', used_percent: 99, resets_at: now - 1 }),
    reading({ subscription_key: 'future', used_percent: 99, last_seen_at: now + 1 }),
  ], [], now);

  assert.deepEqual(model.risks.map(({ level }) => level), ['stale', 'stale', 'stale']);
  assert.equal(model.activeRisks.length, 0);
  assert.equal(model.freshCount, 0);
});

test('a valid forecast before reset is critical, while a forecast after reset does not override thresholds', () => {
  const model = getQuotaRiskModel([
    reading({ subscription_key: 'forecast', used_percent: 20, forecast: { status: 'ready', samples: 4, fromAt: now - 60_000, toAt: now, percentPerHour: 1, projectedFullAt: now + 3_600_000 } }),
    reading({ subscription_key: 'late', used_percent: 50, forecast: { status: 'ready', samples: 4, fromAt: now - 60_000, toAt: now, percentPerHour: 1, projectedFullAt: now + 3 * 3_600_000 } }),
  ], [], now);

  assert.deepEqual(model.risks.map(({ owner, level, reason }) => [owner, level, reason]), [
    ['forecast', 'critical', 'forecast'], ['late', 'info', 'threshold'],
  ]);
});
