import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  ORBIT_BOT_MOTION_CLIPS,
  ORBIT_BOT_MOTION_PILOT,
  orbitMotionRuntimeFramePaths,
  validateOrbitBotMotionPilot,
} from '../src/pet/orbit-motion.js';

const PILOT_PATH = fileURLToPath(new URL('../assets/pets/orbit-bot/motion-pilot.json', import.meta.url));
const ORBIT_DIR = dirname(PILOT_PATH);
const PET_HTML_PATH = fileURLToPath(new URL('../src/pet.html', import.meta.url));
const MAIN_PATH = fileURLToPath(new URL('../src/main.ts', import.meta.url));
const PRESENCE_TYPES_PATH = fileURLToPath(new URL('../src/presence/types.ts', import.meta.url));

test('Orbit Bot motion pilot contains the approved 15-clip contract', () => {
  const raw = JSON.parse(readFileSync(PILOT_PATH, 'utf8')) as unknown;
  const validation = validateOrbitBotMotionPilot(raw);
  assert.equal(validation.ok, true, JSON.stringify(validation.issues));
  assert.deepEqual(Object.keys((raw as { animations: object }).animations), [...ORBIT_BOT_MOTION_CLIPS]);
  assert.deepEqual((raw as { pivot: object }).pivot, { x: 0.5, y: 0.92 });
  assert.deepEqual((raw as { runtimeSizes: number[] }).runtimeSizes, [512, 256]);
  const frames = Object.values(ORBIT_BOT_MOTION_PILOT.animations).reduce((sum, clip) => sum + clip.frames, 0);
  assert.equal(frames, 94);
});

test('approved idle loop ships eight grounded transparent frames at every production size', () => {
  const spec = ORBIT_BOT_MOTION_PILOT.animations.idle_loop;
  assert.deepEqual(spec, { frames: 8, fps: 8, loop: true });
  const runtimePaths = orbitMotionRuntimeFramePaths('idle_loop', 256);
  assert.equal(runtimePaths[0], 'pets/orbit-bot/motion-pilot/runtime/256/idle_loop/idle_loop_001.png');
  assert.equal(runtimePaths[7], 'pets/orbit-bot/motion-pilot/runtime/256/idle_loop/idle_loop_008.png');
  for (const size of [1024, 512, 256] as const) {
    const tier = size === 1024 ? 'master' : `runtime/${size}`;
    const frames: Buffer[] = [];
    for (let index = 1; index <= spec.frames; index += 1) {
      const name = `idle_loop_${String(index).padStart(3, '0')}.png`;
      const path = join(ORBIT_DIR, 'motion-pilot', tier, 'idle_loop', name);
      assert.equal(existsSync(path), true, `${path} must exist`);
      const png = readFileSync(path);
      assert.equal(png.readUInt32BE(16), size, `${name} width`);
      assert.equal(png.readUInt32BE(20), size, `${name} height`);
      assert.equal(png[25], 6, `${name} must be RGBA`);
      frames.push(png);
    }
    assert.deepEqual(frames[0], frames[7], `${size}px idle loop must close on its neutral anchor`);
    assert.deepEqual(frames[1], frames[6], `${size}px idle loop inhale/exhale pair must match`);
    assert.deepEqual(frames[2], frames[5], `${size}px idle loop blink pair must match`);
  }
});

test('approved walk runtime paths are deterministic and complete in both directions', () => {
  for (const clip of ['walk_right', 'walk_left'] as const) {
    const frames = orbitMotionRuntimeFramePaths(clip, 256);
    assert.equal(frames.length, 8);
    assert.equal(frames[0], `pets/orbit-bot/motion-pilot/runtime/256/${clip}/${clip}_001.png`);
    assert.equal(frames[7], `pets/orbit-bot/motion-pilot/runtime/256/${clip}/${clip}_008.png`);
    assert.equal(new Set(frames).size, frames.length);
  }
});

test('approved walk clips ship eight transparent frames at every production size', () => {
  for (const clip of ['walk_right', 'walk_left'] as const) {
    for (const size of [1024, 512, 256] as const) {
      const tier = size === 1024 ? 'master' : `runtime/${size}`;
      for (let index = 1; index <= 8; index += 1) {
        const name = `${clip}_${String(index).padStart(3, '0')}.png`;
        const path = join(ORBIT_DIR, 'motion-pilot', tier, clip, name);
        assert.equal(existsSync(path), true, `${path} must exist`);
        const png = readFileSync(path);
        assert.equal(png.readUInt32BE(16), size, `${name} width`);
        assert.equal(png.readUInt32BE(20), size, `${name} height`);
        assert.equal(png[25], 6, `${name} must be RGBA`);
      }
    }
  }
});

