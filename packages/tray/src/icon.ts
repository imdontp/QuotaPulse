import { encodePng } from './png.js';

export type Severity = 'ok' | 'warn' | 'crit' | 'unknown';

/*
 * The QuotaPulse palette, as raw RGB. These MUST track the tokens in
 * packages/web/src/index.css (--ok #22D3A7, --warn #FFB020, --crit #FF4D4F): the tray is
 * a separate process with no stylesheet, so the two sets can only be kept in step by
 * hand, and a tray showing amber while the dashboard shows red is worse than either.
 */
const COLORS: Record<Severity, [number, number, number]> = {
  ok: [0x22, 0xd3, 0xa7],
  warn: [0xff, 0xb0, 0x20],
  crit: [0xff, 0x4d, 0x4f],
  unknown: [0x8a, 0x93, 0x9e],
};

/** The unspent part of the gauge. Blue grey so it reads as the same family as the rest. */
const TRACK: [number, number, number] = [0x5a, 0x66, 0x74];

export function severityFor(percent: number | null): Severity {
  if (percent == null) return 'unknown';
  if (percent >= 85) return 'crit';
  if (percent >= 60) return 'warn';
  return 'ok';
}

const SIZE = 32;
const CX = (SIZE - 1) / 2;
const CY = (SIZE - 1) / 2;

/* Ring geometry. Thinner than the plain ring it replaces, to clear room for the bars. */
const OUTER = 15;
const INNER = 11.2;

/*
 * The gauge does not run a full circle: the mark has a break at the top right with the
 * live dot sitting in it, so the arc starts at the dot, sweeps clockwise all the way
 * round, and finishes back at the dot. Empty reads as "just the dot", full as a closed
 * ring. Angles are in degrees, measured counter-clockwise from 3 o'clock.
 */
const GAP_START = 25;
const SWEEP = 317;

/* Three bars, not the four in the web mark. Windows renders this at 16px, and at that
   size a fourth bar closes the gaps into a solid block. */
const BAR_W = 3.0;
const BAR_BASE = 20.6;
const BARS: Array<[number, number]> = [
  [11.3, 16.4],
  [15.5, 12.2],
  [19.7, 14.3],
];

const DOT_X = 24.45;
const DOT_Y = 6.07;
const DOT_R = 3.2;

/**
 * Rendered by supersampled coverage tests rather than a rasteriser: at this size that is
 * both simpler and sharper than pulling one in, and it is the only way the arc's leading
 * edge lands on a sub-pixel boundary instead of snapping to whole pixels.
 */
export function renderTrayIcon(percent: number | null, severity = severityFor(percent)): Buffer {
  const rgba = new Uint8Array(SIZE * SIZE * 4);
  const frac = percent == null ? 0 : Math.min(100, Math.max(0, percent)) / 100;
  const color = COLORS[severity];
  const SS = 3; // supersample factor per axis
  const total = SS * SS;

  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      let hitFill = 0; // the spent arc, plus the bars and the dot
      let hitTrack = 0; // the unspent arc

      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const px = x + (sx + 0.5) / SS - 0.5;
          const py = y + (sy + 0.5) / SS - 0.5;
          const dx = px - CX;
          const dy = py - CY;

          // The live dot and the bars are solid identity, never a proportion.
          if (Math.hypot(px - DOT_X, py - DOT_Y) <= DOT_R) {
            hitFill++;
            continue;
          }
          let inBar = false;
          for (const [bx, top] of BARS) {
            if (Math.abs(px - bx) <= BAR_W / 2 && py >= top && py <= BAR_BASE) {
              inBar = true;
              break;
            }
          }
          if (inBar) {
            hitFill++;
            continue;
          }

          const r = Math.hypot(dx, dy);
          if (r > OUTER || r < INNER) continue;

          // Degrees counter-clockwise from 3 o'clock, then re-expressed as distance
          // travelled clockwise from the start of the gauge.
          const deg = (Math.atan2(-dy, dx) * 180) / Math.PI;
          const t = (GAP_START - deg + 720) % 360;
          if (t > SWEEP) continue; // inside the break, where the dot lives

          if (t / SWEEP <= frac) hitFill++;
          else hitTrack++;
        }
      }

      if (hitFill === 0 && hitTrack === 0) continue;

      const i = (y * SIZE + x) * 4;
      const fillA = hitFill / total;
      const trackA = hitTrack / total;
      const alpha = fillA + trackA;
      // Blend the arc colour against the dimmer track where a pixel straddles both.
      const mix = (ch: 0 | 1 | 2) => (color[ch] * fillA + TRACK[ch] * trackA) / alpha;
      rgba[i] = Math.round(mix(0));
      rgba[i + 1] = Math.round(mix(1));
      rgba[i + 2] = Math.round(mix(2));
      rgba[i + 3] = Math.round(alpha * (trackA > fillA ? 150 : 255));
    }
  }

  return encodePng(SIZE, SIZE, rgba);
}

