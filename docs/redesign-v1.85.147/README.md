# Review147 — runnable source146

[Review ZIP](C:/Users/TH12367283/Projects/QuotaPulse/tmp/worktrees/redesign-validation-v1.85.146/tmp/review-bundles/QuotaPulse-v1.85.146-review147.zip) · [Actual Electron gallery](review.html) · [Observed extent implementation](../redesign-v1.85.145/README.md) · [Single-bucket diagnosis/fix](../redesign-v1.85.146/README.md)

Validated bounded portable delivery of frozen source `2fd5353173d5820fbf6407f8548ac76d689e0c6d`. This replaces review144 for testing and includes both History corrections: an all-time chart starting at the first matching recorded timestamp, and observed points without a declining area when there is just one bucket. Complete query/export scope and actual token/money facts remain intact. Source145's native diagnostic build146 was not published as a ZIP after visual inspection exposed the single-bucket defect; this source146 package includes its correction.

## Try it

Extract into a new dedicated folder and run PowerShell there:

```powershell
.\scripts\start-review.ps1 -EnableReaders
```

Open http://127.0.0.1:7807/#overview. Explicit `-EnableReaders` enables installed harness/configured quota readers into separate review-data, without importing the original application database. Initial scans may take several minutes. Without the switch, readers/account probes stay off and the fresh profile is empty. Stop with `.\scripts\stop-review.ps1` before changing modes. Restart without the switch keeps collected review data but disables collection. The switch applies to the portable launcher; versioned wrappers do not expose it. Pet is disabled. No customer DB, credentials or synthetic fixture DB is packaged. Windows x64 with installed Node ABI127 is required (validated Node22.13.1); Node is external. `-Port` selects another port. No logon task is installed.

Archive: 206500027 bytes; 3159 entries. SHA256 `ec9acc148315e1a7f3cb4c362bf3c088bc91aceaf3a76475fbf6382b5b346d25`. Production web index `bbc7208eeeb1c4f9e4c36fb6f639c7a138447ddb67a5867ebd267c91adc4f240`.

## Validation

All six frozen application-only sparse-checkout build/package steps pass with675 tests (126 daemon,351 web,198 tray), zero failures/skips/cancellations. Matching daemon, web, Electron main/preload, runtime assets and notices are packaged. The unused bundle remains byte-identical after validation.

Actual production Electron main plus the exact sandboxed compiled preload run two cycles: EN/dark and restored TH/light with THB37.25 and1371x887 window preferences. Sixteen dashboard captures cover all eight routes. 64 served web assets match the bundle and all3159 runtime files stay unchanged. The owned three-row QA DB retains221 tokens, native/computed/unknown price bases and passes integrity checks. This data is not bundled demo content.

Two native History checks keep the complete epoch-origin query but plot from the first recorded match. They preserve151 tokens/two records, exact101-input/50-output keyboard values, both observed points with no extrapolated area for a single bucket, no date axes for empty matches, unapplied drafts and keyboard filter/clear/source/session scope. Two cold compiled-module palette checks retain query/focus and navigate to monthly Cost. Existing two Projects fact/keyboard and two Models sorting/period/180ms/reduced-motion checks pass. Both native cycles stop cleanly.

Every ZIP entry is byte-verified against the unused bundle. Fresh extraction outside repository dependencies passes six WhatIf/start/stop/preserve/restart checks. A separate fresh extraction passes six opt-in reader lifecycle checks with an owned fake home/Codex log:150→190 tokens, one session through refresh/restart, no prompt fields, original-profile/source sentinels unchanged. Account probes are disabled only in reader QA. No customer logs/credentials are used.

After validation, only the two newly created QA extraction copies were removed manually after exact path/receipt/archive/index checks and confirming their recorded processes were stopped. The cleanup receipt is retained. The executable ZIP, unused source bundle, frozen source and native QA profile remain. This QA-only cleanup is not launcher behavior; normal Stop preserves the user's review data.

## Limits and remaining work

The gallery contains actual Electron page screenshots after DOM readiness, using owned QA data. Separate capturePage bitmap comparisons are diagnostics, not exact-raster passes; non-exact frames are retained. Native windows are beyond physical displays with test-only anti-occlusion/background-throttling settings. Captures use reduced motion except explicit Models motion checks. Actual initial viewport `{"width": 1688, "height": 980, "dpr": 1}`; native image `{"width": 1688, "height": 980}`. These are two native language/theme combinations, not the full matrix or physical tray/monitor/performance acceptance.

Source145's intermittent full-integration SSE count failure remains unexplained despite a later serial pass; this native/ZIP check does not close that issue. The single-bucket browser diagnostic also exposes a separate existing sub-day custom-range date-control presentation issue: exact API scope can coexist with an earlier displayed end calendar date. That needs its own fix; it is not covered by these all-time native cases. The sparse native Cost fixture does not certify the occupied eight-model case. Original-reference99–100% approval, complete provider/customer/native matrices, installation and two-version migration/rollback remain open. No mask or tolerance change closes a visual gate, and fullGoalComplete remains false. Existing main, origin and prior review ZIPs are preserved.
