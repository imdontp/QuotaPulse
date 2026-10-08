# Live rail framing and Alerts spacing v1.85.39

Continue the original eight-page real-data reference goal after a312f88/v1.85.38.
This is a scoped implementation checkpoint, not final visual acceptance.

## Changes

At the original 1672×941 viewport, compose the Live advisory frame with a 343px
minimum height, 10px rail gap and 507px observed-activity frame. Move full matrix
meaning, window/partial-minute and exclusion explanations into a keyboard
information disclosure, retaining the visible range, missing/zero/recorded
legend, exact coverage counts and complete minute table. The disclosure's region
is focusable and scrollable. Narrow layouts keep natural text flow. The 12-pair
matrix remains scrollable; filtered layouts reserve space for clearing filters.
No query, API data, ranking, real advisory count or heat-cell value is changed.

Move the Alerts guidance list upward by reducing its heading/list gap from 16px
to 9px, with 60px minimum row height at native widths. Add the original-style
24px blue plate around the event-history heading icon. All four factual local
actions, owner/reader routes, recorded thresholds and complete events remain.

## Validation

Production build 8237 exited 0 (2980 modules; existing App bundle-size advisory).
Frozen production index SHA-256:
`986c09b45f527afd9411afbbe818e11297e0f1647da76a7ccd79c4a433aa8d93`.

Initial scoped Live run 44334 exited 1 because its section-mark verifier still
selected the former direct-child h2. Change that selector to the new matrix
heading wrapper; preserve all one-heading, mark-size and geometry assertions.
No app correction or tolerance change was required for that failure.

Final scoped Live run 9937 exited 0: four EN/TH × dark/light pairs, all
byte-identical, no masks. Assertions retain exact API rows, minute values,
raw totals, shared scales, missing/zero/partial/aggregate/unknown semantics,
full tables, disclosure text and keyboard access, pagination, all-record End
access, dialog focus restoration, pause/resume and response-race recovery.

Authenticated workflow 71600 exited 0 on the same frozen source candidate via
local Vite (production scope checks above serve built assets): 16 responsive
combinations across nine routes and functional/occupied/compatibility checks
across all eight pages. Browser, Vite, daemon and database teardown completed.
Services and databases are local synthetic test instances.

Final scoped Alerts run 3181 exited 0: four EN/TH × dark/light pairs, all
byte-identical, no masks, matching the same frozen production-index hash.
Actual quota/forecast/reset/reader/notification facts, exact local-action routes,
100↔500 event expansion, all 60 events with keyboard End access, empty history,
full sample tables and 390/900/1280px overflow checks pass.

## Source review

All four Live variants measure advisory y72..415 and matrix y425..932; the first
matrix row starts y501.5. These track source estimates y72..415, y425..932 and
approximately y501. Fresh EN/dark and TH/light image inspection found readable
controls and no visible clipping, with eight full session rows and six full
feed rows. The occupied 12-pair workflow also retains the full y72..932 rail.

All four Alerts variants measure guidance y419..747, first row y477.1875 and
history bottom y925.390625. The source guidance frame is y419..747 with its
first row approximately y477. Fresh EN/dark and TH/light image inspection found
the blue event-heading plate and readable complete guidance without clipping.

The [comparison viewer](reference-review.html) displays copied original PNGs,
actual EN/dark captures and a 50% overlay at original size. Verified original
hashes: Live `35f1e735c0d020824f666285038475a6be4af6413c02b3a20f9af75a54e46db6`;
Alerts `f2d05a17e7613035e2a41302baf6a8792ed519de66af0ab159dd56842062f104`.
Repeated captures establish stability, not a source-likeness percentage.

Provider grouping, lighting/artwork and other pages' recorded differences remain
in [remaining work](NEXT-SOURCE-REPAIRS.md), together with final whole-build
acceptance and release gates. The overall goal remains in progress.
