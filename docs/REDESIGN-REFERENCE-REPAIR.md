# Reference fidelity repair

## Acceptance reopened

The user rejected the v1.34 appearance as approximately 80% close to the supplied
concept. That percentage is the user's assessment, not a measured image score.
The target remains 99–100% visual likeness. The user's clarification is **real
application data with the appearance matching refs**. A separate Concept Preview
with fabricated content is not requested.

This supersedes any interpretation of earlier implementation/browser checkpoints
as visual acceptance. The stable-capture harness compares repeated application
captures with each other. It proves repeatability and specified functional/layout
checks; it does not compare the application with the original concept. Passing
that harness must never be reported as a reference fidelity percentage.

Latest Live styling checkpoint: [Metric tiles v1.85.12](redesign-v1.85.12/REDESIGN-LIVE-METRIC-TILES-V1.85.12.md)
matches the concept's circular icon marks and restrained colored card treatments
while retaining daemon-backed counts. All four language/theme captures repeat
byte-identically, but this is not reference-image sign-off. Live composition and
the complete eight-page 99 to 100 percent likeness goal remain open.

Latest Projects styling checkpoint: [Project identity tints v1.85.13](redesign-v1.85.13/REDESIGN-PROJECT-IDENTITY-TINTS-V1.85.13.md)
keeps each card's decorative cyan/violet accent stable across sort and selection,
and carries it into the detail panel. Four language/theme captures pass the
repeatability gate; source-image acceptance remains open.

Latest Providers styling checkpoint: [Provider brand tile v1.85.14](redesign-v1.85.14/REDESIGN-PROVIDER-BRAND-TILE-V1.85.14.md)
matches the OpenCode Go tile's purple treatment using its real provider key.
All four language/theme captures pass the repeatability and provider-data checks;
the page's differing owner/reader counts remain an intentional data difference.

Latest Models styling checkpoint: [Selected model identity v1.85.15](redesign-v1.85.15/REDESIGN-SELECTED-MODEL-IDENTITY-V1.85.15.md)
adds the selected model's actual provider/maker mark and retains the recorded
identity values. Four capture variants and the selected-provider assertion pass;
the reference's unsupported performance metadata and additional model rows remain
out of production display.

Latest Cost behavior and presentation checkpoint: [Month-to-date and chart interval v1.85.16](redesign-v1.85.16/REDESIGN-COST-DATE-AND-INTERVAL-V1.85.16.md)
defaults to real current-month records, adds API-backed daily/hourly/weekly chart
aggregation and preserves sub-cent unit-cost precision. Daemon/web tests and all
four Cost capture variants pass. The recorded fixture trend remains sparse and
the concept likeness target is still open.

Latest History composition checkpoint: [Rolling range and selected record v1.85.17](redesign-v1.85.17/REDESIGN-HISTORY-RANGE-AND-DETAIL-V1.85.17.md)
defaults to a real rolling 30-day range, daily timeline grouping and the latest
matching API record in the right-side detail rail. Focus, keyboard, range-count
and overflow checks pass. Captured records remain concentrated near the end of
the period, so the reference likeness target is still open.

## Source and observed gaps

Latest presentation work: [Panel identity marks and recorded Live curves v1.64](REDESIGN-SECTION-MARKS-V1.64.md)
adds fifteen measured section tiles, three actual minute curves, coloured legend
text and complete accessible values. Fresh 136 web tests and the full 40-pair
gate pass (37 byte-identical), with unchanged raster tolerance and no
masks. The [reference viewer](redesign-v1.64/reference-review.html) retains the
previous validated v1.62 and separates synthetic diagnostics. All eight source
hashes match. Full source likeness remains open: circuit glyphs, globe/pill glow
and page composition.

Latest shared header work: [Header brand/status v1.52](REDESIGN-HEADER-BRAND-V1.52.md)
aligns the larger waveform/wordmark and framed status/scope/date-time composition
with the source. Connection and clock values are real machine state. The
[latest full-page viewer](redesign-v1.52/reference-review.html) uses unchanged,
hash-verified reference PNGs. Full source likeness remains open.

