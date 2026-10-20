# Projects93 independent review

## Verdict

**Reviewed only — no concrete blocking defect found in the inspected Projects93 selection-motion source.** Actual final-index browser timing, focus, clipping and lifecycle acceptance remain required. This report does not certify native behavior, final pixels or complete concept fidelity from source/tests alone.

Applied the `review-code-changes` skill. No application edits, build, browser, Git operation or test execution was performed for this review; only this local report was written. The reviewer owns Runtime93 implementation separately and did not author the Projects93 adapter being reviewed.

## Inspected source fingerprints

LF SHA256:

| File | Hash |
| --- | --- |
| `packages/web/src/redesign/projects.tsx` | `b0d0335666c1276c1c2e0dc98f2f140966b95801415641172ea3306ea6d398c7` |
| `packages/web/src/redesign/project-selection-motion.ts` | `62ee7b5c7909e7771d5235f0825db4cb74a6da017dca1cbc59d3b718c1b0fb3c` |
| `packages/web/src/redesign/use-project-selection-motion.ts` | `72136109b26ad1e5ccd411b4a7769102e87b5413a4dc09256c4b7dd5dbb1a339` |
| `packages/web/test/project-selection-motion.test.ts` | `af18ab6de770a90f89f5cabc136e41884af222826549c6cf4f310db17bcf557b` |

Supporting reads: reused `model-selection-motion.ts`, finite native `history-motion.ts`, and relevant existing Projects layout/overflow rules.

## Traced behavior

### Exact project/action identity

- `projectMotionKey(project:string|null)=JSON.stringify(project)` distinguishes unassigned null, exact empty string, literal strings such as `"null"`, and case-sensitive names.
- `projectDetailMotionKey(project,tab)` includes the exact typed project and actual selected detail tab. A project null is wrapped inside a string tuple; it cannot collide with the state machine's absent-selection null.
- `motionContext` includes the canonical request key plus main filter tab, sort and search. Scope/harness/search/sort/filter replacement seeds/consumes intent instead of impersonating a user project click.
- Card and top-rank buttons both pass their **actual** `event.currentTarget` to `selectProject`. The hook retains that real opener and validates its connected state and matching `data-project-selection-opener`; duplicate project identities in card/rank presentations do not select an arbitrary DOM match.
- `selectDetail` records a detail intent only on an actual tab change; the overview breakdown button delegates to that same existing action. Its kind is `detail`, which prevents replay of a formerly clicked project card/rank opener.
- Automatic fallback and deep-link/default initial selections have no matching fresh intent, and therefore remain static.

### Aggregate acceptance versus asynchronous content

`projects.tsx:138–162` binds asynchronous `projectDetail` results to exact `detailScope`, current session offset and the accepted primary data's `now`. Effect cancellation prevents an obsolete request result being installed after selection/request change. Session and usage tabs expose an accepted detail-motion key only when the matching actual `detailSnapshot.key` is available; foreign/late results cannot satisfy another selected project's pending authorization.

Overview and details/breakdown tabs derive their main content from the already accepted `detailedProjects` aggregate response. Their motion key is explicitly tagged `aggregate`, exact accepted `data.scope` and selected project/tab. This permits immediate response to an actual aggregate selection without waiting for an unrelated asynchronous session request.

The details tab also contains supplemental observed paths from asynchronously fetched session data. That subsection keeps its actual loading/error placeholder until the matching response is available. Immediate aggregate emphasis is **not** evidence that those paths were already fetched or that the entire asynchronous details response is accepted. The adapter does not replace the placeholder with invented paths.

### Session offset and selection reset

`observeProjectSelectionMotion` adds only an offset discriminator around the reused Models finite decision:

- A genuine changed project/tab intent that resets offset20→0 is recognized as selection, and can animate its actual opener/accepted content.
- A plain session-page change without a fresh matching changed identity cancels pending work and consumes the current intent. Arrival/retry on that new page cannot release the prior selection's motion.
- Clicking an already selected project does not create a new selection intent; resetting that project's pagination through the existing action remains static.

This addresses the important distinction between pagination and an offset reset that is incidental to a real selection, without adding a queue or new request mechanism.

### Finite lifetime, no duplicate replay, and cancellation

The reused Models decision holds at most one exact pending detail key. Changed context, selected identity, desired request key, failure, disabled state or offscreen detail consumes it. A late foreign response cannot satisfy it; successful accepted detail consumes it once. Repeated accepted/busy observations leave `cancel=false` for the same selection, so unrelated renders do not truncate the native700ms lifetime.

The hook consumes the latest committed intent serial on document hidden/reduced preference, detail IO loss and lifecycle cleanup. It cancels opener/detail handles independently and disconnects its observer/listeners on teardown. An intent committed before the observation effect cannot be resurrected after eligibility returns. The actual native player also observes animated targets and cancels on target intersection loss.

Both opener and accepted side detail use the existing shared180/700ms player in optional outline mode: one iteration, fill none, no geometry-changing frames, no timer/poll/SSE/animation loop introduced by Projects. The default player behavior remains unchanged for other consumers.

### Focus, facts and resting paint

Projects retains its existing button/side-rail flow; no new modal or invented action is added. The motion adapter never calls focus, blur, navigation, open or close. Card/rank buttons and detail tabs retain native keyboard activation/focus and existing route updates. Existing typed React keys remain stable.

No Projects CSS change is part of the inspected motion implementation. Native outline/opacity effects restore base styles after cancellation/completion. Actual data still owns token/cost/pricing coverage, sessions, record-grain facts, exact null/empty identities and scoped History links. These source properties support a no-resting-paint-change expectation; a compiled screenshot/geometry comparison is still needed to prove it.

## Test and runtime evidence boundary

Inspected nine focused test cases cover exact identities; initial/duplicate static behavior; actual accepted aggregate versus delayed/foreign sessions/usage; detail tab/breakdown intent without old-opener replay; real selection offset reset; inert pagination cancellation; scope/filter fallback; rapid selection/request retirement; and error/offscreen/hidden/reduced serial consumption. Their presence and aligned assertions are source evidence, not an independently executed pass in this review.

Coordinator-owned final-index browser checks should establish:

1. Visible card and top-rank action each emphasize the exact real opener and accepted aggregate detail with180/700ms effects.
2. Actual session/usage responses held for one project cannot animate foreign, stale, paged, failed or offscreen content; matching accepted data plays once when still authorized.
3. Detail tabs and breakdown link emphasize accepted detail only, without replaying the old card/rank opener.
4. Resetting offset as part of a real selection works, while ordinary session paging and retry remain static.
5. Duplicate/busy responses preserve full native duration; initial/default/deep-linked/filtered/reordered selections stay static.
6. Reduced/hidden/actual IO loss and route unmount cancel effects, restore readable base state, and do not replay on return.
7. Native button focus remains correct, exact null/empty facts remain distinct, and final resting paint/geometry is unchanged.

No concrete source blocker is raised merely because these stronger runtime checks remain coordinator-owned.
