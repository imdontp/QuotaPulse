# Overview Runtime Map proportions v1.58

Continues the real-data reference redesign after v1.57. Runtime Map now uses
the source's unequal columns and narrow project/harness/provider cards with a
wider model card. The original reference remains unchanged.

## Changes

- Four tracks use 30%, 24.5%, 22.5% and 23% of the map. Project cards are inset;
  harness/provider cards retain at least 140px for real identities. The map
  scrolls internally on narrow screens. The top eight displayed nodes and full
  recorded-data disclosure remain; no actual projects or routes are fabricated.
- Connectors use measured DOM card endpoints in SVG viewport pixels, replacing
  assumed equal-column positions. Resize observers clean up on replacement.
- A genuine single-project scope uses the reference's taller project card with
  actual distinct-session count. Multiple projects keep their own cards.
- Tiny Activity graphs now use a native-size Canvas2D bitmap. Straight segments
  retain the v1.57 exact source/provider/model minute buckets, zeros and partial
  boundaries. Theme, size and DPR redraw listeners clean up. Other charts keep
  the existing ObservedTrend renderer.
- Full minute values are in a visually hidden list outside the canvas image,
  associated through aria-describedby; pointer tooltips select an actual bucket.
- The complete Runtime icon container owns its paint layer. This fixes the
  observed larger repeated-raster deltas at its rounded background corners;
  icon geometry, color and radius are retained.

## Validation

TypeScript/Vite production build passed with the existing large-chunk warning.
All **126 web tests** passed: [output](redesign-v1.58/web-tests.txt).

The full Overview production-browser gate passed all four English/Thai and
dark/light sets. Independent daemon queries match all actual Activity buckets;
12 bitmap checks confirm ink at the API bucket positions. Four renderer sets
exercise accessibility descriptions, theme change/restoration, actual resize,
one positive point and all-zero baseline without false upper peaks. Fixtures
restore all changed database fields. No customer data/readers are accessed.

Runtime checks retain full-table access, null/empty identities, actual graph
edges, last-model keyboard access, modal focus restoration, single-project and
empty/restore routes. **48 geometry states** cover desktop, 390/900/1280 widths
and internal scrolling; reported endpoint error is **0px**. Same-document scope
changes may unmount/remount Overview; this is not proof of an in-place map update.
Four manually estimated source card x/width boxes are within 8px, which is a
limited geometry check rather than whole-image similarity.

All **four capture pairs** pass unchanged raster tolerance, without masks.
Three pairs are byte-identical; Thai/light differs in 76 pixels with maximum
channel delta 2. Activity bottom is 989.922px within the 992px source viewport.
Canvas bitmap/data and connector geometry are identical across repeat passes.
Existing quota, forecast, period/source/custom, insights, history, keyboard,
shell and responsive checks pass. No external/write requests or browser errors.

[Browser manifest](redesign-v1.58/verification.json),
[artifact consistency](redesign-v1.58/artifact-verification.json) and
[reference viewer](redesign-v1.58/reference-review.html), retaining v1.57.
Single-project captures are diagnostic fixtures with keyboard focus, not source
baselines. The focused runtime-layout harness mode is also available; final
evidence above comes from the full Overview gate, with its other checks enabled.

## Checkpoint and remaining work

Branch `design/redesign-foundation`, existing QuotaPulse origin; version tag
`redesign-runtime-layout-v1.58.0`. The original checkout is preserved.
This is a scoped Overview checkpoint. Latest full nine-page browser evidence
remains v1.52. Extracted installer/runtime and manual acceptance were not rerun.
99–100% source likeness and visual acceptance remain open. Next work includes
the wider decorative hero waves, real model-family marks and other-page details.
No claim of source motion fidelity follows from a static PNG.

The unsigned unused review bundle retains 87 installed runtime packages,
Node22 ABI127, NoReaders and disabled account probes. No app profile or tasks.
Every ZIP entry was decompressed and SHA256-compared with its bundle source.
Document captures and bundled production index match the final browser manifest.

Review ZIP: `tmp/review-bundles/QuotaPulse-v1.58-93GN9X.zip`;
201562306 bytes, 3134 files.
SHA256: `3330728e041e55daae63f4a744dd9a811ef814a6ac380b724f8aa68403eb1a4f`.
