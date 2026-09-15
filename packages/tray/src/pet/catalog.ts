import { PET_CHARACTERS, type PetCharacterDef } from './characters.js';
import { PET_CONTRACT_VERSION, PET_RUNTIME_VERSION } from './contract.js';
import type { PetCharacterId } from '../presence/types.js';

/**
 * Wave 4 Pet Gallery data model (PET_GALLERY_SPEC.md, CUSTOMIZATION_STATE_MODEL.md,
 * BONUS_CHARACTER_INCUBATION_SPEC.md §Runtime isolation).
 *
 * The gallery lists two rosters:
 * - the stable roster: four approved characters, always selectable;
 * - the experimental roster: bonus candidates (Nova, Byte, Mochi, Kuro) as
 *   preview-only metadata. They are never selectable, never persistable as the
 *   active pet, and never touch the shared Pet State Engine or quota logic.
 */

export type PetReleaseStatus = 'stable' | 'beta' | 'experimental';

export interface PetCatalogEntry {
  id: string;
  displayName: string;
  status: PetReleaseStatus;
  /** Experimental entries are locked false until promoted (validator enforced). */
  selectable: boolean;
  /** Gallery preview src; ships an actual asset only when `previewAsset` is true. */
  preview: string;
  /** Short personality line shown on the character card. */
  personality: readonly string[];
  /** False for chart-board-only candidates without a bundled preview image. */
  previewAsset: boolean;
  contractVersion: number;
}

export interface ExperimentalCatalogCandidate {
  id: string;
  displayName: string;
  personality: readonly string[];
  notes: string;
}

/** Bonus candidates (experimental-pet-catalog.json, Wave 4 pack §07). */
const EXPERIMENTAL_CANDIDATES: readonly ExperimentalCatalogCandidate[] = [
  {
    id: 'nova',
    displayName: 'Nova',
    personality: ['calm', 'reliable', 'friendly'],
    notes: 'Light/clean companion candidate.',
  },
  {
    id: 'byte',
    displayName: 'Byte',
    personality: ['focused', 'productive', 'energetic'],
    notes: 'Dark/cyan focused-worker candidate.',
  },
  {
    id: 'mochi',
    displayName: 'Mochi',
    personality: ['gentle', 'caring', 'expressive'],
    notes: 'Warm amber companion candidate.',
  },
  {
    id: 'kuro',
    displayName: 'Kuro',
    personality: ['bold', 'dramatic', 'guardian'],
    notes: 'Dark/red guardian candidate.',
  },
];

/** Stable roster cards: selectable, no contract surprises. */
function stableEntries(): readonly PetCatalogEntry[] {
  return PET_CHARACTERS.map((def: PetCharacterDef) => ({
    id: def.id,
    displayName: def.name,
    status: 'stable',
    selectable: true,
    preview: `/assets/pets/${def.id.replace(/_/g, '-')}/manifest.json`,
    personality: def.anchors.slice(0, 2).map((anchor) => anchor.replace(/_/g, ' ')),
    previewAsset: false,
    contractVersion: PET_CONTRACT_VERSION,
  }));
}

/**
 * The full Gallery roster. Experimental entries sit in their own section and carry
 * `selectable: false` regardless of any future field edits — the only way to flip
 * that is promotion through the asset pipeline (PROMOTION_CHECKLIST.md).
 */
export function galleryRoster(): readonly PetCatalogEntry[] {
  return [
    ...stableEntries(),
    ...EXPERIMENTAL_CANDIDATES.map(
      (candidate): PetCatalogEntry => ({
        id: candidate.id,
        displayName: candidate.displayName,
        status: 'experimental',
        selectable: false,
        preview: `experimental:${candidate.id}`,
        personality: [...candidate.personality],
        previewAsset: false,
        contractVersion: PET_CONTRACT_VERSION,
      }),
    ),
  ];
}

/** Only the four stable ids may ever become the persisted active pet. */
export function isSelectableCharacterId(id: string | null | undefined): id is PetCharacterId {
  return PET_CHARACTERS.some((def) => def.id === id);
}

/** True when an id belongs to the experimental roster (never runtime-activateable). */
export function isExperimentalCharacterId(id: string): boolean {
  return EXPERIMENTAL_CANDIDATES.some((candidate) => candidate.id === id);
}

export const PET_RUNTIME_BUILD = PET_RUNTIME_VERSION;
