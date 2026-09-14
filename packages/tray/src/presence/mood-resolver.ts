import type { PetMood, PresenceEvent, ProviderPresence } from './types.js';

/**
 * Focused provider -> Pet mood (docs/PET_MODE_V2_SPEC.md §15).
 *
 * Priority: reset -> critical -> warning -> working -> healthy. The focused provider's
 * own severity drives the mood; the global risk is a separate indicator (§16), so a
 * critical subscription elsewhere never forces the Pet into a red panic.
 */
export function resolvePetMood(
  focus: ProviderPresence | null,
  event?: PresenceEvent | null,
): PetMood {
  if (!focus) return 'healthy';

  if (event?.type === 'reset' && event.ownerKey === focus.key) return 'reset';
  if (focus.severity === 'crit') return 'critical';
  if (focus.severity === 'warn') return 'warning';
  if (focus.active) return 'working';
  return 'healthy';
}

/**
 * True when the Pet should show a global risk badge even though it is focused elsewhere
 * (spec §16): the system risk outranks the focused provider's own colour.
 */
export function shouldShowGlobalAlert(
  globalSeverity: ProviderPresence['severity'],
  focus: ProviderPresence | null,
): boolean {
  const rank = { unknown: 0, ok: 1, warn: 2, crit: 3 } as const;
  return rank[globalSeverity] > rank[focus?.severity ?? 'unknown'];
}
