import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const require = createRequire(import.meta.url);
const electronPackage = require.resolve('electron/package.json');
const modules = realpathSync(resolve(dirname(electronPackage), '..'));
const output = resolve(root, 'tmp/review-bundles'); mkdirSync(output, { recursive: true });
const bundle = mkdtempSync(join(output, 'QuotaPulse-v1.36-'));
const packages = new Map<string, { name: string; version: string; path: string }>();
function copyPackage(packageRoot: string, follow = true) {
  const canonical = realpathSync(packageRoot);
  assert.ok(canonical.startsWith(modules + sep), 'Runtime package must be inside installed node_modules');
  if (packages.has(canonical)) return;
  const pkg = JSON.parse(readFileSync(join(canonical, 'package.json'), 'utf8'));
  const destination = join(bundle, 'node_modules', relative(modules, canonical));
  cpSync(canonical, destination, { recursive: true });
  packages.set(canonical, { name: pkg.name, version: pkg.version, path: relative(bundle, destination).replaceAll('\\', '/') });
  if (!follow) return;
  const resolver = createRequire(join(canonical, 'package.json'));
  for (const dependency of Object.keys({ ...pkg.dependencies, ...pkg.optionalDependencies })) {
    try { copyDependency(dependency, resolver); }
    catch (error: any) { if (!pkg.optionalDependencies?.[dependency] || error.code !== 'MODULE_NOT_FOUND') throw error; }
  }
}
function copyDependency(name: string, resolver: NodeRequire) {
  copyPackage(dependencyRoot(name, resolver));
}
function dependencyRoot(name: string, resolver: NodeRequire): string {
  let entry: string;
  try { entry = resolver.resolve(`${name}/package.json`); }
  catch { entry = resolver.resolve(name); }
  let dir = dirname(entry);
  while (dir !== dirname(dir)) {
    const manifest = join(dir, 'package.json');
    if (existsSync(manifest) && JSON.parse(readFileSync(manifest, 'utf8')).name === name) return dir;
    dir = dirname(dir);
  }
  throw new Error(`Runtime package root missing: ${name}`);
}
const daemonPackage = JSON.parse(readFileSync(join(root, 'packages/daemon/package.json'), 'utf8'));
for (const name of Object.keys(daemonPackage.dependencies)) copyDependency(name, require);
// Electron's runtime index only needs core fs/path; its install-time dependencies
// are not executed by this review bundle. Preserve its complete installed dist/licenses.
copyPackage(dirname(electronPackage), false);
for (const component of ['daemon', 'tray']) {
  cpSync(join(root, `packages/${component}/dist`), join(bundle, `packages/${component}/dist`), { recursive: true });
  cpSync(join(root, `packages/${component}/package.json`), join(bundle, `packages/${component}/package.json`));
}
cpSync(join(root, 'packages/tray/dist-preload'), join(bundle, 'packages/tray/dist-preload'), { recursive: true });
// Compiled main loads these renderer documents from src, including gallery's stylesheet.
mkdirSync(join(bundle, 'packages/tray/src'), { recursive: true });
for (const file of ['pet.html', 'gallery.html', 'gallery.css']) {
  cpSync(join(root, 'packages/tray/src', file), join(bundle, 'packages/tray/src', file));
  assert.equal(createHash('sha256').update(readFileSync(join(bundle, 'packages/tray/src', file))).digest('hex'), createHash('sha256').update(readFileSync(join(root, 'packages/tray/src', file))).digest('hex'));
}
cpSync(join(root, 'packages/tray/dist-package/pets'), join(bundle, 'packages/tray/assets/pets'), { recursive: true });
cpSync(join(root, 'packages/web/dist'), join(bundle, 'packages/web/dist'), { recursive: true });
// Web dependencies are compiled into dist, so retain their installed notices
// separately rather than copying their build-time executables into the runtime.
const webLicenses: Array<{ name: string; version: string; files: string[] }> = [];
const seenWeb = new Set<string>();
function copyWebNotices(packageRoot: string) {
  const canonical = realpathSync(packageRoot);
  assert.ok(canonical.startsWith(modules + sep));
  if (seenWeb.has(canonical)) return;
  seenWeb.add(canonical);
  const pkg = JSON.parse(readFileSync(join(canonical, 'package.json'), 'utf8'));
  const files = readdirSync(canonical, { withFileTypes: true }).filter(file => file.isFile() && /^(license|licence|copying|notice|ofl)(?:[.-]|$)/i.test(file.name)).map(file => file.name);
  const destination = join(bundle, 'third-party-licenses/web', relative(modules, canonical));
  mkdirSync(destination, { recursive: true });
  for (const file of files) cpSync(join(canonical, file), join(destination, file));
  webLicenses.push({ name: pkg.name, version: pkg.version, files });
  const resolver = createRequire(join(canonical, 'package.json'));
  for (const name of Object.keys({ ...pkg.dependencies, ...pkg.optionalDependencies })) {
    try { copyWebNotices(dependencyRoot(name, resolver)); }
    catch (error: any) { if (!pkg.optionalDependencies?.[name] || error.code !== 'MODULE_NOT_FOUND') throw error; }
  }
}
const webPackage = JSON.parse(readFileSync(join(root, 'packages/web/package.json'), 'utf8'));
for (const name of Object.keys(webPackage.dependencies)) copyWebNotices(dependencyRoot(name, require));
writeFileSync(join(bundle, 'third-party-licenses/web-inventory.json'), JSON.stringify(webLicenses, null, 2));
mkdirSync(join(bundle, 'scripts'), { recursive: true });
for (const file of ['task-entry.cjs', 'start-review.ps1', 'stop-review.ps1', 'review-profile.ps1', 'install-review.ps1', 'uninstall-review.ps1']) cpSync(join(root, 'scripts', file), join(bundle, 'scripts', file));
if (existsSync(join(root, 'LICENSE'))) cpSync(join(root, 'LICENSE'), join(bundle, 'LICENSE'));
writeFileSync(join(bundle, 'package.json'), JSON.stringify({ name: 'quotapulse-local-review', private: true, version: '0.1.0' }, null, 2));
const manifest = { checkpoint: 'v1.36', platform: process.platform, arch: process.arch, requiredNodeAbi: process.versions.modules, buildNode: process.version,
  mode: 'review only; readers off; Node prerequisite; no tasks installed', packages: [...packages.values()].sort((a,b) => a.path.localeCompare(b.path)), webLicensePackages: webLicenses.length,
  taskEntrySha256: createHash('sha256').update(readFileSync(join(bundle, 'scripts/task-entry.cjs'))).digest('hex') };
