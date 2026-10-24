# Review delivery v1.85.125

Product source: v1.85.124, commit `97bb1da57e6328b3d5c74e86955f3dafe8b9b3d8`. Delivery only; dashboard source is unchanged.

## Run locally

1. Extract `QuotaPulse-v1.85.124-review125.zip` into a new folder.
2. Use Windows x64 with host Node 22 (ABI 127; validated Node 22.13.1). From that folder run:

```powershell
.\scripts\start-review.ps1
```

Open http://127.0.0.1:7807/#overview or use the review tray icon to open the native dashboard. Stop with `.\scripts\stop-review.ps1`. Existing occupied ports are rejected.

Archive: [local ZIP](C:/Users/TH12367283/Projects/QuotaPulse/tmp/worktrees/redesign-validation-v1.85.124/tmp/review-bundles/QuotaPulse-v1.85.124-review125.zip)

SHA256: `9685a9236123521657f6f6b22bc98c8535d16ef905c85977b7f1d291c9794603`

206484817 bytes; 3156 entries. Every entry was verified against the unused source bundle. The actual ZIP was extracted outside repository dependencies and passed six scoped launch/stop/restart checks.

This starts an isolated empty review profile with readers disabled and pet/animation disabled. No synthetic fixture or customer database is packaged. This launcher does not collect real usage. Application data paths and interactions use the production implementation; populated customer data acceptance remains open.

## Validation

- Fresh builds and 655 repository tests passed (122 daemon, 335 web, 198 tray; zero failures/skips/cancellations).
- Production Electron main and sandboxed preload: two launch cycles, 16 captures across eight routes, EN/dark then TH/light; Settings restored including THB, rate 37.25 and window size 1371 × 887.
- Owned synthetic native QA database retained 221 tokens and native/computed/unknown cost provenance; integrity check passed. Readers were off, so quotas were unknown/empty.
- Native windows were moved offscreen with test-only anti-occlusion and reduced-motion overrides. First actual viewport: {"width":1688,"height":980,"dpr":1}; native image: {"width":1688,"height":980}. These are not reference-sized pixel acceptance or physical desktop/performance tests.
- Actual ZIP smoke verified dependency isolation, WhatIf, scoped shutdown and restart. No current versioned installation/upgrade/rollback or signing certification.

Included product changes: History date/point inspection (122), Projects/Models chart inspection (123), reference Refresh plate and all four visible Alerts risk rows (124). See [124 visual comparison](../redesign-v1.85.124/review.html) and [older 123 all-page comparison](../redesign-v1.85.123/review.html). Browser matrix evidence belongs to those checkpoints; it was not rerun as a new 125 matrix.

## Remaining acceptance

The full blueprint trace and v1.1 gap ledger remain authoritative. 99–100% visual acceptance is not achieved. All-page material/type/art/control fidelity, Live table composition with truthful data, populated quota/customer flows, physical desktop behavior, performance, current installation/rollback and human acceptance remain open. No fabricated concept data or new pet redesign.

## Harness diagnosis

The first ZIP extraction check rejected the same Temp directory represented by Node as an 8.3 path and PowerShell as a long path. Canonicalizing Node's Temp path with realpath before creating the owned directory corrected the harness. The strict empty-directory, parent containment and archive-entry checks remain. Failure was observed in the tool transcript; no raw failure log was preserved. No application change.
