import { RESET_TOLERANCE_MS, sameReset } from '../alerts.js';
import { NOTIFY_STEPS, type PresenceEvent, type ProviderPresence } from './types.js';

/**
 * Threshold and reset events (docs/PET_MODE_V2_SPEC.md §17–§19).
 *
 * The rule that matters: an event fires on a STATE CHANGE, never on a level. 81% does not
 * keep re-announcing 80%. State resets when the quota window rolls over, and the reset-
 * timestamp tolerance is shared with the tray's alert ladder (`sameReset`) so a 28ms
 * republish cannot restart an entire ladder of announcements.
 */

interface OwnerState {
  step: number;
  resetsAt: number | null;
  active: boolean;
}

export interface EventTracker {
  /** Feed the current presences; returns only the events newly true since the last call. */
  update(providers: ProviderPresence[], now?: number): PresenceEvent[];
}

const stepToType = (step: number): PresenceEvent['type'] =>
  step >= 95 ? 'critical' : step >= 80 ? 'warning' : 'usage-half';

export function createEventTracker(): EventTracker {
  const state = new Map<string, OwnerState>();
  const stepFor = (percent: number | null): number =>
    percent == null ? 0 : ([...NOTIFY_STEPS].reverse().find((s) => percent >= s) ?? 0);

  return {
    update(providers: ProviderPresence[], now = Date.now()): PresenceEvent[] {
      const events: PresenceEvent[] = [];
      const seen = new Set<string>();

      for (const provider of providers) {
        seen.add(provider.key);
        const prev = state.get(provider.key);

        // First sighting is a BASELINE, not a change: a tray restart must not re-announce
        // a threshold that was crossed an hour ago.
        if (!prev) {
          state.set(provider.key, {
            step: stepFor(provider.usedPercent),
            resetsAt: provider.resetsAt,
            active: provider.active,
          });
          continue;
        }

        let next: OwnerState = prev;
        let windowChanged = false;

        // Not a jitter: the reader published a genuinely different reset time.
        if (!sameReset(prev.resetsAt, provider.resetsAt)) {
          windowChanged = true;
          // A reset is only real when the OLD window had actually ended. A first-time
          // reading (prev null) or a corrected timestamp is not a reset.
          const hadEnded = prev.resetsAt != null && prev.resetsAt <= now + RESET_TOLERANCE_MS;
          if (hadEnded) events.push({ type: 'reset', ownerKey: provider.key, at: now });
          next = { ...next, step: 0, resetsAt: provider.resetsAt };
        }

        if (provider.usedPercent != null) {
          // Never re-run the ladder across a window change: the new window starts at 0.
          const baseline = windowChanged ? 0 : next.step;
          const step = Math.max(baseline, stepFor(provider.usedPercent));
          if (step > baseline) {
            events.push({
              type: stepToType(step),
              ownerKey: provider.key,
              at: now,
              percent: provider.usedPercent,
            });
            next = { ...next, step };
          }
        }

        if (provider.active !== prev.active) {
          events.push({
            type: provider.active ? 'activity-start' : 'activity-stop',
            ownerKey: provider.key,
            at: now,
          });
          next = { ...next, active: provider.active };
        }

        state.set(provider.key, next);
      }

      // A provider that disappeared entirely is forgotten, so a re-detected one restarts
      // its ladder rather than resuming a stale step count.
      for (const key of [...state.keys()]) if (!seen.has(key)) state.delete(key);

      return events;
    },
  };
}
