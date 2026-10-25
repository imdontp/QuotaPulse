import assert from 'node:assert/strict';
import { once } from 'node:events';
import { request, type ClientRequest, type IncomingMessage, type ServerResponse } from 'node:http';
import { setImmediate as turn } from 'node:timers/promises';
import { test } from 'node:test';
import { openDb } from '../src/db/index.js';
import { buildServer } from '../src/api/server.js';
import { Scheduler } from '../src/ingest/scheduler.js';

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(done => { resolve = done; });
  return { promise, resolve };
}

async function fixture() {
  const db = openDb(':memory:'), scheduler = new Scheduler(db, []);
  const app = buildServer(db, scheduler, { token: 'sse-lifetime-test', port: 0 });
  const replies: ServerResponse[] = [], clients: ClientRequest[] = [];
  let gate: { entered: ReturnType<typeof deferred>; release: ReturnType<typeof deferred> } | undefined;
  app.addHook('preHandler', async (req, reply) => {
    if (!req.url.startsWith('/api/events/stream')) return;
    replies.push(reply.raw);
    if (gate) { const held = gate; held.entered.resolve(); await held.release.promise; }
  });
  await app.listen({ host: '127.0.0.1', port: 0 });
  const address = app.server.address();
  assert.ok(address && typeof address === 'object');
  function connect() {
    const client = request({ host: '127.0.0.1', port: address.port, path: '/api/events/stream', headers: { 'x-quotapulse-token': 'sse-lifetime-test' } });
    client.on('error', () => {}); // Expected when the test deliberately aborts.
    clients.push(client); client.end(); return client;
  }
  async function cleanup() {
    gate?.release.resolve();
    for (const client of clients) client.destroy();
    await turn();
    // Only cleanup: older implementations attach close after it already fired.
    // Assertions below inspect real close/abort counts before this replay.
    for (const response of replies) response.emit('close');
    await app.close(); db.close();
  }
  return { app, scheduler, replies, connect, cleanup, hold() { gate = { entered: deferred(), release: deferred() }; return gate; } };
}

async function stream(client: ClientRequest) {
  const [response] = await once(client, 'response') as [IncomingMessage];
  let body = '';
  response.on('data', bytes => { body += bytes.toString(); });
  async function includes(text: string) {
    while (!body.includes(text)) await once(response, 'data');
  }
  await includes('event: hello');
  return { response, includes, body: () => body };
}

test('SSE abort before handler execution never leaves listeners on a closed response', { timeout: 10000 }, async t => {
  const f = await fixture(); t.after(f.cleanup);
  for (let cycle = 0; cycle < 12; cycle++) {
    const gate = f.hold(), client = f.connect();
    await gate.entered.promise;
    const response = f.replies.at(-1)!, closed = once(response, 'close');
    client.destroy(); await closed;
    assert.equal(response.destroyed, true);
    gate.release.resolve(); await turn(); await turn();
    assert.equal(f.scheduler.listenerCount('data'), 0, `abort cycle${cycle}: data listener leaked`);
    assert.equal(f.scheduler.listenerCount('settings'), 0, `abort cycle${cycle}: settings listener leaked`);
  }
});

test('live SSE delivers hello/data and unsubscribes both channels on actual disconnect', { timeout: 10000 }, async t => {
  const f = await fixture(); t.after(f.cleanup);
  const client = f.connect(), active = await stream(client);
  assert.match(active.response.headers['content-type']!, /text\/event-stream/);
  assert.match(active.body(), /retry: 3000/);
  assert.equal(f.scheduler.listenerCount('data'), 1);
  assert.equal(f.scheduler.listenerCount('settings'), 1);
  f.scheduler.emit('data', { newEvents: 3, newLimits: 2, trigger: 'owned-test' });
  await active.includes('event: data');
  assert.match(active.body(), /"newEvents":3/);
  assert.match(active.body(), /"newLimits":2/);
  const closed = once(f.replies[0]!, 'close');
  client.destroy(); await closed;
  assert.equal(f.scheduler.listenerCount('data'), 0);
  assert.equal(f.scheduler.listenerCount('settings'), 0);
});

test('daemon shutdown ends a live SSE response and removes both subscriptions', { timeout: 10000 }, async t => {
  const f = await fixture(); t.after(f.cleanup);
  const active = await stream(f.connect());
  const responseEnded = once(active.response, 'end'), serverClosed = once(f.replies[0]!, 'close');
  await f.app.close(); await responseEnded; await serverClosed;
  assert.equal(f.scheduler.listenerCount('data'), 0);
  assert.equal(f.scheduler.listenerCount('settings'), 0);
});
