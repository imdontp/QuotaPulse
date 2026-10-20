import { DURATION, EASE } from '../lib/motion';
import type { RefreshReason } from '../lib/use-live';
import type { QuotaRisk } from './alert-risks';

export const alertRiskMotionKey = (risk: Pick<QuotaRisk, 'key' | 'level' | 'reason'>) =>
  JSON.stringify(['risk', risk.key, risk.level, risk.reason]);
export const alertHistoryMotionKey = (id: number) => JSON.stringify(['history', id]);

export interface AlertsEntranceEligibility { epoch: number; eligible: boolean }
export interface AlertsEntranceBatch {
  serial: number;
  reason: RefreshReason;
  requestEligibility: AlertsEntranceEligibility;
}
const seedReasons = new Set<RefreshReason>(['initial', 'dependency', 'visible', 'online']);

/** One accepted full-data baseline, not the filtered/reordered DOM list. No replay queue. */
export class AlertsEntranceLedger {
  private serial = -1;
  private keys = new Set<string>();
  private eligibility: AlertsEntranceEligibility = { epoch: 0, eligible: false };
  snapshot(): AlertsEntranceEligibility { return { ...this.eligibility }; }
  setEligible(eligible: boolean) {
    if (eligible !== this.eligibility.eligible) this.eligibility = { epoch: this.eligibility.epoch + 1, eligible };
  }
  accept(batch: AlertsEntranceBatch, identities: readonly string[]): string[] {
    if (batch.serial <= this.serial) return [];
    const first = this.serial < 0;
    const previous = this.keys;
    this.keys = new Set(identities); this.serial = batch.serial;
    const request = batch.requestEligibility;
    if (first || seedReasons.has(batch.reason) || !this.eligibility.eligible || !request.eligible || request.epoch !== this.eligibility.epoch) return [];
    return [...this.keys].filter(key => !previous.has(key));
  }
}

/** Native Web Animations use milliseconds, matching the shared fast duration token. */
export function playAlertEntrance(element: Pick<HTMLElement, 'animate'>): Animation {
  return element.animate([
    { opacity: 0, transform: 'translateY(5px)' },
    { opacity: 1, transform: 'translateY(0)' },
  ], { duration: DURATION.fast, easing: `cubic-bezier(${EASE.entrance.join(',')})`, iterations: 1, fill: 'none' });
}

/** Own only currently running native effects; cancellation has no queued presentation. */
export class AlertsEntranceAnimations {
  private active = new Map<HTMLElement, Animation>();
  size() { return this.active.size; }
  private cancel(node: HTMLElement, animation: Animation) {
    if (this.active.get(node) !== animation) return;
    this.active.delete(node); delete node.dataset.alertMotion; animation.cancel();
  }
  play(node: HTMLElement) {
    const previous = this.active.get(node); if (previous) this.cancel(node, previous);
    const animation = playAlertEntrance(node);
    this.active.set(node, animation); node.dataset.alertMotion = 'entering';
    const complete = () => this.cancel(node, animation);
    void animation.finished.then(complete, complete);
  }
  prune(visible: (node: HTMLElement) => boolean) {
    for (const [node, animation] of this.active) if (!node.isConnected || !visible(node)) this.cancel(node, animation);
  }
  cancelAll() { for (const [node, animation] of this.active) this.cancel(node, animation); }
}
