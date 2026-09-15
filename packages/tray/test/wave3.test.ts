import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Limit } from '../src/limits.js';
import { loadPlacement, savePlacement } from '../src/pet/position.js';
import { loadPetSettings, savePetSettings } from '../src/pet/settings.js';
import {
  BUILTIN_SKINS,
  DEFAULT_PET_SETTINGS,
  DEFAULT_QUIET_HOURS,
  canAutonomouslyMove,
  clampPetToRect,
  classifyGesture,
  cornerAnchor,
  rectAround,
  createRoamingController,
  createSceneQueue,
  defaultPlacement,
  desktopOverlayBounds,
  displayForPoint,
  dockPoint,
  dockPointsFor,
  homeAnchor,
  isQuietHours,
  nearestValidPosition,
  parseClock,
  planTarget,
  priorityRank,
  protectedMoodColor,
  PROTECTED_SEVERITY_COLORS,
  recoverPlacement,
  resolvePetFrame,
  resolvePlacementDisplay,
  resolveScenePolicy,
  resolveSkin,
  resolveSkinAccessory,
  resolveSkinAsset,
  roamingConfigFor,
  safeRegionFor,
  sceneDedupeKey,
  sceneForEvent,
  scenesForEvents,
  setManualCooldown,
  skinsForCharacter,
  snapToDock,
  validatePlacement,
  validateSkin,
  visibleFraction,
  type PetDesktopContext,
  type PetDisplayInfo,
  type PetExclusionZone,
  type PetPlacement,
  type PetSettings,
} from '../src/presence/index.js';

/**
 * Wave 3 acceptance tests (08_qa/WAVE3_ACCEPTANCE_TEST_MATRIX.md). Every rule the desktop
 * layer relies on is asserted here rather than by watching a mascot.
 */

const NOW = Date.parse('2026-09-14T12:00:00Z');
const SIZE = 64;

/** Deterministic RNG so roaming policy tests never flake. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function display(
  id: string,
  primary: boolean,
  workArea: { x: number; y: number; width: number; height: number },
): PetDisplayInfo {
  return { id, primary, bounds: { ...workArea }, workArea: { ...workArea }, scaleFactor: 1 };
}

const PRIMARY = display('primary', true, { x: 0, y: 0, width: 1920, height: 1040 });
const SECONDARY = display('secondary', false, { x: 1920, y: 0, width: 1080, height: 1040 });

function zone(id: string, displayId: string, x: number, y: number, width: number, height: number): PetExclusionZone {
  return { id, displayId, x, y, width, height, enabled: true };
}

function ctx(over: Partial<PetDesktopContext> = {}): PetDesktopContext {
  const placement: PetPlacement = {
    displayId: 'primary',
    x: 500,
    y: 800,
    dock: null,
    homeX: null,
    homeY: null,
    updatedAt: NOW,
  };
  return {
    displays: [PRIMARY, SECONDARY],
    exclusionZones: [],
    placement,
    roaming: { ...roamingConfigFor(DEFAULT_PET_SETTINGS), mode: 'companion', localRadiusPx: 150 },
    quietHours: { ...DEFAULT_QUIET_HOURS },
    reducedMotion: false,
    userHovering: false,
    userDragging: false,
    bubbleExpanded: false,
    urgentInteractionActive: false,
    petVisible: true,
    ...over,
  };
}

/* --------------------------------------------------------------------- A. Bounds */

test('safe region insets the work area by the margin (taskbar already excluded)', () => {
  const region = safeRegionFor(PRIMARY, 16);
  assert.deepEqual(region, { x: 16, y: 16, width: 1888, height: 1008 });
  assert.equal(safeRegionFor(display('tiny', true, { x: 0, y: 0, width: 20, height: 20 }), 16), null);
});

test('edge clamp keeps the Pet fully on-screen and is idempotent (no correction loop)', () => {
  const clamped = clampPetToRect(5000, 5000, SIZE, PRIMARY.workArea);
  assert.deepEqual(clamped, { x: 1920 - SIZE, y: 1040 - SIZE });
  assert.deepEqual(clampPetToRect(clamped.x, clamped.y, SIZE, PRIMARY.workArea), clamped);
  assert.equal(visibleFraction({ x: clamped.x, y: clamped.y, width: SIZE, height: SIZE }, PRIMARY.workArea), 1);
});

test('a placement below the minimum visibility is invalid (roaming 85% rule)', () => {
  // Half the Pet hangs off the left edge.
  assert.equal(validatePlacement(-SIZE / 2, 500, SIZE, PRIMARY, []).valid, false);
  assert.equal(validatePlacement(500, 500, SIZE, PRIMARY, []).valid, true);
  assert.equal(validatePlacement(0, 500, SIZE, PRIMARY, []).valid, true);
});

