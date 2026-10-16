import type { UsageEventRow } from '../lib/usage-events';
import type { RefreshReason } from '../lib/use-live';

export type RuntimeObservation = Pick<UsageEventRow, 'event_id' | 'source_id' | 'timestamp_ms' | 'grain' | 'project' | 'harness' | 'provider' | 'model' | 'call_count' | 'total_tokens' | 'input_tokens' | 'output_tokens' | 'cached_input_tokens' | 'cache_write_tokens' | 'reasoning_tokens'>;
export interface MotionScope {
  /** Canonical route scope, excluding rolling wall-clock bounds for calendar periods. */
  key: string;
  /** undefined = all projects; null = exact unassigned metadata, not All projects. */
  project?: string | null;
  sourceId?: number;
}
export interface ReadyMotionGraph {
  batchSerial: number;
  contextKey: string;
  edges: readonly { column: number; from: string | null; to: string | null }[];
  harnesses: readonly (string | null)[];
}
export interface MotionEligibilitySnapshot {
  epoch: number;
  eligible: boolean;
  sinceWallMs: number;
}
/** Synchronous visibility provenance, shared by request start and presentation. */
export class RuntimeMotionEligibility {
  private value: MotionEligibilitySnapshot = { epoch: 0, eligible: false, sinceWallMs: Infinity };
  snapshot(): MotionEligibilitySnapshot { return { ...this.value }; }
  update(eligible: boolean, now: number): MotionEligibilitySnapshot {
    if (eligible !== this.value.eligible) this.value = { epoch: this.value.epoch + 1, eligible, sinceWallMs: eligible ? now : this.value.sinceWallMs };
    return this.snapshot();
  }
}
export interface MotionFrame {
  batchSerial: number;
  reason: RefreshReason;
  scope: MotionScope;
  now: number;
  activityWindowMs: number;
  visible: boolean;
  intersecting: boolean;
  reduced: boolean;
  rows: readonly RuntimeObservation[];
  graph?: ReadyMotionGraph;
  eligibility?: MotionEligibilitySnapshot;
  requestEligibility?: MotionEligibilitySnapshot;
}
export type MotionSignal =
  | { kind: 'edge'; eventId: number; sourceId: number; column: number; from: string; to: string; presentation: 'moving' | 'static'; durationMs: 700 }
  | { kind: 'node'; eventId: number; sourceId: number; dimension: 'harness'; key: string; presentation: 'static'; durationMs: 700 };

export const motionContextKey = (scope: MotionScope) => JSON.stringify([scope.key, scope.project === undefined ? ['all'] : ['exact', scope.project], scope.sourceId ?? null]);
const seedReasons = new Set<RefreshReason>(['initial', 'dependency', 'visible', 'online']);
const aggregateVersion = (r: RuntimeObservation) => JSON.stringify([r.timestamp_ms, r.call_count, r.total_tokens, r.input_tokens, r.output_tokens, r.cached_input_tokens, r.cache_write_tokens, r.reasoning_tokens]);
const validIdentity = (r: RuntimeObservation) => Number.isSafeInteger(r.event_id) && r.event_id > 0 && Number.isSafeInteger(r.source_id) && r.source_id > 0;
const isRecent = (row: RuntimeObservation, now: number, windowMs: number) => Number.isFinite(now) && Number.isFinite(row.timestamp_ms) && Number.isFinite(windowMs) && windowMs >= 0 && row.timestamp_ms <= now && now - row.timestamp_ms <= windowMs;
const inScope = (r: RuntimeObservation, scope: MotionScope) => (scope.sourceId === undefined || r.source_id === scope.sourceId) && (scope.project === undefined || r.project === scope.project);

