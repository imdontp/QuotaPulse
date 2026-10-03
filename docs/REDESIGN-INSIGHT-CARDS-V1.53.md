# Overview insight cards v1.53

Continue the full real-data reference redesign after header v1.52. Overview's
Usage Insights now follows the source's two-column/two-row framed-card layout,
using existing runtime coverage values and recorded usage semantics.

## Changes

- Four bordered, rounded cards with circular cyan/green/violet/amber icons and
  compact heading/value rows replace the prior flat metric/coverage rows.
- Cached input share retains its actual input-token denominator and ratio.
  Known cache price difference retains the known-price call count. A reported
  zero price difference renders currency zero; missing pricing remains a dash.
- Call pricing coverage uses mutually exclusive native/computed/estimated/
  unknown cost classifications from the runtime API, weighted by its reported
  call counts. Recorded call and aggregate row counts remain separately labeled.
  The card is explicitly titled Reported pricing coverage and has a localized
  count explanation. The fixture reports 73 priced/reported calls but 19 call
  records and 18 aggregate records; these are different units, not a mismatch.
- Records without cost retains its actual count and the visible explanation
  that monetary bases are separate and aggregate records are not individual
  calls. These factual distinctions survive the new composition.
- Cards become a single column below 651px. Text and currency values can wrap
  without clipping. Card headings use 11px and values 13px; existing section
  heading, panel hierarchy and observed history access are preserved.

## Validation

TypeScript/Vite build and the final production-browser run passed, with the
existing large-chunk warning. Four Overview pairs passed English/Thai and
dark/light within unchanged raster tolerance, without masks. Dark pairs each
have 17 changed pixels at maximum channel delta 1; light pairs each have 16 at
delta 2. None are byte-identical. Activity bottom is 989.516px, inside the
unchanged 992px source viewport, in all four sets.

The new checks independently query the daemon's actual requested runtime scope,
verify all four card values and recorded-grain counts, and inspect two-row/two-
column geometry. Synthetic API scenarios cover zero cached share with known
zero cache price, large known monetary values, and empty runtime totals. Every
scenario checks horizontal overflow and content containment at 390/900/1280px.
All checks passed in every language/theme set. Default cached share is
33.31790837575196% (displayed 33%), and reported pricing coverage is 73 / 73.
Existing scope/source/custom-date, selected quota, forecast/unknown/stale/expired,
keyboard/focus, runtime and complete history-table checks also pass. There are
no external/write requests or browser errors; the database is synthetic in
memory and readers are disabled.

[Browser verification](redesign-v1.53/verification.json),
[Overview comparison](redesign-v1.53/reference-review.html) and
[source hash](redesign-v1.53/reference-hashes.json). The viewer retains v1.52
captures and uses the unchanged original Overview image from v1.44. This run's
browser scope is Overview; the other seven pages and Settings were not
recaptured here. The complete nine-page v1.52 browser run, 124 web tests at
v1.49 and 418 repository tests at v1.44 remain separate evidence for those builds.

Version tag: `redesign-insight-cards-v1.53.0`, isolated branch
`design/redesign-foundation`, original QuotaPulse origin.

## Review bundle

`tmp/review-bundles/QuotaPulse-v1.53-aloY4j.zip`: 201557683 bytes, 3134 files.
Every ZIP entry was decompressed and SHA256-compared with its bundle source.
Archive SHA256:
`f933ebfc65c3d93800c53f83d8574fa0245025dc8e3f3e88dedffc4b4a06ac52`.

All four canonical capture hashes, the packaged production index and Earth
asset match the tested build. The viewer script syntax passed. Existing 87
runtime packages were copied without dependency installation or native rebuild.
No app profile is included. Requires Windows x64 and installed Node ABI 127
(Node 22). Extract into a new dedicated folder, run `./scripts/start-review.ps1`,
and stop with `./scripts/stop-review.ps1`. Readers/account probes are disabled;
a new database has empty usage. The bundle is unsigned. Extracted-runtime/
installer and manual release acceptance were not rerun for this Overview change.

[Bundle build](redesign-v1.53/bundle-build.json) and
[archive verification](redesign-v1.53/archive-verification.json).

Final diff whitespace check passed. Scoped process inspection found no remaining
Node/Chromium test processes. The original checkout remains clean at
`be8e145039247958992fa7673a9c77e1bff35db1`.

## Remaining goal

The eight-page 99–100% source target remains open. Remaining Overview quota rail,
runtime/activity decoration and finer composition plus the other page details
still need reconciliation and manual visual/release review. Stable application
captures are not source-similarity measurements.
