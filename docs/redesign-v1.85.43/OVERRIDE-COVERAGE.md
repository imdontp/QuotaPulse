# Draft whole-build override and region coverage

**Status: source-inspected draft, not reviewer acceptance or a passed final gate.**
The intended checkpoint is v1.85.43. Its build, captures and final results are
pending at drafting time. No test, build or browser run was performed for this
document. References to v1.85.40–42 are historical, build-specific evidence.

## Authority and classification

Authority is `docs/quotapulse_build_blueprint_v1.1.zip`, especially
`00_MASTER_BUILD_CONTRACT.md`, `05_TEST_AND_VISUAL_PARITY.md`,
`08_DEFINITION_OF_DONE.md`, `11_REFERENCE_OVERRIDES.md` and
`13_COMPATIBILITY_AND_RELEASE.md`. The ZIP's 23 accepted substitutions override
affected labels/data/actions; unlisted geometry, hierarchy and styling retain
the original source direction. API truth, metadata-only privacy and local
security take precedence. Additional scope decisions need an explicit record.

- **Required factual/action substitution:** mandated by an OVR; not a defect
  merely because original numbers, integrations or unavailable actions differ.
- **Data-dependent difference:** actual records, missing observations, unknowns
  and factual captions determine content; curves are not copied from artwork.
- **Decorative/source repair:** styling/geometry/artwork, without changing facts.
- **Unresolved verification:** source inspection identifies a path, not a pass.

Paths in the tables use these repository-relative prefixes:
`W = packages/web/src`, `D = packages/daemon/src/api`,
`WT = packages/web/test`, `DT = packages/daemon/test`, `S = scripts`.
`S/check-stable-captures.mts` is the production capture/API/geometry harness;
`S/check-history.mts` is the authenticated functional/responsive/occupied harness.
Neither repeated application captures nor a green historical tag establishes
concept likeness. Capture databases are synthetic but production UI binds the
real API; static preview values must not leak into production routes.

## All 23 authoritative overrides

