# Source91 independent visual direction review

## Scope and verdict

**Approve the three directions for controlled browser trials, not yet as accepted implementation.** All are supported by original reference paint/geometry rather than an invented visual preference. A compiled before/after trial with current source, true data and unchanged non-target geometry is still required before shipping. This review does not reduce the original eight-page objective to these candidates or claim a likeness percentage.

Read `tmp/source90-visual-priorities.md`, current90 continuation requirements, existing production CSS/ObservedTrend/Runtime markup and the original ZIP03 motion/design contract reviewed previously (SHA a52795d2b0e200624fae73b8a774fbcf5fd683fed16def4a66be0f2a819e5d89). Independently viewed **all eight original refs** via view_image: Overview, Live, Projects, Models, History, Alerts, Providers, Cost. Independently viewed historical88 Overview/Live/Models after images. No current91 browser capture was supplied at this review step; historical88 is explicitly a comparison aid, not current91 acceptance evidence. No browser/build/Git/application edits performed.

## 1. Runtime model-share track placement and paint

Original Overview visibly allocates a longer track before the right-aligned percentage. First row starts aroundx1393 and extends to1497, while88 starts around1428 and ends1495. Model icon/row outer positions already align much more closely. This is supported width-allocation mismatch, not a wrong recorded percentage. Source first fill is blue-leading with violet/lighter-blue falloff; current88 cyan-leading fill is visibly brighter/colder.

Current CSS `.qp-map-node .qp-node-share` width38%, fixed percentage label+7pxgap leaves roughly67px track. Increasing native-dark share region to about50–51% plausibly yields the Source~104px track in the current~298px node. This is a trial target, not a universal responsive token. Blue/violet leading material should be sampled at equivalent relative positions in actual fill length; absolute samex samples from displaced fills cannot establish gradient-stop equivalence.

### Acceptance criteria

- Current compiled before/after with same exact actual graph, quota/period/project selection, node identities/labels, real tokens, shares and sessions.
- Record actual track start/end, fill width and percentage. First Source-compatible row approaches target104px track andx1393 start at original1586 viewport; other rows stay proportional to their actual shares. Preserve actual inline share values including0,1,100 and fractional values; no minimum visible nonzero fill or clipping of100%.
- Preserve all node outer boxes, columns, graph paths/endpoints and actual edge identities/paint except the explicitly targeted track fill. Width change must not subtly move icons or right percentage edge.
- Check original four Source names plus long real model names, exact null/empty identities, Thai, keyboard focus and title/accessibility label. Extra~35px for the bar comes from the label flex area: ellipsis is acceptable if full actual identity remains available through title/accessible name/detail, but overlapping or unreadable ordinary names is not.
- Limit first implementation to original native dark production Overview breakpoint. Light/1280/900/390 remain unchanged unless separately measured. Frozen/error/loading/selected-project transitions must not acquire unrelated layout movement or animation.

## 2. Live and Models inset header surface

Original Live header is an identifiable rounded dark-blue strip inset within the panel;88 nearly merges it into panel background. Original Models strip is subtler but also separates headings from selected first row. Independently recomputed fixed-ROI medians with Pillow reads:

| Native ROI | Source median RGB | Historical88 median RGB |
| --- | --- | --- |
| Live[650,272,690,298] |10,22,42|7,16,28|
| Models[650,350,690,379] |9,18,34|7,16,28|

These reproduce the prior audit. ROIs include sparse text; median limits that influence but is not an isolated background measurement. Visually verify Source edge/border/rounding and current candidate across the entire strip. Do not copy a single RGB to every state or infer a large luminance boost for Models from Live's stronger band.

### Acceptance criteria

