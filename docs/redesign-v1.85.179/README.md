# Desktop review179 / source178

Portable Windows ZIP: `C:/Users/TH12367283/Projects/QuotaPulse/tmp/releases/QuotaPulse-v1.85.178-review179.zip`; SHA-256 `125fa3dca472e84c706b0f5cad5cc3877cdea4671086526d3afb56e4f66f56bd`. It contains application source `96c7ded2d2a220b6b39c10ff94cb1a7d0e40e4d6` including the source175 Projects divider, source176 long-path installer fix, source177 Alerts forecast and source178 Live tiles. [Latest concept/current gallery](../redesign-v1.85.178/review.html).

Fresh daemon/web/tray builds and 707 repository tests passed. All 3,161 ZIP entries were decompressed and checked against the unused bundle. Native review captured all eight screens in English/dark and Thai/light after restart, checked actual preload/settings and the latest Alerts/Live treatments. The first native test expected a forecast from disabled synthetic sources and failed; the rerun enabled the two owned fixture rows after startup and explicitly verified the scheduler still had no readers. No real user logs or accounts were accessed. These windows were offscreen/nonfocusable with reduced motion and QA anti-occlusion settings.

The fresh build driver reused the scratch filename `run-repository174.cjs` while writing the review179 runner. After testing, that actual runner was saved as `run-repository179.cjs` in the evidence and the earlier generated 174 runner was restored from its template. The test logs and result were written to review179-specific paths.

The actual ZIP passed six portable launch/stop/restart checks and six reader lifecycle checks with a fake home/log. A separate installation of the actual ZIP used the bundled current installer, verified all 3,161 installed files, extracted a 289-character path and started/stopped the installed daemon/tray with readers off. Physical monitors/tray clicks, production provider setups, signed packaging and cross-schema migration remain unverified.

After byte, path and process checks, four duplicate QA runtime copies were cleaned, reclaiming 1,815,067,370 bytes; 444,292 ASAR bytes remain. Central archives and original application data were retained.

Extract the ZIP to a dedicated folder. Requires compatible Windows x64 Node ABI127 (Node22.13.1 validated). In PowerShell inside the extracted folder, `./scripts/start-review.ps1` starts an isolated profile with readers off, and `./scripts/stop-review.ps1` stops its processes. To opt into actual local harness logs/configured quota readers, stop the review first and use `./scripts/start-review.ps1 -EnableReaders`; the collected data stays in that extracted folder's `review-data` and the existing QuotaPulse database is not imported. A default restart disables collection while retaining collected review data. Initial reader startup may take several minutes.

This is an unsigned review, not full visual or production acceptance. Full concept-plus-overrides approval and the broader goal remain open.