test('approved turn clips ship six transparent non-looping frames in both directions', () => {
  for (const clip of ['turn_right', 'turn_left'] as const) {
    const spec = ORBIT_BOT_MOTION_PILOT.animations[clip];
    assert.deepEqual(spec, { frames: 6, fps: 10, loop: false });
    const runtimePaths = orbitMotionRuntimeFramePaths(clip, 256);
    assert.equal(runtimePaths[0], `pets/orbit-bot/motion-pilot/runtime/256/${clip}/${clip}_001.png`);
    assert.equal(runtimePaths[5], `pets/orbit-bot/motion-pilot/runtime/256/${clip}/${clip}_006.png`);
    for (const size of [1024, 512, 256] as const) {
      const tier = size === 1024 ? 'master' : `runtime/${size}`;
      for (let index = 1; index <= spec.frames; index += 1) {
        const name = `${clip}_${String(index).padStart(3, '0')}.png`;
        const path = join(ORBIT_DIR, 'motion-pilot', tier, clip, name);
        assert.equal(existsSync(path), true, `${path} must exist`);
        const png = readFileSync(path);
        assert.equal(png.readUInt32BE(16), size, `${name} width`);
        assert.equal(png.readUInt32BE(20), size, `${name} height`);
        assert.equal(png[25], 6, `${name} must be RGBA`);
      }
    }
  }
});

test('approved turn clips are exact reverses and finish on the neutral stop anchor', () => {
  for (const size of [1024, 512, 256] as const) {
    const tier = size === 1024 ? 'master' : `runtime/${size}`;
    const rightFrames = Array.from({ length: 6 }, (_, index) =>
      join(ORBIT_DIR, 'motion-pilot', tier, 'turn_right', `turn_right_${String(index + 1).padStart(3, '0')}.png`),
    );
    const leftFrames = Array.from({ length: 6 }, (_, index) =>
      join(ORBIT_DIR, 'motion-pilot', tier, 'turn_left', `turn_left_${String(index + 1).padStart(3, '0')}.png`),
    );

    for (let index = 0; index < rightFrames.length; index += 1) {
      assert.deepEqual(readFileSync(leftFrames[index]!), readFileSync(rightFrames[5 - index]!));
    }

    const stopAnchor = readFileSync(join(ORBIT_DIR, 'motion-pilot', tier, 'stop', 'stop_004.png'));
    assert.deepEqual(readFileSync(rightFrames[5]!), stopAnchor);
    assert.deepEqual(readFileSync(leftFrames[0]!), stopAnchor);
  }
});

test('approved stop clip ships four transparent non-looping frames at every production size', () => {
  const spec = ORBIT_BOT_MOTION_PILOT.animations.stop;
  assert.deepEqual(spec, { frames: 4, fps: 8, loop: false });
  const runtimePaths = orbitMotionRuntimeFramePaths('stop', 256);
  assert.equal(runtimePaths[0], 'pets/orbit-bot/motion-pilot/runtime/256/stop/stop_001.png');
  assert.equal(runtimePaths[3], 'pets/orbit-bot/motion-pilot/runtime/256/stop/stop_004.png');
  for (const size of [1024, 512, 256] as const) {
    const tier = size === 1024 ? 'master' : `runtime/${size}`;
    for (let index = 1; index <= spec.frames; index += 1) {
      const name = `stop_${String(index).padStart(3, '0')}.png`;
      const path = join(ORBIT_DIR, 'motion-pilot', tier, 'stop', name);
      assert.equal(existsSync(path), true, `${path} must exist`);
      const png = readFileSync(path);
      assert.equal(png.readUInt32BE(16), size, `${name} width`);
      assert.equal(png.readUInt32BE(20), size, `${name} height`);
      assert.equal(png[25], 6, `${name} must be RGBA`);
    }
  }
});

