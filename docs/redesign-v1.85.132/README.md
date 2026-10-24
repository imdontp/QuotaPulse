# Fixed-source native review delivery v1.85.131

Product source: v1.85.131, commit `a47ad1354eb402b51a08c86d53cfa325adde0905`. This checkpoint delivers an updated runnable review ZIP. Full redesign and99–100% reference acceptance remain incomplete.

## Try the app

[Open the local ZIP](C:/Users/TH12367283/Projects/QuotaPulse/tmp/worktrees/redesign-validation-v1.85.131/tmp/review-bundles/QuotaPulse-v1.85.131-review132.zip). Extract it into a new dedicated folder, then run from PowerShell in that folder:

```powershell
.\scripts\start-review.ps1
```

Open http://127.0.0.1:7807/#overview, or use the review tray icon to open the native dashboard. Stop only this review instance with:

```powershell
.\scripts\stop-review.ps1
```

Requires Windows x64 and an installed Node runtime with ABI127; this build/test used Node22.13.1. Node is not bundled. Occupied ports are rejected; start-review accepts a different `-Port` when needed. Existing application profiles are untouched.

This review launcher starts a separate empty profile with readers/account probes and Pet animation disabled. It does not collect real usage. No customer data, credentials or synthetic fixture database is packaged. The populated screenshots below are owned synthetic QA data used with the real production daemon/main/preload/web, not fake data built into the UI. Real-reader/customer acceptance remains open.

Archive SHA256: `74ed1d79bf85d4d4aaec0b8bc7c04d3a9cd66feee921bc1ea180b08fdbc7524f`

206491705 bytes; 3157 entries. Every ZIP entry matches the unused source bundle. The actual archive was extracted outside repository dependencies and passed the six launch/stop/restart checks.

## What is included

- Live nine-column recorded session composition and actual input/output/provider/model facts (126).
- Cost nearest-bucket pointer/keyboard inspection and readable narrow tables (127).
- Reference-specific dashboard harness and OpenCode Go subscription artwork (128).
- Models actual provider counts, input/output summary and separate Anthropic provider/company artwork (129).
- Native-discovered summary fixes: unknown-provider qualifier and partial-value wrapping (130), then intrinsic value columns and medium-width currency layout (131). Both earlier source129/archive130 and source130/archive131 candidates were withheld after visual review; this ZIP uses corrected source131.

[Native screenshots](review.html) · [Reference/current browser comparison129](../redesign-v1.85.129/review.html) · [130 defect and fix evidence](../redesign-v1.85.131/README.md). The129 viewer precedes the130 wrapping fix and is not labelled as this ZIP's native paint.

## Validation

- Fresh daemon/web/tray builds and656 repository tests passed:123 daemon,335 web,198 tray; zero failures/skips/cancellations.
- Actual compiled production Electron main with its sandboxed preload: two launch cycles and16 captures across eight routes. EN/dark first, then TH/light with THB37.25 and window1371×887 restored through Settings/preload/main. Preload source, context isolation, sandbox and disabled Node integration are verified. All served web asset bytes are checked against the bundle.
- Both native Models frames explicitly verify all four values, the unknown qualifier and partial monetary value remain single-line after the real restart; these are the defects found in the rejected candidate.131 also retains a separate32-case browser matrix for EN/TH, dark/light,390/1280/1355/1688 and USD/THB.
- The owned QA database retained221 stored tokens and native/computed/unknown cost provenance; integrity passed. The unused source bundle remained byte unchanged throughout native QA. Frozen source tracked files remain clean.
- The actual ZIP passed dependency isolation, start/stop WhatIf behavior, scoped shutdown, database preservation and restart checks outside repository dependencies. All owned QA processes were stopped.

## Limits and remaining work

Native capture windows were offscreen, with test-only anti-occlusion/background-throttling and reduced-motion overrides. Actual first viewport: `{"width": 1688, "height": 980, "dpr": 1}`; first native image: `{"width": 1688, "height": 980}`. These are not reference-sized pixel acceptance or physical monitor/tray-click/performance proof. Only two native language/theme combinations were exercised here.

The full blueprint trace and accepted v1.1 gap ledger remain authoritative. Remaining visual materials, rings, typography, controls, full distinct-document repeat stability (including128 header differences), real-reader/customer flows, physical desktop behavior, performance and human acceptance remain open. Current versioned installation/upgrade/rollback and signing are not certified by these portable ZIP checks. Main is unchanged; branch/tag/worktree isolation is retained.