test('an exclusion zone rejects a placement and the nearest valid point escapes it', () => {
  const zones = [zone('meeting', 'primary', 100, 100, 200, 200)];
  assert.equal(validatePlacement(150, 150, SIZE, PRIMARY, zones).valid, false);
  const fixed = nearestValidPosition(150, 150, SIZE, PRIMARY, zones, 16);
  assert.equal(validatePlacement(fixed.x, fixed.y, SIZE, PRIMARY, zones, 0.85).valid, true, 'must escape the zone');
  // Idempotent: re-running the repair must not keep moving the Pet.
  const again = nearestValidPosition(fixed.x, fixed.y, SIZE, PRIMARY, zones, 16);
  assert.deepEqual(again, fixed);
});

test('docked placements may show less than the roaming minimum (spec §4)', () => {
  const zones: PetExclusionZone[] = [];
  // A candidate 40% visible is rejected in roaming mode.
  assert.equal(validatePlacement(-SIZE + 26, 500, SIZE, PRIMARY, zones, 0.85).valid, false);
});

/* ------------------------------------------------------------------- B. Dragging */

test('click vs drag: tiny pointer travel stays a click, larger travel is a drag', () => {
  assert.equal(classifyGesture(100, 100, 103, 102, 6), 'click');
  assert.equal(classifyGesture(100, 100, 100, 105, 6), 'click');
  assert.equal(classifyGesture(100, 100, 107, 100, 6), 'drag');
  assert.equal(classifyGesture(100, 100, 100, 94, 6), 'drag');
});

test('a manual placement starts a cooldown during which roaming stays put', () => {
  setManualCooldown(300_000);
  let now = 1_000_000;
  const controller = createRoamingController({ now: () => now, rng: () => 0.99 });
  const c = ctx();
  assert.equal(controller.state, 'stationary');
  controller.onDragEnd(c, now);
  assert.equal(controller.state, 'cooldown');
  now += 60_000;
  assert.equal(controller.update(c, PRIMARY, SIZE), null, 'no autonomous move during the 5-min cooldown');
  assert.equal(controller.state, 'cooldown');
  now += 300_001;
  const command = controller.update(c, PRIMARY, SIZE);
  assert.ok(command, 'roaming resumes after the cooldown');
});

/* ------------------------------------------------------------------ C. Docking */

test('every named dock point is reachable, and only a close release snaps', () => {
  const points = dockPointsFor(PRIMARY, SIZE, 16);
  assert.equal(points.length, 8);
  const bottomRight = points.find((p) => p.dock === 'bottom-right')!;
  assert.deepEqual({ x: bottomRight.x, y: bottomRight.y }, { x: 1840, y: 960 });

  // Inside the 36px threshold snaps to that dock.
  assert.equal(snapToDock(1845, 955, SIZE, PRIMARY, 16, 36)?.dock, 'bottom-right');
  // Comfortably in open space does not.
  assert.equal(snapToDock(960, 500, SIZE, PRIMARY, 16, 36), null);
  // Custom (home) is only considered when a home point is supplied.
  assert.equal(snapToDock(300, 300, SIZE, PRIMARY, 16, 36, { x: 310, y: 305 })?.dock, 'custom');
});

test('Return Home resolves to the saved home, else the saved dock, else bottom-right', () => {
  const withHome: PetPlacement = {
    displayId: 'primary',
    x: 10,
    y: 10,
    dock: 'top-left',
    homeX: 400,
    homeY: 300,
    updatedAt: NOW,
  };
  assert.deepEqual(homeAnchor(withHome, PRIMARY, SIZE, 16), { x: 400, y: 300 });
  const dockOnly: PetPlacement = { ...withHome, homeX: null, homeY: null, dock: 'middle-right' };
  assert.deepEqual(homeAnchor(dockOnly, PRIMARY, SIZE, 16), dockPoint(PRIMARY, 'middle-right', SIZE, 16));
  const bare: PetPlacement = { ...withHome, homeX: null, homeY: null, dock: null };
  assert.deepEqual(homeAnchor(bare, PRIMARY, SIZE, 16), dockPoint(PRIMARY, 'bottom-right', SIZE, 16));
});

/* ------------------------------------------------------------- D. Multi-monitor */

test('the overlay covers the union of every work area', () => {
  const overlay = desktopOverlayBounds([PRIMARY, SECONDARY], PRIMARY.workArea, 'workArea');
  assert.deepEqual(overlay, { x: 0, y: 0, width: 3000, height: 1040 });
});

test('a saved placement on a secondary display is restored there', () => {
  const placement: PetPlacement = {
    displayId: 'secondary',
    x: 2000,
    y: 800,
    dock: null,
    homeX: null,
    homeY: null,
    updatedAt: NOW,
  };
  assert.equal(resolvePlacementDisplay(placement, [PRIMARY, SECONDARY])?.id, 'secondary');
  const recovered = recoverPlacement(placement, [PRIMARY, SECONDARY], SIZE, [], 16, NOW);
  assert.equal(recovered.displayId, 'secondary');
  assert.ok(validatePlacement(recovered.x, recovered.y, SIZE, SECONDARY, [], 0.85).valid);
});