/** Icons are cached per 2% step; a tray icon cannot show finer detail than that. */
const cache = new Map<string, Buffer>();
export function trayIconFor(percent: number | null): Buffer {
  const sev = severityFor(percent);
  const bucket = percent == null ? -1 : Math.round(percent / 2) * 2;
  const key = `${sev}:${bucket}`;
  let icon = cache.get(key);
  if (!icon) {
    icon = renderTrayIcon(bucket < 0 ? null : bucket, sev);
    cache.set(key, icon);
  }
  return icon;
}

/*
 * The menu variant: a plain ring, no bars and no live dot.
 *
 * Those two are the app's identity, and identity is not what a row in the context menu
 * needs -- every row is already labelled, and what the eye wants there is "how full is
 * THIS one". At the 16px a menu icon gets they also turn to mud, where a bare ring with a
 * thicker stroke stays readable.
 */
const MENU_OUTER = 15;
const MENU_INNER = 9.5;

export function renderMenuGauge(percent: number | null, severity = severityFor(percent)): Buffer {
  const rgba = new Uint8Array(SIZE * SIZE * 4);
  const frac = percent == null ? 0 : Math.min(100, Math.max(0, percent)) / 100;
  const color = COLORS[severity];
  const SS = 3;
  const total = SS * SS;

  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      let hitFill = 0;
      let hitTrack = 0;

      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const px = x + (sx + 0.5) / SS - 0.5;
          const py = y + (sy + 0.5) / SS - 0.5;
          const dx = px - CX;
          const dy = py - CY;
          const r = Math.hypot(dx, dy);
          if (r > MENU_OUTER || r < MENU_INNER) continue;

          // A full circle here, unlike the tray mark: with no dot to mark the start, a
          // break would just read as a gap in the reading.
          const deg = (Math.atan2(-dy, dx) * 180) / Math.PI;
          const t = ((90 - deg + 720) % 360) / 360; // clockwise from 12 o'clock
          if (t <= frac) hitFill++;
          else hitTrack++;
        }
      }

      if (hitFill === 0 && hitTrack === 0) continue;

      const i = (y * SIZE + x) * 4;
      const fillA = hitFill / total;
      const trackA = hitTrack / total;
      const alpha = fillA + trackA;
      const mix = (ch: 0 | 1 | 2) => (color[ch] * fillA + TRACK[ch] * trackA) / alpha;
      rgba[i] = Math.round(mix(0));
      rgba[i + 1] = Math.round(mix(1));
      rgba[i + 2] = Math.round(mix(2));
      rgba[i + 3] = Math.round(alpha * (trackA > fillA ? 150 : 255));
    }
  }

  return encodePng(SIZE, SIZE, rgba);
}

/** Cached per 2% step, like the tray icon: a 16px ring cannot show finer detail. */
const menuCache = new Map<string, Buffer>();
export function menuGaugeFor(percent: number | null): Buffer {
  const sev = severityFor(percent);
  const bucket = percent == null ? -1 : Math.round(percent / 2) * 2;
  const key = `${sev}:${bucket}`;
  let icon = menuCache.get(key);
  if (!icon) {
    icon = renderMenuGauge(bucket < 0 ? null : bucket, sev);
    menuCache.set(key, icon);
  }
  return icon;
}
