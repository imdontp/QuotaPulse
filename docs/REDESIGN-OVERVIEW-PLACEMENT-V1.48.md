# Overview placement v1.48

Continue the full real-data dashboard redesign after Pulse Earth v1.47.
This checkpoint adjusts Overview composition without changing API queries,
recorded counts, quota semantics or detail handlers.

## Reference adjustments

- The desktop Pulse Core moves 8px right and 20px up, bringing the globe's focal
  position closer to the supplied Overview reference. The period chip moves to
  the header's right beside the actual quota risk; occupied grid height stays
  unchanged. The image, used-quota label and progress values remain live-data
  presentation from v1.47.
- Model usage has a caption above its bordered list, following the reference's
  title/card separation. Desktop rows use 8px vertical padding. All eight loaded
  rows and the original keyboard-scroll/detail behavior remain. On narrower
  layouts the new wrapper uses `display:contents`, preserving the existing
  responsive grid instead of placing the whole list into one narrow grid cell.
- Runtime Map description sits beside the title at desktop widths. Shorter
  column-label space and a 176px scrolling viewport expose all four recorded
  providers in the default view. All other loaded nodes remain scrollable and
  the complete recorded-data tables remain available.
- Runtime connectors now start at the actual 16px column-label offset and retain
  the full logical row height. This corrects their vertical endpoint offset;
  data identities on SVG paths and node buttons let the browser gate verify
  that each endpoint touches its actual associated node.

## Validation

The web TypeScript/Vite build passed with the existing large-chunk warning.
The final Overview browser run passed English/Thai and dark/light: four repeat
pairs, all byte-identical, with no masks or changed raster tolerance.

All four sets record four fully visible provider nodes, caption placement above
the bordered model list, and a maximum connector/node endpoint difference of
0.01318359375px. The Pulse Core center is at (733.546875, 251.5). Hero bottom
remains 463.1875px, model rail height 270px and activity bottom 990.640625px in
the canonical 1586×992 viewport. These are current application measurements;
they are not a source similarity score.

Existing all-eight model scrolling/detail/focus restoration, complete recorded
runtime/quota-history tables, API-matched used-quota boundaries, local image
hash/decoding, shell/font and 390/900/1280 overflow checks passed. Tests use an
in-memory synthetic database, with readers off and no external/write requests
or browser errors. This checkpoint's capture scope is Overview only.

[Browser verification](redesign-v1.48/verification.json) and
[reference viewer](redesign-v1.48/reference-review.html) retain the current
captures. The viewer can switch between v1.48 and the v1.47 captures as well as
language/theme. The source reference remains unchanged.

This presentation-only change was validated by build and browser behavior;
unit tests were not rerun. The 124 web tests at v1.47 and 418 integration tests
at v1.44 remain separate evidence for those builds.

Version tag: `redesign-overview-placement-v1.48.0`, isolated branch
`design/redesign-foundation`, original QuotaPulse origin.

## Review bundle

`tmp/review-bundles/QuotaPulse-v1.48-Apakr2.zip`: 201555712 bytes, 3134 files.
Every ZIP entry was decompressed and SHA256-compared with the bundle source;
no app profile is included. Archive SHA256:
`587e2d1c357051002f1f9f8dbc209b982bea6337ab154917cc1ad481a7c7cbe2`.

All four canonical capture hashes, the tested production index, the packaged
Earth asset and the source reference copy were verified. Existing 87 runtime
packages were copied without installation or native rebuild. Requires Windows
x64 and installed Node ABI 127 (Node 22). Extract into a new dedicated folder,
run `./scripts/start-review.ps1`, and stop with `./scripts/stop-review.ps1`.
Readers/account probes are disabled and a new review database has empty usage.
This is an unsigned review bundle; extracted-runtime/installer and manual
release acceptance were not rerun for this layout checkpoint.

[Bundle build](redesign-v1.48/bundle-build.json) and
[archive verification](redesign-v1.48/archive-verification.json).

Final diff whitespace check passed. Scoped process inspection found no remaining
Node/Chromium test processes. The original checkout remains clean at
`be8e145039247958992fa7673a9c77e1bff35db1`.

## Remaining goal

The source-like focal point, separated model caption and four visible provider
rows do not establish full source likeness. The complete eight-page 99–100%
target remains open, including shell geometry, finer composition, source effects,
runway/insights layout and manual visual/release acceptance. Real recorded node
counts remain different from the illustrative concept when the data differs.