test('a disconnected monitor moves the Pet to the primary without crashing', () => {
  const placement: PetPlacement = {
    displayId: 'gone',
    x: 2500,
    y: 800,
    dock: 'bottom-right',
    homeX: null,
    homeY: null,
    updatedAt: NOW,
  };
  const recovered = recoverPlacement(placement, [PRIMARY], SIZE, [], 16, NOW);
  assert.equal(recovered.displayId, 'primary');
  assert.ok(validatePlacement(recovered.x, recovered.y, SIZE, PRIMARY, [], 0.85).valid);
  assert.equal(recovered.dock, 'bottom-right', 'the dock preference is preserved');
});

test('a resolution change revalidates an off-screen placement instead of resetting it', () => {
  const placement: PetPlacement = {
    displayId: 'primary',
    x: 1900,
    y: 1030,
    dock: null,
    homeX: null,
    homeY: null,
    updatedAt: NOW,
  };
  // The display shrank; the old position is now mostly off-screen.
  const shrunk = display('primary', true, { x: 0, y: 0, width: 1280, height: 720 });
  const recovered = recoverPlacement(placement, [shrunk], SIZE, [], 16, NOW);
  assert.ok(validatePlacement(recovered.x, recovered.y, SIZE, shrunk, [], 0.85).valid);
  assert.equal(recovered.displayId, 'primary');
});

test('displayForPoint finds the monitor under a point, falling back to the primary', () => {
  assert.equal(displayForPoint([PRIMARY, SECONDARY], 2500, 500)?.id, 'secondary');
  assert.equal(displayForPoint([PRIMARY, SECONDARY], -50, 500)?.id, 'primary');
});

/* ------------------------------------------------------------------- E. Roaming */

test('autonomous movement is gated by mode, reduced motion, interaction, focus and quiet', () => {
  assert.equal(canAutonomouslyMove(ctx()), true);
  assert.equal(canAutonomouslyMove(ctx({ roaming: { ...ctx().roaming, mode: 'minimal' } })), false);
  assert.equal(canAutonomouslyMove(ctx({ reducedMotion: true })), false);
  assert.equal(canAutonomouslyMove(ctx({ userHovering: true })), false);
  assert.equal(canAutonomouslyMove(ctx({ userDragging: true })), false);
  assert.equal(canAutonomouslyMove(ctx({ bubbleExpanded: true })), false);
  assert.equal(canAutonomouslyMove(ctx({ urgentInteractionActive: true })), false);
  assert.equal(canAutonomouslyMove(ctx({ petVisible: false })), false);
  assert.equal(canAutonomouslyMove(ctx({ roaming: { ...ctx().roaming, lockPosition: true } })), false);
  assert.equal(
    canAutonomouslyMove(ctx({ quietHours: { ...DEFAULT_QUIET_HOURS, enabled: true, disableRoaming: true } })),
    false,
  );
});

test('roaming targets always stay inside the safe region and outside exclusion zones', () => {
  const rng = mulberry32(7);
  const zones = [zone('webcam', 'primary', 400, 400, 300, 300)];
  const base = ctx({ exclusionZones: zones, roaming: { ...ctx().roaming, mode: 'roaming' } });
  const region = safeRegionFor(PRIMARY, 16)!;
  for (let i = 0; i < 300; i++) {
    const target = planTarget({
      ctx: base,
      display: PRIMARY,
      size: SIZE,
      marginPx: 16,
      x: 500,
      y: 600,
      home: { x: 1800, y: 900 },
      rng,
    });
    if (!target) continue;
    assert.ok(target.x >= region.x && target.x + SIZE <= region.x + region.width, `x in region: ${target.x}`);
    assert.ok(target.y >= region.y && target.y + SIZE <= region.y + region.height, `y in region: ${target.y}`);
    const overlaps = target.x < 700 && 400 < target.x + SIZE && target.y < 700 && 400 < target.y + SIZE;
    assert.equal(overlaps, false, `target overlapped the exclusion zone at ${target.x},${target.y}`);
  }
});

test('Companion movement stays within the configured local radius', () => {
  const rng = mulberry32(11);
  const base = ctx();
  for (let i = 0; i < 100; i++) {
    const target = planTarget({
      ctx: base,
      display: PRIMARY,
      size: SIZE,
      marginPx: 16,
      x: 900,
      y: 700,
      home: { x: 900, y: 700 },
      rng,
    });
    if (!target) continue;
    const d = Math.hypot(target.x - 900, target.y - 700);
    assert.ok(d <= base.roaming.localRadiusPx + 0.001, `distance ${d} exceeded radius`);
  }
});

