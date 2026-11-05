# Windows review224

Portable Windows ZIP: `C:/Users/TH12367283/Projects/QuotaPulse/tmp/releases/QuotaPulse-v1.85.223-review224.zip`

SHA-256: `cb86bf39c6afb5e75733538aa960b9fb0dcad41ccae823799c5637b928efb6cb`

Application source: `0e3b87f5718f6fcdea92130e9b245c769e9d5063`

Tag: `redesign-native-review-v1.85.224`

This review adds the Projects identity styling, Runtime Map focus correction, source detection preservation and account-reader detection diagnostics since review218. The [eight-page comparison](../redesign-v1.85.221/review.html) shows a prior build with synthetic data and is not visual acceptance.

Fresh daemon, web and tray builds passed, followed by 723 repository tests (144 daemon, 381 web, 198 tray). The ZIP's 3,161 entries were decompressed and SHA-256 compared with the unused build. Actual Electron passed 16 captures across the eight pages in English/dark and Thai/light, including same-version restart in an isolated synthetic profile. Native windows were offscreen and nonfocusable with test-only anti-occlusion settings and reduced motion.

The delivered ZIP passed six standalone extraction/start/stop checks, six owned synthetic-reader checks and four isolated installation checks. [Upgrade and rollback from review218](../redesign-v1.85.225/README.md) passed on one synthetic schema 7 profile. Four duplicate review runtime trees and two duplicate rollback runtime trees were byte-verified against their retained ZIPs and cleaned after process checks; their profiles and small ASAR residues remain. Both retained ZIPs were rehashed afterwards.

On Windows x64, extract the ZIP to a new dedicated folder. Node 22.13.1 (ABI 127) was used for verification and must be available on `PATH`. In PowerShell in that folder, run `./scripts/start-review.ps1` to start with readers disabled; open the dashboard from the review tray icon. This mode starts with an empty database and keeps its own `review-data`. To read actual local harness logs, stop first and run `./scripts/start-review.ps1 -EnableReaders`; the initial scan can take several minutes. Stop this review instance with `./scripts/stop-review.ps1`. No scheduled task is installed by these commands.

This is an unsigned review, not production or 99–100% visual acceptance. Physical monitor/tray behavior, actual provider accounts, cross-schema migration and production performance remain unverified. Projection completeness and the visual and interaction gaps documented in [the comparison audit](../redesign-v1.85.212/README.md) remain open.
