# v1.26 — dashboard Overview with occupied data

## Scope and blueprint alignment

The active objective is the dashboard blueprint v1.1: eight concept screens plus
Settings within the shared shell. Pet settings and `?mode=popup` are compatibility
requirements, not a pet redesign or a separate pet recovery project. Further native
pet/popup hang work and installer/logon improvements are outside this dashboard
slice. Earlier isolated checkpoint commits remain available; this slice changes
only Overview presentation, its browser checks and review-bundle checkpoint label.

This implements the blueprint's Foundation/pilot, Overview and Hardening layout
requirements with an occupied synthetic fixture. It is not application RC approval.

## Change and observed problem

The [prior occupied capture](redesign-v1.18/overview-th-dark.png) had eight models
stacked in tall rows: the Pulse Core consumed almost the complete concept viewport,
and Runtime Map/runway/activity were absent from that viewport. Earlier two-model
layout checks did not protect against the richer fixture's vertical growth.

- Desktop model rows now place name/value together with the proportional bar below.
  The rail has a 270 px limit, native vertical scrolling and an accessible focus target.
  All eight models remain available, including their existing detail dialogs.
- The desktop Runtime Map uses a vertically scrollable diagram region. Nodes,
  relationships, token totals and the complete recorded-data table are retained.
- Runway/Insights spacing is compacted while all forecasts, history disclosure,
  coverage values and factual caveats remain. Activity rows use a readable compact
  line height. Narrow layouts keep their existing responsive presentation.
- No query, calculation, database schema, provider account, quota or API contract
  changed. Production selectors are limited to Overview; no pet/popup redesign.

## Validation

`QUOTAPULSE_CAPTURE_SCOPE=overview` selects a bounded slice of the existing
production capture harness, with a separate output directory and accurate scoped
report. Without this option the harness retains its eight-screen capture loop.
The new occupied-layout and keyboard assertions also run in that default loop.

| Final check | Evidence |
| --- | --- |
| Canonical viewport | 1586 × 992, DPR 1, frozen daemon/browser clock |
| Language/themes | English/Thai × dark/light |
| Pulse Core bottom | **463.50 px** in all four combinations |
| First complete activity record bottom | **990.953125 px**, within the unchanged 992 px gate |
| Model rail | 270 px; all 8 model buttons retained |
| Keyboard | End scrolls rail; last model opens its detail; Escape restores button focus |
| Repeatability | **4/4 independent capture pairs byte-identical**, no masks |
| Additional scoped checks | 8 font checks, 8 shell checks, 4 Runtime Map checks, 4 quota checks |
| Responsive/access | Existing Overview shell/map/history access checks at 390/900/1280 widths passed |
| Build | Web TypeScript and Vite production build passed; existing large-chunk warning remains |
| Test safety | In-memory synthetic DB, no adapters, no external/write requests or browser errors |

Intermediate occupied checks reported activity bottoms 1092.28125 and 1011.5625 px;
the implementation was refined until the original gate passed. The threshold was
not relaxed. Final results are in [verification](redesign-v1.26/verification.json).

Reviewed candidate images:
[Thai dark](redesign-v1.26/overview-th-dark.png),
[Thai light](redesign-v1.26/overview-th-light.png),
[English dark](redesign-v1.26/overview-en-dark.png),
[English light](redesign-v1.26/overview-en-light.png).
Canonical dark candidates were inspected alongside the original Overview concept;
the improved density is verified, not a claim of exact visual parity.

```powershell
npm run build -w @quotapulse/web
$env:QUOTAPULSE_CAPTURE_SCOPE = 'overview'
node --import tsx scripts/check-stable-captures.mts
Remove-Item Env:QUOTAPULSE_CAPTURE_SCOPE
node --import tsx scripts/build-review-bundle.mts
powershell -NoProfile -NonInteractive -File scripts/archive-review-bundle.ps1
```

## Review package

New archive: `tmp/review-bundles/QuotaPulse-v1.26-EUA5K4.zip`. Exact SHA256,
size and decompression verification are recorded in
[archive verification](redesign-v1.26/archive-verification.json);
[bundle inventory](redesign-v1.26/bundle-build.json) records the installed packages.
Extract into a fresh dedicated folder; start using `./scripts/start-review.ps1`
and stop that instance with `./scripts/stop-review.ps1`. Requires Windows x64 and
installed Node ABI 127. Readers remain disabled, so an empty review database is
expected. Synthetic records used for captures are not shipped as production data.

Archive: 3,120 files, 199,838,952 compressed bytes.
SHA256: `9fc13ab96d085693429cf489330963223c441709650a9d450512ee84e921d0ba`.
Final inspection found zero capture/bundle test processes and a clean original
checkout. The previous v1.25 archive SHA256 remains
`548ce229994213941922f675e49cffc43348f14b29d060bd97a5b6118f877cd7`.

## Remaining dashboard work

Continue shared-shell branding/typography and each screen's remaining concept
comparison. Overview's globe/waveform treatment, exact original region measurements,
scroll affordances and long/empty states still need final visual review. These
captures are candidates, not approved implementation baselines; no concept SSIM or
99–100% parity claim is made. Manual keyboard/screen-reader/typography review and
the blueprint's complete RC build/test/compatibility gates remain.

This run targeted Overview plus shared Settings access; it did not rerun the other
seven screen matrices, all unit/API suites or native desktop lifecycle checks.
ZIP verification compares entries to the built bundle, not a second installed copy;
the browser checks use worktree web/dist. Earlier results remain historical evidence.