test('approved sit-down clip ships six transparent non-looping frames at every production size', () => {
  const spec = ORBIT_BOT_MOTION_PILOT.animations.sit_down;
  assert.deepEqual(spec, { frames: 6, fps: 10, loop: false });
  const runtimePaths = orbitMotionRuntimeFramePaths('sit_down', 256);
  assert.equal(runtimePaths[0], 'pets/orbit-bot/motion-pilot/runtime/256/sit_down/sit_down_001.png');
  assert.equal(runtimePaths[5], 'pets/orbit-bot/motion-pilot/runtime/256/sit_down/sit_down_006.png');
  for (const size of [1024, 512, 256] as const) {
    const tier = size === 1024 ? 'master' : `runtime/${size}`;
    for (let index = 1; index <= spec.frames; index += 1) {
      const name = `sit_down_${String(index).padStart(3, '0')}.png`;
      const path = join(ORBIT_DIR, 'motion-pilot', tier, 'sit_down', name);
      assert.equal(existsSync(path), true, `${path} must exist`);
      const png = readFileSync(path);
      assert.equal(png.readUInt32BE(16), size, `${name} width`);
      assert.equal(png.readUInt32BE(20), size, `${name} height`);
      assert.equal(png[25], 6, `${name} must be RGBA`);
    }
  }
});

test('approved sit-idle loop ships six frames and starts from the sit-down anchor', () => {
  const spec = ORBIT_BOT_MOTION_PILOT.animations.sit_idle;
  assert.deepEqual(spec, { frames: 6, fps: 8, loop: true });
  const runtimePaths = orbitMotionRuntimeFramePaths('sit_idle', 256);
  assert.equal(runtimePaths[0], 'pets/orbit-bot/motion-pilot/runtime/256/sit_idle/sit_idle_001.png');
  assert.equal(runtimePaths[5], 'pets/orbit-bot/motion-pilot/runtime/256/sit_idle/sit_idle_006.png');
  for (const size of [1024, 512, 256] as const) {
    const tier = size === 1024 ? 'master' : `runtime/${size}`;
    for (let index = 1; index <= spec.frames; index += 1) {
      const name = `sit_idle_${String(index).padStart(3, '0')}.png`;
      const path = join(ORBIT_DIR, 'motion-pilot', tier, 'sit_idle', name);
      assert.equal(existsSync(path), true, `${path} must exist`);
      const png = readFileSync(path);
      assert.equal(png.readUInt32BE(16), size, `${name} width`);
      assert.equal(png.readUInt32BE(20), size, `${name} height`);
      assert.equal(png[25], 6, `${name} must be RGBA`);
    }
    assert.deepEqual(
      readFileSync(join(ORBIT_DIR, 'motion-pilot', tier, 'sit_idle', 'sit_idle_001.png')),
      readFileSync(join(ORBIT_DIR, 'motion-pilot', tier, 'sit_down', 'sit_down_006.png')),
    );
  }
});

test('approved lie-down clip ships six transparent non-looping frames from the seated anchor', () => {
  const spec = ORBIT_BOT_MOTION_PILOT.animations.lie_down;
  assert.deepEqual(spec, { frames: 6, fps: 10, loop: false });
  const runtimePaths = orbitMotionRuntimeFramePaths('lie_down', 256);
  assert.equal(runtimePaths[0], 'pets/orbit-bot/motion-pilot/runtime/256/lie_down/lie_down_001.png');
  assert.equal(runtimePaths[5], 'pets/orbit-bot/motion-pilot/runtime/256/lie_down/lie_down_006.png');
  for (const size of [1024, 512, 256] as const) {
    const tier = size === 1024 ? 'master' : `runtime/${size}`;
    for (let index = 1; index <= spec.frames; index += 1) {
      const name = `lie_down_${String(index).padStart(3, '0')}.png`;
      const path = join(ORBIT_DIR, 'motion-pilot', tier, 'lie_down', name);
      assert.equal(existsSync(path), true, `${path} must exist`);
      const png = readFileSync(path);
      assert.equal(png.readUInt32BE(16), size, `${name} width`);
      assert.equal(png.readUInt32BE(20), size, `${name} height`);
      assert.equal(png[25], 6, `${name} must be RGBA`);
    }
    assert.deepEqual(
      readFileSync(join(ORBIT_DIR, 'motion-pilot', tier, 'lie_down', 'lie_down_001.png')),
      readFileSync(join(ORBIT_DIR, 'motion-pilot', tier, 'sit_down', 'sit_down_006.png')),
    );
  }
});

