## v1.67 current candidate

v1.67 adjusts the Overview fixture to the supplied Dashboard content and monthly scope, shows all published provider quota windows, tightens Alerts density, and makes History verification follow its API result. Its complete 40-pair production capture matrix and web/daemon tests pass. This is a repeatability checkpoint, not visual acceptance: source-image likeness is still below the requested 99-100% target. The comparison and all screenshots are in [the v1.67 report](REDESIGN-VISUAL-FIDELITY-V1.67.md) and [review viewer](redesign-v1.67/reference-review.html).

Continue with the Dashboard toolbar/workspace/search and remaining Overview visual differences. Keep production data daemon-backed and use synthetic values only in the in-memory capture fixture. Pet and popup work remain outside this blueprint pass.
# Panel identity marks — source measurements and v1.64 implementation

Implemented in [v1.64](REDESIGN-SECTION-MARKS-V1.64.md). The original read-only
audit found fifteen framed marks across four pages: eight unframed SVGs and
seven missing icons. The measurements below remain raster estimates rather
than exact vector specifications or a whole-screen fidelity score.

## v1.65 completed and next fidelity pass

The v1.65 checkpoint adds timestamp-scaled Live curves, a seven-label time
axis, dynamic y labels and an actual latest-minute rail. It also tunes the
Overview pulse treatment, Projects top-card ratio and the command-palette mark.
See [the v1.65 report](REDESIGN-SECTION-MARKS-V1.65.md) and its
[reference viewer](redesign-v1.65/reference-review.html).

v1.66 aligns five Overview headings and the review clock date to the concept,
adds assertions for those labels/date, and snaps the header sun icon onto the
pixel grid. Its full 40-pair gate passed: 37 byte-identical, 3 within the
unchanged tolerance, no masks. See
[the v1.66 report](REDESIGN-SECTION-MARKS-V1.66.md) and its
[reference viewer](redesign-v1.66/reference-review.html).

The user's acceptance target remains 99-100% likeness to the supplied refs,
with real app data in production. The v1.65 screenshot comparison still shows
visible differences in data density, side navigation and small details even
where page geometry is already close. v1.66 closes five Overview heading gaps;
the next pass should preserve each page's current daemon/API semantics while
comparing regions directly against the original PNGs:

- Continue aligning isolated screenshot names, counts and percentages only
  where the production UI already renders daemon-returned fields. Keep fixtures
  synthetic and in memory; do not add concept values to production defaults or
  persistent stores. Preserve separate edge/unknown/zero stress cases.
- Inspect the source and app Overview side by side at the canonical viewport;
  prioritize its sidebar width/spacing, toolbar alignment, quota-window cards,
  Runtime Map rows, runway/insight balance and bottom activity density.
- Compare remaining refs one page at a time for panel boundaries, label
  placement, colors, icon glyphs, strokes and glow falloff. Reuse existing API
  values and show honest empty/unknown states when a concept field is not
  available from the daemon.
- Record measured reference bounding boxes and color samples for each changed
  region. Keep the raster replay tolerance fixed and report source likeness as
  open until the reference comparisons support acceptance.

Do not introduce pet/popup redesign, fabricated production telemetry, a
separate Concept Preview, schema changes or daemon writes in this fidelity pass.

| Page | Existing panel | Implemented mark |
| --- | --- | --- |
| Live | `.qp-live-sessions` | Compact blue session mark |
| Live | `.qp-live-trend` | Blue Activity |
| Live | `.qp-live-records` | Blue activity mark |
| Live | First rail `.qp-live-section` | Frame existing AlertTriangle |
| Live | `.qp-live-matrix-section` | Frame existing Radio |
| Cost | `.qp-cost-providers` | Frame PieChart |
| Cost | `.qp-cost-trend` | Frame TrendingUp |
| Cost | `.qp-cost-models` | Blue cube |
| Cost | `.qp-cost-projects` | Frame Folder |
| Cost | `.qp-cost-sessions` | Warm tile and Flame |
| Cost | `.qp-cost-insights` | Frame Lightbulb |
| Providers | `.qp-provider-comparison` | Frame Activity |
| Providers | `.qp-provider-health` | Frame ShieldCheck |
| Models | `.qp-model-comparison` | Blue comparison/chart mark |
| Models | `.qp-model-providers` | Small blue cube |

## Source measurements

Estimated original raster center-line background spans use B > 45 and B - R > 30.
Antialiasing and glow affect these estimates; they are not exact vector bounds.

| Original ref | Measured example | Practical frame size |
| --- | --- | --- |
| Live Sessions | x249–276, y232–258 | 28px |
| Live Token Flow | x249–276, y570–598 | 28px |
| Live Activity | x249–276, y776–804 | 28px |
| Live Matrix | x1298–1323, y435–462 | 28px |
| Providers Comparison | x250–283, y706–740 | 34px |
| Providers Health | x970–1003, y706–740 | 34px |
| Cost Trend | x247–281, y348–383 | 34px |
| Cost Model | x1046–1077, y349–381 | 34px |
| Models Comparison | x247–278, y269–301 | 34px |
| Models Provider Overview | y851–871 | 20px |

Representative original tile pixels: Live Sessions RGB (5,30,82)/(3,30,82);
Cost Trend (4,29,78)/(3,28,83); Providers Comparison (0,31,110)/(5,25,82);
Cost Sessions warm tile (25,24,33)/(26,24,32).

## Implementation and checks

- v1.64 reuses the PageHeading decorative-wrapper approach in a shared SectionMark.
  Retain existing h2 elements, translated text, accessible names and controls.
  Hide the wrapper and SVG from assistive technology; SVG is not focusable.
- v1.64 uses explicit 20/28/34px frames, scoped SVG sizing and theme-aware
  colours. The v1.62 dark gradient #001e63 → #001a51 and border #12367b provide
  the blue palette. Browser checks confirm that Cost's warm Flame colour
  overrides the global h2 SVG rule.
- Resolve Live row height against actual geometry. Its Thai canonical
  feed bottom is 930.875px in a 941px viewport; use existing header/padding space
  without clipping the marks or controls. Check all four language/theme variants.
- Verify the fifteen marks, heading names, source-data interactions and
  390/900/1280 overflow with the existing capture gate. Preserve raster tolerance.
- Keep the original plain Models detail headings. Overview already has six
  framed section icons, and History already has a 28px timeline tile.

Complex circuit glyph equivalence, other page composition and whole-screen
likeness remain separate unfinished reference refinements. No sample concept
metrics, new status semantics, pet or popup work is part of this pass.
