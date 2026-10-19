# Release/native next-stage audit85

Read-only next-stage release/native/performance audit; no browser/build/Git/services/userDB touched. Current85 concurrent modifications not certified by older84 evidence.

## Authority boundaries

- Blueprint 13 requires exact app checkout plus matching assets for rollback; no migration/reset/reprice.
- A signed MSI/EXE or bundling Node is not explicitly required. Existing unsigned review bundle documents external Node/ABI requirement; call it that.
- Native69 minimize failure is not a confirmed production bug: altered taskbar/focusability/off-monitor fixture, restore1700 and unmount never reached.
- Motion authority is “New observed call on a known edge”, not “every ingested CALL”. Source omission concern needs controlled runtime reproduction.

## Concrete requirement/evidence map

### REL-01 — incomplete

Exact application commit and matching built assets constitute rollback; additive reads, no user DB deletion/reprice/reset.

Authority: 13_COMPATIBILITY_AND_RELEASE.md Deployment/recovery;08_DEFINITION_OF_DONE.md Application RC

Evidence: scripts/check-review-installation.ps1:34 Variant edits checkpoint only; scripts/check-review-installation.ps1:110 synthetic-upgrade-same-runtime; scripts/check-review-legacy-upgrade.ps1 same compiled app/schema limitation

Next: Build two real checkouts (current frozen RC and previous known application commit), archive each matching daemon/web/tray/preload; seed isolated review DB with usage/pricing/null/aggregate and app settings; exercise prior->current->prior->current with adapters off. Verify actual runtime/asset hashes at every step and invariant fact/settings snapshots. Installer same-runtime rollback remains valid installer coverage only.

### REL-02 — capability exists; current RC evidence open

Reviewable artifact with exact source/artifact/reference/fixture/environment/test provenance.

Authority: 13_COMPATIBILITY_AND_RELEASE.md Release evidence;08_DEFINITION_OF_DONE.md Application RC

Evidence: scripts/build-review-bundle.mts; scripts/archive-review-bundle.ps1; scripts/check-review-bundle.mts; docs/redesign-v1.67/bundle-build.json historical example

Next: Compile daemon, tray and web after freeze; package existing compatibility pet assets; build explicitly named checkpoint bundle, verify outside repo dependencies, archive and decompress/hash every ZIP entry. Bind commit plus all compiled assets and tests in one RC index. Default builder label v1.67 must be overridden.

### REL-03 — implemented packaging capability; current artifact unverified

Bundled fonts/local assets and third-party notices preserved.

Authority: 03_DESIGN_SYSTEM_AND_MOTION.md Visual foundation (bundled Geist/Geist Mono/local assets);review-artifact integrity derived from release evidence

Evidence: scripts/build-review-bundle.mts:64 recursively copies installed web notice files; scripts/build-review-bundle.mts:49 full Electron package incl licenses; scripts/archive-review-bundle.ps1 required Thai OFL/font, Geist notices, Electron license, SQLite native module; scripts/check-asset-package.mts explicitly pet-assets-only scope

Next: After current bundle build, verify notice inventory/file presence and hashes, explicitly report dependencies with empty notice file lists for review, keep font license and runtime asset inventory. Do not treat pet-only package verification as whole-app packaging.

### NATIVE-01 — partial historical evidence; production-equivalent minimize remains unverified

Real hidden/minimized/restore/latest/unmount behavior stops nonessential work and resumes latest without replay.

Authority: 03_DESIGN_SYSTEM_AND_MOTION.md Motion contract;05_TEST_AND_VISUAL_PARITY.md Live/UI + Performance

Evidence: docs/redesign-v1.85.69/electron-activity-verification.json partial: real hide/no paint/latest800, minimize predicate timeout, restore1700/unmount unreached; docs/redesign-v1.85.69/activity-electron-native69-entry.cjs skipTaskbar true/focusable false/force off-monitor; packages/tray/src/main.ts:2658 production dashboard skipTaskbar false/default focusable; throttling omitted; scripts/check-runtime-motion.mts:189 explicit no native-minimize claim

