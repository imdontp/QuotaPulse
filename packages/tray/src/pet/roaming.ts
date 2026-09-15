import type { PetDesktopContext, PetDisplayInfo, PetExclusionZone, PetRect } from '../presence/types.js';
import {
  CLICK_DRAG_THRESHOLD_PX,
  DEFAULT_SAFE_MARGIN_PX,
  clampPetToRect,
  displayForPoint,
  dockPoint,
  dockPointsFor,
  overlappingZone,
  petRectAt,
  safeRegionFor,
} from './desktop.js';

/**
 * Wave 3 roaming controller (ROAMING_ENGINE_SPEC.md, ROAMING_STATE_MACHINE.md).
 *
 * Roaming is a POSITION controller, never an animation state: it decides whether, when and
 * where the Pet may move. The renderer still owns how a walk looks. The controller is pure,
 * so "may the Pet walk right now, and why not" is a test assertion rather than a desktop
 * observation.
 */

export type PetRoamState =
  | 'stationary'
  | 'select-target'
  | 'turning'
  | 'moving'
  | 'stopping'
  | 'dragging'
  | 'interrupted'
  | 'recovering'
  | 'cooldown';

/** Weighted target policy (ROAMING_ENGINE_SPEC.md §5). */
export type RoamMoveKind = 'idle' | 'short' | 'medium' | 'home';

const MOVE_WEIGHTS: ReadonlyArray<{ kind: RoamMoveKind; weight: number }> = [
  { kind: 'idle', weight: 45 },
  { kind: 'short', weight: 25 },
  { kind: 'medium', weight: 20 },
  { kind: 'home', weight: 10 },
];

/** Roaming burst travel bands (spec §2): scaled down for small displays by the planner. */
export const ROAM_SHORT_MIN_PX = 80;
export const ROAM_SHORT_MAX_PX = 200;
export const ROAM_MEDIUM_MIN_PX = 200;
export const ROAM_MEDIUM_MAX_PX = 500;

/**
 * The Wave 3 runtime contract (`canAutonomouslyMove`) plus the two policies it leaves to the
 * product: quiet hours may disable motion, and a hidden Pet must not wander.
 */
export function canAutonomouslyMove(ctx: PetDesktopContext): boolean {
  if (ctx.reducedMotion) return false;
  if (ctx.roaming.lockPosition) return false;
  if (ctx.roaming.mode === 'minimal') return false;
  if (ctx.userHovering || ctx.userDragging || ctx.bubbleExpanded) return false;
  if (ctx.urgentInteractionActive) return false;
  if (!ctx.petVisible) return false;
  if (ctx.quietHours.enabled && ctx.quietHours.disableRoaming) return false;
  return true;
}

/** Pick a move kind from the spec's weighted distribution. */
export function chooseMoveKind(rng: () => number = Math.random): RoamMoveKind {
  const total = MOVE_WEIGHTS.reduce((sum, entry) => sum + entry.weight, 0);
  let roll = rng() * total;
  for (const entry of MOVE_WEIGHTS) {
    if (roll < entry.weight) return entry.kind;
    roll -= entry.weight;
  }
  return 'idle';
}

export interface RoamTarget {
  kind: RoamMoveKind;
  x: number;
  y: number;
  /** True when the target lies on a different display than the current one. */
  crossMonitor: boolean;
}

export interface PlanTargetInput {
  ctx: PetDesktopContext;
  display: PetDisplayInfo;
  size: number;
  marginPx?: number;
  /** The Pet's current top-left. */
  x: number;
  y: number;
  /** The home/dock anchor the `home` kind returns toward. */
  home: { x: number; y: number };
  /**
   * The corner to bias toward, when `ctx.roaming.stayNearCorner` is on and a corner anchor
   * exists (the docked corner, else the nearest corner of the safe region).
   */
  corner?: { x: number; y: number } | null;
  rng?: () => number;
  /** Sign of the last horizontal move, used to avoid marching the same way forever. */
  lastDirection?: -1 | 0 | 1;
}

