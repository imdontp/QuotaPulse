# Desktop review181 / source180

Portable Windows ZIP: `C:\Users\TH12367283\Projects\QuotaPulse\tmp\releases\QuotaPulse-v1.85.180-review181.zip`; SHA-256 `79803b06d568b36c77838d87d3a20230fdcab9872fe2ba547d1f9c4753e5b056`. The bundle contains application source `40db02c94f86c830bddf7747982f194de8e58fce`, including the source180 History summary update. [Concept/current gallery](../redesign-v1.85.180/review.html).

Fresh daemon, web and tray builds and 707 repository tests passed. All 3,161 ZIP entries were decompressed and checked against the unused bundle. Native Electron review exercised eight screens in English/dark and Thai/light after restart, including the History compact layout and fallback, actual preload and Settings. The windows were offscreen/nonfocusable with reduced motion and QA anti-occlusion settings; this is not a physical monitor, tray or performance test.

The actual ZIP passed six portable launch/stop/restart checks and six reader lifecycle checks with fake home/log data. A separate installation of the actual ZIP verified all installed files, extracted a 289-character path and started/stopped the daemon and tray with readers off. Real customer providers, signed packaging and cross-schema migration remain unverified.

Current compiled Overview runtime motion was independently exercised against an isolated in-memory DB and actual local API/SSE: a new call moved on its real edge, a revised aggregate highlighted a node, repeats were suppressed, reduced motion was static and offscreen/in-flight/unmounted observations were not replayed. The scheduler notifications and source data were synthetic; actual adapter and native minimize behavior were not verified by this test.

After byte, path and process checks, four duplicate QA runtime copies were cleaned, reclaiming 1,815,074,273 bytes; 444,292 ASAR bytes remain. Central archives and original application data were retained.

Extract the ZIP to a dedicated folder. Requires Windows x64 and compatible Node ABI127 (Node22.13.1 validated). In PowerShell inside the extracted folder, `./scripts/start-review.ps1` starts an isolated profile with readers off, and `./scripts/stop-review.ps1` stops its processes. To opt into actual local harness logs/configured quota readers, stop the review first and use `./scripts/start-review.ps1 -EnableReaders`; collected data stays in the extracted folder's `review-data` and the existing QuotaPulse database is not imported. A default restart disables collection while retaining collected data. Initial reader startup may take several minutes.

This is an unsigned review, not full visual or production acceptance. Full concept-plus-overrides approval and the broader goal remain open.
