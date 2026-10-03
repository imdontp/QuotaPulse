# v1.30 — Models comparison presentation

## Objective and scope

Continue the dashboard blueprint v1.1 on the isolated `design/redesign-foundation`
worktree. Comparison with the original Models concept and v1.27 candidate showed
that numeric ratio columns lacked the concept's visual comparison cues. This slice
adds truthful ratio rails and summary identity tiles, while retaining the existing
model/provider identity, cost coverage and recorded-data semantics. No pet, popup,
installer, dependency, account, database or API-contract change is introduced.

## Changes

- `models.tsx`: cache-read share and priced-call coverage retain their original
  formulas/text, with decorative proportional rails. Missing denominators retain
  an em dash and render no rail; zero values render zero width. Model row buttons
  expose selected state with `aria-pressed`. Existing Lucide icons add summary
  identity tiles; summary values and cost-basis disclosure remain unchanged.
- `models.css`: compact desktop table spacing accommodates the new rails without
  clipping rows. Selected rows have an accent edge as well as their background.
  Summary icons use existing theme tokens and the recorded-component donut gains
  an outline. Narrow layouts retain local table scrolling and existing page grids.
- `check-stable-captures.mts`: optional Models scope retains four candidates and
  Settings access in its own directory. New checks compare 16 ratio rails per
  variant to the synthetic daemon, exercise keyboard selection and empty search,
  and cover unavailable, zero and 0.5% ratios through local response fixtures.
  The default eight-screen matrix also includes these assertions.
- `build-review-bundle.mts`: advances only the review checkpoint label to v1.30.

No quality score, speed benchmark, unsupported context capacity or invented trend
is restored from the concept. Model maker and recorded provider remain distinct.
Price coverage includes known native/computed/estimated weighted calls; calculated
API value still retains its own separate basis and subtotal disclosure.

## Validation — Validated for this slice

```powershell
npm run build -w @quotapulse/web
$env:QUOTAPULSE_CAPTURE_SCOPE = 'models'
node --import tsx scripts/check-stable-captures.mts
Remove-Item Env:QUOTAPULSE_CAPTURE_SCOPE
node --import tsx scripts/build-review-bundle.mts
powershell -NoProfile -NonInteractive -File scripts/archive-review-bundle.ps1
git diff --check
```

| Check | Final result |
| --- | --- |
| TypeScript/Vite production build | Passed; existing large-chunk warning remains |
| Canonical layout | Eight rows and complete provider summary; bottom **884.1875 px**, within unchanged 941 px gate |
| Languages/themes | English/Thai × dark/light |
| API ratio checks | 16 cache/price rails per variant match daemon values |
| Boundary fixtures | No denominator: em dash/no rail; zero: zero width; 0.5%: exact proportional style |
| Selection/search | Enter selects last model and updates detail identity; unmatched search removes table rows |
| Existing model detail access | 12 checks across token/call/API-value ranking routes passed; complete chart tables and zero/tiny bars retained |
| Responsive/access | 390/900/1280 overflow checks, 32 header cases, eight shell and eight font checks passed |
| Repeatability | **4/4 capture pairs byte-identical**, no masks or relaxed thresholds |
| Safety | In-memory synthetic DB and local response fixtures; no external/write requests or browser errors |

Exact measurements/hashes: [verification](redesign-v1.30/verification.json).
Candidates: [English dark](redesign-v1.30/models-en-dark.png),
[English light](redesign-v1.30/models-en-light.png),
[Thai dark](redesign-v1.30/models-th-dark.png),
[Thai light](redesign-v1.30/models-th-light.png).
The original concept and previous candidate were inspected; final English dark
and Thai light were visually checked for table rails, summary tiles and full panels.

## Package and limits

Archive: `tmp/review-bundles/QuotaPulse-v1.30-B5gK1O.zip`, 3,121 files,
199,840,923 compressed bytes. SHA256:
`c4913677f7fc682d449c36328f536493c09ad3829237998e278a1af3fa885262`.
Final inspection found zero scoped browser/build processes and a clean original
checkout. The previous v1.29 ZIP SHA256 remains
`63fc80245e908457a41e0dce684fcc8e4fd04571aca0006f315ca38c1790e1ae`.

Exact ZIP path, SHA256, size and full decompression/source comparison are in
[archive verification](redesign-v1.30/archive-verification.json).
[Bundle inventory](redesign-v1.30/bundle-build.json) records installed dependencies.
Extract into a fresh dedicated folder; use `scripts/start-review.ps1` and
`scripts/stop-review.ps1` for that instance. Windows x64 and installed Node ABI 127
are required. Readers stay disabled and fresh review databases are empty. Synthetic
capture fixture records are not shipped as production records.

This run covers Models and Settings access, not a new full eight-screen, all
unit/API, native lifecycle, installer or extracted-installation runtime run. ZIP
comparison uses the built bundle source. Other screen evidence remains historical.
Long identities, large row counts, manual accessibility, remaining screen styling
and complete RC gates still need review. These candidates are not approved visual
baselines or measured concept parity. Continue the dashboard refinement queue.
