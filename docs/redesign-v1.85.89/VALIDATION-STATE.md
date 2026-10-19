# v1.85.89 — Live minute motion and exact-project Runtime observations

Status: **Validated for the bounded changes below. Full redesign remains incomplete.**
Parent checkpoint: 11cc8bbd7f30c7f8a69e8607c408d8717781a28f (v1.85.88).
Compiled web index SHA256: `82414e769d0e10ef458703ef68adea2207310f2d7abae8c4460c05a5cbd7dabd`.

## Delivered

- Live common changed real readings interpolate for180ms using the existing fast duration/easing and finite SVG SMIL. Current base attributes, accessible values and table show accepted actual data. No new polling, dependency or fabricated series. Scope/domain/new/missing/unknown changes snap; axes never tween. Pause/reduced/offscreen/visibility cancel, restoration seeds without replay; completed and unmounted handles are removed.
- Exact selected-project Runtime graph and latest-per-harness observations are accepted together. Global recent activity remains independently global. A newer B call cannot hide an A observation under selected A. Coalescing remains deliberate; not every ingested record is queued.
- New project contexts show existing loading/error regions without foreign topology. Same-context refresh/failure retains only its own accepted graph. Settled503 clears aria-busy; obsolete requests cannot overwrite another project. Existing refresh control is reused.

## Causal browser finding and correction

The first native-wide400→500 browser check failed with zero animate handles. Instrumenting real IntersectionObserver found the observed root was display:contents at the native breakpoint: box0×0 and isIntersecting=false while its graph was visibly painted. The root observer could therefore never enable motion. The correction observes `.qp-live-flow-canvas`, a real box at all breakpoints. Its actual native box measured792.40625×104 and intersected; the same400→500 check then observed seven finite handles and intermediate circle animVal values. This fixes a demonstrated eligibility cause; it is not a raster correction.

A later harness assertion incorrectly expected an API refresh while document.hidden=true. The existing shared controller intentionally suspends hidden refreshes. The corrected gate asserts retained700 while hidden, then real visible refresh725 with no replay, followed by a new775 update that animates. Production refresh policy was unchanged. A project harness GET initially used an unsupported Bearer header and got401; it was corrected to the actual x-quotapulse-token header, retaining status200 and newest-row assertions. Red logs are preserved with line endings normalized to LF and trailing whitespace removed.

## Validation and limits

- Final Runtime source integration passed564 repository tests:121daemon+245web+198tray, terminal0. This full run preceded the last canvas observer correction. After that correction: final web typecheck/build0; focused chart tests15/15; the original compiled browser failure and surrounding lifecycle checks pass. No claim of a second final full-suite rerun.
- Minute Chrome155 gate: actual synthetic memory API/SSE; common changed SVG ordinate samples, stable axes/anchor, finite180ms cleanup, duplicate, active pause cancellation/freeze, resume, reduced preference, real intersection loss/return, explicitly emulated document visibility suspension/return, maximum replacement, model scope change, same-document unmount. Page errors and forbidden external/write requests empty. Native minimize/hide is not proven by emulated visibility.
- Project Chrome gate: A then globally newer B in same harness; global newest API row is B while selected A signals A. Held B loading exposes no A/global nodes; A remains correct after late B. Same-context503 retains A with busy=false; new-context503 exposes no foreign nodes; recovery and project switches pass. A subsequent stronger gate also passes same-parent-serial A→B→A: a fetched old A response is held, B accepted, A updated without SSE, fresh A accepted, and obsolete A released without replacing its newer tokens. Real error-region Retry issues POST /api/refresh200 against the empty-adapter synthetic daemon and recovers the selected B graph. This gate does not instrument general browser page errors/external requests; the minute and layout gates do.
- Existing compiled Runtime/Pulse regression passes: actual700ms known-edge movement and expiry, aggregate revisions node-only, duplicates, reduced static, real offscreen loss/return, held overview/selected-graph eligibility races, stale/unknown quota orbit gating and same-document unmount. Synthetic data only; no adapter/native release claim.
- The final independent review approves the bounded source change and verifies the canvas diagnosis and runtime evidence; its last script hash predates the final stronger ABA/Retry harness additions, which root reviewed. The earlier independent source review was conditional on root runtime checks. It predates the causal canvas correction and does not independently certify that correction. Root diff review found the canvas substitution keeps rendering/geometry and observation cleanup unchanged.
- Settled Overview EN/TH × dark/light layout gate terminally passes four pairs: three byte-identical, one within unchanged maxChannelDelta10 / maxChangedPixelFraction0.00005, no masks. Raw first/repeat PNG hashes are independently verified and archived; see `evidence/layout-summary.json`. They are repeatability checks, not original-Source visual acceptance.

## Continue

See [required remaining work](NEXT-REQUIRED-WORK.md). Original eight-page99–100% perceived likeness, final human acceptance and actual release/rollback/native gates remain open. Historical Models/Projects raster failures remain unresolved; no whole-redesign completion is claimed.