/** A random point inside a rectangle, keeping the whole Pet inside. */
function randomPointIn(region: PetRect, size: number, rng: () => number): { x: number; y: number } {
  const maxX = Math.max(region.x, region.x + region.width - size);
  const maxY = Math.max(region.y, region.y + region.height - size);
  return { x: Math.round(region.x + rng() * (maxX - region.x)), y: Math.round(region.y + rng() * (maxY - region.y)) };
}

/**
 * Choose the next roaming target. Returns null only when the move kind was `idle` or no safe
 * region exists. Candidate points are rejected when they overlap an exclusion zone, and a
 * target that repeats the previous direction is mirrored so the Pet does not drift one way.
 */
export function planTarget(input: PlanTargetInput): RoamTarget | null {
  const { ctx, size, x, y, home } = input;
  const rng = input.rng ?? Math.random;
  const margin = input.marginPx ?? DEFAULT_SAFE_MARGIN_PX;
  const kind = chooseMoveKind(rng);
  if (kind === 'idle') return null;

  // Cross-monitor is opt-in and only ever targets a display that is actually walkable. Home
  // is special: it follows its saved absolute anchor, never a random monitor selected for a
  // normal roaming burst.
  const homeDisplay =
    kind === 'home'
      ? displayContaining(ctx.displays, home.x + size / 2, home.y + size / 2) ?? input.display
      : null;
  const targetDisplay =
    homeDisplay ??
    (ctx.roaming.mode === 'roaming' && ctx.roaming.allowCrossMonitor && ctx.displays.length > 1 && rng() < 0.35
      ? ctx.displays[Math.floor(rng() * ctx.displays.length)]!
      : input.display);

  if (kind === 'home') {
    const point = clampToDisplay(home.x, home.y, size, targetDisplay, margin);
    if (!pathClear({ x, y }, point, size, ctx, margin)) return null;
    return { kind, x: point.x, y: point.y, crossMonitor: targetDisplay.id !== input.display.id };
  }

  const region = safeRegionFor(targetDisplay, margin);
  if (!region) return null;

  // Corner mode (SAFE_ZONE_SPEC.md "stay near corner"): targets cluster around the corner
  // anchor instead of roaming the whole region.
  const corner = input.corner ?? null;
  const nearCorner = !!(ctx.roaming.stayNearCorner && corner);

  const companion = ctx.roaming.mode === 'companion';
  let candidate: { x: number; y: number } | null = null;
  for (let attempt = 0; attempt < 8 && !candidate; attempt++) {
    candidate = nearCorner
      ? cornerCandidate(corner, region, size, rng)
      : companion
        ? companionCandidate(x, y, ctx.roaming.localRadiusPx, region, size, rng)
        : roamingCandidate(x, y, kind, region, size, rng, ctx.displays);
    if (
      candidate &&
      (overlappingZone(petRectAt(candidate.x, candidate.y, size), targetDisplay.id, ctx.exclusionZones) ||
        !pathClear({ x, y }, candidate, size, ctx, margin))
    ) {
      candidate = null;
    }
  }
  if (!candidate) {
    // Fallback (SAFE_ZONE_SPEC.md §6): stay put rather than roam into a forbidden region.
    const fallback = clampToDisplay(nearCorner ? corner!.x : home.x, nearCorner ? corner!.y : home.y, size, targetDisplay, margin);
    candidate = pathClear({ x, y }, fallback, size, ctx, margin) ? fallback : null;
  }

  if (!candidate) return null;

  // Avoid repeating the same direction: mirror around the Pet when the sample continues it.
  // Skipped in corner mode, which must keep the Pet near its anchor even at long idle.
  const lastDirection = input.lastDirection ?? 0;
  let dx = candidate.x - x;
  if (!nearCorner && lastDirection !== 0 && Math.sign(dx) === lastDirection && rng() < 0.5) {
    const mirrored = x - dx;
    const mirroredPoint = clampToDisplay(mirrored, candidate.y, size, targetDisplay, margin);
    if (
      !overlappingZone(petRectAt(mirroredPoint.x, mirroredPoint.y, size), targetDisplay.id, ctx.exclusionZones) &&
      pathClear({ x, y }, mirroredPoint, size, ctx, margin)
    ) {
      candidate = mirroredPoint;
      dx = candidate.x - x;
    }
  }

  return {
    kind,
    x: candidate.x,
    y: candidate.y,
    crossMonitor: targetDisplay.id !== input.display.id,
  };
}

