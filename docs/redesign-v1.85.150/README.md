# Review150 — runnable source149

[Review ZIP](C:/Users/TH12367283/Projects/QuotaPulse/tmp/worktrees/redesign-validation-v1.85.149/tmp/review-bundles/QuotaPulse-v1.85.149-review150.zip) · [Actual Electron gallery](review.html) · [Observed extent implementation](../redesign-v1.85.145/README.md) · [Single-bucket diagnosis/fix](../redesign-v1.85.146/README.md)

Validated bounded portable delivery of frozen source `5eb188edcfe8bddcf545ce952b13d36848daa066`. This replaces review147 for testing and includes both History corrections: an all-time chart starting at the first matching recorded timestamp, and observed points without a declining area when there is just one bucket. Complete query/export scope and actual token/money facts remain intact. Source145's native diagnostic build146 was not published as a ZIP after visual inspection exposed the single-bucket defect; this source149 package includes its correction.

## Try it

Extract into a new dedicated folder and run PowerShell there:

```powershell
.\scripts\start-review.ps1 -EnableReaders
```

Open http://127.0.0.1:7807/#overview. Explicit `-EnableReaders` enables installed harness/configured quota readers into separate review-data, without importing the original application database. Initial scans may take several minutes. Without the switch, readers/account probes stay off and the fresh profile is empty. Stop with `.\scripts\stop-review.ps1` before changing modes. Restart without the switch keeps collected review data but disables collection. The switch applies to the portable launcher; versioned wrappers do not expose it. Pet is disabled. No customer DB, credentials or synthetic fixture DB is packaged. Windows x64 with installed Node ABI127 is required (validated Node22.13.1); Node is external. `-Port` selects another port. No logon task is installed.

Archive: 206500201 bytes; 3159 entries. SHA256 `c6f708278dda69b62152b1bada3992aaf753f57c19858e081513e7657eecd38c`. Production web index `f9df009691e9ccf99f7c674dfc560c4861cef60273cf327d0c5f46b41c253500`.

## Validation

This archive additionally includes the [source148 calendar correction](../redesign-v1.85.148/README.md) and [source149 SSE canceled-response guard](../redesign-v1.85.149/README.md). [Native sub-day calendar image](images/initial-calendar-subday.png). Two native sub-day calendar checks preserve exact from/to/source/session scope and151 tokens, display the final included date, and ignore a cleared date without navigating to NaN.

All six frozen application-only sparse-checkout build/package steps pass with678 tests (129 daemon,351 web,198 tray), zero failures/skips/cancellations. Matching daemon, web, Electron main/preload, runtime assets and notices are packaged. The unused bundle remains byte-identical after validation.

Actual production Electron main plus the exact sandboxed compiled preload run two cycles: EN/dark and restored TH/light with THB37.25 and1371x887 window preferences. Sixteen dashboard captures cover all eight routes. 64 served web assets match the bundle and all3159 runtime files stay unchanged. The owned three-row QA DB retains221 tokens, native/computed/unknown price bases and passes integrity checks. This data is not bundled demo content.

Two native History checks keep the complete epoch-origin query but plot from the first recorded match. They preserve151 tokens/two records, exact101-input/50-output keyboard values, both observed points with no extrapolated area for a single bucket, no date axes for empty matches, unapplied drafts and keyboard filter/clear/source/session scope. Two cold compiled-module palette checks retain query/focus and navigate to monthly Cost. Existing two Projects fact/keyboard and two Models sorting/period/180ms/reduced-motion checks pass. Both native cycles stop cleanly.

Every ZIP entry is byte-verified against the unused bundle. Fresh extraction outside repository dependencies passes six WhatIf/start/stop/preserve/restart checks. A separate fresh extraction passes six opt-in reader lifecycle checks with an owned fake home/Codex log:150→190 tokens, one session through refresh/restart, no prompt fields, original-profile/source sentinels unchanged. Account probes are disabled only in reader QA. No customer logs/credentials are used.

After validation, only the two newly created QA extraction copies were removed manually after exact path/receipt/archive/index checks and confirming their recorded processes were stopped. The cleanup receipt is retained. The executable ZIP, unused source bundle, frozen source and native QA profile remain. This QA-only cleanup is not launcher behavior; normal Stop preserves the user's review data.

## Limits and remaining work

The gallery contains actual Electron page screenshots after DOM readiness, using owned QA data. Separate capturePage bitmap comparisons are diagnostics, not exact-raster passes; non-exact frames are retained. Native windows are beyond physical displays with test-only anti-occlusion/background-throttling settings. Captures use reduced motion except explicit Models motion checks. Actual initial viewport `{"width": 1688, "height": 980, "dpr": 1}`; native image `{"width": 1688, "height": 980}`. These are two native language/theme combinations, not the full matrix or physical tray/monitor/performance acceptance.

The sub-day calendar defect is corrected and checked natively here; the full three-timezone/DST matrix is separate source148 browser evidence. Source149 deterministically reproduces and corrects a daemon-side canceled-before-handler listener leak and passes the unchanged full integration; the exact historical source145 proxy occurrence lacks connection identities, so this is not a retrospective proof that every old failure had that cause. The forced cancellation regression is daemon/HTTP evidence, not a newly forced native cancellation test. The sparse native Cost fixture does not certify the occupied eight-model case. Original-reference99–100% approval, complete provider/customer/native matrices, installation and two-version migration/rollback remain open. No mask or tolerance change closes a visual gate, and fullGoalComplete remains false. Existing main, origin and prior review ZIPs are preserved.
