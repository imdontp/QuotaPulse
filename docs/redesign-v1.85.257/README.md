# Windows review257

Portable ZIP: `C:\Users\TH12367283\Projects\QuotaPulse\tmp\releases\QuotaPulse-v1.85.256-review257.zip`

SHA-256: `136e509e3ef7cb67abbf704cf752be48efa8f99ac98ab6df09e80c46a43a07cb`

Application source: `b9d66e9c5e5853c02617ae86babd476c8d8d6fe4`; tag: `redesign-native-review-v1.85.257`.

This review includes the History legend adjustment, transcript uncertainty warnings, Overview cache-support layout change, and Live timeline guides added after review249. The application remains data-driven; fixture images and reader logs used in testing are synthetic, not user data. Cost projection remains unavailable when the required complete, fresh source coverage cannot be established.

Fresh daemon, web and tray builds passed, followed by 160 daemon, 382 web and 198 tray tests. Packaged pet assets matched all 209 files in review249 and their tracked sources had not changed. The archive has 3,165 files; each ZIP entry was decompressed and SHA-256 compared against the unused source bundle, and the delivered ZIP's checksum was independently verified.

The delivered ZIP was installed in a separate test directory; its runtime inventory matched the bundle, a path longer than 260 characters was checked, and its daemon and tray started and stopped with readers disabled while preserving the isolated profile. A separate extraction of the actual ZIP passed six reader tests against a synthetic Codex log in a fake home: opt-in, incremental refresh, restart and default readers-off behavior. Account quota probes were disabled for this test.

Actual packaged Electron, preload, daemon and web content passed 16 native dashboard captures across all eight pages in English/dark and Thai/light, including a restart and settings restoration in a synthetic profile. Windows were offscreen with test-only anti-occlusion settings and reduced motion. Native evidence and build, archive, installation and reader receipts are in `evidence.tar.gz`.

Three runtime test copies were byte-verified against the retained ZIP, checked for active fixture processes and cleaned; synthetic profiles and small ASAR residues were retained. A separately verified duplicate ZIP was removed. These steps reclaimed 1,567,311,278 bytes; test runtimes must be restored from the retained ZIP before reuse. Cleanup receipts are included in the subsequent rollback evidence.

On Windows x64, extract the ZIP into a new dedicated folder. Node 22.13.1 (ABI 127) was used for verification and must be available on `PATH`. In PowerShell in the extracted folder, run `./scripts/start-review.ps1` to start with readers disabled, then open the dashboard from the review tray icon. This starts with an empty database in its own `review-data`. To collect actual local harness logs, stop first and run `./scripts/start-review.ps1 -EnableReaders`; initial scanning can take several minutes. Stop with `./scripts/stop-review.ps1`. No scheduled task is installed. The ZIP's `README-REVIEW.txt` describes versioned installation and rollback.

This unsigned review is not a production certification or a claim of 99–100% visual parity. Physical monitor and tray behavior, actual provider accounts, cross-schema migration, production performance, Cost completeness and remaining visual/motion acceptance are not certified by these checks. A subsequent [review249 ↔ review257 upgrade and rollback check](../redesign-v1.85.258/README.md) covers one synthetic schema 7 profile. The overall redesign goal remains open.
