# QuotaPulse visual fidelity checkpoint v1.83

## Review status

These are repeatable review captures, not approved visual baselines. This pass improves the Overview's match to the supplied concept while preserving daemon-backed data and usable controls. It does **not** claim 99–100% visual fidelity; the visual target remains open for another comparison pass.

The source concept is [the supplied Overview reference](../redesign-v1.44/source-overview.png). Open [the comparison viewer](reference-review.html) to switch language/theme and overlay the app capture on the reference. The four captures and full machine-readable evidence are included here.

## What changed

- The Runtime Map project filter and record detail are behind a keyboard-accessible options disclosure. It starts collapsed so the map title, breadcrumb, and flow legend remain clear. The project filter, graph details, table, and quota history remain usable.
- Runtime flow strokes now emphasize the highest-token routes and reduce secondary-line weight.
- The cache insight distinguishes known cache savings from cache read share and cache-pricing coverage. Known zero is displayed as zero; missing price coverage is displayed as unavailable instead of being presented as a measured saving.
- The connection label reports the daemon connection state rather than claiming all systems are operational.
- The sidebar version uses the installed package version.
- The sidebar brand block, cache metric support text, and responsive options panel were adjusted to better fit the concept.

## Data and capture limits

The application continues to use daemon data. These screenshots use the capture suite's **in-memory synthetic fixture**, not a live daemon or customer data. For the visual example only, the fixture supplies synthetic input and cached-input prices of USD 0.04 and USD 0.004 per million tokens; this produces the displayed USD 8.83 known cache savings. Those prices are test data and do not ship as application defaults. Production continues to display only daemon-reported cost/savings coverage.

## Layout comparison

The concept and captures are both 1586 × 992 pixels. This corrects the 1600 × 1000 viewport label in the v1.82 report.

Approximate concept column bounds and the measured English/dark app bounds are:

| Runtime Map column | Concept x / width | App x / width | Position delta |
| --- | ---: | ---: | ---: |
| Project | 282 / 208 px | 281.75 / 205.42 px | -0.25 px |
| Harness | 633 / 153 px | 630.59 / 151.92 px | -2.41 px |
| Provider | 953 / 160 px | 947.13 / 159.88 px | -5.88 px |
| Model | 1245 / 298 px | 1237.81 / 297.16 px | -7.19 px |

Main panel positions and these column bounds stay consistent across English/Thai and dark/light captures. Other differences remain in colors, icon treatment, line density, labels, illustrative values, and some spacing. Daemon truth and available data also constrain a few concept details. Compare the viewer before treating this checkpoint as visually accepted.

## Validation

- npm run build -w @quotapulse/web: passed. Vite reports the existing advisory that the app bundle exceeds 500 kB (last measured 532.87 kB).
- npm test: passed: daemon 100, web 152, tray 198; 450 total, 0 failed.
- QUOTAPULSE_CAPTURE_SCOPE=overview npm run test:stable: passed for English/Thai × dark/light at 1586 × 992. All four repeated pairs passed tolerance; three pairs were byte-identical, and Thai/dark differed by 65 pixels with maximum channel delta 1. The configured threshold is 0.0001 changed-pixel fraction and channel delta 2. No masks were used.
- The capture checks also cover the collapsed default, disclosure keyboard interaction, daemon-backed metric states, and Runtime Map overflow at 390, 900, and 1280 px.
- git diff --check: passed. Git emits only its CRLF-to-LF advisory for two edited source files.

See [verification.json](verification.json) for the capture matrix, fixture description, measured layouts, metric assertions, and repeat comparison.

## Remaining work

The visual-fidelity objective remains open. The next pass should continue comparing the shell, icon/logo treatment, color and glow balance, and detail spacing against the source reference while retaining accurate runtime values.
