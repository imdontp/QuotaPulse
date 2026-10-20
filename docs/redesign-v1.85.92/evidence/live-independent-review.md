# Independent Live92 change review

Initial verdict (superseded by the concrete startup finding appended below): **Approve with runtime validation conditions; no concrete source blocker found.** Validation label: **Reviewed only** by this reviewer. No app edits, build, browser, tests or Git mutations performed. Root owns actual compiled runtime evidence.

Reviewed changes: `redesign/live.tsx`, `live-record-motion.ts`, `use-live-record-motion.ts`, `test/live-record-motion.test.ts`; traced shared native player, current Live CSS, `use-live.ts` refresh reasons/coalescing and original ZIP03 generic table/detail motion contract. Review follows review-code-changes skill.

## Frozen source fingerprints inspected (LF SHA256)

- live.tsx: `3ae332091f899a1a65aa9b6deaa95270fc10dcdd6e72f3d46c19ef467d5d7359`
- live-record-motion.ts: `0a5a8353c2efa73234984124bb8835d916759d439539d243e226f59767be4dc5`
- use-live-record-motion.ts: `af14cfb85b261df998ebb624f4c23dc7f3950185eb314b9b7089d12a98eeccb6`
- live-record-motion.test.ts: `74ec28ef4ea11449f1cb846b88b4ab7258a4800f52f0c9ab18933f16b69ab033`

These hashes describe inspection, not a commit/build fingerprint. Any later source adjustment needs refreshed evidence.

## Evidence-backed assessment

### Cold initial baseline versus real eligibility loss

`LivePresenceLedger` starts epoch0/ineligible, serial-1 and seedNext=true. A real `suspend()` advances untouched epoch0 to1 even when eligibility was already false; an eligibility return advances it again. This distinguishes a real hidden/reduced/offscreen barrier from mount's not-yet-delivered IntersectionObserver observation.

The first visible accepted initial snapshot may clear seedNext only with request eligibility false/epoch0 and current untouched epoch0 or first eligible epoch1. It still returns no entrances because first context is new, initial reason seeds, and the prior seed was true. The next genuinely eligible SSE can then present a new presence rather than unnecessarily suppressing it.

A held initial that crosses real loss cannot match that exception: suspend changes epoch and eligible return changes it again. Likewise an initial request begun after a real initial suspension captures nonzero request epoch. Both remain static and require a fresh returned eligible baseline before later new observations animate. Inspected tests explicitly cover both initial suspension orderings, accepted-before-IO startup and held initial across loss.

The React attachment path is consistent with the exception: before initial data, enabled=false and hasSnapshot=false; the unknown-IO disabled state is not automatically classified as a real pause barrier. On accepted first data, hasSnapshot/eligibility effect reattaches to actual refs. Existing initial loading placeholders are not animated as new records.

### Actual accepted batch and held-request semantics

`ProductionLive` captures each region ledger's eligibility before the existing overview and detail API requests. It adds serial/reason/eligibility only when `isCurrent()` accepts the existing complete page snapshot. Old scope, paused or unmounted requests retain the existing requestEpoch/currentKey/mounted rejection. No new API, SSE or polling was added for motion.

Each region's ledger requires current eligible state, eligible request-start state and equal epoch. A held candidate crossing an actual region/document eligibility loss is static even if visible when delivered, and cannot arm a replay; first subsequent valid returned page seeds. Initial/dependency/visible/online reasons explicitly seed. Current shared controller provides exactly those reason names; SSE/fallback/manual may reveal newly observed presences after a valid baseline.

Region eligibility checks real viewport and clipping ancestors; capturing scroll and resize listeners recalculate actual region eligibility. Per-target native player observers additionally cancel a row/list/detail effect if that actual target goes offscreen. Observed presences outside the current scrolled list clip do not animate.

### Duplicate timeline and cleanup

The presence effect advances the bounded accepted-page baseline and plays only nonempty newly observed target sets. Identical/reordered accepted rows and repeated batch serials do not play or cancel an existing batch. There is no cleanup tied to each batch/data object that would truncate the700ms timeline, unlike the earlier Runway lifetime defect.

The region lifecycle cancels on disable, hidden, reduced, clipping/offscreen loss, observer replacement or unmount; cleanup disconnects observers and removes visibility/media/scroll/resize listeners. Shared runner cleans finite native handles and target observers on finish/cancel. There is no animation loop, extra timer engine or replay queue. The ledger keeps only the preceding accepted page, not an unbounded identity history.

### Identity and actual data

Session identity is the actual internal sessionKey with a typed session prefix. Feed identity reuses the exact actual tuple(event_id,source_id,session_key,timestamp_ms), separately from session identity. Native row keys stay sessionKey/event_id. Existing times, totals, source/provider/model facts and call-versus-aggregate labels remain unchanged; no monotonically increasing event ID or ingestion-time inference is made. A presence absent from one page and later visible again may enter again under the documented bounded preceding-page semantics.

Selection uses a distinct explicit click serial and exact session identity/context; initial unselected page has no detail effect. A repeated same selected identity does not replay simply because its click serial increments. Closing then selecting again is a new explicit selection. Parent's existing native showModal effect remains responsible for opening/focus, with the motion effect ordered after it. Motion never opens or rekeys the dialog.

### Focus fallback and resting layout