test('the roaming controller only fires after idle, then waits for the move to complete', () => {
  let now = 0;
  const controller = createRoamingController({ now: () => now, rng: () => 0.99 });
  const c = ctx();
  assert.equal(controller.update(c, PRIMARY, SIZE), null, 'nothing before the first idle window');
  now = controller.nextDecisionAt + 1;
  const command = controller.update(c, PRIMARY, SIZE);
  assert.ok(command, 'a burst is selected once the idle window elapses');
  assert.equal(controller.state, 'moving');
  controller.onMoveComplete(now);
  assert.equal(controller.state, 'stationary');
  now += 1_000;
  assert.equal(controller.update(c, PRIMARY, SIZE), null, 'no immediate second burst');
});

test('Minimal mode never produces a movement command', () => {
  let now = 10_000_000;
  const controller = createRoamingController({ now: () => now, rng: () => 0 });
  const c = ctx({ roaming: { ...ctx().roaming, mode: 'minimal' } });
  now += 10 * 60_000;
  assert.equal(controller.update(c, PRIMARY, SIZE), null);
});

test('an urgent interaction interrupts roaming until it clears', () => {
  let now = 0;
  const controller = createRoamingController({ now: () => now, rng: () => 0.99 });
  const c = ctx();
  controller.onUrgent(now);
  now = controller.nextDecisionAt + 1;
  const urgent = ctx({ urgentInteractionActive: true });
  assert.equal(controller.update(urgent, PRIMARY, SIZE), null);
  assert.equal(controller.state, 'stationary');
  // Once the context clears and the next window passes, roaming resumes.
  now += 1_000_000;
  assert.ok(controller.update(ctx(), PRIMARY, SIZE));
});

/* --------------------------------------------------- F. Notification scenes */

function limit(p: Partial<Limit> & { display_name: string; window_kind: string }): Limit {
  return {
    source_id: 1,
    used_percent: 20,
    resets_at: NOW + 3_600_000,
    origin: 'statusline-snapshot',
    ageSeconds: 5,
    burn: null,
    ...p,
  };
}

test('events map onto scene priorities, and activity-stop has no surface', () => {
  const provider = { key: 'claude', name: 'Claude', windowKind: 'weekly' } as never;
  assert.equal(sceneForEvent({ type: 'usage-half', ownerKey: 'claude', at: NOW, percent: 50 }, provider)?.priority, 'info');
  assert.equal(sceneForEvent({ type: 'warning', ownerKey: 'claude', at: NOW, percent: 81 }, provider)?.priority, 'warning');
  assert.equal(sceneForEvent({ type: 'critical', ownerKey: 'claude', at: NOW, percent: 96 }, provider)?.priority, 'critical');
  assert.equal(sceneForEvent({ type: 'reset', ownerKey: 'claude', at: NOW }, provider)?.priority, 'recovery');
  assert.equal(sceneForEvent({ type: 'activity-start', ownerKey: 'claude', at: NOW }, provider)?.priority, 'passive');
  assert.equal(sceneForEvent({ type: 'activity-stop', ownerKey: 'claude', at: NOW }, provider), null);
});

test('duplicate threshold data is deduped by provider/window/kind/step', () => {
  const queue = createSceneQueue();
  const scene = {
    id: 'event:warning',
    priority: 'warning' as const,
    ownerKey: 'claude',
    windowKind: 'weekly',
    step: 80,
    title: 'w',
    nativeNotification: true,
    sound: false,
  };
  assert.equal(queue.enqueue(scene, NOW), true);
  assert.equal(queue.enqueue(scene, NOW), false, 'the same event/window/step fires once');
  assert.equal(queue.hasSeen(sceneDedupeKey(scene)), true);
  // A different step is a different scene.
  assert.equal(queue.enqueue({ ...scene, step: 95 }, NOW), true);
});

test('critical preempts an informational scene; info is dropped when the queue is busy', () => {
  const queue = createSceneQueue();
  const info = {
    id: 'event:usage-half',
    priority: 'info' as const,
    ownerKey: 'a',
    title: 'i',
    nativeNotification: false,
    sound: false,
    autoDismissMs: 100,
  };
  const critical = { ...info, id: 'event:critical', priority: 'critical' as const, ownerKey: 'b', title: 'c' };
  const extraInfo = { ...info, ownerKey: 'c', title: 'i2' };

  assert.equal(queue.enqueue(info, NOW), true);
  assert.equal(queue.current(NOW)?.title, 'i');
  assert.equal(queue.enqueue(extraInfo, NOW), false, 'a second info is dropped while one is up');
  assert.equal(queue.enqueue(critical, NOW), true);
  assert.equal(queue.current(NOW)?.title, 'c', 'critical replaces the info scene');
});

