/**
 * Orbit Bot Motion Production Pilot contract. The reference boards in the pilot pack are
 * guides only; this manifest becomes authoritative once approved frame files are added.
 */

export const ORBIT_MOTION_CONTRACT_VERSION = 1 as const;
export const ORBIT_MOTION_PIVOT = { x: 0.5, y: 0.92 } as const;
export const ORBIT_MOTION_RUNTIME_SIZES = [512, 256] as const;

export const ORBIT_BOT_MOTION_CLIPS = [
  'idle_loop',
  'walk_right',
  'walk_left',
  'turn_right',
  'turn_left',
  'stop',
  'sit_down',
  'sit_idle',
  'lie_down',
  'sleep_loop',
  'wake_up',
  'stretch',
  'hover_react',
  'click_react',
  'talk_loop',
] as const;

export type OrbitBotMotionClipId = (typeof ORBIT_BOT_MOTION_CLIPS)[number];

export interface OrbitBotMotionClipSpec {
  frames: number;
  fps: number;
  loop: boolean;
}

export interface OrbitBotMotionPilotManifest {
  characterId: 'orbit_bot';
  pilot: true;
  assetContractVersion: 1;
  pivot: { x: 0.5; y: 0.92 };
  runtimeSizes: readonly [512, 256];
  animations: Record<OrbitBotMotionClipId, OrbitBotMotionClipSpec>;
}

export const ORBIT_BOT_MOTION_PILOT: OrbitBotMotionPilotManifest = {
  characterId: 'orbit_bot',
  pilot: true,
  assetContractVersion: ORBIT_MOTION_CONTRACT_VERSION,
  pivot: ORBIT_MOTION_PIVOT,
  runtimeSizes: ORBIT_MOTION_RUNTIME_SIZES,
  animations: {
    idle_loop: { frames: 8, fps: 8, loop: true },
    walk_right: { frames: 8, fps: 12, loop: true },
    walk_left: { frames: 8, fps: 12, loop: true },
    turn_right: { frames: 6, fps: 10, loop: false },
    turn_left: { frames: 6, fps: 10, loop: false },
    stop: { frames: 4, fps: 8, loop: false },
    sit_down: { frames: 6, fps: 10, loop: false },
    sit_idle: { frames: 6, fps: 8, loop: true },
    lie_down: { frames: 6, fps: 10, loop: false },
    sleep_loop: { frames: 8, fps: 6, loop: true },
    wake_up: { frames: 6, fps: 10, loop: false },
    stretch: { frames: 6, fps: 10, loop: false },
    hover_react: { frames: 4, fps: 10, loop: false },
    click_react: { frames: 4, fps: 10, loop: false },
    talk_loop: { frames: 8, fps: 8, loop: true },
  },
};

export interface OrbitMotionManifestIssue {
  path: string;
  message: string;
}

/** Canonical relative paths for one approved frame sequence. */
export function orbitMotionRuntimeFramePaths(
  clip: OrbitBotMotionClipId,
  size: (typeof ORBIT_MOTION_RUNTIME_SIZES)[number],
): string[] {
  const spec = ORBIT_BOT_MOTION_PILOT.animations[clip];
  return Array.from(
    { length: spec.frames },
    (_, index) =>
      `pets/orbit-bot/motion-pilot/runtime/${size}/${clip}/${clip}_${String(index + 1).padStart(3, '0')}.png`,
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Validate the pilot file without requiring final art files to exist yet. */
export function validateOrbitBotMotionPilot(raw: unknown): { ok: boolean; issues: OrbitMotionManifestIssue[] } {
  const issues: OrbitMotionManifestIssue[] = [];
  if (!isRecord(raw)) return { ok: false, issues: [{ path: '$', message: 'pilot manifest must be an object' }] };
  if (raw.characterId !== 'orbit_bot') issues.push({ path: 'characterId', message: 'pilot must target orbit_bot' });
  if (raw.pilot !== true) issues.push({ path: 'pilot', message: 'pilot must be true' });
  if (raw.assetContractVersion !== ORBIT_MOTION_CONTRACT_VERSION) issues.push({ path: 'assetContractVersion', message: 'unsupported motion contract version' });
  const pivot = raw.pivot;
  if (!isRecord(pivot) || pivot.x !== ORBIT_MOTION_PIVOT.x || pivot.y !== ORBIT_MOTION_PIVOT.y) {
    issues.push({ path: 'pivot', message: 'pivot must be exactly 0.5,0.92' });
  }
  if (!Array.isArray(raw.runtimeSizes) || raw.runtimeSizes.length !== 2 || raw.runtimeSizes.some((size) => size !== 512 && size !== 256)) {
    issues.push({ path: 'runtimeSizes', message: 'runtimeSizes must be [512,256]' });
  } else if (raw.runtimeSizes[0] !== ORBIT_MOTION_RUNTIME_SIZES[0] || raw.runtimeSizes[1] !== ORBIT_MOTION_RUNTIME_SIZES[1]) {
    issues.push({ path: 'runtimeSizes', message: 'runtimeSizes must be ordered exactly as [512,256]' });
  }
  if (!isRecord(raw.animations)) {
    issues.push({ path: 'animations', message: 'animations must be an object' });
  } else {
    for (const clip of ORBIT_BOT_MOTION_CLIPS) {
      const value = raw.animations[clip];
      const expected = ORBIT_BOT_MOTION_PILOT.animations[clip];
      if (!isRecord(value)) {
        issues.push({ path: `animations.${clip}`, message: 'clip specification missing' });
        continue;
      }
      if (value.frames !== expected.frames) issues.push({ path: `animations.${clip}.frames`, message: `frames must be exactly ${expected.frames}` });
      if (value.fps !== expected.fps) issues.push({ path: `animations.${clip}.fps`, message: `fps must be exactly ${expected.fps}` });
      if (value.loop !== expected.loop) issues.push({ path: `animations.${clip}.loop`, message: `loop must be exactly ${expected.loop}` });
      for (const key of Object.keys(value)) {
        if (key !== 'frames' && key !== 'fps' && key !== 'loop') {
          issues.push({ path: `animations.${clip}.${key}`, message: 'unexpected clip property' });
        }
      }
    }
    for (const clip of Object.keys(raw.animations)) {
      if (!(ORBIT_BOT_MOTION_CLIPS as readonly string[]).includes(clip)) {
        issues.push({ path: `animations.${clip}`, message: 'unexpected clip' });
      }
    }
  }
  return { ok: issues.length === 0, issues };
}
