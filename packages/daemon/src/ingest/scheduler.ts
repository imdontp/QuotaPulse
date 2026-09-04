import { watch, type FSWatcher, existsSync } from 'node:fs';
import { EventEmitter } from 'node:events';
import type { DB } from '../db/index.js';
import type { Adapter } from '../adapters/types.js';
import { resolveSources, runPass, type ResolvedSource, type RunResult } from './runner.js';
import { logger } from '../util/log.js';

const log = logger('scheduler');

export interface SchedulerOptions {
  /** Coalesce a burst of file events into one pass. */
  debounceMs?: number;
  /** Safety net for anything fs.watch misses (SQLite writes, network drives). */
  pollMs?: number;
  /** How often to look for harnesses that were installed after startup. */
  detectMs?: number;
}

export interface PassEvent {
  results: RunResult[];
  newEvents: number;
  newLimits: number;
  durationMs: number;
  trigger: 'watch' | 'poll' | 'initial';
}

/**
 * Drives ingest. Two triggers on purpose: fs.watch gives sub-second reaction to a
 * transcript being appended, and a slower poll covers the sources fs.watch cannot see
 * usefully -- SQLite writes land in a -wal sidecar whose events are unreliable.
 */
export class Scheduler extends EventEmitter {
  private watchers: FSWatcher[] = [];
  private timer: NodeJS.Timeout | null = null;
  private pollTimer: NodeJS.Timeout | null = null;
  private detectTimer: NodeJS.Timeout | null = null;
  private running = false;
  private queued: 'watch' | 'poll' | null = null;
  private sources: ResolvedSource[] = [];
  private lastPass: PassEvent | null = null;

  constructor(
    private db: DB,
    private adapters: Adapter[],
    private opts: SchedulerOptions = {},
  ) {
    super();
  }

  get status() {
    return {
      sources: this.sources.map((s) => ({
        harness: s.adapter.id,
        profile: s.profile.profile,
        sourceId: s.sourceId,
        displayName: s.profile.displayName,
        rootPath: s.profile.rootPath,
      })),
      lastPass: this.lastPass,
      running: this.running,
    };
  }

  async start(): Promise<PassEvent> {
    this.sources = await resolveSources(this.db, this.adapters);

    const first = await this.pass('initial');
    this.attachWatchers();

    const pollMs = this.opts.pollMs ?? 5000;
    this.pollTimer = setInterval(() => void this.trigger('poll'), pollMs);
    this.pollTimer.unref?.();

    /*
     * Harnesses get installed, and profiles get added, while this is running. Detection
     * used to happen once at startup, so a newly used tool stayed invisible -- and
     * unwatched -- until someone restarted the daemon. Re-detect on a slow cadence
     * instead: detect() touches the filesystem for every adapter, which is cheap but
     * not free enough to do on the 5s ingest tick.
     */
    const detectMs = this.opts.detectMs ?? 60_000;
    this.detectTimer = setInterval(() => void this.redetect(), detectMs);
    this.detectTimer.unref?.();

    log.info(
      `watching ${this.watchers.length} paths; polling every ${pollMs}ms; ` +
        `re-detecting harnesses every ${detectMs / 1000}s`,
    );
    return first;
  }

  /** Pick up harnesses that appeared since startup, and start watching their files. */
  private async redetect(): Promise<void> {
    let found: ResolvedSource[];
    try {
      found = await resolveSources(this.db, this.adapters);
    } catch (err) {
      log.debug('re-detect failed', (err as Error).message);
      return;
    }

    const known = new Set(this.sources.map((s) => `${s.adapter.id}/${s.profile.profile}`));
    const added = found.filter((s) => !known.has(`${s.adapter.id}/${s.profile.profile}`));
    if (added.length === 0) {
      this.sources = found; // paths can move even when the set is unchanged
      return;
    }

    this.sources = found;
    for (const s of added) {
      log.info(`new harness detected: ${s.adapter.id}/${s.profile.profile} -> ${s.profile.rootPath}`);
      this.watchSource(s);
    }
    // Ingest immediately so it shows up now rather than on the next tick.
    void this.trigger('watch');
  }

  private attachWatchers() {
    for (const s of this.sources) this.watchSource(s);
  }

  private watchSource({ adapter, profile }: ResolvedSource) {
    let targets;
    try {
      targets = adapter.watchTargets(profile);
    } catch {
      return;
    }
    for (const t of targets) {
      if (!existsSync(t.path)) continue;
      try {
        const w = watch(t.path, { recursive: t.kind === 'dir' && t.recursive !== false }, () => {
          void this.trigger('watch');
        });
        w.on('error', (err) => log.debug(`watcher error on ${t.path}`, err.message));
        this.watchers.push(w);
      } catch (err) {
        log.debug(`cannot watch ${t.path}`, (err as Error).message);
      }
    }
  }

  private trigger(kind: 'watch' | 'poll') {
    if (this.timer) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.pass(kind);
    }, this.opts.debounceMs ?? 500);
    this.timer.unref?.();
  }

  /** Only one pass at a time; a request arriving mid-pass is collapsed into one rerun. */
  private async pass(trigger: PassEvent['trigger']): Promise<PassEvent> {
    if (this.running) {
      this.queued = trigger === 'initial' ? 'watch' : trigger;
      return this.lastPass ?? { results: [], newEvents: 0, newLimits: 0, durationMs: 0, trigger };
    }
    this.running = true;
    const started = Date.now();
    let results: RunResult[] = [];
    try {
      results = await runPass(this.db, this.sources, { backfill: trigger === 'initial' });
    } catch (err) {
      log.error('pass failed', (err as Error).message);
    } finally {
      this.running = false;
    }

    const newEvents = results.reduce((a, r) => a + r.stats.usageInserted, 0);
    const newLimits = results.reduce((a, r) => a + r.stats.limitsInserted, 0);
    const evt: PassEvent = {
      results,
      newEvents,
      newLimits,
      durationMs: Date.now() - started,
      trigger,
    };
    this.lastPass = evt;

    /*
     * An event with no model cannot be priced, grouped or attributed to a vendor, and it
     * is always an adapter defect rather than a gap in the price catalog -- so it is
     * worth a warning naming the source, not a number folded into the pass line. Codex
     * wrote 59 of these in a day without a single log entry.
     */
    for (const r of results) {
      if (r.stats.modelless > 0) {
        log.warn(
          `${r.adapterId}/${r.profile}: ${r.stats.modelless} events had no model and cannot be priced`,
        );
      }
    }

    if (newEvents > 0 || newLimits > 0 || trigger === 'initial') {
      log.info(`pass(${trigger}): +${newEvents} events, +${newLimits} limits in ${evt.durationMs}ms`);
      this.emit('data', evt);
    }

    if (this.queued) {
      const q = this.queued;
      this.queued = null;
      setTimeout(() => void this.pass(q), 50);
    }
    return evt;
  }

  stop() {
    for (const w of this.watchers) {
      try {
        w.close();
      } catch {
        /* already closed */
      }
    }
    this.watchers = [];
    if (this.timer) clearTimeout(this.timer);
    if (this.pollTimer) clearInterval(this.pollTimer);
    if (this.detectTimer) clearInterval(this.detectTimer);
  }
}
