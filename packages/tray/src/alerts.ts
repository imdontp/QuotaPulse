import { isUsable, subscriptionLimits, type Limit } from './limits.js';

/** Keep in sync with the daemon's burn-rate tolerance (pinned by a cross-package test). */
export const RESET_TOLERANCE_MS = 2_000;
export const ALERT_STEPS = [50, 80, 95] as const;
export interface AlertState { step: number; resetsAt: number | null }

export function sameReset(a: number | null, b: number | null): boolean {
  return a == null || b == null ? a === b : Math.abs(a - b) <= RESET_TOLERANCE_MS;
}

/** No Electron or I/O: callers own the notification delivery and in-memory state. */
export function thresholdAlerts(all: Limit[], alerted: Map<string, AlertState>, now = Date.now()) {
  const result: Array<{ limit: Limit; step: number }> = [];
  for (const limit of subscriptionLimits(all, now).filter(l => isUsable(l, now))) {
    const key = `${limit.subscription_key ?? limit.account_key ?? `source:${limit.source_id}`}:${limit.window_kind}`;
    const previous = alerted.get(key);
    if (previous && !sameReset(previous.resetsAt, limit.resets_at)) alerted.delete(key);
    const step = [...ALERT_STEPS].reverse().find(s => limit.used_percent! >= s);
    const current = alerted.get(key);
    if (step == null || step <= (current?.step ?? 0)) continue;
    // Anchor to the first alert's reset, not each jittered reading: avoid cumulative drift.
    alerted.set(key, { step, resetsAt: current ? current.resetsAt : limit.resets_at });
    result.push({ limit, step });
  }
  return result;
}