Next: Raw Electron/parent IPC without Playwright/CDP flags. Prefer actual compiled main launched in isolated task-entry profile with lock pointing synthetic API, instrument window creation non-mutatingly before import. Preserve native window settings; observe actual document.hidden and native minimized separately. Hide/update/show then minimize/update/restore, require current actual bucket1700, no hidden paint/no replay and route unmount cleanup. Native69 is not proven production defect.

### NATIVE-02 — executable coverage exists; final frozen current build not certified here

Popup, preload/IPC/sandbox/readiness and renderer crash/hang recovery preserved.

Authority: 13_COMPATIBILITY_AND_RELEASE.md Electron/preferences;08_DEFINITION_OF_DONE.md popup compatibility

Evidence: scripts/check-desktop-runtime.mts fixture host compiled preloads/web, not actual tray main; scripts/check-tray-recovery.mts actual compiled main, synthetic DB, crash + bounded load failure + reopen; scripts/check-pet-popup-recovery.mts existing surfaces compatibility (not new pet work); scripts/check-unresponsive-recovery.mts raw Electron actual main hang; runtime-root bundle support

Next: Run sequentially after frozen build and again from extracted artifact using QUOTAPULSE_REVIEW_ROOT for supported recovery scripts. Archive actual process identity/preferences and artifact hashes. Do not use Playwright-host visibility as native lifecycle proof.

### COMPAT-01 — incomplete final integration

Previous web/tray API defaults/cardinality and persisted preferences remain valid.

Authority: 13_COMPATIBILITY_AND_RELEASE.md Electron/preferences + Deployment/recovery

Evidence: scripts/check-review-installation.ps1 DB sentinel only; variants same runtime; scripts/check-desktop-runtime.mts popup hidden preferences tested in fixture; docs/redesign-v1.85.84/VALIDATION-STATE.md declares persistence/compat open

Next: Use actual previous built web/tray against final synthetic daemon; exact old endpoint shapes/defaults/cardinality checked. Persist language/theme/currency/rate/window/notification/snooze/quiet-hour/hidden-subscription settings in isolated installation, stop and restart, assert same values/visible behavior. Preserve user profile entirely.

### PERF-01 — partial capability; final CPU/render/query/timer/SSE/native evidence open

Measured initial render/query count/chart commits/real paints/hidden work; navigation does not accumulate timers/SSE; large fixture query plans.

Authority: 05_TEST_AND_VISUAL_PARITY.md Performance and commands;13_COMPATIBILITY_AND_RELEASE.md profile large chunk warning

Evidence: scripts/check-production-runtime.mts:50 nine route-ready/navigation/paint/resources measurements and 5000 record summary timings; scripts/check-activity-visibility.mts actual-source mount, emulated getters fallback explicitly labelled; scripts/check-runtime-motion.mts compiled actual API/SSE motion but no native minimize or CPU claim; tmp/effort85-probe-results.json current concurrent work (not audited for pass in this release audit)

Next: Use same frozen app+synthetic fixture across visible/hidden/offscreen and navigation cycles. Record query and SSE counts, DOM/chart commits/paints, bitmap allocations, process CPU and cold chunk transfer/readiness; EXPLAIN/count/payload for large history/many-model/effort fixture. Preserve current85 effort evidence separately; no arbitrary performance percentage or library rewrite.

### VISUAL-01 — incomplete

Review first real implementation against all eight concepts+overrides, then SSIM >=.985 vs accepted deterministic implementation baseline; keyboard/contrast/theme/locale/narrow and motion gates.

Authority: 05_TEST_AND_VISUAL_PARITY.md Visual procedure;08_DEFINITION_OF_DONE.md Application screen

Evidence: docs/redesign-v1.85.84/VALIDATION-STATE.md explicitly all-eight human acceptance open; docs/redesign-v1.85.84/review.html current84 comparison; scoped repeatability is not accepted Source baseline

