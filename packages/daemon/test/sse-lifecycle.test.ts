import assert from 'node:assert/strict';
import { get, type IncomingMessage } from 'node:http';
import { setTimeout as delay } from 'node:timers/promises';
import { test } from 'node:test';
import { openDb } from '../src/db/index.js';
import { buildServer } from '../src/api/server.js';
import { Scheduler } from '../src/ingest/scheduler.js';

test('SSE releases listeners on disconnect and closes an active stream during shutdown', { timeout: 5000 }, async () => {
  const db = openDb(':memory:');
  const scheduler = new Scheduler(db, []);
  const app = buildServer(db, scheduler, { token: 'sse-test', port: 0 });
  const address = await app.listen({ host: '127.0.0.1', port: 0 });
  const streams: IncomingMessage[] = [];
  const connect = () => new Promise<IncomingMessage>((resolve, reject) => {
    const request = get(`${address}/api/events/stream?token=sse-test`, { agent: false }, response => {
      response.once('data', chunk => {
        assert.match(String(chunk), /event: hello/);
        streams.push(response);
        resolve(response);
      });
    });
    request.on('error', reject);
  });
  try {
    const first = await connect();
    assert.equal(scheduler.listenerCount('data'), 1);
    first.destroy();
    for (let i = 0; i < 50 && scheduler.listenerCount('data'); i++) await delay(10);
    assert.equal(scheduler.listenerCount('data'), 0);
    assert.equal(scheduler.listenerCount('settings'), 0);
    const second = await connect();
    const ended = new Promise<void>(resolve => second.once('end', resolve));
    second.resume();
    await app.close();
    await ended;
    assert.equal(scheduler.listenerCount('data'), 0);
    assert.equal(scheduler.listenerCount('settings'), 0);
  } finally {
    for (const stream of streams) stream.destroy();
    await app.close();
    db.close();
  }
});
