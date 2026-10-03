# v1.36 reference composition repair

## Scope

Continue the user's requirement: production data with appearance matching the
eight supplied refs. Visual acceptance remains open under
[reference repair](REDESIGN-REFERENCE-REPAIR.md). This checkpoint advances three
screens and does not claim 99–100% likeness.

- Overview: model identity tiles and actual token shares, harness/provider marks
  on recent activity, colored cache metric grouping and a decorated runway with
  the actual now/reset endpoints. Model identity tiles remain generic because
  the Runtime Map response does not provide model-maker metadata.
- Live: the summary stays in the main column; the advisory/activity rail starts
  beside the page header. Summary tiles gain relevant icons. Session rows include
  the recorded harness identity and its offline mark.
- Models: summary/filter/comparison stay in the main column; selected details
  start beside the header. Summary precedes the filters as in refs. The comparison shows maker/provider marks from their
  distinct API fields. Unknown makers use a generic model icon. The token donut
  gains a dark-theme glow. At desktop widths the 124px donut sits to the right
  of its legend, the observed trend has a 112px plot, and the detail cards retain
  the reference's vertical allocation with actual facts and explicit unknowns.
  Live/Models use 12px main padding and page-specific column proportions.
- Live and Models: real time buckets now render as straight SVG line segments,
  points and a gradient area. Zero buckets remain at zero and tiny values remain
  proportional. No smoothing, fake samples or random visual series are added.
  Each point retains its timestamp/value tooltip and the complete native data
  table remains accessible through the existing disclosure.

The line-chart component uses deterministic SVG IDs and static effects. Narrow
layouts keep the existing stacked structure. Account readers, native tray/pet
behavior, dependencies and original checkout are unchanged.
Harness icon fallback uses the canonical harness owner's vendor from the
Overview API, independently of the provider/model used by that harness. No
additional API request is introduced.

## Validation method

The existing browser gate now checks line-point timestamps, values and y
coordinates against independently queried daemon API values. Projects retains
its proportional-bar checks. The Live/Models capture gate additionally checks
that the rail starts at the same y as the header and sits to the right of the
summary. Existing bounds, complete data, keyboard, quota/runtime access,
overflow, fonts and unmasked repeatability gates remain.

An initial model selection check used button `textContent`, which included a
decorative fallback letter. The selected details correctly contained the model
name. The check now reads the dedicated model-name span; unknown makers render
a generic icon. This is a comparison-instrument correction, not evidence of
incorrect selected model data.

Before the final desktop size changes, the full eight-page browser run passed
36 screenshot pairs across English/Thai and dark/light themes. Thirty-three
pairs were byte-identical. Projects English dark differed at ten pixels by at
most two channel levels; Projects English light at eight pixels by at most one;
Overview English light at five pixels by at most one. No pixels were masked and
the existing tolerance was unchanged. See
[combined verification](redesign-v1.36/combined-verification.json).

The final composition scope checks Overview, Live and Models again after the
desktop size changes. Its output uses a separate folder and manifest so the
combined-run evidence is preserved.

## Final validation

- `npm run build -w @quotapulse/web`: TypeScript and Vite passed. The existing
  bundle-size warning remains; no dependency installation or native rebuild.
- `QUOTAPULSE_CAPTURE_SCOPE=composition node --import tsx scripts/check-stable-captures.mts`:
  12 pairs passed, 11 byte-identical. Overview English light differed at five
  pixels by at most one channel level, within the unchanged unmasked tolerance.
  API-matched points, zero/tiny values, complete tables, keyboard interactions,
  responsive overflow and shell/font checks passed. See
  [final composition verification](redesign-v1.36/final-composition-verification.json).
- Live and Models header/rail tops are both 72px in all four language/theme
  combinations at 1672px. Their rail left edges are 1288.9375px and 1278.90625px,
  respectively. These are measured app positions, not a similarity score.
- Final app index SHA256 and the copied review-bundle index agree:
  `d9443e5a14eb1e5224fb927dd316f5906966e538ba3505c27c715b689fb1caca`.
  The combined run used an earlier build; its index hash is preserved in its
  own manifest. Overview/Live/Models images in this evidence folder come from
  the final focused run; other pages retain the earlier combined-run images.

The isolated worktree remains on `design/redesign-foundation`, using the existing
QuotaPulse origin. The original checkout remains clean at
`be8e145039247958992fa7673a9c77e1bff35db1`. The extracted runtime/installer,
manual screen-reader review and broader release suites were not rerun here.

## Review artifact

`tmp/review-bundles/QuotaPulse-v1.36-aD5Fey.zip` contains the final build with
87 installed runtime packages, for Windows x64 and external Node module ABI 127.
It is an unsigned review bundle with readers disabled and no app profile, not a
production release. Every one of its 3,128 entries was decompressed and
SHA256-compared with its source. ZIP size: 199,846,094 bytes. See
[bundle inventory](redesign-v1.36/bundle-build.json) and
[archive verification](redesign-v1.36/archive-verification.json).

Archive SHA256:
`ec8294941d48fd07cf3e91e163df7bb6950daf51d7af03e08c10b48f130eeb69`.
Extract to a new dedicated folder, then run `scripts/start-review.ps1`;
`scripts/stop-review.ps1` stops that review instance. A fresh profile has empty
usage data; the screenshots use a separately constructed synthetic memory DB.
The scripts do not install dependencies or register scheduled tasks.

Checkpoint tag: `redesign-reference-composition-v1.36.0`.

The first complete composition run passed functional checks in all four
language/theme sets, then failed repeatability for English light Overview:
35 changed pixels, maximum channel difference 5 (allowed maximum 2). A local PNG
decoder probe located the differences at x=1020–1035, y=298–309 and y=355–366,
with five additional low-delta pixels at the model rail's lower edge. The main
clusters coincide with the new model-tile SVGs. The next causal comparison changes
only their SVG rendering properties, retaining the scroll/detail interaction and
all pixels/tolerance in the original check. No prior failure is counted as a
completed browser verification.

That isolated Overview comparison passed four pairs after applying geometric
SVG rendering and a separate paint layer to the model-tile icons. Three pairs
were byte-identical and the remaining pair stayed within the unchanged tolerance.
[Diagnostic pixels](redesign-v1.36/initial-svg-diff-pixels.json) and
[isolated verification](redesign-v1.36/svg-render-verification.json) preserve the
failure coordinates and this causal check. The supported diagnosis is localized
SVG raster variation; the exact internal Chromium cache mechanism was not
established. The final combined check also covers the subsequent harness metadata
and summary ordering changes.

## Remaining visual work

Overview still needs final globe/rail typography, richer insight composition and
activity layout. Live needs closer occupied-table/feed proportions and further
activity-rail treatment. Models needs typography and further detail treatment.
Projects, Providers, Cost, History and Alerts still
have the individual appearance gaps recorded in the reference repair register.
The sparse synthetic charts show sparse fixture data; production shapes depend
on real records. Reference similarity scoring and user visual acceptance remain
separate from browser correctness and repeatability.
