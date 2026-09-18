import type {
  PetDisplayInfo,
  PetDockTarget,
  PetExclusionZone,
  PetPlacement,
  PetRect,
} from '../presence/types.js';

/**
 * Wave 3 desktop geometry (WAVE3_SCOPE.md, SAFE_ZONE_SPEC.md, MULTI_MONITOR_SPEC.md,
 * DOCK_AND_SNAP_SPEC.md).
 *
 * Pure functions only: no Electron, no filesystem. Every rule the roaming controller and
 * the drag handler depend on -- the safe region, what counts as visible enough, where the
 * dock points are, and how a placement recovers after a monitor disappears -- is decided
 * here so it can be asserted in a test instead of by watching a desktop mascot.
 */

/** Default inset from the work-area edges (SAFE_ZONE_SPEC.md §2). */
export const DEFAULT_SAFE_MARGIN_PX = 16;
/** Roaming requires this share of the Pet inside the work area (SAFE_ZONE_SPEC.md §5). */
export const MIN_VISIBLE_FRACTION = 0.85;
/** Drag release within this many logical px snaps to a dock (DOCK_AND_SNAP_SPEC.md §2). */
export const DOCK_SNAP_THRESHOLD_PX = 36;
/** Pointer travel above this becomes a drag rather than a click (DRAG_REPOSITION_SPEC.md §3). */
export const CLICK_DRAG_THRESHOLD_PX = 6;
/** A manual placement pauses autonomous movement for this long (spec default 5 min). */
export const MANUAL_MOVE_COOLDOWN_MS = 300_000;

export function isEnabledZone(zone: PetExclusionZone): boolean {
  return zone.enabled !== false;
}

export function distance(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(ax - bx, ay - by);
}

export function intersects(a: PetRect, b: PetRect): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

export function intersectionArea(a: PetRect, b: PetRect): number {
  const w = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x));
  const h = Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
  return w * h;
}

/** The Pet body's rectangle at a top-left position. `size` is the sprite's logical size. */
export function petRectAt(x: number, y: number, size: number): PetRect {
  return { x, y, width: size, height: size };
}

/**
 * The rectangle "around the Pet" at a position, padded on every side -- the footprint a user
 * freezes when they mark an exclusion zone from the Pet's current spot.
 */
export function rectAround(
  x: number,
  y: number,
  size: number,
  pad: number = 8,
): { x: number; y: number; width: number; height: number } {
  return { x: x - pad, y: y - pad, width: size + pad * 2, height: size + pad * 2 };
}

/**
 * The usable rectangle of a display: its work area (already excludes the taskbar) inset by
 * the configured margin. Returns null when the inset collapses the region, which the caller
 * treats as "no valid region" (SAFE_ZONE_SPEC.md §6) rather than silently clamping to zero.
 */
export function safeRegionFor(display: PetDisplayInfo, marginPx: number = DEFAULT_SAFE_MARGIN_PX): PetRect | null {
  const m = Math.max(0, marginPx);
  const region: PetRect = {
    x: display.workArea.x + m,
    y: display.workArea.y + m,
    width: display.workArea.width - m * 2,
    height: display.workArea.height - m * 2,
  };
  return region.width >= 1 && region.height >= 1 ? region : null;
}

/** The first enabled exclusion zone this rect overlaps, if any. */
export function overlappingZone(
  pet: PetRect,
  displayId: string,
  zones: readonly PetExclusionZone[],
): PetExclusionZone | null {
  for (const zone of zones) {
    if (!isEnabledZone(zone) || zone.displayId !== displayId) continue;
    if (intersects(pet, zone)) return zone;
  }
  return null;
}

/** Fraction of the Pet's body that sits inside a rectangle (0..1). */
export function visibleFraction(pet: PetRect, area: PetRect): number {
  const total = pet.width * pet.height;
  if (total <= 0) return 0;
  return intersectionArea(pet, area) / total;
}

export interface PlacementValidation {
  valid: boolean;
  /** Populated when invalid, for logging (never a user alert -- SAFE_ZONE_SPEC.md §6). */
  reason: 'visible' | 'exclusion' | 'display' | null;
}

/**
 * Validate a candidate Pet position against the safe-zone rules. Docked positions may show
 * less than `minVisible` (SAFE_ZONE_SPEC.md §4), which the caller expresses by lowering it.
 */
export function validatePlacement(
  x: number,
  y: number,
  size: number,
  display: PetDisplayInfo,
  zones: readonly PetExclusionZone[],
  minVisible: number = MIN_VISIBLE_FRACTION,
): PlacementValidation {
  const pet = petRectAt(x, y, size);
  if (visibleFraction(pet, display.workArea) < minVisible) return { valid: false, reason: 'visible' };
  if (overlappingZone(pet, display.id, zones)) return { valid: false, reason: 'exclusion' };
  return { valid: true, reason: null };
}

