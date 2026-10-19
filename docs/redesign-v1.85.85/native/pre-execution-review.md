# Production native Activity lifecycle harness (85)

Status: prepared, syntax checked only; runtime not run. Root owns the exclusive browser/native slot.

## Files

- scripts/check-native-activity-lifecycle.mts: parent with synthetic in-memory daemon, empty adapters, fresh profile and private child IPC.
- scripts/native-activity-lifecycle-probe.cjs: raw Electron observer imports actual compiled production packages/tray/dist/main.js, opens through existing qp-popup-open-dashboard action. No BrowserWindow proxy, options replacement, off-monitor positioning, focusability override, taskbar override, CDP or visibility getter substitution.

## Run after root schedules the exclusive native slot

Prerequisites: existing matching compiled tray/main, dashboard preload, web dist; installed compatible Electron/SQLite; localhost port 7818 free; interactive Windows desktop. Production native window appears and can take focus. No actual user profile/database is used. Never run concurrently with visual/native capture gates.

    node --import tsx scripts/check-native-activity-lifecycle.mts

For an extracted current review artifact, set QUOTAPULSE_REVIEW_ROOT to its absolute root first; script imports daemon fixture source from checkout, but serves web and imports tray/preload/Electron from that extracted root. It asserts bundled Electron resolves within the artifact.

## Assertions and scope

Native minimize is asserted independently from document.hidden. Hide/update/theme/resize/show and minimize/update/theme/resize/restore use real API/SSE, real native state and actual canvas method counters. Current minute receives 800 then 900 extra actual tokens, producing exact 800 then 1700 latest buckets. Seeding uses one fixed current-minute timestamp to avoid a first-ten-seconds boundary error. Route navigation removes Activity canvas; later theme/resize cannot add Activity paints. Any observed hidden/detached Activity stroke or clear fails. Context isolation, node integration, sandbox, default background throttling, focusability, private profile, argv and real process terminal are recorded/asserted. Actual compiled main, preload and web index hashes bind evidence.

Production refresh coordinator may defer hidden network refresh until visible; harness does not require hidden DOM to update. It waits for real latest API bucket after show/restore. Replay coverage is bounded: after latest has settled, a 1.3-second idle observation must produce no additional paints. It does not assert that the first visibility-triggered paint already contains the not-yet-fetched latest response, nor certify every listener/timer is removed. Electron has no skipTaskbar getter; that option is preserved by executing unmodified production constructor, not inferred from a nonexistent native getter.

Outputs: screens/native-activity-lifecycle/source (or bundle), verification.json only after all assertions and child exit0, plus failure.json on test failure, stdout/stderr and process-terminal.json. Failure evidence preserves native state, requests count and actual renderer pixels/values. Fresh profile is retained under tmp/native-activity-lifecycle/instance-* for diagnosis. Cleanup targets only its owned child; no broad process termination.

## Checks performed in preparation

- node --check scripts/native-activity-lifecycle-probe.cjs: passed.
- TypeScript createSourceFile parseDiagnostics: passed without executing harness or app.
- An initial esbuild static transform attempt was blocked by sandbox spawn EPERM; no build/browser/native process launched. Replaced with in-process TypeScript syntax parsing.
- No application source, build or Git changes made. Runtime evidence remains pending; do not claim NATIVE-01 closed until the actual run passes.