test('approved sleep loop ships eight transparent symmetric frames at every production size', () => {
  const spec = ORBIT_BOT_MOTION_PILOT.animations.sleep_loop;
  assert.deepEqual(spec, { frames: 8, fps: 6, loop: true });
  const runtimePaths = orbitMotionRuntimeFramePaths('sleep_loop', 256);
  assert.equal(runtimePaths[0], 'pets/orbit-bot/motion-pilot/runtime/256/sleep_loop/sleep_loop_001.png');
  assert.equal(runtimePaths[7], 'pets/orbit-bot/motion-pilot/runtime/256/sleep_loop/sleep_loop_008.png');
  for (const size of [1024, 512, 256] as const) {
    const tier = size === 1024 ? 'master' : `runtime/${size}`;
    const frames = Array.from({ length: spec.frames }, (_, index) => {
      const name = `sleep_loop_${String(index + 1).padStart(3, '0')}.png`;
      const path = join(ORBIT_DIR, 'motion-pilot', tier, 'sleep_loop', name);
      assert.equal(existsSync(path), true, `${path} must exist`);
      const png = readFileSync(path);
      assert.equal(png.readUInt32BE(16), size, `${name} width`);
      assert.equal(png.readUInt32BE(20), size, `${name} height`);
      assert.equal(png[25], 6, `${name} must be RGBA`);
      return png;
    });
    assert.deepEqual(frames[0], frames[4], `${size}px neutral crossings`);
    assert.deepEqual(frames[1], frames[3], `${size}px inhale symmetry`);
    assert.deepEqual(frames[5], frames[7], `${size}px exhale symmetry`);
  }
});

test('approved stretch clip ships six transparent non-looping frames with neutral anchors', () => {
  const spec = ORBIT_BOT_MOTION_PILOT.animations.stretch;
  assert.deepEqual(spec, { frames: 6, fps: 10, loop: false });
  const runtimePaths = orbitMotionRuntimeFramePaths('stretch', 256);
  assert.equal(runtimePaths[0], 'pets/orbit-bot/motion-pilot/runtime/256/stretch/stretch_001.png');
  assert.equal(runtimePaths[5], 'pets/orbit-bot/motion-pilot/runtime/256/stretch/stretch_006.png');
  for (const size of [1024, 512, 256] as const) {
    const tier = size === 1024 ? 'master' : `runtime/${size}`;
    const frames = Array.from({ length: spec.frames }, (_, index) => {
      const name = `stretch_${String(index + 1).padStart(3, '0')}.png`;
      const path = join(ORBIT_DIR, 'motion-pilot', tier, 'stretch', name);
      assert.equal(existsSync(path), true, `${path} must exist`);
      const png = readFileSync(path);
      assert.equal(png.readUInt32BE(16), size, `${name} width`);
      assert.equal(png.readUInt32BE(20), size, `${name} height`);
      assert.equal(png[25], 6, `${name} must be RGBA`);
      return png;
    });
    assert.deepEqual(frames[0], frames[5], `${size}px stretch must return to its neutral anchor`);
  }
});

test('approved hover reaction ships four transparent non-looping frames with neutral anchors', () => {
  const spec = ORBIT_BOT_MOTION_PILOT.animations.hover_react;
  assert.deepEqual(spec, { frames: 4, fps: 10, loop: false });
  const runtimePaths = orbitMotionRuntimeFramePaths('hover_react', 256);
  assert.equal(runtimePaths[0], 'pets/orbit-bot/motion-pilot/runtime/256/hover_react/hover_react_001.png');
  assert.equal(runtimePaths[3], 'pets/orbit-bot/motion-pilot/runtime/256/hover_react/hover_react_004.png');
  for (const size of [1024, 512, 256] as const) {
    const tier = size === 1024 ? 'master' : `runtime/${size}`;
    const frames = Array.from({ length: spec.frames }, (_, index) => {
      const name = `hover_react_${String(index + 1).padStart(3, '0')}.png`;
      const path = join(ORBIT_DIR, 'motion-pilot', tier, 'hover_react', name);
      assert.equal(existsSync(path), true, `${path} must exist`);
      const png = readFileSync(path);
      assert.equal(png.readUInt32BE(16), size, `${name} width`);
      assert.equal(png.readUInt32BE(20), size, `${name} height`);
      assert.equal(png[25], 6, `${name} must be RGBA`);
      return png;
    });
    assert.deepEqual(frames[0], frames[3], `${size}px hover reaction must return to its neutral anchor`);
  }
});

