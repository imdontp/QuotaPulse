# Three-page source repair checkpoint

This is an incremental validated change to Overview, Models and Alerts.
[Implementation and remaining differences](SOURCE-CHANGES.md).
[Native-size source/before/after viewer](reference-review.html).

## Validation

- Production web build 54303 exited 0; existing bundle-size advisory remains.
- Web regression 8689 passed 162 tests. The same sequential session's authenticated
  eight-page workflow exited 0: filters, scopes, pagination, pause, quota runway,
  drill-down and 16 responsive language/theme/width combinations across nine
  routes. Browser, Vite, daemon and database teardown completed.
- Scoped production capture group 80584 exited 0: four pairs each for Overview,
  Models and Alerts, **12 pairs / 24 PNGs** on one build. All hashes were checked
  independently; original unmasked raster tolerance and behavior assertions are
  unchanged. This does not claim the full nine-route 40-pair matrix for v1.85.46.
  The full matrix in v1.85.45 belongs to its earlier build.
- Source diagnostics cover the three repaired pages. Original refs match the
  user-supplied external refs and candidate hashes match retained captures.

Production-index SHA-256: `a6462ca144dec3c37ec5f5a1ca925a410316a412903d260ba714d6847e1ac8dc`.
[Command/source evidence](build-provenance.json), [responsive workflow](workflow-responsive-matrix.json),
[authenticated workflow](workflow-verification.json), [caption measurement](caption-measurement.json).

## Limits

The caption improves from 118×6 to 163×8 bright glyph pixels; original is 160×8.
Its residual width/position difference and layered globe bands remain open.
Native captures use isolated synthetic API data, not the user's production DB.
Repeatability and unmasked source SSIM are not a likeness percentage or visual
baseline approval. Latest all-eight source review is the historical
[v1.85.45 viewer](../redesign-v1.85.45/reference-review.html).

Next: truthful Cost donut amount/basis/date hierarchy, the remaining measured
brand width, Live chart prominence and other source-region differences. Final
baseline, accessibility, desktop and release gates remain required.
