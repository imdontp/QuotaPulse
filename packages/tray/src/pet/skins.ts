import { PET_CHARACTER_IDS, type PetAnimationId, type PetCharacterId, type PetMood, type Severity } from '../presence/types.js';
import { MOOD_COLORS, SEVERITY_COLORS } from './motion.js';

/**
 * Wave 3 skin/theme system (SKIN_THEME_ARCHITECTURE.md).
 *
 * Character identity and skin are separate: one shared Pet engine, four characters, and any
 * number of skins per character. Skins only repaint the body / add accessories -- status
 * semantics stay protected, so warning is still amber and critical still red no matter what
 * palette a skin ships.
 */

export interface PetSkinPalette {
  primary?: string;
  secondary?: string;
  neutral?: string;
}

export interface PetSkinManifest {
  id: string;
  characterId: PetCharacterId;
  displayName: string;
  version: number;
  /** Animation id -> asset src, for slots the skin overrides. */
  assets: Record<string, string>;
  preview: string;
  palette?: PetSkinPalette;
}

/** The four semantic color families a skin must not repurpose (spec §3). */
export const SEMANTIC_COLOR_FAMILY: Record<'healthy' | 'working' | 'warning' | 'critical', string> = {
  healthy: 'teal',
  working: 'cyan',
  warning: 'amber',
  critical: 'red',
};

/**
 * Status colors are owned by the engine, not the skin. A skin may change a body color, but
 * these values are what the renderer paints for each mood/severity.
 */
export const PROTECTED_MOOD_COLORS: Record<PetMood, string> = { ...MOOD_COLORS };
export const PROTECTED_SEVERITY_COLORS: Record<Severity, string> = { ...SEVERITY_COLORS };

/** The color a mood is rendered with, regardless of the active skin. */
export function protectedMoodColor(mood: PetMood): string {
  return PROTECTED_MOOD_COLORS[mood];
}

export interface SkinValidation {
  ok: boolean;
  issues: string[];
}

const PALETTE_KEYS = new Set(['primary', 'secondary', 'neutral']);

/** Validate a skin manifest without a JSON-schema dependency; never throws. */
export function validateSkin(raw: unknown): SkinValidation {
  const issues: string[] = [];
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, issues: ['skin must be an object'] };
  }
  const skin = raw as Partial<PetSkinManifest>;
  if (typeof skin.id !== 'string' || !skin.id) issues.push('id must be a non-empty string');
  if (!PET_CHARACTER_IDS.includes(skin.characterId as PetCharacterId)) {
    issues.push(`unknown characterId: ${String(skin.characterId)}`);
  }
  if (typeof skin.displayName !== 'string' || !skin.displayName) issues.push('displayName must be a non-empty string');
  if (!Number.isInteger(skin.version) || (skin.version as number) < 1) issues.push('version must be an integer >= 1');
  if (skin.assets == null || typeof skin.assets !== 'object') issues.push('assets must be an object');
  if (typeof skin.preview !== 'string' || !skin.preview) issues.push('preview must be a non-empty string');
  if (skin.palette != null) {
    if (typeof skin.palette !== 'object' || Array.isArray(skin.palette)) {
      issues.push('palette must be an object');
    } else {
      for (const key of Object.keys(skin.palette)) {
        if (!PALETTE_KEYS.has(key)) {
          // A skin trying to define `warning`/`critical` colors would break the semantics.
          issues.push(`palette.${key} is not a permitted skin key`);
        }
      }
    }
  }
  return { ok: issues.length === 0, issues };
}

/** The runtime path a skin's animation asset is expected at, whether or not it exists yet. */
export function skinAssetSrc(characterId: PetCharacterId, skinId: string, animation: PetAnimationId): string {
  const dir = characterId.replace(/_/g, '-');
  return `/assets/pets/${dir}/skins/${skinId}/${animation}.webp`;
}

