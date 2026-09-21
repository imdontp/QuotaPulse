import { readFileSync } from 'node:fs';
import {
  PET_ANIMATION_IDS,
  PET_CHARACTER_IDS,
  type AnimationFallback,
  type AnimationPlayback,
  type PetAnimationAsset,
  type PetAnimationId,
  type PetCharacterId,
  type PetCharacterManifest,
} from '../presence/types.js';
import { isContractCompatible, runtimeSatisfies } from './contract.js';
import { isOnce } from './runtime.js';

/**
 * Character manifest loader + safe animation fallbacks (Next Handoff Pack §5–§7).
 *
 * The manifest is the runtime contract between the Pet State Engine and whatever draws
 * the character. It is deliberately tolerant: a missing animation falls back along the
 * manifest's declared chain, and if everything is absent the renderer draws the vector
 * placeholder rather than crashing. A warning is logged once per (character, animation),
 * never on every poll (ACCEPTANCE_TEST_MATRIX.md — Missing asset fallback).
 */

const SUPPORTED_SIZES = new Set([128, 256, 512, 1024]);

/**
 * Fallback used when an animation entry is missing entirely, so the manifest cannot state
 * its own fallback. Mirrors the chains frozen in `03_character_manifests/`.
 */
export const DEFAULT_FALLBACK: Record<PetAnimationId, AnimationFallback> = {
  healthy_idle: 'healthy_static',
  working_loop: 'healthy_idle',
  warning_intro: 'warning_loop',
  warning_loop: 'healthy_idle',
  critical_intro: 'critical_loop',
  critical_loop: 'warning_loop',
  reset_celebrate: 'healthy_idle',
  talk_loop: 'healthy_idle',
  hover_react: 'healthy_idle',
  click_react: 'healthy_idle',
};

export interface ManifestIssue {
  path: string;
  message: string;
}

