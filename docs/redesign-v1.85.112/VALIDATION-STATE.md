# Overview quota palette v1.85.112

Status: partially validated. This checkpoint changes the real dashboard's quota colors to follow the supplied Overview reference. It does not establish whole-page99–100% fidelity or release acceptance.

## Product change

- The quota owner group publishes its existing provider identity as a DOM data attribute. Owner keys, account state, quota values, freshness, selection, reset times and handlers are unchanged.
- Production Overview dark theme uses violet for OpenAI5h/monthly, cyan-to-blue for OpenAI weekly, teal for OpenCode monthly and blue for OpenCode daily. OpenAI percentages use the reference's pale foreground; OpenCode percentages follow their window accent.
- Risk labels keep their separate warning/critical colors and text. Selection remains visible. Unknown providers/windows retain the existing fallback gradient; light theme and existing popup are outside the dark production selector.
- Scope is two application files: [overview.tsx](../../packages/web/src/redesign/overview.tsx) and [overview.css](../../packages/web/src/redesign/overview.css). No dependencies, API contract, capacity, price, fixture numbers or progress calculation changed.

## Reference evidence

A fresh before capture used the unchanged v1.85.111 application, the same isolated factual API fixture and the Date-only test helper. All five quota rows have exactly equal text, aria label, selected/stale attributes, bounding rectangles, fill rectangles and inline percentage widths before/after. The resulting Overview image differs only in4139 pixels within x1332–1443/y159–447, the quota numbers/fills.

Five fixed interior centerline samples per reference fill are compared at15/30/50/70/85% of its measured visible width. The supplied raster's coordinates and raw RGB values are retained in `evidence/color-analysis.json`; samples avoid rounded caps. This is an aligned color-strip observation, not a page similarity score or evidence of matching layout/content.

| Window | Before RGB mean absolute error | After |
| --- | ---: | ---: |
| OpenAI5h | 43.67 | 7.07 |
| OpenAI weekly | 16.93 | 5.47 |
| OpenAI monthly | 49.40 | 4.07 |
| OpenCode monthly | 73.40 | 8.00 |
| OpenCode daily | 21.20 | 8.60 |

The first diagnostic daily sample was at y451, the rounded/bottom edge. It was corrected to the fill centerline y448 before this table was generated; the analysis script records the final coordinates explicitly. No production adjustment was selected from that mistaken edge sample.

## Verification and open controls

The web TypeScript/Vite build passes. Existing large lazy legacy-App chunk warning remains. Fresh all-eight canonical EN dark captures have exact immediate repeats, no browser errors and no external/unexpected writes. Against the published110 frames, Live/Projects/Models/History/Alerts are byte-identical; Providers differs130 shared-header pixels/max3 and Cost22 sidebar pixels/max35. Overview has the4139 intended quota pixels plus the preexisting22 sidebar-pixel profile. These controls remain explicitly open; no threshold or mask was relaxed.

The complete Overview EN/TH dark/light gate passes all four pairs: three are byte-identical; Thai dark differs30 pixels/max4 within the existing max10/fraction0.00005 tolerance. No masks or thresholds changed. The gate also passes quota state/progress, same-name separate owner identity, keyboard selection/history access, real labels, responsive layouts and font provenance. All-eight recorded shell/main/headings geometry equals110. Product tests remain the inherited655/655 result from110; this CSS/DOM-attribute change has a fresh web build and targeted compiled browser gates, not a new full-suite run.

A fresh87-package Windows x64 review bundle passes five isolated real daemon/tray start/WhatIf/stop/restart checks outside the repository dependency tree. Readers are disabled; its profile is empty and separate. The test copies the built directory, not a fresh ZIP extraction. Every3154 ZIP entries were subsequently decompressed and SHA256-compared with that directory. ZIP206477672 bytes, SHA256 `02427d0a8ca801aa52a8c6f23f4f54c87c2f670bb0fb72af44091c4587448b4c`; bundled web index matches this capture's `700dcc02d502dc950ee10d6fced4eeac39340158f4ca1eef3ad642bf6c131ab6`. This is an unsigned review bundle requiring external Node ABI127, not a production release or populated real-data UI acceptance. No user profile is embedded.

Passing repeatability does not approve the source design. The retained Models Thai-dark125-pixel ring failure and historical raster controls remain open. The [approved20-row trace](../redesign-v1.85.109/REQUIREMENT-TRACE.md) still requires broader art/type/layout/action parity, full native/error/motion/persistence proof, large-data/resource work and actual previous/current version rollback.

Next direct visual work identified from the current all-eight review: Live's usage feed still combines timestamp/harness/provider/model into a single span, while the supplied source has distinct aligned columns and event marks. Rebuild that layout using actual usage record fields and honest call/aggregate/unknown grain; do not introduce unsupported session lifecycle events. The current provider/model minute strip also needs source-aligned sizing while preserving its real bucket scope.

[Open original/before/current comparison](review.html). All captures use synthetic test data through the real compiled API/UI; product data is not replaced with concept numbers. Main/origin configuration, old installation and user data are unchanged.

Text evidence is normalized to UTF-8/LF with trailing spaces removed; PNG bytes are retained. Published hashes cover those actual files. The comparison reuses earlier PNGs only when the entire new capture SHA256 matches them.
