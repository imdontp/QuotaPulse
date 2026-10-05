# QuotaPulse visual fidelity checkpoint v1.78

## Runtime Map activity state

The Runtime Map now distinguishes recently observed activity from older or unavailable activity using the selected graph scope and `usage_event.ts`:

- **Active** means at least one event was recorded in the last five minutes.
- **Idle** means the latest known event is older than five minutes.
- **Unknown** means no usable timestamp is available, including a future timestamp.
- Project nodes show the distinct session count observed in that same five-minute window. Provider nodes show Active, Idle, or Unknown. Idle and unknown connections are visually quieter; flow dots appear only on active connections.

The legend's hover tooltip and accessible description explain that this is activity inferred from records and does not confirm a process is running. The real app continues to use daemon data; screenshots in this report use deterministic synthetic records.

## Validation

- `npm run test --workspace=@quotapulse/web`: **144 passed**.
- `npm run test --workspace=@quotapulse/daemon`: **100 passed**. This includes selected-project isolation and the active-session time boundary.
- `npm run build --workspace=@quotapulse/web`: passed. Vite reports the existing 532.87 kB `App` chunk advisory.
- `npm run build --workspace=@quotapulse/daemon`: passed; the review bundle uses the compiled v1.78 activity query.
- The production-browser Overview gate passed in English and Thai, dark and light: **4 screenshot pairs**, no masks. Three pairs were byte-identical. Thai/light differed by 99 pixels with a maximum channel delta of 2, within the recorded limits of 0.0001 changed-pixel fraction and max channel delta 2.
- Runtime Map assertions passed for all four language/theme combinations: **13 geometry states per combination**, including 390/900/1280px resizing and internal scrolling; measured connector endpoint error was 0px. Each graph reported 44 nodes and 49 edges in the standard fixture. The focused expanded graph inspected 44 nodes, 49 edges, and five detail records.
- Concept asset hashes for all eight source pages match the v1.77 manifest.
- The local Windows review bundle passed **5 extracted-runtime checks** outside the repository dependency tree. It is a review build, not a production installer; it needs an installed matching Node runtime (ABI 127), has readers disabled, and carries no user profile.

Full browser evidence is in [overview-verification.json](overview-verification.json); captures and a local overlay viewer are in this folder. The viewer asset smoke checked all 16 state/language/theme combinations against the unchanged source concept ([viewer-smoke.json](viewer-smoke.json)). The focused Runtime Map run is summarized in [runtime-layout-smoke.json](runtime-layout-smoke.json).

The local ZIP is `QuotaPulse-v1.78-ZtfDWe.zip` (201,580,402 bytes; 3,135 files; SHA-256 `5d91e32287e137a98d229b6c32bd21b321e1ca2073754422c8212c003f595163`). Its build, extracted-runtime, and archive evidence is recorded in [bundle-build.json](bundle-build.json), [bundle-verification.json](bundle-verification.json), and [archive-verification.json](archive-verification.json).

## Fidelity status

This checkpoint improves one concept-specific gap: the Active/Idle Runtime Map legend and session state now have an honest data source. It does **not** meet the 99–100% visual-fidelity target yet. The full dashboard still differs in page chrome, quota detail/denominators, and Pulse Insights content and styling. Those remain the next comparison targets; concept-only ROI, allowances, recommendations, or live process claims remain absent when the daemon has no evidence for them.

Open [the v1.78 comparison viewer](reference-review.html) to compare the original Overview concept with the deterministic app captures.
