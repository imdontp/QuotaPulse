# Windows review230

Portable Windows ZIP: `C:/Users/TH12367283/Projects/QuotaPulse/tmp/releases/QuotaPulse-v1.85.229-review230.zip`

SHA-256: `cc1e3f836900b06b262f2ac3118ba1b63073a396b3259bc1e57f053e612c67b7`

Application source: `429877f92b9b6f5df275550fb57bb2a3573c82af`

Tag: `redesign-native-review-v1.85.230`

This review adds the [Projects recorded-trend refinement](../redesign-v1.85.226/README.md), [incomplete transcript discovery diagnostics and narrow-screen fix](../redesign-v1.85.229/README.md) since review224. The [eight-page comparison](../redesign-v1.85.228/review.html) is a synthetic static review, not visual acceptance.

Fresh daemon, web and tray builds passed, followed by 725 repository tests (146 daemon, 381 web, 198 tray). All 3,163 ZIP entries were decompressed and SHA-256 compared with the unused build. Actual Electron passed 16 dashboard captures across eight pages in English/dark and Thai/light, including same-version restart in an isolated synthetic profile. Native windows were offscreen and nonfocusable, using test-only anti-occlusion settings and reduced motion.

The first native run failed because the temporary driver generator replaced the number `224` inside a Models RGB assertion while changing the review number. The original source color and prior evidence confirmed the correct expected RGB; the generator and assertion were corrected, and the full native run passed. Both runs are retained in `evidence.tar.gz`.

The actual ZIP passed six standalone extraction/start/stop checks, six synthetic reader lifecycle checks and four isolated installation checks, including a long Windows path. Four duplicate runtime trees were checked against the retained ZIP, then cleaned after process checks, reclaiming 1,814,312,944 bytes. The isolated profiles and 444,292 bytes of ASAR residues remain. The retained ZIP hash was rechecked. Upgrade and rollback involving review230 have not yet been tested.

On Windows x64, extract the ZIP to a new dedicated folder. Node 22.13.1 (ABI 127) was used for verification and must be available on `PATH`. In PowerShell in that folder, run `./scripts/start-review.ps1` to start with readers disabled; open the dashboard from the review tray icon. This mode starts with an empty database and keeps its own `review-data`. To read actual local harness logs, stop first and run `./scripts/start-review.ps1 -EnableReaders`; the initial scan can take several minutes. Stop this review instance with `./scripts/stop-review.ps1`. No scheduled task is installed by these commands.

This is an unsigned review, not production or 99–100% visual acceptance. Physical monitor/tray behavior, actual provider accounts, cross-schema migration and production performance remain unverified. Cost projection completeness and the visual and interaction gaps documented in [the comparison audit](../redesign-v1.85.212/README.md) remain open.
