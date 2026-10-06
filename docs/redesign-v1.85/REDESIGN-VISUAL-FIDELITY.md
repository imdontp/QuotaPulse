# Overview redesign fidelity checkpoint v1.85

**Status: in progress. This is not visual sign-off.** The latest screen is closer to the supplied Overview reference, but it does not meet the blueprint's 99% parity goal.

## Reference and current capture

- Reference: `refs/overview.png`, 1586 x 992.
- Current capture: [overview-actual-en-dark.png](overview-actual-en-dark.png).
- The live app continues to use daemon data. The stable-capture browser test uses an isolated in-memory synthetic database.

## Changes in this checkpoint

- Matched the 1586px desktop frame: main content begins at x=228, hero center at about x=735, quota groups extend to the reference right edge, and the lower columns use the reference 707/618px split.
- Repositioned and strengthened the Pulse globe/orbit treatment; adjusted the quota runway track width and lower panel spacing.
- Reduced secondary Runtime Map line brightness so the measured active routes read first while preserving the recorded graph edges.
- Aligned the four Runtime Map columns to whole-pixel x positions and tightened their source-bound checks to 2px; the latest capture measures x=282/633/953/1245, with connector endpoints at 0px error.
- Positioned the Pulse artwork bounds at x=550.05, y=69, width=369, height=328 while keeping the runway control position fixed.
- Changed the Insights heading mark to the reference-style sparkle icon.
- Kept daemon-backed quota percentages, source status, routes, costs, and activity. The UI does not infer missing token limits, cash savings, ROI, or productive hours.
- Clarified the cache metric as API-equivalent value in English and Thai.
- Added enabled but currently unused harnesses to the Runtime Map at zero, without adding graph edges that have no recorded events. Project and harness cards use the daemon's recent active-session count.

## Parity diagnostic

`reference-parity.json` reports a mean local SSIM of **0.517** using sliding 11x11 uniform luminance windows; the mean absolute RGB channel difference is **17.18/255**. The comparison includes all real-data/text differences and applies no masks. This local-window implementation is diagnostic; it is not the approved locked SSIM implementation from the blueprint.

| Region | Local SSIM |
|---|---:|
| Header | 0.532 |
| Sidebar | 0.739 |
| Pulse Core | 0.468 |
| Subscriptions and quotas | 0.480 |
| Runtime Map | 0.478 |
| Quota Runway | 0.535 |
| Pulse Insights | 0.361 |
| Live Activity | 0.469 |

Frame geometry is now close, while typography, color intensity, route density, and data-dependent card contents still differ. The reference includes quota denominators and ROI/productive-hour values that the current daemon contracts cannot support. Those remain data gaps rather than UI values to invent.

## Validation

- `npm run build -w @quotapulse/web` passed. Vite still reports the existing 532.87 kB `App` chunk warning.
- `npm test` passed with exit code 0.
- Full Overview stable-capture matrix passed after the latest changes for EN/TH x dark/light: 4/4 byte-identical pairs, no masks. Evidence is in [overview-stable-captures-full.json](overview-stable-captures-full.json).
- Runtime Map card x/width values are recorded in [layout-en-dark.json](layout-en-dark.json); all four are within 1px of their source bounds, and the connector endpoints match their nodes exactly.
- The generated [reference-heatmap.png](reference-heatmap.png) shows remaining image differences without masking any region.
- `git diff --check` passed.

## Remaining work

1. Continue measured typography, color, map-node, and panel-detail alignment against the other reference states.
2. Keep the data-gap ledger explicit for quota capacities, ROI/productive hours, and relationships unsupported by events.
3. Run the blueprint's approved SSIM implementation before claiming the 0.985 visual threshold.
4. Do not mark this checkpoint as an approved visual baseline.
