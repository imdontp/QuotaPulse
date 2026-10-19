# Runway90 independent source review

## Scope and current verdict

**Approve for the final bounded90 implementation; no blocking source finding remains.** The localized key and unrelated-render animation cancellation findings below were corrected and causally verified. Preserve the historical findings and superseded weak proof for traceability; final acceptance scope and remaining broader gates are recorded in the final addendum.

Reviewed original ZIP03 motion contract in prior89 review: valid same-period forecast settles420ms, reset replaces period, stale freezes with label, shared motion tokens/visibility/intersection/listener cleanup. Applied already-read review-code-changes skill. Read new runway-motion.ts, use-runway-motion.ts,9 tests, current QuotaRunway and its call site, relevant model/defaultQuota state and en/th2 labels. No browser/build/Git/application edit performed. Sole output is this report.

## Supported source behavior

- Context is typed exact tuple of owner/id/source/origin/provider/window/reset, distinguishing missing owner fallback from explicit owner and empty strings from null. Same-period actual previous/current finite markers animate only when derivation sample changes. First display, context/reset/source change, clock-only and confirmedAt-only keepalive do not animate. Missing/unknown/no-reset/reset state clears retained forecast. Stale retention requires a previously actual nonnull marker and exact same context; stale recovery snaps rather than replaying an old tween.
- Pure projection copies the actual quota for committed presentation and keeps snapshot clock, forecast result and marker together. Root renders all date/countdown/consequence/ARIA/track properties from presentation.display.at/quota/runway/marker consistently. Stale status says last valid forecast frozen and replaces the current-time label with Forecast snapshot. This presents the former actual forecast honestly, rather than claiming a fresh derivation or mixing old marker with new dates.
- Marker ratio is actual projected-time distance divided by actual reset horizon. If the forecast is flat/unknown/after-reset there is no invented marker. Fill/risk/marker use one finite WAAPI420ms batch with existing slow/easing tokens and fillnone; accepted base styles are final truth. End/cancel listeners are removed exactly once; replacement/unmount cancels handles. No new SSE, query, ingest, interval or frame loop is added to production.
- Hook returns render projection but advances retention only in layout effect, avoiding mutation of committed baseline during speculative render. Real section box is observed; hidden/offscreen/reduced updates cancel directly, seed first eligible fresh derivation and do not queue replay. Stale arrival cancels active tween and preserves snapshot. Unsupported animate() simply displays accepted final base styles.

## Automatic default expiry audit

Existing defaultQuota correctly excludes unreliable windows. Root Runway fallback only applies when there is no current selected/fresh default. It searches the current availableQuotas list for the prior actual id, and uses it only when runwayState explicitly says stale. The helper then checks full reader/window/reset context before retaining anything. Therefore:

- same still-present former default can freeze when it alone becomes stale;
- missing/hidden/removed id cannot be resurrected;
- source/origin/provider/window/reset replacement cannot inherit old marker even if id is reused;
- a different actual fresh default replaces the former context immediately;
- reset expiry clears because runwayState returns reset before stale;
- a prior fresh presentation without valid marker cannot become an invented frozen forecast.

The reference id is cleared on unavailable and only refreshed by committed fresh presentation. Core selection/default policy remains independent, so no stale core is made live merely to keep Runway. Existing History input follows parent active quota and may become unavailable when no fresh automatic default exists; this does not invent a frozen historical chart.

Root's first browser draft explicitly selected5h before stale; that proves explicit same-reader retention, not automatic-default loss. Requested one discriminating no-selection case with other fresh candidates excluded, plus removed-reader clearing. This is the concrete integration gap, not a demand for a new broad suite.

## Important finding: localized key destroys retention

Current call site keys QuotaRunway by JSON([quickStatsScope.sourceId, period]). `period` is the translated display label built in ProductionOverview, including localized Today and formatted custom dates. Toggling EN/TH changes the React key, remounting useRunwayMotion and deleting its committed last-valid display although source/owner/window/reset and actual route scope are unchanged. A correctly frozen stale forecast then disappears; a fresh transition can also be interrupted by an unrelated locale change.

