# v1.34 — Alerts refinement and combined dashboard review

## Implementation scope

Continue blueprint v1.1 in the isolated `design/redesign-foundation` worktree.
Alerts now has decorative summary/section icons, threshold badges with distinct
50/80/95 styling, clearer event identity/date grouping and compact chart spacing.
Long risk/event lists scroll on desktop and retain their complete rendered data.
The risk list and event history are keyboard-focusable, named native lists.

Changes are in `redesign/alerts.tsx` and `redesign/alerts.css`. Existing risk
calculation, forecast eligibility, owner/window selection, notification controls,
read-only rules and event delivery status remain. No provider/workload automation,
invented forecast curve, latency, completion state or extra alert rule is added.
The sparse default chart still shows only the selected owner's observed readings.
The selected fixture owner has insufficient samples for a forecast; its panel
continues to disclose that fact rather than showing concept-only predictions.

The stable-capture harness adds an Alerts scope and checks real fixture event
thresholds against the API, threshold colors, the 100/500-event show-more query,
empty history and a complete 60-event local response fixture. The default all-page
scope includes these checks. Only the review builder label advances to v1.34;
dependencies, native modules, account/profile handling, pet and popup stay intact.

## Validation — Validated for implementation and combined browser gates

```powershell
npm run build -w @quotapulse/web
$env:QUOTAPULSE_CAPTURE_SCOPE = 'alerts'
node --import tsx scripts/check-stable-captures.mts
Remove-Item Env:QUOTAPULSE_CAPTURE_SCOPE
node --import tsx scripts/check-stable-captures.mts
node --import tsx scripts/build-review-bundle.mts
powershell -NoProfile -NonInteractive -File scripts/archive-review-bundle.ps1
git diff --check
```

The scoped Alerts run first passed four byte-identical pairs. Event badge spacing
was then refined after visual inspection, followed by a fresh production build
and the **final combined run** below. Published candidates and verification come
from that combined run, not the preliminary scoped assets.

| Final combined check | Result |
| --- | --- |
| Production build | TypeScript/Vite passed; existing chunk-size warning remains |
| Screens | Overview, Live, Projects, Providers, Models, Cost, History, Alerts |
| Language/theme | English/Thai × dark/light; Settings shell access separately |
| Captures | **72 screenshots / 36 repeated pairs**, including four selected History states |
| Repeatability | **35 byte-identical pairs**; Projects Thai dark differs at seven pixels, maximum channel delta 2 |
| Raster gate | Original max delta 2, changed fraction 0.0001, **no masks** or threshold relaxation |
| Shell/fonts | 144 header cases, 36 shell/access cases, 68 bundled-font checks passed |
| Chart/data access | Eight Live/Projects table checks, 24 Models/Cost detail-route checks, 12 Cost axis checks |
| Quota/runtime | Eight complete quota-history checks and four Runtime Map checks; unknown/reset gaps preserved |
| Selection/layout | Four cases each for Overview, Projects, Providers, Models, History details and History density |
| Alerts | Four API-matched threshold/history cases; show-more/less and empty history passed |
| Long Alerts history | All 60 synthetic events retained; keyboard End reaches the final event; 390/900/1280 page overflow checks pass |
| Alerts occupied layout | Main/rail panels end at **798.9375 px**, inside unchanged 941 px gate |
| History occupied layout | Five complete rows and pagination fit; card bottom **936.796875 px**; all 37 today-scope fixture records retained |
| Safety | In-memory synthetic DB; no external/write requests, live readers or browser errors |

Overview retains its 1586 × 992 capture viewport; other canonical pages use
1672 × 941. Each language/theme set uses a fresh renderer in each pass, a frozen
daemon/browser clock, bundled fonts, reduced motion, DPR 1 and Asia/Bangkok time.
Exact counts, API evidence, geometry and hashes are in
[combined verification](redesign-v1.34/verification.json).
All 36 normal/selected candidate files are stored in `docs/redesign-v1.34`.
The original Alerts concept, previous candidate, final Thai dark and Thai light
Alerts candidates were visually inspected.

## Current dashboard candidates

| Screen | English dark | Thai light |
| --- | --- | --- |
| Overview | [View](redesign-v1.34/overview-en-dark.png) | [View](redesign-v1.34/overview-th-light.png) |
| Live | [View](redesign-v1.34/live-en-dark.png) | [View](redesign-v1.34/live-th-light.png) |
| Projects | [View](redesign-v1.34/projects-en-dark.png) | [View](redesign-v1.34/projects-th-light.png) |
| Providers | [View](redesign-v1.34/providers-en-dark.png) | [View](redesign-v1.34/providers-th-light.png) |
| Models | [View](redesign-v1.34/models-en-dark.png) | [View](redesign-v1.34/models-th-light.png) |
| Cost | [View](redesign-v1.34/cost-en-dark.png) | [View](redesign-v1.34/cost-th-light.png) |
| History | [View](redesign-v1.34/history-en-dark.png) | [View](redesign-v1.34/history-th-light.png) |
| Selected History | [View](redesign-v1.34/history-selected-en-dark.png) | [View](redesign-v1.34/history-selected-th-light.png) |
| Alerts | [View](redesign-v1.34/alerts-en-dark.png) | [View](redesign-v1.34/alerts-th-light.png) |

## Package and release boundaries

Archive: `tmp/review-bundles/QuotaPulse-v1.34-NbFoG8.zip`, 3,122 files,
199,843,379 compressed bytes. SHA256:
`f19a0a7063394f40145585078764c8d82556c3a96c4b5dc784941923b3a5d379`.
The original checkout remains clean. Previous v1.33 archive SHA256 remains
`613fe537c94eb50f67ba87231a05a4fc762e9115b46d4884aa60499034155396`.
Final scoped process inspection found zero remaining capture/build processes.

[Bundle inventory](redesign-v1.34/bundle-build.json) and
[archive verification](redesign-v1.34/archive-verification.json) record the fresh
unsigned Windows review package and per-entry decompression/SHA256 comparison to
its built source. Extract into a fresh dedicated folder, then run
`scripts/start-review.ps1` and `scripts/stop-review.ps1`. Requires Windows x64 and
installed Node ABI 127. Readers remain disabled; a new review database is empty.
Capture fixtures are test data and are not shipped as production profile records.

The cumulative dashboard browser gate now has fresh combined evidence. This is
not approval of visual baselines, measured concept SSIM parity, manual
screen-reader acceptance, performance certification or a production release.
All-unit/API suites, History clipboard/export/pagination regression, extracted
installation runtime, native lifecycle and signed distribution were not rerun in
this checkpoint. Existing costs, custom ranges, stale/error states and long labels
still need the broader release/manual review prescribed by the blueprint.
Original application, profile and prior checkpoint artifacts remain preserved.
Next: review the combined candidates, finish any concrete remaining design issues,
and close the applicable dashboard release-candidate gates.
