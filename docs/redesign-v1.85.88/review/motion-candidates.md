# Candidate motion integration patches — apply only after checkpoint88

These are concrete implementation hunks, not accepted production edits. Use `lib/motion.ts` DURATION/EASE and `index.css` existing tokens. No second duration vocabulary.

## 1. Extend existing motion boundary with a scoped one-shot handle hook

File target `packages/web/src/lib/motion.ts` (or one imported sibling, if splitting DOM code improves testability): add `useObservedTransition(regionRef)` that exposes `run(element,keyframes,intent,easing)` and `cancel()`.

Implementation contract:
- Reuse useMotionPref; `element.animate(frames,{duration:pref.dur(intent),easing:cssHouseEase,iterations:1,fill:'none'})`. WAAPI uses milliseconds, so no /1000 here. For Motion React use pref.dur(intent)/1000 instead.
- Track only active Animation handles in a Set; animation.finished.finally removes each handle. Cancellation settles to already committed factual DOM style, never fills backward or retains stale inline animation values.
- One visibility listener and IntersectionObserver **per composed region**, not per row/point; reuse this hook at table/chart container. They cancel handles on hidden/offscreen. Reduced preference from existing motion/react hook cancels handles immediately. Cleanup disconnects/removes every listener and cancels/clears handles. No timer, requestAnimationFrame loop, idle queue or SSE subscription.
- Consume accepted trigger baselines even when hidden/reduced/offscreen/paused, then snap; re-entering a region does not replay old events. No observer engine beyond this scoped lifecycle. Existing RuntimeMotionGate remains unchanged.
- SVG `points` is not reliably WAAPI-interpolable: do not claim the generic element.animate handles polyline points. See explicit minute integration below.

## 2. Minute chart actual coordinates

Target live-token-flow.tsx:
```
const previous = useRef<AcceptedMinuteCoordinates>();
// In layout effect after accepted data commit:
const changes = changedMinutePoints(previousSeries,nextSeries,sameScopeAndDomain);
previous.current = acceptedCurrent; // also consume while disabled; no resume replay
```

Use existing SVG SMIL support already proved for RuntimeMap, but attributeName=`points`/`cx`/`cy`, begin=`indefinite`, duration from DURATION.fast/1000, repeatCount1, fill=remove. Base SVG attributes are always final factual coordinates. Render/activate only changes on matching timestamps; same-count strings alone are insufficient (rolling windows can have different identities). Build start polyline from final coordinates except actually changed common points, then animate toward final points, with unchanged grid/axes outside. Missing/null segments and new buckets have no interpolated previous value. Register SMIL endElement cancellation through the region hook, not timers/rAF. Existing circle data-at/data-value and accessible full table keep final real values throughout. First snapshot/scope/domain change snaps.

Pause is explicit input from ProductionLive; effect cancellation must happen on pause even if data reference is unchanged. Parent currently only freezes snapshots, so passing paused/frozen into chart is needed. Native minute aggregate/call exclusions remain unchanged.

## 3. Runway same-period settle and stale presentation

Target overview.tsx QuotaRunway:
```
const periodKey = JSON.stringify([quota?.ownerKey ?? quota?.id,quota?.sourceId,quota?.origin,quota?.window,quota?.resetAt]);
const sampleKey = JSON.stringify([quota?.observedAt,quota?.confirmedAt,quota?.projectedFullAt,quota?.forecastStatus]);
// Fields verified against model.ts:15-31; do not key on now.
const shouldSettle = forecastMotion(previous,acceptedNext);
```

Use prior helper only for newly accepted valid same-period forecast. On valid change, DOM left/width commits final values, then WAAPI animates from previous % to final % using `slow`420ms. Cancel on hidden/offscreen/reduced/pause/unmount or new forecast. Period changes snap and clear stale saved state. Keep presentation last-valid marker for same period on stale, marked stale with existing labelled message; data forecast attributes must not imply current valid forecast. Risk/fill remain synchronized with marker. Do not interpolate reset periods or continuously animate clock-derived ratios. ownerKey is optional, so id is the identity fallback and sourceId/origin remain part of the same-period presentation key.

## 4. Tables/detail trigger integration

Targets sections/history.tsx, redesign/models.tsx, live.tsx, projects.tsx and applicable provider/cost details:
- Hook at region container; stable keys/event_id/exact model-provider tuple remain unchanged.
- First accepted list is baseline. Distinguish accepted fresh-record additions from page/filter/search expansions. Use actual API result epochs/cursor and stable source+record identity; never assume every newly mounted row is a new record.
- Selection changed by keyboard/pointer: existing selected tint transitions `var(--motion-fast)`; selected row/detail receives700ms opacity/tint emphasis only once via `deliberate`. Keep aria-selected/pressed and data-selected committed immediately, focus/restoration unchanged. Existing active selected border remains after transient overlay disappears.
- Reduced: no movement/animation, selected state still static and readable. Avoid opacity0 concealment of data at any duration.

## 5. Alerts real new derivations/history

Target alerts.tsx:
- Snapshot baseline includes risk semantic fingerprints and max observed actual AlertEvent id (validate id monotonicity against daemon schema; if not monotonic, use persisted detection cursor identity).
- Newly derived semantic risk or truly new accepted history record activates one180ms entrance using fast/entrance; use opacity .65→1 plus tiny translation only when motion allowed. Static base labels remain readable. Never use mount animation on every li: filtering/showAll must not replay historical entries.
- Reduced gets final opacity1/transformnone plus existing severity label, no flash. Same accepted fact/fingerprint none; old result rejected by current request key cannot trigger motion.

## Test plan

Pure predicate candidates live in motion89-minute-plan.test.ts. Add actual hook lifecycle tests with injected animation/observer handles or existing test runtime; assert exact durations and handle counts after completion/hidden/unmount. Root must run actual API/SSE browser tests listed in motion89-contract-audit.md before claiming integrated motion contract achieved. These proposal files do not implement or certify that contract.
