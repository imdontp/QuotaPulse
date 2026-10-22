# Live recorded feed v1.85.113

Status: partially validated. The actual Live feed now follows the supplied reference's aligned row composition while retaining recorded usage facts. This is not whole-dashboard99–100% acceptance or a completed release.

## Implemented

- Separate columns for time, record grain, harness, provider, model and localized tokens replace the combined metadata span. Existing offline harness/provider marks identify the actual tools and providers.
- Visible time includes seconds; the full localized date/time remains in its title and accessible label, with the exact recorded ISO timestamp in the time element.
- Call, session-aggregate and unknown records have distinct labels/icons. This also fixes the previous incorrect fallback that labelled every non-call record as aggregate. The real API's `USAGE_GRAIN_SQL` explicitly returns unknown for unrecognized adapters.
- Full identities remain in DOM/title when a column ellipsizes. Null and empty strings remain different. Existing Intl.NumberFormat token formatting is retained, including its default fractional precision; no compact K/M formatting is introduced. Narrow views scroll the feed itself using the keyboard; the page does not expand horizontally.
- Feed identity keys, order, scope, pagination, session selection, paused/retained data and the existing motion ledger are retained. The design does not introduce unsupported session-start/completion/queue events.

Product scope: [live.tsx](../../packages/web/src/redesign/live.tsx), [live.css](../../packages/web/src/redesign/live.css). Browser coverage: [API-to-UI parity in the existing gate](../../scripts/check-stable-captures.mts), [new actual-API edge-case regression](../../scripts/check-live-feed.mts). No dependency, database schema or API contract changed.

## Verified against the compiled app

- Web TypeScript/Vite build passes. Existing large lazy legacy-App chunk warning remains.
- `QUOTAPULSE_CAPTURE_SCOPE=live node --import tsx scripts/check-stable-captures.mts`: EN/TH dark/light all four repeat pairs are byte-identical, using the gate's existing renderer flags and unchanged tolerances. Actual API feed fields match the UI; six complete rows fit the canonical viewport. Pagination restores the same rows, keyboard access reaches the last record, filters/search/selection and narrow layouts pass. Existing stale/held-response/pause recovery and token-flow/minute checks also pass.
- `node --import tsx scripts/check-live-feed.mts`: eight native Chrome cases (EN/TH × dark/light ×390/1672), against an isolated real API with three synthetic records, pass all three grain labels, exact null/empty/long identities, large/zero token values, timestamps and keyboard horizontal scrolling. No browser errors or external/write requests. These synthetic records contain metadata, not user prompts or credentials.
- `node --import tsx scripts/check-models-live-motion.mts`: all16 recorded stages pass on the same compiled index. Actual native180/700ms observed session/feed presence, explicit selection/detail, duplicate no replay, pause/resume, reduced motion, offscreen-held response and unmount/restore eligibility retain their existing checks. This is an isolated API/SSE browser run, not actual packaged desktop minimize/restore proof or a whole-app performance guarantee.
- Fresh all-eight canonical EN dark immediate repeat pairs are exact. Recorded shell/main/heading geometry equals112 across all eight pages. Live differs33531 pixels, entirely inside its feed at x249–1266/y811–922. Overview/Alerts/Providers match112 exactly. Unplanned controls remain: Projects20 sidebar pixels/max35, Models2 sidebar pixels/max3, History2 sidebar pixels/max2, Cost22 sidebar pixels/max35. No masks/thresholds changed and no raster cause is inferred from these observations.

Compiled web index: `50c64a38529293a09431d9ae047c391af4609185247131b3472de4bab653a508`. Current results are bound to this hash. The old655/655 repository result belongs to110; no new full-suite run is claimed for113.

## Review and remaining work

A fresh87-package Windows x64 review bundle passes five isolated real daemon/tray start/WhatIf/stop/restart checks outside repository dependencies. It uses a copied built directory and fresh empty profile with readers off; this is not a populated real-data UI or freshly unzipped installation acceptance. Every3155 ZIP entries were decompressed and SHA256-compared with the bundle directory. Archive206478549 bytes, SHA256 `417d7d9cffcc7e024ab4402a8470ffbb7b98ff26901ce2e7e73a3d4570f0a7ce`. Its web index equals the hash above. The unsigned review requires external Node ABI127; Node and user profiles are not embedded. Production installation and actual two-version rollback remain open.

[Original/before/current all-eight comparison](review.html). Concept lifecycle/latency/productivity figures remain illustrative; the application uses available recorded facts. Current feed screenshots are synthetic API fixtures for repeatable comparison, not a copy of the user's database.

The provider/model minute strip still needs source-aligned sizing with its actual bucket scope preserved. Broader art/type/material/layout/action work, full current native/error/settings/persistence matrix, large-data/resource work and actual previous/current installation rollback remain open in the [approved20-row trace](../redesign-v1.85.109/REQUIREMENT-TRACE.md). Historical Models Thai-dark ring and raster control failures are not cleared by this Live gate.

Main, origin configuration, prior review bundles, unrelated untracked files and user data are preserved. Published text evidence is UTF-8/LF with trailing spaces removed; PNG bytes are retained. Earlier PNGs are reused only when their full hash equals the actual new capture.
