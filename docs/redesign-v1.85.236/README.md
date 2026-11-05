# Windows review236

Portable Windows ZIP: `C:/Users/TH12367283/Projects/QuotaPulse/tmp/releases/QuotaPulse-v1.85.235-review236.zip`

SHA-256: `15c62a2b32be2b7ce87d50daf27f4129e2420ebccd982927720c2fa03afd6328`

Application source: `194cafb367afec214960b655bad238dc1d32a277`; tag `redesign-native-review-v1.85.236`.

Since [review230](../redesign-v1.85.230/README.md), this build adds [recorded Cost summary points](../redesign-v1.85.232/README.md), [transcript parse uncertainty diagnostics](../redesign-v1.85.233/README.md), [reader-scoped Alerts history](../redesign-v1.85.234/README.md), and the [Projects selected-card atmosphere](../redesign-v1.85.235/review.html). All values and curves remain tied to real observations; screenshots used synthetic fixture data.

Fresh daemon, web and tray builds passed, as did 731 tests (151 daemon, 382 web, 198 tray). All 3,165 ZIP entries were decompressed and SHA-256 compared with the unused build. Electron passed 16 dashboard captures across eight pages in English/dark and Thai/light with a synthetic profile and restart. The native windows were offscreen, with test-only anti-occlusion settings and reduced motion.

The actual ZIP passed six standalone extraction/start/stop checks, six synthetic reader lifecycle checks and four isolated installer checks, including a Windows path over 260 characters. Review230 → review236 → review230 → review236 passed on one isolated synthetic schema 7 profile: durable usage, settings and pricing snapshots remained equal, and a separate Electron launch verified language, theme, currency and exchange rate at each stage. These checks do not establish cross-schema migration or live provider behavior.

Six duplicate runtime trees were checked against the retained ZIPs and cleaned after owned processes stopped, reclaiming 2,721,522,891 bytes. Synthetic profiles, evidence and 666,438 bytes of ASAR residues remain; the test installations need their runtimes restored from the ZIPs before reuse. Both retained ZIP hashes were rechecked. Detailed receipts and test logs are in `evidence.tar.gz`.

On Windows x64, extract the ZIP to a new dedicated folder. Node 22.13.1 (ABI 127) was used for verification and must be available on `PATH`. In PowerShell in that folder, run `./scripts/start-review.ps1` to start with readers disabled; open the dashboard from the review tray icon. This mode starts with an empty database in its own `review-data`. To read actual local harness logs, stop first and run `./scripts/start-review.ps1 -EnableReaders`; the initial scan can take several minutes. Stop this review instance with `./scripts/stop-review.ps1`. These commands do not install a scheduled task. The ZIP's `README-REVIEW.txt` also describes versioned installation and rollback.

This is an unsigned review, not production or 99–100% visual acceptance. Physical monitor/tray behavior, actual provider accounts, cross-schema migration, production performance, Cost projection completeness and remaining visual/motion gaps are not certified by these checks. The overall redesign goal remains open.
