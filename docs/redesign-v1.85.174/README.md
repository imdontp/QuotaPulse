# Desktop review174 / source173

Portable Windows review ZIP: `C:/Users/TH12367283/Projects/QuotaPulse/tmp/releases/QuotaPulse-v1.85.173-review174.zip`; SHA-256 `f7b42d3c3d5ae06fa624cafb6f1a48139f7964ed07f08bafc4801cd0279d4c37`. This archive contains source `82909f76b73f28c991062e0c0482f846ec81ca9c`. It does not include later source175 edits.

Fresh builds and 707 repository tests passed. All 3,161 ZIP entries were checked against the unused bundle; the actual ZIP passed six standalone launch/stop/restart checks and six owned-reader opt-in/incremental/deduplication checks. The synthetic reader test used a fake home and disabled account probes, and did not exercise an installed wrapper. The native offscreen test captured all eight screens in English/dark at 1672×941 and Thai/light after restart, including real preload and persisted settings. It used reduced motion, nonfocusable/offscreen windows and test-only anti-occlusion settings.

The original 1742px native run was an accidental checkpoint-substitution error; the separate corrected 1672px run is the result counted here. Physical monitor/tray/minimize, native performance, customer accounts and actual two-version upgrade/rollback remain unverified. This is an unsigned portable review; full visual baseline approval remains open.

After checking each ZIP-matched file, path and process ownership, three QA runtime copies were cleaned, reclaiming 1,361,504,097 bytes; 333,219 ASAR bytes remain. Central archives and original application data were retained.

Extract the ZIP to a dedicated folder. With compatible Windows x64 Node ABI127 (Node22.13.1 validated), use `./scripts/start-review.ps1` and `./scripts/stop-review.ps1`. The default keeps readers off. `./scripts/start-review.ps1 -EnableReaders` explicitly opts in to scanning installed harness logs and configured quota readers into the isolated review-data database; stop the review first when switching modes. The owned synthetic reader test does not certify every actual provider/account setup.