| ID | Authoritative requirement | Actual implementation and factual source | Existing source/test paths | Difference classification and verification still needed |
| --- | --- | --- | --- | --- |
| OVR-001 | Same nine destinations on every screen; Settings follows primary eight; Providers/Cost remain reachable. | Shared `W/redesign/shell.tsx`; canonical destinations from `W/redesign/routes.ts`. Navigation is application configuration, not usage data. | `WT/redesign-routes.test.ts`; `S/check-history.mts`; `S/check-stable-captures.mts` shell checks. | Required navigation substitution. Pending43 nine-route/More/keyboard/back-forward verification and source sidebar geometry; do not call literal original varying nav a regression target. |
| OVR-002 | Static This machine; search opens palette; display-only avatar/brand; working theme/language/settings controls. | `W/redesign/shell.tsx`, `W/components/command-palette.tsx`; local preference/theme providers and command destinations. | Same two browser harnesses; `W/lib/use-theme.ts`; `W/i18n`. | Required action substitution. Pending43 search keyboard/open/close, no false workspace switching, preference persistence and header composition. |
| OVR-003 | Separate connection from reader freshness; quick counts derive from selected scope; no constant All systems operational. | `W/redesign/quick-stats.tsx`: connection uses shared refresh state; counts use `api.runtimeSummary()` and current risks use `api.overview()`. `D/runtime-summary.ts` owns counts. | `DT/runtime-summary.test.ts`, `WT/refresh.test.ts`, `DT/sse-lifecycle.test.ts`; browser header/shell checks. | Required factual substitution **with confirmed scope difference requiring reconciliation**: machine-wide/all-recorded counts and recent-five-minute sessions are intentionally implemented/disclosed; the archived OVR requires selected-scope counts and contains no separate machine-wide QuickStats exemption. Shell passes no page scope and API tests explicitly reject scoped parameters. Reconcile the authoritative scope requirement before marking compliant; retain old-client defaults if adding scoped reads. Verify reconnect/stale/unknown labels. |
| OVR-004 | Core is one selected owner/window percentage/reset; no inferred token allowance; left tokens are separately labelled period usage. | `W/redesign/production.tsx`, `overview.tsx`, quota adapters; `api.overview()`, `api.quotaHistory()`, selected-scope `api.usage()`. | `DT/quota-history.test.ts`; `WT/quota-ring.test.ts`, `quota-summary.test.ts`; harness quota/core checks. | Required factual substitution. Pending43 owner/window/period consistency, percent-only/no-reset/expired/unknown boundaries and independent progress facts. Decorative globe does not represent a global quota. |
| OVR-005 | Cache savings, cache-read proportion and pricing coverage replace productive hours/ROI. | `W/redesign/production.tsx`, `overview.tsx`, `insight-model.ts`; recorded cache token/cost components from usage aggregates. | `D/detailed-aggregates.ts`; `DT/detailed-aggregates.test.ts`; `WT/redesign-insight-model.test.ts`; browser insight checks. | Required factual substitution; data-dependent coverage. Pending43 known zero/unknown/partial cache-price cases, selected-scope reconciliation and complete caption visibility. |
| OVR-006 | Observed project→harness→routed provider→model edges, unknown provider retained; deterministic insights. | `D/runtime-map.ts` over recorded usage/source/session metadata; `W/redesign/production.tsx`, `runtime-data.tsx`, `overview.tsx`, `insight-model.ts`. | Harness runtime endpoint/scroll/focus/API checks; `WT/redesign-model.test.ts`, `redesign-insight-model.test.ts`. | Required graph/insight substitution. Pending43 exact edge identities/totals, null identities, independent harness ownership, complete keyboard data access and no AI/unsupported lifecycle claims. Source graph lighting remains separately reviewable. |
| OVR-007 | Runway uses percentage-points/hour, validated forecast/reset and insufficient/stale fallback; no global token denominator. | `D/quota-history.ts`; overview/Alerts bind one reader's forecast, reset, age and current owner/window. `W/redesign/insight-model.ts`, `model.ts`, `alerts.tsx`. | `DT/quota-history.test.ts`; `WT/redesign-model.test.ts`; browser quota/Alerts forecast checks. | Required factual substitution. Pending43 flat/insufficient/expired/rollover/skew/jitter and selected owner facts, available reset captions and decorative orb/source review. |
| OVR-008 | Live metrics are Recent sessions, Reporting sources, Stale sources, Reader errors; counts overlap, not a partition. | `W/redesign/live.tsx`; `D/live-sessions.ts` recent count plus overview source telemetry/freshness. | `DT/live-sessions.test.ts`; both browser harnesses Live density/occupied/API checks. | Required metric substitution. Pending43 counts, overlap disclosure, future/missing source time, empty/error states and source-sized top enclosure. Never add queued/failed session values. |
| OVR-009 | Call-grain recorded tokens/min with explicit exclusions; matrix is observed provider/model activity, not health/latency. | `D/minute-trend.ts` and `usage-scope.ts`; `W/redesign/live-token-flow.tsx`, `live-token-flow-data.ts`, `live-minute-strip.tsx`, `live-minute-data.ts`. | `WT/live-token-flow-data.test.ts`, `live-minute-data.test.ts`; `S/check-live-token-flow.mts`, `check-live-minute-refresh.mts`; capture minute/flow checks. | Required temporal/grain substitution; sparse series are data-dependent. Pending43 aggregate/unknown exclusions, unknown versus recorded-zero cells, incomplete minute, same-window API values, no fabricated activity or service-health grouping. |
| OVR-010 | Feed contains usage records/aggregate updates and observed recency; no fabricated lifecycle events. | `W/redesign/live.tsx`, overview activity; usage-event API timestamp/grain/model/provider/source fields, `D/live-sessions.ts`. | `DT/usage-events.test.ts`, `live-sessions.test.ts`; `WT/live-pulse.test.ts`; browser Live paging/pause/detail checks. | Required feed substitution. Pending43 ten-row session/eight-row feed pagination, all records keyboard reachable, pause/resume fresh snapshot, recency/skew and native feed frame. No chart/row copied as data. |
| OVR-011 | Refresh replaces New Project; All/Recent/Unassigned and harness filter replace team/archive; progress is scope usage share, not budget. | `W/redesign/projects.tsx`; detailed project groups from `D/detailed-aggregates.ts`, optional `D/project-detail.ts` trends; shared scope predicates. | `DT/detailed-aggregates.test.ts`, `project-trends.test.ts`; browser Projects cards/filter/count tests. | Required controls/share substitution. Pending43 tabs/filters/source/range, null versus empty project, distinct sessions, all project access and exact share reconciliation. Category artwork must not imply absent metadata. |
| OVR-012 | Metadata path/last observed replace authored description/active duration; Details replaces Settings; no pin/archive/edit controls. | `W/redesign/projects.tsx`; recorded project/session path, source/harness/provider and observed timestamp from detail/aggregate APIs. | `D/project-detail.ts`; same API/browser Projects coverage. | Required detail substitution. Pending43 each tab/action, missing path/timestamp fallbacks, exact selected identity and complete long metadata layout. No source description invented for actual projects. |
| OVR-013 | Refresh/Diagnostics; supported detected/catalogued subscriptions only; extra source logos do not request integrations. | `W/redesign/providers.tsx`; `api.overview()` subscriptions, sources, limits and recorded linked harness profiles. | Browser Providers selection/inactive/hidden/no-quota checks; `W/sections/settings.tsx` hidden preferences. | Required provider/action substitution. Pending43 owner identity, visibility preferences, catalogued inactive cards, supported readings and diagnostics destinations; missing unsupported source brands are intentional. |
| OVR-014 | Origin/freshness replace unverified plan/renewal; reader health/age replace provider latency; no invented daily window. | Providers overview facts: window_kind, origin, last_seen_at and source telemetry; no price/latency measurement. `W/redesign/providers.tsx`. | Browser provider API comparison, zero/tiny/unknown/expired tests and reader-list keyboard checks. | Required provenance substitution. Pending43 exact existing windows, most-recent confirmation meaning, unavailable owners, factual origin labels and readable reader facts. Source plan/footer hierarchy still guides replacement regions. |
| OVR-015 | Calls replace speed; pricing coverage replaces quality; capacity has provenance or is unavailable; observed context differs from capacity. | `W/redesign/models.tsx`, `cost-value.tsx`; `D/detailed-aggregates.ts`, `model-detail.ts`, recorded context_window/provenance, native/computed/estimated/unknown call counts. | `DT/detailed-aggregates.test.ts`, `model-trends.test.ts`; `WT/redesign-cost-value.test.ts`; browser Models API/coverage/context checks. | Required column/fact substitution. Pending43 native/computed/estimated/unpriced/zero coverage, routed-provider versus maker, observed context labels and no benchmark/speed invention. |
| OVR-016 | Categorical effort replaces performance benchmarks; identity/provenance replaces marketing claims. | Models detail uses actual `modelDetail.efforts` token/call/session groups and recorded provider/maker identities; optional model histories are real scoped aggregates. | `D/model-detail.ts`, `model-trends.ts`; `WT/model-trends.test.ts`; browser effort/identity/exact raw-series checks. | Required identity/effort substitution; actual distributions/curves vary. Pending43 null/zero effort, non-additive per-bin sessions/pairs, unknown-price gaps, selected versus all-provider scope and decorative gradient not changing official identity. |
| OVR-017 | Separate native/API bases; combined amount explicitly mixed; historical known savings only; no invoice/hypothetical savings claim. | `W/redesign/cost.tsx`, `cost-value.tsx`; `D/cost-analysis.ts`, aggregates over cost_source/known cache components. | `DT/detailed-aggregates.test.ts`; `WT/redesign-cost-value.test.ts`; browser Cost basis/coverage/zero/route/occupied checks. | Required money substitution. Pending43 each basis/filter, partial/wholly unpriced, known-zero, native-only, average scope and unavailable projection. Preserve actual sector shares and avoid decorative-gap distortion. |
| OVR-018 | Four metadata groups and Related Session; safe copy only; no prompt/response/raw source JSON. | `W/sections/history.tsx`, `W/redesign/history-record-details.tsx`; usage-events allowlisted fields and explicit metadata clipboard list. | `DT/usage-events.test.ts`; browser History region/metadata/copy/detail/focus checks. | Required privacy/detail substitution. Pending43 all facts/groups, null/empty identity, raw values/accessibility, focus trap/Escape/close and related-session exact scope. Source prompt boxes are not restored. |
| OVR-019 | Categorical effort, record grain and metadata search replace average/status/prompt search; CSV exports all matches; no bulk placebo. | `W/sections/history.tsx`, `history-timeline.tsx`; `D/history-summary.ts`, shared `usage-scope.ts`, usage-events/export routes in `D/server.ts`. | `DT/history-summary.test.ts`, `usage-events.test.ts`; `S/check-history.mts` filtering/export/paging/CSV checks and production History checks. | Required metric/filter/export substitution. Pending43 >2000 events, stable ties, literal SQL text, CSV quote/newline/formula-leading values, all-match export, full-range summary versus page, actual maker fields and native selected/table frames. |
| OVR-020 | Existing notification settings toggle; fixed50/80/95 read-only; no Add Rule; guidance opens local details/diagnostics, no workload execution. | `W/redesign/alerts.tsx`, `alert-risks.ts`; notification settings API and actual selected-owner/window/source facts; quota/query helpers retain fixed thresholds. | `DT/alerts-history.test.ts`; `WT/redesign-alert-risks.test.ts`; `S/check-alerts-layout.mts`; production guidance destination/settings tests. | Required actions/rules substitution. Pending43 local destination correctness, no absent-source links, snooze/quiet-hour/equal-endpoint semantics, unavailable reset and no automatic Switch/Apply/Enable/Pause execution. |
| OVR-021 | Current risks differ from retained history; unavailable monitors unknown; desktop channel only, requires tray. | `W/redesign/alerts.tsx`, `alert-risks.ts`; overview current limits and `api.alerts()` retained threshold events; tray delivery consumes existing settings. | `DT/alerts-history.test.ts`; `packages/tray/test/alerts.test.ts`; browser current/history/reset/expansion/keyboard tests. | Required risk/history/channel substitution. Pending43 recovery/reset current-risk clearing with retained events, jitter/dedup, all100/500 records, unknowns and actual desktop runtime delivery/suppression evidence. Browser captures do not prove tray delivery. |
| OVR-022 | Fixture/actual facts determine totals/counts/shares; concept inconsistent sums/counts and copied factual curves are not targets. | All production page API adapters; shared `D/usage-scope.ts`; scoped aggregates/trends; `S/check-stable-captures.mts` seeds an isolated DB and compares API facts independently. | Unit/API reconciliation suites above; browser model/provider/graph/cost/history data checks. | Required consistency substitution; data-dependent numbers/series. Pending43 full same-scope reconciliation and fixture-production separation, stable ordering, no synthetic fallback on actual routes, explicit null/empty versus zero cases. Original Models row sum797M versus721M and Projects five-versus-six conflict must not be copied. |
| OVR-023 | Remove dashboard pet decoration; preserve Electron popup; light/Thai/narrow keep equivalent semantics/functionality. | `W/main.tsx`, `App.tsx` select existing popup before redesigned route; `W/components/pet-popup.tsx` retained. Theme/i18n/responsive tokens remain. | `S/check-desktop-runtime.mts`, `check-production-runtime.mts`, `check-pet-popup-recovery.mts`; browser en/th×dark/light×390/900/1280/1440 matrix. | Required compatibility substitution. Pending43/final desktop popup, preload/IPC/preferences/recovery and rollback proof, reduced motion, keyboard/contrast/manual screen-reader and all responsive states. No new PetMode scope. |

