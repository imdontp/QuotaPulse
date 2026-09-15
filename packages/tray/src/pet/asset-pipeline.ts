import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, relative } from 'node:path';
import { PET_CHARACTERS, type PetCharacterDef } from './characters.js';
import { validateManifest } from './manifest.js';

/**
 * Wave 4 asset pipeline validation (ASSET_PIPELINE_SPEC.md).
 *
 * Hard failures stop a production build; warnings are reviews. The validator
 * walks the canonical `assets/pets/<slug>/` tree, checks manifests, required
 * Wave 1 assets, fallback chains, runtime sizes, naming and budget, and (with
 * metadata generation) records file size + sha256 for each clip.
 */

export type PipelineSeverity = 'error' | 'warning';

export interface PipelineIssue {
  severity: PipelineSeverity;
  path: string;
  message: string;
}

export interface PipelineReport {
  ok: boolean;
  issues: PipelineIssue[];
  metadata: Array<{
    characterId: string;
    animationId: string;
    file: string;
    bytes: number;
    sha256: string;
  }>;
}

/** Critically large single clips (PERFORMANCE_BUDGET.md). */
const WARN_BYTES = 2 * 1024 * 1024;
const STRONG_WARN_BYTES = 5 * 1024 * 1024;

interface ResolvableManifest {
  animations?: Record<string, { src?: string; fallback?: string }>;
}

/**
 * True when the fallback walk from `start` reaches a manifest entry whose src
 * exists on disk. Mirrors the runtime resolver's walk (manifest.ts), stopping at
 * `healthy_static`, which is a legal terminal fallback.
 */
function chainProducesAsset(start: string, manifest: ResolvableManifest): boolean {
  const animations = manifest.animations ?? {};
  const visited = new Set<string>();
  let id = start;
  while (id && id !== 'healthy_static' && !visited.has(id)) {
    visited.add(id);
    const entry = animations[id];
    const src = entry?.src;
    if (src) {
      // Canonical srcs are /assets/pets/<slug>/<file>; the slug dir is currentDir.
      const file = join(currentDir, src.split('/').pop() ?? '');
      if (existsSync(file)) return true;
    }
    id = (entry?.fallback ?? '') as string;
  }
  return id === 'healthy_static';
}

/** Directory being validated, set by `validateCharacterDir` for `chainProducesAsset`. */
let currentDir = '';

/** Visual asset names must never encode a provider or model (spec §5). */
const FORBIDDEN_NAME_TOKENS = [
  'gpt', 'openai', 'claude', 'anthropic', 'gemini', 'copilot', 'deepseek', 'llama',
];

/** Wave 1 required clips: the semantic fail-safe chain for every stable character. */
const REQUIRED_CHAIN: ReadonlyArray<{ animation: string; fallback: string }> = [
  { animation: 'healthy_idle', fallback: 'healthy_static' },
  { animation: 'warning_loop', fallback: 'healthy_idle' },
  { animation: 'critical_loop', fallback: 'warning_loop' },
];

function sha256Of(file: string): string {
  return createHash('sha256').update(readFileSync(file)).digest('hex');
}

