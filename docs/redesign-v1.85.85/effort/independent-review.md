# Effort85 independent source review

Verdict: No blocking correctness finding in the inspected pagination change. Reviewed only; browser interaction and rendered geometry remain root validation. No browser/build/Git/source edits performed.

Inspected effort-page.ts, effort-pagination.tsx, Models call site/detail effect and request identity, HistoryTimeline and HistorySection accepted snapshot/filter normalization, four targeted pure tests, EN/TH additions, audit probe/results and implementation notes.

Evidence-backed behavior:
- Bounded DOM page: effortPage returns <=20 original ordered row objects; every category remains reachable through last partial page. It does not truncate API arrays or coalesce null/empty. Pure test reconstructs all20000 rows with original identities/order and exact sum.
- <=20: same array returned, existing li callbacks unchanged, pagination component returns null when both direction flags false. Therefore no additional nav/button DOM for small/empty distributions. Empty-state JSX remains original.
- Models shares continue dividing row.tokens by reduction across full detail.efforts, not the displayed page. Factual costs/scope/selection/point arrays unchanged by pagination.
- Hook updates its own state conditionally during render only when scope changes or a real accepted count invalidates the page; reference equality prevents loops. Same-scope undefined detail does not clamp stored selection. Although output effortPage(undefined->[]) reports page0 while pending, Models renders its existing loading region then; restored accepted rows recover stored page. Real empty accepted rows clamp0. Shrink clamp is persisted, so later growth does not unexpectedly restore an obsolete page.
- Models scope key includes stable requestKey(range/bounds/source/provider/vendor) and selected model/provider identity, avoiding resets on resolved rolling server timestamp changes. Detail effect cancellation/key gating remains existing. Sorting/search that changes actual selected identity resets, and unchanged identity retains page.
- History key uses applied route hash, avoiding resets on poll-resolved rolling bounds; hash/filter/session/range changes reset. Draft text edits do not write hash and therefore retain page. History retains an older summary during pending new scope, so pager reset can occur before that summary is replaced; this follows existing stale-summary behavior, not a new data race introduced by paging. Pagination changes do not write routes or affect records offset/export.
- Navigation has localized name, native typed buttons with disabled boundaries and polite localized range status. Locale counts use existing lang behavior. New EN/TH keys exist for both additions. Actual keyboard focus, wrapping and announcement behavior are not proven by this source review.

Test limits:
- Four pure tests cover20000 reconstruction,0/1/6/20 and21 boundary, negative/too-large pages, pending retention, scope reset, shrink and persistent clamp. They do not execute React hook renders or DOM navigation; root compiled browser checks remain required.
- Existing synthetic adapter/API probe proves accepted unrestricted categories and SQL behavior, not browser CPU. Transport/SQL effort grouping and full-total O(categories) reduction remain unbounded; this change addresses display DOM cardinality only and must not close broad performance audit items.
- History exact raw hash means semantically equivalent query reordering may reset page. That is a minor state continuity limitation, not data loss or a release blocker for the stated scope.

Separate Models summary advice (no edit): new firstcard~42px value track cannot hold many3-6digit counts under old data-wide threshold>6. Prefer broadening existing wide-count selection rule conservatively for first/third summary cards (or measuring actual text fit), reusing existing full-width value/intrinsic-height path rather than truncating, shrinking figures or hiding facts. Root should validate count1/999/999999/large and TH currency before approving summary geometry. This is independent of effort paging.
