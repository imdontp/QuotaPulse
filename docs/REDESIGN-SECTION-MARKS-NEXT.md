# Panel identity marks — source measurements and v1.64 implementation

Implemented in [v1.64](REDESIGN-SECTION-MARKS-V1.64.md). The original read-only
audit found fifteen framed marks across four pages: eight unframed SVGs and
seven missing icons. The measurements below remain raster estimates rather
than exact vector specifications or a whole-screen fidelity score.

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
