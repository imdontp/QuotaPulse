# Overview reference labels and clock alignment v1.66

## Changes

- Align the Overview's visible section headings with the original concept in
  English and Thai: Subscriptions & Quotas, Top Models (by tokens), Quota
  Runway, Pulse Insights and Live Activity. The same model label is used as the
  rail's accessible name.
- Freeze only the browser review fixture at 2025-05-17 20:42 Asia/Bangkok, the
  date/time visible in the source image. Update the date-dependent Today/week/
  month test boundaries and assert the header date. The production clock stays
  on the current time.
- Align the header sun mark by half a CSS pixel to keep its SVG stroke on the
  pixel grid. This preserves the existing theme control and colors.
- Let the screenshot harness capture a specific language/theme subset for
  focused diagnostics, and record the selected matrix in its manifest. The
  release verification below uses the complete matrix.
- No daemon endpoint, stored schema, dependency or customer data changed.

## Validation

- Production web build passed; the existing large Vite chunk warning remains.
- Web tests: **137 passed, 0 failed**.
- Focused Overview gate: **4 pairs, 4 byte-identical**. It verifies the five
  reference-matched labels and source-matched date across English/Thai and
  dark/light.
- The previously unstable Models/Thai/dark pair now passes byte-identically
  after the sun mark alignment.
- Full production-browser gate: **40 pairs / 80 screenshots** across nine
  pages and selected History in English/Thai and dark/light. **37 pairs are
  byte-identical**. The remaining pairs are `overview-en-dark.png` (37 pixels,
  max delta 1), `overview-en-light.png` (140 pixels, max delta 2) and
  `overview-th-light.png` (140 pixels, max delta 2). All remain within the
  unchanged max delta 2 and changed-pixel fraction 0.0001; no masks were used.
- The gate reports a complete language/theme matrix and checks fresh production
  routes, synthetic in-memory data, keyboard behavior, API-backed tables,
  390/900/1280px overflow, no external or write requests, and no browser
  errors. Full evidence and screenshots are in
  [redesign-v1.66](redesign-v1.66/).
- Production web index SHA256:
  `2558f7459d9970ca0e5835885462b0c2492a7dc2744edbbd0d4530f765ad8d09`.

These checks confirm the source labels/date and repeatability; they do not
certify 99-100% likeness. Exact section ornaments, texture/glow, real-data
content differences and several page-specific details remain visible. Browser
fixtures are synthetic and in memory; production continues to render daemon
data and real current time.

## Review package

- Local Windows review bundle built with Node `v22.13.1`, Node ABI `127`, and
  87 runtime packages (114 web license records). The package requires matching
  external Node and is not a signed production installer.
- Archive verification passed for all **3,135 files**. Every ZIP entry was
  decompressed and SHA256-compared against the tested bundle source. The
  archive contains no app profile; uncompressed content is 448,112,494 bytes.
- Review ZIP: `tmp/review-bundles/QuotaPulse-v1.66-m2P2fX.zip` (201,572,303
  bytes), SHA256
  `4435a435b18ccd51aa680d9628562553929c16a87eda1ef33058f602af2b8c06`.
  It is in the ignored local review-output directory, not tracked by Git.
- Build and archive manifests are preserved in
  [redesign-v1.66](redesign-v1.66/).
