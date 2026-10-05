# QuotaPulse dashboard fidelity candidate v1.70

## Changes

- Refined the Overview “Subscriptions & Quotas” panel toward the supplied concept: matched the desktop owner-card width and vertical placement, adjusted card spacing and row heights, and added the localized “Manage” link to Providers.
- Replaced the fabricated number-of-windows chip with an account-state pill. Each pill is derived from the daemon’s current subscription/source status; if the API has no owner state, the UI says Unknown.
- Kept quota usage and reset values bound to actual quota readings. The two reference owners continue to show their available windows; this change does not create or rename readings.
- Extended the browser gate to assert owner identity, account state against `/api/overview`, visible localized status, Manage destination, absence of count badges, estimated source card bounds, quota history identity, keyboard scrolling, and narrow viewport overflow.

The production dashboard remains daemon-backed. Screenshot checks use a synthetic in-memory fixture and do not write concept values to a user database.

## Validation

- `npm run build -w @quotapulse/web` passed. Vite retains its existing advisory that the `App` JavaScript chunk is 532.87 kB, above the 500 kB suggestion.
- `npm test -w @quotapulse/web`: **141 passed**.
- One intermediate full-matrix replay varied by 187 pixels (maximum channel difference 2). Image-region analysis placed all changes outside the quota panel: 163 were on the Runtime Map and 24 around the Pulse Core glow. The isolated Thai/light replay and the subsequent complete matrix both passed; the final four pairs are byte-identical. No mask or tolerance change was made.
- The complete English/Thai × dark/light Overview repeatability matrix is recorded in `verification.json`: **4 pairs, all byte-identical**, within the existing maximum channel delta 2 and changed-pixel fraction 0.0001, without masks. This gate tests repeatability and behavior; it is not a whole-image similarity score.
- Quota behavior checks cover both displayed owners, their API states, all recorded quota rows, history identity, keyboard scrolling, and 390/900/1280px overflow. The source-card geometry check uses raster-estimated reference bounds with explicit tolerances; it does not certify pixel-perfect composition.
- The v1.70 viewer has fresh Overview and quota/runtime interaction captures. Secondary pages carry forward from v1.69’s review set (whose secondary captures originated in v1.68). Source image hashes remain unchanged in `reference-hashes.json`.

The requested **99–100% likeness has not been reached**. This pass improves only the quota-card region and keeps account status honest; the central Pulse Core, Runtime Map, Quota Runway, Pulse Insights, and Live Activity still need further source-by-source refinement. A passing repeatability gate is not visual acceptance. Use [the source comparison viewer](reference-review.html) to review the captures.

## Next fidelity pass

Continue through the remaining Overview regions, next comparing Quota Runway and Pulse Insights against their source crops. Keep real API data, missing/unknown semantics, localization, and responsive behavior intact while tuning their layout, color, typography, and visual hierarchy. Keep pet/popup work out of this dashboard redesign.

## Local review package

- Review ZIP: `C:\Users\TH12367283\Projects\QuotaPulse\tmp\worktrees\redesign-foundation\tmp\review-bundles\QuotaPulse-v1.70-ZZmkks.zip`
- SHA-256: `ea72bad5fb6c73f8cb8f686610232d7084af0b788470e84798b946b0db44d185`
- Archive verification passed for **3,135 files**, 448,129,792 uncompressed bytes. Every ZIP entry was decompressed and hash-compared with its tested bundle source; the archive is 201,576,158 bytes and contains no application profile.
- The Windows x64 review build has readers disabled, installs no scheduled tasks, and starts with a fresh empty review database. It requires an installed Node runtime with ABI 127 (built with v22.13.1). It is for local review and testing, not a production installer.
- Build and archive manifests are in [bundle-build.json](bundle-build.json) and [archive-verification.json](archive-verification.json).
