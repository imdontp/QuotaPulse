import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PET_CHARACTERS } from '../src/pet/characters.js';
import { validatePetAssetTree } from '../src/pet/asset-pipeline.js';

/**
 * Wave 4 production packaging helper (PRODUCTION_PACKAGING_SPEC.md).
 *
 * Copies approved runtime asset types into `dist-package/pets`:
 * - manifest.json files
 * - `<animation_id>.webp` runtime clips
 * - skins (accessory SVGs)
 * - Gallery previews (`preview_128.png`) and concept pose sheets
 *
 * Excluded on purpose: 1024px masters, raw sprite sheets, prompt/spec archives,
 * development contact sheets, READMEs, and — Wave 5 hardening — any directory
 * that is not in the approved character registry. The four user-approved bonus
 * companions ship as Beta alongside the original four. Other unapproved
 * directories remain excluded (RELEASE_GATE G16).
 */

const trayRoot = resolve(fileURLToPath(import.meta.url), '..', '..');
const petsSource = join(trayRoot, 'assets', 'pets');
const destination = join(trayRoot, 'dist-package', 'pets');

const EXCLUDED_BASENAMES = new Set(['README.md', 'contact-sheet.png']);
const EXCLUDED_DIR_HINTS = new Set(['prompt', 'master', 'draft', 'contact']);

/** Top-level directories packaged from the pets tree: only the approved roster. */
const APPROVED_CHAR_DIRS = new Set(PET_CHARACTERS.map((def) => def.id.replace(/_/g, '-')));

/** Wave 5 G16: a top-level pets directory ships only if it is a registered character. */
export function isShippableCharacterDir(dirName: string): boolean {
  const hyphenated = dirName.replace(/_/g, '-');
  return APPROVED_CHAR_DIRS.has(dirName) || APPROVED_CHAR_DIRS.has(hyphenated);
}

const report = validatePetAssetTree(petsSource);
if (!report.ok) {
  console.error('packaging aborted: asset validation failed');
  for (const issue of report.issues) {
    if (issue.severity === 'error') console.error(`  ${issue.path}: ${issue.message}`);
  }
  process.exit(1);
}

rmSync(join(trayRoot, 'dist-package'), { recursive: true, force: true });
mkdirSync(destination, { recursive: true });

let files = 0;
let skipped = 0;

function copyAllowedFile(file: string): boolean {
  const name = file.replace(/\\/g, '/').split('/').pop() ?? '';
  if (EXCLUDED_BASENAMES.has(name)) return false;
  const isManifest = name === 'manifest.json';
  const isClip = /\.webp$/i.test(name);
  const isPreview = /^preview_\d+\.png$/i.test(name) || name === 'accessory.svg';
  return isManifest || isClip || isPreview || name === 'concept-states.png';
}

function walk(dir: string, relBase: string): void {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const source = join(dir, entry.name);
    const rel = relBase ? `${relBase}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      if (!relBase && !isShippableCharacterDir(entry.name)) {
        skipped++;
        continue;
      }
      if ([...EXCLUDED_DIR_HINTS].some((hint) => entry.name.toLowerCase().includes(hint))) {
        skipped++;
        continue;
      }
      walk(source, rel);
    } else if (copyAllowedFile(source)) {
      const target = join(destination, rel);
      mkdirSync(target.replace(/\\[^\\]+$/, ''), { recursive: true });
      cpSync(source, target);
      files++;
    } else {
      skipped++;
    }
  }
}

walk(petsSource, '');

console.log(`packaged ${files} file(s) -> dist-package/pets; skipped ${skipped}`);
if (!existsSync(join(destination, 'orbit-bot', 'manifest.json'))) {
  console.error('packaging aborted: the fail-safe default pet (orbit-bot manifest) is missing');
  process.exit(1);
}
