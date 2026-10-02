# v1.25 — actual dashboard renderer hang recovery

## Validated scope

Continue the approved blueprint on the isolated `design/redesign-foundation`
worktree. Fix and validate actual dashboard renderer unresponsiveness. Original
checkout/profile/accounts remain separate. This is a review checkpoint, not full
release certification.

## Reproduced defect

The native probe blocked the real renderer thread for 60 seconds and sent native
input. Electron emitted `unresponsive`; production main started one reload, but
there was no renderer exit or new readiness signal within the recovery deadline.
[Before-fix evidence](redesign-v1.25/dashboard-hang-before-fix.json).

Reloading alone did not replace the blocked renderer. After the existing four-second
grace period, dashboard main now calls `forcefullyCrashRenderer`. The existing
`render-process-gone` handler owns the bounded reload, without adding a second
recovery path or changing saved settings. `responsive` still cancels the grace
timer. This follows the native recovery mechanism described in
[Electron's webContents documentation](https://www.electronjs.org/docs/latest/api/web-contents/#contentsforcefullycrashrenderer).

## Test design and diagnosis

`scripts/unresponsive-probe.cjs` launches the real compiled main without Playwright
or DevTools. `scripts/check-unresponsive-recovery.mts` supplies an isolated profile,
port 7813, in-memory daemon/database and zero adapters. The probe observes native
events; it does not emit synthetic unresponsive/crash events. It verifies a new
renderer PID in the same window, real preload readiness, visible loaded metrics,
and disappearance of the injected hang marker before 60 seconds elapse.
Its bounded deadline destroys only windows of that launched Electron application.

Initial Playwright attempts did not emit native `unresponsive`: its installed
Electron loader sets `--disable-hang-monitor`. Removing the switch after launch
also did not restore detection in that run. Those attempts do not establish
production recovery behavior. The direct native probe reproduced the defect.
The first post-fix run observed a crash/new readiness, but its immediate DOM check
ran before metrics loaded; the final probe separately waits for metrics and checks
elapsed time, rather than treating preload readiness as complete UI readiness.

## Validation

| Check | Result |
| --- | --- |
| Isolated tray TypeScript and preload build | Passed; no dependency installation or native rebuild |
| Source actual 60-second renderer hang | Passed; UI restored in **25.626 seconds** |
| v1.25 bundle actual 60-second renderer hang | Passed; UI restored in **23.797 seconds** |
| Native evidence in each final hang run | 1 unresponsive event, 1 renderer crash, 1 reload, 1 new readiness; same window/new PID |
| v1.25 bundle dashboard crash/load-failure/reopen regression | **4 checks passed**, including production Pause/Resume control |

Evidence: [source](redesign-v1.25/source-hang.json),
[bundle](redesign-v1.25/bundle-hang.json),
[crash regression](redesign-v1.25/dashboard-crash-regression.json),
[bundle inventory](redesign-v1.25/bundle-build.json),
[ZIP verification](redesign-v1.25/archive-verification.json).

```powershell
npm run build -w @quotapulse/tray
node --import tsx scripts/check-unresponsive-recovery.mts
node --import tsx scripts/build-review-bundle.mts
$env:QUOTAPULSE_REVIEW_ROOT = (Get-Content screens/tray-recovery/bundle-build.json -Raw | ConvertFrom-Json).bundle
node --import tsx scripts/check-unresponsive-recovery.mts
node --import tsx scripts/check-tray-recovery.mts
Remove-Item Env:QUOTAPULSE_REVIEW_ROOT
powershell -NoProfile -NonInteractive -File scripts/archive-review-bundle.ps1
```

## Review artifact

New ZIP: `tmp/review-bundles/QuotaPulse-v1.25-vYDqYN.zip`. SHA256, exact size and
entry verification are recorded in the linked archive report. Extract into a fresh
dedicated folder and run `./scripts/start-review.ps1`; stop with
`./scripts/stop-review.ps1`. Readers/account probes remain disabled. Requires
Windows x64 and installed Node ABI 127 (validation used Node 22.13.1).
The included README also describes the versioned installer and retained profile.

Archive: 3,120 files, 199,838,793 compressed bytes.
SHA256: `548ce229994213941922f675e49cffc43348f14b29d060bd97a5b6118f877cd7`.
Final inspection found zero test-owned Node/Electron processes and a clean original
checkout. The v1.24 archive retains SHA256
`224b6fce7c1db9b2c1e85b1c9814bd8a70c187f9477cce053047d0413730b5ea`.

## Remaining work and limits

Actual pet/popup hangs, pet document-load failure bounds, transient-hang cancellation,
simultaneous surfaces sharing a renderer, manual safe-mode exit, physical clicks,
interactive gallery, signed installer, actual Windows logon, different-code/schema
migrations, accessibility, typography and concept approval remain separate gates.
Forced renderer replacement can lose unsaved in-memory UI state. This test does not
prove graceful SQLite/SSE shutdown. Installer/uninstall and pet/popup crash results
from earlier checkpoints are historical; they were not rerun for this dashboard-only
fix. ZIP validation compares decompressed entries with the tested bundle, not a second
extracted installation. No live account data or tasks were used.