export interface ManifestValidation {
  ok: boolean;
  issues: ManifestIssue[];
  manifest?: PetCharacterManifest;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Validate against `04_runtime_contract/pet-manifest.schema.json` without pulling in a
 * JSON-schema dependency. Returns issues rather than throwing so the loader can still
 * produce a usable manifest.
 */
export function validateManifest(raw: unknown): ManifestValidation {
  const issues: ManifestIssue[] = [];
  if (!isRecord(raw)) return { ok: false, issues: [{ path: '$', message: 'manifest must be an object' }] };

  const id = raw.id;
  if (!PET_CHARACTER_IDS.includes(id as PetCharacterId)) {
    issues.push({ path: 'id', message: `unknown character id: ${String(id)}` });
  }
  // Contract compatibility (Wave 4, ASSET_VERSIONING_POLICY.md): an explicit
  // contractVersion this runtime does not understand is a hard reject so the
  // caller falls back to the known-good default pet instead of partial loading.
  if (raw.contractVersion !== undefined && !isContractCompatible(raw.contractVersion)) {
    issues.push({ path: 'contractVersion', message: `unsupported contract version: ${String(raw.contractVersion)}` });
  }
  if (raw.minimumRuntimeVersion !== undefined && !runtimeSatisfies(raw.minimumRuntimeVersion)) {
    issues.push({ path: 'minimumRuntimeVersion', message: `runtime older than required minimum: ${String(raw.minimumRuntimeVersion)}` });
  }
  const status = raw.status;
  if (status !== undefined && status !== null && status !== 'stable' && status !== 'beta' && status !== 'experimental') {
    issues.push({ path: 'status', message: 'status must be stable|beta|experimental when present' });
  }
  if (raw.selectable !== undefined && typeof raw.selectable !== 'boolean') {
    issues.push({ path: 'selectable', message: 'selectable must be boolean when present' });
  }
  if (typeof raw.displayName !== 'string' || raw.displayName.length === 0) {
    issues.push({ path: 'displayName', message: 'displayName must be a non-empty string' });
  }
  const assetVersion = raw.assetVersion;
  if (typeof assetVersion !== 'number' || !Number.isInteger(assetVersion) || assetVersion < 1) {
    issues.push({ path: 'assetVersion', message: 'assetVersion must be an integer >= 1' });
  }

  const pivot = raw.pivot;
  if (!isRecord(pivot) || typeof pivot.x !== 'number' || typeof pivot.y !== 'number') {
    issues.push({ path: 'pivot', message: 'pivot must be { x, y }' });
  } else if (pivot.x < 0 || pivot.x > 1 || pivot.y < 0 || pivot.y > 1) {
    issues.push({ path: 'pivot', message: 'pivot.x/y must be within 0..1' });
  }

  const sizes = raw.supportedSizes;
  if (!Array.isArray(sizes) || sizes.length === 0) {
    issues.push({ path: 'supportedSizes', message: 'supportedSizes must be a non-empty array' });
  } else if (!sizes.every((s) => SUPPORTED_SIZES.has(s as number))) {
    issues.push({ path: 'supportedSizes', message: `supportedSizes must be a subset of ${[...SUPPORTED_SIZES].join(', ')}` });
  }

  const animations = raw.animations;
  if (!isRecord(animations)) {
    issues.push({ path: 'animations', message: 'animations must be an object' });
  } else {
    for (const anim of PET_ANIMATION_IDS) {
      if (!isRecord(animations[anim])) {
        issues.push({ path: `animations.${anim}`, message: 'required Wave 1 animation is missing' });
        continue;
      }
      const entry = animations[anim] as Record<string, unknown>;
      if (entry.playback !== 'loop' && entry.playback !== 'once') {
        issues.push({ path: `animations.${anim}.playback`, message: 'playback must be loop|once' });
      }
      if (typeof entry.src !== 'string' || entry.src.length === 0) {
        issues.push({ path: `animations.${anim}.src`, message: 'src must be a non-empty string' });
      }
      if (typeof entry.fallback !== 'string' || entry.fallback.length === 0) {
        issues.push({ path: `animations.${anim}.fallback`, message: 'fallback must be a string' });
      }
      if (entry.reducedMotionSrc !== undefined && entry.reducedMotionSrc !== null && typeof entry.reducedMotionSrc !== 'string') {
        issues.push({ path: `animations.${anim}.reducedMotionSrc`, message: 'reducedMotionSrc must be string|null' });
      }
    }
  }

  return { ok: issues.length === 0, issues, manifest: issues.length === 0 ? (raw as unknown as PetCharacterManifest) : undefined };
}

/** Read + validate a manifest file. Returns the parsed object even when validation fails. */
export function readManifest(path: string): { manifest: PetCharacterManifest; validation: ManifestValidation } {
  const raw = JSON.parse(readFileSync(path, 'utf8')) as unknown;
  return { manifest: raw as PetCharacterManifest, validation: validateManifest(raw) };
}

export interface ResolvedAnimation {
  requested: PetAnimationId;
  /** The animation actually played after fallbacks. */
  animation: PetAnimationId;
  playback: AnimationPlayback;
  /** Asset path, or null when nothing resolved and the vector placeholder must be drawn. */
  src: string | null;
  /** True when the resolved asset should be shown without motion (reduced motion / static). */
  static: boolean;
  /** True when the asset is the author-supplied reduced-motion variant. */
  reducedVariant: boolean;
  fellBack: boolean;
}

export interface ResolveAnimationOptions {
  reducedMotion?: boolean;
  /** Called on the first fallback for a (character, requested) pair; dedupe via `warned`. */
  warn?: (message: string) => void;
  /** Shared dedupe set so a per-poll resolve warns once, not continuously. */
  warned?: Set<string>;
}

/**
 * Resolve an animation to a playable asset, following the fallback chain when the entry
 * is missing or when reduced motion demands a calmer variant. Never throws.
 */
export function resolveAnimation(
  manifest: PetCharacterManifest,
  requested: PetAnimationId,
  options: ResolveAnimationOptions = {},
): ResolvedAnimation {
  const reducedMotion = options.reducedMotion ?? false;
  const warned = options.warned ?? new Set<string>();
  const warn = options.warn ?? (() => {});
  const emitWarning = (key: string, message: string): void => {
    if (warned.has(key)) return;
    warned.add(key);
    warn(message);
  };
  const dedupeKey = `${manifest.id}:${requested}`;

  let id: PetAnimationId = requested;
  let fellBack = false;
  let staticMode = false;
  const visited = new Set<PetAnimationId>();

  /** The next id in the fallback chain, collapsing `healthy_static` to a static idle. */
  const advance = (from: PetAnimationId): PetAnimationId => {
    const target = nextFallback(manifest, from);
    if (target === 'healthy_static') {
      staticMode = true;
      return 'healthy_idle';
    }
    return target as PetAnimationId;
  };

  for (;;) {
    if (visited.has(id)) break;
    visited.add(id);

    const asset: PetAnimationAsset | undefined = manifest.animations[id];
    if (asset) {
      // Reduced motion: prefer the author-supplied still/loop variant; otherwise show the
      // clip static so no strong shake/jump plays (ACCEPTANCE_TEST_MATRIX.md).
      if (reducedMotion) {
        if (asset.reducedMotionSrc) {
          return { requested, animation: id, playback: asset.playback, src: asset.reducedMotionSrc, static: true, reducedVariant: true, fellBack };
        }
        if (isOnce(id)) {
          // A one-shot reaction is not reduced-motion-safe on its own; step to its loop.
          id = advance(id);
          fellBack = true;
          continue;
        }
        return { requested, animation: id, playback: asset.playback, src: asset.src, static: true, reducedVariant: false, fellBack };
      }
      return { requested, animation: id, playback: asset.playback, src: asset.src, static: staticMode, reducedVariant: false, fellBack };
    }

    // Entry missing: use the manifest-declared fallback, else the frozen default chain.
    const target = nextFallback(manifest, id);
    if (target === id) break;
    emitWarning(dedupeKey, `[pet] animation "${id}" unavailable for ${manifest.id}; falling back`);
    fellBack = true;
    id = advance(id);
  }

  // Nothing resolved: the renderer draws the vector placeholder (src null) and stays safe.
  emitWarning(dedupeKey, `[pet] no asset resolved for ${manifest.id}/${requested}; using vector placeholder`);
  return { requested, animation: 'healthy_idle', playback: 'loop', src: null, static: true, reducedVariant: false, fellBack: true };
}

/** The declared fallback for an id, from the missing entry's siblings or the default chain. */
function nextFallback(manifest: PetCharacterManifest, id: PetAnimationId): AnimationFallback {
  return manifest.animations[id]?.fallback ?? DEFAULT_FALLBACK[id];
}
