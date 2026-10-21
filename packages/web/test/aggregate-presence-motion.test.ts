import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AggregatePresenceLedger } from '../src/redesign/aggregate-presence-motion';
import { modelPairKey } from '../src/redesign/model-row-trends';
import { projectMotionKey } from '../src/redesign/project-selection-motion';
import type { LiveRecordBatch } from '../src/redesign/live-record-motion';

function fixture() {
  const ledger = new AggregatePresenceLedger(); ledger.setEligible(true); let serial = 0;
  const batch = (reason: LiveRecordBatch['reason'] = 'sse'): LiveRecordBatch => ({ serial: ++serial, reason, requestEligibility: ledger.snapshot() });
  return { ledger, batch };
}

test('aggregate keys preserve exact nullable/empty/case project and recorded-provider identities', () => {
  assert.equal(new Set([null, '', 'A', 'a'].map(projectMotionKey)).size, 4);
  const pairs = [null, '', 'A', 'a'].flatMap(model => [null, '', 'P', 'p'].map(provider => ({ model, provider })));
  assert.equal(new Set(pairs.map(modelPairKey)).size, 16);
  assert.equal(modelPairKey({ model: 'A', provider: null }), '["A",null]');
});

test('previous full accepted group universe prevents metric-only offpage promotion being called a new group', () => {
  const { ledger, batch } = fixture();
  const universe = Array.from({ length: 25 }, (_, i) => modelPairKey({ model: `M${i}`, provider: 'gateway' }));
  const initialPage = universe.slice(0, 20);
  assert.deepEqual(ledger.acceptPage(batch('initial'), 'scope-page0', universe, initialPage), []);
  const promotedPage = [universe[24]!, ...universe.slice(0, 19)];
  assert.deepEqual(ledger.acceptPage(batch(), 'scope-page0', [...universe].reverse(), promotedPage), []);
  const newKey = modelPairKey({ model: 'new', provider: null });
  assert.deepEqual(ledger.acceptPage(batch(), 'scope-page0', [...universe, newKey], [newKey, ...promotedPage.slice(0, 19)]), [newKey]);
  assert.deepEqual(ledger.acceptPage(batch(), 'scope-page0', [...universe, newKey], [newKey, ...promotedPage.slice(0, 19)]), []);
});

test('new group observed outside rendered page is consumed; later rank promotion is static', () => {
  const { ledger, batch } = fixture();
  ledger.acceptPage(batch('initial'), 'A', ['old'], ['old']);
  assert.deepEqual(ledger.acceptPage(batch(), 'A', ['old', 'offpage'], ['old']), []);
  assert.deepEqual(ledger.acceptPage(batch(), 'A', ['old', 'offpage'], ['offpage']), []);
});

test('context/locale/search/sort/page changes seed; same-context genuinely new aggregate presence enters', () => {
  const { ledger, batch } = fixture();
  for (const context of ['scope1', 'scope2', 'provider', 'search', 'sort', 'page2', 'locale']) {
    assert.deepEqual(ledger.acceptPage(batch(), context, [context], [context]), []);
    assert.deepEqual(ledger.acceptPage(batch(), context, [context, 'fresh:'+context], ['fresh:'+context]), ['fresh:'+context]);
  }
});

test('duplicate/reordered accepted batches do not replay or replace the bounded newer baseline', () => {
  const { ledger, batch } = fixture();
  const initial = batch('initial'); ledger.acceptPage(initial, 'A', ['old'], ['old']);
  const accepted = batch(); assert.deepEqual(ledger.acceptPage(accepted, 'A', ['old', 'new'], ['new']), ['new']);
  assert.deepEqual(ledger.acceptPage(accepted, 'A', ['new', 'old'], ['new']), []);
  assert.deepEqual(ledger.acceptPage(initial, 'foreign', [], []), []);
  assert.deepEqual(ledger.acceptPage(batch(), 'A', ['new', 'old'], ['old', 'new']), []);
});

test('held request crossing context/hidden/reduced/offscreen/error eligibility epoch cannot replay on restoration', () => {
  for (const reason of ['context', 'hidden', 'reduced', 'offscreen', 'error']) {
    const { ledger, batch } = fixture(); ledger.acceptPage(batch('initial'), 'A', ['old'], ['old']);
    const held = batch(); ledger.suspend(); ledger.setEligible(true);
    assert.deepEqual(ledger.acceptPage(held, 'A', ['old', reason], [reason]), []);
    assert.deepEqual(ledger.acceptPage(batch(), 'A', ['old', reason, 'returned'], ['returned']), []);
    assert.deepEqual(ledger.acceptPage(batch(), 'A', ['old', reason, 'returned', 'fresh'], ['fresh']), ['fresh']);
  }
});

test('initial/dependency/visible/online responses seed and preceding-universe bound allows actual disappearance/reappearance', () => {
  for (const reason of ['initial', 'dependency', 'visible', 'online'] as const) {
    const { ledger, batch } = fixture(); ledger.acceptPage(batch('initial'), 'A', ['old'], ['old']);
    assert.deepEqual(ledger.acceptPage(batch(reason), 'A', ['backlog'], ['backlog']), []);
    assert.deepEqual(ledger.acceptPage(batch(), 'A', [], []), []);
    assert.deepEqual(ledger.acceptPage(batch(), 'A', ['old'], ['old']), ['old']);
  }
});
