# Overview decorative wave field v1.59

Continues the real-data reference redesign after v1.58. The source's wide
cyan/violet wave field is now represented by native decorative SVG artwork
around the existing Pulse Core.

## Changes

- Six fixed smooth paths span a 760px field, fading from cyan through blue to
  violet and then to transparent before the model rail. Sparse deterministic
  stars and four light junctions follow the same decorative field. The 760×320
  viewBox scales vertically with the displayed globe.
- Artwork is aria-hidden, unfocusable, static and ignores pointer events.
  Its center follows the globe. It contains no chart values or live-flow signal.
- Metric and model columns have explicit foreground layers. The hero clips
  decoration at its boundary, light theme reduces its opacity, and widths at
  or below 900px hide the wide field.
- The main SVG receives the previous globe shadow. Quota label/progress,
  Earth surface, recorded values, selected owner/window and runway calculations
  retain their existing data behavior. The three narrow old wave paths are
  replaced by the new wider field.
- Native period-select painting uses an identity transform after repeated
  light-theme captures located small deltas at its rounded corners. Selection
  behavior and layout geometry retain their existing checks.

## Validation

TypeScript/Vite production build passed with the existing large-chunk warning.
The retained **126 web unit tests** passed at v1.58; their data helper modules
are unchanged by this decorative step. That output is retained in
[web-tests.txt](redesign-v1.59/web-tests.txt), rather than represented as a new run.

The full Overview production-browser gate passed all four English/Thai and
dark/light functional sets and repeated captures. Three pairs are byte-identical;
English/light differs in 140 pixels with maximum channel delta 2, within the
unchanged 0.0001 changed-pixel fraction. No masks or tolerance changes.
Activity bottom remains 989.922px within the 992px source viewport.

Four ambient checks establish decorative accessibility, no animation and a
reported center error of 0px. The field width is 760px; its measured height
is 296px at the subsequent 1280px functional-check viewport. Canonical source
captures use 1586×992. Actual quota selections, 0/100/125/null boundaries,
asset serving/decoding and reduced-motion progress transitions pass.
The served Earth asset remains SHA256
`31da2aab7354705aacaccb5b63111d5208e2dd0b705bd10e563a5adc1c6e4ddd`.

Existing period/source/custom, quota history, insights, keyboard model detail,
focus restoration, shell and 390/900/1280 overflow checks pass. All 48 Runtime
geometry states report 0px endpoint error; 12 Activity bitmap checks and four
renderer state sets pass. Canvas bitmap/data and decorative path/viewport
geometry agree between canonical passes. No browser errors, external requests
or daemon write requests were recorded. The database is synthetic in memory.

[Browser manifest](redesign-v1.59/verification.json),
[artifact consistency](redesign-v1.59/artifact-verification.json) and
[reference viewer](redesign-v1.59/reference-review.html), retaining v1.58.
The original Overview reference hash is unchanged. Single-project captures
are diagnostic fixtures with keyboard focus, not source visual baselines.

## Checkpoint and remaining work

Branch `design/redesign-foundation`, existing QuotaPulse origin;
tag `redesign-pulse-ambient-v1.59.0`. Original checkout is preserved.
This evidence covers Overview. Latest full nine-page browser evidence remains
v1.52; extracted installer/runtime and manual acceptance were not rerun.

99–100% source likeness remains open. Source waves have stronger, less regular
glow and the source runway pill has a stronger halo. Real model-family marks,
remaining hero details and composition of the other dashboard pages remain in
the reference-fidelity queue. Static PNGs do not establish source motion behavior.
Repeated application screenshots do not establish source similarity.

The unsigned unused review bundle retains 87 installed runtime packages,
Node22 ABI127, NoReaders, disabled account probes and no application profile.
Every ZIP entry was decompressed and SHA256-compared with its bundle source.
Document captures and bundled production index match the final browser manifest.

Review ZIP: `tmp/review-bundles/QuotaPulse-v1.59-xX0ouC.zip`;
201563277 bytes, 3134 files.
SHA256: `e0bbe63cbf32d11ff948d72ae6c20359c460c2c4239d2a7c9e738f8d764741ab`.
