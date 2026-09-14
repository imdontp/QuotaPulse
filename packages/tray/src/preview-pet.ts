/**
 * Print what the taskbar Pet would show, from live daemon data.
 * Useful because a tray/pet state cannot be read back programmatically.
 *
 *   npm run preview-pet -w @quotapulse/tray
 */
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { fpsFor } from './icon.js';
import type { Limit } from './limits.js';
import {
  activeOwnerKey,
  resolvePetFrame,
  type PetSettings,
  type SubscriptionInfo,
} from './presence/index.js';
import { moodSpeed } from './pet/motion.js';

const DATA_DIR =
  process.env.QUOTAPULSE_DATA_DIR ??
  join(process.env.LOCALAPPDATA ?? join(homedir(), '.local', 'share'), 'quotapulse');
const LOCK_PATH = join(DATA_DIR, 'daemon.lock');

async function main() {
  const settings: PetSettings = {
    enabled: true,
    movement: 'minimal',
    focusMode: 'auto',
    pinnedOwnerKey: null,
    rotateIntervalMs: 8_000,
    speechBubbles: true,
    eventNotifications: true,
    reducedMotion: false,
  };

  if (!existsSync(LOCK_PATH)) {
    console.log('daemon not running (no lock file)');
    console.log(resolvePetFrame({ limits: [], subscriptions: [], settings }));
    return;
  }
  const lock = JSON.parse(readFileSync(LOCK_PATH, 'utf8')) as { port: number; token: string };
  const res = await fetch(`http://127.0.0.1:${lock.port}/api/overview`, {
    headers: { 'x-quotapulse-token': lock.token },
  });
  const body = (await res.json()) as { limits: Limit[]; subscriptions?: SubscriptionInfo[] };
  const subscriptions = body.subscriptions ?? [];
  const now = Date.now();

  const frame = resolvePetFrame({
    limits: body.limits,
    subscriptions,
    settings,
    now,
    activeOwnerKey: activeOwnerKey(subscriptions, now),
  });

  console.log(`\n=== TRAY ANIMATION (worst ${frame.global.highest?.usedPercent == null ? '--' : Math.round(frame.global.highest.usedPercent) + '%'} @ ${fpsFor(frame.global.highest?.usedPercent ?? null)}fps) ===`);
  console.log(`TRAY  global=${frame.global.severity} worst=${frame.global.highest?.name ?? 'none'}`);
  console.log(
    `PET   mood=${frame.mood} sprite=${frame.spriteIndex} speed=${moodSpeed(frame.mood)}px/s ` +
      `focus=${frame.focus?.name ?? 'none'}` +
      `${frame.focus?.usedPercent != null ? ` ${Math.round(frame.focus.usedPercent)}%` : ''}` +
      `${frame.showGlobalAlert ? ` + global ${frame.global.severity} badge` : ''}` +
      `${frame.badge ? ` badge=${frame.badge}` : ''}`,
  );
  console.log('\nPROVIDERS');
  for (const p of frame.providers) {
    console.log(
      `  ${p.name.padEnd(28)} ${(p.usedPercent == null ? '--' : `${Math.round(p.usedPercent)}%`).padStart(5)} ` +
        `${p.windowKind.padEnd(8)} ${p.severity.padEnd(7)}${p.active ? ' ACTIVE' : ''}`,
    );
    if (p.windows.length > 1) {
      console.log(`    windows: ${p.windows.map((w) => `${w.windowKind} ${Math.round(w.usedPercent)}%`).join(' · ')}`);
    }
  }
  if (frame.bubble) {
    console.log(`\nBUBBLE [${frame.bubble.tone}] ${frame.bubble.title}`);
    for (const line of frame.bubble.lines) console.log(`  ${line}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
