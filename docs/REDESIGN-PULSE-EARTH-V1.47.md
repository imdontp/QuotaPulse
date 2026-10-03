# Pulse Earth and used-quota presentation v1.47

Continue the real-data redesign after v1.46. The dominant remaining Overview
image mismatch was the simplified vector Earth. The source concept uses a
textured luminous globe and a used-quota percentage in its center.

## Implementation

- A new local RGBA Earth asset was generated from the supplied Overview reference
  with the built-in image generator. It contains the planet surface only: no
  percentages, text, owner identity, progress rings or mock dashboard values.
  The source concept remains unchanged. The final asset is committed under
  `packages/web/public/redesign/pulse-earth-v1.png`, not left at a temporary or
  generator-only path. It requires no external request during app use.
- The SVG retains the orbit/halo and live progress ring, and clips the local
  image to its existing Earth disk. The previous approximate continent paths,
  noise filter, grid and 400 surface dots are replaced by the raster surface.
  Background fallback fill remains beneath the image.
- Pulse Core now shows the selected provider reader's actual `used_percent`
  with a localized **Quota used** label. This follows the source concept's
  used-quota meaning and the blueprint's data-semantic rule. The readable owner
  and window remain below it. No token denominator is inferred or invented.
  The separate quota-window cards still explicitly show remaining percentages.
- The ring reflects used percentage rather than remaining percentage. Unknown
  quota displays an em dash and no progress arc. Zero uses a flat line cap to
  avoid an invented minimum dot. Readings over 100% retain their real numeric
  label while the ring stops at one complete turn.
- The quota transition uses the existing 420ms slow motion token and shared
  easing. Reduced motion suppresses the transition. Static image content does
  not start any animation or background polling.
- Six Overview section headings now have 26px rounded icon tiles in the shared
  blue/violet palette. Negative block margins preserve their existing occupied
  line height and panel geometry. The dark Earth keeps readable white/cyan
  labels in both themes.

[Asset provenance](redesign-v1.47/pulse-earth-provenance.json) records the source
and output SHA256, dimensions, alpha checks and generation constraints.

## Validation

The web TypeScript/Vite build passed with the existing large-chunk warning.
All 124 web unit tests passed with no failures/skips. The final Overview browser
run passed all four Thai/English dark/light sets, with four byte-identical repeat
pairs and no masks or changed raster tolerance.

The new Pulse Core gate checks the served PNG's SHA256 against the retained asset,
successful browser decoding at 1254px, decorative accessibility treatment and
the localized used-quota label. Selecting both fixture owners yields 85% and
97% from independently read API limits; their live arc values match. Isolated
API response variants check 0%, 100%, 125% and unknown. Zero has no rounded
minimum dot, 125% keeps its numeric value with a full ring, and unknown has no
invented arc. Reduced-motion transitions remain at most 1ms.

The initial check expected an exact zero-second transition and failed because
the existing global reduced-motion rule sets 0.001ms with `!important`. The
gate now accepts no perceptible transition (at most 1ms); the corrected check
and all surrounding checks passed in the final run. This changed the motion
behavior assertion, not screenshot masks or raster tolerance.

Existing model keyboard/detail access, complete runtime/quota-history controls,
font/shell checks and 390/900/1280 overflow checks passed. Hero bottom remains
463.1875px, model rail 270px and activity bottom 990.640625px in the 1586×992
Overview concept viewport. The test database is synthetic in memory; readers,
real account probes, external and daemon-write requests are disabled/forbidden.
No browser errors were recorded.

[Final browser verification](redesign-v1.47/verification.json),
[unit test output](redesign-v1.47/unit-tests.log),
[web build output](redesign-v1.47/web-build.log) and
[reference viewer](redesign-v1.47/reference-review.html).
Only terminal-generated trailing whitespace is normalized in the retained build
log; the original local output remains at `tmp/pulse-earth-build.log`.

This checkpoint's browser scope is Overview. The seven other source pages and
Settings were not recaptured here. The v1.44 418-test integration gate remains
separate evidence for that build; it was not rerun as a v1.47 result.

Version tag: `redesign-pulse-earth-v1.47.0`, isolated branch
`design/redesign-foundation`, original QuotaPulse origin.

## Review bundle

`tmp/review-bundles/QuotaPulse-v1.47-cTVykh.zip`: 201555553 bytes, 3134 files.
Every entry was decompressed and SHA256-compared with the bundle source.
No app profile is included. Archive SHA256:
`7d8c2931d342e98b096c52a13e91805f875d3b13e93045ab47776975bfea6a4e`.

The archive contains the exact tested production index and Earth image; their
hashes and all four retained canonical capture hashes were verified. The source
Overview copy also matches the supplied reference hash. Existing 87 runtime
packages were copied without dependency installation or native rebuild.

Requires Windows x64 and installed Node ABI 127 (Node 22). Extract to a new
dedicated folder and run `./scripts/start-review.ps1`; stop using
`./scripts/stop-review.ps1`. Readers/account probes remain disabled and a new
review database starts with empty usage. This is an unsigned review bundle;
extracted-runtime/installer and manual release acceptance were not rerun here.

[Bundle build](redesign-v1.47/bundle-build.json) and
[archive verification](redesign-v1.47/archive-verification.json).

Final diff whitespace check passed. Scoped process inspection found no remaining
Node/Chromium test processes. The original checkout is clean at
`be8e145039247958992fa7673a9c77e1bff35db1`.

## Remaining goal

This is a reference-derived image, not an assertion of identical source pixels.
The complete eight-page 99–100% target still needs remaining geometry, content
hierarchy, effects and manual visual/release acceptance. Reference similarity
and repeated application captures remain separate checks.
