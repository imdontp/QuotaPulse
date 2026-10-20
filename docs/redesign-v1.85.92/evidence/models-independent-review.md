# Models92 independent review

## Verdict

**Reviewed only: no concrete source-level blocker found in the inspected Models92 change set.** The implementation follows the original Tables/detail contract of180ms transition plus700ms finite emphasis for an actual changed user selection. Native acceptance on the final compiled index remains the coordinator's required gate; this source review is not a browser pass, eight-screen fidelity acceptance or release verdict.

Applied `review-code-changes` skill. This review made no application edits and ran no browser, build, test suite or Git command. Only this local report was written. The reviewer implemented Live92 separately and did not author the Models92 selection adapter under review.

## Inspected change set and fingerprints

LF-normalized SHA256 at inspection:

| File | SHA256 |
| --- | --- |
| `packages/web/src/redesign/model-selection-motion.ts` | `61c02fe010d7eaf02014994194e29731e7f4a12aa5cfe2d80dbfeb0f2f8af4a6` |
| `packages/web/src/redesign/use-model-selection-motion.ts` | `3f404c882f420343cccb369a4fe6def8ea9697e17618714b7f3a64ec3c3a9360` |
| `packages/web/src/redesign/models.tsx` | `4ad62cda3c1eeeadc6376fdc4be11ddec0a118060a686e270e8f18f07039288a` |
| `packages/web/src/redesign/history-motion.ts` | `c960de92554e9f6d349f5be47c24a06e39af56c8c146c566e8aa532b4d1e9f1d` |
| `packages/web/test/model-selection-motion.test.ts` | `084c47a4f5725e2924f0bf9cd753661ef36017f8723989d382c3a262c6ae561b` |
| `packages/web/test/history-motion.test.ts` | `a46baf7234d76059ddcccff01d5d208ac6f9f8c82575b6cfe614fd7eb726ab15` |

Supporting reads: `model-comparison-page.ts`, current Models comparison/detail markup, scoped Models layout rules and shared motion constants.

## Evidence supporting the source verdict

### Exact action and accepted-detail identity

`models.tsx:135–157` constructs `detailKey=JSON.stringify([data.scope, identityKey(selected)])`, resolves accepted detail only when `detailSnapshot.key===detailKey`, and gives the motion adapter an accepted key only when that actual detail exists. Existing request cancellation rejects an obsolete detail response after its effect cleanup.

The row action emits an intent only when `modelPairKey(group)` differs from the currently selected exact pair. Pair identity is the recorded model/provider tuple, preserving null versus empty string and case. Context includes comparison request/search/metric scope and actual comparison page. Initial/deep-linked/fallback selections have no matching explicit intent and therefore remain static.

The pure state machine holds one pending `{key,contextKey,detailKey}`. New selection/context/detail-request changes retire the old pending identity. Foreign accepted detail keys cannot satisfy it. Once exact accepted detail plays, pending is cleared; duplicate accepted data or changing busy state does not rearm it. This is bounded state, not a replay queue.

### Finite duration, lifetime and cancellation

`use-model-selection-motion.ts` delegates to the existing native finite player. Row and accepted detail effects have separate cancellation handles. The per-observation effect deliberately has no cleanup that would truncate a running700ms effect on an unrelated render; explicit identity/context/error/lifecycle decisions cancel instead.

Document hidden and reduced-media changes consume pending work and cancel active effects. Detail intersection loss consumes pending detail; row intersection loss cancels row effects. Synchronous row visibility checks include the actual table clip container; detail must be geometrically visible before pending is armed or accepted content is animated. Unmount/observer teardown consumes the latest intent serial, cancels both handles and disconnects listeners/observers. An intent committed before an eligibility callback cannot subsequently resurrect delayed work.

`history-motion.ts:30–76` retains shared DURATION.fast180 and DURATION.deliberate700, shared easing, iterations1 and fill none. Native finish/cancel cleanup removes animation listeners and cancels the effect; the intersection observer disconnects when the last effect ends. No interval, RAF loop, fetch or new dependency was added by these adapters.

### Optional outline mode and final paint

The player's new optional `emphasis='outline'` mode is requested by Models because opaque selected-row/panel images can cover a background-color pulse. Its default remains `background`, preserving existing History/Live call semantics.

The outline effect changes outline color/style/width/offset, uses an inset2px outline, and does not animate width, height, transform, border or factual values. Both180ms opacity and700ms outline have fill none and are cancelled at completion, restoring the existing CSS/base paint. No new resting Models CSS is required. Native source validation still needs to confirm visible interpolation and final pixels on the actual compiled renderer.

### Focus and factual content

Models is an existing row-button plus side-rail selection flow, not a new modal. The adapter does not call focus, blur, showModal, close or navigation. Selection retains the original button's native activation/focus semantics and stable pair-keyed rows. It does not add capability/latency claims or replace real usage/detail API content with a decorative fixture.

### Coverage inspected, not independently executed here

The Models tests cover initial/deep-linked exact pairs, row-first/detail-after-exact-acceptance, duplicate pending/accepted snapshots, foreign/rapid selections, no-op and automatic fallback, changed search/filter/sort/page context, changed exact detail scope, failed/disabled/offscreen cancellation, consumption of a not-yet-observed intent, and the optional outline player's duration/frames/cleanup semantics. Existing History player tests cover the default mode's finite token durations and cancellation.

These tests are appropriately aligned with the pure decision/native-call boundary; they do not replace actual browser timing, clipping, focus and visibility evidence.

## Current native evidence boundary

The coordinator reported an earlier `b222ec99...` compiled run passed Models cases before encountering a separate Live first-SSE omission. This report does not convert that partial run into current-index acceptance.

At the time the reviewer reread mutable `tmp/motion92-browser/failure.json`, it instead identified compiled index `b40e885220c25c2723fdc3edc2502c9a5a643d6e7f0059d7edf8c81742b1dcc3` and assertion `models-explicit-row-then-accepted-detail actual native timeline 180`; only the Models-initial-static stage had been recorded. That artifact does not by itself identify a causal application defect, so no speculative code blocker is raised. It also does not prove a final native pass. The coordinator was notified and owns investigation/rerun, including the added real held-IO and unmount cases.

Before claiming completion of this motion slice, inspect final-index evidence for actual180/700 timelines, a response held across detail IO loss with no replay after return, unmount cancellation, failed request/retry behavior, unchanged focus, and restored base paint/geometry. A source-level no-blocker verdict is narrower than those runtime requirements.