Small correction: pass a semantic stable scope key derived from actual route range/source/custom bounds, excluding translated label and rolling wall-clock endpoint. Do not replace it with selectedScope.from/to for calendar ranges because their rolling `to` changes each accepted refresh and would remount the animation every time. Root notified promptly. Acceptance should include language toggle while frozen, preserving exact snapshot facts/geometry and translated stale label.

## Validation scope and remaining gates

Worker reports9/9 helper/WAAPI tests and final tsc34070 terminal0. Tests meaningfully cover exact contexts, clock/keepalive, stale/reset/missing/unknown, input mutation independence and finite fake-handle cleanup. They do not execute React integration/default fallback or browser computed animated positions. Root initial web build0 predates any upcoming key correction. Actual browser is root-exclusive and still in progress; no passing result inferred from script text.

Before checkpoint acceptance: resolve semantic scope identity; actual420ms intermediate marker position with final attributes, no clock-only replay, reduced immediate, explicit+automatic stale snapshot, reset replacement, locale stability and removed-reader clearing. Record actual current build/test provenance; visibility/native/package/whole redesign remain broader requirements. Avoid claiming active lifecycle interruption variants not directly sampled by the gate.

## Reviewed LF fingerprints

- runway-motion.ts:ed21866ad166aedd808dc4d3fa258af7ae20277e5dd2832fa0f7856ba192eb8d
- use-runway-motion.ts:b6ffc9de7579d955528dcf83515f9ea242baf8155cdcdb0463527b34523022e2
- runway-motion.test.ts:8224ec08f6c5690a4623ed3af6c2e6b3837cc406b3bab56b379cf36a425f75bc
- overview.tsx:61841e26a22068b51fd17e98dc2e335eabb7d8092e69a386ea2188ca00c92ab1
- en.ts:58339099bba2e1d238949c858f034279487b8153f99dfef3282f3df95650f92f
- th.ts:94eb79055827ce4c59b7f4fa1c445048bdca7cef96955e277f880f062b40a46a

Full original eight-page fidelity, remaining table/Alerts motion, native performance/release/rollback and final human acceptance stay open. This bounded review never marks the goal complete.


## Follow-up: semantic scope correction and new timing finding

Root replaced localized key with explicit `Overview.runwayScopeKey={routeKey}` from ProductionOverview. Current call site uses that stable semantic key, excluding locale and rolling from/to. This resolves the reported locale-remount issue. Browser evidence at indexaf42d1bc3a442aa1c547e7b621808bca52174877d04b3de210bbd3504e7d88ac records automatic-default loss, core idle, EN/TH/EN stale retention and reset replacement. Final explicit-stale/reader-removal stages are being added by root. Full254webtests and finalbuild reported0; inspect final logs once gate is frozen.

**Important timing defect and false-positive browser assertion found; request correction before accepting actual420ms behavior.** `useRunwayMotion` computes a new presentation object each render and includes that object in its animation effect dependencies. Every unrelated parent render runs previous cleanup (cancel), then computes no transition for the identical sample. A valid active420ms tween can be cut short by asynchronous mapgraph/history state, despite no forecast replacement or visibility loss. Shared clock-only rerenders have the same cancellation path.

The current browser recorded old38.875px at8ms, then final32.9844px from58ms onward. This does not prove interpolation over420ms. The assertion computes target as base percentage times parent.getBoundingClientRect().width724.1875, but CSSleft uses the actual containing block excluding border (~722.1875). Final32.9844 therefore differs from that incorrectly computed target by~0.09px and passes the>0.01 intermediate test even at the endpoint. Finite configured420ms options and idle handles cannot distinguish normal completion from early cancellation.

Small correction: preserve active tween across semantically identical presentation renders; update committed presentation without cancel/restart for unrelated or clock-only render. Still cancel on actual forecast replacement/context/stale/visibility/reduced/unmount boundaries. Browser should sample actual animation.currentTime/playState and correctly measured endpoints or computed styles with animation disabled/reference geometry; assert a real interior value against both actual endpoints, and distinguish normal finish from early cancel. Root notified immediately; no source or browser mutation performed by reviewer.


