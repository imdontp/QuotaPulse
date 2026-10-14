# Loading72 read-only code review

## Verdict

No concrete merge blocker found in the applied loading change relative to HEAD `8762e12`. This is a source review; no browser, test, build, daemon or Git mutation was performed. Root reports build index `9c1847a0bfe7a350d1e96d512b1930981455688bdb484500a8d81493800cbaa8` passed. Runtime transition and visual evidence remain separate gates.

## State, identity and honesty

- `ProductionOverview` keeps every hook unconditional and always mounts the same `Overview`/`RedesignShell`. The old early return is removed without changing request scope, data math, accepted snapshot shape or current route-key/epoch guards. Pending scope never renders the previous scope's usage values: `current` still requires an exact snapshot key.
- `OverviewPendingRegions` renders static decorative slots with `aria-hidden`, labelled regions, `aria-busy` only for loading, and one status message. It does not render fake zero totals, quotas, models, graph routes or observations. QuickStats receives explicit `null`; its generation logic invalidates old scoped summary requests and displays unknown counts rather than stale scope values. Its independent machine-wide alert query remains existing behavior.
- Same-scope background failures retain real accepted data and show the existing stale message. Initial/scope failure instead shows the neutral layout with actual error and retry. Retry clears the local failure and uses the existing manual-refresh coordinator; shared refreshing state and coordinator deduplication prevent concurrent manual passes. This intentionally invokes actual ingest before queries and therefore needs a fresh isolated daemon fixture when testing adapters, as root identified.
- The period control remains usable during pending/error and preserves source/custom scope through the existing route serializer. Existing route-key/epoch checks reject an older scope's success or failure after a subsequent route selection. This slice does not add mounted-request cancellation to the already-existing production fetch callback.

## Focus, dialogs and cleanup

- Callback ref captures loss of a focused select when loaded/pending branches replace its DOM node. The existing restore flag set by period change is preserved; the current-key effect restores focus only after a matching accepted snapshot exists. Error/loading transitions retain the same pending component type and select position.
- Dialog markup is absent during pending. The conditional effect prevents `showModal` in that state and clears the selection; returning to data cannot reopen a stale map selection. Existing map dialog behavior is otherwise unchanged.
- Visibility/IntersectionObserver effect now depends on initial-state kind, so it disconnects the old observer and removes its visibility listener before observing the replacement pulse node. The loading→loaded and error→loading branches receive a fresh target. Existing unconditional IntersectionObserver platform assumption remains unchanged; no new unsupported fallback claim is made.
- Nonblocking inherited focus limit: restoration may move focus back to the period select even if a user deliberately moves to another shell control while the request is pending. The previous restore policy also did this. Runtime checks should prove the intended period path, without claiming a general focus-preservation contract for all controls.

## CSS scope and source exception

All decorative slot rules require `production-overview` and `data-overview-initial-state`. Core frame has a real `aspect-ratio:1`; metric slots are compact and contain no animation. Native quota `min-height:400px` is deliberately different: it applies to loaded, unavailable and pending states at widths >=1536, in both themes, and therefore changes loaded geometry where the panel would otherwise be shorter. It is documented as reserving the reference panel frame; source correspondence and loaded-page capture stability must be checked as the approved exception. It does not set maximum height, clip actual quota content or affect narrower widths. I did not independently certify its reference pixel match from this code review.

## Remaining runtime checks

Verify initial delay, first failure/retry, route pending, rejected old response, preserved loaded background data, and period focus with actual API fixtures. Verify observers/listeners after repeated loaded↔pending transitions and navigation. Compare loaded native quota geometry and both themes at >=1536, plus narrow pending layout for status/retry clipping. Successful code/build review alone does not establish those behaviors or source 99–100% fidelity.

The temporary runtime-motion draft has not been promoted by this review. Its previously reported first unseen/evicted source limitation remains outstanding.
