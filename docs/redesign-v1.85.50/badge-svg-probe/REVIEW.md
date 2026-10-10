# Independent badge SVG paint review

Readonly inspection of current shell/CSS and final-matrix failure PNGs; no app edits, build, browser, or Git mutation.

## Bounded implementation recommendation

Retain the existing `.qp-nav-count` span, its direct actual count text, `aria-hidden="true"`, existing enclosing link accessible label/title, and `data-alert-count` contract. Add only an empty decorative SVG containing a rounded rect before the text. SVG should be `aria-hidden="true" focusable="false"`; omit SVG text/title so existing exact `textContent` assertions remain valid.

Suggested SVG has no viewBox and a rect with `width="100%" height="100%" rx="9" ry="9" fill="#ed8a36"`. The badge becomes `position:relative; isolation:isolate; background:none`. Its SVG is absolutely positioned `inset:0; width:100%; height:100%; z-index:-1; pointer-events:none; overflow:visible`. Keep existing span sizing, radius, font, line height and count text unchanged. Specific selector `.qp-sidebar nav .qp-nav-count>svg` must override the broad navigation SVG width18 rule. CSS isolation keeps the negative paint layer behind the direct text within the badge stacking context rather than behind the link.

An alternate explicit positioned text child requires overriding compact sidebar span hiding, so retaining the direct text node avoids unnecessary scope.

## Compact dimensions correction

Current `@media(max-width:1100px)` badge is **18x14**, not18x16, with font8 and line-height14. CSS radius9 clamps to7 for both horizontal and vertical radii. SVG rx9/ry9 would independently clamp to9/7, producing an ellipse rather than the existing capsule. Override the compact SVG rect to `rx:7px; ry:7px`, preserving the existing geometry. Keep the existing absolute badge top1/right0 and link position unchanged.

## Source fidelity limits

Viewed original Models source and current failure crop at identical native1672x941. Thresholded orange painted source bounds are178..198,338..358 (21x21); current visible bounds183..202,327..344 (20x18). Source has a lighter orange body/highlight and faint rim; current is flat#ed8a36. The count3 versus4 is intentional real-data variation and must remain API-driven. This SVG-only substitution preserves current geometry/paint intent; it does not establish final source badge fidelity or fix surrounding vertical/navigation differences. Source paint/layout should remain an explicit separate gap.

## Verification and causality

Earlier controls did not reproduce the intermittency. SVG substitution changes the renderer primitive, not the demonstrated cause. A passing run establishes stability only for the observed run and cannot identify the original cause.

Required bounded checks: real risk count0/positive/99+; exact accessible link label/title and aria-hidden span; no SVG accessible focus; native/mobile bounds and text unchanged; light/dark and EN/TH; full existing raster matrix with unchanged tolerances/no masks. Compare native badge paint against pre-change capture to detect any path-raster shape change. Neither dimensions nor raster thresholds should be loosened.
