# Cost native frame v1.85.24

## Implemented

- Native overview frame contains the heading, controls and summary beside the provider panel. Summary cards are 187px; donut is 184px with a 130px center.
- Trend/model grid ratio is 1.255:1; actual chart plot remains 190px.
- Actual-series legend and coverage/data disclosure share the chart frame. Complete expanded tables remain available by keyboard.
- Custom/source scope occupies the desktop heading subtitle slot; original subtitle remains accessible. Smaller widths retain a flowing scope notice.
- Thai heading copy now uses available flex width. Measured shrink-to-fit width previously wrapped the subtitle and increased overview height to 266.67px. Corrected overview is 259px in both languages and themes. The Thai unit-price card uses 22px type on wide desktop to prevent its longer currency prefix from splitting the amount.
- Added plot spacing after the browser gate detected the section icon overlapping the top amount-axis label. Existing overlap checks pass after correction.
- Route parsing, request keys, actual amounts, missing values and callbacks remain intact. Layout checks compare outer overview/provider frames and verify summary containment, rather than equating inner-card and outer-frame y.
- Occupied Alerts exposed an independent layout defect: risks and reader advisories
  had separate scrolling lists, making the risk panel 340.58px and pushing rules
  to bottom982.14 at 1672×941. They now share one keyboard-focusable list bounded
  at232px on desktop; all entries and their Provider/Diagnostics links remain.

## Evidence

| Check | Actual result |
| --- | --- |
| Web production build | Pass, final build session60523 exited0. Existing bundle-size advisory remains. |
| Web unit tests | 152 pass, zero failures, session74994 exited0 before the later Alerts DOM consolidation; final changed behavior is checked by browser gates. |
| `git diff --check` | Pass. |
| `QUOTAPULSE_CAPTURE_SCOPE=cost npm run test:stable` | Pass, final session28698 exited0: four pairs, three byte-identical and one within recorded raster tolerance; no masks. Includes single-line unit amount, source regions, overlap, complete table/keyboard, API values and 390/900/1280 checks. |
| Alerts stable captures | Pass, session84408 exited0 against final build: four byte-identical pairs, en/th × dark/light, complete sample tables, unknown/reset gaps, forecast API facts and 390/900/1280 overflow. See alerts-capture-verification.json and four alerts-*.png images. |
| Full `npm run test:history` | Pass, final session2273 exited0: authenticated API/in-memory SQLite, all page workflows, 16 responsive matrix cases × nine destinations, Cost route compatibility and money semantics, occupied Live/Projects/Cost/Alerts, exact scopes and keyboard/focus. Shared risk/advisory list and last-entry keyboard reachability pass in all four languages/themes. See workflow-verification.json, responsive-matrix.json and occupied layout manifests. |

Production `packages/web/dist/index.html` SHA-256:
`4e23e758cec4dba8d06c318371a51c58cb7fb31a2b5c22310bc2e22cf3d3c94f`.

The Cost production capture manifest records the preceding build hash
`7085a9376c96f4149b4f188134ab32031810cb05f1f01d3551e9a488eaaa5051`;
Cost code/CSS have not changed since those captures. The final rebuild includes
the Alerts correction, whose capture evidence and full workflow are separate.

Prior temporary approval-review credit error was resolved: execution through the required approval path succeeded. It is not a current blocker.

Original reference PNG SHA-256 values (under the supplied Downloads refs directory):

- `cost.png`: `f90cf0c904c8dcc7872032207ba4aebf849d9f891809e66884c4c7bf5689f88a`
- `alerts.png`: `f2d05a17e7613035e2a41302baf6a8792ed519de66af0ab159dd56842062f104`

Diff review: changes are limited to native Cost presentation, its geometry gates,
Alerts list containment and source-correct layout gate, and evidence documentation. No dependencies,
daemon behavior, API calculation or user data were changed. Tests use synthetic
in-memory databases. The isolated branch/origin remain unchanged.

## Measured source regions

Canonical 1672×941 screenshots use the month route and synthetic records through the real API. The production application continues to display its actual data. Measurements are source region estimates, with a 3px bound, not similarity scores.

| Region | Source estimate | Actual (all four language/theme cases) |
| --- | --- | --- |
| Overview x/y/width/height | 238 / 72 / 960 / 258 | 238 / 72 / 960.06 / 259 |
| First summary card x/y/height | 250 / 131 / 187 | 251 / 131 / 187 |
| Provider x/y/width/height | 1206 / 72 / 454 / 258 | 1206.06 / 72 / 453.94 / 259 |
| Donut width/height | 184 / 184 | 184 / 184 |
| Trend y/height | 341 / 302 | 343 / 302 |
| Model panel x/y/height | 1035 / 341 / 302 | 1033.83 / 343 / 302 |
| Lower panel bottom | Below 941 | 931 |

See [capture verification](cost-capture-verification.json), [region measurements](cost-reference-layout.json) and four `cost-*.png` images. Direct image inspection confirms closer outer composition. Different real values, unavailable projections and sparse observed charts are preserved facts. Typography, donut segment treatment and detailed table/insight styling still differ from the concept; this checkpoint does not claim 99–100% likeness.

## Failure diagnosis retained

Session69429 exposed the inherited Alerts alignment assertion. Original
`refs/alerts.png` places forecast at y72 beside the heading; summary is below.
After correcting that assertion, session42949 exposed actual rules overflow.
The final shared-list correction resolves the original viewport symptom in
session2273 without relaxing the viewport limit, dropping rows or inventing data.
Occupied risk height is 290.80px; rules bottom is 932.36 and history bottom is
813.84 in all four language/theme cases, versus rules bottom982.14 before repair.

## Remaining full goal

[Remaining audit](REMAINING-GOAL-AUDIT.md) preserves the eight-page design target,
approved visual baseline, manual accessibility, current performance and release
evidence. Checkpoint: `redesign-visual-fidelity-v1.85.24` on isolated
`design/redesign-foundation`, existing QuotaPulse origin. Unrelated `.zed/` is
untouched. The broader visual goal remains incomplete.