/** Clamp a top-left so the Pet body lies fully inside `area` (used for drag/dock release). */
export function clampPetToRect(x: number, y: number, size: number, area: PetRect): { x: number; y: number } {
  const maxX = area.x + Math.max(0, area.width - size);
  const maxY = area.y + Math.max(0, area.height - size);
  return {
    x: Math.round(Math.min(Math.max(x, area.x), Math.max(area.x, maxX))),
    y: Math.round(Math.min(Math.max(y, area.y), Math.max(area.y, maxY))),
  };
}

/**
 * Nudge a position out of any exclusion zone along the shortest axis, then clamp it back
 * into the work area. Deterministic, so recovery from a stale placement is repeatable.
 */
export function nearestValidPosition(
  x: number,
  y: number,
  size: number,
  display: PetDisplayInfo,
  zones: readonly PetExclusionZone[],
  marginPx: number = DEFAULT_SAFE_MARGIN_PX,
): { x: number; y: number } {
  let pos = clampPetToRect(x, y, size, display.workArea);
  let pet = petRectAt(pos.x, pos.y, size);
  for (let attempt = 0; attempt < zones.length + 1; attempt++) {
    const zone = overlappingZone(pet, display.id, zones);
    if (!zone) break;
    // Push out to the nearest face of the zone.
    const options = [
      { x: zone.x - size, y: pos.y },
      { x: zone.x + zone.width, y: pos.y },
      { x: pos.x, y: zone.y - size },
      { x: pos.x, y: zone.y + zone.height },
    ];
    let best = options[0]!;
    let bestDistance = Infinity;
    for (const option of options) {
      const d = distance(pos.x, pos.y, option.x, option.y);
      if (d < bestDistance) {
        bestDistance = d;
        best = option;
      }
    }
    pos = clampPetToRect(best.x, best.y, size, display.workArea);
    pet = petRectAt(pos.x, pos.y, size);
  }
  const region = safeRegionFor(display, marginPx);
  return region ? clampPetToRect(pos.x, pos.y, size, region) : pos;
}

/** A dock point's top-left, on the given display. `custom` needs the saved home point. */
export function dockPoint(
  display: PetDisplayInfo,
  dock: PetDockTarget,
  size: number,
  marginPx: number = DEFAULT_SAFE_MARGIN_PX,
  home?: { x: number; y: number } | null,
): { x: number; y: number } | null {
  const region = safeRegionFor(display, marginPx);
  if (!region) return null;
  const left = region.x;
  const right = region.x + region.width - size;
  const top = region.y;
  const bottom = region.y + region.height - size;
  const centerX = Math.round(region.x + (region.width - size) / 2);
  const centerY = Math.round(region.y + (region.height - size) / 2);
  switch (dock) {
    case 'top-left':
      return { x: left, y: top };
    case 'top-center':
      return { x: centerX, y: top };
    case 'top-right':
      return { x: right, y: top };
    case 'middle-left':
      return { x: left, y: centerY };
    case 'middle-right':
      return { x: right, y: centerY };
    case 'bottom-left':
      return { x: left, y: bottom };
    case 'bottom-center':
      return { x: centerX, y: bottom };
    case 'bottom-right':
      return { x: right, y: bottom };
    case 'custom':
      return home ? clampPetToRect(home.x, home.y, size, display.workArea) : null;
    default:
      return null;
  }
}

/** Every real (non-custom) dock point on a display. */
export function dockPointsFor(
  display: PetDisplayInfo,
  size: number,
  marginPx: number = DEFAULT_SAFE_MARGIN_PX,
): Array<{ dock: PetDockTarget; x: number; y: number }> {
  const targets = [
    'top-left',
    'top-center',
    'top-right',
    'middle-left',
    'middle-right',
    'bottom-left',
    'bottom-center',
    'bottom-right',
  ] as const;
  const points: Array<{ dock: PetDockTarget; x: number; y: number }> = [];
  for (const dock of targets) {
    const point = dockPoint(display, dock, size, marginPx);
    if (point) points.push({ dock, ...point });
  }
  return points;
}

/**
 * Snap a released position to the nearest dock point within `threshold`, if any
 * (DOCK_AND_SNAP_SPEC.md §2). Returns null when the release is in open space.
 */
export function snapToDock(
  x: number,
  y: number,
  size: number,
  display: PetDisplayInfo,
  marginPx: number = DEFAULT_SAFE_MARGIN_PX,
  threshold: number = DOCK_SNAP_THRESHOLD_PX,
  home?: { x: number; y: number } | null,
): { dock: PetDockTarget; x: number; y: number } | null {
  const candidates = dockPointsFor(display, size, marginPx);
  if (home) {
    const custom = dockPoint(display, 'custom', size, marginPx, home);
    if (custom) candidates.push({ dock: 'custom', ...custom });
  }
  let best: { dock: PetDockTarget; x: number; y: number } | null = null;
  let bestDistance = threshold;
  for (const candidate of candidates) {
    const d = distance(x, y, candidate.x, candidate.y);
    if (d <= bestDistance) {
      bestDistance = d;
      best = candidate;
    }
  }
  return best;
}

