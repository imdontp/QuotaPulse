# v1.29 — Providers comparison presentation

## Objective and scope

Continue the dashboard blueprint v1.1 on the isolated `design/redesign-foundation`
worktree. The original Providers concept uses a percentage-scale column chart;
the v1.27 candidate used horizontal comparison rails. This checkpoint refines
that comparison and owner card identity while retaining the actual quota ownership
and reader diagnostics. No pet, popup, installer, account, dependency, database or
API-contract change is introduced.

## Changes

- `providers.tsx`: card selection now exposes `aria-pressed`; decorative cloud
  tiles distinguish card identity. Account state receives a separate semantic
  color hook. Comparison owner names are keyboard-operated selection buttons.
  The existing same-window/current-reading eligibility and exclusion count remain.
  Actual percentage values remain text alongside the decorative chart.
- `providers.css`: desktop comparison uses 144 px columns, a fixed 0–100% axis
  and quarter-step grid. Values and owner names follow each bar vertically. Narrow
  layouts retain horizontal rails and readable values. No positive minimum is
  imposed on tiny/zero readings. State colors use existing theme tokens.
- `check-stable-captures.mts`: a Providers slice runs four independent repeated
  language/theme pairs plus Settings access. API values, proportional heights,
  vertical label placement, complete bottom panels, keyboard selection, responsive
  overflow and synthetic unknown/expired/tiny/zero states are checked. Default
  scope continues to capture all eight screens and includes these new assertions.
- `build-review-bundle.mts`: review checkpoint label advances to v1.29.

Known data legitimately yields only two comparable owners in the fixed fixture.
The two owners without a comparable published reading remain excluded. No provider
is invented to fill the concept's eight columns. Reader freshness remains distinct
from service health, response time, account plan pricing or provider connectivity.

## Validation — Validated for this slice

```powershell
npm run build -w @quotapulse/web
$env:QUOTAPULSE_CAPTURE_SCOPE = 'providers'
node --import tsx scripts/check-stable-captures.mts
Remove-Item Env:QUOTAPULSE_CAPTURE_SCOPE
node --import tsx scripts/build-review-bundle.mts
powershell -NoProfile -NonInteractive -File scripts/archive-review-bundle.ps1
git diff --check
```

| Check | Final result |
| --- | --- |
| TypeScript/Vite production build | Passed; existing large-chunk warning remains |
| Canonical viewport | 1672 × 941, DPR 1, frozen daemon/browser clock |
| Languages/themes | English/Thai × dark/light |
| Complete comparison/reader region | Bottom **913.875 px** in all four variants |
| Observed comparison | Two current same-window readings, 97% and 85%, matched against synthetic daemon |
| Keyboard | Enter on comparison owner selects its corresponding detail; selected state exposed |
| Responsive | No document overflow at 390/900/1280 widths; 32 shared-header cases passed including Settings |
| Unknown/expired quota | No comparable bars or chart rendered |
| Tiny/zero quota | 0.5% produces a positive bar under 1 px; 0% produces zero height |
| Shell/fonts | Eight access checks of each kind passed |
| Repeatability | **4/4 pairs byte-identical**, no masks or threshold relaxation |
| Test safety | In-memory synthetic DB and local response fixtures; no external/write requests or browser errors |

The first implementation passed data checks, but visual inspection showed inherited
horizontal grid columns placing values beside their bars. Desktop grid columns
were corrected and an explicit vertical label assertion was added. Axis text is
positioned at the grid's actual percentage coordinates. The final build and original
checks were rerun with that additional assertion.

Exact results and hashes: [verification](redesign-v1.29/verification.json).
Candidates: [English dark](redesign-v1.29/providers-en-dark.png),
[English light](redesign-v1.29/providers-en-light.png),
[Thai dark](redesign-v1.29/providers-th-dark.png),
[Thai light](redesign-v1.29/providers-th-light.png).
The original concept and previous candidate were inspected; final English dark
and Thai light were visually checked for axis, bar/value/name placement and panels.

## Package and limits

Archive: `tmp/review-bundles/QuotaPulse-v1.29-CC1tnC.zip`, 3,120 files,
199,839,885 compressed bytes. SHA256:
`63fc80245e908457a41e0dce684fcc8e4fd04571aca0006f315ca38c1790e1ae`.
Final inspection found zero scoped browser/build processes and a clean original
checkout. The previous v1.28 ZIP SHA256 remains
`98d86ef994b99311aacf6f07d017888bf4c66741ccb22018efa090dea7b03a90`.

Exact ZIP path, SHA256, size and full entry-decompression/source comparison are in
[archive verification](redesign-v1.29/archive-verification.json).
[Bundle inventory](redesign-v1.29/bundle-build.json) records installed packages.
Extract the ZIP into a fresh dedicated folder; start/stop this instance with
`scripts/start-review.ps1` / `scripts/stop-review.ps1`. Requires Windows x64 and
installed Node ABI 127. Readers remain disabled; a fresh review database is empty.
Capture fixture records are not shipped as production data.

This run targets Providers and Settings access, not a new full eight-screen,
unit/API, native lifecycle, installer or extracted-installation runtime run. ZIP
comparison uses the built bundle source. Other screen evidence remains historical.
Large owner counts, multiple windows and long names may require scrolling; no data
is clipped to force the canonical gate. Manual accessibility, additional occupied
states, final screen styling and complete RC gates remain. These are review
candidates, not approved visual baselines or measured concept parity.
