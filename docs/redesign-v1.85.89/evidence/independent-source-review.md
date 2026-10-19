# Motion89 independent source review

## Scope and current verdict

**Approve with runtime conditions for the frozen minute and selected-project integration changes; no blocking source finding remains.** This document does not certify the full redesign or the remaining Runway/table/Alerts motion requirements.

Read review-code-changes skill and rubric. Read original v1.1 ZIP03 directly: member SHA256 a52795d2b0e200624fae73b8a774fbcf5fd683fed16def4a66be0f2a819e5d89. It requires actual changed minute points180ms, stable axes, no whole-history replay, pause freeze, reduced immediate; runtime actual new known-edge signal700ms, aggregate node-only; visibility/intersection stopping and cleanup.

## Minute source findings

Inspected frozen `live-token-flow-motion.ts`, `live-token-flow.tsx`, caller in `live.tsx`, and8 new tests. Production changes reuse existing refresh snapshots and shared DURATION.fast/EASE.motion; no new SSE, ingest call, polling timer, frame loop, dependency or style changes.

- Planning requires the same exact scopeKey and numeric maximum. Initial scope/domain changes snap rather than reframe old readings on a new scale. Matching timestamps with actual records on both sides and finite known changed series values supply start readings. Recorded zero is eligible; missing/unknown/new/removed values never acquire manufactured prior readings. Input/output segments retain current unknown gaps. Rolling-window x coordinates and axes snap to current accepted timestamps; only y of common changed readings moves.
- Current base SVG attributes, latest-value summary, accessible labels and full data table always contain the accepted final facts. Temporary SVG animate elements interpolate actual previous-to-current geometry. This is deliberate display interpolation, not an estimated token measurement or rewritten API record. New domains snap; therefore not every actual refresh produces visible movement, which must be documented when demonstrating the contract.
- SMIL uses exact180ms in library units, one iteration, fill=remove, shared easing, explicit begin. End callbacks remove handles/listeners; replacement, interruption and unmount cancel outstanding nodes. Unsupported beginElement falls back to immediate final attributes. Fake-SMIL tests establish helper lifecycle intent but cannot prove real browser animVal behavior.
- Initial unknown IntersectionObserver state prevents animation before actual visibility confirmation without marking it as a real hidden interval. Real hidden/offscreen/reduced loss cancels immediately and marks the next fresh enabled snapshot as seed-only. Data identity, scope and freeze/reduced dependencies do not replay a retained snapshot after preference changes. Frozen caller includes pause, retained mismatched scope and error. Source effect cleanup removes observer, media and visibility listeners and cancels active animations.
- The planner interpolates matching minute bucket identities under a rolling window, including changing partial boundary coverage. It does not animate x/axes or invent unknown components. This is consistent with an accepted change to that minute reading, not evidence of fixed full-minute observation duration; existing partial labels remain necessary.

No new concrete correctness/security/data-integrity blocker found. Fast consecutive accepted snapshots cancel the prior presentation and start from the prior accepted reading, rather than retaining an animation queue. Browser evidence should characterize any visible replacement jump if exercised; no perpetual animation survives.

## Minute validation scope

Worker reports15/15 targeted tests (8 new helper/SMIL lifecycle +7 existing data tests). Current final tsc result was pending at first review message; do not infer success from earlier passes. Reviewer has not built, run a browser or independently rerun unit tests.

Required root runtime gates: actual API/SSE changed within-domain bucket with animVal sampled during180ms; unchanged points/axes/table; first snapshot/identical refresh/new unknown bucket and maximum change snap; active pause/reduced/hidden/offscreen/unmount cancellation; restoration seed and subsequent genuinely new update; settled canonical screenshots. Unit predicates alone do not close these.

## Frozen minute LF fingerprints

- live-token-flow.tsx:98e9ec4cef32f3b6bcc54133e6d55dfb0e1a3e41b96b6d68241727d23e6e8c5a
- live-token-flow-motion.ts:837dedde0fa9c1771ffcfd696b5844d1bd813ce659b8afca9931b14227259d47
- live.tsx:5c997305ea456eb803953aa34f4d06e4a2045caeab72bf3ea8a9f0420c0e1720
- live-token-flow-motion.test.ts:fd7fc74d0bb5b7199ee2e7726c18a35311d522629c176fdc863c41ad0d229860

## Runtime project review and resolved findings

Current preliminary integration samples exact project scope independently from the global activity rail, and retains prior same-context serial until selected graph plus observations arrive together. This prevents an empty/global new serial from prematurely consuming selected-project novelty. Old request completions have active=false cancellation.

However, preliminary `production.tsx` mapGraph still falls back to the global graph when the selected snapshot key is not current, including held selected-project requests. That can expose foreign-project topology beneath an exact selected-project control while motion is correctly disabled. This fallback predates the new observation helper; it is a relevant factual-context gap rather than a newly invented regression. Worker and root were notified. This was corrected before final freeze as described below; the preliminary concern is retained here for review traceability. Held context-switch browser evidence should inspect actual node/project identities, not only absence of particles.


