# Checkpoint85 independent final source review

## Review scope and goal

Read-only review of the current uncommitted checkpoint against base `0283c098` / tag84: Models native summary and Projects native observed-path paint; bounded Models/History effort DOM; shared-refresh driven Models detail refresh; the two executable browser probes and four pure tests. Goal remains all eight Source refs with truthful application data. No browser, build, source edit, or Git mutation was performed for this review.

## Verdict

Approve with conditions: no blocking implementation defect found in the inspected change. The new superseded-detail race probe needs an explicit completion barrier before its claimed race result is accepted. Current pending root browser gates and full-goal Source acceptance are not inferred from this source review.

## Important validation gap

`scripts/check-model-detail-refresh.mts`, after `releaseHeld!()`, currently waits a fixed350ms before asserting23 categories. The route handler has no awaited signal back to the test confirming that the held earlier22 response has finished delivering. A sufficiently slow delivery can leave the assertion green without exercising acceptance of that old response at all. Await explicit held-route completion and its corresponding browser response completion before asserting that the newer23 result remains. This is a test evidence issue, not evidence that the current cancellation implementation is wrong. Root was notified directly before execution.

## Evidence and behavior reviewed

- `effort-page.ts` uses a display slice of20 original row objects, preserves total count and order, and exposes all partial/final pages. API arrays, SQL aggregates and export data are untouched. NULL and empty string remain distinct original categories and JSX branches. The four `packages/web/test/effort-page.test.ts` cases reconstruct all20000 original category objects, test0/1/6/20/21 and bounds, and test pending retention, scope reset and persistent shrink clamp.
- `effort-pagination.tsx` conditionally updates its own state only when normalized selection differs, preventing repeated render updates. An undefined pending array preserves stored selection, whereas an accepted empty/shrunken array clamps. Native disabled buttons and localized polite range status preserve keyboard semantics. At<=20 the component returns null and `effortPage` returns the original input array.
- `models.tsx` continues using the reduction across all `detail.efforts` for share denominators; slicing only changes visible li iteration. The page scope key is stable parent request identity plus actual selected model/provider identity. Ordinary metric/language renders with unchanged identity do not refetch or reset. Model switch and accepted query change reset; accepted same-key refresh retains or clamps.
- Adding accepted `data` to the Models detail effect dependencies is causally matched to `tmp/models85-refresh-red-observed.json`: parent API had21 records while the displayed detail remained old categories38..57. Fresh parent JSON changes `data` even when fixed scope serialization is unchanged. Each prior effect cleanup sets its own cancellation flag, so superseded result/error/finally cannot commit. Existing snapshot key gating and truthful retained same-key snapshot remain unchanged. Unrelated renders do not create fresh `data` objects and therefore do not loop detail requests.
- `history-timeline.tsx` slices only effort li children. Record paging, timeline, factual totals and export are untouched. Its raw hash key can reset for semantically equivalent query reorderings; this is a minor continuity limitation already disclosed in `tmp/effort85-independent-review.md`, not data loss.
- Native summary paint is scoped to production Models dark >=1536. The Source-derived column proportions, plate sizes, lighter factual value weight and3px row gap/top1 are explicit in `models.css`; original semantic icons and chart arrays remain. `data-long-count` first/third cards gives values longer than3 formatted characters their full value track instead of clipping. The <=730 rule intentionally affects production Models in both themes, keeps actual values beside identity and moves real chart to an independent row. Existing wide-count path and overflow-wrap remain, rather than hiding/truncating facts. Native and mobile count geometry require actual compiled checks; this source review does not substitute for them.
- Projects paint is limited to production dark >=1536 actual `.qp-observed-line` children. It changes color, stroke thickness, round caps/joins and small halo; does not change path coordinates, observed data, fills, grid or cards. `tmp/projects85-frozen.json` correctly disallows copying the Source factual curve into a static asset and does not pretend whole-chart MAE is valid with different data.

## Validation inspected

`tmp/effort85-browser-final-mobile-exit.txt` is0 and its log records all8 Models/History xEN/TH x1672/390 cases passed. `screens/effort-pagination/verification.json` identifies production index `f072ce2aa183548974e24de8d8387efa171f6dd1c4108129ce7f5a29b65b79f2`,20 initial effort rows and explicit keyboard/same-scope/shrink/control-fit assertions. These are actual APIs/SSE on synthetic memory DB. They prove bounded effort UI behavior for that matrix; they do not bound SQL/transport/full-total reduction, certify overall performance, or prove Source fidelity.

`tmp/source85-final-mobile-exit.txt` and repository final-mobile exit are0. Repository log inspected ends with198 tray tests passed. Do not infer aggregate repository totals from that tail alone; root should use all suite summaries. The pending dedicated detail-race and Source/canonical gates are not reported as passed here.

## Recommended next action

Strengthen the held-response barrier, run that actual race probe against the final index, finish the root-owned source/card and scoped stability gates, then archive evidence without claiming all-eight99–100% acceptance or whole-goal completion.

## Follow-up: held-response gap closed

The earlier Important validation gap above is historical and is now resolved. Re-inspected the corrected `scripts/check-model-detail-refresh.mts`: the held handler signals only after awaited `route.fulfill`, the browser wait for the real22-category response is registered before release, its `response.finished()` must return null, and two animation frames run before asserting retained23. This removes the fixed350ms ordering assumption and exercises actual completed stale delivery.

Inspected `tmp/models85-detail-refresh.log` and `screens/model-detail-refresh/verification.json`: execution passed against the same final production index `f072ce2aa183548974e24de8d8387efa171f6dd1c4108129ce7f5a29b65b79f2`. The manifest records real fixed-scope SSE, held snapshot retention, late22 not overwriting accepted23, retained503, keyboard Retry accepting24, selection A/B/A returning first page, seven real detail requests, and empty browser-error/forbidden-request arrays.

Current review verdict: Approve the inspected source changes and corrected detail-race probe. No unresolved implementation blocker found by this read-only review. This verdict does not override the separate unresolved Models canonical stability gate: root reports two original-gate failures (TH dark135 differing pixels/max34, EN dark136/max34, identical computed ring geometry). Those diagnostics must remain preserved and unresolved until causal verification; current Models4 and full Source fidelity are not claimed passed. No new browser/build/Git/source mutation was performed by the reviewer.