/** Pure observation gate; no React/timers/API/schema. One bounded pending accepted batch. */
export class RuntimeMotionGate {
  private context: string | undefined;
  private lastSerial = -1;
  private resumeSeed = true;
  private eligibilityEpoch: number | undefined;
  private observations = new Map<string, { eventId: number; version: string; eligibilityEpoch?: number }>();
  private evictedIdFloor = 0;
  private pending?: { serial: number; rows: RuntimeObservation[] };
  constructor(private readonly limits = { observations: 512, pending: 16 }) {
    if (Object.values(limits).some(n => !Number.isSafeInteger(n) || n < 1)) throw new Error('Positive finite motion ledger bounds required');
  }
  reset() {
    this.context = undefined; this.lastSerial = -1; this.resumeSeed = true; this.eligibilityEpoch = undefined;
    this.observations.clear(); this.evictedIdFloor = 0; this.pending = undefined;
  }
  sizes() { return { observations: this.observations.size, pending: this.pending?.rows.length ?? 0 }; }
  observe(frame: MotionFrame): MotionSignal[] {
    const context = motionContextKey(frame.scope);
    if (context !== this.context) { this.reset(); this.context = context; }
    const provenance = frame.eligibility;
    const request = frame.requestEligibility;
    if (provenance && provenance.epoch !== this.eligibilityEpoch) {
      this.pending = undefined;
      this.eligibilityEpoch = provenance.epoch;
    }
    const eligible = frame.visible && frame.intersecting && (!provenance || provenance.eligible);
    const validRequest = provenance && request && request.eligible && provenance.eligible && request.epoch === provenance.epoch && Number.isFinite(provenance.sinceWallMs);
    if (!eligible) { this.pending = undefined; this.resumeSeed = true; }
    // Scope/visibility updates also use this method; repeated serial never consumes twice.
    if (frame.batchSerial > this.lastSerial) {
      // The first initial/context request can precede its section's first IO result.
      // One false-to-true transition may seed a baseline, never a presentation.
      // Re-observing an old serial or crossing an eligible loss cannot promote it.
      const coldBaseline = this.lastSerial < 0 && (frame.reason === 'initial' || frame.reason === 'dependency') && eligible && provenance && request && !request.eligible && provenance.epoch === request.epoch + 1 && Number.isFinite(provenance.sinceWallMs);
      // Callers without provenance retain conservative first-return seeding.
      const seed = this.lastSerial < 0 || (provenance ? !validRequest : this.resumeSeed) || !eligible || seedReasons.has(frame.reason);
      const previous = new Map(this.observations);
      const dedup = new Set<string>(); const candidates: RuntimeObservation[] = [];
      for (const row of frame.rows) {
        if (!validIdentity(row) || !inScope(row, frame.scope)) continue;
        const id = JSON.stringify([row.source_id, row.event_id]);
        if (dedup.has(id)) continue; dedup.add(id);
        const before = previous.get(id);
        const version = aggregateVersion(row);
        const recent = isRecent(row, frame.now, frame.activityWindowMs);
        // Exact identities prove returned novelty. After eviction, lower/reused IDs are
        // conservatively suppressed because absence from the bounded ledger proves nothing.
        const newIdentity = before === undefined && row.event_id > this.evictedIdFloor;
        const isNewCall = row.grain === 'call' && newIdentity;
        const isNewAggregate = row.grain === 'session_aggregate' && (newIdentity || (before !== undefined && before.version !== version));
        const withinEligibility = !provenance || row.timestamp_ms >= provenance.sinceWallMs;
        // A changed aggregate observed twice through eligible requests in this epoch
        // proves a new observation even if its session timestamp stays unchanged.
        const aggregateBaseline = provenance && before?.eligibilityEpoch === provenance.epoch;
        if (!seed && recent && ((isNewCall && withinEligibility) || (isNewAggregate && (withinEligibility || aggregateBaseline))) && candidates.length < this.limits.pending) candidates.push(row);
        // Overflow observations are consumed without a later replay queue.
        this.observations.delete(id); this.observations.set(id, { eventId: row.event_id, version, eligibilityEpoch: validRequest || coldBaseline ? provenance!.epoch : undefined });
        while (this.observations.size > this.limits.observations) {
          const oldest = this.observations.keys().next().value!;
          this.evictedIdFloor = Math.max(this.evictedIdFloor, this.observations.get(oldest)!.eventId);
          this.observations.delete(oldest);
        }
      }
      this.pending = !seed && candidates.length ? { serial: frame.batchSerial, rows: candidates } : undefined;
      this.lastSerial = frame.batchSerial;
      if (eligible) this.resumeSeed = false;
    }
    if (!eligible || (provenance && !validRequest) || !this.pending || frame.batchSerial !== this.pending.serial || frame.graph?.batchSerial !== frame.batchSerial || frame.graph.contextKey !== context) return [];
    const rows = this.pending.rows; this.pending = undefined;
    return rows.flatMap(row => {
      if (!isRecent(row, frame.now, frame.activityWindowMs)) return [];
      if (row.grain === 'session_aggregate') return row.harness && frame.graph!.harnesses.includes(row.harness) ? [{ kind: 'node', eventId: row.event_id, sourceId: row.source_id, dimension: 'harness', key: row.harness, presentation: 'static', durationMs: 700 } as MotionSignal] : [];
      const possibilities = [
        { column: 1, from: row.harness, to: row.provider },
        { column: 2, from: row.provider, to: row.model },
        { column: 0, from: row.project, to: row.harness },
      ];
      const edge = possibilities.find(e => typeof e.from === 'string' && e.from.length > 0 && typeof e.to === 'string' && e.to.length > 0 && frame.graph!.edges.some(g => g.column === e.column && g.from === e.from && g.to === e.to));
      return edge ? [{ kind: 'edge', eventId: row.event_id, sourceId: row.source_id, column: edge.column, from: edge.from!, to: edge.to!, presentation: frame.reduced ? 'static' : 'moving', durationMs: 700 } as MotionSignal] : [];
    });
  }
}

export interface RuntimeMotionBatch {
  serial: number;
  reason: RefreshReason;
  scopeKey: string;
  sourceId?: number;
  rows: readonly RuntimeObservation[];
  requestEligibility?: MotionEligibilitySnapshot;
}
