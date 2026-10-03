# v1.31 — Cost trend axes

## Objective and scope

Continue the dashboard blueprint v1.1 on the isolated `design/redesign-foundation`
worktree. The original Cost concept includes monetary/token axes and date labels;
the v1.27 candidate only showed a textual scale below its sparse chart. This slice
adds visible scales and range endpoints using the existing facts and queries.
No pet, popup, installer, account, dependency, database or API-contract change is
introduced.

## Changes

- `cost.tsx`: the trend has separate monetary and priced-token axes at five
  quarter-step ticks. The selected API/native basis and selected currency format
  the monetary axis. Range endpoints use the exact response scope and localized
  date/time, with machine-readable ISO timestamps. Existing columns, priced-token
  markers, coverage disclosure and complete bucket table remain.
- `cost.css`: a responsive three-column plot aligns two scales with the actual
  plotting area, quarter-step grid and 10 px tick labels. The desktop plot retains
  125 px height; narrow plots retain 175 px. Dates wrap without page overflow.
- `check-stable-captures.mts`: optional Cost scope retains four repeated candidates
  plus Settings access separately. Existing API/native/unpriced-source routes now
  check five ticks against daemon maxima, localized monetary labels, exact scope
  timestamps, proportional columns and absence of a plot when pricing is unknown.
  Default all-screen scope includes these new checks.
- `build-review-bundle.mts`: advances only the review checkpoint label to v1.31.

Money and priced tokens remain distinct scales. Missing pricing does not become
zero monetary usage, and sparse observations do not become interpolated history.
Existing range selection and elapsed-day averaging remain unchanged. The all-time
scope starts at epoch; its visible endpoint therefore describes the query range,
not the first recorded usage event. This is not a change to that scope contract.

## Validation — Validated for this slice

```powershell
npm run build -w @quotapulse/web
$env:QUOTAPULSE_CAPTURE_SCOPE = 'cost'
node --import tsx scripts/check-stable-captures.mts
Remove-Item Env:QUOTAPULSE_CAPTURE_SCOPE
node --import tsx scripts/build-review-bundle.mts
powershell -NoProfile -NonInteractive -File scripts/archive-review-bundle.ps1
git diff --check
```

| Check | Final result |
| --- | --- |
| TypeScript/Vite production build | Passed; existing large-chunk warning remains |
| Languages/themes | English/Thai × dark/light |
| Axis/data checks | 12 route cases across API, native and unpriced native source |
| Plot with pricing | Five ticks per axis match daemon maxima; monetary text and ISO scope endpoints checked |
| Unpriced scope | No monetary plot or axes shown |
| Existing bucket access | 12 complete-table, known-zero/partial/unknown and responsive checks passed |
| Collapsed occupied layout | API/native month routes bottom **914.3125 px**, within unchanged 941 px gate |
| Responsive/access | 390/900/1280 overflow checks, 32 header cases, eight shell and eight font checks passed |
| Repeatability | 4/4 pairs passed; three byte-identical; English dark differs at 14 pixels, maximum channel delta 1 |
| Tolerance | Existing max delta 2 and changed fraction 0.0001, no masks or threshold relaxation |
| Safety | In-memory synthetic DB; no external/write requests or browser errors |

Tick typography was enlarged after inspecting the first captures; the production
build and original capture/data gates were rerun for the final assets.
Exact measurements and hashes: [verification](redesign-v1.31/verification.json).
Candidates: [English dark](redesign-v1.31/cost-en-dark.png),
[English light](redesign-v1.31/cost-en-light.png),
[Thai dark](redesign-v1.31/cost-th-dark.png),
[Thai light](redesign-v1.31/cost-th-light.png).
Original concept and previous candidate were inspected; final Thai light was
visually checked for tick labels, date endpoints and complete lower panels.

## Package and limits

Archive: `tmp/review-bundles/QuotaPulse-v1.31-wEgwqE.zip`, 3,121 files,
199,841,270 compressed bytes. SHA256:
`c7f3c8e28299184b187b3acc085b000eba2c5c074906e7d8ed7e041137210523`.
Final inspection found zero scoped browser/build processes and a clean original
checkout. Previous v1.30 ZIP SHA256 remains
`c4913677f7fc682d449c36328f536493c09ad3829237998e278a1af3fa885262`.

Exact ZIP path, SHA256, size and full entry-decompression/source comparison are in
[archive verification](redesign-v1.31/archive-verification.json).
[Bundle inventory](redesign-v1.31/bundle-build.json) records installed dependencies.
Extract into a fresh dedicated folder; use `scripts/start-review.ps1` and
`scripts/stop-review.ps1` for this instance. Requires Windows x64 and installed
Node ABI 127. Readers remain disabled, with empty fresh review databases. Synthetic
capture records are not shipped as production data.

This run covers Cost and Settings access, not a new full eight-screen, all unit/API,
native lifecycle, installer or extracted-installation runtime run. ZIP comparison
uses the built bundle source. Other screen evidence remains historical. Manual
accessibility, other currencies/large amounts, long identities, remaining styling
and complete RC gates still need review. These candidates are not approved visual
baselines or measured concept parity. Continue the dashboard refinement queue.
