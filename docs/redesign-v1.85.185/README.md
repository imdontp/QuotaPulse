# Desktop review185 / source184

Portable Windows ZIP: `C:\Users\TH12367283\Projects\QuotaPulse\tmp\releases\QuotaPulse-v1.85.184-review185.zip`; SHA-256 `48ae1fd60ed35d26d01629d0e23ddcbbbfbc0ad96313af5fd3adb24334e21610`. The bundle contains application source `8721aaa42327d026e186dfb6d93e0e4273a2d287`, including source182 Projects observed trend paint, source183 Live bounded curves, and source184 Providers row alignment. [Concept/current gallery](../redesign-v1.85.184/review.html).

Fresh daemon, web and tray builds and 708 repository tests passed. All 3,161 ZIP entries were decompressed and compared against the unused bundle. Native Electron review exercised all eight screens in English/dark and Thai/light after restart. Both passes checked the Live curve, Projects trend styling and mixed-quota Provider alignment in addition to preload and Settings. The windows were offscreen/nonfocusable with reduced motion and test-only anti-occlusion settings; this is not a physical monitor, tray or performance test.

The actual ZIP passed six portable launch/stop/restart checks and six reader lifecycle checks using fake home/log data. A separate installation verified all installed files, extracted a 289-character path, and started/stopped the daemon and tray with readers off. Real customer providers, signed packaging and cross-schema migration remain unverified.

The prior source184 Providers cross-context screenshot gate failed twice due to small shared-header/sidebar raster differences, with no changed pixels in the Providers workspace. That gate remains open; its unmasked evidence and investigation are in [source184](../redesign-v1.85.184/README.md). Passing native captures here does not resolve that gate or establish full concept parity.

After byte, path and process checks, four duplicate QA runtime copies were cleaned, reclaiming 1,815,076,850 bytes; 444,292 ASAR bytes remain. Central archives and existing application data were retained.

Extract the ZIP to a dedicated folder. Requires Windows x64 and compatible Node ABI127 (Node22.13.1 validated). In PowerShell inside the extracted folder, `./scripts/start-review.ps1` starts an isolated profile with readers off, and `./scripts/stop-review.ps1` stops its processes. To opt into actual local harness logs/configured quota readers, stop the review first and use `./scripts/start-review.ps1 -EnableReaders`; collected data stays in the extracted folder's `review-data` and the existing QuotaPulse database is not imported. A default restart disables collection while retaining collected data. Initial reader startup may take several minutes.

This is an unsigned review, not full visual or production acceptance. The Cost monthly projection remains unavailable because current ingestion state does not establish a complete, fresh call-grain month-to-date series. Full concept-plus-overrides approval and the broader goal remain open.
