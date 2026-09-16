import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  collectExternalProcessSnapshot,
  createRuntimeDiagnosticsSession,
  type RuntimeSample,
} from '../src/runtime-diagnostics.js';

function sample(): RuntimeSample {
  return {
    schemaVersion: 1,
    capturedAt: Date.now(),
    host: { platform: process.platform, totalMemoryBytes: 1, freeMemoryBytes: 1 },
    process: { pid: process.pid, parentPid: process.ppid, executable: process.execPath, memory: process.memoryUsage() },
    electron: [],
    daemon: null,
    external: { processes: [] },
    pet: {
      enabled: true,
      movement: 'minimal',
      character: 'orbit_bot',
      windows: { pet: true, quotaPopup: false, dashboard: false, gallery: false },
      counters: {},
    },
  };
}

test('RAM diagnostics are opt-in, JSONL, and bounded without retaining samples', async () => {
  const root = mkdtempSync(join(tmpdir(), 'quotapulse-runtime-diag-'));
  try {
    let limited = false;
    const session = createRuntimeDiagnosticsSession(root, { maxBytes: 900, onLimit: () => { limited = true; } });
    assert.equal(session.active, false);
    const path = session.start(sample);
    assert.equal(session.active, true);
    assert.equal(existsSync(path), true);
    for (let i = 0; i < 10 && session.active; i += 1) await session.sampleNow();
    assert.equal(limited, true);
    assert.equal(session.active, false);
    const lines = readFileSync(path, 'utf8').trim().split(/\r?\n/).filter(Boolean);
    assert.ok(lines.length >= 1);
    const first = JSON.parse(lines[0]!) as Record<string, unknown>;
    assert.equal(first.schemaVersion, 1);
    assert.equal('prompt' in first, false);
    assert.equal('commandLine' in first, false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('external process snapshot never exposes command lines and fails closed', async () => {
  const snapshot = await collectExternalProcessSnapshot();
  assert.ok(Array.isArray(snapshot.processes));
  for (const process of snapshot.processes) {
    assert.equal('commandLine' in process, false);
    assert.equal('cmdline' in process, false);
    assert.equal(typeof process.pid, 'number');
  }
});