Latest shared geometry work: [Shell geometry v1.51](REDESIGN-SHELL-GEOMETRY-V1.51.md)
uses separate header/body column widths and reference-like main insets. The
[latest full-page viewer](redesign-v1.51/reference-review.html) preserves all nine
application pages and uses the unchanged, hash-verified eight source images
from v1.44. Full 99–100% source likeness remains open.

Latest composition work: [Runway timeline v1.50](REDESIGN-RUNWAY-TIMELINE-V1.50.md)
aligns the lower panel's time-label, marker and outcome hierarchy with the
source, using actual quota forecast/reset timestamps. The
[latest Overview comparison](redesign-v1.50/reference-review.html) retains the
previous v1.49 captures. Full source likeness remains open.

Latest functional/composition checkpoint: [Pulse period and runway v1.49](REDESIGN-PULSE-PERIOD-V1.49.md)
adds the scope-backed Overview selector and actual forecast/reset duration pill.
Custom/source scope, selected quota, keyboard focus and narrow-screen layout
checks pass. [Latest Overview comparison](redesign-v1.49/reference-review.html)
retains v1.48 as a previous capture. Full reference visual acceptance remains open.

Latest composition checkpoint: [Overview placement v1.48](REDESIGN-OVERVIEW-PLACEMENT-V1.48.md)
aligns the globe's focal position, separates the model list caption and makes
four provider rows fully visible while correcting connector endpoints. The
source rows below remain open; stable application repeats are not visual approval.

Latest Overview image checkpoint: [Pulse Earth v1.47](REDESIGN-PULSE-EARTH-V1.47.md)
replaces the approximate vector globe with a generated local reference-derived
surface and displays the selected reader's actual used-quota percentage. Source
and asset hashes, alpha inspection, image decoding and quota boundary checks are
recorded. Exact image/geometry likeness and the complete eight-page goal remain
open; this does not close the Overview gap row below.

Source: `C:\Users\TH12367283\Downloads\quotapulse_build_blueprint\refs`.
The folder contains eight PNGs: Overview is 1586 × 992; Live, Projects, Providers,
Models, Cost, History and Alerts are 1672 × 941. The original files remain intact.

Direct pixel sampling of the original PNGs found Overview's common background
colors `#040a14` and `#08101b`. The earlier application used `#080f1e` and
`#101b2e`. This supports correcting the palette; it is not an image similarity
measurement. Inspection of the original images and application captures also
shows these unresolved differences:

| Screen | Appearance to repair using actual data |
| --- | --- |
| Shared shell | Background, electric blue/violet effects, brand waveform, icon tiles, typography, navigation decoration and spacing. |
| Overview | Orb size/surface/effects, metric tiles, quota rail proportions, model rail, branded runtime nodes, runway and insights composition, activity decoration. |
| Live | Main-column summary versus right rail, session identity columns, observed line/area chart treatment and activity rail. |
| Projects | Larger identity tiles, card gradients, selected detail decoration and genuine usage trends. |
| Providers | Actual vendor logos, card/window proportions, selected details and comparison/reader-health arrangement. |
| Models | Main-column summary versus detail rail, actual model/vendor identity, trend styling and glowing token distribution. |
| Cost | Icon/summary treatment, donut lighting, trend styling and table identities. Retain separate monetary bases. |
| History | Header/actions placement, identity chips, timeline styling and details treatment. Retain recorded event grain. |
| Alerts | Section decoration, chart effects and rail composition with observed risks and events. |

## Implementation sequence

1. Repair the shared palette and brand, then Overview composition as the first
   reference screen. Use existing offline vendor/harness marks; do not invent
   model makers from model names or service-health facts from usage records.
2. Apply the common treatments to all seven other supplied screens. Correct their
   remaining layout and chart differences individually.
3. Capture the production UI at the original reference dimensions and inspect each
   page beside its source, recording the remaining visual differences. Preserve
   Thai, light-theme, narrow-screen and keyboard behavior as additional gates.
4. Keep repeatability, API-value verification and visual acceptance as distinct
   evidence. The blueprint's similarity gate needs a named reviewed baseline and
   a documented comparison method. Do not hide complete cards, charts or labels
   with masks to obtain a score.

