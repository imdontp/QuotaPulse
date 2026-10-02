import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { once } from 'node:events';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { test } from 'node:test';
import Database from 'better-sqlite3';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const entry = resolve(root, 'scripts/task-entry.cjs');
const base = resolve(root, 'tmp/task-entry-tests');
mkdirSync(base, { recursive: true });

test('direct task entry rejects invalid configuration before creating an instance database', () => {
  for (const args of [['--role', 'unknown', '--port', '7805'], ['--role', 'daemon', '--port', '0'], ['--role', 'daemon', '--port', '7805', '--data-dir', 'relative'], ['--role', 'daemon', '--port', '7805', '--node-exe', 'relative'], ['--role', 'daemon', '--port', '7805', '--unknown-application-option']]) {
    const data = mkdtempSync(resolve(base, 'invalid-'));
    const child = spawnSync(process.execPath, [entry, ...args], { env: { ...process.env, QUOTAPULSE_DATA_DIR: data, QUOTAPULSE_READERS: 'off' }, encoding: 'utf8' });
    assert.notEqual(child.status, 0);
    assert.equal(existsSync(resolve(data, 'usage.db')), false);
  }
  const data = mkdtempSync(resolve(base, 'mode-'));
  const child = spawnSync(process.execPath, [entry, '--role', 'daemon', '--port', '7805', '--data-dir', data], { env: { ...process.env, QUOTAPULSE_READERS: 'invalid' }, encoding: 'utf8' });
  assert.notEqual(child.status, 0);
  assert.match(child.stderr, /QUOTAPULSE_READERS must be on or off/);
  assert.equal(existsSync(resolve(data, 'usage.db')), false);
});

test('compiled daemon with readers off starts isolated and preserves zero ingest/prices', async () => {
  const data = mkdtempSync(resolve(base, 'isolated-'));
  writeFileSync(resolve(data, 'models.dev.json'), JSON.stringify({ synthetic: { models: { 'must-not-import': { cost: { input: 1, output: 1 } } } } }));
  const reservation = createServer();
  reservation.listen(0, '127.0.0.1'); await once(reservation, 'listening');
  const port = (reservation.address() as { port: number }).port;
  await new Promise<void>((done, fail) => reservation.close(error => error ? fail(error) : done()));
  const child = spawn(process.execPath, [entry, '--role', 'daemon', '--port', String(port), '--data-dir', data, '--no-readers'], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = ''; child.stdout.on('data', chunk => { log += chunk; }); child.stderr.on('data', chunk => { log += chunk; });
  const lockPath = resolve(data, 'daemon.lock');
  try {
    const deadline = Date.now() + 30000;
    while (!existsSync(lockPath) && Date.now() < deadline && child.exitCode === null) await delay(100);
    assert.ok(existsSync(lockPath), log);
    const lock = JSON.parse(readFileSync(lockPath, 'utf8'));
    assert.equal(lock.pid, child.pid); assert.equal(lock.port, port);
    const response = await fetch(`http://127.0.0.1:${port}/api/health`, { headers: { 'x-quotapulse-token': lock.token } });
    assert.equal(response.status, 200);
    const health = await response.json() as any;
    assert.equal(health.ok, true); assert.deepEqual(health.scheduler.sources, []);
    const duplicate = spawnSync(process.execPath, [entry, '--role', 'daemon', '--port', String(port), '--data-dir', data, '--no-readers'], { encoding: 'utf8', timeout: 30000 });
    assert.equal(duplicate.status, 1);
    assert.match(duplicate.stderr, /already running as pid/);
    assert.equal(JSON.parse(readFileSync(lockPath, 'utf8')).pid, child.pid);
    const db = new Database(resolve(data, 'usage.db'), { readonly: true });
    try {
      for (const table of ['source', 'usage_event', 'limit_sample', 'price']) assert.equal((db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n, 0, table);
    } finally { db.close(); }
    assert.match(log, /readers disabled/);
    assert.match(log, /watching 0 paths/);
  } finally {
    if (child.exitCode === null) { const stopped = once(child, 'exit'); child.kill(); await stopped; }
  }
});

test('occupied loopback port fails without claiming a daemon lock or stopping its owner', async () => {
  const data = mkdtempSync(resolve(base, 'occupied-'));
  const reservation = createServer();
  reservation.listen(0, '127.0.0.1'); await once(reservation, 'listening');
  const port = (reservation.address() as { port: number }).port;
  try {
    const child = spawnSync(process.execPath, [entry, '--role', 'daemon', '--port', String(port), '--data-dir', data, '--no-readers'], { encoding: 'utf8', timeout: 30000 });
    assert.equal(child.status, 1);
    assert.match(child.stderr, /EADDRINUSE/);
    assert.equal(existsSync(resolve(data, 'daemon.lock')), false);
    assert.equal(reservation.listening, true);
  } finally { await new Promise<void>((done, fail) => reservation.close(error => error ? fail(error) : done())); }
});
