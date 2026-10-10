# Actionable Code Review Report — source candidate 50

## Review scope and goal

Read-only application review against HEAD `e5f777aa9754114169159871bc8e791b81ebca6e` on `design/redesign-foundation`. Goal: bring the original dashboard references closer while retaining real data, accessibility, responsive layouts and existing behavior.

Reviewed `live-token-flow.tsx/.css`, the Live opt-in and native CSS, Overview globe/progress mask/limb, Cost donut palette, Projects trend panel, Models continuous rail, Providers glyph sizing, and the shell's real quota risk badge. Reviewed affected data adapters, existing styles and relevant browser assertions. No application, dist, Git or browser/service mutations were performed.

## Verdict

**Approve with conditions.** No blocking or important source defect identified in this change set. This verdict concerns application correctness and regression risk; it does not certify the unfinished reference parity or release gates. Preserve the root's current frozen-build visual/UI checks and report their observed outcomes before publishing this checkpoint.

## Evidence and positive observations

- `packages/web/src/redesign/live-token-flow.tsx:8`: native layout subscription uses a stable module-level subscribe function, removes its exact listener and supplies a server snapshot. The opt-in is enabled only by ProductionLive (`live.tsx:168`); other consumers keep the previous placement. The single `latestSummary` element is rendered in exactly one position, and contains no interactive control whose focus could be lost during relocation.
- `live-token-flow.tsx:39`, `:62`: shorter Y tick display leaves raw scale, `data-value`, position and numeric title intact. `live-token-flow-data.ts:37` still computes recorded totals and components without replacing mismatches or bridging unknown components; no aggregation, API, SSE or filtering path changed. Latest exact accessible values remain separate from compact text (`live-token-flow.tsx:50`).
- `live-token-flow.css:128`: the native latest section participates in the panel grid, with intrinsic height and visible metadata instead of clipping to the plot. The chart transform and Y tick transform use the same 6..94 to 0..100 mapping. Existing smaller layouts remain outside the 1536px native selector. Existing check script verifies all three screen scales, unknown gaps, actual API values, native bounds and keyboard access, then resizes through 390/900/1280 (`scripts/check-live-token-flow.mts:216`, `:313`, `:362`).
- `overview.tsx:113`, `:132`, `:168`: the new mask uses the same actual used percentage and zero line cap as the retained progress circle. Unavailable data still omits both progress layers. Source artwork and limb paint sit inside the already decorative `aria-hidden` SVG; no real metric or label is baked into the asset. The new mask transition has an explicit reduced motion override (`overview.css:441`).
- `cost.tsx:37`, `:56`, `:156`: body and rim colors change only presentation. Recorded segment amounts, order, cumulative angles, real money, unknown handling and accessible provider list remain unchanged. Unknown identity lookup is guarded by `Object.hasOwn`.
- `projects.tsx:205`: the new named section retains the actual trend and chart disclosure. Pricing coverage footnotes remain visible inside an intrinsically growing panel. No project selection or request state path changed.
- `models.css:180`: the continuous rail is a pointer-transparent pseudo-element behind the existing panels; the detail layout still grows with facts and expanded tables. Native min-height does not impose a clipping/max-height ceiling.
- `shell.tsx:53`, `:92`: badge paint uses an instance-specific React ID. The SVG is hidden and nonfocusable; its count stays direct text, and the actual full risk count remains in the enclosing link's accessible label/title. Existing null/zero suppression, 99+ cap and QuickStats data callback remain unchanged (`quick-stats.tsx:38`).

## Validation reviewed and gaps

Existing logs read during this review show current source-alignment build completed in 12.09s (`tmp/reference-50-sidebar-source-build.log`) and 170/170 web tests passed (`tmp/reference-50-sidebar-source-unit.log`). These are observed log contents, not a newly run test or an independently observed command exit code.

The earlier focused Live log reports baseline, diagnostic response and empty-window checks passed (`tmp/reference-50-live-helper-fix.log`); it precedes the latest shell paint/spacing build. Current badge probe output confirms a hidden/nonfocusable SVG and the actual accessible count. The root's full frozen-build visual matrix and UI gate are in progress, so their result is deliberately not assumed here. Historical corner raster failures are not resolved merely by this static review.

No browser, screen reader or packaged desktop run was performed by this reviewer. The current harness includes native containment and resize checks but does not establish screen reader reading order under CSS `order`, contrast for every state, or arbitrary extreme token formatting; these remain release validation items rather than proven source regressions. Smaller-screen truncation/rounding already present at HEAD was not mislabeled as a new defect.

## Recommended next actions

1. Finish the root's current complete visual repeat matrix and UI gate against the frozen build; preserve exact failure evidence if any gate fails.
2. Bind source parity reports and checkpoint provenance to that same current build before committing/tagging.
3. Continue remaining reference fidelity and established accessibility/release checks; do not equate this application review with 99–100% visual acceptance.
