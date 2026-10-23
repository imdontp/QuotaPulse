# History timeline inspection v1.85.122

Status: **Partially validated**. History's new interactions pass the scoped checks. The original repeatability gate remains **RED** on its first EN-dark repeat: 132 header pixels, maximum channel delta 7, exceed the unchanged changed-pixel fraction limit. This is not final visual acceptance or a99–100% fidelity claim.

## Changes

- Add intermediate actual bucket dates in place of only two range endpoints. The reference has intermediate dates and an inspection tooltip. Wide daily views now show nine ticks; small and subdaily views use fewer ticks to keep labels apart. Dates refer to actual bucket starts, including the last plotted bucket rather than the exclusive range endpoint.
- Add pointer inspection and a single keyboard focus stop. Left/Right step through buckets, Home/End select endpoints, Escape dismisses. The tooltip shows the actual recorded bucket start and input-including-cache/output quantities; full values remain available in titles. Thai/English instructions and status announcements are included.
- Dismiss on blur, pointer exit, scope change, scroll or resize. Returning to a previous scope or width does not restore a stale bucket. The tooltip uses viewport coordinates, preserving the panel's original paint and geometry.
- Existing aggregate-versus-call-time explanation, API requests, zero-filled buckets, token calculations, line coordinates, monetary provenance, filters and record details remain authoritative.

## Validation

- TypeScript/Vite web build passes. Final rebuilt index SHA256 is `2ea9a898618f9351162122cc9f74358efaf84937a7d0d1d6e0430bcd568aa346`, identical to the tested build. Existing large legacy App chunk warning remains.
- Native Chrome155, with no renderer flags: EN/TH × dark/light ×390/1672px, eight cases. Each checks the30-day and today scopes against independent actual `/api/history-summary` reads, all zero-filled buckets, keyboard endpoints/steps, pointer selection, date-label containment/nonoverlap, tooltip values/ISO date, viewport containment and resize dismissal. No browser errors, external requests or daemon writes. These are browser checks, not Electron or physical desktop lifecycle proof.
- Canonical1672×941 EN-dark capture: all60 original circle coordinates/colors, polygon/polyline points, bounds, viewBox and total label are unchanged. Exactly2745 pixels change, all in the date-label region; zero changed pixels outside it. Immediate repeat is exact. [Analysis](evidence/analysis.json).
- Migrated the existing History gate from its obsolete modal selector to the production nonmodal aside. Retained API token/title/identity checks, known harness ownership, selected row, native rail bounds,390/900/1280 containment, metadata-action Tab navigation, background focus, Escape restoration, complete record table and keyboard scrolling. Modal trapping is intentionally replaced by the actual nonmodal contract; the unrelated palette dialog remains.
- All four language/theme first passes complete their semantic, detail-rail, density, shell and new timeline checks. The first EN-dark repeat then fails:132 pixels, max7, bounds `(283,12)–(1017,47)`, all in the header, none in the History chart. No successful full gate manifest is published. Raw first/repeat captures and failure log are retained; masks and thresholds remain unchanged. [Failure analysis](evidence/stable-difference.json).

The API is production code over an isolated in-memory synthetic database. This proves rendering against API facts, not real collector/customer coverage. Real timers remain active; only Date is fixed. The source reference is hash checked against the original Downloads manifest. Browser matrices use reduced motion and DPR1.

## Investigation retained

An early panel `position:relative` change produced80965 changed pixels, including78208 outside the date labels. A test-only static-position intervention reduced that difference to2893 pixels. The final viewport-positioned tooltip removes the panel position change and yields2745 changes exclusively on the date axis. This supports the bounded positioning intervention; no browser-internal raster explanation is claimed. Intermediate image, control image and logs are retained.

An initial tooltip check kept the SVG focused while programmatically changing the range. Runtime logs show the new scope correctly hid the old tooltip, while no new focus event occurred. The final test focuses the range selector first. Further gate migrations corrected assumptions about the existing1280px docking breakpoint, explicit user selection for return focus, and Escape being scoped to the nonmodal rail. These are test changes, not new production rail behavior.

## Delivery and open work

[Review viewer](review.html) provides original concept, previous History, current History and tooltip screenshots. Source and artifact hashes bind the evidence. Work remains on `design/redesign-foundation`, using the existing origin; main is untouched.

The header repeatability failure remains open and must be resolved before calling the full gate green. The [20-row requirement trace](../redesign-v1.85.109/REQUIREMENT-TRACE.md), all-eight visual acceptance, native/settings/error/motion/resource coverage and prior Models Thai-light table pixels remain open. The655-test suite and actual native bundle validation belong to product120/checkpoint121, not this execution. No updated Electron ZIP or installation is produced here: the checkpoint121 ZIP still contains product120 and does not include these History changes.
