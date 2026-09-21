/**
 * Pet window geometry and the small shared formatters.
 *
 * The mood/presence logic moved to `presence/` (docs/PET_MODE_V2_SPEC.md §40): this file
 * is deliberately pure geometry so the multi-DPI and taskbar-edge cases stay unit-testable
 * without Electron.
 */

/** A reset this close raises the countdown badge above the Pet. */
export const PET_POINT_WITHIN_MS = 15 * 60_000;

export function shortCountdown(ms: number): string {
  if (ms <= 0) return 'now';
  const s = Math.round(ms / 1000);
  if (s < 90) return `${s}s`;
  const m = Math.round(s / 60);
  if (m < 90) return `${m}m`;
  const h = Math.floor(m / 60);
  return m % 60 === 0 ? `${h}h` : `${h}h ${m % 60}m`;
}

export interface WorkArea {
  x: number;
  y: number;
  width: number;
  height: number;
}
export interface Rect extends WorkArea {}

export const PET_STRIP_HEIGHT = 72;
/** The window is taller than the pet band so bubbles and the badge are not clipped. */
export const PET_WINDOW_HEIGHT = 300;
export const PET_SPRITE_SIZE = 64;
export const PET_POPUP_WIDTH = 380;
export const PET_POPUP_HEIGHT = 520;
const EDGE_MARGIN = 8;

/** A full-width strip pinned to the bottom of the primary display's work area. */
export function petWindowBounds(workArea: WorkArea): Rect {
  return {
    x: workArea.x,
    y: workArea.y + workArea.height - PET_WINDOW_HEIGHT,
    width: workArea.width,
    height: PET_WINDOW_HEIGHT,
  };
}

/**
 * The popup opens directly above the Pet, horizontally centred on it, and is clamped to
 * the work area so it never runs off an edge or covers the taskbar (spec §36 / request 1).
 */
export function petPopupBounds(
  workArea: WorkArea,
  petRect: Rect | null,
  width = PET_POPUP_WIDTH,
  height = PET_POPUP_HEIGHT,
  gap = EDGE_MARGIN,
): Rect {
  const w = Math.min(width, Math.max(1, workArea.width - EDGE_MARGIN * 2));
  if (!petRect) {
    return {
      x: Math.round(workArea.x + (workArea.width - w) / 2),
      y: Math.round(workArea.y + EDGE_MARGIN),
      width: w,
      height: Math.min(height, Math.max(1, workArea.height - EDGE_MARGIN * 2)),
    };
  }

  const desiredX = petRect.x + petRect.width / 2 - w / 2;
  const x = Math.round(
    Math.min(Math.max(desiredX, workArea.x + EDGE_MARGIN), workArea.x + workArea.width - w - EDGE_MARGIN),
  );
  const above = Math.max(0, petRect.y - gap - (workArea.y + EDGE_MARGIN));
  const below = Math.max(
    0,
    workArea.y + workArea.height - EDGE_MARGIN - (petRect.y + petRect.height + gap),
  );
  const placeAbove = above >= height || (below < height && above >= below);
  const h = Math.min(height, Math.max(1, placeAbove ? above : below));
  const y = Math.round(placeAbove ? petRect.y - gap - h : petRect.y + petRect.height + gap);
  return { x, y, width: w, height: h };
}

/* ------------------------------------------------------------------ Roaming (spec §34) */

export interface DisplayArea extends WorkArea {
  id: string;
}

/**
 * The roaming window spans the UNION of every display so the Pet can walk from one monitor
 * onto the next. Its vertical band still follows the primary display's taskbar line, which
 * keeps the Pet on the same visual baseline as the non-roaming modes.
 */
export function roamWindowBounds(displays: WorkArea[], anchor: WorkArea): Rect {
  if (displays.length === 0) return petWindowBounds(anchor);
  const minX = Math.min(...displays.map((d) => d.x));
  const maxX = Math.max(...displays.map((d) => d.x + d.width));
  return {
    x: minX,
    y: anchor.y + anchor.height - PET_WINDOW_HEIGHT,
    width: Math.max(1, maxX - minX),
    height: PET_WINDOW_HEIGHT,
  };
}

export interface RoamZone {
  x0: number;
  x1: number;
}

/**
 * The x-ranges, in window-local pixels, where the Pet has actual screen under its feet.
 *
 * A display that does not reach the baseline band is excluded -- walking onto it would draw
 * the Pet where no monitor exists. Zones narrower than the sprite are dropped for the same
 * reason, and the gaps between monitors stay off-limits (the renderer hops across them).
 */
export function roamZones(displays: WorkArea[], window: Rect): RoamZone[] {
  const bandTop = window.y + PET_WINDOW_HEIGHT - PET_STRIP_HEIGHT;
  const bandBottom = window.y + PET_WINDOW_HEIGHT;
  return displays
    .filter((d) => d.y + d.height > bandTop && d.y < bandBottom)
    .map((d) => ({
      x0: Math.max(0, d.x - window.x),
      x1: Math.min(window.width, d.x + d.width - window.x),
    }))
    .filter((z) => z.x1 - z.x0 >= PET_SPRITE_SIZE)
    .sort((a, b) => a.x0 - b.x0);
}
