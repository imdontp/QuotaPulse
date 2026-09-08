import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  COALESCE_MS,
  FALLBACK_MS,
  RefreshController,
  type RefreshContext,
  type RefreshHandler,
  type StreamState,
} from '../src/lib/use-live.ts';

type Timer = { at: number; callback: () => void };

class FakeRuntime {
  nowValue = 0;
  visible = true;
  private nextTimer = 1;
  private readonly timers = new Map<number, Timer>();
  private readonly visibility = new Set<() => void>();
  private readonly online = new Set<() => void>();

  now = () => this.nowValue;
  isVisible = () => this.visible;

  onVisibility = (listener: () => void) => {
    this.visibility.add(listener);
    return () => this.visibility.delete(listener);
  };

  onOnline = (listener: () => void) => {
    this.online.add(listener);
    return () => this.online.delete(listener);
  };

  setTimeout = (callback: () => void, ms: number) => {
    const id = this.nextTimer++;
    this.timers.set(id, { at: this.nowValue + ms, callback });
    return id;
  };

  clearTimeout = (timer: ReturnType<typeof setTimeout>) => {
    this.timers.delete(Number(timer));
  };

  advance(ms: number): void {
    this.nowValue += ms;
    while (true) {
      const due = [...this.timers.entries()]
        .filter(([, timer]) => timer.at <= this.nowValue)
        .sort((a, b) => a[1].at - b[1].at)[0];
      if (!due) return;
      this.timers.delete(due[0]);
      due[1].callback();
    }
  }

  setVisible(visible: boolean): void {
    this.visible = visible;
    for (const listener of [...this.visibility]) listener();
  }

  emitOnline(): void {
    for (const listener of [...this.online]) listener();
  }
}

function setup(handler: RefreshHandler, runtime = new FakeRuntime()) {
  let data: (() => void) | null = null;
  let stream: ((state: StreamState) => void) | null = null;
  const controller = new RefreshController({
    runtime,
    subscribeData: (listener) => {
      data = listener;
      return () => {
        data = null;
      };
    },
    subscribeStream: (listener) => {
      stream = listener;
      listener('connected');
      return () => {
        stream = null;
      };
    },
  });
  const handle = controller.register({ current: handler });
  return {
    controller,
    handle,
    runtime,
    emitData: () => data?.(),
    emitStream: (state: StreamState) => stream?.(state),
  };
}

async function flush(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

test('one stream fans out and coalesces SSE bursts, then falls back after 30 seconds', async () => {
  const contexts: RefreshContext[] = [];
  const state = setup(async (ctx) => {
    contexts.push(ctx);
  });

  await state.handle.run({ live: false, reason: 'initial' });
  state.emitData();
  state.emitData();
  state.runtime.advance(COALESCE_MS - 1);
  await flush();
  assert.equal(contexts.length, 1);

  state.runtime.advance(1);
  await flush();
  assert.equal(contexts.length, 2);
  assert.equal(contexts[1]!.reason, 'sse');
  assert.equal(contexts[1]!.live, true);

  state.runtime.advance(FALLBACK_MS);
  await flush();
  assert.equal(contexts.length, 3);
  assert.equal(contexts[2]!.reason, 'fallback');
  state.handle.off();
});

test('hidden pages pause fallback and visible/online events refresh immediately', async () => {
  const contexts: RefreshContext[] = [];
  const state = setup(async (ctx) => {
    contexts.push(ctx);
  });

  await state.handle.run({ live: false, reason: 'initial' });
  state.runtime.setVisible(false);
  state.runtime.advance(FALLBACK_MS * 2);
  await flush();
  assert.equal(contexts.length, 1);

  state.runtime.setVisible(true);
  await flush();
  assert.equal(contexts.at(-1)!.reason, 'visible');

  state.runtime.setVisible(false);
  state.runtime.emitOnline();
  await flush();
  assert.equal(contexts.length, 2);
  state.runtime.setVisible(true);
  state.handle.off();
});

test('a refresh arriving during a request queues exactly one follow-up', async () => {
  const contexts: RefreshContext[] = [];
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const state = setup(async (ctx) => {
    contexts.push(ctx);
    if (contexts.length === 1) await gate;
  });

  const first = state.handle.run({ live: false, reason: 'initial' });
  state.emitData();
  state.runtime.advance(COALESCE_MS);
  await flush();
  assert.equal(contexts.length, 1);

  release();
  await first;
  await flush();
  assert.equal(contexts.length, 2);
  assert.equal(contexts[1]!.reason, 'sse');
  state.handle.off();
});

test('stream errors and handler failures are visible, then clear on recovery', async () => {
  let fail = false;
  const state = setup(async () => {
    if (fail) throw new Error('daemon down');
  });

  await state.handle.run({ live: false, reason: 'initial' });
  assert.equal(state.controller.snapshot().state, 'live');
  state.emitStream('reconnecting');
  assert.equal(state.controller.snapshot().state, 'reconnecting');

  fail = true;
  state.emitData();
  state.runtime.advance(COALESCE_MS);
  await flush();
  assert.equal(state.controller.snapshot().state, 'unavailable');
  fail = false;
  state.emitStream('connected');
  state.emitData();
  state.runtime.advance(COALESCE_MS);
  await flush();
  assert.equal(state.controller.snapshot().state, 'live');
  assert.notEqual(state.controller.snapshot().lastSuccessAt, null);
  state.handle.off();
});

test('manual refresh runs the daemon endpoint before dashboard handlers', async () => {
  const originalFetch = globalThis.fetch;
  const calls: Array<{ method: string; url: string }> = [];
  globalThis.fetch = (async (input, init) => {
    calls.push({ method: init?.method ?? 'GET', url: String(input) });
    return new Response(
      JSON.stringify({
        now: 123,
        pass: { newEvents: 1, newLimits: 0, durationMs: 2, failedSources: 0, trigger: 'manual' },
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    );
  }) as typeof fetch;

  try {
    const contexts: RefreshContext[] = [];
    const state = setup(async (ctx) => {
      contexts.push(ctx);
    });
    const outcome = await state.controller.refreshNow();
    assert.equal(outcome.ingest?.pass.newEvents, 1);
    assert.equal(outcome.query.ok, true);
    assert.equal(contexts.at(-1)!.reason, 'manual');
    assert.deepEqual(calls, [{ method: 'POST', url: '/api/refresh' }]);
    state.handle.off();
  } finally {
    globalThis.fetch = originalFetch;
  }
});