function displayContaining(displays: readonly PetDisplayInfo[], x: number, y: number): PetDisplayInfo | null {
  return (
    displays.find(
      (display) =>
        x >= display.bounds.x &&
        x < display.bounds.x + display.bounds.width &&
        y >= display.bounds.y &&
        y < display.bounds.y + display.bounds.height,
    ) ?? null
  );
}

/**
 * A straight-line walk is valid only when every sampled sprite rectangle remains inside one
 * safe display region and outside exclusion zones. This rejects monitor gaps and forbidden
 * windows before a cross-monitor command can turn into a visible warp.
 */
export function pathClear(
  from: { x: number; y: number },
  to: { x: number; y: number },
  size: number,
  ctx: PetDesktopContext,
  marginPx: number = DEFAULT_SAFE_MARGIN_PX,
): boolean {
  const distance = Math.hypot(to.x - from.x, to.y - from.y);
  const steps = Math.max(1, Math.ceil(distance / Math.max(24, size / 2)));
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const x = from.x + (to.x - from.x) * t;
    const y = from.y + (to.y - from.y) * t;
    const display = displayContaining(ctx.displays, x + size / 2, y + size / 2);
    if (!display) return false;
    const region = safeRegionFor(display, marginPx);
    if (!region || !containsRect(region, petRectAt(x, y, size))) return false;
    if (overlappingZone(petRectAt(x, y, size), display.id, ctx.exclusionZones)) return false;
  }
  return true;
}

function containsRect(area: PetRect, rect: PetRect): boolean {
  return (
    rect.x >= area.x &&
    rect.y >= area.y &&
    rect.x + rect.width <= area.x + area.width &&
    rect.y + rect.height <= area.y + area.height
  );
}

function clampToDisplay(
  x: number,
  y: number,
  size: number,
  display: PetDisplayInfo,
  margin: number,
): { x: number; y: number } {
  const region = safeRegionFor(display, margin);
  return region ? clampPetToRect(x, y, size, region) : clampPetToRect(x, y, size, display.workArea);
}

/** A random point within the corner anchor's neighborhood, clamped to the safe region. */
function cornerCandidate(
  corner: { x: number; y: number },
  region: PetRect,
  size: number,
  rng: () => number,
): { x: number; y: number } {
  const span = Math.min(region.width, region.height);
  const radius = Math.max(80, Math.min(220, span * 0.35));
  const angle = rng() * Math.PI * 2;
  const distance = radius * rng();
  return clampPetToRect(corner.x + Math.cos(angle) * distance, corner.y + Math.sin(angle) * distance, size, region);
}

/**
 * The corner anchor for "stay near corner": the docked corner when one is set, otherwise
 * the nearest of the four region corners. Only ever called when a corner exists to use.
 */
