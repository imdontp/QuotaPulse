# QuotaPulse dashboard fidelity candidate v1.67

## Changes

- Align the synthetic Overview fixture with the supplied dashboard reference: the monthly QuotaPulse focus, five named top models and token shares, subscription owners and their published windows, the selected monthly runway, and the Runtime Map scope. Machine-wide quick stats retain their separate five-project, six-model, four-provider and twelve-session totals.
- Keep those sample values confined to the in-memory browser verification database. The running app continues to read daemon/API data; no concept values are written to a user database or production defaults.
- Render every published quota window on the provider owner cards and default provider comparison to monthly. Reader diagnostics remain available in the health table and owner inspector.
- Make Alerts fit the desktop reference viewport while retaining the scrollable risk list and threshold history. The browser fixture crosses 50% and 80% through the daemon alert recorder using earlier and current readings.
- Derive History row expectations from the API's current filtered total, so additional real project records do not make the capture gate brittle.
- Preserve exact Claude maker resolution for space-separated display names in both TypeScript and SQL vendor classification.
- Normalize focus and pointer state before repeated captures to avoid carrying hover/focus paint across routes. No pixel masks were introduced.

## Validation

- Web, daemon and tray production builds passed. Vite still reports the existing `App` chunk above 500 kB.
- Web tests: **137 passed**. Daemon tests: **99 passed**.
- Production browser capture gate: **40 screenshot pairs / 80 screenshots** across Overview, Live, Projects, Providers, Models, Cost, History, selected History detail, Alerts and Settings in English/Thai and dark/light. **39 pairs are byte-identical**. `alerts-en-light.png` differs by 5 pixels at maximum channel delta 1, within the unchanged delta-2 / 0.0001-pixel-fraction tolerance. No masks were used.
- The gate verified the expected API-backed fixture values, keyboard/detail behavior, responsive widths (390/900/1280), local-only requests, and no browser errors. The fixed capture date is 2025-05-17 20:42 Asia/Bangkok.
- Source reference hashes are preserved in [reference-hashes.json](reference-hashes.json). Captures, repeat images and the complete machine-readable report are in this folder. Use the [side-by-side and overlay viewer](reference-review.html).

Repeatability is not source-image similarity. **The 99-100% visual acceptance target is still open.** The Dashboard toolbar/workspace controls and several glow/detail treatments remain visibly different. Providers and Alerts also have substantial composition differences because the source concept shows provider/API-key and forecast/action information that is not present in the daemon's real account/quota data. Production content remains honest to available API values; this checkpoint does not fabricate those fields.

## Local review package

- Windows review ZIP: `tmp/review-bundles/QuotaPulse-v1.67-vnD9Hp.zip`
- SHA-256: `545c2bcbf0a9f2dac9e3317c8962d43af6cb4e6fa049fcf0c81a01396fdcaa14`
- Archive verification passed for all **3,135 files**; the ZIP is 201,573,593 bytes. It contains no app profile. It requires external Node ABI 127 (Node 22.13.1 was used to build it); readers and account probes are off, so a new install starts with empty usage.
- Build and archive manifests are in [bundle-build.json](bundle-build.json) and [archive-verification.json](archive-verification.json). This is an unsigned local review build, not a production installer.

## Next fidelity pass

Prioritize the Dashboard's top toolbar/workspace/search treatment against the source image, then compare the Overview's remaining card labels, visual density and map glow region by region. Keep real daemon fields and current API semantics. Continue excluding pet and popup redesign.