test('a warning queues behind a critical and surfaces when it clears', () => {
  const queue = createSceneQueue();
  const critical = {
    id: 'event:critical',
    priority: 'critical' as const,
    ownerKey: 'a',
    title: 'crit',
    nativeNotification: true,
    sound: true,
    autoDismissMs: 100,
  };
  const warning = { ...critical, id: 'event:warning', priority: 'warning' as const, title: 'warn' };
  assert.equal(queue.enqueue(critical, NOW), true);
  assert.equal(queue.enqueue(warning, NOW), true);
  assert.equal(queue.queued, 1);
  assert.equal(queue.current(NOW)?.title, 'crit');
  assert.equal(queue.current(NOW + 1_000)?.title, 'warn');
});

test('quiet hours parse, wrap past midnight, and treat an empty window as disabled', () => {
  assert.equal(parseClock('22:00'), 1320);
  assert.equal(parseClock('7:05'), 425);
  assert.equal(parseClock('24:00'), null);
  assert.equal(parseClock('nonsense'), null);

  const config = { ...DEFAULT_QUIET_HOURS, enabled: true, startLocal: '22:00', endLocal: '07:00' };
  assert.equal(isQuietHours(config, new Date(2026, 8, 14, 23, 0)), true);
  assert.equal(isQuietHours(config, new Date(2026, 8, 14, 6, 59)), true);
  assert.equal(isQuietHours(config, new Date(2026, 8, 14, 7, 0)), false);
  assert.equal(isQuietHours(config, new Date(2026, 8, 14, 12, 0)), false);
  assert.equal(isQuietHours({ ...config, enabled: false }, new Date(2026, 8, 14, 23, 0)), false);
  assert.equal(isQuietHours({ ...config, startLocal: '08:00', endLocal: '08:00' }, new Date(2026, 8, 14, 8, 0)), false);
});

test('quiet hours suppress info bubbles/sounds and keep critical by policy', () => {
  const quiet = { ...DEFAULT_QUIET_HOURS, enabled: true, startLocal: '00:00', endLocal: '23:59' };
  const options = {
    quietHours: quiet,
    petAlerts: true,
    nativeAlerts: true,
    sounds: true,
    criticalOverride: false,
    now: new Date(2026, 8, 14, 12, 0),
  };
  const info = {
    id: 'event:usage-half',
    priority: 'info' as const,
    title: 'i',
    nativeNotification: false,
    sound: false,
  };
  const warning = { ...info, id: 'event:warning', priority: 'warning' as const, nativeNotification: true, sound: true };
  const critical = { ...warning, id: 'event:critical', priority: 'critical' as const };

  const infoPolicy = resolveScenePolicy(info, options);
  assert.equal(infoPolicy.showBubble, false);
  assert.equal(infoPolicy.native, false);
  assert.equal(infoPolicy.sound, false);

  const warningPolicy = resolveScenePolicy(warning, options);
  assert.equal(warningPolicy.native, false, 'suppressNativeWarning silences the native warning');
  assert.equal(warningPolicy.sound, false);

  const criticalPolicy = resolveScenePolicy(critical, options);
  assert.equal(criticalPolicy.showBubble, true, 'critical remains visually represented');
  assert.equal(criticalPolicy.native, true, 'critical native is allowed by default');
  assert.equal(criticalPolicy.sound, false, 'sounds stay off during quiet hours');
});

test('outside quiet hours warning and critical raise native notifications', () => {
  const options = {
    quietHours: { ...DEFAULT_QUIET_HOURS, enabled: false },
    petAlerts: true,
    nativeAlerts: true,
    sounds: true,
    criticalOverride: false,
    now: new Date(2026, 8, 14, 12, 0),
  };
  const warning = {
    id: 'event:warning',
    priority: 'warning' as const,
    title: 'w',
    nativeNotification: true,
    sound: false,
  };
  const policy = resolveScenePolicy(warning, options);
  assert.equal(policy.showBubble, true);
  assert.equal(policy.native, true);
  assert.equal(policy.quiet, false);
});

test('priority ranking orders passive < info < warning < critical < recovery', () => {
  assert.ok(priorityRank('passive') < priorityRank('info'));
  assert.ok(priorityRank('info') < priorityRank('warning'));
  assert.ok(priorityRank('warning') < priorityRank('critical'));
  assert.ok(priorityRank('critical') < priorityRank('recovery'));
});

/* -------------------------------------------------------------------- G. Skins */

test('built-in skins exist per character and always include a default', () => {
  for (const character of ['orbit_bot', 'pulse_fox', 'flux_blob', 'capsule_cat', 'nova', 'byte', 'mochi', 'kuro'] as const) {
    const skins = skinsForCharacter(character);
    assert.equal(skins.length, 4);
    assert.ok(skins.some((s) => s.id === 'default'));
    assert.ok(resolveSkin(character, 'midnight'));
  }
  assert.equal(BUILTIN_SKINS.length, 32);
});

