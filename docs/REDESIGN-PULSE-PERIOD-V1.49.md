# Pulse period and runway controls v1.49

Continue the real-data dashboard redesign after Overview placement v1.48. The
reference's period selector and Runway/Reset pill are now backed by existing
scope APIs and the selected reader's actual forecast/reset timestamps.

## Implementation

- The Pulse Core header's period badge becomes a native Today/This week/This
  month/All time selector. It updates the Overview hash, runtime graph and recent
  record requests with existing scope helpers. Source/bucket filters survive;
  obsolete custom date parameters are removed when choosing a preset. Existing
  custom-date deep links remain visible as their selected custom option.
- A visible source badge remains when usage is source-filtered. History links
  retain the selected usage scope. Focus returns to the period selector after
  its newly scoped snapshot loads.
- Production Overview owns selected quota identity across scoped snapshot
  replacement. This keeps the user's quota choice, forecast and quota-history
  owner consistent when the range control reloads the graph.
- The gradient Runway/Reset pill beneath the globe uses `runwayState` and the
  existing compact countdown formatter. Exact localized times are available in
  native titles. A sub-minute future prediction displays `<1m`; missing forecast
  data displays Unknown instead of a fictional duration. An unavailable/stale
  window does not expose invented forecast/reset timestamps.
- Pulse Core now uses the same freshness allowance as its Overview parent and
  lower runway section: one hour for production, five minutes for the existing
  preview. No reader forecast or token denominator is manufactured.
- The pill uses the reference's 318px rounded cyan/violet treatment and preserves
  the desktop grid's occupied height. Narrow layouts allow its groups to wrap
  and reserve space before the model grid. Native picker fonts use the existing
  bundled Noto Sans Thai pattern used by History.

## Validation

Web TypeScript/Vite build and all 124 web unit tests passed (no failures/skips).
The existing large-chunk warning remains. Overview production captures passed
English/Thai and dark/light within unchanged raster tolerance, without masks.
Dark pairs each differed by 17 pixels at maximum channel delta 1; light pairs
each differed by 16 pixels at maximum delta 2. Read-only pixel inspection locates
all differences in the native selector's top border, not data labels or graphs.

New browser checks independently verify preset API timestamps, runtime totals
and recent-record request scope. The fixed fixture yields 3601 tokens Today and
3602 Week/Month/All, demonstrating a real scope change. URL/history scope,
selected quota preservation and focus restoration pass in all four sets.
Custom/source/bucket deep links, removal of obsolete dates, source visibility
and preset restoration after reload also pass. Custom-date/source controls also
pass horizontal overflow checks at 390/900/1280px in every language/theme set;
the selector can shrink beside the source badge and its full scope has a title.

The pill's reset and predicted-full timestamps match the independently read
reader API for both owners. Missing forecasts and unknown percentages retain
unknown state. Existing image hash/decoding, quota boundaries, all model detail
access, runtime connector/row geometry, complete recorded tables, font/shell
and 390/900/1280 overflow checks pass. The database is synthetic in memory,
readers are off and no external/write requests or browser errors were observed.

[Browser verification](redesign-v1.49/verification.json),
[web unit output](redesign-v1.49/unit-tests.log) and
[reference viewer](redesign-v1.49/reference-review.html). The viewer also switches
to the previous v1.48 captures. This checkpoint's browser scope is Overview;
the other seven reference pages and Settings were not recaptured here.

Version tag: `redesign-pulse-period-v1.49.0`, isolated branch
`design/redesign-foundation`, original QuotaPulse origin.

## Review bundle

`tmp/review-bundles/QuotaPulse-v1.49-e31QiY.zip`: 201556437 bytes, 3134 files.
Every ZIP entry was decompressed and SHA256-compared with its bundle source;
no app profile is included. Archive SHA256:
`367766bce27ee6187ad1a45197a4091fbc58ea075a5bee3a491db9233bbc2f2d`.

All four canonical capture hashes, the tested production index, packaged Earth
asset and original Overview reference hash were verified. Existing 87 runtime
packages were copied without installation or native rebuild. Requires Windows
x64 and installed Node ABI 127 (Node 22). Extract into a new dedicated folder,
run `./scripts/start-review.ps1`, and stop with `./scripts/stop-review.ps1`.
Readers/account probes are disabled; a new review database has empty usage.
This is an unsigned review bundle. Extracted-runtime/installer and manual
release acceptance were not rerun for this Overview checkpoint.

[Bundle build](redesign-v1.49/bundle-build.json) and
[archive verification](redesign-v1.49/archive-verification.json).

Final diff whitespace check passed. Scoped process inspection found no remaining
Node/Chromium test processes. The original checkout remains clean at
`be8e145039247958992fa7673a9c77e1bff35db1`.

## Remaining goal

The complete eight-page 99–100% reference target remains open. Shell geometry,
remaining typography/composition/effects and manual visual/release acceptance
still require reconciliation. Stable application captures are not a source
similarity score. The 418 integration tests from v1.44 remain separate evidence
for that build rather than a newly executed v1.49 integration gate.