test('approved wake-up clip is the exact non-looping reverse of sit-down', () => {
  const spec = ORBIT_BOT_MOTION_PILOT.animations.wake_up;
  assert.deepEqual(spec, { frames: 6, fps: 10, loop: false });
  const runtimePaths = orbitMotionRuntimeFramePaths('wake_up', 256);
  assert.equal(runtimePaths[0], 'pets/orbit-bot/motion-pilot/runtime/256/wake_up/wake_up_001.png');
  assert.equal(runtimePaths[5], 'pets/orbit-bot/motion-pilot/runtime/256/wake_up/wake_up_006.png');
  for (const size of [1024, 512, 256] as const) {
    const tier = size === 1024 ? 'master' : `runtime/${size}`;
    for (let index = 1; index <= spec.frames; index += 1) {
      const name = `wake_up_${String(index).padStart(3, '0')}.png`;
      const path = join(ORBIT_DIR, 'motion-pilot', tier, 'wake_up', name);
      assert.equal(existsSync(path), true, `${path} must exist`);
      const png = readFileSync(path);
      assert.equal(png.readUInt32BE(16), size, `${name} width`);
      assert.equal(png.readUInt32BE(20), size, `${name} height`);
      assert.equal(png[25], 6, `${name} must be RGBA`);
      assert.deepEqual(
        png,
        readFileSync(join(ORBIT_DIR, 'motion-pilot', tier, 'sit_down', `sit_down_${String(7 - index).padStart(3, '0')}.png`)),
      );
    }
  }
});

