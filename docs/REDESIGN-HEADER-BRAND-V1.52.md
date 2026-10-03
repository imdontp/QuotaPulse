# Shared header brand and status v1.52

Continue the full real-data reference redesign after shell geometry v1.51.
Original reference inspection shows a larger waveform/wordmark, a framed
connection indicator, a scope frame and a localized date/time group beside the
header navigator. These elements now use existing app scope and connection data.

## Changes

- Increase the desktop waveform to 42px, its left inset to 20px, the wordmark to
  24px and the tagline to 10px. Keep the existing vector waveform and the white /
  electric-blue app name. The tagline uses regular weight, no tracking and a
  single line; collapsed header logos retain the responsive behavior.
- Present the actual refresh connection state as a 32px framed badge with a
  ring indicator. The visible state remains localized and data-state still
  reflects the existing refresh hook. Accessible status label/title retain the
  complete "Daemon connection: state" description. A separate visible caption
  identifies the daemon; no provider/service-health claim is added.
- Frame the existing machine scope with a monitor icon and retain the active
  page label. This is a scope label, not a new workspace/account selector.
- Add localized system date and 24-hour time with ISO datetime attributes.
  The clock updates every 30 seconds and cleans up its timer on unmount. It
  does not use illustrative reference dates or another page's usage period.
- Widen the existing page navigator to the source-like desktop search-field
  footprint (maximum 408px). Its existing page search, keyboard shortcut and
  command dialog behavior remain intact. Date/time and daemon caption hide
  below 1401px, and the entire connection group hides below 731px as before.

## Diagnosis and validation

The first run reproduced a viewport failure: Overview activity bottom
1000.734px exceeded the unchanged 992px gate. DOM measurements showed a
70.594px header and a 23px/two-line tagline inside the 158.75px wordmark column.
The causal correction changes tagline weight/tracking and prevents wrapping,
retaining its readable 10px size. No viewport or raster gate was relaxed.

TypeScript/Vite build and final complete production browser run passed, with
the existing chunk warning. The added shell checks verify 42px
waveform geometry, wordmark containment, localized accessible live status and
the actual frozen system clock in Bangkok time. All nine pages, English/Thai,
dark/light and responsive behavior passed, including 144 shell geometry checks.
Header height is 60px at every checked size. Existing command dialog, keyboard,
scope/source/custom dates, forecast/unknown/stale/expired states and complete
chart/table checks passed. No external/write requests or browser errors occur;
the database is synthetic in memory and readers are disabled.

All 40 repeated capture pairs pass within unchanged, unmasked raster tolerance;
35 are byte-identical. Overview dark pairs each have 17 changed pixels at delta
1; light pairs each have 16 at delta 2. Projects Thai/light has 38 changed pixels
at maximum delta 1. Repeated app captures are not source-similarity evidence.

[Browser evidence](redesign-v1.52/verification.json),
[all-page comparison](redesign-v1.52/reference-review.html) and
[original source hashes](redesign-v1.52/reference-hashes.json). The viewer script
syntax passed. All eight reference hashes match originals. The 124 web tests
at v1.49 and 418 repository tests at v1.44 remain separate evidence for those
builds; they were not rerun for this header rendering change.

Version tag: `redesign-header-brand-v1.52.0`, isolated branch
`design/redesign-foundation`, original QuotaPulse origin.

## Review bundle

`tmp/review-bundles/QuotaPulse-v1.52-0E2yBB.zip`: 201557305 bytes, 3134 files.
Every ZIP entry was decompressed and SHA256-compared with its bundle source.
Archive SHA256:
`cb61aab67df146d2edaee437022b4aa2351b910633042ac3dcef35f056d77efa`.

All 40 canonical capture hashes, the packaged production index and Earth asset
match the tested build. Existing 87 runtime packages were copied without
dependency installation or native rebuild. No app profile is included. Requires
Windows x64 and installed Node ABI 127 (Node 22). Extract into a new dedicated
folder, run `./scripts/start-review.ps1`, and stop with
`./scripts/stop-review.ps1`. Readers/account probes are disabled; a new database
has empty usage. The bundle is unsigned. Extracted-runtime/installer and manual
release acceptance were not rerun for this shared-header checkpoint.

[Bundle build](redesign-v1.52/bundle-build.json) and
[archive verification](redesign-v1.52/archive-verification.json).

Final diff whitespace check passed. Scoped process inspection found no remaining
Node/Chromium test processes. The original checkout remains clean at
`be8e145039247958992fa7673a9c77e1bff35db1`.

## Remaining goal

Full 99–100% source likeness remains open. Clock and connection contents reflect
real machine state. Finer header composition, source effects and remaining
per-page details still need reconciliation and manual visual/release review.
