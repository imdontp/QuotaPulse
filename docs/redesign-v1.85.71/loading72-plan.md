# Loading72: bounded implementation plan

Read-only source plan,2026-10-14, while root checkpoint71 gates freeze source. No application/test edits, browser, daemon, build or Git run. Earlier full-goal70 audit supplies acceptance context;71 already replaces Top Models row with scope-preserving links, so do not reopen that finished change.

## Requirement and actual mechanism

Blueprint00 says every block reserves applicable loading/error/unavailable/empty space;08 requires truthful fields/actions, keyboard/themes/languages/narrow, and real screenshots reviewed before baseline. This is a composition/state requirement, not permission to render fabricated zero measurements.

- **Overview**: packages/web/src/redesign/production.tsx163 returns plain `main.p-6[role=status]` before Overview/RedesignShell if snapshot is not keyed to current route. On first request and route-scope changes, header, nav, period and all blocks vanish. Current same-scope transient error retains snapshot and explicit staleSnapshot outside Overview.
- **Overview ready structure**: overview.tsx around491 onward owns RedesignShell, page-heading, hero-grid(core+quotas), RuntimeMap, bottom-grid(runway+insights), activity. Existing overview.css has responsive production-specific rules, including native hero394px, core min-height305px, native controls/columns and narrow rearrangement. Use those actual wrappers rather than a guessed full-page min-height.
- **Shell**: shell.tsx owns header/nav/command palette/theme/lang/skip and QuickStats. `quickStatsScope=null` is the existing pending contract: unknown counts and no runtime-summary query; undefined means machine scope. Keep null while a new usage scope has no accepted snapshot.
- **Connection**: DaemonConnection reports real connection state from useRefreshStatus. An independently connected SSE may truthfully show connected/LIVE while data is loading; do not force a fake source LIVE badge or conflate connection and loaded facts. Pending blocks must explicitly say Loading. No zero counts, quota percentages/reset/countdown, model identities, route edges, pricing amounts or recommendations.
- **Other initial paths**: Live143 retains Shell/header, replaces metrics with a paragraph and omits layout until display; Projects177 retains Shell/header/toolbar then replaces card+detail layout with paragraph; Providers106 retains Shell/header then paragraph in place of cards/compare; Models135 retains Shell/primary/header but replaces summary, omits comparison/footer/detail; Cost157 retains Shell/header/basis controls then paragraph in place of summary/providers/charts; Alerts131 retains Shell/header but summary/history/risks/rules content appears only after overview; History sections/history.tsx174 omits Timeline until summary, and records187 uses Empty(loading) rather than reserved rows. This is not a claim those pages lack Shell.
- **Chunk loading is separate**: main.tsx RoutedApp uses plain English Suspense Loading before I18nProvider. Initial API plan below cannot certify lazy-chunk geometry. A subsequent shared-shell router/Suspense slice must address that boundary if full cold-start geometry is promised.

## Smallest honest implementation for next slice

### Preferred bounded Overview patch

1. Add an **explicit pending discriminator** to Overview presentation, e.g. `initialState?: {kind:'loading'|'error';message?:string}`. This is UI state, not fake RuntimeGraph/OverviewData. Keep all hooks unconditional and ready default unchanged for preview/current callers.
2. ProductionOverview computes translated period label/control before !current and always mounts the **same Overview and same RedesignShell**. Its ready branch continues binding current graph/history/etc. Pending inputs are no quota/graph data, `quickStatsScope=null`, and explicit state. Do not construct an empty RuntimeGraph, invoke production preview fixtures, or let records=[] fallback render as observed zero.
3. Inside existing Overview shell, keep page-heading and region wrappers; when explicit pending state, render a static **OverviewPendingRegions** instead of live content. A tiny shared `PendingRegion` primitive can emit translated label, one status message, `aria-busy=true` for loading, and decorative neutral skeleton lines `aria-hidden=true`. Use real existing labels/icons/grid classes and no shimmer/timer/chart/canvas/SVG route animations.
4. Reserve six actual region types: hero core (metric rail, neutral core-art placeholder, top-model slots), quotas, runtime, runway, insights, activity. Reuse existing class/breakpoint structure and CSS tokens; skeleton dimensions describe slots, not record counts. Skeleton model/quota rows must not be buttons, named fixtures, announced records, graph facts or `data-record-id`.
5. Keep known actions usable: header nav, theme/lang, command palette, skip, route period control; View all History and Manage Providers links can remain because their destination is independently known. Disable or omit only data-dependent quota selection/graph/project/model inspection/export. Route changes while pending update the actual URL/key; existing epoch/race protection remains.
6. Error with no accepted current snapshot keeps the **same reserved regions** but `aria-busy=false`, translated Could not load + available bounded error text and real Refresh/Retry through existing refresh utility. Do not display No recent/No models/No quota/0 records before successful response. After successful empty result, render actual empty/unavailable states (different from loading/error).
7. Same-scope last-good errors continue real accepted data + age/error annotation; a prior different scope must not be relabelled as new scope. No first-error banner that claims stale snapshot when no snapshot exists.
8. **Visibility observer trap**: existing Overview useEffect([]) observes `.qp-pulse` if available, else shell. If loading has no PulseCore, it will stay attached to shell after ready unless effect depends on pending→ready or observes a callback target. Rebind/disconnect on state transition; do not leave idle observation targeting the wrong node. Map/canvas children should remain unmounted while loading, then normal lifecycle runs.
9. Preserve loaded screenshot bytes/geometry and selected-owner/money/graph/call logic. Do not modify ready layout heights merely to make a skeleton look consistent.

