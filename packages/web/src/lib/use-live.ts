import {
  useEffect,
  useRef,
  useSyncExternalStore,
  type DependencyList,
  type MutableRefObject,
} from 'react';
import {
  ApiError,
  api,
  subscribe,
  subscribeStreamStatus,
  type ManualRefresh,
  type StreamState,
} from '@/api';

/** Keep a burst of daemon passes from making every section query independently. */
export const COALESCE_MS = 1_200;
/** Safety net for a missed SSE event while the page is visible. */
export const FALLBACK_MS = 30_000;

export type RefreshReason =
  | 'initial'
  | 'dependency'
  | 'sse'
  | 'fallback'
  | 'visible'
  | 'online'
  | 'manual';

export type RefreshConnectionState = 'connecting' | 'live' | 'reconnecting' | 'unavailable';

export interface RefreshContext {
  /** Background refreshes keep existing tables and charts on screen. */
  live: boolean;
  reason: RefreshReason;
}

export type RefreshHandler = (ctx: RefreshContext) => Promise<void> | void;

export interface RefreshStatus {
  state: RefreshConnectionState;
  refreshing: boolean;
  lastSuccessAt: number | null;
  lastError: string | null;
}

export interface RefreshOutcome {
  ok: boolean;
  error?: string;
}

export interface ManualRefreshOutcome {
  ingest: ManualRefresh | null;
  query: RefreshOutcome;
  error: string | null;
}

interface Runtime {
  now(): number;
  isVisible(): boolean;
  onVisibility(listener: () => void): () => void;
  onOnline(listener: () => void): () => void;
  setTimeout(listener: () => void, ms: number): ReturnType<typeof setTimeout>;
  clearTimeout(timer: ReturnType<typeof setTimeout>): void;
}

interface EntryJob {
  ctx: RefreshContext;
  resolve: () => void;
  reject: (error: unknown) => void;
}

interface Entry {
  ref: MutableRefObject<RefreshHandler>;
  jobs: EntryJob[];
  running: boolean;
  disposed: boolean;
}

interface BatchJob {
  reason: Exclude<RefreshReason, 'initial' | 'dependency'>;
  resolve: (outcome: RefreshOutcome) => void;
}

function browserRuntime(): Runtime {
  return {
    now: () => Date.now(),
    isVisible: () => typeof document === 'undefined' || document.visibilityState !== 'hidden',
    onVisibility: (listener) => {
      if (typeof document === 'undefined') return () => undefined;
      document.addEventListener('visibilitychange', listener);
      return () => document.removeEventListener('visibilitychange', listener);
    },
    onOnline: (listener) => {
      if (typeof window === 'undefined') return () => undefined;
      window.addEventListener('online', listener);
      return () => window.removeEventListener('online', listener);
    },
    setTimeout: (listener, ms) => setTimeout(listener, ms),
    clearTimeout: (timer) => clearTimeout(timer),
  };
}

function reasonPriority(reason: RefreshReason): number {
  switch (reason) {
    case 'manual':
      return 5;
    case 'visible':
    case 'online':
      return 4;
    case 'initial':
    case 'dependency':
      return 3;
    case 'sse':
      return 2;
    case 'fallback':
      return 1;
  }
}

function preferredReason(reasons: RefreshReason[]): RefreshReason {
  return reasons.reduce((best, reason) =>
    reasonPriority(reason) > reasonPriority(best) ? reason : best,
  );
}

function isBackground(reason: RefreshReason): boolean {
  return reason !== 'initial' && reason !== 'dependency';
}

/**
 * Owns the page-wide SSE stream, fallback timer and refresh queue. It is deliberately
 * independent from React so timer, visibility and concurrency behavior can be tested
 * with a fake runtime.
 */
export class RefreshController {
  private readonly runtime: Runtime;
  private readonly subscribeData: (listener: () => void) => () => void;
  private readonly subscribeStream: (listener: (state: StreamState) => void) => () => void;
  private readonly handlers = new Set<Entry>();
  private readonly statusListeners = new Set<() => void>();