## Final selected-project source review

Worker confirmed final freeze and tsc terminal0. Independently re-read and hashed all five owned files. Seven real-memory-API integration tests plus existing gate suite produce40/40 passing in `tmp/runtime89-project-unit.log`; reviewer inspected that terminal summary and test source, did not rerun it. The subsequent presentation-only refinements require root compiled browser validation.

`readRuntimeObservations` reuses existing recentActivityScope and usageEvents, requests limit1/offset0 per actual graph harness, preserves all selected source/project/model/provider/query filters and removes only grain, as before. Empty interval skips reads; exact empty string remains separate from All. Individual failed observation reads yield no invented row. This deliberately coalesces newest per harness, not every inserted event, and is not a queue. The global activity rail is read independently and can honestly show newer B while selected map observes A.

Production selected graph and its exact scoped observation rows are published together with the accepted global serial/provenance. A newer accepted serial cancels prior scoped effect completion via active=false; old graph/row completion cannot set a new context. While new data for the same route/project context is pending, both graph and prior observation serial are retained together and motionGraphReady=false. This prevents prematurely consuming the new serial without its scoped row. New route/project contexts expose no motion batch and seed the existing gate when accepted. Existing gate still verifies recent timestamp, exact known edge, accepted serial/context, visibility request epoch, initial/resume seed, reduced static and bounded700ms once; no new motion ledger or looping signal was added.

### Resolved factual graph fallback

Final `production.tsx` retains graph only if snapshot.context matches current route/project. New contexts pass explicit loading/error state. `overview.tsx` retains usable project selector/options and suppresses RuntimeData, factual nodes/edges and top-node metadata until matching scoped topology is accepted. The scoped pending-region CSS reserves space without painting fabricated data. Global totals/models/activity elsewhere remain from the independent global graph. Ready-state layout/geometry computation is unchanged; pending.kind is now a layout-measure dependency so new map DOM receives geometry after appearing.

### Resolved failure state presentation

Distinct runtimeGraphStatus refreshing/stale now keeps retained same-context graph honestly labelled. aria-busy is true only loading/refreshing, false for settled error/stale. Scoped error is keyed to accepted mapGraphKey and no longer mutates shared globalerror; page status derives current global error or current scopedMapError. Thus B failure followed by successful A cannot leave the scoped banner attached to A, and map success cannot erase an unrelated real global refresh failure. Retry uses existing shared refresh.refreshNow, not an ingest/poll shortcut. Error and ready states must still be exercised in the browser.

### Test quality and bounded gaps

The daemon integration test uses actual buildServer/openDb/readRuntimeObservations and RuntimeMotionGate. It discriminates A-only, A then newer B, B then newer A and two new A coalescing; source2 cannot override selected source1. Exact empty/missing/All contexts, switch seed, oldserial/wronggraphcontext and preservation of all filter identity are tested. This proves query scope and pure gate interaction; it does not prove React effect cancellation or real held project-switch behavior. No test copies a made-up API response as source truth.

No API schema, persistence or legacy endpoint changed. Additional per-harness project-scoped reads are intentional functional work; there is no measured whole-app performance/CPU/hidden-resource claim from helper tests. Existing global group/graph cardinality limitations remain.

## Final runtime LF fingerprints

- production.tsx:a79c62fe42f37a37ee0a7aa5cb31b5608e72799d7d7dfa2e386dbd1fef6a4fee
- overview.tsx:bb95713b38d3431ef71ff7cbbde0d17e88209f4498d226cfbd0882c686addd32
- overview.css:be9f925a8037c461949bbd7e9957a2523fce70805f569db5cd1f9c48fc0aae7d
- runtime-observations.ts:084aaf7109e42dda6f94f5191be711a10885e362ba281b4284d17d144cdd5d62
- runtime-project-observations.test.ts:db75a0afadf12a414795c0e94be01cfcb9d1efa6e56624bd010c1248466a249b

## Remaining acceptance gates

1. Integrated final web build/typecheck/repository suite after both frozen source sets, not an earlier build while display-state edits were underway.
2. Real API/SSE minute SMIL animVal and interruption/restore behavior noted above. Actual axes and accessibility facts must remain final/unchanged; no full-history replay claim from static frames alone.
3. Real held selected graph/rows, A then globally newer B on same harness, A→B→A cancellation/seed, same-context retention and new-context loading/error/retry. Inspect actual topology and busy/stale states as well as known-edge700ms signal identity. Actual reduced/hidden/offscreen/unmount motion cleanup remains relevant.
4. Current settled canonical Source captures/repeats and native/light/Thai/mobile geometry/keyboard behavior; bounded source approval is not exact reference fidelity or remaining motion completion.

Sole reviewer artifact is this report. No app source, build, browser or Git changes were performed by reviewer.
