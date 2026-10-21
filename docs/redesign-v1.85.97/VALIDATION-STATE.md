# Checkpoint v1.85.97 — selected secondary navigation

Incremental work toward the original all-eight QuotaPulse redesign; this is not a 99–100% visual acceptance claim or completion of the upgrade.

## Change

- Cost Analysis and Providers now appear as the selected page in the primary sidebar list, so the concept pages no longer open with the secondary menu expanded.
- A compact More control shares the selected page row. Remaining secondary pages stay reachable in a popover; route changes collapse it.
- Quick Stats margins for Cost and Providers were adjusted after measuring the new sidebar layout.
- Browser coverage checks active-page semantics, the initial collapsed state, sibling route accessibility, closing behavior, and Quick Stats position.

## Verification

- `npm run build -w @quotapulse/web`: exit 0. Existing Vite warning about a chunk over 500 kB remains.
- Synthetic in-memory browser gate: 28 stages, native duration/identity/lifecycle checks passed, 0 browser errors and 0 forbidden requests.
- At 1672×941, Quick Stats top measured 445 px on Cost Analysis and 442 px on Providers. More starts collapsed and exposes the sibling page when opened.
- Visual frame sampling is not fully complete: two intermediate RAF/opacity samples were missed for the existing Models same-model/distinct-provider case. This run therefore does not establish smoothness or resolve that rendering diagnostic.
- Compiled production index SHA256: `06eed83dfa5d933bca396fde0a91ecd36dddb21867784c40e45b62b8bf2dd6ad`.

## Still open

Continue the original reference-by-reference visual audit and remaining blueprint requirements. The broader native/package, viewport/locale/state, rollback and human visual review work remains open; see [v1.85.95 next required work](../redesign-v1.85.95/NEXT-REQUIRED-WORK.md).
