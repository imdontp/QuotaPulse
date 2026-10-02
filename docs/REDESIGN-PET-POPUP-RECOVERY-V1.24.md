# v1.24 — pet/popup recovery and complete review renderer packaging

## Validated scope

Continue the approved blueprint in `design/redesign-foundation`, keeping the original
checkout, profile, accounts and native dependencies unchanged. This checkpoint fixes
a reproduced review-bundle packaging defect and validates native pet/popup crash
recovery. It does not certify the full release.

## Diagnosis and change

The v1.23 bundle could open the dashboard, but the isolated pet test timed out with
`pet did not open`. Compiled main loads `packages/tray/src/pet.html`; that document
was absent from the bundle. `gallery.html` and its `gallery.css` were absent too.
All three existed in the source tree. The builder now copies and SHA256-compares
these files, and ZIP validation requires their entries. The corrected v1.24 bundle
passes the original native pet reproduction. No compiled application or dependency
was rebuilt; the change supplies the missing renderer assets.

`scripts/check-pet-popup-recovery.mts` runs the real compiled main and production
preloads on port 7812 with a unique profile, in-memory database and no adapters.
It uses `forcefullyCrashRenderer`, not simulated crash events. Pet actions go through
the renderer's production bridge. Fault injections wait for each popup-ready handshake;
an earlier harness iteration injected the next crash after DOM recovery but before
the asynchronous readiness signal, and intermittently missed that signal.

## Results

| Check | Source runtime | Corrected v1.24 bundle |
| --- | --- | --- |
| Two pet crashes reload the same window with new renderer PIDs and restored DOM/preload | Pass | Pass |
| Third crash creates exactly one visible reduced-motion pet; persisted settings remain byte-identical | Pass | Pass |
| Popup opens from pet bridge and recovers in the same native window | Pass | Pass |
| Blocked main-frame loads exhaust bounded popup recovery and close it | Pass | Pass |
| Popup reopens with a new window ID and working production close bridge | Pass | Pass |

Both final runs observed 3 pet crashes, 2 popup crashes, 3 popup-ready handshakes
and 2 popup reload starts. Context isolation and sandbox are enabled; Node integration
is disabled. The old v1.23 ZIP SHA256 remains unchanged.

Evidence: [source](redesign-v1.24/source-recovery.json),
[bundle](redesign-v1.24/bundle-recovery.json),
[bundle inventory](redesign-v1.24/bundle-build.json),
[ZIP verification](redesign-v1.24/archive-verification.json).

Commands:

```powershell
node --import tsx scripts/build-review-bundle.mts
node --import tsx scripts/check-pet-popup-recovery.mts
$env:QUOTAPULSE_REVIEW_ROOT = (Get-Content screens/tray-recovery/bundle-build.json -Raw | ConvertFrom-Json).bundle
node --import tsx scripts/check-pet-popup-recovery.mts
Remove-Item Env:QUOTAPULSE_REVIEW_ROOT
powershell -NoProfile -NonInteractive -File scripts/archive-review-bundle.ps1
```

## Review artifact

ZIP: `tmp/review-bundles/QuotaPulse-v1.24-TaztdT.zip` — 3,120 files,
199,838,621 compressed bytes. Every entry was decompressed and SHA256-compared
against the tested bundle. No profile is included.

SHA256: `224b6fce7c1db9b2c1e85b1c9814bd8a70c187f9477cce053047d0413730b5ea`

Extract to a fresh dedicated folder; run `./scripts/start-review.ps1`, then
`./scripts/stop-review.ps1` to stop that instance. Readers remain disabled and the
empty usage database is expected. Start-review initially hides the pet; enable it
through the app when trying the pet. Versioned installation uses the included
installer with this ZIP and SHA256 as documented in README-REVIEW.txt.
Requires Windows x64 and installed Node ABI 127 (validation used Node 22.13.1).
The 87 installed runtime packages and 114 web license inventories are retained.

## Remaining work

Actual unresponsive renderer recovery, pet document-load failure bounds, manual safe
mode exit, physical tray/pet clicks, interactive gallery checks, signed installer,
actual Windows logon, different-code/schema migrations and manual accessibility,
typography and concept approval remain. Installer/uninstall integrations from v1.23
are historical results; they were not rerun for this renderer-asset correction.
No live accounts were tested. ZIP validation used the tested bundle as its source,
not a second extracted installation. Forced crash recovery does not prove graceful
SQLite/SSE shutdown. Original checkout remains separate.
