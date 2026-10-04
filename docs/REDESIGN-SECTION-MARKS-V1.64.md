# Panel identity marks and recorded Live curves v1.64

## Changes

Continue the dashboard toward the original eight reference images, using real
app data. This checkpoint combines the unpublished v1.63 curves draft with the
v1.64 panel-mark pass; v1.62 is the previous validated and published checkpoint.

- Add fifteen decorative section tiles: five Live, six Cost, two Providers and
  two Models. Source raster measurements informed 20/28/34px sizes. Blue frames
  use the existing dark gradient; Cost Sessions has a warm Flame tile. Existing
  translated h2 names and controls remain. Complex source circuit glyphs are
  still represented by the installed icon system.
- Plot combined input in blue, output in violet and stored total in cyan for
  each exact minute interval, using one shared actual scale. Legend text now
  follows each series colour. Input includes fresh input, cache reads and cache
  writes. Output already includes reasoning; stored total stays independent.
- Preserve missing, recorded zero, unknown components and mismatched totals.
  Unknown components break only their affected lines. A keyboard expandable
  nine-column table exposes all component values, clipped intervals, records
  and calls. No values are inferred from the source concept or stored total.
- Retain real filters, provider/model minute strips, sessions and feed. Atomic
  refresh comparisons include the new component traces and table metadata.
- Optional web response fields describe components already returned by the
  daemon. No daemon, schema, ingestion, dependency or profile changes.

## Validation — Validated

Fresh web build and **136 web tests, 0 failures** pass. Six new helper tests cover
component semantics, duplicates, unknown gaps, missing/zero, independent totals
and clipped intervals. The existing Vite chunk-size warning remains. The
unchanged daemon's 11-node memory API suite is retained from v1.62, not rerun.

The full production-browser gate passes nine pages plus selected History in
English/Thai and dark/light: **40 pairs / 80 screenshots, 37
byte-identical**. Remaining raster differences: overview-en-dark.png: 67 pixels, max channel delta 2; projects-th-dark.png: 2 pixels, max channel delta 1; projects-th-light.png: 38 pixels, max channel delta 1. Maximum channel delta
2 / changed-pixel fraction 0.0001, no masks. This proves repeatability and the
specified checks; it does not measure likeness to the source references.

Sixteen panel-mark evidence sets verify all fifteen placements in four
language/theme variants and at 390/900/1280px: sizes, contained SVGs, decorative
semantics, translated heading names, palette, clipping and adjacent content.
Eight independent Live evidence sets reconcile all three traces, shared maximum,
coordinates, unknown gaps and nine table columns with the actual minute API.
Response-only synthetic diagnostics exercise unknown components, recorded zero
and an input sum of 1300 with independently stored total 7. Diagnostics are
separate from canonical images; no persisted data or API baseline is changed.

Minimum trace/marker contrast is 4.69:1; minimum small legend
text contrast 4.75:1 (required 3:1 and 4.5:1). The checker resolves
normalized sRGB channels and composites transparent ancestor layers over opaque
background candidates. It skips valid none entries in layered background lists.
Keyboard disclosure/final-row access, table scrolling and narrow layouts pass.
The canonical Live feed/pagination bottom is at most 930.875px in the 941px
viewport. Existing minute matrix, stale-response, Runtime, Activity, model mark,
heading, History, quota, chart, shell and Settings checks pass. All eight source
image hashes are unchanged. Browser records are synthetic and in memory;
production components still consume actual daemon data.

The first new mark check failed because tsx injected a named-function helper
into its serialized browser callback. Three local function expressions now
avoid that dependency; an offline causal check reproduced the original failure
and executed the corrected callback without compiler globals. Assertions remain.
The corrected Cost check then found a real overlap between its 34px trend tile
and the top y-axis label. An 8px margin below that section header clears the
label. This final CSS adjustment was rebuilt and checked in the browser; the
136-test run predates that CSS-only spacing fix.

During draft verification, Overview's unknown-activity fixture timed out once;
the isolated original timing passed, so its exact cause remains unproven. Its
helper now waits for actual History records and settled requests before serving
a cloned baseline for the exact Overview GET scope. It avoids broad route.fetch
interception. Deadlines and raster tolerance are unchanged.

A later draft repeat differed in 15 pixels at the rounded History heading
tile, maximum channel delta 5. Capture order differed: the first pass previously
opened a density modal before the selected-detail capture, while the repeat did
not. Both passes now capture selected details first. The focused History gate
passed all eight pairs byte-identically; the final full gate also passes. No
product animation, extra masking or tolerance relaxation was introduced.

[Browser evidence](redesign-v1.64/verification.json),
[artifact consistency](redesign-v1.64/artifact-verification.json),
[reference viewer](redesign-v1.64/reference-review.html),
[panel source measurements](REDESIGN-SECTION-MARKS-NEXT.md).
The viewer retains v1.62 and labels synthetic diagnostics separately. Settings
has no original reference PNG. Static images do not prove motion equivalence.

## Review package

Branch: design/redesign-foundation; existing QuotaPulse origin.
Tag: redesign-section-marks-v1.64.0. Original checkout is preserved.

ZIP: tmp/review-bundles/QuotaPulse-v1.64-2igp9U.zip
Size: 201570998 bytes; 3135 files.
SHA256: ed36cf8f83378799e18264ecd0a2ae98a78aa26f8834c132cd530de1c7c8b399

Every ZIP entry was decompressed and SHA256-compared with its bundle source.
The compiled web index and unchanged daemon modules match the captured build.
The unsigned Windows review bundle uses 87 installed runtime packages and
external Node22 ABI127. NoReaders/account probes remain disabled; no profile,
dependency download or native rebuild. Extracted installer/runtime acceptance
was not rerun. Superseded packages, including the unpublished v1.63 draft, remain
in ignored tmp. The review bundle does not import the user's existing usage DB.

## Remaining source fidelity work

**99–100% source likeness remains open.** Complex circuit glyphs, globe/Runway
pill glow, Projects/Models composition and Live axes/glow need further reference
refinement. No fabricated telemetry, separate Concept Preview or pet/popup work
is included. The package is available for implementation review, not declared
complete against the full visual objective.
