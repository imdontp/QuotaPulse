# Particle globe surface v1.85.33

## Scope and asset

Continue the original eight-page real-data concept goal aftered2d823/v1.85.32.
The original Overview reference remains authoritative. Only the globe surface
bitmap changes; live labels/quota/progress/rings and source clip geometry remain.
Old v2 is retained for recovery. The v3 asset is local and decorative; no new
animation, request to an external service, or dependency is added to the app.

Original Overview reference SHA-256:
`924849d96af48d5f0aae3ab330e01df929485020ef91e9c0516f1fd7cc0d96ce`.

Built-in image_gen style-transfer edits the existing globe using the original
Overview screenshot as a style reference. The chosen candidate removes much
of the photographic ocean texture and emphasizes particle geography. It is not
claimed to be an exact copy or accepted visual baseline.

Selected asset: packages/web/public/redesign/pulse-earth-v3.png.
SHA-256: `26c7a75d8c40eabede74299de44ee607832db29d8a1d0d9572f02e00e83f4e03`.
Read-only bitmap inspection:1254x1254,32-bit ARGB; corner alpha0, center alpha252.
The generated alpha is preserved. Asset size1,603,335 bytes versus v2's1,689,793.
Serving checks compare the actual v3 response to the local selected asset hash.

## Validation

Production build13395 exited0;2980 modules. Existing532.87kB main App advisory
remains. Final candidate index SHA-256:
`1e05f7cad05e4ed7b4d9d90c467d3fd2dbf60310c4ca7b0456b800813821db95`.
Four-variant Overview production check11728 exited0: four pairs, all
byte-identical, no masks. Every variant serves the expected v3 asset hash and
decodes1254px width. Actual selected quotas83/62/72/58/34, boundaries0/100/125,
unknown and reduced-motion checks pass. Existing API/quota/geometry/contrast,
responsive overflow and keyboard/focus gates pass. en/dark hero bottom462,
pulse center734.546875/252 and runtime edge error0. All manifests carry the
exact frozen build hash; port7804 is clear after teardown.

Full authenticated workflow89284 exited0 on this frozen source:
all16 language/theme/width combinations across nine destinations pass, followed
by final functional/occupied/compatibility gates for the eight dashboard pages.
Browser, Vite, daemon and database teardown complete. Fresh workflow reports
are copied with this checkpoint. Diff whitespace passes.

Fresh en/dark source review: v2 ocean/cloud/terrain streaks are removed; land
reads as finer cyan particles/coastlines, with a darker Atlantic behind readable
72%/monthly/token labels. Atlantic orientation and x38/y19/284px/clip/ring focal
geometry remain. Greenland/northern cap still looks too solid/bright versus
source, and the uninterrupted layered halo is broader/more luminous than source.
Fresh dark and light captures preserve readable labels, focal alignment and
geography. Light has no opaque rectangular background or clipping. No blocking
visual regression observed; source acceptance remains open.

## Remaining full goal

Source particle brightness/density, stars, other eight-page style differences
and production overrides require final source review. Finish a single final
eight-page/23-override ledger, precise geometry sheet, named approved baseline,
40pair matrix and SSIM against that approved implementation baseline, current
render/query/animation performance, full RC/recovery and manual accessibility.
Repeated screenshots do not prove99-100% likeness to the original concept.

## Final image prompt

Use case: style-transfer. Asset type: transparent square globe surface for
QuotaPulse dashboard, replacing Image1. Image2 is the exact style reference:
match ONLY its central globe surface behind72%, not its UI. Keep Image1 globe
centered and the same globe diameter/circular silhouette and Atlantic-facing
geographic orientation. Replace photographic solid land masses/clouds/ocean
topography with fine sparse luminous cyan/blue particles outlining North
America, Greenland, Europe and Africa against almost black navy oceans. Match
the dark, delicate particle geography of Image2, with larger dark quiet ocean
areas; subtle cyan edge upper-left and very restrained violet edge right. Keep
inside of globe dark opaque navy so live white numbers can be overlaid by code.
Outside globe must have real transparent alpha. No words, numbers, UI,
quota/progress rings, outer orbits, surrounding waves, stars outside globe,
watermark. Exactly one isolated circular globe, square canvas, no added framing.
