# Current motion acceptance and native select diagnosis / checkpoint170

Status: **Partially validated**. Application source remains `68d2f673cf461845c1c60b74c785ba3e08adeb43` (source169). This checkpoint changes two test helpers and records current-build evidence; it does not change application rendering or claim complete motion/performance acceptance.

## History select: one-pixel position, not a different font

The selected text in the previously differing History frames has178 thresholded ink pixels in each image. Translating one text ROI down by exactly1px makes all RGB bytes identical (zero changed pixels). Chrome reports custom Geist for the actual select and identical computed font/option font and control bounds. The former description of a font change is superseded: the observed difference is vertical glyph placement.

A self-contained probe covering preload, delayed font loading and disabled-during-load, with native and CSS appearance, produced identical output for each matching appearance. Simple font-load timing did not reproduce the issue. Eight fresh real-page native → experimental CSS appearance/line-height → restored-native comparisons were also stable within and across contexts. Both native and styled cases were stable; this does **not** establish a CSS fix. No appearance or font workaround was applied to production. The prior intermittent1px shift remains observed but unreproduced in that batch; its deeper cause remains unknown.

## Current compiled motion evidence

All checks use the same source169 compiled index, real local HTTP/SSE and owned in-memory synthetic databases. Scheduler notifications are explicitly emitted by the test, and any visibility signal emulation is labelled in the underlying proof. Drivers share a local port and were run sequentially. No main database, provider account, new worktree or native runtime extraction was used.

| Driver | Current outcome | Scope and limit |
|---|---|---|
| Runtime/Pulse |PASS|Observed new-call700ms effects; aggregate/duplicate behavior; held-response eligibility races; reduced/offscreen/idle/stale/unavailable; same-document unmount. Uses its existing deterministic/software-rendering arguments; no physical GPU/native minimize claim.|
| Runway |PASS|Actual420ms marker, clock-only no replay, reduced immediate update, stale freeze, selection/default loss and reset replacement.|
| Models/Live |PASS|Actual selected row/detail180/700ms effects, held detail response, repeat selection, reduced motion and Live record behavior.|
| Projects/Runtime/Providers |FAIL default visual-sampling gate|Native effects can finish at exactly180/700ms while required near-end/interpolation RAF samples are missing. One profiled anti-backgrounding experiment passed the complete driver, but its unprofiled repeat failed; this is not a validated fix.|
| History/Alerts |FAIL visual-sampling gate|Required near-end180ms RAF sample missing in History. The driver stops there, so later Alerts/History lifecycle helpers are not claimed passed in this run.|
| Live minute |PASS|Changed-point interpolation, stable axes, finite cleanup, pause, reduced/intersection, explicitly emulated visibility, scope and unmount.|
| Aggregate presence |PARTIAL|Exact finite native durations, identities, accepted-snapshot/lifecycle semantics and updated shared navigation pass. Final default-renderer run records8 visual sampling gaps; `visualSamplingComplete` is false despite process exit0. This is not a full visual-motion pass.|

The Projects collector previously stopped after1000ms wall time while700ms effects still had native currentTime≈442ms. It now keeps sampling running native effects within its existing12s deadline. All duration, finish, interpolation and near-end assertions remain. A subsequent failure is correctly reported as missing visual samples, rather than a premature idle-state assertion.

The aggregate presence helper still asserted the obsolete More submenu and its original quick-stats position. It now enforces approved OVR-001/source166: nine stable direct destinations, current page, direct sibling access, common plate width, nonoverlapping hit areas, Tab/focus access to all destinations at1672/390/900, no document overflow, Quick Stats below navigation, and the previous Providers empty-grid-gap invariant. Motion assertions are unchanged. The old More behavior is intentionally superseded by the approved shell contract.

## Performance investigation and remaining work

One sampled Projects interval lasted1414.6ms, with1191.9ms attributed to the profiler's `(idle)` entry, plus a112ms buffered long task. This is a sampled renderer profile, **not** operating-system CPU utilization or proof of root cause. It does not support blaming sustained application JavaScript as the sole cause of the missing frames. Disabling Chrome background throttling produced a single passing profiled experiment but failed repeat validation and left aggregate sampling gaps. Those experimental flags were removed from the shipped test defaults. No sampling assertion or image region was masked to make the checks green.

Next: inspect frame scheduling/render traces and distinguish real rendered smoothness from observer/environment limits, then resolve the missing samples before closing motion/performance acceptance. Continue the remaining original-ref typography/art/control-state work in source169's inventory. Physical monitor/tray/native lifecycle, a reviewed concept-plus-overrides baseline, Cost projection eligibility and actual two-version upgrade/rollback remain open. Native review167 still contains source166 and excludes source168/169. The overall goal remains active.

Evidence hashes and executed-driver source hashes are in `manifest.json`. Large traces/JSON are compressed; helpers and paired experiments are retained for reproduction. Run `node --import tsx scripts/<driver>.mts` from the active worktree. The two failing default visual gates above are expected unresolved findings, not certified successful tests. No web build/unit rerun was required for these test/document-only edits; source169's build/375-unit/144-responsive evidence remains the latest application validation.
