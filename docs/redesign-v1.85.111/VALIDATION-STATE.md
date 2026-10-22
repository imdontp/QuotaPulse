# Browser fixture clock repair v1.85.111

Status: partially validated. This checkpoint repairs test infrastructure; it does not change the product UI or establish reference fidelity. The application remains the compiled v1.85.110 source, with web index SHA256 `6746327285fadd9bdaf3e79adffada4e44cd4bc2d412a98dc1beb6fb52e8feb4`.

## Implemented change

Thirteen maintained browser harnesses freeze the Node wall date for synthetic API fixtures. Combining that frozen host date with Playwright's virtual browser clock caused a pre-capture wait to stall after the real calendar advanced. They now use [a shared Date-only browser fixture](../../scripts/browser-fixed-date.mjs), leaving browser requestAnimationFrame, performance, timeout and interval APIs native. Both the current document and future navigations receive the fixture date. Runway's explicit current-document date update remains supported. No production clock, screenshot tolerance, mask or assertion was changed.

Run the independent regression with `node --import tsx scripts/check-browser-fixed-date.mts` from the isolated worktree. The check restores the Node Date and closes its browser in finally. It uses a synthetic host/browser date offset above signed 32-bit timer range, so reproduction does not depend on today's calendar date.

## Evidence

Published text evidence is normalized to UTF-8/LF with trailing spaces removed; PNG bytes are preserved. The artifact manifest hashes the published files and the source manifest hashes LF-normalized source.

- Old-method bounded reproduction: a browser 25ms timer did not fire within 1000ms; virtual ticks were about 2147545991 while the recorded real-time timer callAt remained 100. This is observed behavior with installed Playwright1.62.1/Chrome155, not an assertion about every Playwright release.
- Date-only regression: EN and TH pages preserve the fixed date, explicit constructor arguments, Date.parse/UTC, instanceof and subclasses; two native RAF callbacks, a 25ms timer and two interval callbacks complete. The browser has no Playwright virtual clock installed. Explicit date+1000 update succeeds.
- Aggregate-presence regression: all 28 native stages pass on the unchanged compiled app, with no sampling gaps in this run. The real 180/700ms identity and lifecycle checks remain intact. Historical sampling gaps and whole-app performance requirements are not closed by this run.
- Runway regression: native 420ms interpolation, clock-only no replay, reduced motion, stale freeze and reset replacement pass. This is the isolated API/SSE fixture, not actual desktop minimize/restore proof.
- Models Thai dark stable gate completes instead of hanging, then correctly exits1 for the retained 125-pixel/max34 ring discrepancy. This checkpoint does not turn that gate green.
- Route-loading passes181 lifecycle cases against the isolated in-memory API: lazy module pending/rejection/reload, keyboard recovery, retained locale/theme, narrow/native widths and preserved legacy/popup entries. This uses the script's existing renderer flags, unlike the native motion checks. The other migrated harnesses have the same import/call substitution but are not all individually rerun here.
- Product test status is inherited from v1.85.110: 655/655. No application source or dist changed in this checkpoint; no new full-suite run is claimed.

## Controlled ring investigation

Eight diagnostic actions each used two fresh capture passes, with a screenshot before and after the action. These probes deliberately skip the stable harness's later functional/raster gates, so their exit0 means diagnostic completion only. Full unmasked comparisons are in `evidence/ring-controlled-comparison.json`.

| Action | Baseline repeat changed pixels | After repeat | Intervention effect |
| --- | ---: | ---: | --- |
| Wait120ms | 125 | 125 | 0 in both passes |
| Computed-style reads | 0 | 0 | 0 |
| CDP attach only | 0 | 0 | 0 |
| CDP LayerTree.enable | 0 | 0 | 172 in each pass, including the same125 ring pixels |
| will-change:transform | 0 | 0 | 955 ring pixels in each pass |
| isolation:isolate | 0 | 0 | 125 ring pixels in each pass |
| translateZ(0) | 125 | 0 | 964 / 854 ring pixels |
| Integer Y (+0.203125px) | 0 | 0 | 5763 ring pixels/max75 in each pass |

The ring difference can persist after waiting, and diagnostic layer/stacking interventions can themselves change the captured raster. This supports observer sensitivity; it does not identify the original cause. Equal repeats after an intervention are insufficient evidence of a product fix. No speculative CSS promotion, isolation or geometry shift was shipped. The original failed125-pixel pair is preserved. Source geometry/computed paint remain available; no data/text mismatch was observed in the original ring pair.

## Execution limitations and remaining work

A fresh Windows x64 review bundle was assembled with87 runtime packages, including current compiled daemon/web/tray/preloads and the existing assets/notices/fonts. Five launch checks pass on a copy outside the repository dependency tree: WhatIf has no start side effects, real daemon/tray start with readers disabled in a new empty profile, stop WhatIf leaves them running, scoped stop preserves the database, and restart succeeds. This proves portable startup/stop behavior, not native dashboard appearance or populated real-data rendering. The test copies the built directory; it does not launch a freshly unzipped installation.

The unused bundle ZIP has3154 files,206477452 compressed bytes,453538628 uncompressed bytes and SHA256 `580123b86eedd931689423d3f11f51144724fcb3589652b160b0ebac1116aac4`. Every entry was decompressed and SHA256-compared with the bundle directory. No app profile is embedded. The unsigned review bundle requires host Node ABI127 (built using v22.13.1); Node is not bundled. Its README/start/stop helpers are included. The old installation, main branch, settings and user database were not migrated. Actual previous/current version installation and rollback remain open.

The first resumed batch stalled before capture using the old clock fixture. A temporary inspector expression using dynamic import failed in its own diagnostic Node process; the corrected read-only inspector used built-in module access. Only the verified owned stalled batch and descendants were stopped. The obsolete attempts are not passing tests. An earlier execution request was rejected by automatic approval review for exhausted credits; after user resume, the normal approval path succeeded. No approval bypass was used.

The [v1.85.110 all-eight comparison](../redesign-v1.85.110/review.html) remains the current product visual review. Full Models stable capture and the retained History/Providers/Cost controls remain RED. The [20-row approved requirement trace](../redesign-v1.85.109/REQUIREMENT-TRACE.md) remains partial: reference art/type/material/action parity, complete current native/responsive/error/motion matrix, large-data/resource work, matching extracted package and real two-version rollback still need work. No 99–100% match or release completion is claimed.
