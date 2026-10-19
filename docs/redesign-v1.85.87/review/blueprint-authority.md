# Models row-trend authority check87

## Verdict

Adding truthful, bounded per-model plus recorded-provider token bucket trends to the existing detailed opt-in API and comparison table is consistent with the approved v1.1 plan. It does not contradict OVR-015/016/022. The fact that today's API exposes only global/provider trends is an implementation gap, not an authority forbidding the read extension.

This verdict does not claim the blueprint explicitly prescribed the exact new response field, query parameter or row-chart implementation. It prescribed preserving the original comparison composition with scoped facts and additive reads; that is the authority for implementing the original unoverridden Trend column with real observations.

## Original authority (read from approved ZIP, not inferred from current availability)

All local document paths below refer to members of `docs/quotapulse_build_blueprint_v1.1.zip`, root `quotapulse_build_blueprint/`.

| Document/member | Relevant wording | Consequence |
|---|---|---|
| `11_REFERENCE_OVERRIDES.md`, introduction | “Regions not listed retain the original composition.” | Original `refs/models.png` visibly includes a rightmost Trend column. None of the Models overrides removes that column. |
| `screens/models.md`, Composition | “Keep summary cards, comparison table, detail rail/donut/trend and provider distribution.” | Preserve comparison composition while applying scoped model/provider semantics. The explicit detail trend does not itself forbid row trends. |
| `screens/models.md`, Comparison | “Comparison distinguishes model+recorded-provider identity; vendor maker remains separate.” | Each row chart must use its exact recorded pair, not model-only or provider-only totals. |
| `11_REFERENCE_OVERRIDES.md`, OVR-015 | “Calls replaces Avg Speed; Pricing coverage replaces Quality” | These named replacements do not remove Trend. |
| Same, OVR-016 | “Categorical effort distribution replaces benchmark bars; identity/provenance metadata replaces marketing capability claims” | Concerns rail performance/description; no ban on observed usage history. |
| Same, OVR-022 | “no effort score or time-series curve copied as factual data” | Forbids copying concept wiggles, not querying real bucket sums. |
| `12_API_AND_FIELD_CONTRACTS.md`, opening | “future additive reads”; “Existing endpoints retain defaults.” | Extend opt-in detailed/trends reads; keep default old-client shape/cardinality and auth/filter behavior. |
| Same, Additive aggregates | “Same model through two providers remains distinguishable.” | Keep null/empty route identities distinct too; never attach a provider proxy curve to several model rows. |
| `02_DATA_SEMANTICS.md`, Trust and grain | “They cannot reconstruct individual call times or token delivery.” | Hermes aggregate buckets represent totals last observed, not streaming throughput or reconstructed call timing. |
| `05_TEST_AND_VISUAL_PARITY.md`, Performance | “Use query plans and large fixture histories” | Query/payload/render work must be measured, not declared bounded merely because bucket count is small. |

## Existing mechanism inspected

- `packages/daemon/src/api/server.ts:483-495`: `/api/models?detailed=1&trends=1` already wraps detailed aggregate and modelTrends reads in one DB transaction. `trends` validates only1; default endpoint is separate. A further grouped read can share this snapshot without per-row HTTP.
- `packages/daemon/src/api/model-trends.ts:5-37`: already reuses `usageWhere(scope)`, source/session joins, and elapsed-time bins with `bucketMs = max(60000, ceil(span/30/60000)*60000)`. It returns global points and provider-only points; no model+provider bucket series is returned today.
- `packages/daemon/src/api/model-detail.ts:5-21`: selected-detail query proves exact identity scoped elapsed-time token/call bins are supported by actual persisted events. Null and empty model/provider identities have explicit predicates. It is not necessary to fetch every row's detail over HTTP to obtain the same grouped facts.
- `packages/web/src/api.ts:214-227`: DetailedModelResponse.trends has summary points and provider points only. `modelDetail` has actual selected-pair points.
- `packages/web/src/redesign/models.tsx:81-102,176`: at most base and filtered detailed requests per refresh, plus selected detail; visible rows filter/sort whole group list, and current table has9headers ending API value, with no Trend column. Do not turn this into N detail requests.
- `packages/web/src/redesign/model-trends.ts`: provider curves are intentionally grouped at provider level. Reusing them for individual model rows would misrepresent data whenever a provider has multiple models.
- `packages/daemon/src/db/schema.ts:108-111`: time/source-time/model-time/session indexes exist. No claim made that they eliminate a new GROUP BY sort or make large histories cheap; inspect EXPLAIN on actual proposed query.

## Bounded feasible implementation

A single additional parameterized grouped SQL read under the existing opt-in snapshot can return sparse `(model, provider, bin, tokens)` rows using the identical `usageWhere`, time range and bucket sizing. Query count stays constant. Join records to exact typed pair keys such as JSON tuple identity so null, empty string and literal Unknown remain distinct. Return only observed sparse bins; render zero count bins only within a valid reporting scope using current observed-chart semantics. Preserve no-data/unavailable and aggregate temporal caveats. Use the existing ObservedTrend/local icon/chart stack and stable row identity.

Thirty time bins bounds points per pair, not total pair cardinality: with N pairs the extra response can still be O(30N) and table SVG DOM O(N). Existing table currently renders every search-visible group; adding sparklines to all1240groups increases real work. A practical implementation must choose and document a consistent bound (e.g. displayed page/window with exact pair selection, or a measured aggregate strategy). Do not silently cap histories and attach absent curves as zeros; omitted/unavailable trends need a reason, and totals/search/sort must remain full-scope. Changing the detailed default or introducing top-N truncation without clear semantics is not justified by this review.

## Concrete risks to validate before claiming done

1. Cross-provider same-model and null/empty identities; identical scope predicates and `[from,to)` boundaries; real row totals reconcile to its bucket sums under the same snapshot.
2. One record with many calls, mutable session aggregates and unknown grain; no reconstruction or smooth concept-generated curve. If sub-hour bins use call-only semantics, disclose exclusions and do not falsely reconcile them to all-grain row totals; use a consistent explicit grain policy.
3. Old-client default responses unchanged; missing optional field on old daemon renders unavailable, no fake curve; invalid supplied modes still400/auth401.
4. High pair count/history volume: EXPLAIN, payload bytes, server time, DOM and render observation; no N HTTP requests on SSE refresh/search/selection. Existing shared refresh and stale-snapshot protection remain intact.
5. Canonical Trend width/table readability plus Thai/light/mobile overflow and keyboard row selection. Real sparse data can be flat/spiky and visually differ from concept; preserve it.

No app source edits, browser/build execution or Git operations were performed. This is instruction-alignment and feasibility assessment, not implementation or performance certification.
