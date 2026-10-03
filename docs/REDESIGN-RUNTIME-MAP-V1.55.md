# Overview Runtime Map v1.55

Continue the real-data reference redesign after quota groups v1.54. The supplied
Overview uses directed cyan/violet connections, framed nodes and model token
share bars. This checkpoint applies that treatment to the existing observed
relationship graph.

## Changes

- SVG arrowheads identify the actual project → harness → provider → model
  direction. Each existing curve retains its original endpoint coordinates.
  Arrows inherit the path color and point into the destination card.
- Model nodes show a proportional cyan/violet token-share bar and localized
  percentage. The denominator includes every model in the requested API scope,
  including models outside the eight visible nodes. Zero total remains a dash
  with an empty bar. Other node columns retain localized compact token counts.
- Each node exposes its full name and exact token count in its tooltip and
  accessible name. Model accessible names also include the percentage.
- Project cards have the source's violet border emphasis and rounded frame;
  harness frames have subtle green emphasis. Static ambient dots behind the
  project column reproduce the source texture. There are no fabricated health
  states, sessions or token-flow animations.
- Node detail actions, complete recorded-data tables, scrolling, keyboard and
  focus behavior remain available. The four-column viewport and row centers
  retain their existing geometry.

## Evidence

TypeScript/Vite build and final production-browser run passed, with the existing
large-chunk warning. All four English/Thai and dark/light sets passed. Repeated
captures passed unchanged tolerance without masks: dark pairs have 17 changed
pixels at maximum channel delta 1; light pairs have 16 at delta 2. None are
byte-identical. Activity bottom is 989.516px within the original 992px viewport;
maximum connector endpoint error is 0.007508px in every set.

The richer graph has 47 nodes and 45 recorded edges. All eight visible model
shares match the complete API denominator, every drawn connection has a direction
marker, and five detail cases preserve values and focus. Existing quota groups,
scope/source/custom dates, unknown/stale/expired and boundary quota, forecast,
insight cards, keyboard and history checks passed. No external/write requests
or browser errors were recorded; the database is synthetic in memory.

See [production-browser verification](redesign-v1.55/verification.json),
[Overview comparison](redesign-v1.55/reference-review.html) and
[original source hash](redesign-v1.55/reference-hashes.json).
The viewer retains v1.54. Its baseline captures use the synthetic default
dataset; the separate richer Runtime Map test includes more than eight models.
The test independently compares visible shares and bar widths with all API
model tokens, verifies direction markers and retains complete-table/detail
checks at 390/900/1280px. Raster repeatability is not a source similarity score.

This checkpoint is scoped to Overview. The full nine-page browser run at v1.52,
124 web tests at v1.49 and 418 repository tests at v1.44 remain separate evidence
for those builds. Unit tests, extracted-runtime/installer and manual release
acceptance are not rerun for this presentation change.

Version tag: `redesign-runtime-map-v1.55.0`, isolated branch
`design/redesign-foundation`, original QuotaPulse origin.

## Review bundle

`tmp/review-bundles/QuotaPulse-v1.55-iJxCUC.zip`: 201558764 bytes, 3134 files.
Archive SHA256:
`d153449aee4ab418cfbf74b5203fc195f46cfccb31eb12d6243efa837f150493`.
Every ZIP entry was decompressed and SHA256-compared with its bundle source.
All four canonical capture hashes, the packaged production index and Earth
asset match the tested build; the original reference hash and viewer script
syntax passed. The bundle retains 87 existing runtime packages.

[Bundle build](redesign-v1.55/bundle-build.json) and
[archive verification](redesign-v1.55/archive-verification.json).
Existing runtime packages are copied without dependency installation or native
rebuild. No app profile is included. Requires Windows x64 and Node 22 (ABI 127).
Extract into a new dedicated folder, run `./scripts/start-review.ps1`, and stop
with `./scripts/stop-review.ps1`. Readers/account probes are disabled; a new
database has empty usage. This is an unsigned review bundle.

Final whitespace check passed. Scoped inspection found no remaining Node/Chromium
test processes. The original checkout remains clean at
`be8e145039247958992fa7673a9c77e1bff35db1`.

## Remaining goal

The eight-page 99–100% reference target remains open. Recent activity treatment,
finer Overview composition, motion based on observed activity, the other page
details and manual visual/release acceptance still require work.
