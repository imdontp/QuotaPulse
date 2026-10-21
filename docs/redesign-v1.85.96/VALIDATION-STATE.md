# Checkpoint v1.85.96 — accepted-group presence across the dashboard

This is an incremental implementation checkpoint toward the original all-eight redesign. It does not claim 99–100% visual acceptance, a full native/package pass, or a resolved rendering cause. The previous 1.85.95 visual captures and measured repairs remain in [the v1.85.95 review package](../redesign-v1.85.95/review.html); this checkpoint adds no resting-state CSS changes.

## Implemented

- Models and Projects retain bounded accepted-response group presence.
- Providers now apply the same finite player to a newly observed account-owner card. The accepted `overview` response supplies the full owner set; explicit owner interaction cancels only its target presence before existing selection motion.
- Cost model and project tables use the full group arrays from `cost-analysis` as their identity universe and the actual priced top-eight rows as the rendered page. Existing off-page groups promoted by a value change stay static. Null project and model/provider tuple identities remain exact. Cost sessions are server-ranked and limited to ten, so no new-session motion is claimed.
- Initial/dependency/visible/online, context changes, hidden/reduced/offscreen eligibility loss, stale scope responses and unmount follow the shared ledger/finite-player behavior. No new endpoint, polling loop, ingestion timestamp or individual-call claim was introduced.

## Verification bound to the final compiled web index

Index SHA256: `40d3a60697b5ea321dc4fbb51d1c09b8c775f3148a6dae13ba5a7728515fad34`.

- `npm run build -w @quotapulse/web`: exit 0; the existing greater-than-500KB chunk warning remains.
- `npm test -w @quotapulse/web`: **328/328**, exit 0.
- [Compiled synthetic API/SSE browser gate](evidence/aggregate-native.json): 26 stages, no browser errors or forbidden requests, latest `samplingGaps: []`. Cost new model/project rows finish native 180/700ms once through a duplicate response; old Cost group promotion stays static. New Providers owner card finishes native 180/700ms once through a duplicate response.
- The browser gate uses ordinary Chrome 155.0.8059.80 and an isolated in-memory synthetic database. It is not a packaged Electron acceptance run or broad performance proof.
- Source raw/LF hashes and the current web dist inventory are recorded alongside retained 1.85.95 fingerprints.

## Rendering diagnosis remains open

The [style-read RAF run](evidence/raf-style-read.json) and [timing-only RAF run](evidence/raf-timing-only.json) replay the same immediate duplicate scenario on the same build and browser. They sampled 54 and 56 callbacks, with maximum RAF gaps 88ms and 60ms respectively; observed callback self-time never exceeded 1ms. Long tasks reached 102ms and 111ms. This single pair does not causally identify probe overhead or application rendering as the source. Earlier 207ms/124ms failures remain retained in v1.85.95 and are not cleared by these runs. Do not infer a smooth-rendering/performance pass.

## Remaining full-goal work

See [required work](../redesign-v1.85.95/NEXT-REQUIRED-WORK.md): causal repeatable renderer diagnosis; remaining reference-specific visual repairs and human review; full original GAP001–020 and native behavior trace; broad states/locales/viewport matrix; tray/Electron package, matching assets/notices and chunk/native performance; same-fixture previous/current/previous/current rollback verification; final requirement-by-requirement audit. The goal remains active.
