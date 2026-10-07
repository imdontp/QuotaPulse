# History hierarchy and native Models/Providers alignment v1.85.29

## Source and scope

Continue the original eight-page concept using real application facts, on the
isolated `design/redesign-foundation` branch after0fb786f/v1.85.28.
Source references remain those supplied in the user's Downloads blueprint.

| Reference | SHA-256 |
| --- | --- |
| history.png | c1955ddc3343731812a4995223f0134cdba9dfa5932a7d25b6fa2e7f7eab5edf |
| models.png | b055379b1469f65bcf85819a1b1e32ff431e72f4f0c7d4b23192d53212f83d2c |
| providers.png | 12b01fc5549c79cb3043619401b993d8ae265e3bcbde9ef8cf4efe0f3d2210a6 |

## Implemented

- History heading has a truthful localized subtitle and native61px heading
  rhythm, targeting the source timeline top143. Its52px icon supports the
  original title/subtitle hierarchy. Legacy heading remains intact.
- Native History timeline shares the heading row with its grain disclosure,
  uses compact summary cards with67px minimum height, and places a text legend
  above the chart in its existing chart row. Pricing calls, native value,
  recorded grain, partial breakdown and effort facts remain available; the
  timeline grows for real content rather than clipping it to a fixed height.
- Selected History rows have complete blue top/bottom/edge outlines and rounded
  corners. Existing row padding,330px scrolling table, pagination and modal
  selection/focus behavior remain.
- Native Models heading has8px inline padding; comparison has10px block padding
  while retaining its575px outer frame and visible pricing coverage note.
- Providers places actual title/profile copy beside the icon and state, instead
  of using a separate full-width profile row. Text wraps naturally; the owner
  button preserves its accessible name, selection state and callback.
- Provider reset label and actual compact duration stack separately, with the
  duration kept together. Unknown/expired readings retain their existing text.
  Explicit card row templates preserve optional hidden-owner notices and
  no-quota cards. No invented owners, quotas, plan or billing facts are added.

## Validation

| Check | Evidence |
| --- | --- |
| Production web build | Session7403 exited0;2980 modules. Existing532.87kB main App bundle advisory remains. |
| Source/diff review | No blocking theme, hidden-row, wrap or selection/API-semantic issue found. Diff whitespace passes. No dependencies, migrations or API changes. |
| History production en/th dark/light | Session22864 exited0:8 pairs (canonical and selected),2 byte-identical; remaining15-34 changed pixels,max delta7-9 within unchanged tolerance, no masks. All four occupied density checks: bottom920,8 visible rows,43 records. Focus/details/API/large-token gates pass. |
| Providers production en/th dark/light | Session67449 exited0:four pairs,2 byte-identical; en/dark8 changed pixels,max delta3 and th/light43 changed pixels,max delta1 within unchanged tolerance, no masks. Existing exact comparison/selection/expiry/unknown and responsive checks pass. |
| Models production en/th dark/light | Success manifest independently inspected:four byte-identical pairs, no masks, exact candidate build hash. Root could not access agent50968 handle after a credit error at checkpoint time. On the subsequent v1.85.30 turn, the owning agent resumed and confirmed terminal exit0 and cleared port7804. All recorded API/geometry/focus/disclosure/responsive gates completed before manifest creation. |
| Authenticated full workflow | Session2267 exited1 at en/light/900 immediate Escape focus restoration assertion; services closed. After bounded expected-focus synchronization, rerun99026 exited0:all eight page workflows,16 responsive combinations with nine destinations, occupied layouts and route compatibility pass. Fresh artifacts are included; browser/Vite/daemon/database closed. |

Targeted focus diagnostics complete70 cycles with0 immediate misses. Event
traces prove hidden-dialog state precedes the async callback restoring connected
row focus. The workflow now waits at most2000ms for that exact state, retaining
the original assertion. Full rerun99026 exited0; see
[bounded diagnosis and evidence](FOCUS-DIAGNOSIS.md).

Production index SHA-256:
`c8304934439a7d8ebac7fbf2279988ec95e8825ff62764688d30b9e907c0024f`.

Captures and tests use synthetic in-memory data. Repeated captures establish
repeatability and stated behavior/geometry checks, not a similarity percentage
against the reference. Source region estimates must be reviewed separately.

Fresh native History source review: timeline y143-452 and summary cards194-261
versus source143-452 and194-260. Full selected outline spans the row. Chart
interior is approximately301-401 versus source294-411; metadata filters remain
taller than the source single-row filter, moving selected row578 versus source558.
These are remaining styling/hierarchy gaps, not exemptions from fidelity.

Fresh Providers source review: first quota separator approximately237 versus
source232 (previous253), first bar279 versus source273. Actual profiles wrap
visibly and reset durations stay on one line; active cards retain152-512 and
lower frames approximately696-932. Models icon/title now247/289 matches source,
comparison title284 versus285. Its first selected row422 versus386 still needs
a native heading-row coverage note and tighter gaps, retaining complete facts.

## Remaining full goal

Current whole-source visual acceptance remains open. Globe texture and luminous
star accents, remaining page style/typography/illustration differences and the
truthful coverage-note hierarchy need further source review. Finish final
eight-page source/production-override evidence, the40pair final matrix, current
render/query/animation performance, release compatibility and manual
accessibility/acceptance ledger. Do not mark99-100% likeness from scoped checks.
See [full remaining goal audit](../redesign-v1.85.24/REMAINING-GOAL-AUDIT.md).
