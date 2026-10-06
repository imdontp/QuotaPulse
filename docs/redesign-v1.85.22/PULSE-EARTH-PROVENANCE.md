# Pulse Earth v2 provenance

The built-in `image_gen` tool edited the existing `pulse-earth-v1.png` using the
supplied `refs/overview.png` as a visual reference. The selected transparent
output is retained at `packages/web/public/redesign/pulse-earth-v2.png`; the v1
asset remains available. The app consumes this local asset without a network
request. Dashboard labels, percentages and progress arcs remain native live UI.

SHA-256: `0dae6b7c6b8f5fc9d424a72c8f170dcaa6073c73de796db283b9700d6fcb9f81`.
Dimensions: 1254 x 1254. PNG corner alpha is 0; the sphere has nonzero alpha.
The browser gate checks the served file hash, successful image decoding and
natural dimensions. The initial gate expected the preview's scaled 1280px width;
direct inspection established the retained output is 1254px like the original.

## Final prompt

Edit target: first image, the transparent globe asset. Second image is visual
reference only, the QuotaPulse Overview dashboard. Produce ONLY the isolated
circular Earth surface asset to closely match the Earth disk inside Pulse Core
in the reference, excluding all dashboard text, percentages, progress rings,
orbit trails, starfield, UI and background. Preserve the target's square canvas
and globe center/diameter/padding and transparent background. Major required
change: make the ocean-facing central hemisphere almost black navy, with sparse
subtle blue dotted terrain, luminous cyan rim on the upper-left and slim violet
right rim. Reduce bright continental outlines/city lights substantially;
concentrate small northern land patterns near upper arc and a slim left perimeter,
the center and lower-right should be quiet dark ocean. Match the reference's
restrained textured holographic sphere rather than an evenly bright map. No
labels, digits, letters, bright central landmass, new objects, outer rings or glow
outside the existing rim. True transparent alpha outside the globe.

This is a generated interpretation of the supplied surface. It is not an exact
extraction of the source graphic or proof of whole-image visual acceptance.
