# Windows review249

Portable ZIP: `C:\Users\TH12367283\Projects\QuotaPulse\tmp\releases\QuotaPulse-v1.85.248-review249.zip`

SHA-256: `e61af3f5e5443ced0f63357df0cf303dd506775d9bea9993b8fcaff56d3a5de9`

Application source: `0976caf04664cd27b19b2d1abedf1a1ea5e5874f`; tag `redesign-native-review-v1.85.249`.

This review includes the Models input/output ring color adjustment, Overview quota typography, and the precise-percentage overflow fix in checkpoints 246–248. The unchanged application remains data-driven; fixture screenshots are test data, not customer records. Review243 predates these changes.

Fresh daemon, web and tray builds passed, followed by 151 daemon, 382 web and 198 tray tests. Existing packaged pet assets were byte-verified against all 209 files from review243; their tracked sources did not change since then. All 3,165 ZIP entries were decompressed and SHA-256 compared with the unused source bundle, and the delivered copy was independently hashed.

The actual delivered ZIP was installed in an isolated test directory, matched against the complete bundle inventory, and started/stopped with readers disabled; an entry with a 289-character installed path was checked. A separate extraction passed six reader checks with a synthetic log and fake home, including explicit opt-in, incremental refresh, restart and default readers-off behavior.

Actual packaged Electron, preload, daemon and web content passed 16 native dashboard captures across eight pages in English/dark and Thai/light, including a restart and settings restoration in a synthetic profile. Native windows were offscreen with test-only anti-occlusion settings and reduced motion. The first native run captured all 16 screens but timed out waiting for Electron's close event; the reported Electron main and daemon PIDs were subsequently absent when checked. A fresh repeat passed the full original check. The timeout's cause remains unknown: the repeat does not establish a fix. The failed receipt, successful captures, test logs and cleanup receipts are retained in `evidence.tar.gz`.

Three owned runtime copies were verified against the ZIP, checked for processes and cleaned; their synthetic profiles and three small ASAR residues were retained. A verified duplicate ZIP was also removed. Together these steps reclaimed 1,567,291,609 bytes. The cleaned test installations require runtime restoration from the retained ZIP before reuse.

On Windows x64, extract the ZIP into a new dedicated folder. Node 22.13.1 (ABI 127) was used for verification and must be available on `PATH`. In PowerShell in the extracted folder, run `./scripts/start-review.ps1` to start with readers disabled and open the dashboard from the review tray icon. This starts with an empty database in its own `review-data`. To collect actual local harness logs, stop first and run `./scripts/start-review.ps1 -EnableReaders`; the initial scan can take several minutes. Stop with `./scripts/stop-review.ps1`. No scheduled task is installed. The ZIP's `README-REVIEW.txt` describes versioned installation and rollback.

This unsigned review is not production certification or a claim of 99–100% visual parity. A subsequent [review243 ↔ review249 rollback check](../redesign-v1.85.250/README.md) covers one synthetic schema 7 profile. Physical monitor/tray behavior, actual provider accounts, cross-schema migration, production performance, Cost projection completeness and remaining visual/motion gaps are not certified by these checks. The overall redesign goal remains open.
