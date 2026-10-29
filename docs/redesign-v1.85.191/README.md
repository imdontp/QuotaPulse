# Desktop review191 / source190

Portable Windows ZIP: `C:/Users/TH12367283/Projects/QuotaPulse/tmp/releases/QuotaPulse-v1.85.190-review191.zip`

SHA-256: `b32c90621008db0c47ad6268a752bea9a70701c3a17477cc9b679fa9e891ed9c`

Application source: `20ebfd4aa692249b1f85ba9751a901fe7a8d9ddd`. [Eight-screen concept comparison](../redesign-v1.85.189/review.html).

This review combines the source188 Overview decorative arcs, source189 Alerts heading, and source190 JSONL retry integrity fix. The daemon, web and tray builds and 713 repository tests passed. The compiled bundle also passed an in-memory SQLite failure/retry check against a synthetic Codex rollout. All 3,161 ZIP entries were decompressed and compared against the tested bundle. Native Electron passed 16 captures in English/dark and Thai/light with an isolated synthetic profile and a same-version restart; it checked both visual changes. Windows were offscreen/nonfocusable with reduced motion and test-only anti-occlusion settings.

The first build-driver attempt stopped before building because its expected Alerts CSS checksum still referred to source177. The driver was corrected to verify the actual source189 checksum; all subsequent build stages ran fresh.

The delivered ZIP passed six standalone launch/stop/restart checks, six reader lifecycle checks using fake logs, and isolated installation checks. After archive-byte, path and process verification, four duplicate QA runtimes were cleaned, reclaiming 1,815,090,370 bytes; earlier review archives and existing application data were preserved.

Extract to a dedicated folder. Requires Windows x64 and compatible Node ABI127 (Node22.13.1 was validated). In PowerShell inside the extracted folder, `./scripts/start-review.ps1` starts readers off. To collect real local harness usage into that folder's own `review-data`, stop the review first and use `./scripts/start-review.ps1 -EnableReaders`. Existing QuotaPulse databases are not imported. Stop with `./scripts/stop-review.ps1`. Initial reader startup may take several minutes.

This is an unsigned review, not full product acceptance. Previously skipped records are not automatically recovered, syntactically malformed complete JSONL lines are still skipped, and the Cost projection remains unavailable because temporal completeness and freshness are not certified. The header raster discrepancy at 1536px, full visual parity, physical monitor/tray behavior, real customer-provider setups, performance and cross-version migration/rollback remain open.