test('a skin may not repurpose semantic colors', () => {
  assert.equal(validateSkin({
    id: 'midnight',
    characterId: 'orbit_bot',
    displayName: 'Midnight',
    version: 1,
    assets: {},
    preview: '/p.webp',
    palette: { primary: '#000' },
  }).ok, true);
  const bad = validateSkin({
    id: 'sneaky',
    characterId: 'orbit_bot',
    displayName: 'Sneaky',
    version: 1,
    assets: {},
    preview: '/p.webp',
    palette: { warning: '#0f0' },
  });
  assert.equal(bad.ok, false);
  assert.ok(bad.issues.some((i) => i.includes('palette.warning')));
  assert.equal(validateSkin({ id: 'x', characterId: 'dragon', displayName: 'X', version: 1, assets: {}, preview: 'p' }).ok, false);
});

test('a missing skin asset falls back to the default skin / manifest, never crashing', () => {
  const viaManifest = resolveSkinAsset('orbit_bot', 'midnight', 'healthy_idle', {
    healthy_idle: '/assets/pets/orbit-bot/idle.webp',
  });
  assert.equal(viaManifest.src, '/assets/pets/orbit-bot/idle.webp');
  assert.equal(viaManifest.fellBack, true);

  const nothing = resolveSkinAsset('orbit_bot', 'winter', 'critical_intro', null);
  assert.equal(nothing.src, null);
  assert.ok(nothing.skin, 'a skin is still returned so the renderer has a stable identity');
  assert.equal(nothing.fellBack, true);

  const unknownSkin = resolveSkinAsset('pulse_fox', 'does-not-exist', 'healthy_idle', null);
  assert.equal(unknownSkin.skin?.id, 'default');
});

test('status colors are protected from skins: warning stays amber, critical stays red', () => {
  assert.equal(protectedMoodColor('warning'), '#ffb020');
  assert.equal(protectedMoodColor('critical'), '#ff4d4f');
  assert.equal(protectedMoodColor('healthy'), '#22d3a7');
  assert.equal(PROTECTED_SEVERITY_COLORS.warn, '#ffb020');
  assert.equal(PROTECTED_SEVERITY_COLORS.crit, '#ff4d4f');
});

test('switching skin changes only presentation, never mood/focus/global severity', () => {
  const limits = [
    limit({ source_id: 1, display_name: 'Claude', subscription_key: 'claude', window_kind: 'weekly', used_percent: 92 }),
  ];
  const subscriptions = [
    { subscription_key: 'claude', subscription_display_name: 'Claude', state: 'active', telemetry: { latest_usage_at: null } },
  ];
  const base: PetSettings = { ...DEFAULT_PET_SETTINGS };
  const skinned: PetSettings = { ...DEFAULT_PET_SETTINGS, skin: 'midnight' };
  const a = resolvePetFrame({ limits, subscriptions, settings: base, now: NOW, activeOwnerKey: 'claude' });
  const b = resolvePetFrame({ limits, subscriptions, settings: skinned, now: NOW, activeOwnerKey: 'claude' });
  assert.equal(a.mood, b.mood);
  assert.equal(a.global.severity, b.global.severity);
  assert.equal(a.focus?.key, b.focus?.key);
  assert.equal(a.colorCss, b.colorCss, 'the engine color is unchanged by the skin');
});

/* --------------------------------------------------------------- H. Soak rules */

test('the roaming planner never targets off-screen or into an exclusion zone over many rolls', () => {
  const rng = mulberry32(2026);
  const zones = [zone('chat', 'secondary', 2000, 200, 400, 400)];
  const base = ctx({ exclusionZones: zones, roaming: { ...ctx().roaming, mode: 'roaming', allowCrossMonitor: true } });
  const region = safeRegionFor(SECONDARY, 16)!;
  for (let i = 0; i < 500; i++) {
    const target = planTarget({
      ctx: base,
      display: SECONDARY,
      size: SIZE,
      marginPx: 16,
      x: 2400,
      y: 800,
      home: { x: 2600, y: 900 },
      rng,
    });
    if (!target) continue;
    const display = target.x >= SECONDARY.bounds.x ? SECONDARY : PRIMARY;
    const r = safeRegionFor(display, 16)!;
    assert.ok(target.x >= r.x && target.x + SIZE <= r.x + r.width);
    assert.ok(target.y >= r.y && target.y + SIZE <= r.y + r.height);
  }
});

test('default placement lands bottom-right on the primary display', () => {
  const placement = defaultPlacement(PRIMARY, SIZE, 16, NOW);
  assert.equal(placement.displayId, 'primary');
  assert.deepEqual({ x: placement.x, y: placement.y }, dockPoint(PRIMARY, 'bottom-right', SIZE, 16));
  assert.equal(placement.dock, 'bottom-right');
});

