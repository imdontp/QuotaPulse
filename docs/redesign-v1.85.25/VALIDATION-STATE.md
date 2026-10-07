# Providers, Models and History reference composition v1.85.25

## Objective and scope

Continue the original eight-page concept with real application data. This checkpoint
addresses Providers ordering/window hierarchy, Models comparison/detail composition
and History detail hierarchy. It does not certify 99–100% source likeness.

Work remains isolated on `design/redesign-foundation` in the existing redesign
worktree. Origin remains the original QuotaPulse repository; the old branch is not
modified. Unrelated `.zed/` files are excluded.

## Changes

- Providers uses the shared framed page heading, prioritizes usable published
  readings without removing any owner, preserves explicit route selection, and
  displays distinct recorded reading origins and the latest confirmation age.
  Exact per-window timestamps and superseded readers remain in owner details.
- The desktop Providers grid reserves the original composition while additional
  real owners can grow it. Known cards retain 360px height. The native comparison
  plot is 96px, with percentage labels using the same CSS height as the bars.
  Comparison exclusions remain explicit. Reader health keeps every row in a
  labelled keyboard-focusable scrolling region.
- Models uses a 575px comparison panel and 90px provider footer with scrolling
  access to all records. Filter labels remain accessible. The selected model
  contains recorded input/output/cache/native-cost facts, a layered 116px donut,
  actual usage trend and recorded effort-token shares. No catalog benchmarks or
  fake historical sparklines were added.
- History identifies the redesigned page as History & Logs (localized). Date,
  kind and calls appear once above four primary identities; model maker remains
  a separate semantic fact beneath Model. Six token tiles use three columns.
  Pricing coverage moves to the pricing group. All four metadata groups, exact
  values, native modal, Close/Escape and focus restoration remain.
- Stable capture reports now include actual Providers/Models/History detail
  regions for source review. Existing functional, overlap and viewport gates
  remain intact. Measurements are not source-image similarity scores.

## Validation scope

Validated changed-page checks and workflow; partially validated whole-design
acceptance. The interrupted full production matrix has no success manifest and
is not represented as a pass.

| Check | Evidence |
| --- | --- |
| Final web build | Chunk a992ff exited0 after Thai Models summary correction and source page title. Existing bundle-size advisory remains. |
| Web unit tests | Session34847 exited0: 152 pass, zero failures. |
| Providers production captures | Session25268 exited0: four byte-identical pairs, en/th × dark/light, no masks. API percentages, exclusions, all windows, unknown/expired/tiny/zero cases, selection, details and responsive gates pass. |
| Full production captures | Session35634 became unavailable before writing a success manifest. Port7804 is no longer listening. The partial screenshots do not establish a full pass; final-build verification remains pending. |
| Full History workflow | Session21461 exited0 after correcting response correlation. All 16 responsive combinations × nine pages and the remaining authenticated workflow/layout gates pass. See workflow-verification.json, responsive-matrix.json and cost-route-compatibility.json. |
| History final tile correction | Four independent language/theme runs exited0 (chunks e34359/d7f491/bd424d/78806b). Eight pairs: six byte-identical, two Thai dark pairs within existing tolerance, no masks. Original large-text tile/dialog assertions, metadata, modal focus and 390/900/1280 gates pass. Separate history-*-verification.json files retain scope; this is not a combined all-page matrix. |
| Models final summary correction | th/dark52332, th/light8b67de, en/dark82283 and en/light79481 exited0: four byte-identical pairs. API values, controls, scrolling and viewport gates remain intact. All four models-*-verification.json manifests use the final build hash. |

Final production `packages/web/dist/index.html` SHA-256:
`767dae4ae4f4ff9d5b523ccceaff3c33ffa0f82dee43ef9e35382168d2da12fe`.
The earlier Providers manifest/build2305 used
`3501f1db45ccc9cee5fc39af49929b8811572d112743faf8eaedd6019e8b6e94`;
the subsequent application changes are confined to wrapping long History tile
text, compact Models summary spacing and source Models page title. History
boundary captures use build98641 hash
`4bc61173d45a232f82232445f88bad4f4e9d2821a7ae227dce0abed556d0687c`.
The full workflow and unit evidence predate these final presentation changes;
changed behavior is checked by the corresponding final scoped browser runs.

## Failure evidence and correction

The first Providers attempt exposed actual lower-panel overflow. Reducing plot
height to its native source size, consolidating the comparison caption and
bounding the complete reader table resolved it. A later overlap gate found the
section icon covering its caption; reserving its full 34px heading row fixes the
collision while preserving the shared section-mark footprint assertion.