This uses one conditional presentational state and reusable static slot primitive, without moving all hooks/data binding or rebuilding the shell architecture. Derived internal fallback summaries may exist in the legacy ready component, but **no fallback zero facts may reach DOM/accessibility/data attributes in pending state**. If implementing a discriminated props union is simple, enforce this at types; never use type assertions to fake graph data.

### Shared implementation boundaries

Shared primitive belongs in redesign, with semantic neutral tokens, no API/timers. Route-specific pending compositions use **their own existing grid/card wrappers**: a universal rectangle cannot reserve eight distinct layouts. Extend other pages in ordered slices using their existing Shell and keyed data states, preserving last-good logic and footer/detail selection.

- Live: metric slots + sessions/chart/feed/matrix layout.
- Projects: cards-region plus detail-region; toolbar remains.
- Providers: supported-card area and compare block without inventing source logos/card count.
- Models: summary, table/footer and detail rail slots; no default fake model selection.
- Cost: summary/providers/trend/breakdown/session regions under actual selected basis.
- Alerts: summary/history/current-risk/retained/rules/channel regions; do not fabricate zero risks or owners.
- History: reserved timeline plus existing filters/records; summary pending explicitly separate from records pending; disable export until complete valid scope response.

Unknown dynamic record/card quantity may change document extent after response. Acceptance is stable shell/heading/known region anchors and declared minimum reserved geometry, not identical unknown row count or universal zero CLS. Do not cap genuine data to force exact screenshot height.

## Concrete delayed-first-API browser test for root

Use existing isolated deterministic real API/assets scaffold and current built hash, fixedclock/fonts/DPR/timezone; no production account/data changes. Test controlled deferred requests, not sleeps guessed from network speed.

### Setup and geometry

- Register route interception **before goto**. Delay every /api/overview response by controlled promise for initial phases, including independent QuickStats owner-risk request. Keep token-auth actual routes and respond from fixture daemon when released.
- Baseline same fixture ready screenshot/current DOM rects: header, sidebar nav, main, page heading, hero/core, quotas, runtime, runway, insights, activity, period control. Record root/header/nav node identities and focus.
- At pending: assert production-overview shell exists, main#overview/skip/nav9 destinations, named regions and translated loading status. Record same rects; compare shell/header/nav/heading x/y/w/h exact or<=2CSSpx and reserved region boundaries against declared existing layout. Compare before/after screenshots and PerformanceObserver layout-shift entries attributed to actual regions. Do not set a new arbitrary global CLS budget or count user-driven theme/lang reflow as asynchronous data shift.

### Honesty/actions cases

1. **Cold loading→populated**: while /overview held, skeleton is aria-hidden, loading wrapper busy; no reported numeric metric value, quotas, model facts, graph edges/particles, records/empty message, recommendations or fake sourceLIVE. QuickStats pending counts are unknown, not zero; runtimeSummary for pending scope not requested. Header connection may reflect real SSE independently. Release /overview but continue holding runtimeMap (plus dependent minute/usage as needed) and assert still pending until keyed bundle accepted, no partially fabricated record payload.
2. **Pending keyboard actions**: theme toggles, EN↔TH, command palette opens/navigates, skip focuses main and period remains usable. Assert header/nav DOM identity does not change on pending→ready, focus is not lost solely by data arrival. Use separate case for navigation away: late overview response must not overwrite destination.
3. **Ready**: release all expected dependencies; assert accepted nonzero fixture quota/tokens/models/routes exactly agree API, busy clears and skeleton removed. Assert completed ready geometry/pixels match prepatch unchanged fixture at same hash-adjacent data.
4. **Cold error→retry**: deferred overview returns authenticated fixture500, no snapshot. Shell/region dimensions remain, translated error (not stale/empty/zero) and busy clears. Retry uses existing refresh callback; recover with populated fixture and no extra leaked subscriptions/listeners.
5. **Successful empty**: return honest empty fixture only after release. Distinct loaded-empty/unavailable text appears; zeros only if successful scope truly records0; no loading state persists.
6. **Scope A→B→A during initial pending**: update period/source route; resolve late B before A and vice versa. Existing request-generation/epoch must reject wrong keyed snapshot. Pending period/source labels are current; no prior scope counts masquerade as selected scope.
7. **Same-scope refresh fails after ready**: retain actual loaded facts, explicit last-good age/error; do not replace entire page with skeleton. Existing tests plus one controlled response are sufficient.
8. Repeat bounded geometry/honesty on native1586x992 Overview and390 narrow in ENdark; add THlight case to verify translated/error wrapping and no overflow. Do not require running all40 regressions before causal fix, but root final gate must cover ready unchanged pages.

### Minimal likely files (recommendation, no edits made)

- packages/web/src/redesign/production.tsx: explicit pending/error state, period before branch, retained Overview.
- packages/web/src/redesign/overview.tsx: same Shell + conditional pending regions; observer rebind.
- packages/web/src/redesign/overview.css: **pending-only** static region/slot rules using existing production responsive wrappers.
- Optional new pending-region.tsx shared primitive if reused by following page slices.
- Tests: bounded standalone delayed-first-API harness in root-owned tmp/scripts; meaningful API/DOM/focus/rect assertions rather than mirror JSX tests.
- Translation additions only if existing app.loading/app.couldNotLoad/app.refreshNow and region labels cannot express actual state. Preserve EOL and existing text.

## Exit condition for72

Cold API loading/error visibly retains real shell/known-region layout and working known controls; no fabricated facts; populated/empty/error distinctions proven; route races and last-good semantics preserved; loaded Overview screenshots/data/actions unchanged. This resolves bounded Overview first-response path. It does **not** close all-page reserved loading, cold lazy chunks, all-state coverage, full baseline approval or final release gates.
