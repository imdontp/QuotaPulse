# Raster failure review — final52 Models EN/dark

## Status and evidence

Final suite session8256 failed the original strict pixel gate, exit1. Frozen index: `a75576c71d4f79d6b86263b6fc0bab2d8aee150e92db34c9435966f7c3c34186`. Retained PNGs/pixel JSON in `tmp/reference-52-final-matrix-failure`; prior initial candidate TH/dark failure in `tmp/reference-52-matrix-failure`. Read-only analysis of retained pixels, screenshot crop, source styles and current sidebar DOM evidence. No browser or implementation change performed. **Failure established; precise raster mechanism unconfirmed.**

## Exact painted regions

34 changed pixels, maximum channel delta20. Three pixels exceed the allowed channel10 threshold; changed area itself is below the permitted 0.005% fraction.

- **8 active navigation rim pixels**: x17–18 at y232–233 and274–275. Only three exceed10: (17,232)13, (17,274)14, (17,275)20. This is the top/bottom curved left edge of the active Models link.
- **4 Quick Stats top-left rounded border pixels**: x17–19,y443–444, each delta1.
- **22 Models top heading frame / Refresh button curved top-edge pixels**: x242–245,1154–1158,1252–1262,y72–74, each delta1–2. The screenshot and source identify the heading enclosure pseudo-element (`models.css:121`) and Refresh border (`models.css:7`). Exact DOM coordinate probes of these header elements were not retained; this attribution is supported by the visible crop and styles, not claimed as an independent elementFromPoint result.

No text, metrics, risk badge, chart trace, data table content or layout shift appears in the changed-pixel set.

## What is established about the active rim

Both pass DOM records show active link x12,y231.5,width201,height44,radius7,DPR1, same transformnone, font, background and border. The native rim is an SVG background in an absolute ::before (`overview.css:1518–1525`), blue `#009eea` = [0,158,234]. First-pass pixel(18,275) is exactly [0,158,234]; repeat is [1,153,228]. This shows varying final coverage/compositing of the new vector paint at that edge. It does not identify why coverage differs.

The prior initial TH/dark failure changed18 pixels, max29, with14 active-corner pixels x17–20,y232–275 and the same four Quick Stats rounded-edge pixels. Prior active paint was the inset shadow; the final candidate instead paints the blue vector, yet the original full sequence still failed in the corresponding region. Therefore replacing the inset shadow did not eliminate the observed gate failure. An inset-shadow-only root cause is unsupported, and an SVG-only universal cause cannot explain the prior non-SVG failure.

The saved sidebar equality assertion excludes computed ::before styles, ancestor transforms/scroll, opacity/filter state and compositor/raster-layer offsets. Equal recorded bounds are strong evidence against ordinary layout/data changes, but not proof that every paint input or paint-history state matches.

## Ranked bounded hypotheses

1. **Curved-edge sampling/compositing affected by fractional device coordinates and renderer paint history.** Strongest bounded diagnosis: every changed region is a curved paint edge, substantive changes are at the active rim, and the link starts at half-pixel y231.5. The exact shared-browser route/resize/interaction sequence differs from isolated fresh Models controls. A specific Skia cache/compositor implementation cause is not proven.
2. **Overlap between new SVG curved rim and the retained CSS rounded border/background, or SVG image sizing/raster-cache coverage.** New pixel RGB proves the vector participates; CSS border and rounded background are shared with the earlier failure. This is a paint-path hypothesis, not yet an independently reproduced mechanism. A source blue vector is a cosmetic change, not a validated causal fix.
3. **Unrecorded transient/layer inputs introduced by screenshot normalization or prior scrolling.** Lower confidence: recorded geometry is identical, two RAFs already execute, hover/focus are normalized and transitions are disabled. Adding another arbitrary delay would not identify this mechanism. Record the omitted inputs and the original interaction sequence first.
4. **API data/fonts/user focus changing content.** Weak: unchanged text/bounds and no glyph/content deltas, actual differences are isolated corners. Existing evidence does not support this as the leading cause.

Renderer flags already include disable-gpu, deterministic-mode, disable-skia-runtime-opts and forced sRGB. This should not be reported as a GPU failure without separate evidence.

## Concrete targeted check

Preserve the exact failing full-route/resize/interaction history and freeze the same build. At each Models canonical/repeat screenshot, additionally record ::before computed background/position/insets/width/height/opacity/transform, active element border/background geometry, ancestor scroll/transform/opacity/filter and visualViewport values. Retain renderer/browser version and, if available, layer-tree transform/raster offsets. Capture two immediate additional screenshots without changing DOM to distinguish stable document differences from changing screenshot/raster state.

Only in an isolated diagnostic browser, run paired interventions that preserve geometry: (A) SVG pseudo hidden with CSS rounded border retained; (B) CSS active border transparent with SVG retained; (C) both normal. Compare the exact eight-pixel rim region and unchanged QuickStats/header edge controls. Reproduce the original sequence for each condition; another six direct fresh-page controls would not test the observed full-sequence state. Do not apply this diagnostic CSS to accepted app source or mask/relax the canonical gate.

If differing curved-edge coverage reproduces only at fractional y, a targeted integer-grid paint comparison may test that factor, but first measure source geometry and preserve nav row cadence rather than snap the whole layout speculatively. Require the original full unmasked gate to pass after any causal correction.

## Remaining limits

The failure is real and retained; mechanism remains unconfirmed. Focused byte-identical pairs and earlier clean-process controls do not overturn this full-sequence failure. Keep checkpoint52 unvalidated/unpublished pending corrected evidence; the archival success finalizer must not run on this exit1 result. Other native/scoped/UI gates may be run independently for meaningful progress, with explicitly separate current-build results.
