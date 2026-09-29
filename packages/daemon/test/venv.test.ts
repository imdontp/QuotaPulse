import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { parsePyvenvCfg, resolveBaseInterpreter, resolvePythonTarget, venvLauncherPath, venvSitePackages } from '../src/util/venv.js';

/*
 * The console flash this exists to fix cannot be tested by behaviour: a process that
 * appears and disappears in a few hundred milliseconds is gone before any assertion could
 * look at it, and the only reliable evidence is a process sampler watching a live daemon.
 *
 * So what is tested here is the decision instead -- which interpreter gets chosen, and, more
 * importantly, when the code refuses to choose. Every "returns null" case below is a
 * situation where a wrong guess would cost the OpenAI quota reading, and losing a reading
 * quietly is worse than a console that flashes.
 */

function fakeVenv(
  { platform = 'win32', implementation = 'CPython', withCfg = true, base = true, sitePackages = true, launcher = true } = {},
): { venv: string; home: string } {
  const root = mkdtempSync(join(tmpdir(), 'qp-venv-'));
  const venv = join(root, 'venv');
  const baseDir = join(root, 'uv', 'python', 'cpython-3.13');
  if (base) {
    mkdirSync(baseDir, { recursive: true });
    writeFileSync(join(baseDir, 'python.exe'), 'MZ');
  }
  if (launcher) {
    mkdirSync(platform === 'win32' ? join(venv, 'Scripts') : join(venv, 'bin'), { recursive: true });
    writeFileSync(venvLauncherPath(venv, platform as NodeJS.Platform), 'MZ');
  }
  if (sitePackages) mkdirSync(venvSitePackages(venv, platform as NodeJS.Platform), { recursive: true });
  /*
   * The `home` written into the config is the one this fixture actually created, because
   * `resolveBaseInterpreter` checks that the interpreter exists there. A hand-written path
   * would resolve to null and the test would pass for the wrong reason.
   */
  if (withCfg) {
    writeFileSync(join(venv, 'pyvenv.cfg'), [
      `home = ${baseDir}`,
      `implementation = ${implementation}`,
      'uv = 0.12.7',
      'version_info = 3.13',
      'include-system-site-packages = false',
      'prompt = hermes-agent',
    ].join('\n'));
  }
  return { venv, home: baseDir };
}

test('parses the keys the resolution needs, and ignores the rest', () => {
  const { home } = fakeVenv();
  const cfg = parsePyvenvCfg([
    `home = ${home}`,
    'implementation = CPython',
    'uv = 0.12.7',
    'version_info = 3.13',
  ].join('\n'));
  assert.equal(cfg.home, home);
  assert.equal(cfg.implementation, 'CPython');
  assert.equal(cfg.versionInfo, '3.13');
});

test('a Windows path full of separators and an equals sign survives parsing', () => {
  // The naive `split('=')` version of this loses everything after the second `=`, and a
  // home directory is exactly where that shows up.
  const cfg = parsePyvenvCfg('home = C:\\a=b\\python\nversion_info = 3.12');
  assert.equal(cfg.home, 'C:\\a=b\\python');
  assert.equal(cfg.versionInfo, '3.12');
});

test('comments, blank lines and lowercase keys are all fine', () => {
  const cfg = parsePyvenvCfg('# a comment\n\n  HOME = /usr\nversion_info=3.11\n');
  assert.equal(cfg.home, '/usr');
  assert.equal(cfg.versionInfo, '3.11');
});

test('on Windows the real interpreter is used, and the packages still resolve', () => {
  const { venv, home } = fakeVenv();
  const target = resolvePythonTarget(venv, 'win32');
  assert.ok(target, 'a venv with a valid pyvenv.cfg must resolve');
  assert.equal(target.command, join(home, 'python.exe'),
    'the base interpreter, not the launcher -- this is the whole fix');
  assert.equal(target.sitePackages, venvSitePackages(venv, 'win32'));
});

test('the launcher is the Windows default when there is nothing to resolve to', () => {
  const { venv } = fakeVenv({ withCfg: false });
  const target = resolvePythonTarget(venv, 'win32');
  assert.equal(target.command, venvLauncherPath(venv, 'win32'),
    'without a pyvenv.cfg the launcher is still correct, and still flashes');
  assert.equal(target.sitePackages, null, 'and nothing is added to PYTHONPATH');
});

test('a non-CPython environment is not second-guessed', () => {
  // PyPy's venv has its own launcher semantics and its base is not named python.exe.
  const { venv } = fakeVenv({ implementation: 'PyPy' });
  assert.equal(resolveBaseInterpreter(venv, 'win32'), null, 'better to flash than to run the wrong interpreter');
});

test('a home that does not exist is not resolved to', () => {
  const root = mkdtempSync(join(tmpdir(), 'qp-venv-'));
  const venv = join(root, 'venv');
  mkdirSync(join(venv, 'Scripts'), { recursive: true });
  writeFileSync(join(venv, 'Scripts', 'python.exe'), 'MZ');
  writeFileSync(join(venv, 'pyvenv.cfg'), 'home = C:\\gone\\python\nimplementation = CPython\nversion_info = 3.13');
  assert.equal(resolveBaseInterpreter(venv, 'win32'), null);
});

test('a missing pyvenv.cfg is not resolved to', () => {
  const { venv } = fakeVenv({ withCfg: false });
  assert.equal(resolveBaseInterpreter(venv, 'win32'), null);
});

test('other platforms are left alone, because there is nothing to fix there', () => {
  // On macOS and Linux `venv/bin/python` is a symlink to the base interpreter: no re-exec,
  // no second process, no console. Resolving it would be a change with no bug behind it.
  const { venv } = fakeVenv({ platform: 'linux' });
  assert.equal(resolveBaseInterpreter(venv, 'linux'), null);
  const target = resolvePythonTarget(venv, 'linux');
  assert.equal(target.command, venvLauncherPath(venv, 'linux'));
});

test('a venv with no launcher at all resolves to nothing, so the caller can fall through', () => {
  const { venv } = fakeVenv({ launcher: false });
  assert.equal(resolvePythonTarget(venv, 'win32'), null);
});

test('site-packages is only offered when it is really there', () => {
  // An entry on PYTHONPATH that does not exist is harmless; an entry that is a file makes
  // CPython warn on every single start, which is noise in a daemon that probes every minute.
  const { venv } = fakeVenv({ sitePackages: false });
  const target = resolvePythonTarget(venv, 'win32');
  assert.ok(target);
  assert.equal(target.sitePackages, null);
});

test('site-packages paths follow the platform layout', () => {
  // Compared by segment rather than by separator: `path.join` normalises to `\` on Windows,
  // so a regex written with forward slashes fails on exactly the platform this fix is for.
  assert.deepEqual(venvSitePackages(join('a', 'venv'), 'win32').split(/[\\/]/).slice(-2), ['Lib', 'site-packages']);
  assert.deepEqual(venvSitePackages(join('a', 'venv'), 'linux').split(/[\\/]/).slice(-2), ['python3', 'site-packages']);
});
