# Overview activity row v1.56

Continue the real-data reference redesign after Runtime Map v1.55. The source
uses compact harness → model identity rows and prominent token figures at the
right of four activity cards. This change applies that arrangement to the four
actual latest records already requested by ProductionOverview.

## Changes

- Each card groups its harness icon/name in a small tinted pill, a direction
  arrow and its actual provider icon/model. Complete identities remain in the
  tooltip and accessible name when visible names need truncation.
- Exact recorded tokens have a larger cyan/violet/amber figure on the right;
  the label stays Recorded tokens. There is no invented per-minute rate.
- The lower metadata row keeps the actual timestamp and record grain. Unknown
  grain now displays Unknown, rather than being mislabeled as an aggregate.
- Existing session-specific History links and the fallback Today History link
  remain keyboard accessible. Accessible names include tokens, grain and time.
- Runtime Map text truncation is limited to node labels. Icon artwork retains
  visible overflow and an identity 3D transform for consistent SVG painting.
  The actual icon viewport geometry and recorded-data values are unchanged.
- This checkpoint does not infer a sparkline from four records. The existing
  minute-trend API supports harness/profile grouping and excludes aggregate/
  unknown grains with explicit coverage; integrating that actual series is
  subsequent work toward the source activity strip.

## Validation evidence

[Production-browser manifest](redesign-v1.56/verification.json),
[Overview comparison](redesign-v1.56/reference-review.html) and
[source hash](redesign-v1.56/reference-hashes.json). The viewer retains v1.55.
The source image is the unchanged original Overview reference from v1.44.

New checks request the daemon independently with the browser's exact usage
scope and compare all four record IDs, grain, token values, ISO timestamps,
harness identities and History destinations. Keyboard Enter opens the actual
destination. A synthetic response exercises a long harness identity, unknown
grain, missing provider/model, no session and 123456789012345 tokens, checking
value/meta containment and overflow at 390/900/1280px.

The first run passed en/dark but later timed out waiting for an existing quota
history disclosure. That run is not acceptance evidence. Visual inspection
also found a separate CSS rule restricting model text spans to icon width;
the text span now has flexible width. Final rerun results are recorded below.
The disclosure timeout's cause is unproven; diagnostic state is logged if it
recurs, and its original gate remains enabled with unchanged timeout/tolerance.

A subsequent run passed all four functional sets but failed repeated raster
comparison (94 changed pixels, maximum delta 22). Read-only pixel inspection
localized the excessive deltas to Runtime Map SVG icon edges. Equalizing
scroll/dialog preparation and verifying fixture restoration/viewport geometry
did not alone resolve it; a no-mutation four-set diagnostic also reproduced it.
This falsifies incomplete fixture cleanup as the cause. Limiting text clipping
alone did not resolve it either. Explicit SVG overflow and the identity 3D
transform then passed both the four-set diagnostic and the complete final run.
The precise browser internals remain unproven; the observed remedy preserves
the same data and geometry rather than replacing or hiding the icons.

Both independent capture passes now perform the same diagnostic capture and
model scroll/dialog/focus preparation. Before each canonical image the harness
asserts full restoration of source/session/usage/limit rows, flushes and compares
actual visible icon viewports, and uses a bounded 100ms settle. An unbounded
animation-frame wait and geometric-precision experiment were interrupted and
removed; neither is acceptance evidence. No controls or image regions are
masked; tolerance remains delta 2 and changed fraction 0.0001. The fallback
vendor icon keeps its own dimensions; only the activity model text span flexes.

## Final result

TypeScript/Vite build passed with the existing large-chunk warning. The complete
production-browser run exited successfully: all four English/Thai, dark/light
functional sets and four repeated capture pairs passed. Every pair is
byte-identical, with zero changed pixels and channel delta zero. Activity-card
bottom is 975.922px within the original 992px viewport, and Runtime Map connector
endpoint error remains 0.007508px. The four new recent-activity checks each
verify four actual API records plus keyboard History, unknown grain and large
tokens. Existing quota groups, period/source/custom dates, core boundary and
forecast states, insight cards, runtime tables, complete history and focus
checks also pass. No browser errors or external/write requests were recorded.
Readers are disabled; the database is synthetic in memory. These are repeatability
and functional results, not a percentage of source likeness.

This browser scope is Overview. Full nine-page v1.52, 124 web tests at v1.49 and
418 repository tests at v1.44 remain separate evidence for those builds. Unit
tests, extracted-runtime/installer and manual release acceptance are not rerun
for this layout change.

Version tag: `redesign-activity-row-v1.56.0`, isolated branch
`design/redesign-foundation`, original QuotaPulse origin.

## Review bundle

`tmp/review-bundles/QuotaPulse-v1.56-pzfhn0.zip`: 201559271 bytes, 3134 files.
Archive SHA256:
`eef35985071af3773b66f578c14386ef3ead4cab02d8f92c6044d55d969d204f`.
Every ZIP entry was decompressed and SHA256-compared with its bundle source.
All four capture hashes, the packaged production index and Earth asset match
the tested build. Both the borrowed source and original Downloads reference
match the recorded SHA256; viewer script syntax passed. The bundle retains
87 existing runtime packages. Superseded trial bundles are not this deliverable.

[Bundle build](redesign-v1.56/bundle-build.json) and
[archive verification](redesign-v1.56/archive-verification.json).
Existing runtime packages are copied without installation or native rebuild.
No app profile is included. Requires Windows x64 and Node 22 (ABI 127).
Extract into a new dedicated folder, run `./scripts/start-review.ps1`, and stop
with `./scripts/stop-review.ps1`. Readers/account probes are disabled; a new
database has empty usage. This is an unsigned review bundle.

Final whitespace check passed. Scoped inspection found no remaining Node/Chromium
test processes. The original checkout remains clean at
`be8e145039247958992fa7673a9c77e1bff35db1`.

## Remaining goal

The eight-page 99–100% reference target remains open. Actual minute-series
activity charts, finer Overview composition, motion based on observed activity,
other page details and manual visual/release acceptance still require work.
