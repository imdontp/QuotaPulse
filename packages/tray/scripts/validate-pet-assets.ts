import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validatePetAssetTree } from '../src/pet/asset-pipeline.js';

/**
 * Wave 4 asset pipeline CLI (ASSET_PIPELINE_SPEC.md §7 Build failure policy).
 *
 *   npm run validate-assets          # human summary
 *   npx tsx scripts/validate-pet-assets.ts --json   # machine-readable
 *
 * Exits 1 on any hard failure; warnings are reported but allowed through.
 */
const assetsDir = resolve(fileURLToPath(import.meta.url), '..', '..', 'assets');
const json = process.argv.includes('--json');
const report = validatePetAssetTree(resolve(assetsDir, 'pets'));

if (json) {
  console.log(JSON.stringify(report, null, 2));
} else {
  for (const issue of report.issues) {
    console.log(`${issue.severity === 'error' ? 'FAIL' : 'WARN'}  ${issue.path}: ${issue.message}`);
  }
  const errors = report.issues.filter((i) => i.severity === 'error').length;
  const warnings = report.issues.length - errors;
  console.log(
    `\n${report.ok ? 'OK' : 'FAILED'}: ${errors} error(s), ${warnings} warning(s), ` +
      `${report.metadata.length} clip(s) checksummed`,
  );
}

if (!report.ok) process.exit(1);
