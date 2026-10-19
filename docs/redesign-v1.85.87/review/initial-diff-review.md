# Models87 independent final diff review

## Scope and verdict

Read current concrete Models87 diff/new files against supplied HEAD391dec5 using review-code-changes skill. Inspected daemon pair query/parser/route/tests, web API/Models state/table/CSS/locales, new comparison-page and row-trend helpers/tests, browser gate and existing shared scope/selection/ObservedTrend paths. Original scope authority is `tmp/models-trend-authority87.md`.

**Approve with conditions.** No blocking correctness/security finding in the inspected implementation. Record the valid-long-identity GET transport limit below and close or explicitly limit the named browser evidence gaps before claiming complete coverage. Root's supplied daemon/web builds0 and repository542pass were not rerun. Browser6117 was not used or interrupted; its outcome is not claimed here.

## Important finding: byte validation exceeds actual GET transport envelope

Location: `packages/daemon/src/api/model-pair-trends.ts:8-9,23`, `packages/web/src/api.ts:669-673`.

Parser permits262144UTF8bytes, up to20pairs and4096characters per identity. Client percent-encodes the entire pair list into a GET URL. Read-only local Node inspection reports v22.13.1 default `http.maxHeaderSize=16384`; a valid20pair ASCII request at the identity length limit creates a164979byte request target. Fastify server construction has no enlarged HTTP header/request-line transport option. Thus the route's semantic parser accepts input that real network transport can reject before reaching validation. `app.inject` API tests do not exercise the socket parser. The current UI catches the failed read and shows unavailable; it does not fabricate or misattach data. Typical short model names are unaffected.

Practical correction: explicitly bound encoded batch request bytes and define a bounded strategy for long valid identities, or document the partial unavailable limit with a real HTTP boundary test. Raising arbitrary parser limits alone does not solve transport. Do not claim all4096-character identities work in20pair batches from current inject tests. This is an important compatibility boundary, not a reason to revert actual row trends or introduce N detail requests.

## Requirement fit and protected semantics

- Original Source Trend column is unoverridden; real per-row history implements approved composition. OVR-015/016 replace speed/quality/benchmark marketing fields; OVR-022 bans copied fake curves. New column remains factual.
- One grouped statement joins requested exact `(model,provider)` values using parameterized `IS`. Null, empty, case, quoted SQL-like text and whitespace remain distinct. `usageWhere(scope)` retains shared source/session/project/provider/vendor/model/search/grain and `[from,to)` predicates. Existing routed provider is not replaced by maker or pricing alias.
- Query uses selected detail's bucket sizing and full-grain observation semantics. It does not reconstruct aggregate calls or copy provider curves. EN/TH chart labels state recorded totals rather than token delivery timing. Daemon tests compare batch to existing detail across every identity/grain/bucket span and verify600points for20×30 observed bins.
- Existing `/api/models` defaults are untouched. New route is GET/read-only and inherits global API authentication; malformed scope/pairs return400, unauthenticated request401 in tests. No DB schema/write migration, dependency, network destination or credentials added.
- Comparison paging renders at most20rows with full-filtered totals and stable sort/search; deep links reveal the selected row once. Manual paging does not rewrite selected detail identity. Helper tests cover1240pairs, pending selection, shrink/clamp, growth and scope changes.
- Row read has one batch request per visible pair window/accepted data update, not per-row HTTP. Effect cancellation guards success/error/finally; old snapshot is shown only for exact matching scope+pair-list key. Same-key failed refresh retains real previous curve with warning/retry. Snapshot is not borrowed across changed scopes/pairs. No new SSE/listener/timer engine.
- This bounds row-chart DOM/request identities and at most600bucket points. Existing detailed aggregate payload, full list sort/filter and provider/summary grouping remain unbounded in pair count; do not claim all Models data work is constant.

## Named validation gaps in current browser script

Locations: `scripts/check-model-row-trends.mts`.

1. `mode='missing'` branch exists but is never selected: no actual404/old-daemon missing-endpoint fallback assertion. Test both no accepted snapshot and accepted same-key snapshot if claiming old-daemon compatibility; ensure unavailable/stale warning and keyboard retry.
2. Every requested list is asserted1..20, but request counts per specific action are not asserted. Source proves one batch call; gate should snapshot request count before a controlled page/action and compare after settled response to substantiate no extra fetch/fanout claims. Preserve legitimate accepted-SSE refresh reads.
3. `nativeFit` is measured on the five-row second page before the1265pair case. It is not rechecked after twenty larger identities. Recheck native first-page state and current Sourcefixture long identities; include1672 and canonical1536 if claiming both native layouts. The rightmost Trend must actually be visible without horizontal scroll at targetwidth; width96plusalltruthfulcolumns is not by itself proof.
4. Current cases are EN/TH×dark1672/390; light omitted. This is a coverage limit, not an observed light failure. Native color is hardcoded blue under both themes; check actual light contrast/overflow before broad theme claims.
5. Same-scope late-response race has explicit held delivery, old response.finished and twoRAF barrier; this is meaningful. Scope navigation with held request, page shrink under accepted refresh, missing-endpoint and retry-after-unmount are not browser-proven by this script; pure helpers/source cancellation provide only partial evidence.
6. Performance test uses EXPLAIN on empty DB and expects model/time index plus temporaryGROUPBY. That proves chosen access path, not large-history runtime. Large browser1265pair fixture demonstrates bounded row DOM, not production large-history query CPU/payload SLO. Do not invent an SLO.

## Optional Source paint follow-up

Current row spark override is uniformly `--qp-accent:#158dff` (`models.css:277`). Original Models ref visibly uses blue/violet/orange/cyan/red row sparks. Uniform blue therefore leaves a cosmetic difference. Color must remain decorative and stable by exact pair identity, not imply capability/quality/provider health. A measured palette/glow trial can address this after real geometry/visibility passes. Do not copy Source curve points, add unwarranted category colors, or treat this optional paint suggestion as whole-screen acceptance.

## Recommended next actions

Finish the root-owned browser run; retain any failures. Strengthen missing-endpoint/per-action-count/native-highcount-fit checks or explicitly narrow evidence claims. Resolve or record the GET byte-envelope limit. Archive real build/test/capture provenance and Source comparison; broader all-eight likeness and existing strict raster-repeat failures remain separate open requirements.

No app source edits, browser/build execution, Git mutation or live-user data access by reviewer. Only this review artifact and read-only inspection output were created.
