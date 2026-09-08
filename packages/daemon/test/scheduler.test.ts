import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';

import { openDb, type DB } from '../src/db/index.js';
import { Scheduler } from '../src/ingest/scheduler.js';
import type { Adapter, Profile } from '../src/adapters/types.js';
import { tmpRoot } from './fixtures.js';

function db(): DB {
  return openDb(join(tmpRoot(), 'usage.db'));
}

const profile: Profile = {
  profile: 'default',
  rootPath: '/fake/default',
  displayName: 'Fake',
};

function fakeAdapter(ingest: () => Promise<void>): Adapter {
  return {
    id: 'fake',
    displayName: 'Fake',
    async detect() {
      return [profile];
    },
    watchTargets() {
      return [];
    },
    ingest,
  };
}

const schedulerOptions = { pollMs: 1_000_000, detectMs: 1_000_000 };

test('runNow performs an immediate incremental pass when idle', async () => {
  let passes = 0;
  const scheduler = new Scheduler(db(), [fakeAdapter(async () => void passes++)], schedulerOptions);
  await scheduler.start();
  const event = await scheduler.runNow();

  assert.equal(passes, 2, 'initial pass plus one manual pass');
  assert.equal(event.trigger, 'manual');
  scheduler.stop();
});

test('concurrent runNow callers share one queued follow-up pass', async () => {
  let passes = 0;
  let entered!: () => void;
  const enteredPromise = new Promise<void>((resolve) => {
    entered = resolve;
  });
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let block = false;
  const scheduler = new Scheduler(
    db(),
    [
      fakeAdapter(async () => {
        passes++;
        if (!block) return;
        block = false;
        entered();
        await gate;
      }),
    ],
    schedulerOptions,
  );
  await scheduler.start();

  block = true;
  const running = scheduler.runNow();
  await enteredPromise;

  const firstQueued = scheduler.runNow();
  const secondQueued = scheduler.runNow();
  release();
  await running;
  const [first, second] = await Promise.all([firstQueued, secondQueued]);

  assert.equal(passes, 3, 'the two requests must not start two concurrent adapter reads');
  assert.equal(first.trigger, 'manual');
  assert.equal(second, first, 'queued callers resolve with the same follow-up event');
  scheduler.stop();
});

test('a watcher event cannot overwrite a queued manual refresh', async () => {
  let passes = 0;
  let entered!: () => void;
  const enteredPromise = new Promise<void>((resolve) => {
    entered = resolve;
  });
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let block = false;
  const scheduler = new Scheduler(
    db(),
    [
      fakeAdapter(async () => {
        passes++;
        if (!block) return;
        block = false;
        entered();
        await gate;
      }),
    ],
    { ...schedulerOptions, debounceMs: 1 },
  );
  await scheduler.start();

  block = true;
  const running = scheduler.runNow();
  await enteredPromise;
  const queued = scheduler.runNow();
  (scheduler as unknown as { trigger(kind: 'watch'): void }).trigger('watch');
  await new Promise((resolve) => setTimeout(resolve, 10));
  release();

  await running;
  const followUp = await queued;
  assert.equal(followUp.trigger, 'manual');
  assert.equal(passes, 3, 'the watcher should only leave the one manual follow-up queued');
  scheduler.stop();
});

test('a queued manual waiter resolves only after a racing pass completes', async () => {
  let passes = 0;
  let enteredManual!: () => void;
  const manualEntered = new Promise<void>((resolve) => {
    enteredManual = resolve;
  });
  let releaseManual!: () => void;
  const manualGate = new Promise<void>((resolve) => {
    releaseManual = resolve;
  });
  let enteredWatcher!: () => void;
  const watcherEntered = new Promise<void>((resolve) => {
    enteredWatcher = resolve;
  });
  let releaseWatcher!: () => void;
  const watcherGate = new Promise<void>((resolve) => {
    releaseWatcher = resolve;
  });
  const scheduler = new Scheduler(
    db(),
    [
      fakeAdapter(async () => {
        passes++;
        if (passes === 2) {
          enteredManual();
          await manualGate;
        } else if (passes === 3) {
          enteredWatcher();
          await watcherGate;
        }
      }),
    ],
    { ...schedulerOptions, debounceMs: 1 },
  );
  await scheduler.start();

  const running = scheduler.runNow();
  await manualEntered;
  const queued = scheduler.runNow();
  releaseManual();
  await running;

  (scheduler as unknown as { trigger(kind: 'watch'): void }).trigger('watch');
  await watcherEntered;
  // Let the manual hand-off timer fire while the watcher pass is still running.
  await new Promise((resolve) => setTimeout(resolve, 60));
  releaseWatcher();

  const followUp = await queued;
  assert.equal(followUp.trigger, 'manual');
  assert.equal(passes, 4, 'the waiter must not resolve with the watcher pass');
  scheduler.stop();
});