Dynamic numbers, identity counts, chart shapes and unknown states reflect actual
data. Their variation does not justify unrelated changes to colors, effects,
spacing, imagery or composition. Unsupported ROI, lifecycle outcomes, benchmark
scores, latency, automated mitigation and invented forecasts remain excluded.

## Initial repair checkpoint (v1.35)

Changes include measured dark colors, a waveform brand, textured/glowing SVG orb,
larger desktop orb and quota rail, colored metric tiles, runtime identity tiles,
actual harness/provider marks, quota owner marks from API metadata and vendor
marks/state badges on Providers. The orb's decorative outer ring is complete;
the separate quota progress ring still uses the real remaining percentage.

Work is on `design/redesign-foundation` in the isolated worktree. The original
checkout and v1.34 review archive are preserved. This checkpoint is still under
implementation and is **not** a 99–100% fidelity claim or visual acceptance.

## v1.35 validation and review images

The shared-style build passed TypeScript/Vite and the complete browser harness:
36 capture pairs across eight pages, Thai/English and light/dark, plus selected
History details. Of these, 33 pairs were byte-identical. The three other pairs
had 5/10/8 changed pixels and maximum channel differences 1/2/1, within the
unchanged unmasked raster tolerance. Evidence includes 144 header checks,
36 shell checks, 68 font checks, 24 Models/Cost route checks, eight quota checks
and four Runtime Map checks. The synthetic database remained in memory; the
harness forbids external/write requests and checks browser errors.

At 1586 × 992, Overview's hero starts at y=68 and ends at y=463.1875. The first
activity card ends at y=990.640625, within the unchanged reference-height gate.
The model rail remains keyboard-scrollable at 270 pixels with all eight fixture
models available. These are geometry/behavior results, not reference similarity.

After the combined run, the quota logo metadata was narrowed to the reading's
`subscription_provider` / `account_provider`, with the known subscription as
fallback. It no longer falls back to the reader's vendor. The final build and
Overview scope are checked separately; the combined run records the preceding
shared-style build. The capture fixture is synthetic test data and is not shipped
as application records.

[Combined verification](redesign-v1.35/all-page-verification.json) and
[reference color sampling](redesign-v1.35/reference-color-evidence.json).

| Page | English dark | Thai dark |
| --- | --- | --- |
| Overview | [Capture](redesign-v1.35/overview-en-dark.png) | [Capture](redesign-v1.35/overview-th-dark.png) |
| Live | [Capture](redesign-v1.35/live-en-dark.png) | [Capture](redesign-v1.35/live-th-dark.png) |
| Projects | [Capture](redesign-v1.35/projects-en-dark.png) | [Capture](redesign-v1.35/projects-th-dark.png) |
| Providers | [Capture](redesign-v1.35/providers-en-dark.png) | [Capture](redesign-v1.35/providers-th-dark.png) |
| Models | [Capture](redesign-v1.35/models-en-dark.png) | [Capture](redesign-v1.35/models-th-dark.png) |
| Cost | [Capture](redesign-v1.35/cost-en-dark.png) | [Capture](redesign-v1.35/cost-th-dark.png) |
| History | [Capture](redesign-v1.35/history-en-dark.png) | [Capture](redesign-v1.35/history-th-dark.png) |
| Alerts | [Capture](redesign-v1.35/alerts-en-dark.png) | [Capture](redesign-v1.35/alerts-th-dark.png) |

The fresh v1.35 review bundle retains existing installed runtime packages and
their licenses, requires Windows x64 / installed Node ABI 127, and uses a separate
empty review profile with readers disabled. It is unsigned. Its README labels
reference repair as in progress. Final Overview and archive evidence are stored
alongside the combined captures after their checks complete.

