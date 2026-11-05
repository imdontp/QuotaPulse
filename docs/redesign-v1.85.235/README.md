# Projects selected-card chart atmosphere

The selected Projects card now has a static, low-opacity accent field behind its real usage and mini-trend on the native dark desktop layout. It does not add points, activity, a curve, or motion. The treatment follows the selected project's existing accent and does not alter other themes or narrower layouts.

`review.html` links the original reference and the unmasked before/after captures. Both captures use the same isolated synthetic SQLite fixture, fixed clock, English/dark, 1672×941 viewport, device scale 1 and reduced motion; they do not contain user data. The reference contains different example data and unsupported concepts, so the pictures do not establish a whole-page likeness percentage. Actual recorded usage and approved data overrides remain authoritative.

During the same-page CSS intervention, the selected card's HTML, boxes of all 132 inspected elements and hit test were unchanged (`intervention-state.json`). Applying isolation to the entire card first changed its shadow and was rejected; the accepted version isolates only the usage layer. Before and compiled-after captures differ at 17,039 pixels: 17,038 within x=260–530, y=335–415 and one outside that area. No screenshot masks were used. The after capture exactly matches the injected trial and a repeated compiled capture. `capture-verification.json` records the build index hash, fixture and screenshot hashes.

The web build and 382 web tests passed. The build retained an existing Vite warning about chunks larger than 500 kB. The Projects stable browser suite passed all four English/Thai and dark/light capture pairs, each byte-identical on repeat, with no masks. Its fixture checks included chart points against the API, unknown and partial costs, sort-stable identities, keyboard selection, search and project details. `stable-verification.json` retains the suite's recorded results; these are fixture checks, not live-provider validation.

This is one visual improvement, not acceptance of all eight pages, real provider integration, release readiness or the 99–100% target. Review230 predates this change.
