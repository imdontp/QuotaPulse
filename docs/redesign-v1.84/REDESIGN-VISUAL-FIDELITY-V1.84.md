# QuotaPulse visual fidelity checkpoint v1.84

## Review status

This pass brings the 1586 × 992 Overview shell and main panel boundaries onto the source concept's desktop grid. Captures remain review candidates, not approved visual baselines. The work does **not** claim 99–100% fidelity; color/glow, some icons and content still differ.

Use [the comparison viewer](reference-review.html) for English/Thai, dark/light, and overlay comparisons with the [source concept](../redesign-v1.44/source-overview.png). This package includes all four captures, per-capture layout JSON, and the full verification manifest.

## Changes in this pass

- At the concept review viewport, the Overview sidebar and topbar brand column are 211 px. Main dashboard frames now start at x=211 and end at x=1565.
- The brand mark stays at x=20, its wordmark begins at x=78, and the daemon/workspace context begins alongside the concept header.
- Sidebar menu spacing is tighter. Quick Stats remains at x=12, y=421 with a 190 px width.
- Inner panel padding preserves the already aligned metric and graph positions when the panel frame moves left.
- The bottom row split now follows the concept's wider Quota Runway and right Insights panel.
- The in-memory reference fixture now has 4 Codex, 2 Claude Code, and 6 Hermes sessions in the selected QuotaPulse project. No application runtime data is replaced.

## Measured app layout

Measured from the production build capture at 1586 × 992:

| Area | App bounds |
| --- | --- |
| Hero | x=211, y=68, w=995.1, h=397.2 px |
| Runtime Map | x=211, y=473.2, w=1354, h=231 px |
| Bottom row | x=211, y=714.2, w=1354, h=176.4 px |
| Quick Stats | x=12, y=421, w=190, h=287.5 px |

Runtime Map column positions remain close to the source concept:

| Column | Concept x / width | App x / width |
| --- | ---: | ---: |
| Project | 282 / 208 px | 281.75 / 205.42 px |
| Harness | 633 / 153 px | 630.59 / 151.92 px |
| Provider | 953 / 160 px | 947.13 / 159.88 px |
| Model | 1245 / 298 px | 1237.81 / 297.16 px |

See the four layout JSON files for exact language/theme measurements.

## Data and remaining differences

The application still uses daemon data. These screenshots use the stable capture suite's **in-memory synthetic fixture**. For visual review, that fixture supplies synthetic pricing components that yield the displayed USD 8.83 known cache savings; the fixture values do not ship in the application.

The selected QuotaPulse Runtime Map displays only recorded event relationships. The concept shows an OpenCode node with zero sessions; this capture omits that node because the selected project fixture has no OpenCode events. Other remaining visual differences include provider/model icon treatment, map edge density, glow balance, text/details, and concept-only values. Values that are unavailable or illustrative in the reference remain daemon-derived or explicitly unavailable in the application.

## Validation

- npm run build -w @quotapulse/web: passed. The existing Vite advisory remains for the 532.87 kB App chunk.
- npm test: passed across daemon 100, web 152, tray 198; 450 total, 0 failed.
- QUOTAPULSE_CAPTURE_SCOPE=overview npm run test:stable: passed English/Thai × dark/light at 1586 × 992. Three repeated pairs were byte-identical; English/dark differed by 65 pixels with maximum channel delta 1. The configured limits are 0.0001 changed-pixel fraction and channel delta 2. No masks were used.
- Capture checks cover the 211 px Overview shell, brand fit, compact navigation rhythm, fixed Quick Stats position, source-aligned panel/node geometry, and responsive overflow at 390, 900, and 1280 px.
- git diff --check: passed.

The visual-fidelity objective remains open. The next pass should continue matching the source's color/glow balance, icon treatments, and remaining component details while keeping runtime values and event relationships truthful.
