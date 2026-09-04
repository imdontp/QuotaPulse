/**
 * Check the things that fail silently.
 *
 * Every item here is a real failure this project has hit or can hit, and each one is
 * invisible until you notice a number is wrong:
 *
 *   - the scheduled task runs `dist/`, so editing source without rebuilding runs stale
 *     code. A pre-rename daemon serving a post-rename bundle is how this presented.
 *   - the repo path and the node path are baked into the task at registration, so moving
 *     the folder or upgrading node under nvm breaks it with no error anywhere.
 *   - a hand-started `npm run daemon` alongside the task means two writers on one
 *     database and an EADDRINUSE nobody reads.
 *   - the price catalog can be absent or months old, and the cost page just shows dashes.
 *
 * Usage:  npm run doctor
 */
import { existsSync, statSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';
import { execFileSync } from 'node:child_process';

const REPO = resolve(fileURLToPath(new URL('..', import.meta.url)));
const DATA_DIR =
  process.env.QUOTAPULSE_DATA_DIR ??
  join(process.env.LOCALAPPDATA ?? join(homedir(), '.local', 'share'), 'quotapulse');
const PORT = Number(process.env.QUOTAPULSE_PORT ?? 7676);
const isWindows = process.platform === 'win32';

let bad = 0;
let warn = 0;
const ok = (m) => console.log(`  ok    ${m}`);
const no = (m) => {
  bad++;
  console.log(`  FAIL  ${m}`);
};
const meh = (m) => {
  warn++;
  console.log(`  warn  ${m}`);
};

/** Newest mtime under a directory tree, or 0 if it does not exist. */
function newest(dir) {
  if (!existsSync(dir)) return 0;
  let max = 0;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    max = Math.max(max, e.isDirectory() ? newest(p) : statSync(p).mtimeMs);
  }
  return max;
}

function ps(cmd) {
  if (!isWindows) return null;
  try {
    return execFileSync('powershell', ['-NoProfile', '-Command', cmd], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return null;
  }
}

console.log(`QuotaPulse doctor\n  repo ${REPO}\n  data ${DATA_DIR}\n`);

console.log('build');
for (const pkg of ['daemon', 'tray']) {
  const src = join(REPO, 'packages', pkg, 'src');
  const dist = join(REPO, 'packages', pkg, 'dist');
  if (!existsSync(dist)) {
    no(`packages/${pkg}/dist is missing -- run: npm run build -w @quotapulse/${pkg}`);
    continue;
  }
  const sm = newest(src);
  const dm = newest(dist);
  if (sm > dm) {
    const mins = (sm - dm) / 60_000;
    no(
      `packages/${pkg}/dist is ${mins.toFixed(0)} min behind src -- the scheduled task is ` +
        `running stale code. Rebuild: npm run build -w @quotapulse/${pkg}`,
    );
  } else {
    ok(`packages/${pkg}/dist is current`);
  }
}
const webDist = join(REPO, 'packages', 'web', 'dist', 'index.html');
if (!existsSync(webDist)) no('packages/web/dist is missing -- run: npm run build -w @quotapulse/web');
else if (newest(join(REPO, 'packages', 'web', 'src')) > statSync(webDist).mtimeMs)
  no('packages/web/dist is behind src -- the dashboard being served is stale');
else ok('packages/web/dist is current');

console.log('\ndaemon');
const listeners = (() => {
  if (!isWindows) return null;
  const out = ps(
    `(Get-NetTCPConnection -State Listen -LocalPort ${PORT} -ErrorAction SilentlyContinue |` +
      ` Select-Object -ExpandProperty OwningProcess) -join ','`,
  );
  return out ? [...new Set(out.split(',').filter(Boolean))] : [];
})();
if (listeners == null) meh(`cannot check port ${PORT} on this platform`);
else if (listeners.length === 0) no(`nothing is listening on 127.0.0.1:${PORT}`);
else if (listeners.length > 1)
  no(`${listeners.length} processes on port ${PORT} (pids ${listeners.join(', ')}) -- two writers on one database`);
else ok(`one daemon on 127.0.0.1:${PORT} (pid ${listeners[0]})`);

console.log('\nscheduled tasks');
if (!isWindows) meh('logon tasks are Windows only; start the daemon yourself');
else {
  for (const name of ['quotapulse-daemon', 'quotapulse-tray']) {
    const state = ps(
      `(Get-ScheduledTask -TaskName '${name}' -ErrorAction SilentlyContinue).State`,
    );
    if (!state) {
      meh(`${name} is not registered -- run: ./scripts/install-task.ps1`);
      continue;
    }
    const action = ps(
      `((Get-ScheduledTask -TaskName '${name}').Actions | Select-Object -First 1).Execute`,
    );
    const args = ps(
      `((Get-ScheduledTask -TaskName '${name}').Actions | Select-Object -First 1).Arguments`,
    );
    if (action && !existsSync(action.replace(/^"|"$/g, ''))) {
      no(`${name} points at a missing executable: ${action}`);
    } else if (args && !existsSync(args.replace(/^"|"$/g, ''))) {
      no(`${name} points at a missing script: ${args} -- did the repo move?`);
    } else {
      ok(`${name} is ${state} and its paths resolve`);
    }
  }
}

console.log('\nprice catalog');
const catalogs = [
  [join(DATA_DIR, 'models.dev.json'), 'ours'],
  [join(homedir(), '.cache', 'opencode', 'models.json'), 'OpenCode'],
];
const found = catalogs.find(([p]) => existsSync(p));
if (!found) {
  meh(
    'no catalog anywhere -- every call reads as unpriced. Run: npm run prices:refresh',
  );
} else {
  const [p, who] = found;
  const days = (Date.now() - statSync(p).mtimeMs) / 86_400_000;
  const msg = `${who} catalog, ${days.toFixed(1)} days old (${p})`;
  if (days > 30) meh(`${msg} -- stale; run: npm run prices:refresh`);
  else ok(msg);
}

console.log(`\n${bad} failure(s), ${warn} warning(s)`);
process.exit(bad > 0 ? 1 : 0);
