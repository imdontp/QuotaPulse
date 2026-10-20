# Independent Providers93 review

Verdict: **No concrete source blocker found; accept subject to root's actual compiled browser checks.** Label: **Reviewed only**. This reviewer did not edit app files, execute tests/build/browser or mutate Git.

Scope read: `providers.tsx`, `provider-selection-motion.ts`, `use-provider-selection-motion.ts`, `test/provider-selection-motion.test.ts`; traced existing exact owner selection/data construction, native details controls, Models finite decision and History outline player/current Providers CSS. Original ZIP03 requires180ms table/detail transition,700ms one-shot emphasis, stable identity and static reduced fallback.

## Source binding (LF SHA256)

- providers.tsx: `0b7658393264a78ffa5599088ec81772bde552deef85912d74d08ef2ce3e8fa9`
- provider-selection-motion.ts: `28e4e5dd878c403a31da9892d29cd6898270cbd5778b2f4116ae912509d28775`
- use-provider-selection-motion.ts: `4a632d0ade70fb7216ea473f6d849dde57b09003312d732a458d30657aa19fb8`
- test/provider-selection-motion.test.ts: `159f0a4acb7a876142f6d4f874029237d7fe834a1b4de361ffab0030b22106d6`

## Actual data and explicit action boundaries

The inspector facts are already present in the accepted overview, assembled from actual subscription/source identities and selected primary quota readings. The adapter adds no requests, forecasts, invented telemetry or delayed foreign detail. Existing state/freshness/origin/observed/confirmed/reset values and native reader disclosure remain intact.

`chooseOwner` is used only by the existing owner-card native button and quota-comparison native button. It records the actual closest owner article/li as the transient emphasis target while focus stays on the clicked button. It only creates an intent when the actual selected owner changes or the inspector is closed. Existing update/open/hash handling remains responsible for selection.

The motion identity is `JSON.stringify([actualOwnerKey, inspectorOpen])`, not display name/provider branding. This distinction correctly makes default-owner-closed→same-owner-open a genuine explicit action. Undefined owner stays distinct from an actual owner string; source-only owners use actual source keys. Initial/deep-linked open inspector has no user intent and remains static.

An already-selected owner with an already-open inspector creates no new intent. Its route object may be replaced, but passed owner/open/context/intent primitives remain stable, so this does not restart or cancel a finite native animation.

## Native disclosure and focus

The existing outer `<details>` remains native, with `open` synchronized by its existing toggle handler. A summary close changes the identity to owner/false and cancels an active selection emphasis; native summary reopen changes state without issuing a fresh selection serial, so it stays static. Explicit card/comparison selection may reopen it and receives one new selection effect. Native reader sub-disclosures remain untouched.

Neither motion hook nor finite player opens/closes native details, focuses a target, changes aria-pressed, removes the clicked button or rekeys the inspector. Focus semantics are therefore still native; root must verify keyboard activation, summary disclosure and focus persistence in the actual browser rather than infer them from source.

## Eligibility, duplicate lifetime and cleanup

The adapter uses the shared reduced-motion preference plus immediate document/media event cancellation. Eligibility loss consumes the latest explicit serial, including an intent whose React render occurred before its animation effect. Reduced/hidden work cannot queue a later selection replay.

For each selection, viewport/main clipping is checked on actual owner target and actual open detail section. If detail is offscreen/closed, the finite decision consumes the intent without retaining a pending detail queue. This adapter has no asynchronous detail fetch to authorize later. Existing native player observes each active actual target and cancels that target's effects when offscreen; it cleans handles/listeners and disconnects target observers on finish/cancel. No permanent region observer is needed to release a nonexistent pending fetch.

The animation effect has no cleanup tied to overview object replacement or ordinary busy-state rerenders. Its dependencies are owner/open/context/intent/enabled/reduced and stable refs. Unchanged accepted overview data therefore does not truncate700ms. Window/section/source changes replace context; errors disable/cancel and consume; retry does not manufacture another intent. Unmount removes visibility/media listeners and cancels every retained native handle.

Both target types use existing outline mode: shared180ms opacity plus700ms explicit solid2px inset outline, accent→transparent, fillnone. This avoids the known opaque-gradient background pulse occlusion, preserves resting paint and does not change box geometry. Actual visible interpolation still requires root pixel/native timeline evidence.

## Inspected test scope and required root browser checks

The four focused tests inspect exact owner/open identity, default closed→explicit open versus initial/deep-link static, comparison owner change, native close/reopen without replay, context/disabled/offscreen consumption. They are meaningful pure decision checks; this review did not run them and they do not execute React/native details layout.

Root's actual gate should prove:

1. Default owner card opens the existing closed inspector with owner-target180/700 and actual detail180/700 once; explicit different owner/comparison behaves likewise where each actual target is visible.
2. Same owner already open, duplicate accepted overview during an active700ms effect and busy rerenders neither restart nor truncate it.
3. Native summary close/reopen is static, keeps native keyboard/focus behavior, and does not replay the last explicit owner intent. Nested reader disclosures remain native.
4. Window/context changes, error/retry, reduced, real offscreen/document hidden and active unmount cancel/consume appropriately; restoration alone stays static.
5. Finished/reduced snapshots retain existing actual facts and resting layout/paint. Transient outline must be visibly above the existing opaque card surfaces; computed color alone is insufficient proof.

No source blocker was identified in the reviewed path. This conclusion is intentionally conditional on those browser interactions, because the previous Live92 review demonstrated that a superficially consistent hook can still mishandle actual native mount/visibility timing.