export function cornerAnchor(
  display: PetDisplayInfo,
  size: number,
  placement: { x: number; y: number; dock: string | null },
  marginPx: number = DEFAULT_SAFE_MARGIN_PX,
): { x: number; y: number } | null {
  const cornerDocks = ['top-left', 'top-right', 'bottom-left', 'bottom-right'] as const;
  if (placement.dock && (cornerDocks as readonly string[]).includes(placement.dock)) {
    return dockPoint(display, placement.dock as 'top-left', size, marginPx);
  }
  const corners = dockPointsFor(display, size, marginPx).filter((p) =>
    (cornerDocks as readonly string[]).includes(p.dock),
  );
  let best = corners[0];
  for (const point of corners) {
    const dBest = Math.hypot(best!.x - placement.x, best!.y - placement.y);
    const dPoint = Math.hypot(point.x - placement.x, point.y - placement.y);
    if (dPoint < dBest) best = point;
  }
  return best ? { x: best.x, y: best.y } : null;
}

function companionCandidate(
  x: number,
  y: number,
  radius: number,
  region: PetRect,
  size: number,
  rng: () => number,
): { x: number; y: number } {
  const r = Math.max(20, radius);
  const angle = rng() * Math.PI * 2;
  const distance = r * (0.25 + rng() * 0.75);
  return clampPetToRect(x + Math.cos(angle) * distance, y + Math.sin(angle) * distance, size, region);
}

function roamingCandidate(
  x: number,
  y: number,
  kind: RoamMoveKind,
  region: PetRect,
  size: number,
  rng: () => number,
  displays: readonly PetDisplayInfo[],
): { x: number; y: number } {
  // Burst travel is capped by the smaller safe dimension so a short monitor cannot produce a
  // target the clamp then silently truncates.
  const span = Math.min(region.width, region.height);
  const [min, max] =
    kind === 'short'
      ? [ROAM_SHORT_MIN_PX, Math.min(ROAM_SHORT_MAX_PX, span)]
      : [ROAM_MEDIUM_MIN_PX, Math.min(ROAM_MEDIUM_MAX_PX, span)];
  const distance = Math.max(0, min) + rng() * Math.max(0, max - min);
  const angle = rng() * Math.PI * 2;
  void displays;
  return clampPetToRect(x + Math.cos(angle) * distance, y + Math.sin(angle) * distance, size, region);
}

/* -------------------------------------------------------------------- Drag gesture */

export type PointerGesture = 'click' | 'drag';

/**
 * A small pointer wobble must stay a click (DRAG_REPOSITION_SPEC.md §3): the drag starts
 * only once travel exceeds the threshold on either axis.
 */
export function classifyGesture(
  startX: number,
  startY: number,
  currentX: number,
  currentY: number,
  threshold: number = CLICK_DRAG_THRESHOLD_PX,
): PointerGesture {
  return Math.max(Math.abs(currentX - startX), Math.abs(currentY - startY)) >= threshold ? 'drag' : 'click';
}

/* ------------------------------------------------------------------ State machine */

export interface RoamCommand {
  state: PetRoamState;
  target: RoamTarget;
}

export interface RoamingControllerOptions {
  rng?: () => number;
  now?: () => number;
}

export interface RoamingController {
  readonly state: PetRoamState;
  /** Epoch ms before which no new burst is selected. */
  readonly nextDecisionAt: number;
  readonly cooldownUntil: number;
  /** Called each tick; returns a target only when a move is due and allowed. */
  update(ctx: PetDesktopContext, display: PetDisplayInfo, size: number, marginPx?: number): RoamCommand | null;
  onMoveComplete(now?: number): void;
  onDragStart(now?: number): void;
  onDragEnd(ctx: PetDesktopContext, now?: number): void;
  onUrgent(now?: number): void;
  onGeometryChanged(now?: number): void;
  onRecovered(now?: number): void;
  reset(now?: number): void;
}

/**
 * The roaming state machine (ROAMING_STATE_MACHINE.md). It is deliberately independent of
 * mood: a warning Pet can still be stationary and a healthy Pet can still be roaming.
 */
