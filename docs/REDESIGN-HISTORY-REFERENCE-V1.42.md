# History reference refinement v1.42

Continue the complete dashboard and Settings redesign toward the user's original
reference, with real application data. Direct comparison of `refs/history.png`
and the previous production capture showed a detached title/range row, plain
summary cards, a compressed chart and undecorated record identities.

## Implementation

- History now owns its title and range/source controls in one header row, with
  the reference's blue history tile. The Settings title is preserved.
- Timeline heading and summary cards gain semantic icon tiles. Aggregate token,
  call, monetary-basis and recorded effort values retain their existing API
  meanings. Unknown effort is not converted into an invented average.
- The recorded timeline is 144px high with blue/violet area fills and line glow.
  Straight segments retain actual bucket values, including zero buckets and the
  distinction between aggregate update times and individual call timestamps.
- Records gain harness badges, project folder marks and recorded-provider logos,
  plus subtle alternating rows. No completion status is inferred from usage
  records. All existing fields, filters, export, pagination and detail actions
  remain in place.
- The native modal retains its selected row, focus trap, Escape behavior and
  focus restoration. The complete table remains keyboard scrollable.

## Validation

Web TypeScript/Vite production build passed with the existing large-chunk
warning. The first run's
functional checks passed all four language/theme sets and showed pagination
inside the reference viewport (928.40625px) with five fully visible rows and all
37 fixture records retained. A repeated Thai-dark screenshot then failed the
unchanged raster gate. Pixel inspection localized the difference to
`(1367,90)-(1390,105)`, the native header select's Thai text. The header select now
explicitly uses the existing bundled Noto Sans Thai font at weight 400.

The subsequent complete History run passed all eight repeated pairs (normal
and selected-record views in English/Thai, dark/light). Five pairs were
byte-identical. Selected English-light differed by one pixel/channel level;
selected Thai-dark by 14 pixels at maximum channel delta 2; selected Thai-light
by nine pixels at maximum delta 1. No masks or tolerance changes were used.
All four normal History captures were byte-identical. API-matched metadata,
native modal focus trapping, Escape restoration, selected row, 390/900/1280
overflow and keyboard scrolling to the final record passed. Each desktop set
retained all 37 fixture records, five complete visible rows and pagination at
928.40625px within the 941px viewport.

[Browser evidence](redesign-v1.42/verification.json) is History-only.
[Reference viewer](redesign-v1.42/reference-review.html) labels History v1.42,
Cost v1.41 and the other six pages v1.40 separately. Other pages were not
recaptured in this checkpoint. Native details pictures are retained alongside
the normal captures for all four language/theme combinations.

Version tag: `redesign-history-reference-v1.42.0`, isolated branch
`design/redesign-foundation`, existing QuotaPulse origin.

## Review bundle

`tmp/review-bundles/QuotaPulse-v1.42-o5dSnZ.zip`: 199852661 bytes, 3133 files.
Every ZIP entry was decompressed and SHA256-compared with its source bundle;
no app profile is included. Its production index hash matches the History-tested
build. SHA256:
`fa88abb1c5f6e9af986761c54086f4cd33429655715021592c2f121224f67aec`.

The existing 87 runtime packages were copied without installation or native
rebuild. Requires Windows x64 / installed Node ABI 127 (Node 22.13.1 used to
build). Extract to a fresh dedicated folder; run `./scripts/start-review.ps1`
and stop using `./scripts/stop-review.ps1`. Readers/account probes are disabled,
so a fresh profile contains empty usage. This is an unsigned review bundle.
The extracted runtime/installer and broader release gates were not rerun here.

All eight copied source-image hashes match the user's current refs. Scoped
process inspection found no remaining Node/Chromium test processes. The original
checkout remains clean at `be8e145039247958992fa7673a9c77e1bff35db1`.

[Bundle evidence](redesign-v1.42/bundle-build.json) and
[archive verification](redesign-v1.42/archive-verification.json).

## Remaining acceptance

These are functional production components, not a static concept preview.
The test database is synthetic and not shipped as application data. Fine
typography, filter density, selected detail composition, token-bar decoration,
other-page gaps and broader release/manual acceptance remain open. Screenshot
repeatability is not a measurement of the required 99–100% source likeness.
