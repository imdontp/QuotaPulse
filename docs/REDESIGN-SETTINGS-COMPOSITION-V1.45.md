# Settings composition v1.45

Continue the full dashboard and Settings redesign. The supplied refs contain
eight dashboard PNGs and no Settings PNG. Settings therefore uses the shared
measured dashboard palette, card radii, spacing and icon hierarchy; no claim of
matching an absent Settings concept is made.

## Implementation

- An opt-in `redesign` prop retains the existing Settings handlers and default
  legacy layout. The redesign removes the duplicate title/description and adds
  a shared-style Settings header, section navigation and semantic icon tiles.
- Display, window size, subscriptions, notifications, pricing and runtime remain
  six separate sections. Desktop cards use two columns, collapsing to one below
  1100px. No native/pet/tray implementation is introduced by this layout change.
- Card surfaces, borders, descriptions, selected controls, focus and hover now
  use the dashboard's navy/cyan tokens in dark mode and shared light tokens.
  Language and currency buttons expose their selected state with `aria-pressed`.
- Existing subscriptions, daemon notification settings, window behavior and
  pricing-refresh actions keep their original data sources and callbacks.

## Validation

Web TypeScript/Vite build passed with the existing large-chunk warning. Web unit
tests passed all 124 cases, with no failures/skips. The first Settings browser run
passed four language/theme pairs, all byte-identical. The final evidence run
records Settings-specific checks instead of unrelated chart check labels.

The browser checks six preserved sections, one page h1, selected language and
currency semantics, language changes, THB rate entry/persistence at 40, restoration
to USD/rate 1, and 390/900/1280 horizontal overflow. Preference changes occur
only in the isolated browser's local storage. Daemon writes, real pricing refresh,
account probes and native window changes are not exercised. Shared shell/font
keyboard checks remain in this scoped run. The database is synthetic in memory.

The final Settings-specific evidence run also passed four pairs, all
byte-identical, without masks or changed raster tolerance. Its
[verification](redesign-v1.45/verification.json) records six sections, local
language/currency controls, rate 40 and responsive widths for all four sets.
[Settings viewer](redesign-v1.45/settings-review.html) shows the canonical
viewport captures; the lower page remains scrollable in the app. The existing
eight-page reference viewer from v1.44 remains evidence for that build.

Version tag: `redesign-settings-composition-v1.45.0`, isolated branch
`design/redesign-foundation`, original QuotaPulse origin.

[Web unit test output](redesign-v1.45/unit-tests.log).

## Remaining goal

This checkpoint does not close the eight-page 99–100% reference target or broader
release/manual acceptance. The full nine-page integration captures and 418 unit
tests from v1.44 remain separate evidence for their tested build. Settings write
controls and the extracted runtime/installer are not fully browser-tested here.

## Review bundle

`tmp/review-bundles/QuotaPulse-v1.45-zE0zwm.zip`: 199855437 bytes, 3133 files.
Every entry was decompressed and SHA256-compared with its bundle source. No
app profile is included. Archive SHA256:
`b036d1e15811470850840e36d679586eda194148569e9cd2232fe33b1a65ecbb`.

All four canonical Settings capture hashes and the bundle production index match
the final browser verification. Existing 87 runtime packages were copied without
dependency installation or native rebuild. Requires Windows x64 and installed
Node ABI 127 (Node 22). Extract into a new dedicated folder, run
`./scripts/start-review.ps1`, then stop with `./scripts/stop-review.ps1`.
Readers/account probes are disabled; the new review database starts with empty
usage. This is an unsigned review bundle; extracted runtime/installer acceptance
was not rerun for this Settings change.

[Bundle build](redesign-v1.45/bundle-build.json) and
[archive verification](redesign-v1.45/archive-verification.json).

Final diff whitespace check passed. Scoped process inspection found no remaining
Node/Chromium test processes. The original checkout remains clean at
`be8e145039247958992fa7673a9c77e1bff35db1`.
