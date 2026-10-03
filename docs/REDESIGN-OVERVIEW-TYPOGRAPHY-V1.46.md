# Overview typography v1.46

Continue the real-data dashboard reference repair following Settings v1.45.
This change is restricted to production Overview desktop CSS. It does not alter
data queries, chart calculations, quota meanings or model-detail handlers.

## Reference adjustments

- The concept gives the central percentage substantially more emphasis than the
  left metric values. At desktop widths the central value is now 68px; metrics
  use 16px values and 12px labels instead of 22px values and 11px labels.
- Model icons span their label and bar rows. Labels sit above the proportional
  bar, with the percentage on the bar's right, matching the concept's reading
  order. Icons are 28px, labels/percentages 12px and bars 6px.
- The complete model list remains in the existing keyboard-scrollable rail.
  Actual model names and percentages remain unchanged, and model detail/focus
  restoration use the existing handlers. Smaller viewport styles are preserved.

The source's fictional usage totals, token allowance, provider/model assignments,
runway duration and productivity claims are not copied into real application
data. Additional header icon treatment and finer per-page composition remain
open. This change does not establish the requested 99–100% reference likeness.

## Validation

The web TypeScript/Vite build passed with the existing large-chunk warning.
Production Overview captures passed Thai/English and dark/light: four repeated
pairs, three byte-identical. English/light differed by five pixels, maximum
channel delta 1, within the unchanged raster tolerance. No masks were used.

The existing browser gate verifies all eight model rows, scrolling to the last
model, opening its real detail, Escape and focus restoration, complete Runtime
Map and quota-history access, font/shell checks and responsive overflow. The
270px model rail and activity bottom at 990.640625px remain inside the 992px
concept viewport in all four sets. No external/write requests or browser errors
were observed; the database is synthetic in memory and readers are disabled.

This CSS-only change was validated by build and browser behavior; unit tests were
not rerun. The 124 web tests at v1.45 and 418 integration unit tests at v1.44 are
separate evidence for their respective builds, not a new v1.46 test run.

[Browser verification](redesign-v1.46/verification.json) and
[reference viewer](redesign-v1.46/reference-review.html) retain the current
Overview captures and source comparison. The source copy was SHA256-checked
against the supplied refs. Other pages in the v1.44 viewer remain captures of
that earlier tested build.

Version tag: `redesign-overview-typography-v1.46.0`, isolated branch
`design/redesign-foundation`, original QuotaPulse origin.

## Review bundle

`tmp/review-bundles/QuotaPulse-v1.46-7E5s9w.zip`: 199855540 bytes, 3133 files.
Every ZIP entry was decompressed and SHA256-compared with the bundle source;
no app profile is included. Archive SHA256:
`5b68cc762ab49f8639784189b140c928aeca34239e926c4990d95643d8d0d496`.

All four canonical capture hashes and the bundle production index match the
final browser verification. Existing 87 runtime packages were copied without
installation or native rebuild. Requires Windows x64 and installed Node ABI 127
(Node 22). Extract to a new dedicated folder and run
`./scripts/start-review.ps1`; stop with `./scripts/stop-review.ps1`.
Readers/account probes are disabled and a new review database has empty usage.
This is an unsigned review bundle. Extracted runtime/installer acceptance was
not rerun for this CSS-only checkpoint.

[Bundle build](redesign-v1.46/bundle-build.json) and
[archive verification](redesign-v1.46/archive-verification.json).

Final diff whitespace check passed. Scoped process inspection found no remaining
Node/Chromium test processes. The original checkout is clean at
`be8e145039247958992fa7673a9c77e1bff35db1`.

## Remaining goal

The eight-page source target remains open. Header icon treatment, image details,
finer typography/composition and release/manual acceptance still require work.
Repeated application captures establish stability, not source similarity.
