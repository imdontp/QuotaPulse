import type { RefreshReason } from '../lib/use-live';
export { historyRecordMotionKey as liveRecordMotionKey } from './history-motion';
export const liveSessionMotionKey = (sessionKey: number) => JSON.stringify(['session', sessionKey]);
export interface LiveMotionEligibility { epoch: number; eligible: boolean }
export interface LiveRecordBatch { serial: number; reason: RefreshReason; requestEligibility: LiveMotionEligibility }
export interface LiveSelection { key: string | null; serial: number; context: string }
export const changedLiveSelection = (before: LiveSelection, next: LiveSelection) => next.key !== null && before.context === next.context && before.key !== next.key && before.serial !== next.serial;
const seeds = new Set<RefreshReason>(['initial', 'dependency', 'visible', 'online']);

/** Preceding accepted page only: observed presence, never an ingestion-recency claim. */
export class LivePresenceLedger {
  private eligibility: LiveMotionEligibility = { epoch: 0, eligible: false };
  private serial = -1;
  private context: string | undefined;
  private identities = new Set<string>();
  private seedNext = true;
  snapshot() { return { ...this.eligibility }; }
  setEligible(eligible: boolean) {
    if (eligible === this.eligibility.eligible) return;
    this.eligibility = { epoch: this.eligibility.epoch + 1, eligible };
    if (!eligible) this.seedNext = true;
  }
  /** A real hidden/reduced/offscreen barrier is distinct from mount's unknown IO. */
  suspend() {
    this.seedNext = true;
    if (this.eligibility.eligible || this.eligibility.epoch === 0) this.eligibility = { epoch: this.eligibility.epoch + 1, eligible: false };
  }
  accept(batch: LiveRecordBatch, context: string, identities: readonly string[], initialVisible = false): string[] {
    if (batch.serial <= this.serial) return [];
    const first = this.serial < 0;
    const prior = this.identities;
    const changedContext = this.context !== context;
    this.identities = new Set(identities); this.serial = batch.serial; this.context = context;
    const valid = this.eligibility.eligible && batch.requestEligibility.eligible && batch.requestEligibility.epoch === this.eligibility.epoch;
    // Mount's first request may precede IO, but its visible accepted initial page
    // already supplies a baseline. Only untouched startup (epochs0/1) can do this;
    // a held initial crossing any eligible loss must still seed a returned request.
    const coldBaseline = first && batch.reason === 'initial' && initialVisible && !batch.requestEligibility.eligible
      && batch.requestEligibility.epoch === 0
      && (this.eligibility.epoch === 0 || this.eligibility.epoch === 1 && this.eligibility.eligible);
    const seed = changedContext || this.seedNext || seeds.has(batch.reason) || !valid;
    if (valid || coldBaseline) this.seedNext = false;
    return seed ? [] : [...this.identities].filter(identity => !prior.has(identity));
  }
}
