/**
 * Print exactly what the tray would show, from the daemon's live data.
 * Useful because a tray tooltip cannot be read back programmatically.
 *
 *   npm run preview-tooltip -w @quotapulse/tray
 */
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import {
  buildTooltip,
  currentLimits,
  worst,
  isExpired,
  shortWindow,
  shortSource,
  shortAge,
  clockAt,
  TOOLTIP_MAX,
  type Limit,
} from './limits.js';

const DATA_DIR =
  process.env.QUOTAPULSE_DATA_DIR ??
  join(process.env.LOCALAPPDATA ?? join(homedir(), '.local', 'share'), 'quotapulse');
const LOCK_PATH = join(DATA_DIR, 'daemon.lock');

async function main() {
  if (!existsSync(LOCK_PATH)) {
    console.log('daemon not running (no lock file)');
    console.log(buildTooltip([], false));
    return;
  }
  const lock = JSON.parse(readFileSync(LOCK_PATH, 'utf8')) as { port: number; token: string };
  const res = await fetch(`http://127.0.0.1:${lock.port}/api/limits`, {
    headers: { 'x-quotapulse-token': lock.token },
  });
  const { limits } = (await res.json()) as { limits: Limit[] };

  const tip = buildTooltip(limits, true);
  console.log(`\n=== TOOLTIP (${tip.length}/${TOOLTIP_MAX} chars) ===`);
  for (const line of tip.split('\n')) console.log('  | ' + line);

  const w = worst(limits);
  console.log('\n=== CONTEXT MENU ===');
  console.log(
    '  ' +
      (w
        ? `Worst: ${shortSource(w.display_name)} ${shortWindow(w.window_kind)} ${Math.round(w.used_percent!)}%`
        : 'No live limits'),
  );
  console.log('  ---');
  for (const l of currentLimits(limits)) {
    const expired = isExpired(l);
    const value = expired ? '--' : `${Math.round(l.used_percent!)}%`;
    const when = expired
      ? 'window reset, awaiting a fresh reading'
      : l.resets_at
        ? `resets ${clockAt(l.resets_at)}`
        : 'no reset time reported';
    const agePart =
      l.ageSeconds != null && l.ageSeconds >= 120 ? `, ${shortAge(l.ageSeconds).trim()} old` : '';
    console.log(`  ${l.display_name} | ${shortWindow(l.window_kind)} ${value} - ${when}${agePart}`);
  }

  const hidden = limits.length - currentLimits(limits).length;
  console.log(`\n  (${currentLimits(limits).length} shown, ${hidden} superseded by a fresher origin)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
