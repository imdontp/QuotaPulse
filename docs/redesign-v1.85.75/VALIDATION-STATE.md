# v1.85.75 — Alerts decorative source artwork

## Status

**Validated bounded change. Full concept and release acceptance remain open.**
Branch: `design/redesign-foundation`; intended tag: `redesign-visual-fidelity-v1.85.75`.
Base commit: `33e38b1`. The original checkout and its user edits are preserved.

## Changes

Dark production Alerts uses the existing approved Earth bitmap and static SVG ring segments instead of the flat dot/stripe interior and conic ring. Actual API-derived forecast days, dates, owner, reader age and warnings are unchanged. The rings are decorative, hidden from accessibility APIs and keyboard focus, with no pointer interception or animation. Light rendering keeps its existing painting. Real forecast labels explicitly paint above the decorative rings, including the longer English Unknown state.

## Source comparison

[All eight pages: original / previous74 / current75](review.html).
The artwork ROI is [1239,117,1434,312], excluding the union of original/current factual text [1255,177,1388,256]. RGB mean absolute error falls from27.7252343920 to23.7742568501. The selected variant improves all25 registrations with offsets up to2px. The compiled artwork matches the selected DOM trial exactly inside this declared region. This is a regional error measurement, not a likeness percentage or whole-screen acceptance.

Forecast outer/inner/value/label rectangles remain exactly equal to the prototype baseline. Native comparison with74: six other pages have no changed pixels; History has6 pixels with maximum channel delta2. Alerts changes24715 pixels bounded by [1230,125,1407,309]. Required real-data text differences from the original reference remain intentional.

All three Cost shading candidates increased provider-normalized profile error at all81 registration pairs, so they were rejected and Cost source was not changed. Its remaining artwork gap is still open. See `cost-rejected-scores.md`.

## Current validation

- Production web build: exit0 (session7848); existing bundle-size advisory remains.
- Sequential production browser pipeline: exit0 (session3419). Its four stages are compatibility, Unknown foreground, all-eight capture and canonical Alerts capture.
- Eight compatibility cases: EN/TH × dark/light ×1672/390; API-derived facts, decorative accessibility, geometry and no horizontal overflow checked.
- Four same-page light current/legacy-control comparisons: exactly equal pixels.
- Two actual API Unknown/reset cases: EN/TH; computed label z-index2 and original/explicit-foreground images exactly equal. Before the fix, English had55 changed pixels; Thai had0. The existing intrinsic long-word placement is unchanged.
- All eight native EN/dark production captures and geometry are current.
- Original Alerts gate: four EN/TH dark/light pairs, all byte-identical. Original tolerance remains maxChannelDelta10 and maxChangedPixelFraction0.00005, with no masks. The gate also exercises real forecast values, quota-window selection and supported interactions.
- All four current manifests bind the same production index SHA in `build-provenance.json`.
- Read-only final review approved the three-file diff, including label foreground ordering; no blocking or important findings. Reviewer did not run build/browser tests. The earlier conditional review is preserved in `CODE-REVIEW.md`; its pending capture conditions are now covered by the evidence above.
- Web205 tests passed at74 and are historical, not rerun or represented as current75. No current whole-repository/full40/native release gate is claimed.

## Evidence and limits

Captures use production web code backed by an isolated synthetic in-memory API, not a live user database or native Electron release. Fixture/probe scripts are archived for provenance; their imports and output paths assume their original `tmp` location. Trial scores bind the prior74 build, while compiled scores and final verification bind75. The index alone does not prove all artifact identity; source and archive SHA manifests accompany it.

Open work includes full eight-page visual/state/action acceptance; other loading/lazy-chunk behavior; remaining motion and conservative first-resume observation coverage; exact empty-string project selection; high-cardinality/performance evidence; production-equivalent native lifecycle/package/rollback checks; accessibility and user acceptance. This checkpoint does not close those items or the overall goal.
