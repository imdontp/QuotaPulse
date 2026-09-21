import { test } from 'node:test';
import assert from 'node:assert/strict';

import { normalizeHiddenSubscriptions, setSubscriptionVisibility } from '../src/i18n/index.js';

test('subscription visibility preferences normalize safely and keep stable keys', () => {
  assert.deepEqual(
    normalizeHiddenSubscriptions([' anthropic:claude:personal ', '', 'anthropic:claude:personal', 42, null]),
    ['anthropic:claude:personal'],
  );
  assert.deepEqual(normalizeHiddenSubscriptions({}), []);

  const hidden = setSubscriptionVisibility([], 'anthropic:claude:personal', false);
  assert.deepEqual(hidden, ['anthropic:claude:personal']);
  assert.deepEqual(
    setSubscriptionVisibility(hidden, 'anthropic:claude:personal', true),
    [],
  );
});
