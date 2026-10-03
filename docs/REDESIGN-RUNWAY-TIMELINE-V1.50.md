# Overview runway timeline v1.50

Continue the eight-page real-data reference redesign from v1.49. The lower
Quota Runway panel now follows the source's time-label / track / outcome
composition, retaining actual scope, selected owner and observed history.

## Implementation

- Place the selected quota owner/window beside the panel title. The three
  upper columns show localized Now, projected exhaustion and Reset dates with
  machine-readable ISO timestamps. An absent forecast shows Unknown.
- Draw the timeline from the current timestamp to the selected reset. The
  forecast marker's percentage is `(projected - now) / (reset - now) * 100`.
  It appears only for a valid future prediction strictly before reset.
  Predictions after reset retain their actual date and explanatory state;
  no marker is clamped into the displayed interval.
- Use the source's cyan/violet filled segment, hatched segment after projected
  exhaustion, colored prediction marker and bright reset endpoint. The track
  is a time interval, not used-quota percentage or token allowance.
- Beneath the track, show compact predicted/reset durations and the existing
  forecast explanation. Safe pace remains explicitly in percentage points/hour.
  Existing unknown/stale/expired/no-reset states and the keyboard-accessible
  observed-history chart/table are preserved.
- Keep time labels in readable columns when a prediction is very close to Now;
  the marker itself stays at its actual ordinate. The title and labels wrap on
  narrow screens. Machine-readable ISO attributes retain exact values. Future
  durations under one minute show `<1m`; the left duration is labeled remaining.

## Validation

The first browser run reproduced an Overview
viewport failure: activity bottom 1005.516px exceeded the unchanged 992px gate.
The bottom grid had grown to 195.938px while hero/runtime geometry stayed
unchanged. Reducing desktop track vertical margins from 10px to 2px addresses
the added timeline spacing. The final original gate passes in all four sets:
activity bottom 990.141px and hero bottom 462.688px. No viewport/tolerance gate
was relaxed. The panel returns to the prior occupied height.

Web TypeScript/Vite build and final production-browser run passed. Four repeated
Overview pairs pass within unchanged, unmasked raster tolerance: dark pairs
each have 17 changed pixels at maximum channel delta 1; light pairs each have
16 at maximum delta 2. None are byte-identical. These are repeatability checks,
not a measurement against the supplied source.

New checks independently compare actual reader reset/prediction timestamps and
the marker's percentage. Explicit synthetic API scenarios verify an imminent
30-second prediction (`<1m`), after-reset prediction without an in-range marker,
flat forecast with Unknown, and stale/expired windows without a live timeline.
These pass for English/Thai and both themes. Existing scope/source/custom range,
quota choice, keyboard focus, complete chart/history data and 390/900/1280px
overflow checks also pass. No external/write requests or browser errors occur;
the database is in memory and readers are disabled.

[Browser evidence](redesign-v1.50/verification.json) and
[reference comparison](redesign-v1.50/reference-review.html). The viewer retains
the previous v1.49 captures. The other seven reference pages and Settings were
not recaptured for this Overview-only checkpoint. The 124 web tests at v1.49
and 418 repository tests at v1.44 remain separate evidence for those builds;
they were not rerun for this rendering change. The existing large-chunk warning
remains.

Version tag: `redesign-runway-timeline-v1.50.0`, isolated branch
`design/redesign-foundation`, original QuotaPulse origin.

## Review bundle

`tmp/review-bundles/QuotaPulse-v1.50-1M4vUi.zip`: 201556935 bytes, 3134 files.
Every ZIP entry was decompressed and SHA256-compared with its source; no app
profile is included. Archive SHA256:
`d13511a94481dedec26f8fa1bf5e9d7187ee8143e50aa750cc4facaaf81b38e8`.

All four canonical capture hashes, the tested production index, packaged Earth
asset and original Overview reference hash were verified. Existing 87 runtime
packages were copied without dependency installation or native rebuild. Requires
Windows x64 and installed Node ABI 127 (Node 22). Extract into a new dedicated
folder, run `./scripts/start-review.ps1`, and stop with
`./scripts/stop-review.ps1`. Readers/account probes are disabled; a new database
has empty usage. The review bundle is unsigned. Extracted-runtime/installer and
manual release acceptance were not rerun for this Overview checkpoint.

[Bundle build](redesign-v1.50/bundle-build.json) and
[archive verification](redesign-v1.50/archive-verification.json).

Final diff whitespace check passed. Scoped process inspection found no remaining
Node/Chromium test processes. The original checkout remains clean at
`be8e145039247958992fa7673a9c77e1bff35db1`.

## Remaining goal

This checkpoint does not establish 99–100% source likeness. The eight reference
pages still require shared shell, typography, finer composition/effects and
manual visual/release reconciliation. Synthetic fixture names and values remain
different from the source illustration because production uses recorded data.
