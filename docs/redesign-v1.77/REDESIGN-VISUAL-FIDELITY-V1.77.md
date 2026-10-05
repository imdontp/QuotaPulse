# QuotaPulse dashboard fidelity candidate v1.77

## Live Activity and sidebar alignment

- Increased recorded-call waveforms from 12px to 22px so their height and filled trace read more like the source concept. A waveform is rendered only from recorded per-call minute buckets; aggregate session totals keep their explicit no-timeline note.
- Moved and expanded Quick Stats to match the concept's left-rail position. The browser capture measured the card at x=12, y=421, width=191, height=287.5px; the source image is approximately y=423 and 288px high.
- Changed the Overview Top Models share bars to the source's blue-violet ramp while preserving API-derived model names and shares.
- Added browser assertions for the chart's rendered height and data eligibility, the Quick Stats geometry, and the model-bar ramp.

The app still reads production data from the daemon. Review screenshots use a deterministic in-memory fixture. The label remains “Recent sessions” because the API reports recently observed sessions, not processes confirmed to be running.

## Validation

- `npm run build -w @quotapulse/web` passed. Vite retains the existing 532.87 kB `App` chunk advisory.
- `npm run test -w @quotapulse/web` passed: **143 tests**.
- Overview Chromium gate passed in English and Thai, dark and light: **4 screenshot pairs, all byte-identical**, with no masks. It checked real fixture-backed minute buckets, waveform raster placement, sidebar/model-rail styling, Runtime Map geometry, responsive layouts, and keyboard navigation.
- Focused English/dark gate also passed as a byte-identical pair.
- The local comparison viewer loaded current and previous captures, expanded Runtime Map, source images, carried pages, and overlay controls in **7 smoke cases**.
- Source concept hashes are carried forward from v1.76 and remain unchanged. Captures are review candidates, not approved visual baselines.

The 99–100% visual-fidelity objective remains open. Differences remain in page chrome, some quota denominators, the Runtime Map Active/Idle indicators that cannot be safely derived from the project-filtered API, and Pulse Insights styling/content. No unsupported allowance, ROI, recommendation, or activity state is fabricated. Open the [v1.77 comparison viewer](reference-review.html).

## Local review package

The Windows review archive is `C:\Users\TH12367283\Projects\QuotaPulse\tmp\worktrees\redesign-foundation\tmp\review-bundles\QuotaPulse-v1.77-bgq6WJ.zip` (**201,579,514 bytes**, 3,135 files; SHA-256 `a0058e585429bf83f1df497e44368a0d1e4e037243d49e283f618c2368015d6c`). Its archive verification, extracted-runtime results, and limitations are recorded in [archive-verification.json](archive-verification.json), [bundle-build.json](bundle-build.json), and [bundle-verification.json](bundle-verification.json). It is a local review bundle, not a production installer. The bundle requires host Node ABI 127 (built with Node v22.13.1); readers are disabled, no tasks are registered, and no application profile is included. Comparison smoke results are in [viewer-smoke.json](viewer-smoke.json).

## Next fidelity pass

Continue comparing the source and current screenshots, prioritizing remaining page chrome and quota detail differences. Keep the current real-data behavior and treat unsupported data as unavailable rather than filling gaps with concept values.
