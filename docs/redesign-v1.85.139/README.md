# QuotaPulse review139 — source138

[Download the local review ZIP](C:/Users/TH12367283/Projects/QuotaPulse/tmp/worktrees/redesign-validation-v1.85.138/tmp/review-bundles/QuotaPulse-v1.85.138-review139.zip) · [Actual native screenshots](review.html)

Validated portable review delivery of frozen source `b027a5365a5cac260c36217716a8da264c2d2aad`. This includes source137 explicit portable reader opt-in, source138 Codex cursor identity/project retention with observed-truncation reset, source133 two-sector token distribution, source134 header/filter/sort controls and responsive token values, and source135 finite ring selection interpolation with live reduced-motion guards and single-line English legend. The archive uses matching daemon, web, Electron main, sandboxed preload and runtime assets. Main and previous review archives are unchanged.

## Try it

Extract into a new dedicated folder. In PowerShell from that folder:

```powershell
.\scripts\start-review.ps1
```

Open http://127.0.0.1:7807/#overview or use the review tray icon to open Dashboard. Stop this instance with `.\scripts\stop-review.ps1`. A different `-Port` is supported. Windows x64 and an installed Node runtime with ABI127 are required; this build used Node22.13.1. Node is external. No logon task is installed.

Default launch creates its own empty profile with readers/account probes and Pet disabled. To collect real local usage, stop the instance, then run `.\scripts\start-review.ps1 -EnableReaders`. This mode reads installed harness logs and configured quota readers into isolated review-data; the original QuotaPulse database is not imported. Initial scanning may take several minutes. The option applies per launch; default restart retains collected review data but disables further collection. This opt-in invocation is for the portable launcher, not existing versioned wrapper scripts. **Default launch does not collect real usage; explicit -EnableReaders enables the existing local readers.** No customer database, credentials or synthetic fixture database is included. Populated screenshots come from an owned QA profile using the actual production application. Real-reader/customer acceptance remains open.

Archive: 206495808 bytes, 3157 entries. SHA256: `85b8385f4de448f73bd626bdb9ca40a0d2bea570501e1addb98335fd373dfe82`.

## Evidence

All six fresh build steps passed, including 672 repository tests (125 daemon,349 web,198 tray; zero failed/skipped/cancelled). The web index is `0fd855c959228374a5733d3b0aebbb001e8b3394222eebe6c6836bd503cbc2d4`, identical to committed source138 evidence.

Actual compiled production Electron main/preload ran two cycles and captured all eight dashboard routes in EN/dark, then TH/light after restoring THB37.25 and window1371×887 from Settings. Both native Models frames verify all four metric values, unknown qualifier and partial cost stay on a single glyph line. Two additional native checks exercise header period, keyboard sort, exact ring shares, native180ms selection animations and live reduced-motion changes; scope/sort do not replay ring motion. All served web bytes are compared to bundle assets. The owned three-row QA database retains221 stored tokens and native/computed/unknown cost bases; integrity passes. Source bundle bytes remain unchanged and every QA process is stopped.

The actual archive also passed six reader opt-in checks after a separate fresh extraction: the real Codex adapter ingested an owned synthetic log150→190 tokens while retaining one session through refresh/restart. The API and Models page agree; source and original-profile sentinels remain unchanged. Account probes were disabled only for this QA check, and no customer logs or credentials were used.

Every ZIP entry matches the unused bundle. The actual ZIP was extracted outside repository dependencies and passed six WhatIf/start/stop/data-preservation/restart checks with its own profile and bundled runtime dependencies. Raw build receipt is retained compressed so its SHA binding remains exact.

## Limits

Native windows were positioned beyond physical displays with test-only anti-occlusion/background-throttling overrides. Captures use reduced motion; the explicit native Models checks separately enable normal motion. First viewport: `{"width": 1688, "height": 980, "dpr": 1}`. First native image: `{"width": 1688, "height": 980}`. These are not physical-monitor, tray-click, reference-size pixel or performance acceptance. Two native language/theme combinations were exercised, not the full matrix.

Full blueprint and 99–100% visual acceptance remain open. Source135 retains three unexplained comparison-border pixel differences; prior distinct-document header differences remain open. See [source138 implementation evidence](../redesign-v1.85.138/README.md), the accepted v1.1 gap ledger and full requirement trace. This portable ZIP does not certify signed installation, two-version migration/rollback or customer data/all-provider reader behavior.
