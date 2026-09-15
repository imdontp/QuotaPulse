import { PET_CHARACTERS } from './characters.js';
import { PET_CONTRACT_VERSION, PET_RUNTIME_VERSION } from './contract.js';
import type { PetCharacterId } from '../presence/types.js';

export type PetReleaseStatus = 'stable' | 'beta' | 'experimental';
export interface PetCatalogEntry {
  id: string;
  displayName: string;
  status: PetReleaseStatus;
  selectable: boolean;
  preview: string;
  personality: readonly string[];
  previewAsset: boolean;
  contractVersion: number;
  collection: 'original' | 'bonus';
  tagline: string;
  description: string;
}

const PROFILES: Record<PetCharacterId, [string, string, string[]]> = {
  orbit_bot: ['Your little system guardian', 'A steady presence for busy days. Orbit keeps an eye on your usage while you focus on what comes next.', ['Reliable', 'Focused', 'Playful']],
  pulse_fox: ['A bright mind. A warm companion.', 'Curious ears, a glowing tail, and a little encouragement. Your attentive companion through every work session.', ['Attentive', 'Intelligent', 'Warm']],
  flux_blob: ['Go with your flow', 'A soft, luminous presence that moves with your day. Calm when you are, expressive when it matters.', ['Calm', 'Curious', 'Fluid']],
  capsule_cat: ['Small companion. Big awareness.', 'A little feline mischief meets a helpful system companion. Always nearby, quietly keeping you in the loop.', ['Clever', 'Compact', 'Helpful']],
  nova: ['The friendly companion', 'A little light for your desktop. Nova brings a calm smile and a gentle nudge to keep you moving.', ['Calm', 'Reliable', 'Friendly']],
  byte: ['The focused worker', 'Headphones on, ready to build. Byte keeps you company through deep focus and the next great idea.', ['Productive', 'Energetic', 'In sync']],
  mochi: ['The gentle worrier', 'Warm, caring, and a little expressive. Mochi notices when it is time to slow down and recharge.', ['Gentle', 'Caring', 'Expressive']],
  kuro: ['The dramatic guardian', 'A bold little guardian with a watchful gaze. Kuro brings a touch of drama to your daily flow.', ['Bold', 'Dramatic', 'Watchful']],
};

/** Bonus selection was explicitly requested after the Wave 4 preview-only spec.
 * Beta indicates concept poses, not a complete authored animation release.
 */
export function galleryRoster(): readonly PetCatalogEntry[] {
  return PET_CHARACTERS.map(def => ({
    id: def.id, displayName: def.name, status: def.collection === 'bonus' ? 'beta' : 'stable',
    selectable: true, preview: `/assets/pets/${def.id.replace(/_/g, '-')}/concept-states.png`,
    personality: PROFILES[def.id][2], previewAsset: true, contractVersion: PET_CONTRACT_VERSION,
    collection: def.collection ?? 'original', tagline: PROFILES[def.id][0], description: PROFILES[def.id][1],
  }));
}

export function isSelectableCharacterId(id: string | null | undefined): id is PetCharacterId {
  return PET_CHARACTERS.some(def => def.id === id);
}

export function isExperimentalCharacterId(id: string): boolean {
  return galleryRoster().some(entry => entry.id === id && !entry.selectable);
}

export const PET_RUNTIME_BUILD = PET_RUNTIME_VERSION;
