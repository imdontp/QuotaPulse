import assert from 'node:assert/strict';
import { once } from 'node:events';
import { request, type ClientRequest, type IncomingMessage, type ServerResponse } from 'node:http';
import { setTimeout as delay, setImmediate as turn } from 'node:timers/promises';
import { test } from 'node:test';
import { createServer, type ProxyOptions } from 'vite';
import config from '../vite.config.js';
import { openDb } from '../../daemon/src/db/index.js';
import { buildServer } from '../../daemon/src/api/server.js';
import { Scheduler } from '../../daemon/src/ingest/scheduler.js';

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(done => { resolve = done; });
  return { promise, resolve };
}
async function bounded<T>(promise: Promise<T>): Promise<T> {
  return Promise.race([promise, delay(3000, undefined, { ref: false }).then(() => { throw Error('Proxy lifecycle event did not arrive'); })]);
}
async function fixture() {
  const db = openDb(':memory:'), scheduler = new Scheduler(db, []);
  const daemon = buildServer(db, scheduler, { token: 'owned-proxy-regression', port: 0 });
  const replies: ServerResponse[] = [], clients: ClientRequest[] = [];
  let gate: { entered: ReturnType<typeof deferred>; release: ReturnType<typeof deferred> } | undefined;
  daemon.addHook('preHandler', async (req, reply) => {
    if (!req.url.startsWith('/api/events/stream')) return;
    replies.push(reply.raw);
    if (gate) { const held = gate; held.entered.resolve(); await held.release.promise; }
  });
  await daemon.listen({ host: '127.0.0.1', port: 0 });
  const address = daemon.server.address();
  assert.ok(address && typeof address === 'object');
  // Exercise the shipped dev configuration, overriding only its owned target.
  const shipped = config.server!.proxy!['/api'] as ProxyOptions;
  const vite = await createServer({ configFile: false, optimizeDeps: { noDiscovery: true, entries: [] }, server: {
    host: '127.0.0.1', port: 0, watch: null,
    proxy: { '/api': { ...shipped, target: `http://127.0.0.1:${address.port}` } },
  } });
  await vite.listen();
  const proxyAddress = vite.httpServer!.address();
  assert.ok(proxyAddress && typeof proxyAddress === 'object');
  function connect(path = '/api/events/stream') {
    const client = request({ host: '127.0.0.1', port: proxyAddress.port, path, headers: { 'x-quotapulse-token': 'owned-proxy-regression' } });
    client.on('error', () => {});
    clients.push(client); client.end(); return client;
  }
  return { scheduler, replies, vite, connect,
    hold() { gate = { entered: deferred(), release: deferred() }; return gate; },
    async cleanup() {
      gate?.release.resolve();
      for (const client of clients) client.destroy();
      for (const reply of replies) reply.destroy();
      await turn(); await vite.close(); await daemon.close(); db.close();
    },
  };
}

test('shipped Vite proxy closes canceled SSE upstream before headers arrive', { timeout: 15000 }, async t => {
  const f = await fixture(); t.after(f.cleanup);
  for (let cycle = 0; cycle < 8; cycle++) {
    const gate = f.hold(), downstreamClosed = deferred();
    f.vite.httpServer!.once('request', (_req, res) => res.once('close', downstreamClosed.resolve));
    const client = f.connect('/api/events/stream?token=owned-proxy-regression');
    await bounded(gate.entered.promise);
    const upstream = f.replies.at(-1)!;
    client.destroy(); await bounded(downstreamClosed.promise);
    // Bound the separate proxy -> daemon socket teardown, without releasing headers.
    if (!upstream.destroyed) await bounded(once(upstream, 'close'));
    gate.release.resolve(); await turn(); await turn();
    assert.equal(upstream.destroyed, true, `cycle${cycle}: orphan upstream`);
    assert.equal(f.scheduler.listenerCount('data'), 0);
    assert.equal(f.scheduler.listenerCount('settings'), 0);
  }
});

test('shipped Vite proxy delivers a live stream and closes it after headers', { timeout: 15000 }, async t => {
  const f = await fixture(); t.after(f.cleanup);
  const client = f.connect(), [response] = await bounded(once(client, 'response')) as [IncomingMessage];
  let body = ''; response.on('data', chunk => { body += chunk.toString(); });
  while (!body.includes('event: hello')) await bounded(once(response, 'data'));
  assert.equal(f.scheduler.listenerCount('data'), 1);
  assert.equal(f.scheduler.listenerCount('settings'), 1);
  const health = f.connect('/api/health'), [healthResponse] = await bounded(once(health, 'response')) as [IncomingMessage];
  healthResponse.resume(); await bounded(once(healthResponse, 'end'));
  assert.equal(healthResponse.statusCode, 200);
  assert.equal(f.scheduler.listenerCount('data'), 1, 'an ordinary completed request must not end SSE');
  f.scheduler.emit('data', { newEvents: 1, newLimits: 0, trigger: 'owned-proxy-regression' });
  while (!body.includes('event: data')) await bounded(once(response, 'data'));
  const closed = once(f.replies[0]!, 'close'); client.destroy(); await bounded(closed);
  assert.equal(f.scheduler.listenerCount('data'), 0);
  assert.equal(f.scheduler.listenerCount('settings'), 0);
});