  private stopData: (() => void) | null = null;
  private stopStream: (() => void) | null = null;
  private stopVisibility: (() => void) | null = null;
  private stopOnline: (() => void) | null = null;
  private sseTimer: ReturnType<typeof setTimeout> | null = null;
  private fallbackTimer: ReturnType<typeof setTimeout> | null = null;
  private streamState: StreamState = 'connecting';
  private pendingBatches: BatchJob[] = [];
  private drainingBatches = false;
  private started = false;
  private dirtyWhileHidden = false;
  private manualPromise: Promise<ManualRefreshOutcome> | null = null;
  private manualInProgress = false;
  private lastProbeAt = 0;
  private lastSuccessAt: number | null = null;
  private lastError: string | null = null;
  private snapshotValue: RefreshStatus = this.makeSnapshot();

  constructor(options: {
    runtime?: Runtime;
    subscribeData?: (listener: () => void) => () => void;
    subscribeStream?: (listener: (state: StreamState) => void) => () => void;
  } = {}) {
    this.runtime = options.runtime ?? browserRuntime();
    this.subscribeData = options.subscribeData ?? subscribe;
    this.subscribeStream = options.subscribeStream ?? subscribeStreamStatus;
  }

  register(ref: MutableRefObject<RefreshHandler>): {
    run: (ctx: RefreshContext) => Promise<void>;
    off: () => void;
  } {
    const entry: Entry = { ref, jobs: [], running: false, disposed: false };
    this.handlers.add(entry);
    if (!this.started) this.start();

    const run = (ctx: RefreshContext): Promise<void> => {
      const promise = this.enqueueEntry(entry, ctx);
      // Initial/dependency loads are not part of a broadcast batch, but they still
      // establish the last successful time and clear a transient error.
      promise.then(
        () => this.noteSuccess(),
        (error) => this.noteError(error),
      );
      return promise;
    };

    return {
      run,
      off: () => {
        if (entry.disposed) return;
        entry.disposed = true;
        this.handlers.delete(entry);
        const error = new Error('refresh subscriber disposed');
        for (const job of entry.jobs.splice(0)) job.reject(error);
        if (this.handlers.size === 0) this.stop();
      },
    };
  }

  subscribeStatus(listener: () => void): () => void {
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  }

  snapshot(): RefreshStatus {
    return this.snapshotValue;
  }

  /** Start an ingest pass, then refresh every currently mounted dashboard section. */
  refreshNow(): Promise<ManualRefreshOutcome> {
    if (this.manualPromise) return this.manualPromise;
    this.manualPromise = this.performManualRefresh();
    void this.manualPromise.finally(() => {
      this.manualPromise = null;
    });
    return this.manualPromise;
  }

  private start(): void {
    this.started = true;
    this.stopStream = this.subscribeStream((state) => this.onStreamState(state));
    this.stopData = this.subscribeData(() => this.onData());
    this.stopVisibility = this.runtime.onVisibility(() => this.onVisibility());
    this.stopOnline = this.runtime.onOnline(() => void this.request('online'));
    this.scheduleFallback();
    this.publish();
  }

  private stop(): void {
    this.started = false;
    this.stopData?.();
    this.stopStream?.();
    this.stopVisibility?.();
    this.stopOnline?.();
    this.stopData = null;
    this.stopStream = null;
    this.stopVisibility = null;
    this.stopOnline = null;
    this.clearTimers();
    this.dirtyWhileHidden = false;
    for (const job of this.pendingBatches.splice(0)) job.resolve({ ok: false, error: 'stopped' });
    this.streamState = 'connecting';
    this.lastError = null;
    this.publish();
  }

  private onStreamState(state: StreamState): void {
    this.streamState = state;
    this.publish();

    // EventSource reconnects itself. Probe the API at most once per fallback window
    // so a dead daemon is detected promptly without a reconnect storm.
    if (state === 'reconnecting' && this.runtime.isVisible()) {
      const now = this.runtime.now();
      if (now - this.lastProbeAt >= FALLBACK_MS) {
        this.lastProbeAt = now;
        void this.request('sse');
      }
    }
  }

