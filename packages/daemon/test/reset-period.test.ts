import { test } from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { burnRate, RESET_TOLERANCE_MS } from '../src/api/queries.js';
import { RESET_TOLERANCE_MS as TRAY_TOLERANCE, sameReset } from '../../tray/src/alerts.js';

const now = 1_800_000_000_000;
function evaluate(earlierReset: number | null, latestReset: number | null) {
  const db = new Database(':memory:');
  db.exec('CREATE TABLE limit_sample (source_id INTEGER, window_kind TEXT, origin TEXT, used_percent REAL, resets_at INTEGER, observed_at INTEGER)');
  const add = db.prepare('INSERT INTO limit_sample VALUES (?,?,?,?,?,?)');
  add.run(1,'weekly','reader',70,earlierReset,now-3600000);
  add.run(1,'weekly','reader',75,latestReset,now);
  add.run(2,'weekly','reader',1,latestReset,now-7200000);
  add.run(1,'weekly','other-reader',1,latestReset,now-7200000);
  add.run(1,'5h','reader',1,latestReset,now-7200000);
  db.pragma('query_only = ON');
  try { return burnRate(db,1,'weekly','reader'); } finally { db.close(); }
}

test('daemon and tray agree at both sides of the reset-jitter boundary', () => {
  assert.equal(RESET_TOLERANCE_MS,TRAY_TOLERANCE);
  const reset = now+3*3600000;
  for(const delta of [0,28,-28,1999,-1999,2000,-2000,2001,-2001,5*3600000]) {
    const same = Math.abs(delta)<=2000;
    assert.equal(sameReset(reset,reset+delta),same,`tray ${delta}`);
    const rate = evaluate(reset,reset+delta);
    assert.equal(rate!=null,same,`daemon ${delta}`);
    if(rate) assert.equal(rate.percentPerHour,5,'must not mix source/window/origin');
  }
});

test('null resets keep prior semantics and real new periods do not reuse old burn', () => {
  assert.equal(evaluate(null,null)?.percentPerHour,5);
  assert.equal(evaluate(null,now+3600000),null);
  assert.equal(evaluate(now+3600000,null),null);
  assert.equal(evaluate(now+3600000,now+8*86400000),null);
});
