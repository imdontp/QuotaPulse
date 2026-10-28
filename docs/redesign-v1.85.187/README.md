# Desktop review187 / source186

Portable Windows ZIP: `C:/Users/TH12367283/Projects/QuotaPulse/tmp/releases/QuotaPulse-v1.85.186-review187.zip`
SHA-256: `44626a7f62b5823113828cf01b1054892b218c31e91a8443b4144df8ae211d99`
Application source: `4c0afb80f2327d72b0d976daf33decd46271a98c`. [Eight-screen concept comparison](../redesign-v1.85.186/review.html).

Daemon, web and tray builds and 708 repository tests passed. All 3,161 ZIP entries were decompressed and compared with the built bundle. Actual Electron from that bundle passed 16 captures in English/dark and Thai/light with an isolated synthetic database, same-version restart and settings persistence. Windows were offscreen/nonfocusable with reduced motion and test-only anti-occlusion settings.

The delivered ZIP passed six standalone launch/stop/restart checks, six reader lifecycle checks using fake logs, and installation checks in an isolated fixture. After byte, path, and process checks, four duplicate test runtimes were cleaned, reclaiming 1,815,077,553 bytes; existing profiles and prior ZIPs were preserved.

Extract to a dedicated folder. Windows x64 and compatible Node ABI 127 are required (Node 22.13.1 was validated). In PowerShell, run `./scripts/start-review.ps1` to start with readers disabled, or first stop and run `./scripts/start-review.ps1 -EnableReaders` to collect actual local harness usage into the extracted folder's own `review-data`. This does not import the existing QuotaPulse database. Stop with `./scripts/stop-review.ps1`. Initial reader startup may take several minutes.

This is an unsigned review, not a production release. The 1536px cross-context raster discrepancy described in [source186](../redesign-v1.85.186/README.md) remains unresolved. Visual parity with the concepts, physical monitor/tray behavior, actual customer-provider setups, performance and cross-version migration/rollback are not established by these tests. Cost projection remains unavailable because freshness and completeness are not certified.
