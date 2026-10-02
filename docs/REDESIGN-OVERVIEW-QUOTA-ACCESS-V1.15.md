# Overview quota history access checkpoint - 1.15.0

Branch: `design/redesign-foundation`.
Tag: `redesign-overview-quota-access-v1.15.0`.
Follows [Models/Cost chart access 1.14](REDESIGN-MODEL-COST-CHART-ACCESS-V1.14.md).
Overall visual/accessibility/release approval remains pending.

## Implementation

Overview's observed quota disclosure now reuses the existing Alerts quota chart.
It includes every segment/sample returned by the selected reader's history API,
replacing the last-three-segments/last-eight-readings display. API time bounds
remain unchanged; completeness refers to that response, not unlimited history.
The fixed 112 px chart uses actual observation times and a 0–100% axis. Known
zero is at the zero baseline, unknown readings create no points, and unknowns
and reset boundaries break connections. This replaces Overview's 4% minimum
height for zero/unknown samples and equal spacing between observations.

Both Overview and Alerts now have a captioned sample table with column scope
headers, ISO time semantics, localized dates, exact recorded percentage values
and reset dates. Decimal percentages retain their values rather than being
rounded through the compact percentage formatter. Unknown percent/reset dates
are labeled Unknown. A native nested disclosure supports keyboard opening and
closing; the table is outside the image. Overview mounts its full plot only
while the outer disclosure is open, and both pages mount rows only while the
samples disclosure is open. Closing removes those elements; opening shows every
returned sample. The image accessible name summarizes range/time/counts rather
than repeating every value before the separately accessible complete table.
Empty sample arrays render a status
message rather than an infinite/invalid time axis. Resize observation reconnects
when the history changes, including recovery from an empty response.

The chart's CSS moves from Alerts into its shared component stylesheet so direct
Overview navigation has the same graph and table presentation. Old Overview-only
bar CSS is removed. Overview also reports a history fetch error when a prior
reader snapshot is retained. No forecasting formula, quota selection, provider
reading, query scope, schema, API or installed desktop behavior is changed.

## Validation

- Production web build passes. The existing legacy App chunk warning remains.
- `npm run test:stable` passes 32 screenshot pairs: 31 byte-identical and one within
  the unchanged raster tolerance, with every pixel compared and no masks or relaxed thresholds.
- Eight quota-access cases cover both pages, English/Thai and dark/light.
  Each uses a real authenticated daemon API response from an in-memory synthetic
  DB: 53 samples in five segments, four unknown values, known zero, 0.5%, an
  unknown reset date, and more than eight readings in a segment. The latest
  live quota remains unchanged so selection is consistent with prior fixtures.
- Every table row, localized date/percentage, reset value and ISO timestamp is
  compared against the API. Every known point's time/percentage coordinates
  are checked, along with segment and connecting-line counts. Zero, unknown
  and reset cases must be present, preventing vacuous success.
- Enter opens/closes the sample table and Overview's outer disclosure. Expanded
  tables cause no page-width overflow at 390/900/1280 px. Four additional Overview
  sequences use synthetic GET responses for all-unknown samples, an empty segment
  and recovery; no unknown point/line or invalid empty chart is rendered.
- Existing Live/Projects and Models/Cost table checks, semantic text contrast,
  browser errors, horizontal overflow and external/API-write request guards pass.
- `npm run test:history` passes 144 responsive cases and all existing functional,
  occupied layout and monetary fixtures. This full run preceded the final lazy
  disclosure mount refinement; the final production gate then checked both pages'
  chart/table mount removal, keyboard interactions and data/empty recovery.
  The full functional suite is not repeated for that mount-only refinement.

The functional suite's Overview selectors now assert the shared SVG's two reset
groups instead of the removed bar lists, and target the outer summary explicitly
because it contains a second disclosure. Existing behavioral/geometry assertions
remain. No unit, desktop or installer suite is repeated for this frontend scope.

## Evidence and remaining work

Status: **Validated checkpoint**.

See [production verification](redesign-v1.15/verification.json),
[functional verification](redesign-v1.15/functional-verification.json),
[responsive matrix](redesign-v1.15/responsive-matrix.json) and
[concept regions](redesign-v1.15/review-candidates.json), alongside sixteen
focused collapsed/expanded candidates. `git diff --check` passes. Expanded
captures show a viewport within a longer page; API assertions cover all rows.
Candidates are synthetic, not approved visual baselines or concept SSIM results.

No live usage DB/provider or installed tray/task is accessed. The original
checkout remains unchanged. Manual screen-reader checks, other visualizations,
complete typography/decoration, reviewed visual baselines/SSIM and packaged
tray/installer release checks remain open.