  private onData(): void {
    this.clearFallbackTimer();
    if (!this.runtime.isVisible()) {
      this.dirtyWhileHidden = true;
      return;
    }
    if (this.manualInProgress) return;
    if (this.sseTimer) return;
    this.sseTimer = this.runtime.setTimeout(() => {
      this.sseTimer = null;
      void this.request('sse');
    }, COALESCE_MS);
  }

  private onVisibility(): void {
    if (!this.runtime.isVisible()) {
      this.clearFallbackTimer();
      return;
    }
    this.dirtyWhileHidden = false;
    void this.request('visible');
  }

  private request(reason: Exclude<RefreshReason, 'initial' | 'dependency'>): Promise<RefreshOutcome> {
    if (!this.started) return Promise.resolve({ ok: true });
    if (!this.runtime.isVisible() && reason !== 'manual') {
      this.dirtyWhileHidden = true;
      return Promise.resolve({ ok: true });
    }
    // A manual refresh owns the ingest/query sequence. Visibility, online and
    // fallback signals that happen while it is in flight are covered by that
    // query and must not start a duplicate batch.
    if (this.manualInProgress && reason !== 'manual') return Promise.resolve({ ok: true });

    this.clearFallbackTimer();
    return new Promise<RefreshOutcome>((resolve) => {
      this.pendingBatches.push({ reason, resolve });
      void this.drain();
    });
  }

  private async drain(): Promise<void> {
    if (this.drainingBatches) return;
    this.drainingBatches = true;
    try {
      while (this.pendingBatches.length > 0) {
        const jobs = this.pendingBatches.splice(0);
        const reason = preferredReason(jobs.map((job) => job.reason)) as Exclude<
          RefreshReason,
          'initial' | 'dependency'
        >;
        const entries = [...this.handlers];
        const results = await Promise.allSettled(
          entries.map((entry) =>
            this.enqueueEntry(entry, { live: isBackground(reason), reason }),
          ),
        );
        const failed = results.find((result): result is PromiseRejectedResult => result.status === 'rejected');
        const outcome: RefreshOutcome = failed
          ? { ok: false, error: String(failed.reason) }
          : { ok: true };
        if (outcome.ok) this.noteSuccess();
        else this.noteError(outcome.error);
        for (const job of jobs) job.resolve(outcome);
        this.scheduleFallback();
      }
    } finally {
      this.drainingBatches = false;
    }
  }

  private enqueueEntry(entry: Entry, ctx: RefreshContext): Promise<void> {
    if (entry.disposed) return Promise.reject(new Error('refresh subscriber disposed'));
    return new Promise<void>((resolve, reject) => {
      entry.jobs.push({ ctx, resolve, reject });
      void this.drainEntry(entry);
    });
  }

  private async drainEntry(entry: Entry): Promise<void> {
    if (entry.running || entry.disposed) return;
    entry.running = true;
    try {
      while (entry.jobs.length > 0 && !entry.disposed) {
        const jobs = entry.jobs.splice(0);
        const reason = preferredReason(jobs.map((job) => job.ctx.reason));
        const ctx: RefreshContext = { reason, live: isBackground(reason) };
        try {
          await entry.ref.current(ctx);
          for (const job of jobs) job.resolve();
        } catch (error) {
          for (const job of jobs) job.reject(error);
        }
      }
    } finally {
      entry.running = false;
    }
  }

  private scheduleFallback(): void {
    this.clearFallbackTimer();
    if (!this.started || !this.runtime.isVisible()) return;
    this.fallbackTimer = this.runtime.setTimeout(() => {
      this.fallbackTimer = null;
      void this.request('fallback');
    }, FALLBACK_MS);
  }

  private clearTimers(): void {
    if (this.sseTimer) this.runtime.clearTimeout(this.sseTimer);
    this.clearFallbackTimer();
    this.sseTimer = null;
  }

