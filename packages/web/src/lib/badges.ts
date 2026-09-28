import type { MessageKey } from '../i18n/en';
import { BADGE_IDS, type BadgeId } from './progress';

/**
 * Presentation metadata for the badge shelf, kept out of `progress.ts` so the rules stay
 * free of any dependency on React or the string tables.
 *
 * `Record<BadgeId, ...>` rather than a partial map: adding a badge to the roster without
 * a name and an explanation becomes a typecheck failure, not a blank tile on the shelf.
 */
export interface BadgeMeta {
  name: MessageKey;
  hint: MessageKey;
}

export const BADGE_META: Record<BadgeId, BadgeMeta> = {
  'first-pulse': { name: 'badge.first-pulse', hint: 'badge.first-pulseHint' },
  'streak-3': { name: 'badge.streak-3', hint: 'badge.streak-3Hint' },
  'streak-7': { name: 'badge.streak-7', hint: 'badge.streak-7Hint' },
  'streak-30': { name: 'badge.streak-30', hint: 'badge.streak-30Hint' },
  'cache-50': { name: 'badge.cache-50', hint: 'badge.cache-50Hint' },
  'cache-80': { name: 'badge.cache-80', hint: 'badge.cache-80Hint' },
  'early-bird': { name: 'badge.early-bird', hint: 'badge.early-birdHint' },
  'night-owl': { name: 'badge.night-owl', hint: 'badge.night-owlHint' },
  'steady': { name: 'badge.steady', hint: 'badge.steadyHint' },
  thrifty: { name: 'badge.thrifty', hint: 'badge.thriftyHint' },
  guardian: { name: 'badge.guardian', hint: 'badge.guardianHint' },
};

/** Every badge, in shelf order, with whether this profile has earned it. */
export function badgeShelf(unlocked: readonly string[]): Array<{ id: BadgeId; earned: boolean }> {
  const earned = new Set(unlocked);
  return BADGE_IDS.map((id) => ({ id, earned: earned.has(id) }));
}
