# Overview redesign fidelity checkpoint v1.85.3

**Status: in progress; not approved visual sign-off.** The large-screen frame is more closely aligned with the supplied Overview concept, but parity remains well below the blueprint's 0.985 target.

## Reference and capture

- Reference: `refs/overview.png`, 1586 x 992.
- Current capture: [overview-actual-en-dark.png](overview-actual-en-dark.png).
- The running application continues to use daemon-backed data. The stable-capture browser test uses an isolated in-memory synthetic database.

## Changes in this checkpoint

- Matched the Pulse Core frame to x=228, y=68, width=977.09, height=394px. Its lower edge now aligns at y=462 while Runtime Map stays at y=475.5.
- Repositioned the wide-screen Workspace label and machine-scope control into the reference's horizontal arrangement. English bounds measure x=518.13 for the label and x=621.28, width=170px for the scope control; the concept's control begins around x=619.
- Added stable-capture assertions for Pulse Core geometry and Workspace alignment. Localized Thai text is checked for relative placement and baseline, while the English reference state is checked against measured source coordinates.
- Preserved the earlier map-column alignment, sidebar geometry, sampled dark panel token, and daemon-backed data integrity behavior.
- Kept quota denominators, cash savings, ROI, and productive-hour figures out of the UI when source data cannot support them.

## Parity diagnostic

`reference-parity.json` reports global mean local-window SSIM **0.5231** using sliding 11x11 uniform luminance windows and mean absolute RGB difference **16.98/255**. The prior v1.85.2 checkpoint measured SSIM 0.5199 and RGB difference 17.01/255. This local-window comparator is diagnostic and is not the blueprint's approved locked SSIM implementation. It compares the complete frame without masks and includes data and text differences.

| Region | Local SSIM |
|---|---:|
| Header | 0.543 |
| Sidebar | 0.736 |
| Pulse Core | 0.475 |
| Subscriptions and quotas | 0.484 |
| Runtime Map | 0.479 |
| Quota Runway | 0.543 |
| Pulse Insights | 0.365 |
| Live Activity | 0.472 |

The header and panel geometry are close to the reference, while typography, color intensity, decorative detail, and data-dependent card contents still differ. The reference includes quota denominators and ROI/productive-hour values that current daemon contracts do not support; those values remain data gaps rather than UI content to invent.

## Validation

- `npm run build -w @quotapulse/web` passed. Vite continues to report the existing 532.87 kB `App` chunk warning.
- `npm test` passed across daemon, web, and tray suites; tray reports 198/198 passing.
- `npm run test:ui` passed navigation, filters, cost states, periods, section/accessibility checks, empty/unavailable/recovery states, and EN/TH x dark/light at 390/900/1280/1440px without page errors.
- `QUOTAPULSE_CAPTURE_SCOPE=overview npm run test:stable` passed the complete EN/TH x dark/light matrix: 4 pairs, 2 byte-identical and 2 within the recorded raster tolerance; no masks. The evidence records a max channel delta of 10 and a changed-pixel limit of 0.002%.
- Stable-capture evidence is in [overview-stable-captures-full.json](overview-stable-captures-full.json); measured layout is in [layout-en-dark.json](layout-en-dark.json); [reference-heatmap.png](reference-heatmap.png) shows the remaining differences.

## Remaining work

1. Continue measured refinements in Pulse Core, subscriptions, Runtime Map, Pulse Insights, and Live Activity; Pulse Insights currently has the lowest regional score.
2. Keep the data-gap ledger explicit for quota capacities, ROI/productive hours, and relationships unsupported by recorded events.
3. Run the blueprint's approved SSIM implementation before claiming its 0.985 visual threshold.
4. Do not treat this checkpoint or tag as visual sign-off.
