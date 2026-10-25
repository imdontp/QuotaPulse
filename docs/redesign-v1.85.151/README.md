# History reference table — source151

[Concept/before/current gallery](review.html) · [Current History](after/history.png) · [Previous runnable review150](../redesign-v1.85.150/README.md)

Validated bounded reference-fidelity change. Parent `e017b9d6d60246cd35fc0f73c372a82248477734`. The reference is the user's original refs directory, SHA-checked against the maintained manifest. Original concepts and owned consistent QA data legitimately differ; this does not claim99–100% approval or copy invented costs, statuses, prompts or benchmarks into the application.

History now shows blue comparison bars beside recorded token counts, with colors/direction informed by actual reference interior pixels. Each bar compares against the largest token record on the currently displayed page; localized hover text explicitly states that basis. API totals/exports/scope are untouched. Paging and filters recompute the visible-page maximum. Raw token counts remain exact in accessible labels and numeric titles. Zero-only pages omit a percentage comparison; tiny positive values retain their true requested ratio and a precise nonzero tooltip. No minimum fill is imposed.

The redesigned columns now follow the concept's primary sequence: time, project, harness, provider, model, tokens, monetary basis, record kind, metadata action. Record kind is real call/aggregate metadata, not an invented Completed/Failed status. The timestamp arrow and aria-sort describe the existing descending API order; no fake sorting button was added. Full project metadata remains in the DOM/title when a long name is clipped. The legacy mode keeps its original column order and raw numeric rendering.

Added bars initially squeezed record-kind/project cells into multiple lines. That candidate is retained as diagnostic evidence. Final compact interior spacing and no-wrap constraints restore ten33px rows within the941px reference viewport. All columns fit the1124px table viewport without horizontal scrolling at1672×941. Header, chart, summaries, filters and detail-rail pixels remain outside the History change bounds; actual History differences are retained unmasked in the comparison JSON.

## Validation

Production web build and351 tests pass with no failures/skips/cancellations. Sixteen compiled cases cover EN/TH, dark/light,390/900/1280/1672 widths,50-row and6-row pages, filtered/zero pages, ratios down to0.000001, exact headers/field mapping, raw labels, aligned50×6px tracks and preserved legacy order. The full unchanged integration passes including144 responsive route cases, actual authenticated HTTP/in-memory SQLite, paging/export, drill-down scopes, pause/in-flight protection, money bases, occupied layouts and SSE counts. All own handles close.

The first tiny-width check incorrectly expected an exact numeric round-trip through CSSOM. An independent detached-element Chrome control reproduces conversion of requested0.00009999999999999999% to9.99e-05%. Verification now strictly compares product serialization against an independently serialized exact API ratio, while keeping exact raw ratios and zero-minimum checks. No numeric tolerance was widened. Logs/control data are retained; this is browser serialization, not a product floor. Tiny tooltip precision was also improved so1/1,000,000 reads0.0001% rather than0%.

All eight final canonical within-context screenshot pairs are byte-identical. Six other before/current page frames are byte-identical. Providers retains105 differing global-header pixels (maximum channel delta4), still unexplained; no mask/tolerance closes that gate. The History changes are confined to its table region. These are browser/owned-fixture checks, not new native or performance acceptance.

```powershell
npm.cmd run build -w @quotapulse/web
npm.cmd run test -w @quotapulse/web
node --import tsx scripts/check-history-token-bars.mts
node --import tsx scripts/check-history.mts
```

The gallery's original/before/current images are complete unmasked frames. Controls/data use the accepted truthful replacements and a consistent owned fixture; screenshot similarity percentages are not invented. Source hashes, strict density checks, raw compressed logs and reproducers are retained. Current source151 still needs native/ZIP validation; review150 remains unchanged and does not include these later table changes. Main/origin and unrelated files are preserved. Original-reference approval, remaining header/control composition, native/customer/provider/performance and migration/rollback gates remain open.
