# Source88 final independent source review

## Scope and verdict

**Approve with conditions: no blocking code finding in the inspected owned source.** Conditions are final integrated build/tests and compiled visual/function evidence after the light-palette refinement, plus accurate retention of unresolved strict repeat failures. This is independent read-only review, not all-eight Source acceptance or release certification.

Used review-code-changes and verify-evidence instructions already read in this session. Reviewed current files directly, not Git commands, browser or build. Root supplied baselineHEADee67e99. API worker reports source frozen; UI worker explicitly confirmed dark/light palette frozen. UI worker tsc was still live5948 when reporting; no terminal success is inferred.

## Owned changes inspected

### Detailed aggregate optimization

`packages/daemon/src/api/detailed-aggregates.ts` removes redundant vendor CASE from detailed model/project GROUP BY keys and model group GROUP BY; projection and vendor filters remain. Vendor is deterministic from exact stored model/provider, both already grouped. Detailed rows also group source id, which fixes harness/source-name dependencies; project group behavior remains project-only as before. All FACTS expressions, shared usageWhere, transaction boundary, ordering ties and output shape remain. No schema/write/legacy endpoint change.

New `detailed-aggregates-equivalence.test.ts` freezes original full implementation independently, exercises12 typed/case/null/empty identities,3harnesses, projects, effort, mixed monetary bases, scoped filters and response ordering. It compares full results across70dimension/scope combinations and unchanged database rows/total_changes. This is meaningful compatibility coverage rather than merely restating optimized keys.

Worker observation (`tmp/models88-group-cost-after.md`): current whole-call961.803ms on161200events/1265pairs/120sessions; complete output deepEqual to original SQL, result4009433bytes and7590detailedrows. Do not turn this single observation versus historical medians or sequential oracle runs into a controlled speedup/SLO. Vendor filtering still evaluates CASE per observation and output/sort cardinality stays O(N).

### Models row palette and light contrast

`model-row-trends.ts` hashes typed JSON tuple with deterministic unsigned FNV-style arithmetic into five decorative tones. It does not use index/rank or mutate identity, so filtering/sorting/paging/recreated accepted objects keep tone. Modulo collisions are acceptable decorative reuse; colors do not claim distinct status/quality. Null/empty/literalUnknown exact identity remains intact.

`models.tsx` adds only `data-trend-tone={modelRowTrendTone(group)}` to the existing exact-pair cell. `models.css` changes actual existing series color through CSS variable; no points, filters, page size, semantics, fetch lifecycle or table layout introduced by palette. Attribute selector specificity correctly overrides default blue, and light-specific selectors override dark palette. Source original Models has multiple blue/violet/orange/cyan/rose-like sparks; this palette is a supported style direction, not a claim that every actual identity has the same Source hue.

Dark: blue#158dff/violet#a04dff/orange#f58e43/cyan#00c9ff/rose#f16e79. Light deliberately darker: #2158ff/#7040bb/#875000/#06658b/#b42335. Worker measured old blue/orange/cyan/rose below3:1 on selected light row; new colors meet the measuredwhite/gradient backgrounds. Current test computes exact selected sRGBmix background across101positions and reads actual CSS hues, providing regression evidence. It does not measure thin anti-aliased edge pixels or all real browser backgrounds; compiled light capture still needed after final refinement.

### Projects native card grid

`projects.css` final selector is productionProjects+dark+min-width1536+project-card+project-spark direct `<line>`, opacity0. It removes only five decorative horizontal dash lines. Actual `<polyline>`, data circles, `<polygon>` area, gradients/glow and detail-chart grid remain. Allcyan/violet cards are targeted, with no dependence on selection or fabricated curve shape.

Source evidence supports the expansion: original selectedcyan/violet/lowercyan crops all have varied fine atmosphere rather than conspicuous five equal rows compressed into28px; see `tmp/source88-priorities.md`. Removing this approximation is bounded improvement, not complete Source field recreation.

Read `tmp/projects88-all-grid-trial/verification.json`:5same-buildcases EN/TH1672dark,1672light,1280dark,390dark have exact facts/mainmarkup/geometry, emptyerrors/forbidden. These are intervention results bound to87indexffcc8030..., not compiled88 evidence. Root must compare compiled result after applying selector. CSSopacity changes do not remove accessible chart data or alter actual path semantics.

## Raster diagnostic: supported conclusion only

