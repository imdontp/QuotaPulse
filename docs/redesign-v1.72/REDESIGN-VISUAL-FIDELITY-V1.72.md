# QuotaPulse dashboard fidelity candidate v1.72

## Changes

- Refined the Runtime Map against the source composition: singular column headings, a single-project card without a redundant Projects heading, narrower row spacing, source-like colored node treatments, and a dotted field across the map.
- Harness and provider nodes use readable names for known identities with a raw-name fallback. Project, harness, and provider cards show distinct session counts reported by the selected runtime-map data. Model cards retain proportional token-share bars.
- Added static glow points to the two highest-token visible edges in each adjacent column. Connectors and markers remain tied to observed API edges; the selection is deterministic and contains no invented active/idle state.
- Moved the complete runtime-data disclosure beside the section description so the graph begins at the source-reference position. The table remains keyboard accessible and opens within the section.
- Extended the browser gate to check localized headings and session labels, known-name and fallback behavior, API-backed flow-point selection, existing connector geometry, disclosure interaction, project filtering, and viewport containment.

The production dashboard continues to display real daemon data. Browser capture fixtures are synthetic and in memory.

## Validation

- `npm run build -w @quotapulse/web` passed. Vite continues to report the existing 532.87 kB `App` chunk advisory.
- `npm test -w @quotapulse/web`: **141 passed**.
- The complete en/th × dark/light Overview matrix passed: **4 screenshot pairs, all byte-identical**, without masks. The browser gate also covers 390/900/1280px overflow, Runtime Map keyboard/detail behavior, and API-driven project filtering.
- Source-estimated Runtime Map card x/width bounds remain within the existing ±8px gate. Connector endpoints remain within 1px of their rendered nodes.
- Chromium review viewer smoke test checks current and previous Overview states, the source image, and a carried-forward secondary page.
- Repeatability proves stable rendering, not whole-image similarity. The requested **99–100% source-image likeness remains open**; remaining visible differences and regions continue in the next fidelity pass.

Review the current captures and source comparison in [the v1.72 viewer](reference-review.html). The original reference hashes are in [reference-hashes.json](reference-hashes.json); stable-capture details are in [verification.json](verification.json).

## Local review package

- ZIP: `C:\Users\TH12367283\Projects\QuotaPulse\tmp\worktrees\redesign-foundation\tmp\review-bundles\QuotaPulse-v1.72-phERMG.zip`
- SHA-256: `34c0cf85e5c4c595b18411f36f6c2506d42930fa0f9ad28fed2a8ef0f50d2a60`
- Archive verification passed for **3,135 files** and 448,135,900 uncompressed bytes. Every ZIP entry was decompressed and compared with its tested bundle source; archive size is 201,577,462 bytes and it contains no application profile.
- The Windows x64 review bundle was built with Node v22.13.1 and requires Node ABI 127. It runs with readers disabled, installs no scheduled tasks, and is a local review build rather than a production installer.
- Build and archive manifests are in [bundle-build.json](bundle-build.json) and [archive-verification.json](archive-verification.json).

## Next fidelity pass

Continue with Live Activity and the upper Overview composition, then compare the remaining pages against their references. Keep production values bound to real API data and record any concept details that the API cannot truthfully provide.
