import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { openDb, upsertSource } from '../src/db/index.js';
import { alertHistory, markAlertDelivered, recordQuotaAlerts } from '../src/api/queries.js';
import { tmpRoot } from './fixtures.js';

test('daemon records threshold crossings once and survives delivery reads', () => {
  const db = openDb(join(tmpRoot(), 'alerts.db'));
  const sourceId = upsertSource(db, { harness: 'codex', profile: 'default', rootPath: '/tmp/codex', displayName: 'Codex' });
  const add = db.prepare(`INSERT INTO limit_sample
    (source_id, window_kind, used_percent, resets_at, observed_at, last_seen_at, origin)
    VALUES (?, 'weekly', ?, ?, ?, ?, 'reader')`);
  const reset = 1_800_100_000_000;
  add.run(sourceId, 40, reset, 1_800_000_000_000, 1_800_000_000_000);
  add.run(sourceId, 55, reset, 1_800_001_000_000, 1_800_001_000_000);
  assert.equal(recordQuotaAlerts(db, 1_800_001_000_000).length, 1);
  assert.equal(recordQuotaAlerts(db, 1_800_001_100_000).length, 0);
  add.run(sourceId, 56, reset + 28, 1_800_002_000_000, 1_800_002_000_000);
  assert.equal(recordQuotaAlerts(db, 1_800_002_000_000).length, 0);
  add.run(sourceId, 82, reset + 28, 1_800_003_000_000, 1_800_003_000_000);
  assert.equal(recordQuotaAlerts(db, 1_800_003_000_000).length, 1);
  const history = alertHistory(db);
  assert.deepEqual(history.map((event) => event.threshold), [80, 50]);
  assert.equal(markAlertDelivered(db, history[0]!.id), true);
  assert.equal(alertHistory(db, { pending: true }).length, 1);
  db.close();
});

test('threshold history uses a new reset period and does not backfill the baseline', () => {
  const db = openDb(join(tmpRoot(), 'alerts-rollover.db'));
  const sourceId = upsertSource(db, { harness: 'codex', profile: 'default', rootPath: '/tmp/codex', displayName: 'Codex' });
  const add = db.prepare(`INSERT INTO limit_sample
    (source_id, window_kind, used_percent, resets_at, observed_at, last_seen_at, origin)
    VALUES (?, '5h', ?, ?, ?, ?, 'reader')`);
  add.run(sourceId, 82, 1_800_100_000_000, 1_800_000_000_000, 1_800_000_000_000);
  assert.equal(recordQuotaAlerts(db, 1_800_000_000_000).length, 0);
  add.run(sourceId, 55, 1_800_200_000_000, 1_800_001_000_000, 1_800_001_000_000);
  assert.equal(recordQuotaAlerts(db, 1_800_001_000_000).length, 0);
  add.run(sourceId, 65, 1_800_200_000_000, 1_800_002_000_000, 1_800_002_000_000);
  assert.equal(recordQuotaAlerts(db, 1_800_002_000_000).length, 0, 'no 50% event because the new period baseline is already above it');
  db.close();
});
