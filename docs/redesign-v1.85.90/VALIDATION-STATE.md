# v1.85.90 — Runway forecast presentation

**Validated bounded implementation. Full redesign remains active.**
Parent: f70c11dc7035765cb41657b321e36facb9069800 (v1.85.89).
Final compiled index SHA256: `bd893ce7318f4fa9a7a1911b97ffd53b8f7201c3e008ae37c298f421aa19f3af`.

## Delivered

- Same exact valid owner/reader/provider/window/reset-period forecast changes settle fill/risk/marker with shared420ms/easing and one native animation. Final inline styles/labels always describe the accepted projection. Initial, clock-only/confirmation-only, reset/context replacement and stale recovery snap.
- Same-period stale data freezes only an actual last-valid marker and its original forecast/clock, with visible EN/TH stale/snapshot labels. The core does not promote that stale data into a valid default. If automatic default disappears from freshness but its exact quota remains present, only Runway may retain that same stale presentation. Different owner/source/reset, missing quota, unknown/reset state or removed reading clears/replaces it.
- Semantic route scope resets retention; locale and rolling clock boundaries do not define identity. No new polling, SSE, dependency or fabricated forecast. Visibility/intersection/reduced/unmount cancellation uses native handles and existing preference/duration tokens; no app frame loop/timer.

## Review findings corrected before acceptance

1. Localized period text originally formed the component key, discarding a stale snapshot on language switch. Production now passes stable semantic routeKey through runwayScopeKey. Actual EN→TH→EN changes preserve the same stale marker.
2. A new presentation object in every animation-effect dependency cancelled the420ms animation on unrelated map/history renders, then found no new forecast to restart. Animation replacement now depends on semantic kind/context/sample plus actual eligibility changes. A separate committed-render effect records truthful clock-only projections without cancelling/replaying the current tween.
3. The first browser assertion used the track border box to infer final CSSleft. Its border mismatch could classify a settled endpoint as an intermediate position, and configured420ms alone did not prove runtime duration. That weak interim pass is **not accepted as420ms evidence**. The final gate compares actual observed endpoints, requires three distinct interior positions, and samples native animation.currentTime/playState through350–420ms. The reviewer retained the defect and weaker proof interpretation in evidence/runway90-review.md; earlier raw verification JSON was overwritten, and earlier console pass logs do not establish420ms behavior.
4. The initial fixture had only two same-period readings over4.5minutes, correctly yielding insufficient forecast. Added a third actual synthetic reading spanning30minutes to satisfy the existing API's minimum3samples/15minutes; production forecast rules were unchanged. Initial red log is preserved.

## Final validation

- Final web typecheck/build0. Final web tests **254/254**, terminal0, including9 new pure presentation/native-handle lifecycle tests. Daemon/tray source is unchanged; no new full-repository test run or whole-release pass is claimed for90.
- Final actual compiled Chrome155 + synthetic memory DB/API/SSE gate terminal0.31 real frame samples,12 distinct computed marker positions; all three native timelines remain running through416.6ms then release to idle. Configured duration420ms, one iteration, fillnone; at least three positions lie strictly between actual prior/final endpoints.
- Clock-only/duplicate projection does not replay; reduced new forecast is immediate. Automatic fresh-default loss freezes the last valid same quota while Core becomes idle; EN/TH/EN preserves it. A new reset replaces the old period without backwards tween. Explicit stale selection retains only its own snapshot. DELETE of selected quota's limit_sample rows clears the track; this proves missing quota-reading handling, **not deletion of source/reader configuration**.
- Gate records no page errors. It uses synthetic rows and empty adapters, not customer records or native minimize/release behavior. Active cancellation variants for every visibility boundary and actual native lifecycle remain broader acceptance work; helper lifecycle tests alone do not certify them.
- Independent final source/evidence review approves this bounded change after resolving both concrete source findings. Final post-fix web tests were independently read by root; reviewer explicitly did not infer their result before terminal completion.
- No new settled all-eight/Source visual gate was run for90.89 Overview4 repeats remain historical;90 new browser evidence is a functional forecast gate, not99–100% visual approval. The removed-quota PNG is a diagnostic final state, not an accepted design baseline.

## Continue

[Next required work](NEXT-REQUIRED-WORK.md). Original eight-page fidelity, table/Alerts motion, actual native/release/rollback and final human acceptance remain open. The historical Models/Projects raster findings and unbounded whole-aggregate payload are not resolved by this checkpoint.
