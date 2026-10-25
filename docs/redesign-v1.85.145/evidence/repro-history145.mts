import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { openDb } from '../packages/daemon/src/db/index.js';
import { historySummary as current } from '../packages/daemon/src/api/history-summary.js';
const frozen = 'C:/Users/TH12367283/Projects/QuotaPulse/tmp/worktrees/redesign-validation-v1.85.143';
const relative = 'packages/daemon/src/api/history-summary.ts';
const original = spawnSync('git', ['show', '8c10e147439c9037131af77449c3ada0a6d9970f:' + relative], { encoding: 'utf8' });
assert.equal(original.status, 0);
assert.equal(readFileSync(frozen + '/' + relative, 'utf8').replace(/\r\n/g, '\n'), original.stdout.replace(/\r\n/g, '\n'));
const { historySummary: before } = await import(pathToFileURL(frozen + '/' + relative).href);
const db = openDb(':memory:');
try {
  const to = Date.UTC(2026, 9, 25, 12), hour = 3_600_000, first = to - 3 * hour;
  db.exec(`INSERT INTO source(id,harness,profile,root_path,display_name,detected_at) VALUES (1,'codex','test','/synthetic','Fixture',0);
    INSERT INTO usage_event(source_id,dedup_key,ts,total_tokens,input_tokens,output_tokens,call_count) VALUES
    (1,'first',${first},10,6,4,1),(1,'second',${first + 2 * hour},10,6,4,1);`);
  const scope = { from: 0, to, sourceId: 1 };
  const old = before(db, scope), after = current(db, scope, 'observed'), legacy = current(db, scope);
  assert.equal(legacy.bucketMs, old.bucketMs);
  assert.deepEqual(legacy.timeline, old.timeline);
  assert.ok(old.bucketMs > 120 * 24 * hour, 'original epoch domain collapses months into a bucket');
  assert.equal(after.bucketMs, hour);
  assert.deepEqual(old.totals, after.totals);
  assert.equal(old.timeline.length, 1);
  assert.equal(after.timeline.length, 2);
  assert.deepEqual(after.timelineRange, { from: first, to });
  writeFileSync('tmp/history145-reproduction.json', JSON.stringify({ baselineCommit: '8c10e147439c9037131af77449c3ada0a6d9970f', originalSourceVerified: true, scope,
    before: { plotFrom: scope.from, bucketMs: old.bucketMs, timeline: old.timeline }, after, identicalTotals: true }, null, 2));
  console.log('Original symptom reproduced; observed extent separates both events; totals identical');
} finally { db.close(); }