export function createRoamingController(options: RoamingControllerOptions = {}): RoamingController {
  const rng = options.rng ?? Math.random;
  const clock = options.now ?? Date.now;
  let state: PetRoamState = 'stationary';
  let nextDecisionAt = clock() + idleDelay();
  let cooldownUntil = 0;
  let lastDirection: -1 | 0 | 1 = 0;

  function idleDelay(): number {
    // A short randomized ramp before the first decision; the steady-state window is the
    // configured min/max idle (45-180s) and is applied once a burst completes.
    return 20_000 + rng() * 40_000;
  }

  return {
    get state() {
      return state;
    },
    get nextDecisionAt() {
      return nextDecisionAt;
    },
    get cooldownUntil() {
      return cooldownUntil;
    },

    update(ctx, display, size, marginPx = DEFAULT_SAFE_MARGIN_PX) {
      const now = clock();
      if (state === 'dragging') return null;
      if (!canAutonomouslyMove(ctx)) {
        // Reduced motion / lock / quiet hours collapse straight back to stationary.
        state = 'stationary';
        return null;
      }
      if (now < cooldownUntil) {
        state = 'cooldown';
        return null;
      }
      if (now < nextDecisionAt) {
        if (state === 'cooldown' || state === 'interrupted' || state === 'recovering') state = 'stationary';
        return null;
      }
      state = 'select-target';
      const placement = ctx.placement;
      const targetDisplay =
        displayForPoint(ctx.displays, placement.x, placement.y) ?? display;
      const home = {
        x: placement.homeX ?? targetDisplay.workArea.x,
        y: placement.homeY ?? targetDisplay.workArea.y,
      };
      const target = planTarget({
        ctx,
        display: targetDisplay,
        size,
        marginPx,
        x: placement.x,
        y: placement.y,
        home,
        // "Stay near corner": docked corner wins, else the nearest region corner.
        corner: ctx.roaming.stayNearCorner
          ? cornerAnchor(targetDisplay, size, placement, marginPx)
          : null,
        rng,
        lastDirection,
      });
      // Always reschedule, even for an `idle` roll, so the cadence never turns into a busy
      // loop when every sample decides to stay still.
      nextDecisionAt = now + idleWindow(ctx, rng);
      if (!target) {
        // An `idle` roll: stay put, but the next decision is already scheduled above.
        state = 'stationary';
        return null;
      }
      state = 'moving';
      lastDirection = Math.sign(target.x - placement.x) as -1 | 0 | 1;
      return { state, target };
    },

    onMoveComplete(now = clock()) {
      state = 'stationary';
      nextDecisionAt = now + idleWindow(null, rng);
    },

    onDragStart(now = clock()) {
      state = 'dragging';
      void now;
    },

    onDragEnd(_ctx, now = clock()) {
      cooldownUntil = now + manualCooldownMs;
      state = 'cooldown';
      nextDecisionAt = cooldownUntil;
    },

    onUrgent(now = clock()) {
      state = 'interrupted';
      nextDecisionAt = now + idleDelay();
    },

    onGeometryChanged(now = clock()) {
      state = 'recovering';
      nextDecisionAt = now + 1_000;
    },

    onRecovered(now = clock()) {
      state = 'stationary';
      nextDecisionAt = now + idleDelay();
    },

    reset(now = clock()) {
      state = 'stationary';
      cooldownUntil = 0;
      nextDecisionAt = now + idleDelay();
      lastDirection = 0;
    },
  };
}

function idleWindow(ctx: PetDesktopContext | null, rng: () => number): number {
  const min = ctx?.roaming.minIdleBeforeMoveMs ?? 45_000;
  const max = ctx?.roaming.maxIdleBeforeMoveMs ?? 180_000;
  return Math.max(min, min + rng() * Math.max(0, max - min));
}

/**
 * The manual-placement cooldown is 5 minutes by default; the controller has no settings
 * object, so the caller injects the resolved value once at start (`setManualCooldown`).
 */
let manualCooldownMs = 300_000;
export function setManualCooldown(ms: number): void {
  manualCooldownMs = Number.isFinite(ms) && ms >= 0 ? ms : 300_000;
}