Read `tmp/raster88-samepage-diagnostic/{verification,pixel-difference}.json`. Both same-page pairs byte-exact. After paint invalidation Models8pixels/max2, Projects0, all within original tolerance. Captured facts/markup/boxes equal. This fails to reproduce archived85 Models135/136max34 or Projects89max6, and therefore provides no proven cause or fix. Preserve85 failures; no opacity/grid/palette/performance change should be labelled a raster-repeat remedy.

## Required remaining gates

1. Build current integrated daemon/web and run affected unit suites after all frozen sources, plus required integration/repository gate. Distinguish worker21targeteddaemon and7web results from root complete runs.
2. Compiled current Models EN/TH×dark/light×native/mobile: real exactpair points, stable decorative tone through paging/SSE, selected row contrast/readability and native Trend visibility. RecheckSource fixture1672 and1536 if both are claimed; functional synthetic images are not Source acceptance.
3. Compiled Projects comparison against pre-change samefacts snapshots, including unselectedcyan/violet native, light/compact/mobile unchanged. Require actual points/paint/boxes equality; do not rely only on first selected-card trial.
4. Run original strict canonical Models/Projects repeats under unchanged thresholds/masks/environment if claiming current repeat clearance. Successful same-page diagnostic alone is insufficient. Preserve any failures and avoid lowering Source fidelity to appease raster noise.
5. Archive exact source/built hashes, observed test exits and controlled before/afterartifacts. Broader remainingSource priorities/native/package/realpreviousversionrollback/wholeperformance remain open.

## Reviewed source LF fingerprints

- detailed-aggregates.ts4622390a7184f22a42786320be3fcc852d977451ff7ea72bb2c05769cf1c2443
- detailed-aggregates-equivalence.test.ts8abfce94ccb59e3e1872bf77c6ea68f6d18ff8091d58f8c5611402f4cd7b908d
- model-row-trends.ts8c8b47526cea7736a0ec7e1a04897ab25f66a696aaf07fea8755cfb366eb5751
- models.tsxfadb6c6e440a4d133c179b4c3571fc1b5eae1d000f2949816dc579f9f25bf6f3
- models.cssdb210e817be5c0509e0f98cf04b863fcdfa01f83a89331546512eeb6030e01ef
- projects.css196704da6bf7d09e84e7a87dd78f9efad1801e26e55129ab2358254b32fa0c20
- model-row-trends.test.ts3c493d1261cdc148d7acc46e849ea00d25747cb21e84eaca4eb4e1560edcf539

No browser/build/Git command/application source mutation performed by reviewer. This report is the only new artifact in this review step.

### Root status received after drafting

Root confirms all sources frozen and final daemon/web builds exit0. Complete repository test1439 and original full40 canonical browser78113 are still live at that notification. These results must be attached after observed terminal completion; this reviewer did not poll or rerun them. Conditional approval remains scoped to inspected code and recorded intervention evidence.

## Addendum: deliberate oversized-GET socket isolation

Inspected current `packages/daemon/test/model-pair-trends.test.ts:201-260` read-only after root reported the first full-suite red POST `read ECONNRESET` and worker diagnosis. Current helper adds `isolatedConnection=false`; only the deliberate oversized GET passes true and uses `agent:false`. Normal valid GET/POST requests still pass undefined and use Node's normal persistent global agent. There is no production API/client/server change in this correction.

This is a proportionate test isolation change: the intentionally parser-rejected oversized GET is not a successful route request and its closing socket should not contaminate the next valid POST's transport fixture. Error listeners add method, URI/body byte counts and reusedSocket labels then still reject. No generic catch converts valid request failure into success; the only accepted transport-error codes are scoped to the deliberate oversized GET. If that request returns a response,431 remains mandatory.

Valid maximum-length POST must still return200 and exact scope/bucket/pair/point data; ordinary GET and POST both must200 and deepEqual excluding server now; unauthenticated POST401, malformed/over-limit POST400 and unchanged DB rows/total_changes assertions remain strict. Any valid POST ECONNRESET still fails the test. No retry or broadened allowed status was introduced for valid requests.

**Verdict: approve this test-only correction; no blocking finding.** Root supplies eight consecutive complete pair-suite7/7runs=56passing and full-repository retry daemon114passing; reviewer did not rerun or independently poll those processes. Web/tray retry and full40 browser78113 were still in progress at notification. Initial full-suite failure remains archived evidence; this correction does not prove production network reliability or fix the separate85 raster failures.
