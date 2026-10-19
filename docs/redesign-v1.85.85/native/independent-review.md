# Native85 independent lifecycle evidence review

## Scope and verdict

Approve the bounded native lifecycle evidence. No blocking false-positive mechanism found for actual native hide/minimize visibility suppression, eventual accepted latest API data after native resume, and post-route-unmount paint suppression. Reviewed `scripts/check-native-activity-lifecycle.mts`, `scripts/native-activity-lifecycle-probe.cjs`, Activity canvas implementation, production dashboard construction/profile configuration, and actual `screens/native-activity-lifecycle/source/verification.json` plus process-terminal evidence. No browser/build/Git/source modification was performed by this reviewer.

## What is actually proved

- The observer imports the actual compiled production main rather than replacing BrowserWindow or its constructor/options. Production `createDashboardWindow` remains framed/resizable/focusable, taskbar enabled, context-isolated with node integration disabled. The observer uses real BrowserWindow.hide/minimize and the existing production dashboard-open IPC for show/restore. Native window visibility and minimized state are independent of renderer document.hidden checks. No visibility emulation/CDP/background command flags appear in the observed child arguments.
- Actual web/main/preload bytes currently match all three recorded manifest SHA256 values. Web index is `f072ce2aa183548974e24de8d8387efa171f6dd1c4108129ce7f5a29b65b79f2`.
- Actual configured userData and sessionData are the unique temporary profile electron subdirectory. The synthetic daemon is memory-only; the profile's valid daemon.lock is passed through the normal production path. Real initial source/session and usage events serve actual APIs, with readers disabled. This isolates user DB/preferences, while remaining a synthetic-data production-main test.
- The real `.qp-tools button` selector is the first theme button in shell.tsx. Actual navigation mounts Overview then Live. Canvas monkey patches forward original methods unchanged and only observe Activity canvas operations, recording hidden/connected state and current accessible bucket values. All68 recorded clear/stroke events are visible and connected.
- The11-stage record shows clear/stroke counts11/11 at native hide and unchanged11/11 after hidden SSE/theme/resize. Hidden CSS width actually changes310.5 to285.25 while bitmap width remains311 until resume. Real show subsequently reaches bucket800 and24/24 paints; the next observed idle stage remains24/24.
- Real minimized flag is true and document.hidden true. Counts remain24/24 during minimized SSE/theme/action. Real restore reaches bucket1700 and34/34; idle remains34/34. Actual route navigation unmounts the canvas and subsequent theme/resize keeps counts34/34 with canvas null.
- Owned child PID36760 reached code0, signal null, closedtrue with no cleanup error before success manifest was written. Preload errors are empty; original renderer preload ready signaling is observed.

## Limits that must remain explicit

1. **Minimized resize was requested but not applied to actual bounds.** Window state remains1500px after requesting1450 while minimized; chart CSS width remains285.25. The test proves paint suppression while minimized with SSE/theme and a resize request. It does not prove an actual geometry change while minimized. Hidden non-minimized resize is independently real, and post-unmount resize is real. Do not claim all native minimized geometry variants covered.
2. **Settled no-replay is an idle-window statement.** Actual show draws old accepted200 before latest800; restore draws old accepted800 before latest1700. The event record supports eventual latest API state and no further paints during the observed settled window. It does not support first resumed paint being latest, nor absence of pre-refresh retained-snapshot draws. The harness's written limitations correctly allow shared refresh deferral; keep that wording when mapping requirements.
3. Paint counts and accepted DOM buckets are not CPU budgets, exhaustive listener cleanup, resource allocation/leak proof, physical tray interaction, screenshot fidelity, or packaged-artifact validation. Actual last recorded stroke stages contain800 and1700 respectively, but the harness does not compare full expected raster geometry. No need to broaden the test merely to label the bounded existing evidence honestly.
4. BackgroundThrottling/contextIsolation/nodeIntegration/sandbox/focusable are actual inspected preferences. skipTaskbar has no getter; its production source is unchanged, which is weaker than an OS taskbar interaction check. Window close uses observer destroy/quit for owned cleanup, not the user's normal close-to-tray path.

## Recommendation

Archive this as actual native Activity hide/minimize/resume/unmount evidence with the stated limits. It meaningfully replaces the older altered-window inconclusive fixture for these bounded behaviors. Do not close broader animation first-frame freshness, native interaction, performance, package, or full all-eight Source acceptance requirements from this one pass.
