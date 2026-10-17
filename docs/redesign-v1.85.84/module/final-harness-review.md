# Module84 final harness review

Verdict: No blocker found in the two harness corrections. Reviewed only; final matrix is owned/running by root, so this review is not a green execution claim.

Evidence inspected:
- scripts/check-route-loading.mts current source, cold-module and rejection/reload assertions.
- packages/web/src/sections/history.tsx route-filter normalization effect and API loading markup.
- packages/web/src/redesign/history-timeline.tsx accepted timeline markup.
- docs/redesign-v1.85.84/module/selector-red.log, history-hash-red.log and before83-red.log.

1. Timeline selector correction is valid. API loading state has one direct timeline h2 plus four nested InitialRegion summary h2s. Old descendant selector resolves five real headings and causes Playwright strict-mode rejection; the archived log names exactly these five. Both API loading and accepted HistoryTimeline use the direct child h2 for Usage timeline. `.qp-history-timeline > h2` targets the intended header while retaining the font-size assertion. This is a harness ambiguity, not evidence of a missing/broken production header. It does not claim API data finished loading before that typography assertion.

2. Route recovery comparison correction is valid. HistorySection effect reads existing params, updates only its own filter keys, and constructs `#history?${params}` even when params are empty. Therefore default History recovery legitimately yields #history?, as archived red output confirms. Current assertions compare exact destination before ? and sorted URLSearchParams entry arrays. They still reject any lost/changed/added key or value and retain duplicate-entry multiplicity; they normalize only query ordering and URL serialization (including absent versus empty query). Providers owner/source and Settings diagnostics/source are explicitly exercised. Theme and language are asserted independently after real keyboard reload, and the A-B-A-B test still verifies provider reuse/settings request count plus persisted lang/currency/rate. The change does not weaken those preference assertions.

3. Distinct red classifications are preserved. before83-red times out on the missing route-specific Live reserved composition in frozen83. selector-red is strict harness ambiguity; history-hash-red is empty-query serialization mismatch. Neither latter failure supports a production-regression claim or invalidates the frozen83 missing-composition evidence.

Limits: Matrix execution/181-case completion must be established by terminal exit and final verification.json. Query tests cover the listed owner/source and diagnostics/source routes; they do not independently prove every History filter/session combination (separate History state coverage applies). Box equality proves loading/error structural stability and viewport containment, not Source-concept visual parity or equality to data-dependent final API geometry. No browser/build/Git or source edits performed during this review.
