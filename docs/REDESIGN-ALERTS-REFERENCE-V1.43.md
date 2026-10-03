# Alerts reference refinement v1.43

Continue the complete real-data dashboard and Settings redesign. Comparison of
`refs/alerts.png` with the previous app showed the forecast rail below the page
heading, no circular forecast treatment, plain risk rows and threshold chips
instead of a rules table.

## Implementation

- The Alerts header and delivery controls now occupy the main column; the right
  forecast rail begins at the same top edge. Desktop padding is 12px.
- The forecast panel has a blue/violet/green circular frame and recorded owner
  logo. Its central value is forecast days until full use, calculated only when
  the reader forecast is ready and supplies a timestamp. Otherwise it displays
  Unknown and retains the explanation, reset time and reader provenance.
  The circular frame is decorative; its colored arc lengths are not quota
  percentages or an additional numeric gauge.
- Critical/warning risk rows gain tinted bordered card surfaces and actual
  subscription/account-provider marks. Reader vendor is not substituted for
  quota ownership. Links keep the real owner/window filters.
- The fixed 50/80/95% rules appear in a native table with their corresponding
  notice/warning/critical levels. No per-rule switch or automatic workload
  action is simulated. The existing desktop-delivery control remains functional.
- Guidance has subtle violet surface treatment. Event history remains bounded,
  keyboard scrollable and complete, including the expanded history scope.

## Validation

Web TypeScript/Vite production build passed with the existing large-chunk warning.
The Alerts browser run passed English/Thai and dark/light: four repeated pairs,
all byte-identical, without masks or raster tolerance changes.

The browser gate independently queries quota history for each selectable owner
and compares the displayed forecast days with daemon values, including the
ready and insufficient-data fixture cases. Existing gates verify rule thresholds,
event metadata, 100/500 history scope toggling, a complete 60-event list,
keyboard scrolling, empty history, native quota samples/reset/null gaps and
390/900/1280 overflow. The fixture is an in-memory database; no live readers or
account probes run.

The final run also explicitly asserts that the selectable fixture contains both
`ready` and a non-ready forecast status, so the day-value check cannot pass while
exercising only Unknown. It passed again with four byte-identical pairs. The
production web files did not change between the two successful browser runs.

Each normal desktop set placed the occupied layout bottom at 935.546875px in
the 941px reference viewport. [Browser evidence](redesign-v1.43/verification.json)
is Alerts-only; other pages were not recaptured. The
[reference viewer](redesign-v1.43/reference-review.html) labels Alerts v1.43,
History v1.42, Cost v1.41 and the five unchanged v1.40 page captures separately.
All eight source images are direct, unmodified copies of the supplied refs.

Version tag: `redesign-alerts-reference-v1.43.0`, isolated branch
`design/redesign-foundation`, existing QuotaPulse origin.

## Review bundle

`tmp/review-bundles/QuotaPulse-v1.43-4WyPvx.zip`: 199853831 bytes, 3132 files.
Each ZIP entry was decompressed and SHA256-compared with the source bundle;
the archive contains no app profile. Production index SHA256 matches the
Alerts-tested build. Archive SHA256:
`0767414e099dc97b5444ade72020802fe16d136e93bd1b0264f8bf092a633daf`.

Existing 87 runtime packages were copied without dependency installation or
native rebuild. Requires Windows x64 and installed Node ABI 127 (built with
Node 22.13.1). Extract to a fresh dedicated directory; run
`./scripts/start-review.ps1` and stop via `./scripts/stop-review.ps1`.
Readers/account probes remain disabled; a fresh review database is empty.
This is an unsigned review bundle. Extracted-runtime/installer and broader
release gates were not rerun in this styling checkpoint.

All eight original/copy reference hashes match. Scoped process inspection found
no remaining Node/Chromium test processes. The original checkout remains clean
at `be8e145039247958992fa7673a9c77e1bff35db1`.

[Bundle build](redesign-v1.43/bundle-build.json) and
[archive verification](redesign-v1.43/archive-verification.json).

## Remaining acceptance

This is another step toward the original eight-page reference goal, not visual
acceptance. The exact forecast composition, richer supported guidance, main
header/icon sizing, risk-row density, typography and other per-page differences
still need comparison. Original-reference similarity measurement, user visual
acceptance, Settings and broader release gates remain open. Repeatability does
not establish the requested 99–100% likeness.
