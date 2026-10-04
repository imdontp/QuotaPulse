# Reference fidelity checkpoint v1.65

## Changes

This checkpoint continues the QuotaPulse dashboard redesign on
`design/redesign-foundation`, using the real app data model. It does not claim
that the eight original concept screens are visually complete.

- Live token flow now places points by their clipped timestamps across the
  actual half-open time window. It shows seven time labels, four dynamic y-axis
  labels, and a latest-recorded-minute rail. Missing components stay unknown;
  totals remain independent; no line values or metrics are inferred.
- The Live plot and summary rail use a reference-like side-by-side layout on
  desktop and a compact responsive summary below the plot. The nine-column
  keyboard-disclosable record table remains available.
- Overview's quota pulse receives a darker navy runway and blue-violet glow;
  the existing quota progress ring uses its SVG glow treatment. Its group
  position is tuned at wide desktop sizes.
- Projects' first two cards use a 54/46 split informed by the concept raster.
- The command-palette trigger now uses a small CSS search mark, and its wide
  desktop input is closer to the reference proportions.
- No daemon endpoint, stored schema, customer profile, account probe, or
  dependency changed. Product pages continue to render daemon-backed values.

## Validation

- Production web build passed. The existing large Vite chunk warning remains.
- Web suite: **137 passed, 0 failed**.
- Full production-browser gate: **40 pairs / 80 screenshots**, covering nine
  pages and selected History in English/Thai and dark/light. **39 pairs are
  byte-identical**. `projects-th-dark.png` differs by 31 pixels, maximum
  channel delta 2. All pairs meet the unchanged max delta 2 and changed-pixel
  fraction 0.0001 tolerance; no masks were used.
- The gate checks fresh production routes, synthetic in-memory daemon data,
  keyboard behavior, API-backed charts/tables, no overflow at 390/900/1280px,
  no external or write requests, and no browser errors. It also checks the Live
  minute data/unknown/zero states, quota and model details, History selection,
  and four source-estimated Projects card boxes.
- Project top-card boxes measured x=238/w=467.59 and x=717.59/w=398.33 at the
  canonical viewport; the source estimates are x=243/w=465 and x=716/w=396,
  within the gate's six-pixel box tolerance.
- Production web index SHA256: `1f03b8e59112d2b40c03790ac08597b44437d64adb0b99f1a8302cbbff0184cb`.
- Full captures and machine-readable evidence are in
  [redesign-v1.65](redesign-v1.65/). Open
  [reference-review.html](redesign-v1.65/reference-review.html) to compare each
  app page with its concept image and inspect the separate synthetic
  diagnostics. Reference image hashes remain in the evidence folder.

Raster replay measures repeatability, not source likeness. The full reference
still has substantial visible differences in the page composition, names and
content, sidebar/shell, ornaments, glow textures, and section arrangements.
In particular, the overview's current data-driven panels do not yet mirror the
concept's exact section structure. **The requested 99-100% reference likeness
remains open.** These screenshots use synthetic fixtures only for review; the
product does not substitute the reference's sample numbers or fabricated line
shapes for actual data.

## Review package

Branch: `design/redesign-foundation`; QuotaPulse's existing origin.
Tag: `redesign-visual-fidelity-v1.65.0`. The original checkout remains separate.

ZIP: `tmp/review-bundles/QuotaPulse-v1.65-MDpXOA.zip`
Size: 201,572,181 bytes; 3,135 files.
SHA256: `19925d9ace452b4656719c1040dea4dee3c4cee6c9fecf6b64ad9edfc7125d87`

Every ZIP entry was decompressed and SHA256-compared with its bundle source.
The isolated unsigned Windows review package uses 87 installed runtime
packages and external Node 22 ABI 127. It has no existing app profile, disables
readers and account probes, installs no scheduled tasks, and opens an empty
review database. The package is for local review, not a signed production
installer. Extracted installer/runtime acceptance was not rerun. Build and
archive manifests are in [redesign-v1.65](redesign-v1.65/).
