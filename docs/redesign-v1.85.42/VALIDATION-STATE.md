# History model identities and native summary/detail spacing

Status: validated scoped implementation checkpoint; final workflow passed.
Full eight-page source acceptance remains open. Base: f41e788/v1.85.41.

## Changes

`sections/history.tsx`: decorative22px maker plates with16px actual vendor
glyphs in the redesigned model column. API vendor is independent of routed
provider. Exact raw names, null/empty behavior, complete tooltips, IDs, ordering,
filters, exports and legacy presentation remain.

`redesign/history.css`: native46px summary plates,10px column gap and67px minimum
cards. Calls/session and native-cost captions occupy text columns beside their
three-row plates. Selected identities have40px plates,12px text gaps,16px row
gaps and7px inset. Model truncation applies to its name, preserving the icon.
Actual maker annotation and all pricing/runtime facts remain visible.

`check-stable-captures.mts`: independently compares all43 displayed records'
raw model names/tooltips/maker identities with the daemon response in each of
four language/theme combinations. Measures summary boxes and rejects overlap
between a plate and factual caption. Existing row/viewport/keyboard/modal/
responsive/repeatability gates and raster tolerance are unchanged.

## Build and scoped evidence

`npm run build -w @quotapulse/web`: session98412 exited0,2980 modules. Existing
large App chunk advisory remains. Final production-index SHA-256:
`313c492dcba41138440395e49a8e78dc0f93c3480eaba7058554ba08c14b1708`.
[Provenance](build-provenance.json) records exact source/reference hashes.

`QUOTAPULSE_CAPTURE_SCOPE=history npm run test:stable`: session53005 exited0.
Eight main/selected pairs across EN/TH and dark/light are all byte-identical.
No masks or tolerance changes. This proves repeatability, not original-reference
likeness. [Final capture verification](history-verification.json).

Native main cards measure67px, plates46px; records/pagination bottom936px in
all four states,10 complete visible rows,43 API records retained and keyboard
scrolling to the final record. Selected rail is(1376,60),288x867 with12px content
gap and transparent backdrop. Project identity begins(1398,201),height40, versus
approximately(1398,201) in the original. Token section starts435 versus original
approximately431; the actual maker annotation is retained above it.
[Measured regions](reference-detail-regions.json) support narrow geometry claims.

All eight actual PNG hashes match the final manifest. The unmodified original
History SHA-256 is
`c1955ddc3343731812a4995223f0134cdba9dfa5932a7d25b6fa2e7f7eab5edf`.
See [image artifact hashes](image-artifacts.json) for authoritative values.
All nine images are1672x941. [Native comparison viewer](reference-review.html)
provides main/selected states, four language/theme choices and50% source overlay.
Root inspected original, final EN/dark selected and final TH/light selected.

## Workflow

`npm run test:history`: final frozen-source session95175 exited0. Authenticated
History/Overview/Projects/Live/Providers/Models/Cost/Alerts E2E, all16 responsive
combinations across nine routes, occupied panels, keyboard scrolling, filters,
pagination, pause/resume, export and drill-down pass. Browser, Vite, daemon and
database all closed. [Workflow verification](workflow-verification.json) and
[responsive matrix](workflow-responsive-matrix.json) record coverage. Scoped
captures execute production assets; this independent workflow uses local Vite.

## Intermediate diagnosis

First build99951/index082dda54...: viewport checks93698 and22733 failed with
pagination bottom941.296875. Summary cards measured72.296875: the46px Calls
plate occupied two rows, with a14.296875 factual caption below. Correcting the
plate to span three rows with caption in column2 restored67px cards/bottom936
without hiding facts or shrinking the ten-row table. The equivalent original
reproduction passed after correction.

70903 passed the corrected geometry/API assertions but failed because a nested
browser measurement function was transpiled with unavailable `__name`. Using
inline rectangle extraction fixed the helper; final53005 passed.

Workflow23798 exited0 and closed browser/Vite/daemon/database, but included an
intermediate CSS revision. Its separate manifest is not final-source evidence.
No unit suite was rerun for this decorative/spacing checkpoint; preceding457
unit passes belong to v1.85.40. No dependencies, database or legacy routes changed.
Unrelated `.zed/` remains unstaged; original main is outside this worktree.

## Remaining objective

Source chart shapes, localized lighting, artwork, typography and composition
still require repair/review. Data-driven curves and additional factual captions
can differ and require the final intentional-difference ledger. This checkpoint
does not certify99–100% likeness, baseline approval, desktop compatibility,
performance, manual accessibility or the final release gates.
[Continue the complete goal](NEXT-SOURCE-REPAIRS.md). Goal remains active.