/** The display whose bounds contain a point, else the primary, else the first. */
export function displayForPoint(displays: readonly PetDisplayInfo[], x: number, y: number): PetDisplayInfo | null {
  const hit = displays.find(
    (d) =>
      x >= d.bounds.x &&
      x < d.bounds.x + d.bounds.width &&
      y >= d.bounds.y &&
      y < d.bounds.y + d.bounds.height,
  );
  return hit ?? displays.find((d) => d.primary) ?? displays[0] ?? null;
}

export function findDisplayById(displays: readonly PetDisplayInfo[], id: string | null): PetDisplayInfo | null {
  if (!id) return null;
  return displays.find((d) => d.id === id) ?? null;
}

/** Runtime policy: restore saved placements on the primary display only. */
export function resolvePlacementDisplay(
  _placement: PetPlacement,
  displays: readonly PetDisplayInfo[],
): PetDisplayInfo | null {
  return displays.find((d) => d.primary) ?? displays[0] ?? null;
}

/**
 * The placement's home point on a display: the explicit saved home when present, otherwise
 * the saved dock, otherwise the product default bottom-right safe position.
 */
export function homeAnchor(
  placement: Pick<PetPlacement, 'dock' | 'homeX' | 'homeY'>,
  display: PetDisplayInfo,
  size: number,
  marginPx: number = DEFAULT_SAFE_MARGIN_PX,
): { x: number; y: number } {
  const explicit =
    placement.homeX != null && placement.homeY != null ? { x: placement.homeX, y: placement.homeY } : null;
  if (explicit) {
    const anchor = dockPoint(display, 'custom', size, marginPx, explicit);
    if (anchor) return anchor;
  }
  const fallback = placement.dock ?? 'bottom-right';
  return dockPoint(display, fallback, size, marginPx) ?? { x: display.workArea.x, y: display.workArea.y };
}

/** The first-run placement: primary display, bottom-right safe position (spec §2). */
export function defaultPlacement(
  display: PetDisplayInfo,
  size: number,
  marginPx: number = DEFAULT_SAFE_MARGIN_PX,
  now: number = Date.now(),
): PetPlacement {
  const point = dockPoint(display, 'bottom-right', size, marginPx) ?? { x: display.workArea.x, y: display.workArea.y };
  return { displayId: display.id, x: point.x, y: point.y, dock: 'bottom-right', homeX: point.x, homeY: point.y, updatedAt: now };
}

/**
 * Revalidate a saved placement against the current display layout, repairing the cases the
 * acceptance matrix calls out: a disconnected monitor, a resolution/DPI change, and a stale
 * position that is no longer visible (MULTI_MONITOR_SPEC.md §5–§7).
 */
export function recoverPlacement(
  placement: PetPlacement,
  displays: readonly PetDisplayInfo[],
  size: number,
  zones: readonly PetExclusionZone[],
  marginPx: number = DEFAULT_SAFE_MARGIN_PX,
  now: number = Date.now(),
): PetPlacement {
  const display = resolvePlacementDisplay(placement, displays);
  if (!display) return placement;

  const onSavedDisplay = findDisplayById(displays, placement.displayId) != null;
  const check = validatePlacement(placement.x, placement.y, size, display, zones, 0.5);
  if (onSavedDisplay && check.valid) {
    return { ...placement, displayId: display.id };
  }

  // The monitor vanished, the position is no longer visible, or it sits in an exclusion
  // zone: fall back to the nearest valid point, preserving the dock when one was set.
  const fixed = homeAnchor(placement, display, size, marginPx);
  const valid = nearestValidPosition(fixed.x, fixed.y, size, display, zones, marginPx);
  return { ...placement, displayId: display.id, x: valid.x, y: valid.y, updatedAt: now };
}

/**
 * The window rectangle covering the whole desktop: the union of every display's bounds.
 * The Pet is one transparent, click-through overlay rather than a per-monitor window, which
 * is what lets a single sprite be dragged and docked anywhere (MULTI_MONITOR_SPEC.md §5).
 */
export function desktopOverlayBounds(
  displays: readonly PetDisplayInfo[],
  fallback: PetRect,
  area: 'bounds' | 'workArea' = 'workArea',
): PetRect {
  if (displays.length === 0) return fallback;
  const rects = displays.map((d) => (area === 'bounds' ? d.bounds : d.workArea));
  const minX = Math.min(...rects.map((r) => r.x));
  const minY = Math.min(...rects.map((r) => r.y));
  const maxX = Math.max(...rects.map((r) => r.x + r.width));
  const maxY = Math.max(...rects.map((r) => r.y + r.height));
  return { x: minX, y: minY, width: Math.max(1, maxX - minX), height: Math.max(1, maxY - minY) };
}