The final Overview run passed four pairs: three byte-identical, with five pixels
different by at most one channel level in English light. See
[final Overview verification](redesign-v1.35/final-overview-verification.json).
[Bundle inventory](redesign-v1.35/bundle-build.json) and
[archive verification](redesign-v1.35/archive-verification.json) record
`tmp/review-bundles/QuotaPulse-v1.35-3an8i0.zip`: 3,125 entries, 199,843,423 bytes,
each decompressed and SHA256-compared against the bundle source; no app profile.
Archive SHA256:
`e19e1a8e0c03377c6548ef1abfed99bce285ec64f48a231106ac7d98313efd5a`.
Extract into a fresh dedicated folder and run `scripts/start-review.ps1`;
`scripts/stop-review.ps1` stops that review instance. A new review profile is empty.
The extracted runtime/installer and broader release suites were not rerun here.
Scoped process inspection after the checks found no remaining build/capture
Node or Chromium processes. The original checkout is clean at
`be8e145039247958992fa7673a9c77e1bff35db1`; the preserved v1.34 archive still hashes
to `f19a0a7063394f40145585078764c8d82556c3a96c4b5dc784941923b3a5d379`.

The next checkpoint advances Overview's model/activity identities and
runway/insights composition, plus Live/Models column placement and observed
chart styling. See [v1.36 composition repair](REDESIGN-REFERENCE-COMPOSITION-V1.36.md)
for changes, build-specific evidence and remaining per-page work.
[Live composition v1.37](REDESIGN-LIVE-COMPOSITION-V1.37.md) then refines
session/feed allocation and recorded-activity rail marks. These checkpoints
do not close the remaining fidelity gaps or provide a measured likeness score.
[Projects reference v1.38](REDESIGN-PROJECTS-REFERENCE-V1.38.md) adds actual
per-project sparklines and larger three-row desktop cards, with all further
projects keyboard reachable. The associated reference review artifact shows
all eight original concepts beside matching app captures without masking.
[Providers reference v1.39](REDESIGN-PROVIDERS-REFERENCE-V1.39.md) then refines
quota rows, card height, selected-owner disclosure and above-bar labels using
published quota/reader facts. The complete fidelity target remains open.
[Cost reference v1.40](REDESIGN-COST-REFERENCE-V1.40.md) aligns the donut with
the header, adds actual monetary summary and provider decoration, and connects
priced-token buckets over the independent monetary bars. Remaining plot/table
and typography work is recorded separately from repeatability results.
Original-reference similarity scoring, user visual acceptance, manual screen
reader review and the broader release gates remain outstanding.

[Cost detail v1.41](REDESIGN-COST-DETAIL-V1.41.md) then restores the wider
190px trend plot, amount-share table decoration and reference-style insight
rows. Desktop tables scroll with all loaded rows keyboard reachable. This
advances the same real-data target; its Cost-only evidence is not approval of
all eight pages or a measurement of concept similarity.

[History reference v1.42](REDESIGN-HISTORY-REFERENCE-V1.42.md) then combines
the header controls, adds summary icon tiles and recorded identity marks, and
restores blue/violet timeline area treatment. Complete record-table keyboard
scrolling and native selected-detail behavior remain validated. Fine filter,
typography and sidebar composition still require closer reference comparison.

[Alerts reference v1.43](REDESIGN-ALERTS-REFERENCE-V1.43.md) aligns the forecast
rail with the header, adds an actual forecast-day circular centerpiece, decorates
recorded owner risk cards and presents the fixed rules in a native table. The
gate compares all selectable owners' forecast values independently with daemon
responses and retains history/keyboard/overflow checks. This checkpoint does
not close the full visual acceptance or broader release requirements.

[Shared sidebar v1.44](REDESIGN-SIDEBAR-REFERENCE-V1.44.md) then refines
Quick stats, navigation marks, active-row treatment and the missing brand footer.
Its combined capture evidence covers all eight dashboard pages plus Settings on
one production build, alongside 418 passing repository unit tests. Original
reference likeness, final Settings composition and release/manual acceptance
still require evidence before the complete goal can be closed.

[Settings composition v1.45](REDESIGN-SETTINGS-COMPOSITION-V1.45.md) then makes
Settings use the shared dashboard card/color hierarchy, preserves all six
sections and validates local preference controls. No Settings reference PNG is
supplied, so this does not claim a new source-comparison score for that page.
Eight-page typography, detailed composition and final release/manual gates remain.
# Overview typography v1.46

The latest Overview typography and model-row refinement is recorded in
[v1.46 evidence](REDESIGN-OVERVIEW-TYPOGRAPHY-V1.46.md). This remains an incremental
checkpoint toward the eight-page reference goal, not visual acceptance.