## Eight-page source-region matrix

All source/capture/hash/viewer links below are now bound to verified v1.85.43 artifacts;
they do not imply reviewer acceptance. Root's final default
production harness generated36 canonical pairs (nine routes,
including Settings) plus four selected-History pairs:40 total. The eight-source
ledger does not invent a Settings reference PNG. Responsive/state evidence is
additional to the40 canonical capture pairs.

| Page / original ref | Meaningful regions to measure and compare | Applicable overrides | Same-build source/actual evidence | Open classification / review question |
| --- | --- | --- | --- | --- |
| Overview / `refs/overview.png` (1586×992) | Shell; Pulse Core outer frame, selected quota/progress, globe/rings/waves, left metrics/model rail; runtime-map columns/edges; runway/insight frames; activity footer. | Global001–003,004–007,022–023. | `refs/overview.png`, `captures/overview-en-dark.png`, all language/theme variants; `reference-regions.json`, `reference-review.html`, `source-hashes.json`. | Particle geography/halo/waves/artwork versus factual quota/usage/graph scope. Actual missing baselines/aggregate-only activity cannot be turned into fabricated source curves. |
| Live / `refs/live.png` (1672×941) | Enclosing heading/metrics; session toolbar/table/pagination; chart/coverage; record feed; advisory and grouped matrix rail; occupied keyboard boundaries. | Global001–003,008–010,022–023. | `refs/live.png`, `captures/live-en-dark.png`, variants; shared region/hash/viewer files; `verification.json`. | Revised lifecycle/status semantics are intentional; all real rows, page totals, excluded grains, minute gaps/zero and full keyboard data remain. Measure source frame/row rhythm without suppressing facts. |
| Projects / `refs/projects.png` (1672×941) | Heading/tabs/filter/search; selected/other card sizes and identity plates; actual share/money/trends; selected detail/tabs; ranking frame. | Global001–003,011–012,022–023. | `refs/projects.png`, `captures/projects-en-dark.png`, variants; shared files. | No project creation/category/archive/budget invention. Record absent category art and unavailable metadata distinctly from plate/font/layout defects. |
| Providers / `refs/providers.png` (1672×941) | Heading; reading-owner and inactive-card hierarchy; actual window/provenance/footer primitives; comparison plot; complete reader table/detail access. | Global001–003,013–014,022–023. | `refs/providers.png`, `captures/providers-en-dark.png`, variants; shared files. | Supported owner count/windows may differ; no unsupported integration/plan/latency. Final approved replacement measurements must cover unavailable-owner geometry. |
| Models / `refs/models.png` (1672×941) | Heading/summary enclosure; scoped historical summary; comparison controls/columns/selected row; provider footer; identity/token distribution/trend/effort rail. | Global001–003,015–016,022–023. | `refs/models.png`, `captures/models-en-dark.png`, variants; shared files. | Official maker/provider identity stays factual; local gradient/artwork is decorative. Additional source rows/quality/speed/benchmark and fabricated catalog capacity are excluded. Validate current gradient build, sparse facts and non-additive buckets. |
| Cost / `refs/cost.png` (1672×941) | Overview/summary frame; actual-provider donut/legend sectors; monetary/token axes; complete model/project/session tables; known savings/coverage insights. | Global001–003,017,022–023. | `refs/cost.png`, `captures/cost-en-dark.png`, variants; shared files. | Actual bases/shares/zero coverage remain; unavailable projections and hypothetical optimization promises are intentional differences. Palette/rim/seams cannot falsify actual angle proportions. |
| History / `refs/history.png` (1672×941) | Heading/subtitle; timeline/summary/filters; ten native fixture rows/footer; selected-row border; rail heading/identity/maker spacing/token tiles and four groups. | Global001–003,018–019,022–023. | `refs/history.png`, `captures/history-en-dark.png`, `captures/history-selected-en-dark.png`, variants; shared files. | Extra factual maker/grain/coverage/metadata captions may grow naturally but need reviewed geometry; no prompts/status/latency fabricated. `.42` ten-row/936px evidence is historical until rerun on43. |
| Alerts / `refs/alerts.png` (1672×941) | Heading/metrics; observed quota plot; current risk/reader rows; fixed-rules table; selected forecast/orb/warning; four local-guidance rows and full retained event rail. | Global001–003,007,020–023. | `refs/alerts.png`, `captures/alerts-en-dark.png`, variants; shared files. | Forecast/threshold facts and local actions replace unsupported global tokens/workload execution. Four guidance rows/retained events must not be sliced to match source counts; decorative rim/icons remain source-review items. |