function walk(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

/**
 * Validate one character directory. `experimental` softens the missing-asset
 * rules (incubation candidates warn instead of failing the build).
 */
function validateCharacterDir(def: PetCharacterDef, dir: string, experimental: boolean): PipelineIssue[] {
  const issues: PipelineIssue[] = [];
  currentDir = dir;
  const manifestPath = join(dir, 'manifest.json');
  if (!existsSync(manifestPath)) {
    // A missing manifest is an error for stable, a warning while in incubation.
    issues.push({
      severity: experimental ? 'warning' : 'error',
      path: relative(dir, `${dir}/../`) + def.id,
      message: `${def.id}: manifest.json missing`,
    });
    return issues;
  }

  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(manifestPath, 'utf8'));
  } catch (err) {
    issues.push({ severity: 'error', path: manifestPath, message: `${def.id}: manifest is corrupt: ${String(err)}` });
    return issues;
  }

  const validation = validateManifest(raw);
  for (const issue of validation.issues) {
    // Corrupt/invalid manifests and missing fallback chains are hard failures
    // for stable characters; incubating candidates only warn (spec §7).
    if (!experimental) {
      issues.push({ severity: 'error', path: `${def.id}.${issue.path}`, message: issue.message });
    } else {
      issues.push({ severity: 'warning', path: `${def.id}.${issue.path}`, message: issue.message });
    }
  }

  const manifest = raw as { animations?: Record<string, { src?: string; fallback?: string }> };
  if (!experimental && validation.ok) {
    for (const { animation, fallback } of REQUIRED_CHAIN) {
      const entry = manifest.animations?.[animation];
      if (!entry) {
        issues.push({ severity: 'error', path: `${def.id}.animations.${animation}`, message: 'required fallback chain entry missing' });
        continue;
      }
      if (entry.fallback !== fallback) {
        issues.push({ severity: 'error', path: `${def.id}.animations.${animation}.fallback`, message: `fallback must be ${fallback}` });
      }
    }
  }

  // Naming: canonical `<animation_id>.webp` assets, never provider-coded names.
  for (const file of walk(dir)) {
    const name = file.replace(/\\/g, '/');
    const lower = name.toLowerCase();
    if (/\.(png|gif|jpe?g)$/.test(name) && !/preview/.test(lower)) {
      issues.push({ severity: 'warning', path: name, message: 'non-canonical raster name (prefer <animation_id>.webp or preview_128.png)' });
    }
    if (FORBIDDEN_NAME_TOKENS.some((t) => lower.includes(t))) {
      issues.push({ severity: 'error', path: name, message: 'asset name encodes a provider/model name (spec §5)' });
    }
  }

  if (!experimental && def.art === 'raster') {
    // Every required semantic state must resolve to an actually-playable clip:
    // the entry, its declared fallback target, or a chain that terminates in an
    // existing file. A chain that ends with no asset at all is a hard failure.
    for (const { animation } of REQUIRED_CHAIN) {
      if (chainProducesAsset(animation as string, manifest as ResolvableManifest)) continue;
      issues.push({
        severity: 'error',
        path: `${def.id}.animations.${animation}`,
        message: `fallback chain from "${animation}" never resolves to an existing clip`,
      });
    }
  }

  return issues;
}

/** The metadata export consumes per-clip size/hash; no shared helper needed. */

/**
 * Validate the whole `assets/pets/` tree. Stable characters are held to the
 * production bar; anything not in the registry is treated as an incubating
 * experimental candidate and only warns.
 */
export function validatePetAssetTree(petsDir: string): PipelineReport {
  const issues: PipelineIssue[] = [];
  const report: PipelineReport = { ok: true, issues, metadata: [] };

  if (!existsSync(petsDir)) {
    return { ok: false, issues: [{ severity: 'error', path: petsDir, message: 'pets asset tree missing' }], metadata: [] };
  }

  // Naming/global hash scan across the entire tree, including experimental
  // candidate directories: a provider/model name in an asset filename is
  // disallowed everywhere (spec §5).
  const knownNames = new Set<string>();
  for (const file of walk(petsDir)) {
    const lower = file.replace(/\\/g, '/').toLowerCase();
    if (FORBIDDEN_NAME_TOKENS.some((t) => lower.includes(t))) {
      issues.push({
        severity: 'error',
        path: relative(petsDir, file).replace(/\\/g, '/'),
        message: 'asset name encodes a provider/model name (spec §5)',
      });
    }
  }

  for (const def of PET_CHARACTERS) {
    knownNames.add(def.id);
    knownNames.add(def.id.replace(/_/g, '-'));
    issues.push(...validateCharacterDir(def, join(petsDir, def.id.replace(/_/g, '-')), false));
  }

  for (const entry of readdirSync(petsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const id = entry.name;
    if (knownNames.has(id) || knownNames.has(id.replace(/-/g, '_'))) continue;
    // Unknown directory = experimental candidate dir: incomplete sets warn.
    const dir = join(petsDir, id);
    const hasManifest = existsSync(join(dir, 'manifest.json'));
    issues.push({
      severity: 'warning',
      path: relative(petsDir, dir),
      message: hasManifest
        ? `experimental candidate "${id}" must not bundle incomplete runtime sets as selectable`
        : `experimental candidate "${id}" has no manifest yet (preview concept only)`,
    });
  }

  // Export metadata: byte size + sha256 for every webp under the tree.
  for (const file of walk(petsDir)) {
    if (!file.toLowerCase().endsWith('.webp')) continue;
    const bytes = statSync(file).size;
    const rel = relative(petsDir, file).replace(/\\/g, '/');
    if (bytes > STRONG_WARN_BYTES) {
      issues.push({ severity: 'warning', path: rel, message: `clip is ${bytes} bytes (>5MB strong review)` });
    } else if (bytes > WARN_BYTES) {
      issues.push({ severity: 'warning', path: rel, message: `clip is ${bytes} bytes (>2MB review)` });
    }
    report.metadata.push({
      characterId: rel.split('/')[0] ?? '',
      animationId: rel.replace(/\.webp$/i, '').split('/').pop() ?? '',
      file: rel,
      bytes,
      sha256: sha256Of(file),
    });
  }

  report.issues = issues;
  report.ok = !issues.some((issue) => issue.severity === 'error');
  return report;
}
