# QuotaPulse dashboard fidelity candidate v1.75

## Overview composition changes

- Added a sparse star field and broad blue/violet lighting to the dark page background and Pulse Core panel.
- Increased the contrast and column color separation of the Runtime Map flow lines while preserving measured graph geometry and static motion behavior.
- Replaced the repeated projected date under the Quota Runway timeline with the consequence: the estimated time the selected quota would reach its limit before reset, or a clear within-quota-through-reset message. Flat, stale, expired, and insufficient forecasts retain their honest states.
- Labeled the compact quota meter by the selected window and displayed its percentage separately from the token total. The quota API does not provide an exact token allowance, so the UI still does not claim a token denominator.
- Added browser assertions for selected-window labels, selected quota percentages, and runway consequences in normal, flat, before-reset, after-reset, stale, and expired cases.

The review captures use an in-memory synthetic fixture; production continues to render real daemon data. Other dashboard pages and their prior evidence are carried forward from v1.74 in this review set.

## Validation

- `npm run build -w @quotapulse/web` passed. Vite reports the existing 532.87 kB `App` chunk advisory.
- `npm run test -w @quotapulse/web` passed: **143 tests**.
- Overview Chromium gate passed en/th × dark/light: **4 screenshot pairs, all byte-identical**, with no masks. The final capture manifest's production index hash matches the web build included in the review bundle. The gate checked selected quota/window changes, translated consequences, stale/expired/flat forecasts, and responsive layout.
- Local comparison viewer smoke test loaded the v1.75 Overview, expanded Runtime Map, and v1.74 previous capture.
- The extracted Windows review bundle passed **5 start/stop checks outside repository dependencies**. The archive verifier decompressed and hash-compared all **3,135 entries**.
- Source concept hashes remain unchanged from v1.74. Captures are review candidates, not approved visual baselines.

The 99–100% visual-fidelity objective remains open. Runtime Map density and legend, the model rail, Live Activity waveforms, several sidebar details, and Pulse Insights hierarchy/content still differ from the source. Current APIs do not support an exact token allowance, productivity/ROI, or real-time activity for aggregate-only harnesses; these values remain unavailable rather than inferred. See the [v1.75 comparison viewer](reference-review.html).

## Local review package

- ZIP: `C:\Users\TH12367283\Projects\QuotaPulse\tmp\worktrees\redesign-foundation\tmp\review-bundles\QuotaPulse-v1.75-1ZOkkv.zip` (**201,579,266 bytes**, 3,135 files).
- SHA-256: `abb495153cac6ecd15b11c63a321b4a5a079ac473a69d6b5067e88c7d521b311`.
- Windows x64; requires host Node ABI 127 (built with Node v22.13.1). Readers and account probes are disabled, no tasks are registered, and no application profile is included. This is a local review bundle, not a production installer.
- Build, archive, and extracted-runtime manifests are [bundle-build.json](bundle-build.json), [archive-verification.json](archive-verification.json), and [bundle-verification.json](bundle-verification.json).

## Next fidelity pass

Align Runtime Map labels and flow semantics with the reference using only relationships represented in the graph, then refine Live Activity signal prominence and Pulse Insights hierarchy with deterministic metrics supported by the current APIs. Continue comparing each capture directly against the unchanged source images.