writeFileSync(join(bundle, 'review-manifest.json'), JSON.stringify(manifest, null, 2));
writeFileSync(join(bundle, 'README-REVIEW.txt'), `QuotaPulse v1.36 local Windows review bundle\n\nReference fidelity repair in progress; this is not visual acceptance.\n\nRequires installed Node with module ABI ${process.versions.modules} (${process.version} used for this build), matching platform ${process.platform}/${process.arch}. Node is not bundled.\n\nPortable review, from PowerShell in the extracted folder:\n  ./scripts/start-review.ps1\n  ./scripts/stop-review.ps1\n\nVersioned installation (destination must be a new dedicated folder):\n  ./scripts/install-review.ps1 -Archive C:/path/to/this-bundle.zip -ExpectedSha256 <published-checksum> -Destination C:/path/to/QuotaPulseReview\n  C:/path/to/QuotaPulseReview/start.ps1\n  C:/path/to/QuotaPulseReview/stop.ps1\n  C:/path/to/QuotaPulseReview/rollback.ps1\n  C:/path/to/QuotaPulseReview/uninstall.ps1\nUninstall stops only this instance, removes registered software releases and preserves review-data. Unknown staging/diagnostic files and recovery helpers are retained. Reinstall can reuse that profile.\nUse the same installer command with a new ZIP/checksum to upgrade, after stopping review. The prior release is retained for rollback.\n\nDefault review port: 7807. Data stays in the review-data directory (installation root for versioned installs).\nReaders and account probes are disabled; new databases show empty usage. No scheduled tasks are registered.\nThe start helper uses hidden processes. Closing tray retains its daemon; stop-review stops only this review instance's recorded processes and preserves data.\n\nThis is an unsigned review bundle with a PowerShell installer, not a signed MSI/EXE or production release. Dependency licenses and bundled font licenses are retained in their directories.\n`);
const evidence = resolve(root, 'screens/tray-recovery'); mkdirSync(evidence, { recursive: true });
writeFileSync(join(evidence, 'bundle-build.json'), JSON.stringify({ status: 'built', bundle, ...manifest }, null, 2));
console.log(`Review bundle built: ${bundle}; ${packages.size} runtime packages; external Node ABI ${process.versions.modules}.`);
