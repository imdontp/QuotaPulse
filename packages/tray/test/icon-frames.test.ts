import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  TRAY_FRAME_COUNT,
  fpsFor,
  renderTrayFrame,
  renderTrayIcon,
  severityFor,
  trayFrameFor,
  trayIconFor,
} from '../src/icon.js';

test('frame rate follows quota severity (RunCat mapping)', () => {
  assert.equal(fpsFor(null), 0);
  assert.equal(fpsFor(0), 4);
  assert.equal(fpsFor(59), 4);
  assert.equal(fpsFor(60), 8);
  assert.equal(fpsFor(84), 8);
  assert.equal(fpsFor(85), 12);
  assert.equal(fpsFor(100), 12);
});

test('frame 0 is byte-identical to the legacy still', () => {
  for (const p of [null, 0, 42, 75, 96] as const) {
    assert.deepEqual(renderTrayFrame(p, 0), renderTrayIcon(p));
    assert.deepEqual(trayFrameFor(p, 0), trayIconFor(p));
  }
});

test('animated readings produce distinct frames; unknown stays static', () => {
  const frames = new Set(
    Array.from({ length: TRAY_FRAME_COUNT }, (_, f) => renderTrayFrame(72, f).toString('base64')),
  );
  assert.ok(frames.size > 1, 'a live reading must visibly move');
  const grey = new Set(
    Array.from({ length: TRAY_FRAME_COUNT }, (_, f) => renderTrayFrame(null, f).toString('base64')),
  );
  assert.equal(grey.size, 1, 'no data must not animate');
  assert.equal(severityFor(null), 'unknown');
});

test('frame index wraps', () => {
  assert.deepEqual(trayFrameFor(50, TRAY_FRAME_COUNT), trayFrameFor(50, 0));
});
