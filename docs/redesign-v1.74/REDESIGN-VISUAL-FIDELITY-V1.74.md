# QuotaPulse dashboard fidelity candidate v1.74

## Overview composition changes

- Added a centered forecast sentence beneath the Runway/Reset pill. It uses the selected quota's real forecast and distinguishes projected fill before reset from a forecast that remains within the quota through reset. It is omitted when the quota is stale, unknown, expired, or has no usable forecast.
- Softened the selected quota row outline and fill while retaining a narrow left accent and accessible selected state. Risk labels remain tied to the quota reading.
- Renamed the primary sidebar link to “Models”, shortened the More summary, and changed the sidebar card heading to “Quick Stats”. Removed the repeated visible “This machine” line because the header already reports scope; the recent-session caveat remains available to assistive technology.
- Kept metric labels, values, recent-session semantics, and quota data attached to daemon measurements. Concept-only sample metrics are not inserted into production.

The review captures use an in-memory synthetic fixture; production continues to render real daemon data. Other dashboard pages and their prior evidence are carried forward from v1.73 in this review set.

## Validation

- `npm run build -w @quotapulse/web` passed against the final CSS. Vite reports the existing 532.87 kB `App` chunk advisory.
- `npm run test -w @quotapulse/web` passed: **143 tests**.
- Overview Chromium gate passed en/th × dark/light: **4 screenshot pairs, all byte-identical**, with no masks. The final capture manifest's production index hash matches the production web build included in the review bundle. The gate checked before-reset, after-reset, flat, stale, expired, and unknown forecast states; quota selection; translated navigation labels; and 390/900/1280px layout.
- Local comparison viewer smoke test loaded v1.74 Overview, v1.73 previous, expanded quota, and carried-forward Live screenshots.
- The extracted Windows review bundle passed **5 start/stop checks outside repository dependencies**. The archive verifier decompressed and hash-compared all **3,135 entries**.
- Source concept hashes remain unchanged from v1.73. Captures are review candidates, not approved visual baselines.

The 99–100% visual-fidelity objective remains open. The Runtime Map, page-wide atmosphere, Live Activity waveforms, Quota Runway details, and Pulse Insights content still differ materially from the source. Some concept values, such as a token allowance, productivity/ROI, or real-time activity for aggregate-only harnesses, are not supported by current daemon data; they must remain unavailable unless an authoritative source is added. See the [v1.74 comparison viewer](reference-review.html).

## Local review package

- ZIP: `C:\Users\TH12367283\Projects\QuotaPulse\tmp\worktrees\redesign-foundation\tmp\review-bundles\QuotaPulse-v1.74-EwQnYS.zip` (**201,578,766 bytes**, 3,135 files).
- SHA-256: `9ef9f10b009654413112383de7a5ca05c954284c40aec8aa5b1c577e29087d86`.
- Windows x64; requires host Node ABI 127 (built with Node v22.13.1). Readers and account probes are disabled, no tasks are registered, and no application profile is included. This is a local review bundle, not a production installer.
- Build, archive, and extracted-runtime manifests are [bundle-build.json](bundle-build.json), [archive-verification.json](archive-verification.json), and [bundle-verification.json](bundle-verification.json).

## Next fidelity pass

Prioritize the Runtime Map's flow treatment and page atmosphere, then restore the concept's insight hierarchy using deterministic signals supported by current usage/quota APIs. Resolve the hero's token-total/quota-meter scope relationship. Preserve honest recorded-activity wording, recent-session semantics, and unavailable states where the data cannot support the concept sample.