- Paint-only trial retaining actual table bounds/column widths, header/row heights, padding, sticky offsets, sort/search/pagination behavior and accessible actual column labels. Rounded first/last corner silhouette should stay inside existing table geometry.
- Inspect cell boundaries: a horizontal gradient restarted in each cell creates repeated highlights absent from Source. Shared row surface or vertically aligned same-y paint can be coherent; sticky cells must remain opaque enough that body text never bleeds through behind the headings.
- Compare fixed Source ROIs and full strip before/after. Source-hue/luminance distance should improve without broad new glow or a brighter first-row selection border being mistaken for header improvement.
- Real long-session scrolling must demonstrate sticky header remains a continuous strip. Native horizontal overflow/keyboard scroll and Thai long column headings must retain information; light/compact remain unchanged under the scoped candidate.
- Preserve approved observed-data semantics. Source Live's Active/Queued/Failed labels, Runtime, provider latency and inaccessible source telemetry are not authorized replacements for actual recorded-session columns. Models must not restore fake speed/quality/capability fields.

## 3. Models row-history filament weight

Original small Trend histories are fine colored filaments with localized glow.88 real row histories contain visible2px horizontal baselines and sharp right spikes. The sharp/sparse/zero history is a real-data difference; reducing stroke can improve filament treatment without changing that history. Current varied blue/violet/orange/cyan/rose palette already exists; claiming these rows are uniformly blue would be incorrect.

Current ObservedTrend shares strokeWidth2 across chart sizes. Scope trial only to native-dark `.qp-model-row-trend .qp-observed-line`; do not globally alter ObservedTrend. A1–1.25px candidate is a reasonable measured range to trial, not pre-accepted final width.

### Acceptance criteria

- Exact same points strings, circle coordinates/data-values, runs/gaps, actual model+provider pair identity, palette, axis scale and API snapshots. No copied Source wave, smoothing, interpolated missing observations or fabricated rows to match12-source-row density.
- Compare sparse/recorded-zero/unknown-gap plus a dense actual-history fixture. Thin anti-aliased lines must remain visible against ordinary/selected dark row surfaces. Existing color contrast tests alone do not establish actual thin-raster readability.
- Preserve96x26 chart box, circle/title accessibility, table geometry and row selection. Local stroke footprint may change; neighboring text/rows/light variants should not.
- Inspect glow falloff separately. If the wide luminous halo still dominates, a thinner central line alone may not match Source; do not compensate by distorting actual points or dimming all palette tones without new evidence.

## Evidence boundaries and broader goal

The three directions are supported, but Source resemblance must be judged with fresh current compiled captures and root's actual controlled trials. Historical88 helper images have different snapshot/motion behavior and cannot be relabelled91. Rendering repeat tolerance proves repeatability, not original-reference acceptance. Preserve archived Models/Projects raster failures and do not call these paint trials a causal raster fix.

Own original-eight viewing also confirms a repeated inset-blue table language in History/Cost and fine luminous charts throughout. That does not authorize changing all eight pages via these local selectors. Remaining typography weight/spacing, exact art/material, other page composition, factual interactions and final human acceptance still require full-scope review. Motion implementation for History/detail and Alerts is separately underway; this visual direction review does not certify those new behavior paths.

The original data contract remains authoritative: genuine topology and provider identity, exact observed grain/zero/missing states, real pricing coverage, genuine forecast availability and supported actions. Long labels and large real numbers may require honest truncation/overflow; inventing short fixture text or values to gain a raster match is unacceptable.

## Inspected image provenance

- Source Overview924849d96af48d5f0aae3ab330e01df929485020ef91e9c0516f1fd7cc0d96ce;88Overview2a24a0944cddbb3d43382b9a1a9474627f7ecea04de648f4101a80813a01163d (1586x992).
- Source Live35f1e735c0d020824f666285038475a6be4af6413c02b3a20f9af75a54e46db6;88Livec2fc7f6e3071264765d693c4bae924b7d3a5be1fc5c372f8c174855950029df9 (1672x941).
- Source Modelsb055379b1469f65bcf85819a1b1e32ff431e72f4f0c7d4b23192d53212f83d2c;88Modelsec7265424f2aa99326a905181d50e5d37fe556052689f4bedd0551cd7036de59 (1672x941).

Sole authored artifact: this review. Verdict remains approval to trial supported directions, with acceptance conditional on the concrete current-render evidence above.