  private clearFallbackTimer(): void {
    if (!this.fallbackTimer) return;
    this.runtime.clearTimeout(this.fallbackTimer);
    this.fallbackTimer = null;
  }

  private async performManualRefresh(): Promise<ManualRefreshOutcome> {
    this.manualInProgress = true;
    this.clearFallbackTimer();
    if (this.sseTimer) {
      this.runtime.clearTimeout(this.sseTimer);
      this.sseTimer = null;
    }
    this.publish();

    let ingest: ManualRefresh | null = null;
    let error: string | null = null;
    try {
      ingest = await api.refresh();
    } catch (err) {
      error = String(err);
      this.maybeReload(err);
      this.noteError(err);
    }

    const query = await this.request('manual');
    // The SSE event emitted by this pass was intentionally folded into the manual
    // query above. It must not create a second request after the button settles.
    if (!query.ok && error == null) error = query.error ?? 'refresh query failed';
    if (error != null) this.noteError(error);

    this.manualInProgress = false;
    this.publish();
    return { ingest, query, error };
  }

  private maybeReload(error: unknown): void {
    if (!(error instanceof ApiError) || error.status !== 401 || typeof location === 'undefined') return;
    const key = 'quotapulse-token-reload-at';
    const now = this.runtime.now();
    try {
      const last = Number(sessionStorage.getItem(key) ?? 0);
      if (Number.isFinite(last) && now - last < 10_000) return;
      sessionStorage.setItem(key, String(now));
    } catch {
      /* A private window may block storage; a single reload is still safe. */
    }
    location.reload();
  }

  private noteSuccess(): void {
    this.lastSuccessAt = this.runtime.now();
    this.lastError = null;
    try {
      sessionStorage.removeItem('quotapulse-token-reload-at');
    } catch {
      /* convenience only */
    }
    this.publish();
  }

  private noteError(error: unknown): void {
    this.maybeReload(error);
    this.lastError = String(error);
    this.publish();
  }

  private makeSnapshot(): RefreshStatus {
    let state: RefreshConnectionState;
    if (this.lastError != null) state = 'unavailable';
    else if (this.streamState === 'connected') state = 'live';
    else if (this.streamState === 'reconnecting') state = 'reconnecting';
    else state = 'connecting';
    return {
      state,
      refreshing: this.manualInProgress,
      lastSuccessAt: this.lastSuccessAt,
      lastError: this.lastError,
    };
  }

  private publish(): void {
    const next = this.makeSnapshot();
    const prev = this.snapshotValue;
    if (
      prev.state === next.state &&
      prev.refreshing === next.refreshing &&
      prev.lastSuccessAt === next.lastSuccessAt &&
      prev.lastError === next.lastError
    ) {
      return;
    }
    this.snapshotValue = next;
    for (const listener of [...this.statusListeners]) listener();
  }
}

export const refreshController = new RefreshController();

/** Fetch on mount/dependency changes, then whenever the page-wide coordinator broadcasts. */
export function useLiveRefresh(fetch: RefreshHandler, deps: DependencyList): void {
  const fetchRef = useRef(fetch);
  fetchRef.current = fetch;
  const handleRef = useRef<ReturnType<RefreshController['register']> | null>(null);

  useEffect(() => {
    const handle = refreshController.register(fetchRef);
    handleRef.current = handle;
    void handle.run({ live: false, reason: 'initial' }).catch(() => undefined);
    return () => {
      handle.off();
      handleRef.current = null;
    };
  }, []);

  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    void handleRef.current?.run({ live: false, reason: 'dependency' }).catch(() => undefined);
    // The caller's dependency list is the contract; fetch is deliberately held in a ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

export function useRefreshStatus() {
  const snapshot = useSyncExternalStore(
    (listener) => refreshController.subscribeStatus(listener),
    () => refreshController.snapshot(),
    () => refreshController.snapshot(),
  );
  return {
    ...snapshot,
    refreshNow: () => refreshController.refreshNow(),
  };
}
