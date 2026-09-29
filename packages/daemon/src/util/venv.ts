import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Where the real Python is, when a virtual environment has been handed to us.
 *
 * ## The problem
 *
 * A Windows virtual environment's `Scripts/python.exe` is not Python. It is a small launcher
 * -- CPython's `venvlauncher` -- that reads `pyvenv.cfg`, finds the base installation, and
 * starts *that* instead. Two processes, not one.
 *
 * The second one is the problem. `windowsHide: true` (Node's `CREATE_NO_WINDOW`) is passed to
 * the launcher, and the launcher creates its child with `si.dwFlags = STARTF_USESTDHANDLES`
 * -- an assignment, not an OR. The `CREATE_NO_WINDOW` bit it was given is not carried across,
 * and the base interpreter, having no console of its own, allocates one. On a machine where
 * Windows Terminal hosts the console, that is a visible window: a black rectangle that
 * appears for a fraction of a second and is gone.
 *
 * The daemon does this on a timer, several helpers at once, so the flash is not occasional --
 * it is every pass. And it is invisible to any test that inspects a process list afterwards,
 * because the process is gone before the list is built.
 *
 * ## The fix
 *
 * Resolve the launcher away: read `home` out of `pyvenv.cfg` and run the base interpreter
 * directly, so `windowsHide` finally applies to the process that does the work. The
 * environment's installed packages live in its `site-packages`, which goes on `PYTHONPATH` so
 * imports keep resolving exactly as they did.
 *
 * ## Why this is Windows-only
 *
 * On macOS and Linux, `venv/bin/python` is a symlink to the base interpreter. There is no
 * re-exec, no second process and no flash, so resolving it would be a change with no bug to
 * fix. `resolveBaseInterpreter` returns null everywhere except Windows, and the caller falls
 * back to the launcher unchanged.
 */

export interface PyvenvCfg {
  /** The base installation directory, e.g. `.../uv/python/cpython-3.13-windows-x86_64-none`. */
  home?: string;
  /** e.g. `3.13`. Present in every venv CPython has written since 3.6. */
  versionInfo?: string;
  implementation?: string;
}

/**
 * Parse `pyvenv.cfg`.
 *
 * Hand-rolled rather than a dependency for a five-line INI subset with no sections, no
 * quoting, and no interpolation. Comments are `#`, keys and values are `key = value`, and a
 * value may contain `=` (paths on Windows are full of them), so the split takes the first one
 * only.
 */
export function parsePyvenvCfg(text: string): PyvenvCfg {
  const out: PyvenvCfg = {};
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim().toLowerCase();
    const value = line.slice(eq + 1).trim();
    if (key === 'home') out.home = value;
    else if (key === 'version_info') out.versionInfo = value;
    else if (key === 'implementation') out.implementation = value;
  }
  return out;
}

/** `venv/Scripts/python.exe` on Windows, `venv/bin/python` elsewhere. */
export function venvLauncherPath(venvDir: string, platform: NodeJS.Platform = process.platform): string {
  return platform === 'win32'
    ? join(venvDir, 'Scripts', 'python.exe')
    : join(venvDir, 'bin', 'python');
}

/** The environment's own `site-packages`, where its installed packages actually are. */
export function venvSitePackages(venvDir: string, platform: NodeJS.Platform = process.platform): string {
  return platform === 'win32'
    ? join(venvDir, 'Lib', 'site-packages')
    : join(venvDir, 'lib', 'python3', 'site-packages');
}

/**
 * The base interpreter a Windows venv would have launched, or null when there is nothing
 * safe to resolve to.
 *
 * Null is returned -- rather than a best guess -- in every case where guessing would be worse
 * than the launcher: no `pyvenv.cfg`, no `home`, no interpreter at that path, or an
 * environment built by something other than CPython. The caller then runs the launcher
 * exactly as it did before, which costs a console flash but keeps the quota reading.
 */
export function resolveBaseInterpreter(
  venvDir: string,
  platform: NodeJS.Platform = process.platform,
): { command: string; sitePackages: string } | null {
  if (platform !== 'win32') return null;

  const cfgPath = join(venvDir, 'pyvenv.cfg');
  if (!existsSync(cfgPath)) return null;

  let cfg: PyvenvCfg;
  try {
    cfg = parsePyvenvCfg(readFileSync(cfgPath, 'utf8'));
  } catch {
    return null;
  }

  // A PyPy or other non-CPython environment has its own launcher semantics, and the base
  // executable is not necessarily named `python.exe`. Do not guess.
  if (cfg.implementation && cfg.implementation.toLowerCase() !== 'cpython') return null;
  if (!cfg.home) return null;

  const command = join(cfg.home, 'python.exe');
  if (!existsSync(command)) return null;

  return { command, sitePackages: venvSitePackages(venvDir, platform) };
}

/**
 * What to actually run, and what the environment needs to make it behave like the venv.
 *
 * The contract is that `sitePackages` is either a real directory to put on `PYTHONPATH`, or
 * null meaning "nothing to add". It is never a path that may not exist, because an entry on
 * `PYTHONPATH` that does not exist is harmless but an entry that is a *file* makes CPython
 * warn on every start.
 */
export function resolvePythonTarget(
  venvDir: string,
  platform: NodeJS.Platform = process.platform,
): { command: string; sitePackages: string | null } | null {
  const launcher = venvLauncherPath(venvDir, platform);
  if (!existsSync(launcher)) return null;

  const base = resolveBaseInterpreter(venvDir, platform);
  if (base) {
    return {
      command: base.command,
      // Only worth adding if it is there. A venv that reports a home but has no
      // site-packages is not a venv we can make work, and the caller should fall back.
      sitePackages: existsSync(base.sitePackages) ? base.sitePackages : null,
    };
  }
  return { command: launcher, sitePackages: null };
}