Workflow20196 received `scope.from=1788749548848` while expecting a bare Cost
bookmark to start at0. That value plus30days exactly matches the run's synthetic
fixture timestamp, identifying the preceding custom/native/source999 request.
The waiter previously accepted any successful Cost response. It now matches
explicit `from=0`, API basis, auto bucket and no source filter, records unrelated
responses, and still independently asserts returned scope and the All time UI.
No Cost application code or compatibility requirement was changed.
The original full workflow rerun21461 passed: bare scope.from=0, sidebar and
palette month scope.from=1790787600000. Its excluded response list is empty;
the race did not recur in that successful run. The preceding failure's exact
custom timestamp is supporting diagnosis evidence, not a recorded response URL.

## Source measurements and remaining differences

Successful Providers region evidence records header y72–140, grid y152–637,
known cards y152–512, inactive cards y152–313.5, owner disclosure y649–683.5 and
lower panels y695.5–931.5 at1672×941. Four actual owners differ from eight concept
owners; no fabricated accounts fill the reserved space. See
[Providers regions](providers-reference-regions.json) and
[capture manifest](providers-capture-verification.json).

Original source SHA-256 values:

- `providers.png`: `12b01fc5549c79cb3043619401b993d8ae265e3bcbde9ef8cf4efe0f3d2210a6`
- `models.png`: `b055379b1469f65bcf85819a1b1e32ff431e72f4f0c7d4b23192d53212f83d2c`
- `history.png`: `c1955ddc3343731812a4995223f0134cdba9dfa5932a7d25b6fa2e7f7eab5edf`

The large History token boundary was reproduced by a compact-text layout stress
after canonical screenshots: `formatTokens(1e12)` exceeded its tile. Token text
now permits wrapping inside its flex cell. The same containment assertion and
dialog overflow assertion pass in all four final History cases. This
stress substitutes only DOM text temporarily, restores it in finally and is not
represented as an API fixture or reference capture.

Models Thai dark separately exposed summary height116.296875 and provider
bottom946.296875. Diagnostic field measurements showed native-cost explanatory
text wrapping to33px. Desktop summary row-gap4 and small line-height1.2 allow
both lines inside the original106px card rhythm, restoring comparison y259–834
and provider footer y846–936. The941px assertion remains unchanged. The page
title is now Models/โมเดล; blueprint OVR015/016 override unsupported model facts,
not this source title.

History en/dark measured first Project identity y225, primary identities
y225–421, token group y433–570 and pricing y582–757.81. The source first identity
is around y200, so this checkpoint improves hierarchy without claiming exact
rail alignment. Models comparison/provider/donut dimensions now match their
native source estimates; this does not prove detailed illustration likeness.

Diff review is limited to the three pages, localization and test evidence.
No dependencies, daemon calculations, database migrations, user data or existing
popup features were changed. All browser databases are synthetic in-memory.

Models summary/provider historical sparklines need a real aggregated API series;
the current response does not supply it. Typography, provider card glow/bar
treatment, shared shell/native primitives and whole-image source review remain
open. Current captures remain review candidates.

The full original goal, performance/release/accessibility requirements and final
acceptance ledger remain recorded in
[remaining goal audit](../redesign-v1.85.24/REMAINING-GOAL-AUDIT.md).

## Next implementation priorities

1. Shared shell: source review identified wordmark gap12→about19px, tagline10→11px,
   navigation13→14px, QuickStats title13→14px and descriptions11→12px, with blue
   active-icon glow. Verify actual source pixels and responsive/Thai geometry
   before applying; factual workspace, status and controls stay truthful.
2. Models historical sparklines: historySummary already supplies exact-filter
   recorded token/call buckets; costAnalysis supplies API-value buckets. Avoid
   per-provider request fan-out and avoid reusing selected-model trend globally.
   Prefer optional detailed-model trends using the same usageWhere/all-grain
   filters and transaction as totals, roughly30elapsed buckets and provider-keyed
   token series. Preserve null versus empty provider identity and clearly define
   whether footer follows filtered or unfiltered scope. Add aggregate/source/
   provider/vendor/null/empty reconciliation checks before connecting charts.
3. Refine History first-identity position and native typography; retain complete
   pricing/runtime groups and modal focus. Finish source style/geometry review
   across all eight pages and run the final40pair production matrix on that
   completed build. Interrupted captures are not an approved baseline.
