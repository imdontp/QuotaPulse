import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';

import { buildServer } from '../src/api/server.js';
import { openDb, type DB } from '../src/db/index.js';
import { startOfLocalMonth, startOfLocalWeek } from '../src/api/usage-period.js';
import { Scheduler } from '../src/ingest/scheduler.js';
import { tmpRoot } from './fixtures.js';

function seed(db: DB, now: number): void {
  db.prepare(`INSERT INTO source (harness, profile, root_path, display_name, detected_at)
    VALUES ('codex', 'default', '/fake/codex', 'Codex', ?)`).run(now);
  const sourceId = Number((db.prepare('SELECT id FROM source LIMIT 1').get() as { id: number }).id);
  db.prepare(`INSERT INTO usage_event (
    source_id, dedup_key, ts, model, provider, call_count, input_tokens, output_tokens, total_tokens
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(sourceId, 'usage-1', now - 10_000, 'gpt-usage', 'openai', 2, 10, 20, 30);
}

test('usage period uses local calendar boundaries and Monday weeks', () => {
  const now = Date.now();
  const week = startOfLocalWeek(now);
  const month = startOfLocalMonth(now);
  assert.equal(new Date(week).getDay(), 1);
  const monthDate = new Date(month);
  assert.equal(monthDate.getDate(), 1);
  assert.equal(monthDate.getHours(), 0);
});

test('usage endpoint returns normalized range, calendar timeline, and source totals', async () => {
  const dir = tmpRoot();
  const db = openDb(join(dir, 'usage-api.db'));
  const now = Date.now();
  seed(db, now);
  const scheduler = new Scheduler(db, [], { pollMs: 1_000_000, detectMs: 1_000_000 });
  const app = buildServer(db, scheduler, { port: 0, token: 'usage-token', webRoot: dir });
  try {
    const response = await app.inject({
      url: '/api/usage?range=custom&from=0&to=' + now + '&bucket=month',
      headers: { 'x-quotapulse-token': 'usage-token' },
    });
    assert.equal(response.statusCode, 200);
    const body = response.json() as {
      range: { range: string; from: number; to: number; bucket: string; timezone: string };
      totals: { calls: number; total_tokens: number };
      timeline: Array<{ bucket_ts: number; series: string }>;
      bySource: Array<{ display_name: string; calls: number }>;
    };
    assert.deepEqual(body.range, {
      range: 'custom',
      from: 0,
      to: now,
      bucket: 'month',
      timezone: body.range.timezone,
    });
    assert.equal(typeof body.range.timezone, 'string');
    assert.equal(body.totals.calls, 2);
    assert.equal(body.totals.total_tokens, 30);
    assert.equal(body.timeline.length, 1);
    assert.equal(body.timeline[0]!.series, 'all');
    assert.equal(body.bySource[0]!.display_name, 'Codex');
    assert.equal(body.bySource[0]!.calls, 2);

    const weekResponse = await app.inject({
      url: '/api/usage?range=week',
      headers: { 'x-quotapulse-token': 'usage-token' },
    });
    assert.equal(weekResponse.statusCode, 200);
    const weekBody = weekResponse.json() as {
      range: { range: string; from: number; bucket: string };
      timeline: Array<{ bucket_ts: number; series: string }>;
    };
    assert.equal(weekBody.range.range, 'week');
    assert.equal(weekBody.range.from, startOfLocalWeek(now));
    assert.equal(weekBody.range.bucket, 'day');
    assert.equal(weekBody.timeline[0]!.series, 'all');
    const eventDate = new Date(now - 10_000);
    const eventDay = new Date(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate()).getTime();
    assert.equal(weekBody.timeline[0]!.bucket_ts, eventDay);

    const invalid = await app.inject({
      url: '/api/usage?range=custom&from=20&to=10',
      headers: { 'x-quotapulse-token': 'usage-token' },
    });
    assert.equal(invalid.statusCode, 400);
  } finally {
    await app.close();
    db.close();
  }
});
