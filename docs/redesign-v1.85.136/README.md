# QuotaPulse review136 — source135

[Download the local review ZIP](C:/Users/TH12367283/Projects/QuotaPulse/tmp/worktrees/redesign-validation-v1.85.135/tmp/review-bundles/QuotaPulse-v1.85.135-review136.zip) · [Actual native screenshots](review.html)

Validated portable review delivery of frozen source `d2373e3aed7e01beac68f9417e6478c73d1256c1`. This includes source133 two-sector token distribution, source134 header/filter/sort controls and responsive token values, and source135 finite ring selection interpolation with live reduced-motion guards and single-line English legend. The archive uses matching daemon, web, Electron main, sandboxed preload and runtime assets. Main and previous review archives are unchanged.

## Try it

Extract into a new dedicated folder. In PowerShell from that folder:

```powershell
.\scripts\start-review.ps1
```

Open http://127.0.0.1:7807/#overview or use the review tray icon to open Dashboard. Stop this instance with `.\scripts\stop-review.ps1`. A different `-Port` is supported. Windows x64 and an installed Node runtime with ABI127 are required; this build used Node22.13.1. Node is external. No logon task is installed.

The launcher creates its own empty profile with readers/account probes and Pet disabled. **This launcher does not collect real usage.** No customer database, credentials or synthetic fixture database is included. Populated screenshots come from an owned QA profile using the actual production application. Real-reader/customer acceptance remains open.

Archive: 206495227 bytes, 3157 entries. SHA256: `ec23b0b80df370b3082620dee1296b47f0083c4691b42f59f2a990ca2254a5b8`.

## Evidence

All six fresh build steps passed, including 670 repository tests (123 daemon,349 web,198 tray; zero failed/skipped/cancelled). The web index is `0fd855c959228374a5733d3b0aebbb001e8b3394222eebe6c6836bd503cbc2d4`, identical to committed source135 evidence.

Actual compiled production Electron main/preload ran two cycles and captured all eight dashboard routes in EN/dark, then TH/light after restoring THB37.25 and window1371×887 from Settings. Both native Models frames verify all four metric values, unknown qualifier and partial cost stay on a single glyph line. Two additional native checks exercise header period, keyboard sort, exact ring shares, native180ms selection animations and live reduced-motion changes; scope/sort do not replay ring motion. All served web bytes are compared to bundle assets. The owned three-row QA database retains221 stored tokens and native/computed/unknown cost bases; integrity passes. Source bundle bytes remain unchanged and every QA process is stopped.

Every ZIP entry matches the unused bundle. The actual ZIP was extracted outside repository dependencies and passed six WhatIf/start/stop/data-preservation/restart checks with its own profile and bundled runtime dependencies. Raw build receipt is retained compressed so its SHA binding remains exact.

## Limits

Native windows were positioned beyond physical displays with test-only anti-occlusion/background-throttling overrides. Captures use reduced motion; the explicit native Models checks separately enable normal motion. First viewport: `{"width": 1688, "height": 980, "dpr": 1}`. First native image: `{"width": 1688, "height": 980}`. These are not physical-monitor, tray-click, reference-size pixel or performance acceptance. Two native language/theme combinations were exercised, not the full matrix.

Full blueprint and 99–100% visual acceptance remain open. Source135 retains three unexplained comparison-border pixel differences; prior distinct-document header differences remain open. See [source135 implementation evidence](../redesign-v1.85.135/README.md), the accepted v1.1 gap ledger and full requirement trace. This portable ZIP does not certify signed installation, two-version migration/rollback or real-reader behavior.
