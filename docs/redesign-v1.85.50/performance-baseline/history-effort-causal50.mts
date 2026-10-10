import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve, relative } from 'node:path';
import { performance } from 'node:perf_hooks';
import { openDb } from '../packages/daemon/src/db/index.js';
import { historySummary } from '../packages/daemon/src/api/history-summary.js';
import { usageWhere, type UsageScope } from '../packages/daemon/src/api/usage-scope.js';

const root = resolve(import.meta.dirname, '..');
const output = resolve(root, 'tmp/history-effort-causal50.json');
const sha = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
function treeHash(directory: string) {
  const files: Array<{ path: string; sha256: string }> = [];
  function visit(path: string) {
    for (const entry of readdirSync(path, { withFileTypes: true })) {
      const next = resolve(path, entry.name);
      if (entry.isDirectory()) visit(next);
      else if (entry.isFile()) files.push({ path: relative(root, next).replaceAll('\\', '/'), sha256: sha(readFileSync(next)) });
    }
  }
  visit(resolve(root, directory));
  files.sort((a, b) => a.path.localeCompare(b.path));
  return { files: files.length, sha256: sha(JSON.stringify(files)) };
}
const frozenPaths = ['packages/web/src', 'packages/daemon/src', 'packages/web/dist'];
const frozenBefore = Object.fromEntries(frozenPaths.map(path => [path, treeHash(path)]));
const db = openDb(':memory:');
const scope: UsageScope = { from: 0, to: 5001 };
const where = usageWhere(scope);
const effortSql = `SELECT u.effort, COUNT(*) AS records, COALESCE(SUM(u.call_count),0) AS calls
  FROM usage_event u JOIN source s ON s.id=u.source_id
  LEFT JOIN session sess ON sess.id=u.session_id WHERE ${where.sql}
  GROUP BY u.effort ORDER BY calls DESC, u.effort ASC`;
try {
  db.exec("INSERT INTO source(id,harness,profile,root_path,display_name,detected_at) VALUES(1,'codex','synthetic','/synthetic/private-root','Effort causal fixture',0)");
  const insert = db.prepare(`INSERT INTO usage_event(source_id,dedup_key,ts,model,provider,effort,input_tokens,output_tokens,total_tokens,call_count,cost_usd,cost_source)
    VALUES(1,?,?,'gpt-test','openrouter','same',40,60,100,1,.02,'computed')`);
  db.transaction(() => { for (let i = 1; i <= 5000; i++) insert.run(`causal-${i}`, i); })();
  const columns = (db.prepare('PRAGMA table_info(usage_event)').all() as Array<{ name: string }>).map(row => row.name).filter(name => name !== 'effort');
  const invariantSql = `SELECT ${columns.map(name => `"${name}"`).join(',')} FROM usage_event ORDER BY id`;
  const invariantBefore = sha(JSON.stringify(db.prepare(invariantSql).all()));
  const measure = () => {
    const timingsMs: number[] = [];
    let result!: ReturnType<typeof historySummary>;
    for (let i = 0; i < 10; i++) {
      const started = performance.now();
      result = historySummary(db, scope);
      timingsMs.push(performance.now() - started);
    }
    const body = { now: 1700000000000, scope, ...result };
    const summary = result as unknown as { effort: Array<{ effort: string | null; records: number; calls: number }>; timeline: unknown[]; totals: { records: number; calls: number; tokens: number } };
    assert.equal(summary.totals.records, 5000);
    assert.equal(summary.totals.tokens, 500000);
    assert.equal(summary.effort.reduce((sum, row) => sum + row.records, 0), 5000);
    assert.equal(summary.effort.reduce((sum, row) => sum + row.calls, 0), summary.totals.calls);
    const sorted = [...timingsMs].sort((a, b) => a - b);
    return {
      result,
      evidence: {
        summaryUtf8Bytes: Buffer.byteLength(JSON.stringify(body), 'utf8'),
        effortUtf8Bytes: Buffer.byteLength(JSON.stringify(summary.effort), 'utf8'),
        categories: summary.effort.length,
        timelineRows: summary.timeline.length,
        timingsMs,
        minMs: sorted[0], medianMs: (sorted[4] + sorted[5]) / 2, maxMs: sorted[9],
        effortQueryPlan: db.prepare('EXPLAIN QUERY PLAN ' + effortSql).all(where.params),
        firstCategory: summary.effort[0], lastCategory: summary.effort.at(-1),
      },
    };
  };
  const repeated = measure();
  db.prepare("UPDATE usage_event SET effort = printf('category-%05d',id)").run();
  const distinct = measure();
  assert.deepEqual(distinct.result.totals, repeated.result.totals);
  assert.deepEqual(distinct.result.timeline, repeated.result.timeline);
  assert.equal(distinct.result.bucketMs, repeated.result.bucketMs);
  assert.equal(invariantBefore, sha(JSON.stringify(db.prepare(invariantSql).all())));
  assert.equal(repeated.evidence.categories, 1);
  assert.equal(distinct.evidence.categories, 5000);
  const frozenAfter = Object.fromEntries(frozenPaths.map(path => [path, treeHash(path)]));
  assert.deepEqual(frozenAfter, frozenBefore, 'Frozen application source/dist changed during the measurement');
  const evidence = {
    status: 'passed', method: 'Direct historySummary on one in-memory synthetic database, no server/browser/network',
    fixture: { records: 5000, scope, changedOnly: 'usage_event.effort', repeated: 'same', distinct: 'category-00001..category-05000' },
    assertions: ['all event fields except effort unchanged', 'totals deeply equal', 'timeline deeply equal', 'bucketMs equal', 'effort records/calls reconcile', 'source/dist tree hashes unchanged'],
    repeated: repeated.evidence, distinct: distinct.evidence,
    payloadGrowthRatio: distinct.evidence.summaryUtf8Bytes / repeated.evidence.summaryUtf8Bytes,
    unchangedEventFieldsSha256: invariantBefore, frozenBefore, frozenAfter,
    limitations: ['single-process local in-memory SQLite', 'timings describe the full historySummary function; no browser CPU/render/DOM measurement', 'repeated measured first, distinct second; no timing regression conclusion from ordering', 'categories are deliberately synthetic valid source strings, not a production distribution claim'],
  };
  writeFileSync(output, JSON.stringify(evidence, null, 2) + '\n');
  console.log(JSON.stringify(evidence, null, 2));
} finally { db.close(); }