The close handler retains exact opener focus when its button is still connected. If an accepted refresh removed it, the code falls back to the existing focusable session table region, then existing main(tabIndex=-1) for empty/changed scope. This avoids focusing a detached node. Added refs/data attributes and a class on the existing dl do not add wrapper geometry. No modified CSS implies a new resting paint target.

Current Live session tbody cells, feed list items and dialog dl do not show the specific opaque row gradient/panel-cover issue identified in Models. Their shared background emphasis still needs actual visible-pixel verification; computed color progression alone is not proof of a visible signal.

## Runtime acceptance conditions (root, not claimed by this review)

1. Actual cold visible initial page has0 record/detail effects; its first eligible genuine SSE new session/feed presence receives exact180/700ms once. Repeat with initial request held across real offscreen/hidden/reduced barrier; no cold exemption or catch-up replay.
2. Actual same-context duplicate accepted snapshot while700ms runs reaches native full duration without cancellation/restart. Reorder, query/provider/model/page change and pause/resume seed; mutable totals alone do not create a new actual identity.
3. Real held API candidate across offscreen/document loss and return stays static; next returned valid baseline seeds; later genuinely new presence works. Verify separate sessions/feed regions as well as their clipped target lists.
4. Native pointer/keyboard session selection yields row/detail finite effects, preserves actual content, Escape restores exact surviving opener, removed opener falls back to table/main. Reduced or active offscreen/unmount cancels handles; no restoration replay.
5. Actual intermediate screenshots/pixels show readable opacity and visible emphasis. Finished/reduced states preserve baseline facts/geometry; no Thai/light/mobile overflow regression.

These conditions cannot be substituted by the inspected pure ledger tests or this source review. Whole-goal motion completion, native release and all-screen concept fidelity remain outside this verdict.


## Correction: absent initial feed region was mistaken for real offscreen loss

**Concrete issue found by root runtime validation after the initial review; fixed in current source, final compiled runtime check pending.** The original review missed this real mount-effect path and its startup consistency statement was too strong.

Root's unchanged four-effect native gate on compiled index `b40e885220c25c2723fdc3edc2502c9a5a643d6e7f0059d7edf8c81742b1dcc3` observed only `[180,700]` for a new session plus feed observation, where `[180,180,700,700]` was required. Session responded; the first new feed presence was incorrectly suppressed. Evidence inspected:

- `tmp/motion92-browser/absent-feed-region-red-failure.json` (exact expected/actual effects, production index, failure stack).
- `tmp/motion92-browser/absent-feed-region-red-live-initial-io.json` (actual feed region first native IO observation is TRUE, ratio1, y771.75 through931.25; no actual FALSE observation explains suppression).
- Corresponding root failure PNG retained alongside those files.

### Causal source path

Unlike the sessions region, `feedRegion.current` is null on the cold initial render: the feed section is inside the `display ? ...` branch. The reviewed hook reset intersection to null, then used this fallback when no observer/node existed:

```ts
if (observer && node) observer.observe(node);
else intersection.current = !!node;
```

For a missing feed node this assigned false. Its next `update()` interpreted `intersection.current === false` as a real offscreen barrier and called `ledger.suspend()`, advancing request provenance from untouched epoch0 to1 even though no feed box existed to be offscreen. The cold initial request captured nonzero/ineligible provenance; after the real feed mounted visibly, the cold-baseline exemption correctly rejected that provenance. This manufactured suspension left the first subsequent real eligible feed SSE as an unnecessary seed, suppressing its180/700 effects.

The important distinction is **absent/unmeasured = unknown**, versus **actual hidden/reduced/offscreen = suspended**. The native IO record did not show the feed losing visibility; this was an application mount fallback error.

### Minimal current resolution and source binding

Worker changed only the fallback's node condition:

```ts
if (observer && node) observer.observe(node);
else if (node) intersection.current = true;
```

No node retains null unknown. A real node without IntersectionObserver can use true; actual document hidden/reduced flags continue to suspend regardless of node existence. Actual observed false visibility, epoch protections and seeded refresh reasons remain intact.

Final hook LF SHA256 supplied by worker/root and independently read from disk:
`49ded765e9489dec419beb65f43513500c6a5d19e5835c23b017160475079143`.
This supersedes only the hook fingerprint `af14cfb85b261df998ebb624f4c23dc7f3950185eb314b9b7089d12a98eeccb6` from the initial inspection above.

### Red/green causal evidence inspected

The worker diagnostic `tmp/live92-feed-absent-diagnostic.mts` executes the actual registered hook mount effect via an isolated React dispatcher; it is not a browser substitute. Its preserved outputs show:

| Actual hook startup input | Before fallback fix | After fallback fix |
|---|---|---|
| region absent, document visible | epoch1/ineligible (incorrect fabricated loss) | epoch0/ineligible (unknown, correct) |
| region absent, document hidden | epoch1/ineligible | epoch1/ineligible (real hidden loss still protected) |

Evidence: `tmp/live92-feed-absent-red.log`, `tmp/live92-feed-absent-green.log`. This supports the specific causal correction, while root's rebuilt unchanged four-effect native gate must still prove the current compiled feed behavior. At append time root rebuild session23270 was live; no current rebuilt browser success is asserted here.

**Revised review position:** the missing-node startup defect is concrete and addressed by the minimal source fix above. Current source is acceptable for the unchanged native gate; final runtime acceptance remains pending that actual run. The initial no-blocker source review did not detect this issue and is retained above only as chronology, not as proof of correct pre-fix startup.
