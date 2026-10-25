# Review141: runnable source140 dashboard

[Review ZIP](C:/Users/TH12367283/Projects/QuotaPulse/tmp/worktrees/redesign-validation-v1.85.140/tmp/review-bundles/QuotaPulse-v1.85.140-review141.zip) · [Actual Electron images](review.html) · [Source140 reference comparison](../redesign-v1.85.140/review.html)

Partially validated redesign delivery. This portable package includes the Projects reference summary/footer from source140, real recorded identity counts with unknown-provider qualification, last-observed time, separate reported-native/API money, and keyboard metadata access. Existing Models controls/motion and opt-in local readers are retained. Frozen source: `1319c196e85e92e231b13e6a69dff68c97273705`. Production web index: `2bab6990b174526765b76cc512552e3daf1c97a2a9b07aa1157ffd33cdd9b732`. Main and previous archives are unchanged.

## Run

Extract into a new dedicated folder, then run in PowerShell:

```powershell
.\scripts\start-review.ps1 -EnableReaders
```

Open http://127.0.0.1:7807/#projects. This explicit mode reads installed harness logs/configured quota readers into separate `review-data`; it does not import the original application database. The initial scan may take several minutes. To start with readers and account probes off and an empty profile, omit `-EnableReaders`. Stop with `.\scripts\stop-review.ps1` before changing modes. Restart without the switch preserves collected review data but disables further collection. The switch belongs to the portable launcher; versioned wrappers do not expose it. Pet is disabled. No customer database, credentials or synthetic fixture database is packaged.

Windows x64 and installed Node ABI127 are required; validated with Node22.13.1. Node is external. `-Port` selects a separate port. No logon task is installed.

Archive: 206497455 bytes; 3158 entries. SHA256 `11124639f5dfce24d500eb5844aceb16e90ef704718be50b79916f62b4ba7ea5`.

## Validation

All six fresh build/package steps passed with 674 repository tests:125 daemon,351 web,198 tray; zero failed/skipped/cancelled. Actual compiled Electron main and sandboxed exact preload ran two cycles with16 dashboard captures: EN/dark then TH/light after restoring THB37.25 and1371x887 window settings. Served web assets matched the bundle. All source-bundle bytes remained unchanged.

Two native Projects checks validate both projects against actual API facts, including sessions distinct from calls, harness/provider counts, `1 + ?` for partially unknown providers, exact221 stored tokens across the owned fixture, recorded timestamps, both monetary bases where reported, keyboard selection and metadata action. Two Models checks retain period controls, keyboard sort, finite180ms native ring interpolation and live reduced-motion behavior without scope/sort replay. The owned three-row database remains unchanged and passes integrity check. All QA jobs stopped.

The actual ZIP passed a fresh extraction outside repository dependencies, six start/WhatIf/stop/data-preservation/restart checks, and a second fresh extraction with six opt-in reader lifecycle checks. An owned synthetic Codex log grows150 to190 tokens while retaining one session across refresh/restart; prompt content is excluded and source/original-profile sentinels remain unchanged. Account probes were disabled for this reader QA; customer logs and credentials were not used. Every ZIP entry was byte-verified.

## Limits

The initial capture-only harness accepted a stale Projects loading bitmap despite ready DOM. Review images now come from Playwright screenshots of the actual production Electron page after readiness; all16 separate `capturePage` images are retained under `images/native-api`. Bitmap comparisons are diagnostics, not an exact-parity pass. A four-attempt control kept identical frames within each method but found913 different pixels (maximum channel delta2) on the selected card border; the compositor mechanism remains unproven. Initial harness whitespace and capture failures are retained. No production files, image masks or tolerance-based pass were introduced for this correction. See [paint diagnosis](paint-diagnosis.json).

The populated images use an owned QA profile, not packaged demo data. Native windows were positioned beyond displays using test-only anti-occlusion/background-throttling overrides. Captures used reduced motion; the Models checks separately exercised normal motion. Initial viewport `{"width": 1688, "height": 980, "dpr": 1}`; native image `{"width": 1688, "height": 980}`. This proves neither physical monitor/tray operation nor performance, signed installation, two-version migration/rollback, all account/providers, or the full native theme/language matrix.

99–100% reference fidelity and full blueprint acceptance remain open. Source140 has four exact within-context Projects capture pairs and bounded responsive/browser evidence; six unrelated pages remain byte-identical in that comparison. The105px Providers header difference remains open. Projects shared-paint differences were causally isolated to root-height change by a browser-only control; no production height workaround or image mask was introduced. See source140 evidence and the [accepted gap ledger](../redesign-v1.85.109/authority/07-GAP-LEDGER-v1.1.md) / [full requirement trace](../redesign-v1.85.109/REQUIREMENT-TRACE.md). This package is available for user review, not final visual acceptance.
