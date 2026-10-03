# v1.28 — Projects card comparison

## Objective and scope

Continue the dashboard blueprint v1.1 on the isolated `design/redesign-foundation`
worktree. Comparison with the original Projects concept and v1.27 candidate showed
that cards exposed tokens and activity but omitted monetary comparison. This slice
adds recorded monetary facts and refines card identity/spacing. No pet, popup,
installer, account, database, API contract or dependency change is introduced.

## Changes

- `projects.tsx`: card identity groups the existing name and last-observed timestamp
  beside a decorative folder tile. Each card displays source-reported cost and
  calculated API value separately, using existing `CostValue` weighted-call
  coverage. Missing prices remain “Unknown” / “ไม่ทราบ”; partial amounts retain
  `+`, their coverage tooltip and screen-reader description. No budgets, inferred
  activity state, invented descriptions or synthetic sparklines are added.
- `projects.css`: selected cards have a theme-aware accent background/glow;
  identity and monetary fields have their own hierarchy. Desktop inset/gaps are
  compacted without changing typography or hiding any card data. Narrow layouts
  retain existing responsive behavior.
- `check-stable-captures.mts`: optional `QUOTAPULSE_CAPTURE_SCOPE=projects` runs
  four Projects candidates plus Settings shell/font checks in a separate output
  directory. Default scope remains all eight screens. New checks compare both
  monetary bases and weighted coverage against the synthetic daemon, exercise
  keyboard selection and empty search, and gate all eight cards at page-origin
  coordinates rather than a potentially scrolled viewport.
- `build-review-bundle.mts`: review checkpoint label advances to v1.28.

## Validation — Validated for this slice

```powershell
npm run build -w @quotapulse/web
$env:QUOTAPULSE_CAPTURE_SCOPE = 'projects'
node --import tsx scripts/check-stable-captures.mts
Remove-Item Env:QUOTAPULSE_CAPTURE_SCOPE
node --import tsx scripts/build-review-bundle.mts
powershell -NoProfile -NonInteractive -File scripts/archive-review-bundle.ps1
git diff --check
```

| Check | Final result |
| --- | --- |
| TypeScript/Vite production build | Passed; existing large-chunk warning remains |
| Occupied canonical layout | Eight cards; final bottom **930.5625 px**, within unchanged 941 px gate |
| Languages/themes | English/Thai × dark/light |
| Monetary comparison | Both bases match daemon amounts; unknown native coverage on seven projects and partial weighted coverage checked |
| Interaction | Enter selects last project and updates detail identity; unmatched search removes cards; selection restored |
| Existing access | Four complete chart-data/zero/tiny-bar checks, eight shell/font checks and 32 responsive header cases passed |
| Capture repeatability | 4/4 pairs passed; three byte-identical; English light differs at 15 pixels, maximum channel delta 1 |
| Tolerance | Existing max delta 2, changed fraction 0.0001; no masks or threshold relaxation |
| Safety | In-memory synthetic DB; no external/write requests or browser errors |

The first layout attempt exceeded the gate. A viewport-only measurement was also
affected by 16 px of scrolling during shell keyboard checks. The check now adds
`window.scrollY`. Browser diagnostics confirmed actual inset 12 px, gap 5 px and
179.390625 px card height; reducing desktop inset to 10 px brought the full grid
from 946.5625 to 930.5625 px. The original layout gate passes in all four variants.
An initial test assumption of an em dash was corrected to the existing localized
unknown-value contract; production `CostValue` semantics were not changed.

Exact measurements and hashes: [verification](redesign-v1.28/verification.json).
Reviewed candidates: [Thai dark](redesign-v1.28/projects-th-dark.png),
[Thai light](redesign-v1.28/projects-th-light.png),
[English dark](redesign-v1.28/projects-en-dark.png),
[English light](redesign-v1.28/projects-en-light.png).
The original concept and prior candidate were inspected; final Thai dark/light
were inspected for complete cards, label hierarchy and selected appearance.

## Package and limits

Archive: `tmp/review-bundles/QuotaPulse-v1.28-uJgCb2.zip`, 3,120 files,
199,839,297 compressed bytes. SHA256:
`98d86ef994b99311aacf6f07d017888bf4c66741ccb22018efa090dea7b03a90`.
Final inspection found a clean original checkout and zero scoped browser/build
processes. The v1.27 ZIP SHA256 remains
`3c52aaaa83871eb7ba1e464d21fbfac10fb22e9c0b2fc8d76d0784881cbead0b`.

Exact ZIP path, SHA256, size and full entry-decompression/source comparison are in
[archive verification](redesign-v1.28/archive-verification.json).
[Bundle inventory](redesign-v1.28/bundle-build.json) records installed packages.
Extract the ZIP into a fresh dedicated folder; start/stop this instance with
`scripts/start-review.ps1` / `scripts/stop-review.ps1`. Windows x64 and installed
Node ABI 127 are required. Readers stay disabled; a fresh database is empty.
Capture fixture records are not shipped as production records.

This is a Projects browser slice, not a fresh eight-screen matrix or all unit/API,
native lifecycle, installer or extracted-installation runtime test. ZIP comparison
uses the built bundle source. Existing v1.27 all-screen evidence is historical.
Arbitrary project counts and long identities can require scrolling; no fixed-height
clipping is introduced. These candidates are not approved visual baselines or
measured concept parity. Remaining screen styling, empty/long-state review, manual
accessibility and complete RC gates remain. Continue the dashboard concept queue.
