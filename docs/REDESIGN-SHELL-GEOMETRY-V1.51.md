# Shared shell geometry v1.51

Continue the full eight-page reference redesign and preserved Settings surface
after the v1.50 runway checkpoint. This work reconciles the sidebar, separate
header brand column and main content inset with the supplied images.

## Reference evidence

Read-only inspection of the original PNGs finds the Overview sidebar separator
at x=215 (1586px source width). At y=400 its RGB is (19,32,44), brighter than its
adjacent dark columns. Live's separator is x=226 at the same row, RGB (18,33,51),
in a 1672px-wide source. Across y=100 through height-50, vertical local contrast
also peaks at x=226 for Alerts, History, Live, Models and Projects. Cost has a
two-pixel separator at 226–227. Providers has a distinct separator/composition
and is not evidence of an identical border in every source.

The source header brand column extends beyond the body sidebar: approximately
254px for Overview and 267px for Live. The earlier application tied both columns
to 226px and used a 16px default main inset. Source content starts approximately
12px after the body sidebar on Overview and Live.

## Changes

- Desktop sidebar is 216px at widths 1101–1600px, matching the Overview separator;
  the larger desktop layout retains 226px. The intermediate breakpoint is a
  responsive implementation choice, not an extra supplied reference image.
- The desktop header brand uses a separate `clamp(253px,16vw,267px)` column.
  Collapsed sidebars and their header brand remain 66px/48px at existing widths.
- Default main padding becomes 12px. Existing page-specific 12px composition
  rules and Overview's 8px top inset remain in effect.
- The shell browser gate now checks these independent column widths. Responsive
  navigation, active-page semantics, keyboard command dialog and no-overflow
  checks remain required.

## Validation

The TypeScript/Vite build passed with the existing chunk warning. The complete
production browser harness passed across the eight dashboard pages plus
Settings, English/Thai and dark/light. All 40 repeated capture pairs passed
within unchanged raster tolerance, without masks. Of these, 35 are byte-identical.
Overview dark pairs each differ by 17 pixels at maximum channel delta 1; its
light pairs each differ by 16 pixels at delta 2. Selected History Thai/dark
differs by one pixel at delta 1. No source-similarity score is inferred.

All 144 responsive header checks passed, including the independent brand/body
columns, existing 60px header, navigation/active-page semantics and overflow.
Existing command dialog, keyboard/focus, full chart/table, scope/source/custom
period and forecast/unknown/stale/expired behavior checks passed. Overview
activity bottom remains 990.141px in the 992px viewport; History's occupied
detail bottom is 924.406px in the 941px viewport. The new Overview globe center
is x=728.547, y=251; exact focal alignment still needs source reconciliation.

No external/write requests or browser errors were observed. The database is
synthetic in memory, with readers disabled. The 124 web tests at v1.49 and 418
repository tests at v1.44 remain separate evidence for those builds and were
not rerun for this CSS/geometry change.

[Browser evidence](redesign-v1.51/verification.json),
[all-page comparison](redesign-v1.51/reference-review.html) and
[original source hashes](redesign-v1.51/reference-hashes.json). All 40 canonical
application capture hashes were verified; all eight viewer reference images
match the original refs. The viewer script's JavaScript syntax passed.

Version tag: `redesign-shell-geometry-v1.51.0`, isolated branch
`design/redesign-foundation`, original QuotaPulse origin.

## Review bundle

`tmp/review-bundles/QuotaPulse-v1.51-lgl1Ch.zip`: 201556934 bytes, 3134 files.
Every ZIP entry was decompressed and SHA256-compared with its source. Archive
SHA256: `35504ef606d554008c06a36c78f0fd869c5e0eb0309aef1944b16801ce77e7f5`.

The packaged production index and Earth asset match the tested build. Existing
87 runtime packages were copied without dependency installation or native
rebuild. No app profile is included. Requires Windows x64 and installed Node
ABI 127 (Node 22). Extract into a new dedicated folder, run
`./scripts/start-review.ps1`, and stop with `./scripts/stop-review.ps1`.
Readers/account probes are disabled; a new database has empty usage. This is an
unsigned review bundle. Extracted-runtime/installer and manual release acceptance
were not rerun for this shell checkpoint.

[Bundle build](redesign-v1.51/bundle-build.json) and
[archive verification](redesign-v1.51/archive-verification.json).

Final diff whitespace check passed. Scoped process inspection found no remaining
Node/Chromium test processes. The original checkout remains clean at
`be8e145039247958992fa7673a9c77e1bff35db1`.

## Remaining goal

The 99–100% source likeness target remains open. Brand typography/waveform size,
header composition, effects and per-page remaining details still need inspection.
Column geometry checks and repeated captures do not establish source similarity.
