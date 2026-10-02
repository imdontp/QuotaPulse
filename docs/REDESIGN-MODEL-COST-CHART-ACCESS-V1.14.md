# Models and Cost chart access checkpoint - 1.14.0

Branch: `design/redesign-foundation`.
Tag: `redesign-model-cost-chart-access-v1.14.0`.
Follows [chart access 1.13](REDESIGN-CHART-ACCESS-V1.13.md).
Overall visual/accessibility/release approval remains pending.

## Implementation

Models now provides its complete trend series through the shared native disclosure
and captioned table. It displays recorded tokens or weighted calls according to
the selected metric, including zero buckets, localized exact counts and bucket
timestamps. Ranking by API value still displays a token trend and explicitly
labels that unit; no monetary time series is invented. Bars use actual relative
values, replacing the previous 2% minimum that drew zero buckets as nonzero.
The shared table now accepts a numeric value and unit label; Live and Projects
retain their token values and existing behavior.

Cost provides a separate captioned table for the selected API/native basis, with
bucket time, known value, priced tokens and priced/all weighted calls. It reuses
the existing monetary formatter and coverage-aware CostValue: empty buckets show
zero, populated unpriced buckets show Unknown, and partial known values retain
the plus sign. The disclosure remains available when calls exist but the selected
basis has no priced calls. It is outside the chart image. Tables expand through
Enter, have column headers and allow localized timestamps to wrap or scroll.

The collapsed Cost disclosure shares its existing scale row. Its desktop plot
is 125 px rather than 135 px to reserve space for the 24 px summary control.
Models uses a 48 px desktop plot and 10 px detail-panel padding to keep all effort
and context information in the concept viewport after adding scale/data access.
Expanded tables may extend the page vertically; collapsed detail must remain
within 941 px. No rows or metadata are removed to meet that gate.

## Validation and investigation

- Production web build passes, retaining the existing legacy App chunk warning.
- The functional suite passes its 144 responsive cases plus existing scopes,
  History links, monetary coverage, zero/unknown/partial price fixtures and
  occupied layout checks. Rich Cost panel bottoms are 830.34/915.53/922 px in
  all four language/theme cases. The functional Models rail ends at 921.47 px.
- The initial functional attempt timed out because its readiness check required
  the first zero-height Models bar to be visible. Both checks now wait for its
  attachment; value/geometry assertions remain and the full suite passes.
- Production table checks independently inject the daemon API using the UI's
  actual scope/model/provider/basis. All rows, localized visible values, ISO/date
  timestamps, coverage and model bar percentages are compared. Twelve Models
  cases cover tokens/calls/API-value ranking; twelve Cost cases cover API/native
  and a source with no native prices. Explicit one-value, zero, known-zero-price,
  partial-price and unknown-native fixtures prevent vacuous success. Each case
  checks Enter open/close and expanded-page overflow at 390/900/1280 px.
- The first production build passed 32 byte-identical capture pairs. After the
  spacing adjustment, repeated capture attempts differed at 63 pixels, maximum
  channel delta 13, localized to the Models heading/search SVG icons at x=255..262,
  y=82..179. Independent browser processes per route did not resolve this.
  A Models-only reproduction found identical SVG markup, bounding rectangles and
  every computed style in both passes, narrowing the symptom to raster output
  rather than a demonstrated DOM/layout difference.
- Explicit geometricPrecision on just those two icons passes the Models-only
  reproduction for all four language/theme pairs. This is evidence for the
  rendering-hint correction, not a diagnosis of Chrome/Skia's internal mechanism.
  The ineffective process-isolation change is reverted. The full original
  capture workflow is repeated with the same max-channel-delta 2 / changed-pixel
  fraction 0.0001 limits, all pixels decoded and no masks.

Status: **Validated checkpoint**.

Final production capture gate passes all 32 pairs: 30 byte-identical, two within
the unchanged raster tolerance. All 24 Models/Cost table-access cases and eight
existing Live/Projects cases pass. Browser-error, external/API-write request,
horizontal overflow, semantic contrast and complete collapsed-layout gates pass.
See [production verification](redesign-v1.14/verification.json) and
[raster investigation](redesign-v1.14/raster-investigation.json).
`git diff --check` passes. The eight focused PNGs are review candidates.

Evidence: [responsive matrix](redesign-v1.14/responsive-matrix.json),
[functional concept regions](redesign-v1.14/review-candidates.json),
[occupied Cost geometry](redesign-v1.14/cost-occupied-layout.json), and
[failed SVG capture pair](redesign-v1.14/failed-raster-attempt/models-en-dark.png).
Capture candidates are synthetic and are not approved visual baselines or a
concept SSIM measurement.

## Scope and remaining work

No daemon/schema/API/dependency changes. All checks use isolated synthetic DBs;
the original checkout, installed app, tray and scheduled tasks remain untouched.
Unit, desktop and installer suites are not repeated for this frontend checkpoint.
Manual screen-reader checks, other charts, complete typography/decoration,
reviewed visual baselines/SSIM and packaged tray/installer release checks remain.
