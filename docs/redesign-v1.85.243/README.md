# Windows review243

Portable ZIP: `C:/Users/TH12367283/Projects/QuotaPulse/tmp/releases/QuotaPulse-v1.85.242-review243.zip`

SHA-256: `8139b9fec3fcb8e2839f54080b7eed8a763a99ecb3b9a087d20d0f1efeff186c`

Application source: `d71aa1480af0b9f332ebf757a3c37f0761628a1e`; tag `redesign-native-review-v1.85.243`.

Since [review236](../redesign-v1.85.236/README.md), this build adds History's recorded-bucket emphasis, truthful recent-session labels, protection against showing Overview quota history from the previous reset period, and compact Providers cards with no quota readings. A Runtime Map inspector regression and the visual/motion test gate were also strengthened. The source changes are described in checkpoints 237–242.

Fresh daemon, web and tray builds passed, followed by 151 daemon, 382 web and 198 tray tests. The ZIP's 3,165 files were decompressed and SHA-256 compared against the unused source bundle; the delivered copy was independently hashed. The actual ZIP was installed to an isolated test directory, matched against the complete source bundle inventory, and launched/stopped with readers disabled; a path longer than 260 characters was verified. A separate extraction of the delivered ZIP passed six reader lifecycle checks using a synthetic log and fake home, including opt-in, incremental refresh, restart, deduplication and default readers-off behavior.

Actual packaged Electron, preload, daemon and web content passed 16 native dashboard captures across eight pages in English/dark and Thai/light, including a restart and settings restoration in a synthetic profile. The native windows were offscreen with test-only anti-occlusion settings and reduced motion. Detailed receipts, test logs and captures are retained in `evidence.tar.gz`. The subsequent [review236 ↔ review243 rollback check](../redesign-v1.85.244/README.md) covers one synthetic schema 7 profile and records an initial native-close timeout before a successful full rerun.

Three test runtime copies were verified against every ZIP entry, checked for processes, and cleaned while retaining synthetic profiles and three small ASAR residues. The byte-identical duplicate ZIP was also removed after the delivered copy was verified. Together this reclaimed 1,567,290,529 bytes. The cleaned test installations require runtime restoration from the ZIP before reuse.

On Windows x64, extract the ZIP into a new dedicated folder. Node 22.13.1 (ABI 127) was used for verification and must be available on `PATH`. In PowerShell in the extracted folder, run `./scripts/start-review.ps1` to start with readers disabled and open the dashboard from the review tray icon. This mode starts with an empty database in its own `review-data`. To collect actual local harness logs, stop first and run `./scripts/start-review.ps1 -EnableReaders`; the initial scan can take several minutes. Stop this review instance with `./scripts/stop-review.ps1`. These commands do not install a scheduled task. The ZIP's `README-REVIEW.txt` describes versioned installation and rollback.

This unsigned review is not production certification or a claim of 99–100% visual parity. Physical monitor/tray behavior, actual provider accounts, cross-schema migration, production performance, Cost projection completeness and remaining visual/motion gaps are not certified by these checks. The overall redesign goal remains open.