## Pending evidence binding and acceptance

### OVR-003 exact scope evidence

Archive `11_REFERENCE_OVERRIDES.md`, OVR-003 says: “counts derived from selected
scope”. OVR-002 separately says “Static This machine scope” for the global
workspace/search/avatar region. It does not explicitly grant machine-wide
counts independent of page filters. Search of the archive's Markdown found no
separate QuickStats/runtime-summary exception defining such behavior.

Current implementation is deliberate and labelled, not inferred solely from an
omitted query: `W/redesign/shell.tsx` mounts QuickStats without a scope prop;
`W/redesign/quick-stats.tsx` calls the no-argument method;
`W/api.ts` requests `/api/runtime-summary`; `D/runtime-summary.ts` documents
machine-wide counts independent of dashboard filters and computes all-recorded
project/model/provider identities plus five-minute source-observed sessions.
`DT/runtime-summary.test.ts` verifies scoped `?from=0` is rejected. English
`redesign.quickStatsNote` says “All recorded data on this machine”, followed by
the five-minute source-observation caveat; Thai gives the equivalent disclosure.
That disclosure explains truthfulness but does not by itself approve a contract
change. Resolve the selected-scope interpretation/behavior explicitly; do not
silently certify OVR-003 or broaden/narrow counts merely to match a fixture.

