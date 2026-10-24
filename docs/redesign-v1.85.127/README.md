# Cost chart inspection v1.85.127

Validated for the bounded Cost interaction/narrow-table change. Overall redesign incomplete. Parent: `f8afeec3e7fcd89e950a8b50d203a5424fcdf6bb`. Web build SHA256: `a692169697fc3a5ac7a68a30174b68c7b1beeddd46cbfd75a69eeaeba5d5580c`.

[Open all-eight comparison and active tooltip examples](review.html).

## Blueprint requirement and implementation

The original design-system motion contract (03_DESIGN_SYSTEM_AND_MOTION.md, Live charts) requires nearest-point hover inspection without a scale jump. The Cost plot now supports nearest recorded bucket selection with pointer, Left/Right, Home/End and Escape. Hover followed by click retains the bucket; blur, scope changes, resize and actual plot movement dismiss it. The full chart table remains adjacent in keyboard order.

The tooltip shows bucket-start time, the selected monetary basis (calculated API value or reported native cost), priced tokens and priced/all-call coverage. It uses the same CostValue formatting and partial/unknown rules as the table, including USD/THB conversion. Missing API buckets retain the existing explicit zero-call bucket domain; no events or spend are invented. The original bar heights, token line, axes, limits and fetch lifecycle are retained. Native browser titles are disabled only on this rich Cost plot to avoid duplicate tooltips; other ObservedTrend instances retain their default behavior.

At 390px the original tables compressed headers into individual letters. Model/session tables now retain a 640px minimum and project tables 460px, within keyboard-scrollable regions. Desktop table geometry is unchanged.

## Validation

- Web build and 335/335 web tests passed; no failed/skipped/cancelled tests. No daemon/tray code changed or new daemon/tray test run claimed.
- 32 real native Chrome cases: EN/TH × dark/light × 390/1280/1536/1672 × API/native. USD is tested at 1280/1672, THB with rate 37.25 at 390/1536. Every case checks independent API facts, complete table reconciliation, nearest pointer selection, click/focus retention, keyboard boundaries/Escape, exact monetary/token/call values, unchanged bar/line geometry, viewport containment and resize dismissal. All eight narrow cases also verify keyboard scrolling in all three Cost tables.
- Two focused scenarios additionally check single-bucket inspection, unpriced-scope removal, native weekly scope changes, re-focusing after narrow table scrolling, unrelated table scrolling preserving selection and actual viewport movement dismissing it. Active frames bind their actual route/basis and SHA256 in scenarios.json; the desktop example is native weekly, even though its initial case starts as API monthly.
- Existing Cost gate passed four repeat pairs, all byte-identical, with unchanged tolerance and no masks. Existing basis, date/axis, coverage, unknown, table, filter and narrow checks remain.
- Final all-eight source-sized captures: 7/8 are byte-identical to the pre-change inactive frame; every main-region geometry is unchanged. See the exact per-page evidence, including any nonzero deltas. This is before/after preservation, not a concept similarity score or human visual acceptance.

All browser data comes from isolated in-memory fixtures with no readers. These are native Chrome browser tests, not new Electron production-main, physical desktop, performance or packaged-app validation.

## Diagnoses and rejected approach

The first test treated the sparse Cost API as a complete bucket array. The test now independently reconstructs the established zero-call domain from API scope and bucket size.

The initial implementation dismissed on every captured scroll. A first focus-then-scroll timeout led to a frame-delay workaround. A later refocus scenario disproved its sufficiency: nested keyboard table scrolling continued to emit events after focus, without moving the plot. The final implementation compares actual plot bounds and invalidates only when that plot moves. The delay workaround was removed. A real nested-table scroll plus a real viewport scroll verifies the distinction. Failed logs and bounded event timeline remain archived.

A separate assertion caught the monetary marker using the uniform token-grid center rather than the actual bar center/top, which includes flex gaps and border geometry. It now measures the rendered bar without changing the original plot.

## Remaining work and delivery

The full blueprint/v1.1 ledger and all-eight scope remain authoritative; see [current visual audit](VISUAL-AUDIT.md). 99–100% acceptance is unproven. Current Electron/customer data, quota-reader states, physical desktop behavior, performance, current installation/rollback and human acceptance remain open. No fake concept quantities, benchmark/lifecycle/ROI claims or pet redesign were added.

The [review125 ZIP](../redesign-v1.85.125/README.md) still contains product source124 and excludes Live126 and Cost127. This checkpoint updates source and review evidence; no new ZIP is claimed.

Retained cross-build differences: history: 105 pixels, maximum channel delta 4, bounds [955,12,1362,46]. The History difference lies in the shared header; no cause or resolution of historical header raster variation is asserted.