function builtin(characterId: PetCharacterId, id: string, displayName: string, primary: string): PetSkinManifest {
  const dir = characterId.replace(/_/g, '-');
  return {
    id,
    characterId,
    displayName,
    version: 1,
    // The default skin carries no extras: it IS the character. Non-default skins ship one
    // real, non-semantic accessory overlay on disk (spec §4); skin *clips* stay empty until
    // the asset agent delivers them, and resolution then falls back to the character's
    // default skin / manifest asset (spec §5).
    assets: id === 'default' ? {} : { accessory: `/assets/pets/${dir}/skins/${id}/accessory.svg` },
    preview: id === 'default' ? skinAssetSrc(characterId, id, 'healthy_idle') : `/assets/pets/${dir}/skins/${id}/accessory.svg`,
    palette: { primary },
  };
}

const SKIN_SEEDS: ReadonlyArray<{ id: string; displayName: string; primary: string }> = [
  { id: 'default', displayName: 'Default', primary: MOOD_COLORS.healthy },
  { id: 'midnight', displayName: 'Midnight', primary: '#3b82f6' },
  { id: 'winter', displayName: 'Winter', primary: '#7dd3fc' },
  { id: 'cinnamon', displayName: 'Cinnamon', primary: '#c2703d' },
];

/** Built-in skins for every character; `default` always exists as the fallback (spec §5). */
export const BUILTIN_SKINS: readonly PetSkinManifest[] = PET_CHARACTER_IDS.flatMap((characterId) =>
  SKIN_SEEDS.map((seed) => builtin(characterId, seed.id, seed.displayName, seed.primary)),
);

export const DEFAULT_SKIN_ID = 'default';

export function skinsForCharacter(characterId: PetCharacterId): readonly PetSkinManifest[] {
  return BUILTIN_SKINS.filter((skin) => skin.characterId === characterId);
}

export function defaultSkinFor(characterId: PetCharacterId): PetSkinManifest | null {
  return (
    BUILTIN_SKINS.find((skin) => skin.characterId === characterId && skin.id === DEFAULT_SKIN_ID) ?? null
  );
}

/** The requested skin when it exists for the character, else that character's default skin. */
export function resolveSkin(characterId: PetCharacterId, skinId: string | null | undefined): PetSkinManifest | null {
  const requested = BUILTIN_SKINS.find((skin) => skin.characterId === characterId && skin.id === skinId);
  return requested ?? defaultSkinFor(characterId);
}

export interface SkinAssetResolution {
  src: string | null;
  /** True when the requested skin lacked the asset and the default skin/manifest was used. */
  fellBack: boolean;
  skin: PetSkinManifest | null;
}

/**
 * Resolve a skin's animation asset with the spec's fallback chain:
 * requested skin -> character default skin -> null (caller falls back to the character
 * manifest / vector placeholder, so a missing skin asset can never crash the renderer).
 */
export function resolveSkinAsset(
  characterId: PetCharacterId,
  skinId: string | null | undefined,
  animation: PetAnimationId,
  manifestAssets?: Partial<Record<PetAnimationId, string>> | null,
): SkinAssetResolution {
  const requested = BUILTIN_SKINS.find((skin) => skin.characterId === characterId && skin.id === skinId) ?? null;
  const requestedSrc = requested?.assets[animation] ?? null;
  if (requested && requestedSrc) return { src: requestedSrc, fellBack: false, skin: requested };

  const fallback = defaultSkinFor(characterId);
  const fallbackSrc = fallback?.assets[animation] ?? null;
  if (fallbackSrc) return { src: fallbackSrc, fellBack: true, skin: fallback };

  const manifestSrc = manifestAssets?.[animation] ?? null;
  return { src: manifestSrc, fellBack: requested != null && requested.id !== DEFAULT_SKIN_ID, skin: requested ?? fallback };
}

/**
 * The active skin's accessory overlay, or null. Accessories are OPTIONAL overlays, so unlike
 * animation assets there is no fallback to the default skin: no default skin ships one.
 */
export function resolveSkinAccessory(characterId: PetCharacterId, skinId: string | null | undefined): string | null {
  const skin = resolveSkin(characterId, skinId);
  return skin?.assets['accessory'] ?? null;
}