test('direction-specific pilot frames are not mirrored a second time by the desktop wrapper', () => {
  const html = readFileSync(PET_HTML_PATH, 'utf8');
  assert.match(html, /var facingScale = hasDirectionalPilotMotionAsset\(\) \? 1 : dir;/);
  assert.doesNotMatch(html, /scaleX\(' \+ dir \+ '\)'/);
});

test('directional turns finish their six-frame non-looping clip before walking starts', () => {
  const html = readFileSync(PET_HTML_PATH, 'utf8');
  assert.match(html, /if \(startPilotTurn\(side\)\) return;/);
  assert.match(html, /var turnDuration = selectedTurn\.clip\.frames\.length \* 1000 \/ selectedTurn\.clip\.fps;/);
  assert.match(html, /if \(completedSide\) beginWalking\(completedSide\);/);
});

test('stop finishes at the destination before movement completion is reported', () => {
  const html = readFileSync(PET_HTML_PATH, 'utf8');
  assert.match(html, /if \(startPilotStop\(completion\)\)/);
  assert.match(html, /var stopDuration = selectedStop\.clip\.frames\.length \* 1000 \/ selectedStop\.clip\.fps;/);
  assert.match(html, /reportMovementComplete\(completedStop\);/);
  assert.match(html, /if \(!walking && !turning && !stopping && \(!standingUp \|\| !pendingStandWalk\) && activeRoamCommandId != null/);
  assert.match(html, /stopping:not\(\.pilot-stopping\) #pet/);
});

test('sit-down finishes its transition and holds the approved seated frame', () => {
  const html = readFileSync(PET_HTML_PATH, 'utf8');
  assert.match(html, /name === 'sit' && startPilotSitDown\(\)/);
  assert.match(html, /var sitDuration = selectedSit\.clip\.frames\.length \* 1000 \/ selectedSit\.clip\.fps;/);
  assert.match(html, /var index = sittingDown[\s\S]*: clip\.frames\.length - 1;/);
  assert.match(html, /if \(\(posture \|\| sittingDown\) && wake\(\)\)/);
  assert.match(html, /sit:not\(\.pilot-sitting\) #pet/);
});

test('standing idle loop is timer-paced and yields to every higher-priority layer', () => {
  const html = readFileSync(PET_HTML_PATH, 'utf8');
  assert.match(html, /function pilotIdleLoopClip\(\)/);
  assert.match(html, /frame\.motion\.clips\.idle_loop/);
  assert.match(html, /function renderPilotIdleLoopFrame\(now\)/);
  assert.match(html, /Math\.floor\(elapsed \* clip\.fps \/ 1000\) % clip\.frames\.length/);
  assert.match(html, /function schedulePilotIdleLoopFrame\(clip\)[\s\S]*setTimeout[\s\S]*1000 \/ clip\.fps/);
  assert.match(html, /renderPilotWalkFrame\(pilotNow\) \|\| renderPilotIdleLoopFrame\(pilotNow\)/);
  assert.match(html, /var selectedIdleLoop = pilotIdleLoopClip\(\);[\s\S]*schedulePilotIdleLoopFrame\(selectedIdleLoop\.clip\);/);
  assert.match(html, /function stopPilotIdleLoop\(\)[\s\S]*clearTimeout\(idleLoopTimer\); idleLoopTimer = null;/);
  assert.match(html, /lastInteractionAt = Date\.now\(\);[\s\S]*stopPilotIdleLoop\(\);/);
});

test('sit-idle loops after sit-down until interaction wakes the Pet', () => {
  const html = readFileSync(PET_HTML_PATH, 'utf8');
  assert.match(html, /function pilotSitIdleClip\(\)/);
  assert.match(html, /frame\.motion\.clips\.sit_idle/);
  assert.match(html, /Math\.floor\(elapsed \* clip\.fps \/ 1000\) % clip\.frames\.length/);
  assert.match(html, /sitIdleStartedAt = now;[\s\S]*schedulePilotSitIdleFrame\(selectedSitIdle\.clip\);/);
  assert.match(html, /var selectedSitIdle = posture === 'sit' && pilotSitIdleClip\(\);/);
  assert.match(html, /1000 \/ clip\.fps/);
  assert.match(html, /clearTimeout\(sitIdleTimer\); sitIdleTimer = null;/);
});

test('lie-down finishes once and holds its approved awake endpoint until wake', () => {
  const html = readFileSync(PET_HTML_PATH, 'utf8');
  assert.match(html, /function pilotLieDownClip\(\)/);
  assert.match(html, /frame\.motion\.clips\.lie_down/);
  assert.match(html, /name === 'lie' && startPilotLieDown\(\)/);
  assert.match(html, /var index = lyingDown[\s\S]*: clip\.frames\.length - 1;/);
  assert.match(html, /var lieDuration = selectedLie\.clip\.frames\.length \* 1000 \/ selectedLie\.clip\.fps;/);
  assert.match(html, /lyingDown = false;[\s\S]*final awake lying frame remains selected/);
  assert.match(html, /wrap\.classList\.remove\('pilot-sitting', 'pilot-lying', 'pilot-sleeping'\);/);
  assert.match(html, /lie:not\(\.pilot-lying\) #pet/);
});

test('sleep loop follows lie-down, runs timer-paced, and persists until interaction', () => {
  const html = readFileSync(PET_HTML_PATH, 'utf8');
  assert.match(html, /function pilotSleepLoopClip\(\)/);
  assert.match(html, /frame\.motion\.clips\.sleep_loop/);
  assert.match(html, /function renderPilotSleepLoopFrame\(now\)/);
  assert.match(html, /Math\.floor\(elapsed \* clip\.fps \/ 1000\) % clip\.frames\.length/);
  assert.match(html, /function schedulePilotSleepLoopFrame\(clip\)[\s\S]*1000 \/ clip\.fps/);
  assert.match(html, /if \(name === 'sleep'\)[\s\S]*sleepAfterLie = true;[\s\S]*name = 'lie';/);
  assert.match(html, /if \(sleepAfterLie\)[\s\S]*enterSleepPosture\(\);/);
  assert.match(html, /var selectedSleepLoop = posture === 'sleep' && pilotSleepLoopClip\(\);/);
  assert.match(html, /posture === 'sleep' \|\| actionTimer/);
  assert.match(html, /clearTimeout\(sleepLoopTimer\); sleepLoopTimer = null;/);
  assert.match(html, /wrap\.classList\.remove\('pilot-sitting', 'pilot-lying', 'pilot-sleeping'\);/);
  assert.match(html, /sleep:not\(\.pilot-sleeping\) #pet/);
});

test('stretch plays its six-frame pilot once and returns to the idle scheduler', () => {
  const html = readFileSync(PET_HTML_PATH, 'utf8');
  assert.match(html, /function pilotStretchClip\(\)/);
  assert.match(html, /frame\.motion\.clips\.stretch/);
  assert.match(html, /name === 'stretch'[\s\S]*startPilotStretch\(\)/);
  assert.match(html, /function renderPilotStretchFrame\(now\)/);
  assert.match(html, /Math\.min\(clip\.frames\.length - 1, Math\.floor\(elapsed \* clip\.fps \/ 1000\)\)/);
  assert.match(html, /var stretchDuration = selectedStretch\.clip\.frames\.length \* 1000 \/ selectedStretch\.clip\.fps;/);
  assert.match(html, /if \(now - stretchStartedAt >= stretchDuration\)[\s\S]*finishPilotStretch\(true\);/);
  assert.match(html, /if \(stretching\) finishPilotStretch\(false\);/);
  assert.match(html, /wrap\.classList\.remove\('stretch', 'pilot-stretching'\);/);
  assert.match(html, /stretch:not\(\.pilot-stretching\) #pet/);
});

test('hover reaction plays once, holds its neutral end frame, and exits with the interaction layer', () => {
  const html = readFileSync(PET_HTML_PATH, 'utf8');
  assert.match(html, /function pilotHoverReactClip\(\)/);
  assert.match(html, /frame\.motion\.clips\.hover_react/);
  assert.match(html, /frame\.animation === 'hover_react'\) startPilotHoverReact\(\)/);
  assert.match(html, /function renderPilotHoverReactFrame\(now\)/);
  assert.match(html, /Math\.min\(clip\.frames\.length - 1, Math\.floor\(elapsed \* clip\.fps \/ 1000\)\)/);
  assert.match(html, /var hoverReactDuration = selectedHoverReact\.clip\.frames\.length \* 1000 \/ selectedHoverReact\.clip\.fps;/);
  assert.match(html, /if \(now - hoverReactStartedAt >= hoverReactDuration\) return;/);
  assert.match(html, /hoverReacting && frame\.animation !== 'hover_react'\) finishPilotHoverReact\(false\)/);
  assert.match(html, /if \(hoverReacting\) finishPilotHoverReact\(false\);/);
  assert.match(html, /wrap\.classList\.remove\('pilot-hover-reacting'\);/);
});

test('wake-up finishes before queued locomotion may begin', () => {
  const html = readFileSync(PET_HTML_PATH, 'utf8');
  assert.match(html, /function pilotWakeUpClip\(\)/);
  assert.match(html, /frame\.motion\.clips\.wake_up/);
  assert.match(html, /var wasPilotSit = posture === 'sit' \|\| sittingDown;/);
  assert.match(html, /if \(wasPilotSit && startPilotWakeUp\(\)\) return true;/);
  assert.match(html, /Math\.min\(clip\.frames\.length - 1, Math\.floor\(elapsed \* clip\.fps \/ 1000\)\)/);
  assert.doesNotMatch(html, /standStartedAt[\s\S]{0,250}% clip\.frames\.length/);
  assert.match(html, /pendingStandWalk = \{ x: clamped\.x, y: clamped\.y, isRoam: !!isRoam \};/);
  assert.match(html, /var wakeDuration = selectedWake\.clip\.frames\.length \* 1000 \/ selectedWake\.clip\.fps;/);
  assert.match(html, /if \(queuedWalk\) beginWalkTo\(queuedWalk\.x, queuedWalk\.y, queuedWalk\.isRoam\);/);
  assert.match(html, /!walking && !turning && !stopping && \(!standingUp \|\| !pendingStandWalk\) && activeRoamCommandId != null/);
});

test('motion development mode guarantees stretch and rest previews per idle cycle', () => {
  const html = readFileSync(PET_HTML_PATH, 'utf8');
  assert.match(html, /var sitPreviewed = false;/);
  assert.match(html, /var liePreviewed = false;/);
  assert.match(html, /var sleepPreviewed = false;/);
  assert.match(html, /var stretchPreviewed = false;/);
  assert.match(html, /if \(motionDev && idleMs >= 35_000 && !stretchPreviewed\) return 'stretch';/);
  assert.match(html, /if \(motionDev && idleMs >= 60_000 && !sitPreviewed\)/);
  assert.match(html, /if \(motionDev && idleMs >= 60_000 && !liePreviewed\) return 'lie_down';/);
  assert.match(html, /if \(motionDev && idleMs >= 120_000 && liePreviewed && !sleepPreviewed\) return 'sleep_loop';/);
  assert.match(html, /if \(motionDev\) \{ sitPreviewed = false; liePreviewed = false; sleepPreviewed = false; stretchPreviewed = false; \}/);
  assert.match(html, /if \(motionDev && name === 'sit'\) sitPreviewed = true;/);
  assert.match(html, /if \(motionDev && name === 'lie'\) liePreviewed = true;/);
  assert.match(html, /if \(motionDev\) sleepPreviewed = true;/);
});

test('main process activates approved locomotion clips atomically', () => {
  const main = readFileSync(MAIN_PATH, 'utf8');
  const presenceTypes = readFileSync(PRESENCE_TYPES_PATH, 'utf8');
  assert.match(main, /\['idle_loop', 'walk_right', 'walk_left', 'turn_right', 'turn_left', 'stop', 'sit_down', 'sit_idle', 'lie_down', 'sleep_loop', 'wake_up', 'stretch', 'hover_react'\] as const/);
  assert.match(main, /if \(frames\.some\(\(frame\) => frame == null\)\) continue;/);
  assert.match(main, /if \(orbitMotionAssetsCache !== undefined\) return orbitMotionAssetsCache;/);
  assert.match(presenceTypes, /Record<PetLocomotionId \| 'idle_loop' \| 'stop' \| 'sit_down' \| 'sit_idle' \| 'lie_down' \| 'sleep_loop' \| 'wake_up' \| 'hover_react'/);
});

test('pet startup uses the canonical Orbit frame and keeps decoded motion clips bounded', () => {
  const html = readFileSync(PET_HTML_PATH, 'utf8');
  const main = readFileSync(MAIN_PATH, 'utf8');
  assert.doesNotMatch(html, /pulsepet_states_sprite\.png/);
  assert.match(html, /background-image: none/);
  assert.match(html, /motion-pilot\/runtime\/256\/idle_loop\/idle_loop_001\.png/);
  assert.match(html, /var MAX_CACHED_MOTION_CLIPS = 5;/);
  assert.match(html, /while \(motionClipCache\.length > MAX_CACHED_MOTION_CLIPS\)/);
  assert.match(main, /motion-pilot\/runtime\/512\/idle_loop\/idle_loop_001\.png/);
});

test('Orbit Bot motion pilot rejects identity, pivot, and clip-shape drift', () => {
  const invalid = JSON.parse(JSON.stringify(ORBIT_BOT_MOTION_PILOT)) as Record<string, unknown>;
  invalid.characterId = 'pulse_fox';
  (invalid.pivot as Record<string, unknown>).y = 0.5;
  ((invalid.animations as Record<string, unknown>).idle_loop as Record<string, unknown>).fps = 0;
  const validation = validateOrbitBotMotionPilot(invalid);
  assert.equal(validation.ok, false);
  assert.ok(validation.issues.some((issue) => issue.path === 'characterId'));
  assert.ok(validation.issues.some((issue) => issue.path === 'pivot'));
  assert.ok(validation.issues.some((issue) => issue.path === 'animations.idle_loop.fps'));
});

test('Orbit Bot motion pilot rejects contract drift and extra clips', () => {
  const invalid = JSON.parse(JSON.stringify(ORBIT_BOT_MOTION_PILOT)) as Record<string, unknown>;
  invalid.runtimeSizes = [512, 512];
  const animations = invalid.animations as Record<string, Record<string, unknown>>;
  animations.idle_loop!.frames = 99;
  animations.walk_right!.loop = false;
  animations.walk_left!.unexpected = true;
  animations.extra_clip = { frames: 1, fps: 1, loop: false };
  const validation = validateOrbitBotMotionPilot(invalid);
  assert.equal(validation.ok, false);
  assert.ok(validation.issues.some((issue) => issue.path === 'runtimeSizes'));
  assert.ok(validation.issues.some((issue) => issue.path === 'animations.idle_loop.frames'));
  assert.ok(validation.issues.some((issue) => issue.path === 'animations.walk_right.loop'));
  assert.ok(validation.issues.some((issue) => issue.path === 'animations.walk_left.unexpected'));
  assert.ok(validation.issues.some((issue) => issue.path === 'animations.extra_clip'));
});