## Final causal correction and approval

Root froze final source after resolving both findings. Re-read `use-runway-motion.ts`: animation effect dependencies now use semantic presentation kind/context/sample plus frozen/reduced/region. A separate no-cleanup layout effect records the current committed projection on every render. Unrelated map/history/clock renders therefore update truthful snapshot bookkeeping without cancelling/restarting an active same-sample420ms transition. Actual sample/context/stale/frozen/reduced changes still run cancellation, and direct visibility/intersection/unmount cleanup remains intact. Animation effect runs before the separate baseline commit, preserving the actual previous committed reading for a new sample.

Semantic scope fix is also verified in current source: `ProductionOverview` supplies runwayScopeKey=routeKey, and QuotaRunway's key no longer uses localized period text or rolling query endpoints. Root browser EN→TH→EN while stale preserves exact marker/projected/reset snapshot and translated stale status. No locale-remount defect remains in the reviewed production path.

### Final actual browser evidence inspected

`tmp/runway90-browser/verification.json` and current compiled index both bind SHA256 `bd893ce7318f4fa9a7a1911b97ffd53b8f7201c3e008ae37c298f421aa19f3af`. `tmp/runway90-causal-browser-exit.txt` is0 and matching log records completion. Independently inspected31 real RAF samples and12 distinct computed marker positions. The strict final gate now compares interior positions against the actual observed old/final computed endpoints, requiring at least3 distinct interior positions; it no longer mistakes border-box percentage error for interpolation. All three actual native Animation timelines remain running near416.6ms, then become idle after finite completion. Configured duration420ms, iterations1 and fillnone remain exact. This closes the previously observed early-cancellation path for the actual compiled fixture; the earlier af42 passing result is superseded weak evidence, not retroactively a valid420ms proof.

Other final real API/SSE stages inspected:

- initial no replay and clock-only/identical forecast no new animation;
- reduced preference produces immediate accepted update;
- **automatic default loss without clicking a quota** ages all eligible readings, retains the exact previous valid Runway snapshot, and leaves Core idle rather than promoting stale quota;
- EN/TH/EN stale language changes preserve that snapshot;
- new reset replaces immediately with zero backward tween;
- explicit selected5h becomes stale and retains its exact snapshot;
- deleting the selected source1/5h `limit_sample` rows causes unavailable and removes track, without retaining an absent quota.

Removal terminology: the fixture deletes selected quota readings, not the source/reader configuration itself. It proves missing selected-quota disappearance clears retention. Do not label it an independently tested source-disable/delete workflow. Source guard still requires an actually present exact quota before stale fallback.

Final browser page errors are empty. The fixture uses synthetic memory database and actual compiled local authenticated API/SSE, with explicit scheduler notifications. No native lifecycle, real adapter, source configuration deletion, all-locales responsive fidelity or whole-redesign release claim follows. Root browser script does not separately test active hidden/offscreen/unmount interruption for this Runway; those cancellation paths were reviewed in source and helper fake-handle tests. This is an evidence limit, not an invented stricter contract.

### Final source fingerprints (LF)

- use-runway-motion.ts:2863296e772370ee88220b4155502ebea52909998092d588f6bfbe728c292e7a
- overview.tsx:7d8273c02afb17ec9f5c0abde2370ff1599809e267e908cb0a0f3b5e2ae98c06
- production.tsx:e1068a880aa22e58fcddae8c0dd82cf937461827e00750bd982ac497a03eb2d6

Other helper/test/en/th hashes above remain applicable. Earlier254webtest pass predates the final semantic animation-effect correction; the post-correction webtest log was only startup when inspected, so no terminal success is inferred. Final causal web build exit0 is root-reported and current index is independently checked. Root must record actual final test terminal result and relevant settled layout checks, then complete artifact/staging validation before checkpoint publication.

**Final verdict: approve bounded code and causally verified behavior; both concrete findings resolved.** Full objective remains active, with table/Alerts motion and original eight-page visual/native/release requirements still open. Reviewer performed no source edits, browser/build/test reruns or Git operations.
