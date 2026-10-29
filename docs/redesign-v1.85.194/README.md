# Desktop review194

Portable Windows ZIP: `C:/Users/TH12367283/Projects/QuotaPulse/tmp/releases/QuotaPulse-v1.85.193-review194.zip`

SHA-256: `6597aad5e504056cef514ff8a35f739936fec6feb110b06f3139aa5197613e7d`. Source commit: `f14d872f4acd28410c08868781ded98538ced64a`. [Current concept comparison](../redesign-v1.85.193/review.html).

This review includes the Model Details presentation from source `5f31bc3`. Fresh daemon, web and tray builds and all 713 repository tests passed (139 daemon, 376 web and 198 tray). The web build's 88 file hashes match the capture in checkpoint193. All 3,161 ZIP entries were decompressed and compared to the unused tested bundle. Native Electron passed 16 captures, English/dark and Thai/light, with isolated synthetic data and a same-version restart, including the new Model Details styles. The native windows were offscreen and nonfocusable with reduced motion and test-only anti-occlusion settings.

The delivered ZIP passed six standalone launch/stop/restart checks, six reader lifecycle checks against owned fake logs, and four isolated installation checks. Four byte-verified duplicate QA runtime trees were cleaned after process and path checks, reclaiming 1,815,095,168 bytes; small ASAR residues were retained. Existing application data and earlier release archives were preserved.

Extract to a dedicated folder on Windows x64. Compatible Node ABI127 is required; Node22.13.1 was validated. Run `./scripts/start-review.ps1` in PowerShell to launch with readers off. To collect actual local harness usage into the extracted folder's own `review-data`, stop it first and run `./scripts/start-review.ps1 -EnableReaders`. Existing QuotaPulse databases are not imported. Stop using `./scripts/stop-review.ps1`. Initial reader startup may take several minutes.

This is an unsigned review, not full product acceptance. Complete visual parity, physical monitor/tray behavior, real customer-provider setups, performance and cross-version migration/rollback remain open. Previously skipped records are not automatically recovered, malformed complete JSONL lines are still skipped, and Cost projection remains unavailable because temporal completeness and freshness are not certified.
