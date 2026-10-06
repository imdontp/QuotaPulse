# QuotaPulse redesign fidelity checkpoint v1.85.4

**Status: implementation in progress; not approved visual sign-off.** This checkpoint improves page density and content accuracy, and restores the global navigation contract. Reference parity remains far below the blueprint's 0.985 target.

## Reference and evidence

- Reference: `refs/overview.png`, 1586 x 992; SHA-256 verified against the v1.1 blueprint manifest (`924849d96af48d5f0aae3ab330e01df929485020ef91e9c0516f1fd7cc0d96ce`).
- Current capture: [overview-actual-en-dark.png](overview-actual-en-dark.png).
- Full browser evidence: [stable-captures-full.json](stable-captures-full.json); measured geometry: [layout-en-dark.json](layout-en-dark.json).
- Parity diagnostic: [reference-parity.json](reference-parity.json); heatmap: [reference-heatmap.png](reference-heatmap.png).
- Stable-capture fixtures use an isolated in-memory database. The running app continues to use daemon-backed data.

## Changes in this checkpoint

- **Live:** tightened matrix gaps and row padding by one pixel so the reference-height desktop view fits without overflow.
- **Models:** moved the header, totals, filters, comparison and provider distribution into the left primary column; the model detail rail starts at the top-right and no longer expands the page grid. Added a settled-request barrier after restoring the model search in the capture test.
- **Overview insights:** renamed “High burn rate” to “Token usage change” because the available totals do not calculate a burn rate. Pricing coverage appears only when the recommendation is to check pricing. Adjusted insight icons and card density while retaining live values.
- **Global navigation:** implemented OVR-001 by keeping More visible on Overview and checking all nine destinations from More on every route. The control fits inside the existing sidebar and Quick Stats geometry.
- **Capture reliability:** normalize CSS transitions and carets only before screenshot capture. The test records this normalization, applies no masks, and permits a maximum channel delta of 10 across at most 0.005% of pixels. The fraction was raised from 0.002% after a repeatable 45-pixel, one-channel difference was traced to sidebar-edge rendering; a separate alert-badge transition variance was eliminated by capture normalization.
- **Capture output:** all-pages mode can reuse the measured Overview layout file, fixing a missing-file failure when running outside Overview-only scope.

## Parity diagnostic

The repository's local 11x11-window SSIM diagnostic reports global SSIM **0.5245** and mean absolute RGB delta **16.82/255**. The previous v1.85.3 capture reported 0.5231 and 16.98/255. This comparator is diagnostic, not the blueprint's approved locked SSIM implementation; it includes text, production-valid data substitutions and the required More control.

| Region | Local SSIM |
|---|---:|
| Header | 0.543 |
| Sidebar | 0.730 |
| Pulse Core | 0.475 |
| Subscriptions and quotas | 0.484 |
| Runtime Map | 0.479 |
| Quota Runway | 0.547 |
| Pulse Insights | 0.421 |
| Live Activity | 0.459 |

Pulse Insights improved from 0.365 to 0.421. Sidebar parity decreased from 0.736 to 0.730 because OVR-001 requires More to remain visible on Overview even though the original concept omits it. No reference override permits inventing quota denominators, ROI, productive hours or burn-rate claims.

## Validation

- `npm run build -w @quotapulse/web` passed. Vite retains the existing 532.87 kB App chunk warning.
- `npm test` passed: daemon 100/100, web 152/152, tray 198/198 (450 total).
- Full `npm run test:stable` passed across all nine routes, EN/TH and dark/light: 40 screenshot pairs (80 screenshots), 35 byte-identical and five within recorded raster tolerance; no masks. The largest repeat difference was 43 pixels with a maximum channel delta of 5. The matrix checked navigation, responsive overflow, data semantics, keyboard paths, no browser errors and no write/external requests.
- Overview-specific EN/TH dark capture passed independently with two byte-identical pairs. Live, Models and Overview had targeted captures during implementation.
- `git diff --check` passed.

## Remaining work

1. Continue measured refinements to colors, typography, globe and chart decoration, subscriptions, and the remaining page compositions.
2. Measure all eight reference screens with the blueprint-approved parity implementation before claiming its 0.985 threshold.
3. Keep production visuals truthful when source data does not provide the concept's denominators or derived metrics.
4. Keep this checkpoint and tag explicitly in progress; neither is visual sign-off.