Root bound the source/capture paths, all80 raster hashes and all eight diagnostic
input hashes to the final full verifier and frozen build. Provenance and source
hash files record blueprint/fixture/build versions; verification records browser,
DPR/locale/timezone/clock and reduced-motion capture policy. The final commit is
bound by checkpoint tag. `reference-regions.json` contains measured application
geometry; original-source geometry, region deltas and reviewer dispositions
remain open.
Each region requires source measurement, actual measurement, delta, override,
review disposition and linked image. This draft lists all23 overrides/all8
pages, but does **not** claim their execution or reviewer approval is complete.

Unchanged major regions target2 CSSpx; repeated primitives target1–2px;
replacement regions use explicitly reviewed measurements. First review source
plus overrides, then name an approved implementation baseline/reviewer/commit.
Only subsequently enforce SSIM≥.985 against that baseline, with regional
geometry/text checks. Current repeat tolerances and no-mask checks are separate.

Final consolidation also requires mapped valid/error states, current repository
unit/API/build/UI/visual checks (>2000-event scope/export, privacy and legacy
defaults), measured render/query/chart/paint/CPU/hidden-work behavior, desktop
Live/popup/preload/settings recovery and matching-checkout/assets rollback,
manual accessibility/state acceptance and one RC evidence index. Historical
457 repository passes in40 and workflows/scoped captures in41/42 remain dated
evidence; they are not relabelled as final43 execution.

**No reviewer acceptance, baseline approval, final metric pass, source likeness
percentage or release readiness is asserted by this draft.**