Next: Finish and review genuine all8 Source composition/typography/art/layout with real facts, lock approved implementation baseline with reviewer/commit/overrides, then final frozen all40/current API/UI/native/perf/package matrix. No local ROI improvement can establish 99-100%.

### MOTION-OBSERVATION — source establishes conditional omission path; runtime contract defect unproven

New observed call on a known edge -> one700ms particle/highlight; no idle/replay, aggregate node-only.

Authority: 03_DESIGN_SYSTEM_AND_MOTION.md literal row: New observed call on a known edge

Evidence: packages/web/src/redesign/production.tsx:74 newest event per harness limit1 without map selected project; packages/web/src/redesign/production.tsx:111 selected project applied to separate graph request; packages/web/src/redesign/use-runtime-motion.ts:34 project scope applied to same batch rows; packages/web/src/redesign/runtime-motion.ts:55 exact project inScope filter, known edge checks

Next: Two projects share harness, selected A: insert new eligible call A then newer B before one refresh; compare A-only control vs A+B with same visibility/request epoch/known graph/clock. Observe actual request rows and rendered signals. Require exact scoped observation if intended; do not silently redefine literal observed contract into every ingested event.

## Minimal executable sequence

1. Resolve current85 bounded work and record its actual terminal checks; freeze source before any final RC claims.
2. Targeted selected-project motion control (same compiled build, real synthetic API/SSE, no adapters). If needed fix causally and rerun scoped motion regression; avoid broad package work until visual app source accepted.
3. Prepare raw native lifecycle harness importing actual compiled main (or fixture options exactly compared with production). Fresh profile/daemon lock, adapters [], localhost unique port, record default throttling/argv/preferences. Parent IPC gives all native commands and bounded owned-process cleanup; no document.hidden override or CDP focus emulation. Investigate any failure as instrument first.
4. Native sequence: visible baseline -> hide -> ingest/theme/resize -> assert no paints -> show latest800 -> minimize -> verify native and document states independently -> ingest latest1700 -> restore -> verify latest + no replay -> navigate away/unmount -> dispatch changes and assert listeners/timers/detached paints absent.
5. Freeze final source, compile all components and preserve matching assets/fingerprints. Run required unit/API/UI/full40/native/performance on this exact build; scope old evidence explicitly.
6. npm.cmd run daemon:build; npm.cmd run build -w @quotapulse/tray; npm.cmd run build -w @quotapulse/web; npm.cmd run package -w @quotapulse/tray; node --import tsx scripts/check-asset-package.mts (commands shown individually; root schedules build/browser slot).
7. Set QUOTAPULSE_REVIEW_CHECKPOINT to exact version; node --import tsx scripts/build-review-bundle.mts; node --import tsx scripts/check-review-bundle.mts; powershell -NoProfile -File scripts/archive-review-bundle.ps1. Preserve initial bundle path; launch check extracts elsewhere so archive stays profile-free.
8. Against QUOTAPULSE_REVIEW_ROOT=exact extracted bundle: run tray recovery, pet-popup compatibility recovery and actual unresponsive recovery sequentially. Native visibility uses raw production-equivalent harness, not these Playwright sessions.
9. Build actual prior application checkout+matching assets in separate safe worktree and a second current bundle. Dedicated review install only: old start/seed/stop -> current upgrade/start/check/stop -> rollback old/start/check/stop -> current restore/check. Compare fact/settings snapshots and immutable asset hashes; run same-runtime installer negatives separately.
10. Publish one reviewable current ZIP/checksum/source+artifact+environment evidence index and all8 Source comparison. Request final human visual/keyboard/contrast acceptance only after concrete artifacts ready. Keep whole goal active until full requirements proven.

All browser/native commands remain root-owned and sequential. No launch, build, mutations to implementation or Git were performed by this audit. JSON includes inspected LF source hashes. Goal remains active; no whole-goal completion claim.
