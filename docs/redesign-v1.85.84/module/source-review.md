# Module84 independent source and harness review

Verdict: **No material blocker found in the reviewed source. Proceed to the current compiled 181-case matrix.** Source review only; no browser/build/Git or source edits were performed by this reviewer. Providers paint remains frozen.

## Scope and authority

Reviewed `packages/web/src/redesign/route-loading.tsx`, `route-loading.css`, new `route-pending.tsx`, `scripts/check-route-loading.mts`, `tmp/module84-implementation.md`, `tmp/module84-test-notes.md`; traced actual entry routing in `packages/web/src/main.tsx:34–48`, shared InitialRegion implementation/CSS, actual Providers parsing/inspector initial state and actual utility-page diagnostics parsing.

Read approved ZIP master loading contract (reserve data-block space for loading/empty/unavailable/error; retain last good data for transient API failure), all eight screen contracts, OVR001–023 and visual/motion requirements. Initial unresolved code modules have no previous accepted data snapshot. These changes reserve neutral region geometry and do not replace the existing accepted API snapshot/retry behavior.

## Findings and corrected hypothesis

No concrete correctness/privacy/scope blocker found. One initial same-page query hypothesis was falsified by source tracing and must not remain a reported defect: RoutePendingRegions reads location.hash without its own subscription, but RoutedApp stores the **entire hash**, updates it on hashchange and rerenders the pending/boundary subtree. It does not store only page identity. Consequently Settings/Diagnostics query navigation does not justify a new listener. No change was requested from the module owner on that falsified concern.

## Source behavior checked

- Non-Overview destinations now reserve recognizable screen-specific groups: metrics/tables/charts/rails/cards rather than one generic box. Four neutral card slots are aria-hidden loading artwork, not claimed known owner/project counts.
- No invented numerical values, chart points, entity records, selected row, dialogs, fake form controls or unsupported actions appear in pending content. Shared InitialRegion exposes one localized status/retry where designated; all visual slots are aria-hidden. Loading is not mislabeled as empty or unavailable.
- Error state changes label/aria and offers actual location.reload recovery. It does not display fabricated API error details or pretend retrying a missing module is a query-only operation.
- Settings navigation links are real supported routes matching the loaded utility page. Providers initial owner/source/source_id positive-safe-integer parsing matches the actual page, including source precedence and query-open inspector semantics. Settings diagnostics exact section matching also matches loaded behavior.
- Eager dependencies are shell, existing overview pending regions, InitialRegion, locale/theme and neutral route CSS. No actual page/chart/API modules or lazy page CSS were imported into route-pending. Existing Overview JSX branch remains intact.
- New CSS is scoped to qp-route-pending descendants plus the retained route-load rules. Accepted page markup/paint is outside those selectors. Native grid/rail geometry stacks at compact breakpoints; actual overflow remains a compiled gate obligation.
- Main boundary key remains page identity, allowing different-route recovery and preserving the outer preferences provider. No new subscription/timer/network/dependency was introduced.

## Harness validity

The proposed command is `node --import tsx scripts/check-route-loading.mts` against the final production build, using the root-owned exclusive browser slot.

The 160 rejection cases represent 10 destinations × 2 languages × 2 themes × 4 widths. Every case intercepts the actual destination hashed JS and holds it; it first observes loading, then fulfills that same intercepted import with503, then checks error. It is not a synthetic DOM error-state toggle. Exact region and shell bounding boxes are compared between those two states. Localized status, aria state, real occupied regions and horizontal overflow are checked. It then changes theme, focuses and activates real Retry with Enter, allows the request after reload, waits for module fallback removal, and checks exact hash/language/theme retention.

The 18 original cold module cases, one A→B→A→B preference case and two existing legacy/popup entry cases produce the stated181 records. Current source deletes an old verification manifest at start and writes a new one only after all checks and uncaught-error assertions succeed. It records actual index SHA, browser version/args and in-memory fixture scope. Memory DB and nonexistent source root avoid user data and live readers.

Actual module prefixes are traced to main.tsx lazy imports: production, live/projects/providers/models/cost/alerts and shared utility-pages for History/Settings. The route matcher only holds the requested actual prefix; unrelated hashed assets are allowed.

## Required evidence and limitations

This review does not claim181 cases passed. Root must run the matrix on the final frozen combined build, inspect terminal exit plus the complete manifest, and verify its181 records rather than accepting partial logs. Loading/error text can grow at narrow Thai widths; exact bounds checks are appropriately positioned to catch that concrete remaining runtime risk.

The matrix proves loading-to-import-error structural stability and reload recovery, not pixel equality of pending geometry to every variable final API snapshot. Cold cases compare header/navigation across handoff, not every data region. The implementation notes disclose this narrower scope. Do not use the gate as proof of all loading/empty/API-error states, Source99–100%, native Electron lifecycle or packaging readiness.

Optional improvement, not a blocker or expanded required matrix: while one Settings module is held, click its existing Settings/Diagnostics links and observe updated neutral sections before rejection. Entire-hash source routing already supports this; do not add another listener without contrary runtime evidence.