/* --------------------------------------------------------- Persistence / migration */

function tempDir(prefix: string): string {
  return mkdtempSync(join(tmpdir(), prefix));
}

test('placement persistence round-trips dock/home and migrates the legacy v2 file', () => {
  const dir = tempDir('qp-pet-placement-');
  try {
    savePlacement(dir, {
      displayId: 'secondary',
      x: 2000,
      y: 800,
      dock: 'top-left',
      homeX: 100,
      homeY: 50,
      updatedAt: NOW,
    });
    const loaded = loadPlacement(dir)!;
    assert.deepEqual(
      { displayId: loaded.displayId, x: loaded.x, y: loaded.y, dock: loaded.dock, homeX: loaded.homeX },
      { displayId: 'secondary', x: 2000, y: 800, dock: 'top-left', homeX: 100 },
    );

    // A pre-Wave-3 file has only { displayId, x, y }; it must migrate, not reset.
    writeFileSync(join(dir, 'pet-position.json'), JSON.stringify({ displayId: 'primary', x: 10, y: 20 }), 'utf8');
    const migrated = loadPlacement(dir)!;
    assert.deepEqual(
      { displayId: migrated.displayId, x: migrated.x, y: migrated.y, dock: migrated.dock, homeX: migrated.homeX },
      { displayId: 'primary', x: 10, y: 20, dock: null, homeX: null },
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('wave3 settings round-trip and malformed values fall back to defaults', () => {
  const dir = tempDir('qp-pet-settings3-');
  try {
    const quiet = { ...DEFAULT_QUIET_HOURS, enabled: true, startLocal: '21:30', endLocal: '06:45' };
    savePetSettings(dir, {
      ...DEFAULT_PET_SETTINGS,
      lockPosition: true,
      allowCrossMonitor: true,
      stayNearCorner: true,
      skin: 'winter',
      quietHours: quiet,
    });
    const loaded = loadPetSettings(dir);
    assert.equal(loaded.lockPosition, true);
    assert.equal(loaded.allowCrossMonitor, true);
    assert.equal(loaded.stayNearCorner, true);
    assert.equal(loaded.skin, 'winter');
    assert.deepEqual(loaded.quietHours, quiet);

    // A file with junk in the new fields keeps the spec defaults instead of throwing.
    writeFileSync(
      join(dir, 'pet-settings.json'),
      JSON.stringify({
        ...DEFAULT_PET_SETTINGS,
        lockPosition: 'yes',
        allowCrossMonitor: 1,
        stayNearCorner: 'no',
        manualMoveCooldownMs: -5,
        quietHours: 42,
      }),
      'utf8',
    );
    const coerced = loadPetSettings(dir);
    assert.equal(coerced.lockPosition, false);
    assert.equal(coerced.allowCrossMonitor, false);
    assert.equal(coerced.stayNearCorner, false);
    assert.equal(coerced.manualMoveCooldownMs, DEFAULT_PET_SETTINGS.manualMoveCooldownMs);
    assert.deepEqual(coerced.quietHours, DEFAULT_QUIET_HOURS);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

/* -------------------------------------------------------- Zone capture & corner mode */

test('the excluded-area footprint covers the Pet plus padding and the Pet cannot stand there', () => {
  // A "Exclude area around Pet" command freezes this rect around the current spot.
  const rect = rectAround(500, 700, SIZE, 8);
  assert.deepEqual(rect, { x: 492, y: 692, width: 80, height: 80 });
  const displayZone: PetExclusionZone = { id: 'z1', displayId: 'primary', ...rect, enabled: true };
  assert.equal(validatePlacement(500, 700, SIZE, PRIMARY, [displayZone]).valid, false);
  const escaped = nearestValidPosition(500, 700, SIZE, PRIMARY, [displayZone], 16);
  assert.equal(validatePlacement(escaped.x, escaped.y, SIZE, PRIMARY, [displayZone], 0.85).valid, true);
});

test('stay near corner anchors to the docked corner, else the nearest region corner', () => {
  // Docked bottom-right is used as-is.
  assert.deepEqual(
    cornerAnchor(PRIMARY, SIZE, { x: 900, y: 500, dock: 'bottom-right' }, 16),
    dockPoint(PRIMARY, 'bottom-right', SIZE, 16),
  );
  // No dock: the nearest corner to a Pet sitting at the left edge is top-left.
  const nearest = cornerAnchor(PRIMARY, SIZE, { x: 40, y: 60, dock: null }, 16);
  assert.deepEqual(nearest, dockPoint(PRIMARY, 'top-left', SIZE, 16));
  // The nearest corner to center-left is middle... none exist below middle-left, so top-left
  // is still the answer for a pet near the top-left quadrant.
  const center = cornerAnchor(PRIMARY, SIZE, { x: 900, y: 490, dock: null }, 16);
  assert.ok(center, 'a corner anchor always exists');
});

test('stay-near-corner roaming targets cluster around the corner anchor', () => {
  const rng = mulberry32(31);
  const corner = cornerAnchor(PRIMARY, SIZE, { x: 900, y: 500, dock: 'bottom-right' }, 16)!;
  const base = ctx({
    roaming: { ...ctx().roaming, mode: 'roaming', stayNearCorner: true },
  });
  const region = safeRegionFor(PRIMARY, 16)!;
  for (let i = 0; i < 150; i++) {
    const target = planTarget({
      ctx: base,
      display: PRIMARY,
      size: SIZE,
      marginPx: 16,
      x: 1500,
      y: 900,
      home: { x: corner.x, y: corner.y },
      corner,
      rng,
    });
    if (!target) continue;
    const d = Math.hypot(target.x - corner.x, target.y - corner.y);
    assert.ok(d <= 220 + 0.001, `corner-radius drift: ${d}`);
    // Even with an exclusion zone between, targets still land inside the safe region.
    assert.ok(target.x >= region.x && target.x + SIZE <= region.x + region.width);
    assert.ok(target.y >= region.y && target.y + SIZE <= region.y + region.height);
  }
});

/* ----------------------------------------------------------------- Skin assets on disk */

const assetRoot = fileURLToPath(new URL('../assets', import.meta.url));

test('non-default skins ship a real accessory file on disk; the default skin ships none', () => {
  for (const character of ['orbit-bot', 'pulse-fox', 'flux-blob', 'capsule-cat'] as const) {
    for (const skin of ['midnight', 'winter', 'cinnamon'] as const) {
      const path = join(assetRoot, 'pets', character, 'skins', skin, 'accessory.svg');
      assert.ok(existsSync(path), `missing accessory: ${path}`);
    }
    assert.equal(existsSync(join(assetRoot, 'pets', character, 'skins', 'default', 'accessory.svg')), false);
  }
  const src = resolveSkinAccessory('orbit_bot', 'midnight');
  assert.equal(src, '/assets/pets/orbit-bot/skins/midnight/accessory.svg');
  assert.equal(resolveSkinAccessory('orbit_bot', 'default'), null, 'the default skin is the character itself');
  assert.equal(resolveSkinAsset('orbit_bot', 'midnight', 'healthy_idle', null).src, null, 'no clip: falls back to the character default asset');
});

/* ----------------------------------------------------------------- Soak (simulated) */

test('soak: two simulated hours of roaming stay in-region, out of zones, and cadence-bounded', () => {
  let now = 0;
  const controller = createRoamingController({ now: () => now, rng: mulberry32(99) });
  let placement: PetPlacement = defaultPlacement(PRIMARY, SIZE, 16, 0);
  const zones: PetExclusionZone[] = [zone('webcam', 'primary', 600, 600, 240, 240)];
  const region = safeRegionFor(PRIMARY, 16)!;
  let commands = 0;
  let previousCommandAt = 0;

  // Mirror the real tray: one controller tick every 4 seconds for 2 simulated hours.
  for (let step = 0; step < Math.floor((2 * 3_600_000) / 4_000); step++) {
    now += 4_000;
    const c: PetDesktopContext = ctx({ exclusionZones: zones, placement, roaming: { ...ctx().roaming, mode: 'roaming' } });
    const command = controller.update(c, PRIMARY, SIZE, 16);
    if (!command) continue;
    commands++;
    // Consecutive bursts respect the minimum idle window (capped by the 4s tick); the very
    // first burst may come earlier because the initial ramp is a short randomized 20-60s.
    if (previousCommandAt > 0) {
      assert.ok(now - previousCommandAt >= 45_000 - 4_000, `burst fired too soon at ${now}`);
    }
    const scheduled = controller.nextDecisionAt - now;
    assert.ok(scheduled >= 45_000 - 1 && scheduled <= 180_000, `idle window out of band: ${scheduled}`);

    const target = command.target;
    assert.ok(target.x >= region.x && target.x + SIZE <= region.x + region.width, `x out of region: ${target.x}`);
    assert.ok(target.y >= region.y && target.y + SIZE <= region.y + region.height, `y out of region: ${target.y}`);
    placement = { ...placement, x: target.x, y: target.y, updatedAt: now };
    previousCommandAt = now;
    controller.onMoveComplete(now);
  }
  assert.ok(commands > 0, 'roaming must have happened');
  assert.ok(commands <= Math.floor((2 * 3_600_000) / 45_000) + 1, `too many bursts: ${commands}`);
  // No off-screen drift and no parking inside the exclusion zone after 2 hours.
  assert.ok(validatePlacement(placement.x, placement.y, SIZE, PRIMARY, zones, 0.85).valid);
});
