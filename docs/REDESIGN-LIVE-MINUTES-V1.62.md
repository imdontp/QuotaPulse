# Actual provider/model minute strips v1.62

## Objective and changes

Continue the real-data dashboard redesign after v1.61. Replace Live's aggregate
share bars with the minute-strip composition in refs/live.png.

- Add opt-in group_by=provider_model to the existing minute trend API. Sparse
  call-only rows preserve exact nullable provider/model tuples. Three bounded
  grouped queries share the existing scope predicates and read transaction;
  existing grouping modes retain their response shape.
- All-grain window summaries retain actual tokens and explicit call, aggregate
  and unknown record counts. Aggregate or unknown records never manufacture
  per-minute call activity. No schema or dependency changes.
- Live makes one grouped matrix GET alongside the existing filtered trend,
  feed and session GETs. The matrix retains all routes in the observation
  window while named-pair selection filters the other panels.
- Each visible pair has 31 oldest-to-newest minute cells at the fixed capture
  clock. Missing calls, recorded zero and positive tokens are separate states;
  clipped partial minutes are marked. Positive colours share the actual scale.
  Rightmost numbers are explicitly labeled window totals, including all grains,
  rather than falsely labeled current tokens per minute.
- Add keyboard pair selection, a complete expandable table for the visible
  top twelve and global grain coverage. Empty/null identities remain readable
  and non-filtering because the existing scope interface cannot select them.
- Preserve the complete paused snapshot, selection, query and History links.
  Epoch checks reject obsolete success and failure after pause/resume or
  A/B/A route changes; current query failures retain the prior complete snapshot
  with a stale note. No manual ingestion is used by browser checks.
- Keep provider marks in 18px em frames to avoid nested Nous glyph clipping.
  Protect model names with a 74px minimum label track, shrinking strips or
  wrapping them below the labels at smaller container widths. Strip height is
  26px with a maximum width of 180px. Consolidated grain text keeps the canonical
  rail in the desktop viewport.
- Refine the five shared dark heading tiles toward the source's saturated blue
  using local reference pixel sampling. This is a palette correction, not a
  whole-image similarity measurement.

[Six local palette samples](redesign-v1.62/heading-palette-samples.json) record
mean absolute RGB channel differences of 20.33 at v1.61 and 6.61 at v1.62.
These matching local offsets use a visually estimated source tile origin and
do not establish a whole-page fidelity percentage.

## Validation — Validated

New runs at this checkpoint: **130 web tests**, **11 memory API test nodes**
(including the parent node), and daemon plus TypeScript/Vite web builds pass.
The existing Vite large-chunk warning remains.

The full production-browser gate passes all nine pages plus selected History,
English/Thai and dark/light: **40 pairs / 80 screenshots, 37 byte-identical**.
Remaining raster differences: history-selected-en-dark.png: 4 pixels, max channel delta 1; overview-en-light.png: 74 pixels, max channel delta 2; history-selected-th-dark.png: 4 pixels, max channel delta 1.
Original maximum channel delta 2 / changed-pixel fraction 0.0001, no masks.

Eight Live matrix sets independently match the daemon's raw tuple identities,
all 31 cell timestamps/states/tokens/records/calls/intensities, partial boundaries,
window totals and coverage. Canonical sets show eight pairs / 248 cells. Owned
memory-only diagnostic sets add zero-call, empty-identity and unknown-grain
records: eleven pairs / 341 cells. Each disclosure contains every visible-pair
minute; missing fields show dashes, observed zero shows zero. Full keyboard
scrolling, provider icon containment, readable labels and 390/900/1280 overflow
checks pass. Short labels are checked for complete natural text visibility;
truncated long labels must retain at least 45px of visible width.

Four refresh sets hold obsolete responses and the next replacement response
while a MutationObserver checks transient commits. Same-key pause/resume and
A/B/A stale successes are rejected; obsolete 500s are discarded; current 500s
retain the complete prior matrix, trend, feed, sessions and scope. Paused external
hash changes preserve displayed selection/query/History until resume, which
uses exact provider/model/query filters. No stale sentinel commits or writes.
The matrix makes grouped GETs rather than model endpoint fanout.

An initial helper attempt was stopped after an unbounded paint wait. Its new
timer observation and hash/font deadlines complete in the focused and full
gates; no product source change was needed for that test-helper correction.

All earlier Runtime, Activity, model-mark, heading, History, quota, chart, shell
and Settings checks pass. 52 Runtime
geometry states have maximum endpoint error
0px.
No browser errors, external requests or daemon writes. Browser data is synthetic
and in memory; diagnostic records are restored before later canonical captures.
All eight original reference hashes are unchanged.

[Browser manifest](redesign-v1.62/verification.json),
[artifact consistency](redesign-v1.62/artifact-verification.json),
[nine-page viewer](redesign-v1.62/reference-review.html),
[Live capture](redesign-v1.62/live-en-dark.png).
The viewer retains v1.61, selected History, known-model diagnostics and a
separately labeled Live synthetic-state diagnostic selector.

## Package and checkpoint

Isolated branch design/redesign-foundation, existing QuotaPulse origin;
tag redesign-live-minutes-v1.62.0. Original checkout is preserved.

Review ZIP: tmp/review-bundles/QuotaPulse-v1.62-qlc5qU.zip;
201568550 bytes, 3136 files.
SHA256: 7c955cc29d2ef769501f4fa4a8c8770823e6cdfc0e7683f191ed9a198c377ad6.

Every ZIP entry was decompressed and SHA256-compared with the unused bundle.
The compiled web index and compiled minute-trend/runtime-map/vendor modules
match the documented browser build. The unsigned package retains 87 installed
runtime packages, Node22 ABI127, NoReaders and disabled account probes. No
profile or dependency/native rebuild. Extracted installer/runtime acceptance
is not rerun.

## Remaining work

**99–100% source likeness remains open.** Section identity tiles, stronger
globe/pill glow, Projects/Models composition and Live input/output chart
composition remain for refinement using actual available data. Repeated app
images establish repeatability and specified checks, not source similarity.
Static references do not establish motion equivalence. No fabricated telemetry
or separate Concept Preview is introduced.
