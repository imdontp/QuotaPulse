# QuotaPulse dashboard fidelity candidate v1.76

## Runtime Map and Pulse Insights

- Added a compact Token Flow legend. Runtime edges now encode each observed connection's share of tokens in that graph column through stroke width; color still distinguishes graph columns. No Active/Idle status is shown because current graph data does not reliably attach recent activity to a project-filtered flow.
- Reordered Pulse Insights around measured signals: average token pace, cache efficiency, reported pricing coverage, and records without cost. Pace uses the selected usage range and reflects the selected quota's measured risk state; cache savings appear only when the source reports known cache-price components.
- Added a small-screen Runtime Map controls wrap after Chromium found the new legend made its controls 340px wide inside a 288px header at 390px. The map's 1040px canvas remains contained by its horizontal scroller.
- Added browser regression assertions for token-share stroke widths, translated Token Flow labels, data-matched pace/cache values, and mobile shell width diagnostics.

The review captures use an in-memory synthetic fixture; production continues to render real daemon data. Other dashboard pages and their prior evidence are carried forward from v1.75 in this review set.

## Validation

- `npm run build -w @quotapulse/web` passed. Vite reports the existing 532.87 kB `App` chunk advisory.
- `npm run test -w @quotapulse/web` passed: **143 tests** before the final responsive CSS-only correction; the final source also passed the production TypeScript build.
- Overview Chromium gate passed en/th × dark/light: **4 screenshot pairs, all byte-identical**, with no masks. It checked map token-share widths and screen-space edge geometry, selected-window/runway states, Insights values against API data, responsive layouts, and keyboard paths. A targeted en/dark run independently reproduced and then passed the original 390px overflow check after the controls wrap fix.
- Local comparison viewer smoke test loaded v1.76 Overview, expanded Runtime Map, expanded quota, and v1.75 previous capture.
- The extracted Windows review bundle passed **5 start/stop checks outside repository dependencies**. The archive verifier decompressed and hash-compared all **3,135 entries**.
- Source concept hashes remain unchanged from v1.75. Captures are review candidates, not approved visual baselines.

The 99–100% visual-fidelity objective remains open. The concept's Active/Idle Runtime Map status cannot be mapped reliably onto a project-filtered graph from current data. Page chrome, token-denominator details, Live Activity waveform prominence, model rail details, and recommendation styling/content still differ. No unsupported quota allowance, ROI, AI analysis, or project activity state is fabricated. See the [v1.76 comparison viewer](reference-review.html).

## Local review package

- ZIP: `C:\Users\TH12367283\Projects\QuotaPulse\tmp\worktrees\redesign-foundation\tmp\review-bundles\QuotaPulse-v1.76-SMSVKB.zip` (**201,579,484 bytes**, 3,135 files).
- SHA-256: `4d2c18d01f78dfe8b9b1e2a191eb12e41fd2b6e3cac9686fb73c22bccfe3ba1b`.
- Windows x64; requires host Node ABI 127 (built with Node v22.13.1). Readers and account probes are disabled, no tasks are registered, and no application profile is included. This is a local review bundle, not a production installer.
- Build, archive, and extracted-runtime manifests are [bundle-build.json](bundle-build.json), [archive-verification.json](archive-verification.json), and [bundle-verification.json](bundle-verification.json).

## Next fidelity pass

Refine Live Activity waveform height/contrast and match the visible sidebar/model-rail details more closely. Reassess whether a project-scoped activity API can support the reference's Active/Idle Runtime Map legend without conflating global activity with the selected project. Keep checking current, previous, and source captures side by side.
