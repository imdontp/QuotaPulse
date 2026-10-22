# Live provider/model minute panel v1.85.114

Status: partially validated. This checkpoint improves the right-hand Live panel's source composition, color and decorative artwork. It does not establish whole-dashboard99–100% fidelity or release acceptance.

## Implemented

- At panel widths≥281px, provider/name/total columns reserve space for the actual minute strip; gaps between its cells reduce from2px to1px. The canonical six strips move from x1439.984 to1429.406 and widen150 ->161.578px. Each cell widens2.891 ->4.234px without dropping observations.
- Actual range timestamps align with the strip. One visible Window total heading replaces repeated visual captions on wide rows; each row retains its accessible scope text, exact raw total, all-grain coverage title and existing selection label. Narrow fallback retains individual captions. The current-minute note stays available to assistive readers when space is tight.
- Dark-theme recorded cells follow the source's cyan/blue/violet/orange progression, using the same actual intensity. Missing, zero and partial data retain their distinct states; light-theme colors are retained.
- A static2859-byte SVG reproduces37 decorative blue points and the lower field sampled from the source's text-free lower panel. It contains no text, chart observations or animation, and paints only the native-width dark panel background. Full extraction coordinates/generator are retained.
- Provider names stay in DOM/title when their narrow brand plate ellipsizes, avoiding a trailing letter on its own line.

Product files: [live-minute-strip.tsx](../../packages/web/src/redesign/live-minute-strip.tsx), [live.css](../../packages/web/src/redesign/live.css), [native vector atmosphere](../../packages/web/src/redesign/assets/live-matrix-atmosphere.svg). No dependency, API, database, sorting, time scope, filter callback or data calculation changed.

## Evidence and validation

- Fresh before capture uses the unchanged113 compiled application. All six group identities/labels/totals and all186 minute cells match after the edit: timestamp, missing/zero/recorded state, tokens, records, calls, partial flag and intensity are exactly equal. The observation window still contains31 intersecting one-minute bins; no missing usage is filled in.
- Web TypeScript/Vite build passes. The existing large lazy legacy-App chunk warning remains.
- Existing Live stable gate passes EN/TH × dark/light with four byte-identical pairs and unchanged tolerances/masks. Eight recorded minute-data checks and four refresh-race/recovery checks pass, including real API matching, selection/filter/clear, keyboard, responsive, paused/retained and late-response behavior. This gate uses its existing renderer flags.
- Eight native Chrome edge cases (EN/TH × dark/light ×390/1672) pass against the real isolated API with unknown/call/aggregate records, long/null/empty identities, large/zero totals and keyboard scrolling. No browser errors or external/write requests. This is the existing compiled-feed regression rerun against the changed panel, including its page-overflow guard.
- All-eight canonical EN dark immediate repeat pairs are exact. Recorded shell/main/heading geometry equals113. Live changes96169 pixels inside its right panel at x1289–1659/y482–925; its left session/chart/feed area is byte-identical. Other unmasked controls remain open: Overview22 sidebar/max35, Projects20 sidebar/max35, Models2 sidebar/max3, History24 sidebar/max35, Providers130 header/max3. Alerts and Cost match113 exactly. No raster cause is inferred or threshold relaxed.
- The fixed decorative-only source region x1300–1649/y902–926 has RGB mean absolute error1.7587 ->1.6553. This small local background improvement does not measure whole-page similarity or prove99–100% acceptance. Raw coordinates, pixels and unmasked comparisons are published.

Current compiled web index: `846cf0b7fce6ace26bf83afe671c6a298c44443c18000cf74a207e486ffd8020`. All current evidence is bound to this hash. Native motion16-stage proof belongs to113, and the655/655 repository result belongs to110; neither is presented as freshly rerun here.

## Remaining work

A fresh87-package Windows x64 review bundle passes five real daemon/tray start/WhatIf/stop/restart checks on a copy outside repository dependencies, with a fresh empty profile and readers disabled. Every3155 ZIP entries were decompressed and SHA256-compared with that bundle. Archive206479699 bytes, SHA256 `09b171e0130b0477d01fc22bda1f07f37b3cabf13aeb6375d206bcf85e9b2a93`; its web index matches the hash above. This unsigned review requires external Node ABI127. It does not embed a user profile or prove a newly unzipped installation, populated native dashboard or actual two-version rollback.

[Compare original /113 /current](review.html). The [approved20-row trace](../redesign-v1.85.109/REQUIREMENT-TRACE.md) remains partial. Broader all-eight reference review and human acceptance, current full native/error/settings/persistence coverage, data-scale/resource work and actual previous/current version installation rollback remain open. The historical Models Thai-dark ring and raster control failures remain open.

Main/origin configuration, old installation, prior review bundles and user data are preserved. Tests use isolated synthetic data through the real compiled API/UI. Published text is UTF-8/LF with trailing spaces removed; PNG bytes are retained and reused only after exact full-hash equality with the new capture.
