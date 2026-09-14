import type { PresenceEvent, ProviderPresence } from './types.js';

/**
 * Which subscription the Pet represents (docs/PET_MODE_V2_SPEC.md §12–§14).
 *
 * Priority: recent important event -> user pin -> currently active -> rotation.
 * The Pet deliberately does NOT follow the global worst provider; that is the tray's job.
 */

export const EVENT_FOCUS_MS = 10_000;
export const DEFAULT_ROTATE_MS = 8_000;

export interface FocusOptions {
  now: number;
  pinnedOwnerKey?: string | null;
  activeOwnerKey?: string | null;
  event?: PresenceEvent | null;
  rotateIntervalMs?: number;
}

export function selectFocus(
  providers: ProviderPresence[],
  options: FocusOptions,
): ProviderPresence | null {
  if (providers.length === 0) return null;
  const { now, event } = options;

  // Priority 1 -- an event only holds focus for a short, bounded window.
  if (event && now - event.at < EVENT_FOCUS_MS) {
    const target = providers.find((p) => p.key === event.ownerKey);
    if (target) return target;
  }

  // Priority 2 -- the user's pin, as long as the provider is still present.
  if (options.pinnedOwnerKey) {
    const pinned = providers.find((p) => p.key === options.pinnedOwnerKey);
    if (pinned) return pinned;
  }

  // Priority 3 -- whoever is actually being used right now.
  if (options.activeOwnerKey) {
    const active = providers.find((p) => p.key === options.activeOwnerKey);
    if (active) return active;
  }

  // Priority 4 -- idle rotation, deterministic in time so every tick agrees. A provider
  // with no readable window is skipped: rotating onto it would show "no data" every few
  // seconds, which reads as a fault rather than a rotation.
  const rotatePool = providers.filter((p) => p.usedPercent != null);
  const pool = rotatePool.length > 0 ? rotatePool : providers;
  const rotate = options.rotateIntervalMs ?? DEFAULT_ROTATE_MS;
  const index = Math.floor(now / Math.max(1, rotate)) % pool.length;
  return pool[index]!;
}
